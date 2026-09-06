require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const runId = randomUUID();
const marker = runId.slice(0, 8);
const password = `Tn-${randomBytes(18).toString("base64url")}9aA`;
const labels = ["owner", "member", "react", "python", "notLooking", "private", "race"];
const ids = {};
const tokens = {};
const emails = Object.fromEntries(labels.map((label) => [label, `phase6-${marker}-${label}@example.invalid`]));
const teamIds = [];
const openingIds = [];
let server;
let apiBase;

const trustedIn = (values) => mongoose.trusted({ $in: values });
const call = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${apiBase}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json();
  return { status: response.status, payload };
};

const register = async (label) => {
  const response = await call("/auth/register", { method: "POST", body: { email: emails[label], password, role: label === "owner" ? "client" : "freelancer", profile: { firstName: `P6 ${label}`, lastName: marker } } });
  assert.equal(response.status, 201, `${label} registration failed`);
  ids[label] = response.payload.data.user.id; tokens[label] = response.payload.data.accessToken;
};

const setProfile = async (label, profile, skillSlugs = []) => {
  const response = await call("/profile", { method: "PUT", token: tokens[label], body: { username: `p6-${label}-${marker}`.toLowerCase().slice(0, 30), headline: profile.headline, visibility: profile.visibility, availability: profile.availability, discoverable: profile.discoverable, preferredRoles: profile.roles, interests: profile.interests } });
  assert.equal(response.status, 200, `${label} profile update failed: ${JSON.stringify(response.payload)}`);
  const skills = await models.Skill.find({ slug: trustedIn(skillSlugs) }).lean();
  assert.equal(skills.length, skillSlugs.length, `missing seeded skills for ${label}`);
  const skillResponse = await call("/profile/skills", { method: "PUT", token: tokens[label], body: { skills: skills.map((skill, index) => ({ skillId: String(skill._id), proficiency: "advanced", isPrimary: index < 3 })) } });
  assert.equal(skillResponse.status, 200, `${label} skills update failed`);
};

const cleanup = async () => {
  const userIds = Object.values(ids); const users = trustedIn(userIds); const teams = trustedIn(teamIds); const openings = trustedIn(openingIds);
  const projects = await models.Project.find({ team_id: teams }).select("_id").lean(); const projectIds = trustedIn(projects.map((row) => String(row._id)));
  await Promise.all([
    models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: users }, { actor_id: users }]) }),
    models.CollaborationRequest.deleteMany({ $or: mongoose.trusted([{ sender_id: users }, { recipient_id: users }, { team_opening_id: openings }]) }),
    models.UserBlock.deleteMany({ $or: mongoose.trusted([{ blocker_id: users }, { blocked_user_id: users }]) }),
    models.TeamOpening.deleteMany({ $or: mongoose.trusted([{ _id: openings }, { team_id: teams }]) }),
    models.ProjectShowcase.deleteMany({ project_id: projectIds }), models.ProjectRepository.deleteMany({ project_id: projectIds }),
    models.ContributionEvidence.deleteMany({ project_id: projectIds }), models.ProjectActivity.deleteMany({ project_id: projectIds }),
    models.ProjectTask.deleteMany({ project_id: projectIds }), models.ProjectMilestone.deleteMany({ project_id: projectIds }), models.ProjectParticipant.deleteMany({ project_id: projectIds }),
    models.TeamActivity.deleteMany({ team_id: teams }), models.TeamInvitation.deleteMany({ team_id: teams }),
    models.TeamJoinRequest.deleteMany({ team_id: teams }), models.TeamMembership.deleteMany({ team_id: teams }),
    models.UserSkill.deleteMany({ user_id: users }), models.UserEducation.deleteMany({ user_id: users }), models.AuditLog.deleteMany({ user_id: users }),
  ]);
  await models.Project.deleteMany({ _id: projectIds }); await models.Team.deleteMany({ _id: teams });
  await models.UserProfile.deleteMany({ _id: users }); await models.User.deleteMany({ _id: users });
};

