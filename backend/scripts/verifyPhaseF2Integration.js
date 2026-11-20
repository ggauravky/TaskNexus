require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const mongoose = require("mongoose");
const { assertStagingMutationAllowed } = require("./lib/stagingSafety");

assertStagingMutationAllowed();
const target = new URL(process.env.MONGODB_URI);
assert.equal(target.protocol, "mongodb:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "F2 fixtures require a disposable loopback database");
process.env.EMAIL_ENABLED = "false";

const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const { generateAccessToken } = require("../src/config/jwt");
const { raw: domain } = require("../src/contracts/domain");
const models = require("../src/models");

const ids = Object.fromEntries(["client", "worker", "admin", "publicMember", "task", "submission", "team", "project"].map((key) => [key, randomUUID()]));
const users = [ids.client, ids.worker, ids.admin, ids.publicMember];
const taskIds = [ids.task];
const ownedUsers = () => mongoose.trusted({ $in: users });
const ownedTasks = () => mongoose.trusted({ $in: taskIds });
const marker = ids.task.slice(0, 8);
const clean = async () => {
  await Promise.all([
    models.AuditLog.deleteMany({ user_id: ownedUsers() }),
    models.Notification.deleteMany({ related_task_id: ownedTasks() }),
    models.Payment.deleteMany({ task_id: ownedTasks() }),
    models.Submission.deleteMany({ task_id: ownedTasks() }),
    models.Task.deleteMany({ _id: ownedTasks() }),
    models.ProjectParticipant.deleteMany({ project_id: ids.project }),
    models.Project.deleteOne({ _id: ids.project }),
    models.Team.deleteOne({ _id: ids.team }),
    ...users.flatMap((id) => [models.UserProfile.deleteOne({ _id: id }), models.User.deleteOne({ _id: id })]),
  ]);
};

const seed = async () => {
  await models.User.insertMany(users.map((id) => ({
    _id: id, email: `f2-${id}@example.invalid`, password: "synthetic-fixture-no-login",
    role: id === ids.admin ? "admin" : id === ids.client ? "client" : "freelancer",
  })));
  await models.Task.create({
    _id: ids.task, task_id: `F2-${ids.task}`, status: "delivered",
    client_id: ids.client, freelancer_id: ids.worker, task_details: { title: "Fixture review", budget: 100, revisionLimit: 2 },
  });
  await models.Submission.create({
    _id: ids.submission, task_id: ids.task, freelancer_id: ids.worker, submission_type: "initial",
    content: { notes: "Fixture" }, client_review: { status: "pending" },
  });
  await models.Team.create({ _id: ids.team, slug: `f2-team-${marker}`, name: "Fixture team", visibility: "public", created_by: ids.client, owner_id: ids.client });
  await models.Project.create({ _id: ids.project, team_id: ids.team, slug: `f2-project-${marker}`, name: "Fixture project", visibility: "public", created_by: ids.client });
  await models.UserProfile.insertMany([
    { _id: ids.worker, visibility: "private" },
    { _id: ids.publicMember, username: `f2-public-${marker}`, visibility: "public" },
  ]);
  await models.ProjectParticipant.insertMany([
    { user_id: ids.worker, project_id: ids.project, team_id: ids.team, role: "contributor", show_on_profile: true },
    { user_id: ids.client, project_id: ids.project, team_id: ids.team, role: "lead", show_on_profile: false },
    { user_id: ids.publicMember, project_id: ids.project, team_id: ids.team, role: "contributor", show_on_profile: true },
  ]);
};

const verifyReview = async (call) => {
  const url = `/client/submissions/${ids.submission}/review`;
  const originalCreate = models.Payment.create;
  models.Payment.create = async () => { throw new Error("Synthetic ledger write failed"); };
  try {
    assert.equal((await call(url, "client", { action: "approve" })).status, 500);
  } finally {
    models.Payment.create = originalCreate;
  }
  assert.equal((await models.Task.findById(ids.task).lean()).status, "delivered", "failed ledger write must roll back task status");
  assert.equal((await models.Submission.findById(ids.submission).lean()).client_review.status, "pending");
  const originalNotify = models.Notification.create;
  models.Notification.create = async () => { throw new Error("Synthetic notification write failed"); };
  try {
    assert.equal((await call(url, "client", { action: "approve" })).status, 500);
  } finally {
    models.Notification.create = originalNotify;
  }
  assert.equal(await models.Payment.countDocuments({ task_id: ids.task }), 0);
  assert.equal((await models.Task.findById(ids.task).lean()).status, "delivered");
  await models.Task.updateOne({ _id: ids.task }, { $set: { "task_details.revisionLimit": 0 } });
  assert.equal((await call(url, "client", { action: "request_revision", feedback: "Fixture" })).status, 400);
  const approvals = await Promise.all([call(url, "client", { action: "approve" }), call(url, "client", { action: "approve" })]);
  assert.equal(approvals.filter((response) => response.status === 200).length, 1);
  assert.equal(await models.Payment.countDocuments({ task_id: ids.task }), 1);
  assert.equal(await models.Notification.countDocuments({ related_task_id: ids.task }), 1);
  assert.equal((await models.Task.findById(ids.task).lean()).status, "completed");
};

const verifyDispute = async (call) => {
  const url = `/admin/disputes/${ids.task}/resolve`;
  assert.equal((await call(url, "admin", { resolution: "pay_freelancer" })).status, 404, "missing ledger is not a successful resolution");
  await models.Payment.create({
    payment_id: `F2-${ids.task}`, task_id: ids.task, client_id: ids.client, freelancer_id: ids.worker,
    amounts: { freelancerPayout: 85 }, status: "escrowed",
  });
  assert.equal((await call(url, "admin", { resolution: "pay_freelancer", refundClient: true })).status, 400);
  const decisions = await Promise.all([
    call(url, "admin", { resolution: "pay_freelancer" }), call(url, "admin", { resolution: "pay_freelancer" }),
  ]);
  assert.deepEqual(decisions.map(({ status }) => status).sort(), [200, 409]);
  const payment = await models.Payment.findOne({ task_id: ids.task }).lean();
  assert.equal(payment.status, "released");
  assert.equal(payment.refund, undefined);
  assert.equal(await models.AuditLog.countDocuments({ resource_id: ids.task, action: "dispute_resolved" }), 1);
};

const verifyRoster = async (call) => {
  for (const path of [`/projects/${ids.project}`, `/projects/by-slug/f2-team-${marker}/f2-project-${marker}`, `/projects/${ids.project}/participants`]) {
    const response = await call(path);
    assert.equal(response.status, 200);
    const { data, meta } = await response.json();
    const rows = data.participants || data;
    assert.deepEqual(rows.map((row) => row.user_id), [ids.publicMember], "public roster must omit private and opted-out identities");
    assert.equal(meta?.total ?? data.participant_count, 1);
  }
};

const verifyMarketplace = async (call) => {
  const expectReply = async (path, role, body, status = 200, method) => {
    const response = await call(path, role, body, method);
    assert.equal(response.status, status, `${method || (body ? "POST" : "GET")} ${path}`);
    return (await response.json()).data;
  };
  const task = await expectReply("/tasks", "client", {
    title: "Phase F fixture task", description: "Exercise the full authorized marketplace workflow.",
    category: domain.taskTypes[0], budget: 100, deadline: new Date(Date.now() + 86400000).toISOString(),
  }, 201);
  taskIds.push(task.id);
  await models.Task.updateOne({ _id: task.id }, { $set: { "task_details.revisionLimit": 1 } });
  await expectReply(`/admin/tasks/${task.id}/review`, "admin", { action: "approve" });
  await expectReply(`/freelancer/tasks/${task.id}/accept`, "freelancer", {});
  await expectReply(`/freelancer/tasks/${task.id}/start`, "freelancer", {}, 200, "PUT");
  await expectReply(`/freelancer/tasks/${task.id}/progress`, "freelancer", { progress: 40 }, 200, "PUT");
  const delivery = await expectReply(`/tasks/${task.id}/submit`, "freelancer", {
    deliverables: [{ type: "link", url: "https://example.invalid/first" }], comments: "First delivery.",
  }, 201);
  await expectReply(`/client/submissions/${delivery.submission.id}/review`, "client", { action: "request_revision", feedback: "Please improve the delivery." });
  const revisedContent = {
    deliverables: [{ type: "link", url: "https://example.invalid/revised" }], comments: "Revised delivery.",
  };
  const resubmissions = await Promise.all([1, 2].map(() =>
    call(`/freelancer/submissions/${delivery.submission.id}`, "freelancer", revisedContent, "PUT")));
  assert.equal(resubmissions.filter((response) => response.status === 200).length, 1);
  const versions = await models.Submission.find({ task_id: task.id }).sort("version").lean();
  assert.equal(versions.length, 2, "resubmission must consume a revision and keep the first delivery");
  assert.equal(versions[0].is_active, false);
  assert.equal(versions[0].content.notes, "First delivery.");
  assert.equal(versions[1].submission_type, "revision");
  assert.equal(versions[1].client_review.status, "pending");
  await expectReply(`/client/submissions/${versions[1]._id}/review`, "client", { action: "request_revision", feedback: "One more." }, 400);
  await expectReply(`/client/submissions/${versions[1]._id}/review`, "client", { action: "approve" });
  assert.equal((await models.Task.findById(task.id).lean()).status, "completed");
  assert.equal(await models.Payment.countDocuments({ task_id: task.id, status: "escrowed" }), 1);
  await expectReply("/admin/tasks", "admin");
  await expectReply("/admin/users", "admin");
  await expectReply("/admin/audit-logs", "admin");
  await expectReply("/admin/audit-logs", "client", undefined, 403);
};

const run = async () => {
  await connectDatabase();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const call = (path, role, body, method) => {
    const key = role === "freelancer" ? "worker" : role;
    return fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method: method || (body ? "POST" : "GET"),
      headers: { ...(role ? { Authorization: `Bearer ${generateAccessToken(ids[key], role)}` } : {}), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  };
  const mode = process.argv.find((value) => value.startsWith("--case="))?.slice(7);
  try {
    await seed();
    if (!mode || mode === "review") await verifyReview(call);
    if (!mode || mode === "roster") await verifyRoster(call);
    if (!mode || mode === "dispute") {
      await models.Payment.deleteMany({ task_id: ids.task });
      await verifyDispute(call);
    }
    if (!mode || mode === "marketplace") await verifyMarketplace(call);
    process.stdout.write(`Phase F2 integration passed (${mode || "review, roster, dispute, marketplace"}).\n`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try { await clean(); } finally { await disconnectDatabase(); }
  }
};

run().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
