require("../src/config/loadEnv");
const assert = require("assert/strict");
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");
const taskData = require("../src/data/taskData");
const submissionData = require("../src/data/submissionData");
const profileData = require("../src/data/profileData");

const runId = randomUUID();
const marker = `mongo-qa-${runId}`;
const ids = {
  client: randomUUID(), freelancerA: randomUUID(), freelancerB: randomUUID(), skill: randomUUID(),
  raceTask: randomUUID(), successTask: randomUUID(), rollbackTask: randomUUID(), audit: randomUUID(),
};

const expectDuplicate = async (operation) => {
  try { await operation(); } catch (error) { assert.equal(error.code, 11000); return; }
  assert.fail("Expected a database duplicate-key error");
};

const cleanup = async () => {
  const users = () => mongoose.trusted({ $in: [ids.client, ids.freelancerA, ids.freelancerB] });
  const tasks = () => mongoose.trusted({ $in: [ids.raceTask, ids.successTask, ids.rollbackTask] });
  await Promise.all([
    models.Submission.deleteMany({ freelancer_id: users() }),
    models.UserSkill.deleteMany({ user_id: users() }),
    models.UserProfile.deleteMany({ _id: users() }),
    models.Task.deleteMany({ _id: tasks() }),
    models.AuditLog.deleteMany({ $or: mongoose.trusted([{ _id: ids.audit }, { resource_id: runId }]) }),
    models.Notification.deleteMany({ entity_id: runId }),
    models.Skill.deleteMany({ _id: ids.skill }),
    models.User.deleteMany({ _id: users() }),
  ]);
};

const run = async () => {
  await connectDatabase();
  for (const Model of Object.values(models)) await Model.createIndexes();
  try {
    await models.User.insertMany([
      { _id: ids.client, email: `${marker}-client@example.invalid`, password: "hash", role: "client", profile: { firstName: "QA", lastName: "Client" } },
      { _id: ids.freelancerA, email: `${marker}-a@example.invalid`, password: "hash", role: "freelancer", profile: { firstName: "QA", lastName: "A" } },
      { _id: ids.freelancerB, email: `${marker}-b@example.invalid`, password: "hash", role: "freelancer", profile: { firstName: "QA", lastName: "B" } },
    ]);
    await models.UserProfile.insertMany([
      { _id: ids.client, username: `${marker}-client`.slice(0, 30) },
      { _id: ids.freelancerA, username: `${marker}-a`.slice(0, 30) },
      { _id: ids.freelancerB, username: `${marker}-b`.slice(0, 30) },
    ]);
    await models.Skill.create({ _id: ids.skill, slug: marker, name: marker, normalized_name: marker, category: "other" });

    await expectDuplicate(() => models.User.create({
      email: `${marker}-client@example.invalid`, password: "hash", role: "client", profile: {},
    }));
    await expectDuplicate(() => models.UserProfile.create({ _id: randomUUID(), username: `${marker}-client`.slice(0, 30) }));
    await models.UserSkill.create({ _id: `${ids.freelancerA}:${ids.skill}`, user_id: ids.freelancerA, skill_id: ids.skill });
    await expectDuplicate(() => models.UserSkill.create({ _id: randomUUID(), user_id: ids.freelancerA, skill_id: ids.skill }));

    await models.Task.create({
      _id: ids.raceTask, task_id: `TSK-${runId}-RACE`, client_id: ids.client,
      task_details: { title: "Race verification" }, status: "under_review",
    });
    const race = await Promise.all([
      taskData.acceptTaskAtomically(ids.raceTask, ids.freelancerA),
      taskData.acceptTaskAtomically(ids.raceTask, ids.freelancerB),
    ]);
    assert.equal(race.filter(Boolean).length, 1);

    await models.Task.create({
      _id: ids.successTask, task_id: `TSK-${runId}-SUCCESS`, client_id: ids.client,
      freelancer_id: ids.freelancerA, task_details: { title: "Submission verification" }, status: "in_progress",
    });
    const submitted = await submissionData.submitWorkAtomically({
      taskId: ids.successTask, freelancerId: ids.freelancerA, content: { text: "verified" },
      submissionType: "initial", idempotencyKey: `${runId}-success`,
    });
    assert.equal(submitted.task.status, "delivered");
    const repeated = await submissionData.submitWorkAtomically({
      taskId: ids.successTask, freelancerId: ids.freelancerA, content: { text: "ignored" },
      submissionType: "initial", idempotencyKey: `${runId}-success`,
    });
    assert.equal(repeated.submission.id, submitted.submission.id);

    await models.Task.create({
      _id: ids.rollbackTask, task_id: `TSK-${runId}-ROLLBACK`, client_id: ids.client,
      freelancer_id: ids.freelancerA, task_details: { title: "Rollback verification" }, status: "in_progress",
    });
    await assert.rejects(submissionData.submitWorkAtomically({
      taskId: ids.rollbackTask, freelancerId: ids.freelancerA, content: undefined,
      submissionType: "initial", idempotencyKey: `${runId}-rollback`,
    }));
    assert.equal((await models.Task.findById(ids.rollbackTask).lean()).status, "in_progress");
    assert.equal(await models.Submission.countDocuments({ task_id: ids.rollbackTask }), 0);

    await assert.rejects(profileData.replaceUserSkills(ids.freelancerA, [
      { skillId: ids.skill, proficiency: "advanced", isPrimary: true },
      { skillId: randomUUID(), proficiency: "intermediate", isPrimary: false },
    ]));
    assert.equal(await models.UserSkill.countDocuments({ user_id: ids.freelancerA }), 1);

    const session = await mongoose.startSession();
    try {
      await assert.rejects(session.withTransaction(async () => {
        await models.AuditLog.create([{ _id: ids.audit, action: "qa", resource: "settings", resource_id: runId }], { session });
        throw new Error("forced rollback");
      }));
    } finally { await session.endSession(); }
    assert.equal(await models.AuditLog.countDocuments({ _id: ids.audit }), 0);

    const page = await taskData.listTasks({ filters: { client_id: ids.client }, page: 1, limit: 2, sortBy: "created_at", sortOrder: "desc" });
    assert.equal(page.items.length, 2);
    assert.equal(page.total, 3);

    await models.Notification.create({
      recipient_id: ids.freelancerA, type: "task_assigned", content: { message: "qa" }, entity_id: runId,
    });
    const explain = await models.Notification.find({ recipient_id: ids.freelancerA, status: "unread" })
      .sort({ created_at: -1 }).explain("queryPlanner");
    assert.match(JSON.stringify(explain.queryPlanner?.winningPlan), /IXSCAN/);

    process.stdout.write("MongoDB integration verification passed: indexes, uniqueness, race, transactions, rollback, idempotency, pagination, and query plan.\n");
  } finally { await cleanup(); }
};

run().catch((error) => {
  process.stderr.write(`MongoDB integration verification failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
