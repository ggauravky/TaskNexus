require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const runId = randomUUID(); const marker = runId.slice(0, 8); const password = `Tn-${randomBytes(18).toString("base64url")}9aA`;
const labels = ["owner", "teamAdmin", "member", "teammate", "outsider"];
const ids = {}; const tokens = {}; const emails = Object.fromEntries(labels.map((label) => [label, `phase7-${marker}-${label}@example.invalid`]));
const eventIds = []; const teamIds = []; const projectIds = []; const openingIds = []; let adminId; let server; let apiBase;
const trustedIn = (values) => mongoose.trusted({ $in: values });

const call = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${apiBase}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text(); let payload; try { payload = JSON.parse(text); } catch (_error) { payload = { text }; }
  return { status: response.status, payload };
};

const register = async (label) => {
  const result = await call("/auth/register", { method: "POST", body: { email: emails[label], password, role: label === "owner" ? "client" : "freelancer", profile: { firstName: `P7 ${label}`, lastName: marker } } });
  assert.equal(result.status, 201, `${label} registration failed: ${JSON.stringify(result.payload)}`); ids[label] = result.payload.data.user.id; tokens[label] = result.payload.data.accessToken;
};

const profile = async (label, { discoverable = true, visible = true } = {}) => {
  const response = await call("/profile", { method: "PUT", token: tokens[label], body: { username: `p7-${label.toLowerCase()}-${marker}`.slice(0, 30), headline: `${label} Hackathon builder`, visibility: visible ? "public" : "private", availability: "open", discoverable, preferredRoles: [label === "teammate" ? "ml_engineer" : "backend_developer"], interests: ["hackathons"] } });
  assert.equal(response.status, 200, `${label} profile failed: ${JSON.stringify(response.payload)}`);
};

const createTeam = async (token, suffix, joinPolicy = "open") => {
  const response = await call("/teams", { method: "POST", token, body: { name: `Phase 7 ${suffix} ${marker}`, slug: `phase7-${suffix.toLowerCase()}-${marker}`, visibility: "public", joinPolicy } });
  assert.equal(response.status, 201, `Team creation failed: ${JSON.stringify(response.payload)}`); teamIds.push(response.payload.data.id); return response.payload.data;
};

const createProject = async (token, teamId, suffix) => {
  const response = await call(`/teams/${teamId}/projects`, { method: "POST", token, body: { name: `Planet ${suffix}`, slug: `planet-${suffix.toLowerCase()}-${marker}`, description: "An evidence-backed climate prototype.", visibility: "team", repositoryUrl: "https://github.com/octocat/Hello-World", demoUrl: "https://example.com/demo" } });
  assert.equal(response.status, 201, `Project creation failed: ${JSON.stringify(response.payload)}`); projectIds.push(response.payload.data.id); return response.payload.data;
};

const eventBody = (suffix, overrides = {}) => ({
  name: `Build for Earth ${suffix}`, slug: `build-earth-${suffix.toLowerCase()}-${marker}`, tagline: "Build a credible climate prototype.",
  description: "A participant collaboration event for small, evidence-driven Teams.", organizerName: "TaskNexus Labs", mode: "hybrid", city: "Bengaluru", venue: "Innovation Hall",
  registrationStart: new Date(Date.now() - 86400000).toISOString(), registrationDeadline: new Date(Date.now() + 86400000).toISOString(),
  eventStart: new Date(Date.now() + 2 * 86400000).toISOString(), eventEnd: new Date(Date.now() + 4 * 86400000).toISOString(), submissionDeadline: new Date(Date.now() + 4 * 86400000 - 3600000).toISOString(),
  teamMinSize: 1, teamMaxSize: 5, status: "registration_open", visibility: "public", allowedRoles: ["backend_developer", "ml_engineer"], themes: ["climate", "developer tools"],
  submissionRequirements: [
    { type: "project_title", label: "Project title", required: true }, { type: "project_description", label: "Project description", required: true },
    { type: "repository", label: "Repository", required: true }, { type: "demo", label: "Demo", required: true },
    { type: "team_confirmed", label: "Team confirmed", required: true }, { type: "submission_url", label: "Final submission URL", required: true },
  ], ...overrides,
});

const createEvent = async (suffix, overrides) => {
  const response = await call("/admin/hackathons", { method: "POST", token: tokens.admin, body: eventBody(suffix, overrides) });
  assert.equal(response.status, 201, `Hackathon creation failed: ${JSON.stringify(response.payload)}`); eventIds.push(response.payload.data.id); return response.payload.data;
};

