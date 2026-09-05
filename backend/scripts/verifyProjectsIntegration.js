require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");
const projectService = require("../src/services/projectService");
const participantService = require("../src/services/projectParticipantService");
const taskService = require("../src/services/projectTaskService");
const milestoneService = require("../src/services/projectMilestoneService");
const membershipService = require("../src/services/membershipService");
const { withTransaction } = require("../src/utils/transactions");

const runId = randomUUID();
const ids = Object.fromEntries([
  "owner", "admin", "lead", "contributor", "teamOnly", "outsider", "marketplaceAdmin",
].map((name) => [name, randomUUID()]));
const teamId = randomUUID();
const createdProjectIds = [];

const createUsers = async () => {
  for (const [name, id] of Object.entries(ids)) {
    await models.User.create({
      _id: id, email: `phase4-${runId}-${name}@example.invalid`, password: "integration-only",
      role: name === "marketplaceAdmin" ? "admin" : name === "contributor" ? "freelancer" : "client",
      profile: { firstName: name, lastName: "Verifier" }, status: "active",
    });
    await models.UserProfile.create({
      _id: id, username: `p4-${runId.slice(0, 8)}-${name.toLowerCase().replace(/[^a-z]/g, "")}`.slice(0, 30),
      headline: `${name} project verifier`, visibility: "public", onboarding_completed: true,
    });
  }
};

const createTeamFixture = async () => {
  await models.Team.create({
    _id: teamId, name: "Phase Four Verification", slug: `phase-four-${runId.slice(0, 8)}`,
    created_by: ids.owner, owner_id: ids.owner, visibility: "public", join_policy: "invite_only", status: "active",
  });
  await models.TeamMembership.insertMany([
    { _id: randomUUID(), team_id: teamId, user_id: ids.owner, role: "owner", status: "active" },
    { _id: randomUUID(), team_id: teamId, user_id: ids.admin, role: "admin", status: "active" },
    { _id: randomUUID(), team_id: teamId, user_id: ids.lead, role: "member", status: "active" },
    { _id: randomUUID(), team_id: teamId, user_id: ids.contributor, role: "member", status: "active" },
    { _id: randomUUID(), team_id: teamId, user_id: ids.teamOnly, role: "member", status: "active" },
  ]);
};

const expectRejectedCode = async (promise, code) => {
  const result = await Promise.allSettled([promise]);
  assert.equal(result[0].status, "rejected");
  assert.equal(result[0].reason.code, code);
};

const cleanup = async () => {
  const projectFilter = { team_id: teamId };
  await Promise.all([
    models.Notification.deleteMany({ $or: mongoose.trusted([
      { recipient_id: mongoose.trusted({ $in: Object.values(ids) }) },
      { entity_id: mongoose.trusted({ $in: createdProjectIds }) },
    ]) }),
    models.ProjectActivity.deleteMany(projectFilter),
    models.ProjectTask.deleteMany(projectFilter),
    models.ProjectMilestone.deleteMany(projectFilter),
    models.ProjectParticipant.deleteMany(projectFilter),
  ]);
  await models.Project.deleteMany(projectFilter);
  await models.TeamActivity.deleteMany({ team_id: teamId });
  await models.TeamMembership.deleteMany({ team_id: teamId });
  await models.Team.deleteOne({ _id: teamId });
  await models.UserProfile.deleteMany({ _id: mongoose.trusted({ $in: Object.values(ids) }) });
  await models.User.deleteMany({ _id: mongoose.trusted({ $in: Object.values(ids) }) });
};

