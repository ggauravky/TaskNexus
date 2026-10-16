require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const configuredApiBase = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const apiBase = (configuredApiBase || "http://localhost:5000/api").replace(/\/$/, "");
const runId = randomUUID();
const password = `Tn-${randomBytes(18).toString("base64url")}9aA`;
const ids = { admin: randomUUID() };
const teamIds = [];
const projectIds = [];
const searchTerm = `phasec${runId.slice(0, 8)}`;
const phaseC = {
  publicTeam: randomUUID(), privateTeam: randomUUID(), publicProject: randomUUID(), privateProject: randomUUID(),
  publicHackathon: randomUUID(), privateHackathon: randomUUID(), activeOrganization: randomUUID(), inactiveOrganization: randomUUID(),
  openOpportunity: randomUUID(), closedOpportunity: randomUUID(), projectTask: randomUUID(), block: randomUUID(),
  tasks: Array.from({ length: 8 }, () => randomUUID()),
};
const emails = {
  admin: `mongo-api-${runId}-admin@example.invalid`,
  client: `mongo-api-${runId}-client@example.invalid`,
  freelancer: `mongo-api-${runId}-freelancer@example.invalid`,
  lead: `mongo-api-${runId}-lead@example.invalid`,
  contributor: `mongo-api-${runId}-contributor@example.invalid`,
  teamOnly: `mongo-api-${runId}-team-only@example.invalid`,
};

const call = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  return { status: response.status, payload };
};

const register = async (label, role = label) => {
  const result = await call("/auth/register", {
    method: "POST",
    body: {
      email: emails[label], password, role,
      profile: { firstName: "Mongo", lastName: label },
    },
  });
  assert.equal(result.status, 201, `${label} registration failed`);
  ids[label] = result.payload.data.user.id;
  return result.payload.data.accessToken;
};

const expectOk = async (path, token) => {
  const result = await call(path, { token });
  assert.equal(result.status, 200, `${path} returned ${result.status}`);
  return result.payload;
};

const cleanup = async () => {
  const userIds = Object.values(ids).filter(Boolean);
  if (!userIds.length) return;
  const users = () => mongoose.trusted({ $in: userIds });
  const createdTeams = await models.Team.find({ created_by: users() }).select("_id").lean();
  teamIds.push(...createdTeams.map((item) => String(item._id)).filter((id) => !teamIds.includes(id)));
  const teams = () => mongoose.trusted({ $in: teamIds });
  const projects = () => mongoose.trusted({ $in: projectIds });
  await Promise.all([
    models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: users() }, { entity_id: teams() }]) }),
    models.AuditLog.deleteMany({ user_id: users() }),
    models.UserEducation.deleteMany({ user_id: users() }),
    models.UserSkill.deleteMany({ user_id: users() }),
    models.TeamActivity.deleteMany({ team_id: teams() }),
    models.TeamInvitation.deleteMany({ team_id: teams() }),
    models.TeamJoinRequest.deleteMany({ team_id: teams() }),
    models.TeamMembership.deleteMany({ team_id: teams() }),
    models.ProjectActivity.deleteMany({ project_id: projects() }),
    models.ProjectShowcase.deleteMany({ project_id: projects() }),
    models.ProjectRepository.deleteMany({ project_id: projects() }),
    models.ContributionEvidence.deleteMany({ project_id: projects() }),
    models.ProjectTask.deleteMany({ project_id: projects() }),
    models.ProjectMilestone.deleteMany({ project_id: projects() }),
    models.ProjectParticipant.deleteMany({ project_id: projects() }),
    models.UserBlock.deleteMany({ _id: phaseC.block }),
    models.ProjectTask.deleteMany({ _id: phaseC.projectTask }),
    models.Hackathon.deleteMany({ _id: mongoose.trusted({ $in: [phaseC.publicHackathon, phaseC.privateHackathon] }) }),
    models.Opportunity.deleteMany({ _id: mongoose.trusted({ $in: [phaseC.openOpportunity, phaseC.closedOpportunity] }) }),
    models.Organization.deleteMany({ _id: mongoose.trusted({ $in: [phaseC.activeOrganization, phaseC.inactiveOrganization] }) }),
    models.Task.deleteMany({ _id: mongoose.trusted({ $in: phaseC.tasks }) }),
  ]);
  await models.Project.deleteMany({ _id: mongoose.trusted({ $in: [phaseC.publicProject, phaseC.privateProject] }) });
  await models.Team.deleteMany({ _id: mongoose.trusted({ $in: [phaseC.publicTeam, phaseC.privateTeam] }) });
  await models.Project.deleteMany({ _id: projects() });
  await models.Team.deleteMany({ _id: teams() });
  await Promise.all([
    models.UserProfile.deleteMany({ _id: users() }),
    models.User.deleteMany({ _id: users() }),
  ]);
};