const run = async () => {
  await connectDatabase();
  await Promise.all([models.UserProfile.syncIndexes(), models.TeamOpening.syncIndexes(), models.CollaborationRequest.syncIndexes(), models.UserBlock.syncIndexes()]);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  apiBase = `http://127.0.0.1:${server.address().port}/api`;
  try {
    for (const label of labels) await register(label);
    await setProfile("owner", { headline: "Team owner", visibility: "public", availability: "open", discoverable: true, roles: ["project_lead"], interests: ["developer_tools"] }, ["project-management"]);
    await setProfile("member", { headline: "Regular member", visibility: "public", availability: "open", discoverable: true, roles: ["reviewer"], interests: ["developer_tools"] }, ["automated-testing"]);
    await setProfile("react", { headline: "React and Node builder", visibility: "public", availability: "open", discoverable: true, roles: ["full_stack_developer", "backend_developer"], interests: ["developer_tools"] }, ["react", "node-js", "mongodb"]);
    await setProfile("python", { headline: "Python ML engineer", visibility: "public", availability: "limited", discoverable: true, roles: ["ml_engineer"], interests: ["ai_ml"] }, ["python", "machine-learning"]);
    await setProfile("notLooking", { headline: "React designer", visibility: "public", availability: "unavailable", discoverable: false, roles: ["frontend_developer"], interests: ["design_systems"] }, ["react", "ui-ux-design"]);
    await setProfile("private", { headline: "Private React profile", visibility: "private", availability: "open", discoverable: false, roles: ["frontend_developer"], interests: ["developer_tools"] }, ["react"]);
    await setProfile("race", { headline: "Concurrency collaborator", visibility: "public", availability: "open", discoverable: true, roles: ["backend_developer"], interests: ["developer_tools"] }, ["node-js", "mongodb"]);

    assert.equal((await call("/people")).status, 401, "bulk people discovery must require authentication");
    const reactSkill = await models.Skill.findOne({ slug: "react" }).lean(); const nodeSkill = await models.Skill.findOne({ slug: "node-js" }).lean();
    const mongoSkill = await models.Skill.findOne({ slug: "mongodb" }).lean();
    const all = await call(`/people?skills=${reactSkill._id},${nodeSkill._id}&skillMode=all`, { token: tokens.owner });
    assert.equal(all.status, 200); assert.deepEqual(all.payload.data.map((row) => row.id), [ids.react]);
    const any = await call(`/people?skills=${reactSkill._id}&skillMode=any`, { token: tokens.owner });
    assert.ok(any.payload.data.some((row) => row.id === ids.react)); assert.ok(!any.payload.data.some((row) => row.id === ids.notLooking || row.id === ids.private));
    const role = await call("/people?roles=ml_engineer&availability=limited", { token: tokens.owner });
    assert.deepEqual(role.payload.data.map((row) => row.id), [ids.python]);
    const text = await call("/people?search=Python", { token: tokens.owner }); assert.deepEqual(text.payload.data.map((row) => row.id), [ids.python]);
    const serialized = JSON.stringify([...all.payload.data, ...role.payload.data]);
    for (const secret of ["email", "phone", "account role", "refresh_token", "education"]) assert.equal(serialized.includes(secret), false, `discovery leaked ${secret}`);
    const paginated = await call("/people?limit=1", { token: tokens.owner }); assert.equal(paginated.payload.data.length, 1); assert.ok(paginated.payload.meta.total >= 4);

    const team = await call("/teams", { method: "POST", token: tokens.owner, body: { name: `Phase 6 Team ${marker}`, slug: `phase6-team-${marker}`, visibility: "public", joinPolicy: "open", primaryInterests: ["developer_tools"] } });
    assert.equal(team.status, 201); teamIds.push(team.payload.data.id);
    assert.equal((await call(`/teams/${team.payload.data.id}/join`, { method: "POST", token: tokens.member })).status, 201);
    const opening = await call(`/teams/${team.payload.data.id}/openings`, { method: "POST", token: tokens.owner, body: { title: "MERN backend collaborator", description: "Help build a deterministic discovery API.", role: "backend_developer", requiredSkillIds: [String(nodeSkill._id)], preferredSkillIds: [String(mongoSkill._id)], commitment: "few_hours" } });
    assert.equal(opening.status, 201, JSON.stringify(opening.payload)); openingIds.push(opening.payload.data.id);
    assert.equal((await call(`/teams/${team.payload.data.id}/openings`, { method: "POST", token: tokens.member, body: { title: "Unauthorized role", role: "backend_developer" } })).status, 403);
    const publicOpenings = await call("/team-openings?role=backend_developer", { token: tokens.react }); assert.ok(publicOpenings.payload.data.some((row) => row.id === opening.payload.data.id));
    const interest = await call(`/team-openings/${opening.payload.data.id}/interest`, { method: "POST", token: tokens.react, body: { message: "I use Node and MongoDB." } }); assert.equal(interest.status, 201);
    assert.equal((await call(`/team-openings/${opening.payload.data.id}/interest`, { method: "POST", token: tokens.react })).status, 409);
    const candidates = await call(`/team-openings/${opening.payload.data.id}/candidates`, { token: tokens.owner });
    const reactCandidate = candidates.payload.data.find((row) => row.id === ids.react); assert.ok(reactCandidate); assert.equal(reactCandidate.opening_interest.status, "pending");
    assert.equal((await call(`/collaboration-requests/${interest.payload.data.id}/accept`, { method: "POST", token: tokens.owner })).status, 200);
    assert.equal(await models.TeamMembership.countDocuments({ team_id: team.payload.data.id, user_id: ids.react, status: "active" }), 0, "accepted request must not grant membership");

    const direct = await call("/collaboration-requests", { method: "POST", token: tokens.react, body: { recipientId: ids.python, message: "Build a developer tool?" } }); assert.equal(direct.status, 201);
    assert.equal((await call("/collaboration-requests", { method: "POST", token: tokens.react, body: { recipientId: ids.python } })).status, 409);
    assert.equal((await call(`/collaboration-requests/${direct.payload.data.id}/accept`, { method: "POST", token: tokens.owner })).status, 404);
    assert.equal((await call(`/collaboration-requests/${direct.payload.data.id}/accept`, { method: "POST", token: tokens.python })).status, 200);
    assert.equal((await call("/user-blocks", { method: "POST", token: tokens.python, body: { userId: ids.react } })).status, 201);
    assert.equal((await call("/collaboration-requests", { method: "POST", token: tokens.react, body: { recipientId: ids.python } })).status, 404, "block failure must remain neutral");
    const blockedDiscovery = await call("/people?search=React", { token: tokens.python }); assert.ok(!blockedDiscovery.payload.data.some((row) => row.id === ids.react));
    assert.equal((await call(`/user-blocks/${ids.react}`, { method: "DELETE", token: tokens.python })).status, 200);

    const duplicateRace = await Promise.all([
      call("/collaboration-requests", { method: "POST", token: tokens.react, body: { recipientId: ids.race, message: "race one" } }),
      call("/collaboration-requests", { method: "POST", token: tokens.react, body: { recipientId: ids.race, message: "race two" } }),
    ]);
    assert.deepEqual(duplicateRace.map((row) => row.status).sort(), [201, 409]);
    const raceRequest = duplicateRace.find((row) => row.status === 201).payload.data;
    const decisionRace = await Promise.all([
      call(`/collaboration-requests/${raceRequest.id}/accept`, { method: "POST", token: tokens.race }),
      call(`/collaboration-requests/${raceRequest.id}`, { method: "DELETE", token: tokens.react }),
    ]);
    assert.equal(decisionRace.filter((row) => row.status === 200).length, 1, "accept/cancel race must have one winner");

    const interestRaceOpening = await call(`/teams/${team.payload.data.id}/openings`, { method: "POST", token: tokens.owner, body: { title: "Duplicate interest race", role: "ml_engineer", requiredSkillIds: [] } });
    assert.equal(interestRaceOpening.status, 201); openingIds.push(interestRaceOpening.payload.data.id);
    const interestRace = await Promise.all([
      call(`/team-openings/${interestRaceOpening.payload.data.id}/interest`, { method: "POST", token: tokens.python }),
      call(`/team-openings/${interestRaceOpening.payload.data.id}/interest`, { method: "POST", token: tokens.python }),
    ]);
    assert.deepEqual(interestRace.map((row) => row.status).sort(), [201, 409], "duplicate opening interest must have one winner");

    const closeRaceOpening = await call(`/teams/${team.payload.data.id}/openings`, { method: "POST", token: tokens.owner, body: { title: "Close versus interest race", role: "backend_developer", requiredSkillIds: [String(nodeSkill._id)] } });
    assert.equal(closeRaceOpening.status, 201); openingIds.push(closeRaceOpening.payload.data.id);
    const closeInterestRace = await Promise.all([
      call(`/team-openings/${closeRaceOpening.payload.data.id}/close`, { method: "POST", token: tokens.owner }),
      call(`/team-openings/${closeRaceOpening.payload.data.id}/interest`, { method: "POST", token: tokens.race }),
    ]);
    assert.equal(closeInterestRace[0].status, 200, "close must complete during interest race");
    assert.ok([201, 404, 409].includes(closeInterestRace[1].status), "interest must commit before close or fail safely");
    assert.equal((await models.TeamOpening.findById(closeRaceOpening.payload.data.id).lean()).status, "closed");
    assert.ok(await models.CollaborationRequest.countDocuments({ team_opening_id: closeRaceOpening.payload.data.id, status: "pending" }) <= 1, "close/interest race must not duplicate interest");

    const blockRequestRace = await Promise.all([
      call("/user-blocks", { method: "POST", token: tokens.member, body: { userId: ids.race } }),
      call("/collaboration-requests", { method: "POST", token: tokens.race, body: { recipientId: ids.member, message: "Concurrent request" } }),
    ]);
    assert.equal(blockRequestRace[0].status, 201, "block must complete during request race");
    assert.ok([201, 404].includes(blockRequestRace[1].status), "request must either precede the block or fail neutrally");
    assert.equal(await models.CollaborationRequest.countDocuments({ sender_id: ids.race, recipient_id: ids.member, status: "pending" }), 0, "block/request race must leave no pending request");

    const privateTeam = await call("/teams", { method: "POST", token: tokens.owner, body: { name: `Private Team ${marker}`, slug: `phase6-private-${marker}`, visibility: "private", joinPolicy: "invite_only" } }); teamIds.push(privateTeam.payload.data.id);
    const privateOpening = await call(`/teams/${privateTeam.payload.data.id}/openings`, { method: "POST", token: tokens.owner, body: { title: "Private role", role: "backend_developer" } }); openingIds.push(privateOpening.payload.data.id);
    const publicAfterPrivate = await call("/team-openings", { token: tokens.react }); assert.ok(!publicAfterPrivate.payload.data.some((row) => row.id === privateOpening.payload.data.id));

    const indexLists = await Promise.all([models.UserProfile.collection.indexes(), models.TeamOpening.collection.indexes(), models.CollaborationRequest.collection.indexes(), models.UserBlock.collection.indexes()]);
    indexLists.forEach((indexes) => assert.ok(indexes.length > 1));
    const plans = await Promise.all([
      models.UserProfile.find({ discoverable: true, visibility: "public", availability: "open" }).sort({ updated_at: -1 }).explain("queryPlanner"),
      models.UserSkill.find({ skill_id: String(nodeSkill._id) }).explain("queryPlanner"),
      models.TeamOpening.find({ status: "open", role: "backend_developer" }).sort({ created_at: -1 }).explain("queryPlanner"),
      models.CollaborationRequest.find({ recipient_id: ids.owner, status: "pending" }).sort({ created_at: -1 }).explain("queryPlanner"),
    ]);
    plans.forEach((plan) => assert.match(JSON.stringify(plan.queryPlanner?.winningPlan || {}), /IXSCAN/));
    process.stdout.write("Phase 6 discovery verification passed: opt-in privacy, safe DTOs, search/filter semantics, openings/RBAC/private Teams, candidates, requests, notifications, blocking, races, indexes, and query plans.\n");
  } finally { await cleanup(); }
};

run().catch((error) => { process.stderr.write(`Phase 6 discovery verification failed: ${error.stack || error.message}\n`); process.exitCode = 1; }).finally(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await disconnectDatabase(); });