const run = async () => {
  await connectDatabase();
  try {
    await createUsers();
    await createTeamFixture();

    const rollbackId = randomUUID();
    await assert.rejects(withTransaction(async (session) => {
      await models.Project.create([{
        _id: rollbackId, team_id: teamId, name: "Rollback Project", slug: `rollback-${runId.slice(0, 8)}`,
        created_by: ids.owner,
      }], { session });
      await models.ProjectParticipant.create([{
        _id: randomUUID(), team_id: teamId, project_id: rollbackId, user_id: ids.owner, role: "lead",
      }], { session });
      throw new Error("intentional rollback");
    }), /intentional rollback/);
    assert.equal(await models.Project.exists({ _id: rollbackId }), null);
    assert.equal(await models.ProjectParticipant.exists({ project_id: rollbackId }), null);

    const slug = `atlas-race-${runId.slice(0, 8)}`;
    const projectRace = await Promise.allSettled([
      projectService.createProject(teamId, ids.owner, { name: "Atlas Race A", slug, visibility: "public" }),
      projectService.createProject(teamId, ids.admin, { name: "Atlas Race B", slug, visibility: "public" }),
    ]);
    assert.equal(projectRace.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(projectRace.filter((item) => item.status === "rejected").length, 1);
    const project = projectRace.find((item) => item.status === "fulfilled").value;
    createdProjectIds.push(project.id);
    assert.equal(await models.Project.countDocuments({ team_id: teamId, slug }), 1);
    assert.equal(await models.ProjectParticipant.countDocuments({ project_id: project.id, user_id: project.created_by?.id, role: "lead" }), 1);
    assert.equal(await models.ProjectParticipant.countDocuments({ project_id: project.id, role: "lead", status: "active" }), 1);
    assert.equal(await models.ProjectActivity.countDocuments({ project_id: project.id, type: "project_created" }), 1);

    const participantRace = await Promise.allSettled([
      participantService.addParticipant(project.id, ids.owner, { userId: ids.lead, role: "lead" }),
      participantService.addParticipant(project.id, ids.owner, { userId: ids.lead, role: "lead" }),
    ]);
    assert.equal(participantRace.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(await models.ProjectParticipant.countDocuments({ project_id: project.id, user_id: ids.lead }), 1);
    await participantService.addParticipant(project.id, ids.owner, { userId: ids.contributor, role: "contributor" });

    await expectRejectedCode(
      participantService.addParticipant(project.id, ids.owner, { userId: ids.outsider, role: "contributor" }),
      "VALIDATION_FAILED",
    );
    await expectRejectedCode(projectService.createProject(teamId, ids.teamOnly, { name: "Denied" }), "PROJECT_ACCESS_DENIED");
    await expectRejectedCode(projectService.createProject(teamId, ids.marketplaceAdmin, { name: "Global Admin Denied" }), "PROJECT_ACCESS_DENIED");

    const publicView = await projectService.getProject(project.id, ids.outsider);
    assert.equal(publicView.effective_visibility, "public");
    await models.Team.updateOne({ _id: teamId }, { $set: { visibility: "private" } });
    await expectRejectedCode(projectService.getProject(project.id, ids.outsider), "PROJECT_NOT_FOUND");
    await expectRejectedCode(projectService.getProject(project.id, ids.marketplaceAdmin), "PROJECT_NOT_FOUND");
    await models.Team.updateOne({ _id: teamId }, { $set: { visibility: "public" } });

    let task = await taskService.createTask(project.id, ids.lead, {
      title: "Concurrency task", description: "Exercises assignment and status races", priority: "high",
    });
    const assignmentRace = await Promise.allSettled([
      taskService.setAssignees(task.id, ids.lead, { revision: task.revision, assigneeIds: [ids.contributor] }),
      taskService.setAssignees(task.id, ids.owner, { revision: task.revision, assigneeIds: [ids.lead] }),
    ]);
    assert.equal(assignmentRace.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(assignmentRace.filter((item) => item.status === "rejected" && item.reason.code === "PROJECT_STALE_WRITE").length, 1);
    task = await taskService.getTask(task.id, ids.owner);
    assert.equal(task.revision, 1);

    task = await taskService.setAssignees(task.id, ids.owner, { revision: task.revision, assigneeIds: [ids.contributor] });
    const statusRace = await Promise.allSettled([
      taskService.changeStatus(task.id, ids.contributor, { revision: task.revision, status: "in_progress" }),
      taskService.changeStatus(task.id, ids.owner, { revision: task.revision, status: "blocked" }),
    ]);
    assert.equal(statusRace.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(statusRace.filter((item) => item.status === "rejected" && item.reason.code === "PROJECT_STALE_WRITE").length, 1);

    let removalTask = await taskService.createTask(project.id, ids.lead, { title: "Removal race" });
    const removalRace = await Promise.allSettled([
      taskService.setAssignees(removalTask.id, ids.lead, { revision: removalTask.revision, assigneeIds: [ids.contributor] }),
      participantService.removeParticipant(project.id, ids.contributor, ids.owner),
    ]);
    assert.equal(removalRace.some((item) => item.status === "fulfilled"), true);
    removalTask = await taskService.getTask(removalTask.id, ids.owner);
    assert.equal(removalTask.assignee_ids.includes(ids.contributor), false);
    assert.equal(await models.ProjectParticipant.countDocuments({ project_id: project.id, user_id: ids.contributor, status: "active" }), 0);

    await participantService.addParticipant(project.id, ids.owner, { userId: ids.contributor, role: "contributor" });
    let completedTask = await taskService.createTask(project.id, ids.lead, { title: "Preserved contribution" });
    completedTask = await taskService.setAssignees(completedTask.id, ids.lead, { revision: completedTask.revision, assigneeIds: [ids.contributor] });
    completedTask = await taskService.changeStatus(completedTask.id, ids.contributor, { revision: completedTask.revision, status: "in_progress" });
    completedTask = await taskService.changeStatus(completedTask.id, ids.contributor, { revision: completedTask.revision, status: "done" });
    assert.ok(completedTask.completed_at);

    let milestone = await milestoneService.createMilestone(project.id, ids.lead, { name: "Foundation", targetDate: new Date(Date.now() + 86400000).toISOString() });
    milestone = await milestoneService.updateMilestone(milestone.id, ids.lead, { status: "completed" });
    assert.ok(milestone.completed_at);

    const openForRevocation = await taskService.createTask(project.id, ids.lead, { title: "Revocation task" });
    await taskService.setAssignees(openForRevocation.id, ids.lead, { revision: openForRevocation.revision, assigneeIds: [ids.contributor] });
    await membershipService.removeMember(teamId, ids.contributor, ids.owner);
    assert.equal(await models.ProjectParticipant.countDocuments({ team_id: teamId, user_id: ids.contributor, status: "active" }), 0);
    const revokedTask = toPlain(await models.ProjectTask.findById(openForRevocation.id).lean());
    assert.equal(revokedTask.assignee_ids.includes(ids.contributor), false);
    const preserved = toPlain(await models.ProjectTask.findById(completedTask.id).lean());
    assert.equal(preserved.assignee_ids.includes(ids.contributor), true);
    await expectRejectedCode(taskService.createTask(project.id, ids.contributor, { title: "Denied after removal" }), "PROJECT_PARTICIPANT_REQUIRED");

    const currentProject = await models.Project.findById(project.id).lean();
    if (currentProject.status === "planning") await projectService.transitionProject(project.id, ids.lead, "active");
    await projectService.transitionProject(project.id, ids.lead, "completed");
    const completed = await models.Project.findById(project.id).lean();
    assert.equal(completed.status, "completed");
    assert.ok(completed.completed_at);
    assert.ok(await models.ProjectParticipant.exists({ project_id: project.id }));
    assert.ok(await models.ProjectActivity.exists({ project_id: project.id, type: "task_completed" }));

    const notificationCount = await models.Notification.countDocuments({
      recipient_id: ids.contributor, type: "project_task_assigned", entity_id: project.id,
    });
    assert.ok(notificationCount >= 1);

    const plans = await Promise.all([
      models.Project.find({ team_id: teamId, status: "completed" }).sort({ updated_at: -1 }).explain("queryPlanner"),
      models.ProjectTask.find({ project_id: project.id, status: "done" }).sort({ updated_at: -1 }).explain("queryPlanner"),
      models.ProjectTask.find({ assignee_ids: ids.contributor, status: "done" }).explain("queryPlanner"),
      models.ProjectActivity.find({ project_id: project.id }).sort({ created_at: -1 }).explain("queryPlanner"),
    ]);
    plans.forEach((plan) => assert.match(JSON.stringify(plan.queryPlanner?.winningPlan || {}), /IXSCAN/));

    process.stdout.write("Project integration verification passed: rollback, slug/participant races, contextual RBAC, privacy, assignment/status CAS, removal race, Team revocation, milestones, completion evidence, notifications, and query plans.\n");
  } finally {
    await cleanup();
  }
};

const toPlain = (value) => value || {};

run().catch((error) => {
  process.stderr.write(`Project integration verification failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