const run = async () => {
  await connectDatabase();
  try {
    await models.User.create({
      _id: ids.admin,
      email: emails.admin,
      password: await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 12),
      role: "admin",
      profile: { firstName: "Mongo", lastName: "Admin" },
    });
    await models.UserProfile.create({ _id: ids.admin });

    const clientToken = await register("client");
    const freelancerToken = await register("freelancer");
    const leadToken = await register("lead", "freelancer");
    const contributorToken = await register("contributor", "freelancer");
    const teamOnlyToken = await register("teamOnly", "client");
    for (const [role, token] of [["client", clientToken], ["freelancer", freelancerToken]]) {
      const me = await expectOk("/auth/me", token);
      assert.equal(me.data.user.role, role);
    }
    await expectOk("/client/profile", clientToken);
    await expectOk("/client/tasks?page=1&limit=10", clientToken);
    await expectOk("/freelancer/profile", freelancerToken);
    await expectOk("/freelancer/available-tasks", freelancerToken);
    await expectOk("/freelancer/my-tasks", freelancerToken);

    const adminLogin = await call("/auth/login", {
      method: "POST", body: { email: emails.admin, password },
    });
    assert.equal(adminLogin.status, 200, "admin login failed");
    const adminToken = adminLogin.payload.data.accessToken;
    const adminMe = await expectOk("/auth/me", adminToken);
    assert.equal(adminMe.data.user.role, "admin");
    await expectOk("/admin/users", adminToken);
    await expectOk("/admin/tasks", adminToken);
    await expectOk("/admin/audit-logs", adminToken);

    await Promise.all([
      models.UserProfile.updateOne({ _id: ids.freelancer }, { $set: { headline: searchTerm, visibility: "public", discoverable: true } }),
      models.UserProfile.updateOne({ _id: ids.contributor }, { $set: { headline: searchTerm, visibility: "public", discoverable: true } }),
      models.UserProfile.updateOne({ _id: ids.lead }, { $set: { headline: searchTerm, visibility: "private", discoverable: true } }),
    ]);
    await models.UserBlock.create({ _id: phaseC.block, blocker_id: ids.freelancer, blocked_user_id: ids.contributor });
    await models.Team.insertMany([
      { _id: phaseC.publicTeam, name: `${searchTerm} public`, slug: `${searchTerm}-public`, created_by: ids.client, owner_id: ids.client, visibility: "public", status: "active" },
      { _id: phaseC.privateTeam, name: `${searchTerm} private`, slug: `${searchTerm}-private`, created_by: ids.client, owner_id: ids.client, visibility: "private", status: "active" },
    ]);
    await models.Project.insertMany([
      { _id: phaseC.publicProject, team_id: phaseC.publicTeam, name: `${searchTerm} public`, slug: `${searchTerm}-public`, created_by: ids.client, visibility: "public", status: "active" },
      { _id: phaseC.privateProject, team_id: phaseC.privateTeam, name: `${searchTerm} private`, slug: `${searchTerm}-private`, created_by: ids.client, visibility: "public", status: "active" },
    ]);
    await models.ProjectTask.create({ _id: phaseC.projectTask, team_id: phaseC.publicTeam, project_id: phaseC.publicProject, title: `${searchTerm} project task`, status: "todo", priority: "medium", created_by: ids.client });
    const phaseCNow = Date.now();
    await models.Hackathon.insertMany([
      { _id: phaseC.publicHackathon, name: `${searchTerm} public`, slug: `${searchTerm}-public`, organizer_name: "QA", mode: "online", event_start: new Date(phaseCNow + 86400000), event_end: new Date(phaseCNow + 172800000), status: "upcoming", visibility: "public", created_by: ids.client },
      { _id: phaseC.privateHackathon, name: `${searchTerm} private`, slug: `${searchTerm}-private`, organizer_name: "QA", mode: "online", event_start: new Date(phaseCNow + 86400000), event_end: new Date(phaseCNow + 172800000), status: "upcoming", visibility: "private", created_by: ids.client },
    ]);
    await models.Organization.insertMany([
      { _id: phaseC.activeOrganization, name: `${searchTerm} active`, slug: `${searchTerm}-active`, organization_type: "startup", status: "active", created_by: ids.client },
      { _id: phaseC.inactiveOrganization, name: `${searchTerm} inactive`, slug: `${searchTerm}-inactive`, organization_type: "startup", status: "archived", created_by: ids.client },
    ]);
    await models.Opportunity.insertMany([
      { _id: phaseC.openOpportunity, organization_id: phaseC.activeOrganization, type: "internship", title: `${searchTerm} open`, slug: `${searchTerm}-open`, work_mode: "remote", application_mode: "external", application_url: "https://example.com/open", status: "published", source_type: "official", published_at: new Date(), created_by: ids.admin },
      { _id: phaseC.closedOpportunity, organization_id: phaseC.activeOrganization, type: "internship", title: `${searchTerm} closed`, slug: `${searchTerm}-closed`, work_mode: "remote", application_mode: "external", application_url: "https://example.com/closed", status: "closed", source_type: "official", published_at: new Date(), created_by: ids.admin },
    ]);
    await models.Task.insertMany([
      ...phaseC.tasks.slice(0, 6).map((id, index) => ({
        _id: id, task_id: `TSK-${runId}-PHASEC-${index}`, client_id: ids.client,
        freelancer_id: index === 0 ? ids.freelancer : null,
        task_details: { title: `${searchTerm} task ${index}`, description: "Owned search fixture" },
        status: index === 0 ? "in_progress" : "submitted",
      })),
      { _id: phaseC.tasks[6], task_id: `TSK-${runId}-PHASEC-UNASSIGNED`, client_id: ids.lead, task_details: { title: `${searchTerm} unassigned` }, status: "submitted" },
      { _id: phaseC.tasks[7], task_id: `TSK-${runId}-PHASEC-UNRELATED`, client_id: ids.lead, freelancer_id: ids.contributor, task_details: { title: `${searchTerm} unrelated` }, status: "in_progress" },
    ]);

    const anonymousSearch = await call(`/search?q=${searchTerm}`);
    assert.equal(anonymousSearch.status, 401, "global search must require authentication");
    const searchFor = async (token, query = searchTerm) => {
      const response = await call(`/search?q=${encodeURIComponent(query)}&limit=100`, { token });
      assert.equal(response.status, 200, `global search returned ${response.status}`);
      assert.deepEqual(Object.keys(response.payload.data.groups), ["teams", "projects", "people", "hackathons", "opportunities", "organizations", "tasks"]);
      for (const rows of Object.values(response.payload.data.groups)) {
        assert.ok(rows.length <= 5, "global search group exceeded five rows");
        for (const row of rows) {
          assert.ok(Object.keys(row).every((key) => ["id", "type", "title", "subtitle", "status", "target_path"].includes(key)), "global search leaked a non-DTO field");
          assert.match(row.target_path, /^\/(?:teams|u|hackathons|opportunities|organizations|tasks)\//, "global search returned an unsafe target");
        }
      }
      return response.payload.data.groups;
    };
    const [clientSearch, freelancerSearch, adminSearch] = await Promise.all([
      searchFor(clientToken), searchFor(freelancerToken), searchFor(adminToken),
    ]);
    assert.deepEqual(clientSearch.teams.map((row) => row.id), [phaseC.publicTeam]);
    assert.deepEqual(adminSearch.teams.map((row) => row.id), [phaseC.publicTeam], "administrator received a private team");
    assert.deepEqual(clientSearch.projects.map((row) => row.id), [phaseC.publicProject]);
    assert.deepEqual(adminSearch.projects.map((row) => row.id), [phaseC.publicProject], "administrator received a private-team project");
    assert.equal(freelancerSearch.people.some((row) => row.id === ids.contributor), false, "blocked profile leaked into search");
    assert.equal(freelancerSearch.people.some((row) => row.id === ids.lead), false, "private profile leaked into search");
    assert.deepEqual(clientSearch.hackathons.map((row) => row.id), [phaseC.publicHackathon]);
    assert.equal(adminSearch.hackathons.some((row) => row.id === phaseC.privateHackathon), true, "administrator private Hackathon catalog scope was lost");
    assert.deepEqual(clientSearch.opportunities.map((row) => row.id), [phaseC.openOpportunity]);
    assert.deepEqual(clientSearch.organizations.map((row) => row.id), [phaseC.activeOrganization]);
    assert.equal(clientSearch.tasks.length, 5, "client task group was not capped at five");
    assert.deepEqual(freelancerSearch.tasks.map((row) => row.id), [phaseC.tasks[0]], "freelancer task results crossed assignment ownership");
    assert.equal(freelancerSearch.tasks.some((row) => row.id === phaseC.tasks[6]), false, "unassigned task leaked into freelancer search");
    assert.equal(Object.values(clientSearch).flat().some((row) => row.id === phaseC.projectTask), false, "ProjectTask entered marketplace search");
    const escapedSearch = await searchFor(clientToken, ".*");
    assert.ok(Object.values(escapedSearch).every((rows) => rows.length === 0), "special-character query was not treated literally");

    await searchFor(clientToken);
    const latencies = [];
    for (let index = 0; index < 20; index += 1) {
      const startedAt = performance.now();
      await searchFor(index % 2 === 0 ? clientToken : freelancerToken);
      latencies.push(performance.now() - startedAt);
    }
    latencies.sort((a, b) => a - b);
    const median = latencies[Math.floor(latencies.length / 2)];
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
    assert.ok(p95 <= 2000, `global search p95 ${p95.toFixed(1)}ms exceeded 2000ms`);
    process.stdout.write(`Phase C search latency (20 warmed requests): median ${median.toFixed(1)}ms, p95 ${p95.toFixed(1)}ms.\n`);

    const teamSlug = `mongo-api-team-${runId.slice(0, 8)}`;
    const createdTeam = await call("/teams", {
      method: "POST", token: clientToken,
      body: { name: "Mongo API Team", slug: teamSlug, visibility: "public", joinPolicy: "open", primaryInterests: ["developer_tools"] },
    });
    assert.equal(createdTeam.status, 201, "team creation failed");
    const teamId = createdTeam.payload.data.id;
    teamIds.push(teamId);
    const teamDetail = await expectOk(`/teams/${teamSlug}`, freelancerToken);
    assert.equal(teamDetail.data.viewer_relationship.kind, "none");
    const joined = await call(`/teams/${teamId}/join`, { method: "POST", token: freelancerToken });
    assert.equal(joined.status, 201, "open team join failed");
    for (const [label, token] of [["lead", leadToken], ["contributor", contributorToken], ["teamOnly", teamOnlyToken]]) {
      const extraJoin = await call(`/teams/${teamId}/join`, { method: "POST", token });
      assert.equal(extraJoin.status, 201, `${label} team join failed`);
    }
    const roleChanged = await call(`/teams/${teamId}/members/${ids.freelancer}/role`, {
      method: "PATCH", token: clientToken, body: { role: "admin" },
    });
    assert.equal(roleChanged.status, 200, "team role change failed");

    const createdProject = await call(`/teams/${teamId}/projects`, {
      method: "POST", token: clientToken,
      body: { name: "Mongo API Project", slug: `mongo-api-project-${runId.slice(0, 8)}`, tagline: "Verified team delivery", visibility: "public" },
    });
    assert.equal(createdProject.status, 201, "project creation failed");
    const project = createdProject.payload.data;
    projectIds.push(project.id);
    assert.equal(project.viewer_permissions.edit_project, true);
    const publicProject = await call(`/projects/${project.id}`, { token: adminToken });
    assert.equal(publicProject.status, 200, "public project read failed");
    const globalAdminCreateDenied = await call(`/teams/${teamId}/projects`, {
      method: "POST", token: adminToken, body: { name: "Forbidden global admin project" },
    });
    assert.equal(globalAdminCreateDenied.status, 403, "global marketplace admin must not create Team projects");

    for (const [userId, role] of [[ids.lead, "lead"], [ids.contributor, "contributor"]]) {
      const added = await call(`/projects/${project.id}/participants`, {
        method: "POST", token: clientToken, body: { userId, role },
      });
      assert.equal(added.status, 201, `${role} participant add failed`);
    }
    const teamOnlyProject = await call(`/projects/${project.id}`, { token: teamOnlyToken });
    assert.equal(teamOnlyProject.status, 200, "team member project summary read failed");
    const teamOnlyTasksDenied = await call(`/projects/${project.id}/tasks`, { token: teamOnlyToken });
    assert.equal(teamOnlyTasksDenied.status, 403, "nonparticipant task workspace must be denied");

    const milestone = await call(`/projects/${project.id}/milestones`, {
      method: "POST", token: leadToken, body: { name: "API foundation" },
    });
    assert.equal(milestone.status, 201, "project lead milestone creation failed");
    const createdTask = await call(`/projects/${project.id}/tasks`, {
      method: "POST", token: leadToken,
      body: { title: "Exercise API lifecycle", priority: "high", assigneeIds: [ids.contributor], milestoneId: milestone.payload.data.id },
    });
    assert.equal(createdTask.status, 201, "project task creation failed");
    let projectTask = createdTask.payload.data;
    const teamOnlyTaskIdor = await call(`/project-tasks/${projectTask.id}`, { token: teamOnlyToken });
    assert.equal(teamOnlyTaskIdor.status, 403, "project task ID must not bypass participation");
    const startedTask = await call(`/project-tasks/${projectTask.id}/status`, {
      method: "POST", token: contributorToken, body: { status: "in_progress", revision: projectTask.revision },
    });
    assert.equal(startedTask.status, 200, "assignee task start failed");
    projectTask = startedTask.payload.data;
    const completedTask = await call(`/project-tasks/${projectTask.id}/status`, {
      method: "POST", token: contributorToken, body: { status: "done", revision: projectTask.revision },
    });
    assert.equal(completedTask.status, 200, "assignee task completion failed");
    assert.ok(completedTask.payload.data.completed_at);
    const completedMilestone = await call(`/project-milestones/${milestone.payload.data.id}`, {
      method: "PATCH", token: leadToken, body: { status: "completed" },
    });
    assert.equal(completedMilestone.status, 200, "milestone completion failed");
    const activatedProject = await call(`/projects/${project.id}/status`, {
      method: "POST", token: leadToken, body: { status: "active" },
    });
    assert.equal(activatedProject.status, 200, "project activation failed");
    const updatedProject = await call(`/projects/${project.id}`, {
      method: "PATCH", token: leadToken, body: { tagline: "Lead-managed delivery" },
    });
    assert.equal(updatedProject.status, 200, "project lead update failed");
    const projectActivity = await call(`/projects/${project.id}/activity`, { token: leadToken });
    assert.equal(projectActivity.status, 200, "project activity failed");
    assert.ok(projectActivity.payload.data.some((item) => item.type === "task_completed"));

    const contributionFeed = await call(`/projects/${project.id}/contributions`, { token: contributorToken });
    assert.equal(contributionFeed.status, 200, "participant contribution feed failed");
    assert.ok(contributionFeed.payload.data.some((item) => item.type === "project_task_completion" && item.verification === "internal_verified"));
    const teamOnlyContributions = await call(`/projects/${project.id}/contributions`, { token: teamOnlyToken });
    assert.equal(teamOnlyContributions.status, 403, "nonparticipant contribution feed must be denied");
    const internalEvidence = contributionFeed.payload.data.find((item) => item.type === "project_task_completion");
    const immutableSystemEvidence = await call(`/contribution-evidence/${internalEvidence.id}`, { method: "DELETE", token: contributorToken });
    assert.equal(immutableSystemEvidence.status, 403, "system evidence must be immutable through API");

    const repository = await call(`/projects/${project.id}/repositories`, {
      method: "POST", token: leadToken, body: { url: "https://github.com/octocat/Hello-World.git/" },
    });
    assert.equal(repository.status, 201, "project lead repository link failed");
    const repositoryDenied = await call(`/projects/${project.id}/repositories`, {
      method: "POST", token: teamOnlyToken, body: { url: "https://github.com/octocat/Spoon-Knife" },
    });
    assert.equal(repositoryDenied.status, 403, "team-only member linked a project repository");
    const externalEvidence = await call(`/projects/${project.id}/evidence`, {
      method: "POST", token: contributorToken,
      body: { type: "external_link", title: "External demo claim", sourceUrl: "https://example.com/tasknexus-phase5-proof" },
    });
    assert.equal(externalEvidence.status, 201, "participant external evidence failed");
    assert.equal(externalEvidence.payload.data.verification, "unverified");
    const removeExternal = await call(`/contribution-evidence/${externalEvidence.payload.data.id}`, { method: "DELETE", token: contributorToken });
    assert.equal(removeExternal.status, 200, "claimant could not revoke own evidence");
    const profileOptIn = await call(`/projects/${project.id}/profile-visibility`, {
      method: "PATCH", token: contributorToken, body: { showOnProfile: true },
    });
    assert.equal(profileOptIn.status, 200, "self profile project opt-in failed");

    const showcaseDraft = await call(`/projects/${project.id}/showcase`, {
      method: "PUT", token: leadToken,
      body: {
        headline: "API-verified project showcase", summary: "A safe public project summary.",
        problem: "Internal workspace data needs a strict publication boundary.",
        solution: "A separate allowlisted showcase serializer.", outcome: "Public evidence remains inspectable without leaking internal tasks.",
        featuredSkills: ["MongoDB", "React"], featuredEvidenceIds: [internalEvidence.id], revision: 0,
      },
    });
    assert.equal(showcaseDraft.status, 200, "showcase draft save failed");
    const earlyPublish = await call(`/projects/${project.id}/showcase/publish`, {
      method: "POST", token: leadToken, body: { revision: showcaseDraft.payload.data.revision },
    });
    assert.equal(earlyPublish.status, 409, "active project showcase published before completion");

    const removedContributor = await call(`/teams/${teamId}/members/${ids.contributor}`, { method: "DELETE", token: clientToken });
    assert.equal(removedContributor.status, 200, "team removal integration failed");
    const removedContributorDenied = await call(`/projects/${project.id}/tasks`, { token: contributorToken });
    assert.equal(removedContributorDenied.status, 403, "removed Team member retained project permission");
    const completedProject = await call(`/projects/${project.id}/complete`, { method: "POST", token: leadToken });
    assert.equal(completedProject.status, 200, "project completion failed");
    const publishedShowcase = await call(`/projects/${project.id}/showcase/publish`, {
      method: "POST", token: leadToken, body: { revision: showcaseDraft.payload.data.revision },
    });
    assert.equal(publishedShowcase.status, 200, "completed public project showcase publish failed");
    const publicShowcase = await call(`/showcase/${teamSlug}/${project.slug}`);
    assert.equal(publicShowcase.status, 200, "public showcase route failed");
    const publicText = JSON.stringify(publicShowcase.payload.data);
    assert.equal(publicText.includes("Exercise API lifecycle"), false, "public showcase leaked task title");
    assert.equal(publicText.includes("activity"), false, "public showcase leaked internal activity");

    const privateUpdate = await call(`/teams/${teamId}`, {
      method: "PATCH", token: freelancerToken, body: { visibility: "private", tagline: "Contextual API roles" },
    });
    assert.equal(privateUpdate.status, 200, "team admin update failed");
    const globalAdminDenied = await call(`/teams/${teamSlug}`, { token: adminToken });
    assert.equal(globalAdminDenied.status, 404, "global admin must not bypass private team membership");
    const globalAdminProjectDenied = await call(`/projects/${project.id}`, { token: adminToken });
    assert.equal(globalAdminProjectDenied.status, 404, "global admin must not bypass private project membership");
    const globalAdminTaskDenied = await call(`/project-tasks/${projectTask.id}`, { token: adminToken });
    assert.equal(globalAdminTaskDenied.status, 404, "global admin must not bypass private project task IDOR");
    const transfer = await call(`/teams/${teamId}/transfer-ownership`, {
      method: "POST", token: clientToken, body: { userId: ids.freelancer },
    });
    assert.equal(transfer.status, 200, "ownership transfer failed");
    const archived = await call(`/teams/${teamId}/archive`, { method: "POST", token: freelancerToken });
    assert.equal(archived.status, 200, "contextual owner archive failed");

    const clientNotificationBaseline = await call("/notifications?page=1&limit=1", { token: clientToken });
    const freelancerNotificationBaseline = await call("/notifications?page=1&limit=1", { token: freelancerToken });
    assert.equal(clientNotificationBaseline.status, 200, "client notification baseline failed");
    assert.equal(freelancerNotificationBaseline.status, 200, "freelancer notification baseline failed");
    const clientBaselineTotal = clientNotificationBaseline.payload.meta.pagination.total;
    const clientBaselineUnread = clientNotificationBaseline.payload.data.unreadCount;
    const freelancerBaselineTotal = freelancerNotificationBaseline.payload.meta.pagination.total;
    const freelancerBaselineUnread = freelancerNotificationBaseline.payload.data.unreadCount;

    const notificationTaskId = randomUUID();
    const notificationCreatedAt = Date.now();
    const clientNotificationIds = Array.from({ length: 22 }, () => randomUUID());
    const freelancerNotificationId = randomUUID();
    await models.Notification.insertMany([
      ...clientNotificationIds.map((id, index) => ({
        _id: id,
        recipient_id: ids.client,
        actor_id: ids.freelancer,
        type: "task_progress",
        content: {
          title: `Notification ${index + 1}`,
          message: `Bounded notification history ${index + 1}`,
          actionUrl: index === 21 ? "https://attacker.example/phish" : `/legacy/${id}`,
        },
        related_task_id: notificationTaskId,
        status: "unread",
        created_at: new Date(notificationCreatedAt + index),
      })),
      {
        _id: freelancerNotificationId,
        recipient_id: ids.freelancer,
        actor_id: ids.client,
        type: "task_assigned",
        content: { title: "Private notification", message: "Visible only to the recipient" },
        related_task_id: notificationTaskId,
        status: "unread",
        created_at: new Date(notificationCreatedAt + 100),
      },
    ]);

    const anonymousNotifications = await call("/notifications?page=1&limit=8");
    assert.equal(anonymousNotifications.status, 401, "notification history must require authentication");
    const clientNotifications = await call("/notifications?page=1&limit=8", { token: clientToken });
    assert.equal(clientNotifications.status, 200, "client notification history failed");
    assert.equal(clientNotifications.payload.data.notifications.length, 8, "notification page exceeded its requested bound");
    assert.equal(clientNotifications.payload.meta.pagination.total, clientBaselineTotal + 22, "notification total crossed recipient ownership");
    assert.equal(
      clientNotifications.payload.meta.pagination.totalPages,
      Math.ceil((clientBaselineTotal + 22) / 8),
      "notification pagination metadata is incorrect",
    );
    assert.equal(clientNotifications.payload.data.unreadCount, clientBaselineUnread + 22, "client unread count is incorrect");
    assert.ok(
      clientNotifications.payload.data.notifications.every((notification) => notification.recipient_id === ids.client),
      "notification history leaked another recipient's row",
    );
    assert.ok(
      clientNotifications.payload.data.notifications.every(
        (notification) => notification.target_path === `/tasks/${notificationTaskId}?tab=work`,
      ),
      "notification history did not return canonical safe internal targets",
    );
    assert.equal(
      clientNotifications.payload.data.notifications.some(
        (notification) => String(notification.target_path).includes("attacker.example"),
      ),
      false,
      "untrusted notification content controlled the navigation target",
    );

    const crossRecipientRead = await call(`/notifications/${freelancerNotificationId}/read`, {
      method: "PATCH", token: clientToken,
    });
    assert.equal(crossRecipientRead.status, 404, "client marked another recipient's notification as read");
    const crossRecipientDelete = await call(`/notifications/${freelancerNotificationId}`, {
      method: "DELETE", token: clientToken,
    });
    assert.equal(crossRecipientDelete.status, 404, "client deleted another recipient's notification");

    const newestClientNotificationId = clientNotificationIds.at(-1);
    const markedNotification = await call(`/notifications/${newestClientNotificationId}/read`, {
      method: "PATCH", token: clientToken,
    });
    assert.equal(markedNotification.status, 200, "recipient could not mark its notification as read");
    assert.equal(markedNotification.payload.data.status, "read");
    assert.equal(markedNotification.payload.data.target_path, `/tasks/${notificationTaskId}?tab=work`);
    const unreadClientNotifications = await call("/notifications?unreadOnly=true&page=1&limit=20", { token: clientToken });
    assert.equal(unreadClientNotifications.status, 200, "unread notification filter failed");
    assert.equal(unreadClientNotifications.payload.meta.pagination.total, clientBaselineUnread + 21);
    assert.equal(unreadClientNotifications.payload.data.unreadCount, clientBaselineUnread + 21);
    assert.equal(
      unreadClientNotifications.payload.data.notifications.some((notification) => notification.id === newestClientNotificationId),
      false,
      "read notification remained in the unread filter",
    );

    const readAllClientNotifications = await call("/notifications/read-all", { method: "PATCH", token: clientToken });
    assert.equal(readAllClientNotifications.status, 200, "recipient mark-all-read failed");
    assert.equal(readAllClientNotifications.payload.data.modifiedCount, clientBaselineUnread + 21);
    const freelancerNotifications = await call("/notifications?page=1&limit=20", { token: freelancerToken });
    assert.equal(freelancerNotifications.status, 200, "freelancer notification history failed");
    assert.equal(freelancerNotifications.payload.meta.pagination.total, freelancerBaselineTotal + 1);
    assert.equal(
      freelancerNotifications.payload.data.unreadCount,
      freelancerBaselineUnread + 1,
      "client mark-all-read crossed ownership",
    );
    const privateFreelancerNotification = freelancerNotifications.payload.data.notifications.find(
      (notification) => notification.id === freelancerNotificationId,
    );
    assert.ok(privateFreelancerNotification, "freelancer could not read its own notification");
    assert.equal(privateFreelancerNotification.status, "unread");

    const deleteOwnNotification = await call(`/notifications/${newestClientNotificationId}`, {
      method: "DELETE", token: clientToken,
    });
    assert.equal(deleteOwnNotification.status, 200, "recipient could not delete its notification");

    for (const token of [clientToken, freelancerToken, leadToken, contributorToken, teamOnlyToken, adminToken]) {
      const logout = await call("/auth/logout", { method: "POST", token });
      assert.equal(logout.status, 200);
    }
    process.stdout.write("MongoDB API verification passed: account roles, marketplace reads, Teams, Projects, participant RBAC, tasks, milestones, Phase 5 evidence/repositories/showcase/profile opt-in, Phase C seven-domain search privacy/bounds/targets, notification pagination/targets/ownership, privacy/IDOR, revocation, completion, transfer, and archive.\n");
  } finally {
    await cleanup();
  }
};

run().catch((error) => {
  process.stderr.write(`MongoDB API verification failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