const prepareSubmission = async (registration, token, project) => {
  const linked = await call(`/hackathon-teams/${registration.id}/project`, { method: "POST", token, body: { projectId: project.id, revision: registration.revision } });
  assert.equal(linked.status, 200, `Project link failed: ${JSON.stringify(linked.payload)}`);
  const saved = await call(`/hackathon-teams/${registration.id}/submission`, { method: "PUT", token, body: { revision: 0, repositoryUrl: "https://github.com/octocat/Hello-World", demoUrl: "https://example.com/demo", submissionUrl: "https://example.com/final-entry", checklist: [{ type: "team_confirmed", completed: true }] } });
  assert.equal(saved.status, 200, `Submission save failed: ${JSON.stringify(saved.payload)}`); assert.equal(saved.payload.data.status, "ready"); return saved.payload.data;
};

const cleanup = async () => {
  const users = trustedIn([...Object.values(ids), adminId].filter(Boolean)); const teams = trustedIn(teamIds); const projects = trustedIn(projectIds); const events = trustedIn(eventIds);
  await Promise.all([
    models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: users }, { actor_id: users }]) }),
    models.HackathonActivity.deleteMany({ hackathon_id: events }), models.HackathonSubmission.deleteMany({ hackathon_id: events }),
    models.TeamOpening.deleteMany({ $or: mongoose.trusted([{ _id: trustedIn(openingIds) }, { hackathon_id: events }]) }),
    models.CollaborationRequest.deleteMany({ $or: mongoose.trusted([{ sender_id: users }, { recipient_id: users }, { hackathon_id: events }]) }),
  ]);
  await models.HackathonTeam.deleteMany({ hackathon_id: events }); await models.HackathonParticipant.deleteMany({ hackathon_id: events }); await models.Hackathon.deleteMany({ _id: events });
  await Promise.all([
    models.ProjectShowcase.deleteMany({ project_id: projects }), models.ProjectRepository.deleteMany({ project_id: projects }), models.ContributionEvidence.deleteMany({ project_id: projects }),
    models.ProjectActivity.deleteMany({ project_id: projects }), models.ProjectTask.deleteMany({ project_id: projects }), models.ProjectMilestone.deleteMany({ project_id: projects }), models.ProjectParticipant.deleteMany({ project_id: projects }), models.Project.deleteMany({ _id: projects }),
  ]);
  await Promise.all([models.TeamActivity.deleteMany({ team_id: teams }), models.TeamInvitation.deleteMany({ team_id: teams }), models.TeamJoinRequest.deleteMany({ team_id: teams }), models.TeamMembership.deleteMany({ team_id: teams }), models.Team.deleteMany({ _id: teams })]);
  await Promise.all([models.UserBlock.deleteMany({ $or: mongoose.trusted([{ blocker_id: users }, { blocked_user_id: users }]) }), models.UserSkill.deleteMany({ user_id: users }), models.UserEducation.deleteMany({ user_id: users }), models.UserProfile.deleteMany({ _id: users }), models.User.deleteMany({ _id: users }), models.AuditLog.deleteMany({ user_id: users })]);
};

