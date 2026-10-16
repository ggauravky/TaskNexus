require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();
const assert = require("assert/strict");
const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");
const taskData = require("../src/data/taskData");
const submissionData = require("../src/data/submissionData");
const profileData = require("../src/data/profileData");
const teamService = require("../src/services/teamService");
const projectService = require("../src/services/projectService");
const discoveryService = require("../src/services/discoveryService");
const hackathonService = require("../src/services/hackathonService");
const opportunityService = require("../src/services/opportunityService");
const taskService = require("../src/services/taskService");
const { escapeRegex } = require("../src/data/mongoDataUtils");

const runId = randomUUID();
const marker = `mongo-qa-${runId}`;
const usernameMarker = `mongo-qa-${runId.slice(0, 8)}`;
const searchTerm = `phasec${runId.slice(0, 8)}`;
const ids = {
  client: randomUUID(), freelancerA: randomUUID(), freelancerB: randomUUID(), skill: randomUUID(),
  raceTask: randomUUID(), successTask: randomUUID(), rollbackTask: randomUUID(), audit: randomUUID(),
  publicTeam: randomUUID(), privateTeam: randomUUID(), publicProject: randomUUID(), privateProject: randomUUID(),
  publicHackathon: randomUUID(), privateHackathon: randomUUID(), activeOrganization: randomUUID(), inactiveOrganization: randomUUID(),
  openOpportunity: randomUUID(), closedOpportunity: randomUUID(), projectTask: randomUUID(), block: randomUUID(),
};
const searchTaskIds = Array.from({ length: 8 }, () => randomUUID());

const expectDuplicate = async (operation) => {
  try { await operation(); } catch (error) { assert.equal(error.code, 11000); return; }
  assert.fail("Expected a database duplicate-key error");
};

