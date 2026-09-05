require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const apiBase = (process.argv[2] || "http://localhost:5000/api").replace(/\/$/, "");
const runId = randomUUID();
const password = `Tn-${randomBytes(18).toString("base64url")}9aA`;
const ids = { admin: randomUUID() };
const teamIds = [];
const projectIds = [];
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
    models.ProjectTask.deleteMany({ project_id: projects() }),
    models.ProjectMilestone.deleteMany({ project_id: projects() }),
    models.ProjectParticipant.deleteMany({ project_id: projects() }),
  ]);
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

    const removedContributor = await call(`/teams/${teamId}/members/${ids.contributor}`, { method: "DELETE", token: clientToken });
    assert.equal(removedContributor.status, 200, "team removal integration failed");
    const removedContributorDenied = await call(`/projects/${project.id}/tasks`, { token: contributorToken });
    assert.equal(removedContributorDenied.status, 403, "removed Team member retained project permission");
    const completedProject = await call(`/projects/${project.id}/complete`, { method: "POST", token: leadToken });
    assert.equal(completedProject.status, 200, "project completion failed");

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

    for (const token of [clientToken, freelancerToken, leadToken, contributorToken, teamOnlyToken, adminToken]) {
      const logout = await call("/auth/logout", { method: "POST", token });
      assert.equal(logout.status, 200);
    }
    process.stdout.write("MongoDB API verification passed: account roles, marketplace reads, Teams, Projects, participant RBAC, tasks, milestones, privacy/IDOR, revocation, completion, transfer, and archive.\n");
  } finally {
    await cleanup();
  }
};

run().catch((error) => {
  process.stderr.write(`MongoDB API verification failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