const run = async () => {
  await connectDatabase();
  for (const Model of [models.Hackathon, models.HackathonParticipant, models.HackathonTeam, models.HackathonSubmission, models.HackathonActivity, models.TeamOpening, models.CollaborationRequest, models.Notification]) await Model.syncIndexes();
  server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve)); apiBase = `http://127.0.0.1:${server.address().port}/api`;
  try {
    await Promise.all(labels.map(register)); await Promise.all(labels.map((label) => profile(label, label === "outsider" ? { discoverable: false, visible: false } : {})));
    adminId = randomUUID(); await models.User.create({ _id: adminId, email: `phase7-${marker}-admin@example.invalid`, password: await bcrypt.hash(password, 4), role: "admin", profile: { firstName: "P7", lastName: "Admin" }, status: "active" });
    await models.UserProfile.create({ _id: adminId, username: `p7-admin-${marker}`.slice(0, 30), visibility: "private", availability: "unavailable" });
    const login = await call("/auth/login", { method: "POST", body: { email: `phase7-${marker}-admin@example.invalid`, password } }); assert.equal(login.status, 200); tokens.admin = login.payload.data.accessToken;

    const event = await createEvent("Main");
    assert.equal((await call(`/hackathons/${event.slug}`)).status, 200, "Public detail must be signed-out readable");
    assert.ok((await call("/hackathons?status=registration_open&mode=hybrid&search=climate")).payload.data.some((row) => row.id === event.id), "Discovery filters must find event");
    assert.equal((await call("/admin/hackathons", { method: "POST", token: tokens.outsider, body: eventBody("Forbidden") })).status, 403, "Non-admin must not manage catalog");

    const joins = await Promise.all([call(`/hackathons/${event.id}/participation`, { method: "POST", token: tokens.teammate, body: { status: "participating", lookingForTeam: true, visibleOnHackathon: true, preferredRoles: ["ml_engineer"], commitment: "full_time", message: "Available for model and data work." } }), call(`/hackathons/${event.id}/participation`, { method: "POST", token: tokens.teammate, body: { status: "participating", lookingForTeam: true, visibleOnHackathon: true } })]);
    assert.deepEqual(joins.map((row) => row.status).sort(), [201, 409], "duplicate participation race must have one winner");
    assert.equal((await call(`/hackathons/${event.id}/participation`, { method: "POST", token: tokens.owner, body: { status: "interested" } })).status, 201);
    const promotedParticipation = await call(`/hackathons/${event.id}/participation`, { method: "PATCH", token: tokens.owner, body: { status: "participating" } });
    assert.equal(promotedParticipation.status, 200); assert.equal(promotedParticipation.payload.data.status, "participating", "Participation status update must persist");
    assert.equal((await call(`/hackathons/${event.id}/participation`, { method: "POST", token: tokens.outsider, body: { status: "participating", lookingForTeam: true, visibleOnHackathon: true } })).status, 201);
    const people = await call(`/hackathons/${event.id}/people?availability=open,limited`, { token: tokens.owner }); assert.ok(people.payload.data.some((row) => row.id === ids.teammate)); assert.ok(!people.payload.data.some((row) => row.id === ids.outsider), "private profile must not leak");
    const interest = await call("/collaboration-requests", { method: "POST", token: tokens.owner, body: { recipientId: ids.teammate, hackathonId: event.id, message: "Build for Earth together?" } }); assert.equal(interest.status, 201); assert.equal(interest.payload.data.hackathon.id, event.id);

    const team = await createTeam(tokens.owner, "Core"); await call(`/teams/${team.id}/join`, { method: "POST", token: tokens.teamAdmin }); await call(`/teams/${team.id}/join`, { method: "POST", token: tokens.member });
    assert.equal((await call(`/teams/${team.id}/members/${ids.teamAdmin}/role`, { method: "PATCH", token: tokens.owner, body: { role: "admin" } })).status, 200);
    assert.equal((await call(`/hackathons/${event.id}/teams`, { method: "POST", token: tokens.member, body: { teamId: team.id } })).status, 403, "Regular Team member must not register Team");
    const teamRace = await Promise.all([call(`/hackathons/${event.id}/teams`, { method: "POST", token: tokens.owner, body: { teamId: team.id } }), call(`/hackathons/${event.id}/teams`, { method: "POST", token: tokens.teamAdmin, body: { teamId: team.id } })]);
    assert.deepEqual(teamRace.map((row) => row.status).sort(), [201, 409], "duplicate Team registration race must have one winner"); const registration = teamRace.find((row) => row.status === 201).payload.data;

    const contextualOpening = await call(`/teams/${team.id}/openings`, { method: "POST", token: tokens.teamAdmin, body: { title: "Hackathon ML Engineer", role: "ml_engineer", hackathonId: event.id, hackathonTeamId: registration.id } }); assert.equal(contextualOpening.status, 201); openingIds.push(contextualOpening.payload.data.id); assert.equal(contextualOpening.payload.data.hackathon.id, event.id);
    const genericOpening = await call(`/teams/${team.id}/openings`, { method: "POST", token: tokens.owner, body: { title: "General Backend Builder", role: "backend_developer" } }); assert.equal(genericOpening.status, 201); openingIds.push(genericOpening.payload.data.id); assert.equal(genericOpening.payload.data.hackathon, null);

    const project = await createProject(tokens.owner, team.id, "Core"); const outsiderTeam = await createTeam(tokens.outsider, "Outside"); const outsiderProject = await createProject(tokens.outsider, outsiderTeam.id, "Outside");
    assert.equal((await call(`/hackathon-teams/${registration.id}/project`, { method: "POST", token: tokens.member, body: { projectId: project.id, revision: registration.revision } })).status, 403, "Member cannot link Project");
    assert.equal((await call(`/hackathon-teams/${registration.id}/project`, { method: "POST", token: tokens.owner, body: { projectId: outsiderProject.id, revision: registration.revision } })).status, 403, "Cross-Team Project must fail");
    const projectRace = await Promise.all([call(`/hackathon-teams/${registration.id}/project`, { method: "POST", token: tokens.owner, body: { projectId: project.id, revision: registration.revision } }), call(`/hackathon-teams/${registration.id}/project`, { method: "POST", token: tokens.teamAdmin, body: { projectId: project.id, revision: registration.revision } })]);
    assert.deepEqual(projectRace.map((row) => row.status).sort(), [200, 409], "Project link CAS race must have one winner");
    const saved = await call(`/hackathon-teams/${registration.id}/submission`, { method: "PUT", token: tokens.owner, body: { revision: 0, repositoryUrl: "https://github.com/octocat/Hello-World", demoUrl: "https://example.com/demo", submissionUrl: "https://example.com/final-entry", checklist: [{ type: "team_confirmed", completed: true }] } }); assert.equal(saved.status, 200, JSON.stringify(saved.payload)); const mainSubmission = saved.payload.data;
    assert.equal(mainSubmission.status, "ready");
    const updateSubmitRace = await Promise.all([
      call(`/hackathon-teams/${registration.id}/submission`, { method: "PUT", token: tokens.teamAdmin, body: { ...mainSubmission, revision: mainSubmission.revision, repositoryUrl: mainSubmission.repository_url, demoUrl: mainSubmission.demo_url, submissionUrl: mainSubmission.submission_url, checklist: [{ type: "team_confirmed", completed: true }] } }),
      call(`/hackathon-teams/${registration.id}/submission/submit`, { method: "POST", token: tokens.owner, body: { revision: mainSubmission.revision, confirm: true } }),
    ]);
    assert.equal(updateSubmitRace.filter((row) => row.status === 200).length, 1, "submission update versus submit race must have one CAS winner");

    const secondRegistrationResponse = await call(`/hackathons/${event.id}/teams`, { method: "POST", token: tokens.outsider, body: { teamId: outsiderTeam.id } }); assert.equal(secondRegistrationResponse.status, 201); const secondRegistration = secondRegistrationResponse.payload.data;
    const secondReady = await prepareSubmission(secondRegistration, tokens.outsider, outsiderProject);
    const doubleSubmit = await Promise.all([call(`/hackathon-teams/${secondRegistration.id}/submission/submit`, { method: "POST", token: tokens.outsider, body: { revision: secondReady.revision, confirm: true } }), call(`/hackathon-teams/${secondRegistration.id}/submission/submit`, { method: "POST", token: tokens.outsider, body: { revision: secondReady.revision, confirm: true } })]);
    assert.deepEqual(doubleSubmit.map((row) => row.status).sort(), [200, 409], "double final submission race must have one winner");
    assert.equal((await call(`/hackathon-teams/${secondRegistration.id}/submission`, { method: "PUT", token: tokens.outsider, body: { revision: doubleSubmit.find((row) => row.status === 200).payload.data.revision, demoUrl: "https://example.com/changed" } })).status, 409, "Submitted entry must be immutable");

    const strict = await createEvent("Strict", { teamMinSize: 2, teamMaxSize: 3 });
    assert.equal((await call(`/hackathons/${strict.id}/teams`, { method: "POST", token: tokens.outsider, body: { teamId: outsiderTeam.id } })).status, 400, "Team size rule must use active membership count");
    const closed = await createEvent("Closed", { registrationDeadline: new Date(Date.now() - 1000).toISOString(), eventStart: new Date(Date.now() + 86400000).toISOString() });
    assert.equal((await call(`/hackathons/${closed.id}/teams`, { method: "POST", token: tokens.outsider, body: { teamId: outsiderTeam.id } })).status, 409, "Server must enforce registration deadline boundary");

    const plans = await Promise.all([
      models.Hackathon.find({ visibility: "public", status: "registration_open" }).sort({ event_start: 1 }).explain("queryPlanner"),
      models.HackathonParticipant.find({ user_id: ids.owner, status: "participating" }).sort({ updated_at: -1 }).explain("queryPlanner"),
      models.HackathonParticipant.find({ hackathon_id: event.id, looking_for_team: true, status: "participating" }).sort({ updated_at: -1 }).explain("queryPlanner"),
      models.HackathonTeam.find({ hackathon_id: event.id, status: "registered" }).sort({ created_at: -1 }).explain("queryPlanner"),
      models.HackathonSubmission.find({ hackathon_team_id: registration.id }).explain("queryPlanner"),
    ]);
    plans.forEach((plan) => assert.match(JSON.stringify(plan.queryPlanner?.winningPlan || {}), /IXSCAN/));
    assert.equal(await models.HackathonSubmission.countDocuments({ hackathon_team_id: secondRegistration.id, status: "submitted" }), 1);
    process.stdout.write("Phase 7 Hackathon verification passed: catalog admin boundary, discovery, participation/privacy, Team RBAC/size/deadline, contextual openings/requests, Project IDOR/CAS, submission readiness/immutability, transactions, races, indexes, and Atlas query plans.\n");
  } finally { await cleanup(); }
};

run().catch((error) => { process.stderr.write(`Phase 7 Hackathon verification failed: ${error.stack || error.message}\n`); process.exitCode = 1; }).finally(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await disconnectDatabase(); });