const cleanup = async () => {
  const users = () => mongoose.trusted({ $in: [ids.client, ids.freelancerA, ids.freelancerB] });
  const tasks = () => mongoose.trusted({ $in: [ids.raceTask, ids.successTask, ids.rollbackTask, ...searchTaskIds] });
  await Promise.all([
    models.Submission.deleteMany({ freelancer_id: users() }),
    models.UserSkill.deleteMany({ user_id: users() }),
    models.UserProfile.deleteMany({ _id: users() }),
    models.Task.deleteMany({ _id: tasks() }),
    models.UserBlock.deleteMany({ _id: ids.block }),
    models.ProjectTask.deleteMany({ _id: ids.projectTask }),
    models.Project.deleteMany({ _id: mongoose.trusted({ $in: [ids.publicProject, ids.privateProject] }) }),
    models.Team.deleteMany({ _id: mongoose.trusted({ $in: [ids.publicTeam, ids.privateTeam] }) }),
    models.Hackathon.deleteMany({ _id: mongoose.trusted({ $in: [ids.publicHackathon, ids.privateHackathon] }) }),
    models.Opportunity.deleteMany({ _id: mongoose.trusted({ $in: [ids.openOpportunity, ids.closedOpportunity] }) }),
    models.Organization.deleteMany({ _id: mongoose.trusted({ $in: [ids.activeOrganization, ids.inactiveOrganization] }) }),
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
      { _id: ids.client, username: `${usernameMarker}-client`, visibility: "public", discoverable: true, headline: searchTerm },
      { _id: ids.freelancerA, username: `${usernameMarker}-a`, visibility: "public", discoverable: true, headline: searchTerm },
      { _id: ids.freelancerB, username: `${usernameMarker}-b`, visibility: "public", discoverable: true, headline: searchTerm },
    ]);
    await models.Skill.create({ _id: ids.skill, slug: marker, name: marker, normalized_name: marker, category: "other" });

    await expectDuplicate(() => models.User.create({
      email: `${marker}-client@example.invalid`, password: "hash", role: "client", profile: {},
    }));
    await expectDuplicate(() => models.UserProfile.create({ _id: randomUUID(), username: `${usernameMarker}-client` }));
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

    const now = Date.now();
    await models.Team.insertMany([
      { _id: ids.publicTeam, name: `${searchTerm} public`, slug: `${searchTerm}-public`, created_by: ids.client, owner_id: ids.client, visibility: "public", status: "active" },
      { _id: ids.privateTeam, name: `${searchTerm} private`, slug: `${searchTerm}-private`, created_by: ids.client, owner_id: ids.client, visibility: "private", status: "active" },
    ]);
    await models.Project.insertMany([
      { _id: ids.publicProject, team_id: ids.publicTeam, name: `${searchTerm} public`, slug: `${searchTerm}-public`, created_by: ids.client, visibility: "public", status: "active" },
      { _id: ids.privateProject, team_id: ids.privateTeam, name: `${searchTerm} private`, slug: `${searchTerm}-private`, created_by: ids.client, visibility: "public", status: "active" },
    ]);
    await models.ProjectTask.create({ _id: ids.projectTask, team_id: ids.publicTeam, project_id: ids.publicProject, title: `${searchTerm} project task`, status: "todo", priority: "medium", created_by: ids.client });
    await models.UserBlock.create({ _id: ids.block, blocker_id: ids.freelancerA, blocked_user_id: ids.freelancerB });
    await models.Hackathon.insertMany([
      { _id: ids.publicHackathon, name: `${searchTerm} public`, slug: `${searchTerm}-public`, organizer_name: "QA", mode: "online", event_start: new Date(now + 86400000), event_end: new Date(now + 172800000), status: "upcoming", visibility: "public", created_by: ids.client },
      { _id: ids.privateHackathon, name: `${searchTerm} private`, slug: `${searchTerm}-private`, organizer_name: "QA", mode: "online", event_start: new Date(now + 86400000), event_end: new Date(now + 172800000), status: "upcoming", visibility: "private", created_by: ids.client },
    ]);
    await models.Organization.insertMany([
      { _id: ids.activeOrganization, name: `${searchTerm} active`, slug: `${searchTerm}-active`, organization_type: "startup", status: "active", created_by: ids.client },
      { _id: ids.inactiveOrganization, name: `${searchTerm} inactive`, slug: `${searchTerm}-inactive`, organization_type: "startup", status: "archived", created_by: ids.client },
    ]);
    await models.Opportunity.insertMany([
      { _id: ids.openOpportunity, organization_id: ids.activeOrganization, type: "internship", title: `${searchTerm} open`, slug: `${searchTerm}-open`, work_mode: "remote", application_mode: "external", application_url: "https://example.com/open", status: "published", source_type: "official", published_at: new Date(), created_by: ids.client },
      { _id: ids.closedOpportunity, organization_id: ids.activeOrganization, type: "internship", title: `${searchTerm} closed`, slug: `${searchTerm}-closed`, work_mode: "remote", application_mode: "external", application_url: "https://example.com/closed", status: "closed", source_type: "official", published_at: new Date(), created_by: ids.client },
    ]);
    await models.Task.insertMany([
      ...searchTaskIds.slice(0, 6).map((id, index) => ({
        _id: id, task_id: `TSK-${runId}-SEARCH-${index}`, client_id: ids.client,
        freelancer_id: index === 0 ? ids.freelancerA : null,
        task_details: { title: `${searchTerm} task ${index}` }, status: index === 0 ? "in_progress" : "submitted",
      })),
      { _id: searchTaskIds[6], task_id: `TSK-${runId}-UNASSIGNED`, client_id: ids.freelancerB, task_details: { title: `${searchTerm} unassigned` }, status: "submitted" },
      { _id: searchTaskIds[7], task_id: `TSK-${runId}-UNRELATED`, client_id: ids.freelancerB, freelancer_id: ids.freelancerB, task_details: { title: `${searchTerm} unrelated` }, status: "in_progress" },
    ]);

    const viewerClient = { id: ids.client, role: "client" };
    const viewerFreelancer = { id: ids.freelancerA, role: "freelancer" };
    const viewerAdmin = { id: ids.client, role: "admin" };
    const [teams, projects, people, publicHackathons, adminHackathons, opportunities, organizations, clientTasks, freelancerTasks, adminTasks] = await Promise.all([
      teamService.searchTeams(searchTerm, viewerClient),
      projectService.searchProjects(searchTerm, viewerClient),
      discoveryService.searchPeople(searchTerm, viewerFreelancer),
      hackathonService.searchHackathons(searchTerm, viewerClient),
      hackathonService.searchHackathons(searchTerm, viewerAdmin),
      opportunityService.searchOpportunities(searchTerm, viewerClient),
      opportunityService.searchOrganizations(searchTerm, viewerClient),
      taskService.searchMarketplaceTasks(searchTerm, viewerClient),
      taskService.searchMarketplaceTasks(searchTerm, viewerFreelancer),
      taskService.searchMarketplaceTasks(searchTerm, viewerAdmin),
    ]);
    assert.deepEqual(teams.map((row) => row.id), [ids.publicTeam]);
    assert.deepEqual(projects.map((row) => row.id), [ids.publicProject]);
    assert.equal(people.some((row) => row.id === ids.freelancerB), false, "blocked profile leaked into search");
    assert.deepEqual(publicHackathons.map((row) => row.id), [ids.publicHackathon]);
    assert.equal(adminHackathons.some((row) => row.id === ids.privateHackathon), true);
    assert.deepEqual(opportunities.map((row) => row.id), [ids.openOpportunity]);
    assert.deepEqual(organizations.map((row) => row.id), [ids.activeOrganization]);
    assert.equal(clientTasks.length, 5, "client task search was not capped at five");
    assert.deepEqual(freelancerTasks.map((row) => row.id), [searchTaskIds[0]]);
    assert.equal(adminTasks.length, 5, "administrator task search was not capped at five");
    assert.equal(freelancerTasks.some((row) => row.id === searchTaskIds[6]), false, "unassigned task leaked into freelancer search");

    const pattern = new RegExp(escapeRegex(searchTerm), "i");
    const projectPipeline = [
      { $match: { visibility: "public", status: { $ne: "archived" }, $or: [{ name: pattern }, { tagline: pattern }, { slug: pattern }] } },
      { $lookup: { from: "teams", let: { teamId: "$team_id" }, pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$teamId"] }, visibility: "public", status: "active" } }, { $project: { _id: 0, slug: 1 } }], as: "team" } },
      { $unwind: "$team" }, { $sort: { updated_at: -1, _id: 1 } }, { $limit: 5 },
    ];
    const plans = await Promise.all([
      models.Team.find({ visibility: "public", status: "active", $or: mongoose.trusted([{ name: pattern }, { tagline: pattern }, { slug: pattern }]) }).sort({ updated_at: -1, _id: 1 }).limit(5).explain("executionStats"),
      models.Project.aggregate(projectPipeline).explain("executionStats"),
      models.UserProfile.find({ visibility: "public", discoverable: true, _id: mongoose.trusted({ $ne: ids.freelancerA }), $or: mongoose.trusted([{ username: pattern }, { headline: pattern }]) }).sort({ updated_at: -1, _id: 1 }).limit(5).explain("executionStats"),
      models.Opportunity.find({ status: "published", $and: mongoose.trusted([{ $or: [{ application_deadline: null }, { application_deadline: mongoose.trusted({ $gt: new Date() }) }] }, { $or: [{ expires_at: null }, { expires_at: mongoose.trusted({ $gt: new Date() }) }] }, { $or: [{ title: pattern }, { summary: pattern }, { description: pattern }] }]) }).sort({ published_at: -1, _id: 1 }).limit(5).explain("executionStats"),
      models.Task.find({ client_id: ids.client, "task_details.title": mongoose.trusted({ $regex: escapeRegex(searchTerm), $options: "i" }) }).sort({ updated_at: -1, _id: 1 }).limit(5).explain("executionStats"),
    ]);
    for (const plan of plans) {
      const encoded = JSON.stringify(plan);
      assert.match(encoded, /IXSCAN|DISTINCT_SCAN/, "search authorization predicate did not use an index");
      assert.doesNotMatch(encoded, /\"stage\":\"COLLSCAN\"/, "search explain used a collection scan");
      assert.match(encoded, /LIMIT|\"limitAmount\":5|\"limit\":5/, "search explain omitted the database limit");
    }

    process.stdout.write("MongoDB integration verification passed: indexes, uniqueness, race, transactions, rollback, idempotency, pagination, Phase C privacy, five-row bounds, and execution plans.\n");
  } finally { await cleanup(); }
};

run().catch((error) => {
  process.stderr.write(`MongoDB integration verification failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
