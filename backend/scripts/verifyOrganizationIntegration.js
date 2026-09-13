require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");
const { generateAccessToken } = require("../src/config/jwt");

const runId = randomUUID();
const marker = runId.slice(0, 8);
const password = `Tn-${randomBytes(18).toString("base64url")}9aA`;
const ids = {};
const tokens = {};
const organizationIds = [];
const opportunityIds = [];
const teamIds = [];
const projectIds = [];
let adminId;
let server;
let apiBase;
const trustedIn = (values) => mongoose.trusted({ $in: values });

const call = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload; try { payload = JSON.parse(text); } catch (_error) { payload = { text }; }
  return { status: response.status, payload };
};

const register = async (label) => {
  ids[label] = randomUUID();
  tokens[label] = generateAccessToken(ids[label], "freelancer");
  await models.User.create({ _id: ids[label], email: `phase9-${marker}-${label}@example.invalid`, password: await bcrypt.hash(password, 4), role: "freelancer", profile: { firstName: "P9", lastName: label }, status: "active" });
  await models.UserProfile.create({ _id: ids[label], username: `p9-${label}-${marker}`, headline: `${label} verification profile`, visibility: "public", availability: "open", discoverable: true });
};

const createOrganization = async (label) => {
  const response = await call("/admin/organizations", { method: "POST", token: tokens.admin, body: { name: `Phase 9 ${label} ${marker}`, slug: `phase9-${label.toLowerCase()}-${marker}`, organizationType: "startup", tagline: "Contextual hiring workspace", description: "A temporary Phase 9 integration fixture.", websiteUrl: "https://example.com" } });
  assert.equal(response.status, 201, JSON.stringify(response.payload));
  organizationIds.push(response.payload.data.id);
  return response.payload.data;
};

const inviteAndAccept = async (organizationId, inviterToken, label, role) => {
  const invitation = await call(`/organizations/${organizationId}/invitations`, { method: "POST", token: inviterToken, body: { userId: ids[label], role } });
  assert.equal(invitation.status, 201, JSON.stringify(invitation.payload));
  const accepted = await call(`/organization-invitations/${invitation.payload.data.id}/accept`, { method: "POST", token: tokens[label] });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.payload));
  return invitation.payload.data;
};

const nativeOpportunityBody = (suffix) => ({
  type: "internship", title: `Native Platform Intern ${suffix}`, slug: `native-platform-intern-${suffix.toLowerCase()}-${marker}`,
  summary: "Build reliable systems in a bounded native hiring workflow.", description: "A Phase 9 native application verification role.",
  responsibilities: ["Ship tested improvements"], requirements: ["Structured TaskNexus profile"], workMode: "remote",
  employmentType: "full_time", applicationMode: "tasknexus", requiredSkillIds: [], preferredSkillIds: [],
});

const cleanup = async () => {
  const userIds = [...Object.values(ids), adminId].filter(Boolean);
  const users = trustedIn(userIds);
  const organizations = trustedIn(organizationIds);
  const opportunities = trustedIn(opportunityIds);
  const applications = await models.NativeApplication.find({ $or: mongoose.trusted([{ organization_id: organizations }, { candidate_id: users }]) }).select("_id").lean();
  await Promise.all([
    models.ApplicationActivity.deleteMany({ application_id: trustedIn(applications.map((row) => row._id)) }),
    models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: users }, { actor_id: users }, { entity_id: trustedIn(applications.map((row) => row._id)) }]) }),
    models.AuditLog.deleteMany({ $or: mongoose.trusted([{ user_id: users }, { resource_id: organizations }]) }),
  ]);
  await Promise.all([
    models.NativeApplication.deleteMany({ _id: trustedIn(applications.map((row) => row._id)) }),
    models.OpportunityCandidateState.deleteMany({ $or: mongoose.trusted([{ opportunity_id: opportunities }, { user_id: users }]) }),
    models.OrganizationInvitation.deleteMany({ organization_id: organizations }),
    models.OrganizationMembership.deleteMany({ organization_id: organizations }),
    models.ContributionEvidence.deleteMany({ project_id: trustedIn(projectIds) }),
    models.ProjectParticipant.deleteMany({ project_id: trustedIn(projectIds) }),
  ]);
  await models.Project.deleteMany({ _id: trustedIn(projectIds) });
  await models.TeamMembership.deleteMany({ team_id: trustedIn(teamIds) });
  await models.Team.deleteMany({ _id: trustedIn(teamIds) });
  await models.Opportunity.deleteMany({ _id: opportunities });
  await models.Organization.deleteMany({ _id: organizations });
  await Promise.all([models.UserSkill.deleteMany({ user_id: users }), models.UserEducation.deleteMany({ user_id: users }), models.UserProfile.deleteMany({ _id: users }), models.User.deleteMany({ _id: users })]);
};

const assertIndexed = (plan, label) => assert.match(JSON.stringify(plan.queryPlanner?.winningPlan || {}), /IXSCAN/, `${label} must use an index`);

const run = async () => {
  await connectDatabase();
  for (const Model of [models.Organization, models.OrganizationMembership, models.OrganizationInvitation, models.Opportunity, models.NativeApplication, models.ApplicationActivity]) await Model.syncIndexes();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  apiBase = `http://127.0.0.1:${server.address().port}/api`;
  try {
    await Promise.all(["owner", "recruiter", "nextowner", "reviewer", "candidate", "secondcandidate", "outsider"].map(register));
    adminId = randomUUID();
    await models.User.create({ _id: adminId, email: `phase9-${marker}-admin@example.invalid`, password: await bcrypt.hash(password, 4), role: "admin", profile: { firstName: "P9", lastName: "Admin" }, status: "active" });
    await models.UserProfile.create({ _id: adminId, username: `p9-admin-${marker}`, visibility: "private", availability: "unavailable" });
    tokens.admin = generateAccessToken(adminId, "admin");

    const organization = await createOrganization("Labs");
    const grant = await call(`/admin/organizations/${organization.id}/grant-management`, { method: "POST", token: tokens.admin, body: { ownerUserId: ids.owner, revision: organization.revision } });
    assert.equal(grant.status, 200, JSON.stringify(grant.payload));
    assert.equal(await models.OrganizationMembership.countDocuments({ organization_id: organization.id, role: "owner", status: "active" }), 1);
    assert.equal((await call(`/organizations/${organization.id}/workspace`, { token: tokens.outsider })).status, 403, "Outsider workspace access must be denied");

    const invitationRace = await Promise.all([
      call(`/organizations/${organization.id}/invitations`, { method: "POST", token: tokens.owner, body: { userId: ids.recruiter, role: "recruiter" } }),
      call(`/organizations/${organization.id}/invitations`, { method: "POST", token: tokens.owner, body: { userId: ids.recruiter, role: "recruiter" } }),
    ]);
    assert.equal(invitationRace.filter((result) => result.status === 201).length, 1, "Duplicate invitation race must have one winner");
    const invitation = invitationRace.find((result) => result.status === 201).payload.data;
    const acceptRace = await Promise.all([
      call(`/organization-invitations/${invitation.id}/accept`, { method: "POST", token: tokens.recruiter }),
      call(`/organization-invitations/${invitation.id}/accept`, { method: "POST", token: tokens.recruiter }),
    ]);
    assert.equal(acceptRace.filter((result) => result.status === 200).length, 1, "Duplicate acceptance race must have one winner");
    assert.equal(await models.OrganizationMembership.countDocuments({ organization_id: organization.id, user_id: ids.recruiter, status: "active" }), 1, "Duplicate acceptance must create one membership");
    await inviteAndAccept(organization.id, tokens.owner, "nextowner", "admin");
    await inviteAndAccept(organization.id, tokens.owner, "reviewer", "recruiter");
    assert.equal((await call(`/organizations/${organization.id}/invitations`, { method: "POST", token: tokens.reviewer, body: { userId: ids.outsider, role: "recruiter" } })).status, 403, "Recruiters must not invite members");

    const transferRace = await Promise.all([
      call(`/organizations/${organization.id}/transfer-ownership`, { method: "POST", token: tokens.owner, body: { userId: ids.recruiter } }),
      call(`/organizations/${organization.id}/transfer-ownership`, { method: "POST", token: tokens.owner, body: { userId: ids.nextowner } }),
    ]);
    assert.equal(transferRace.filter((result) => result.status === 200).length, 1, "Competing ownership transfers must have one winner");
    const managedOrganization = await models.Organization.findById(organization.id).lean();
    assert.ok([ids.recruiter, ids.nextowner].includes(managedOrganization.owner_id));
    assert.equal(await models.OrganizationMembership.countDocuments({ organization_id: organization.id, role: "owner", status: "active" }), 1, "Exactly one active owner must remain");
    assert.equal((await call(`/organizations/${organization.id}/transfer-ownership`, { method: "POST", token: tokens.reviewer, body: { userId: ids.owner } })).status, 403, "Recruiter self-escalation must be denied");

    const teamId = randomUUID(); const projectId = randomUUID(); teamIds.push(teamId); projectIds.push(projectId);
    await models.Team.create({ _id: teamId, name: `Phase 9 Evidence ${marker}`, slug: `phase9-evidence-${marker}`, created_by: ids.candidate, owner_id: ids.candidate, visibility: "private", join_policy: "invite_only", status: "active" });
    await models.TeamMembership.create({ _id: randomUUID(), team_id: teamId, user_id: ids.candidate, role: "owner", status: "active" });
    await models.Project.create({ _id: projectId, team_id: teamId, name: "Evidence-backed public Project", slug: `evidence-project-${marker}`, tagline: "A consent-safe Project snapshot fixture.", status: "completed", visibility: "public", created_by: ids.candidate, completed_at: new Date(), repository_url: "https://github.com/octocat/Hello-World" });
    await models.ProjectParticipant.create({ _id: randomUUID(), team_id: teamId, project_id: projectId, user_id: ids.candidate, role: "lead", status: "active", show_on_profile: true });
    await models.ContributionEvidence.create({ _id: randomUUID(), team_id: teamId, project_id: projectId, user_id: ids.candidate, created_by: ids.candidate, evidence_type: "project_participation", verification_level: "internal_verified", status: "active", origin: "system", title: "Verified Project participation", source_key: `phase9:${marker}:project`, occurred_at: new Date(), public_safe: true });

    const draft = await call(`/organizations/${organization.id}/opportunities`, { method: "POST", token: tokens.reviewer, body: nativeOpportunityBody("Main") });
    assert.equal(draft.status, 201, JSON.stringify(draft.payload)); opportunityIds.push(draft.payload.data.id);
    assert.equal(draft.payload.data.application_mode, "tasknexus"); assert.equal(draft.payload.data.source.type, "organization_owned");
    const published = await call(`/organizations/${organization.id}/opportunities/${draft.payload.data.id}/publish`, { method: "POST", token: tokens.reviewer, body: { revision: draft.payload.data.revision } });
    assert.equal(published.status, 200, JSON.stringify(published.payload));

    const applicationRace = await Promise.all([
      call(`/opportunities/${draft.payload.data.id}/applications`, { method: "POST", token: tokens.candidate, body: { coverNote: "A bounded plain-text application.", selectedProjectIds: [projectId], consent: true } }),
      call(`/opportunities/${draft.payload.data.id}/applications`, { method: "POST", token: tokens.candidate, body: { coverNote: "A duplicate submission.", selectedProjectIds: [projectId], consent: true } }),
    ]);
    assert.equal(applicationRace.filter((result) => result.status === 201).length, 1, "Duplicate native application race must have one winner");
    const application = applicationRace.find((result) => result.status === 201).payload.data;
    assert.equal(await models.NativeApplication.countDocuments({ opportunity_id: draft.payload.data.id, candidate_id: ids.candidate }), 1);
    const recruiterDetail = await call(`/organizations/${organization.id}/applications/${application.id}`, { token: tokens.reviewer });
    assert.equal(recruiterDetail.status, 200, JSON.stringify(recruiterDetail.payload));
    const detailText = JSON.stringify(recruiterDetail.payload.data);
    assert.equal(detailText.includes(`phase9-${marker}-candidate@example.invalid`), false, "Recruiter DTO must exclude email");
    assert.equal(detailText.includes("phone"), false, "Recruiter DTO must exclude phone");
    assert.equal(recruiterDetail.payload.data.candidate.projects.length, 1, "Consented public Project snapshot must be included");
    assert.equal(recruiterDetail.payload.data.candidate.evidence.length, 1, "Public-safe evidence snapshot must be included");

    const stageRace = await Promise.all([
      call(`/native-applications/${application.id}/stage`, { method: "POST", token: tokens.reviewer, body: { stage: "reviewing", revision: application.revision } }),
      call(`/native-applications/${application.id}/stage`, { method: "POST", token: tokens.reviewer, body: { stage: "rejected", revision: application.revision } }),
    ]);
    assert.equal(stageRace.filter((result) => result.status === 200).length, 1, "Competing stage writes must have one CAS winner");

    const secondDraft = await call(`/organizations/${organization.id}/opportunities`, { method: "POST", token: tokens.reviewer, body: nativeOpportunityBody("Withdraw") });
    assert.equal(secondDraft.status, 201, JSON.stringify(secondDraft.payload)); opportunityIds.push(secondDraft.payload.data.id);
    const secondPublished = await call(`/organizations/${organization.id}/opportunities/${secondDraft.payload.data.id}/publish`, { method: "POST", token: tokens.reviewer, body: { revision: secondDraft.payload.data.revision } });
    assert.equal(secondPublished.status, 200, JSON.stringify(secondPublished.payload));
    const secondApplication = await call(`/opportunities/${secondDraft.payload.data.id}/applications`, { method: "POST", token: tokens.secondcandidate, body: { consent: true } });
    assert.equal(secondApplication.status, 201, JSON.stringify(secondApplication.payload));
    const withdrawStageRace = await Promise.all([
      call(`/native-applications/${secondApplication.payload.data.id}/withdraw`, { method: "POST", token: tokens.secondcandidate, body: { revision: secondApplication.payload.data.revision } }),
      call(`/native-applications/${secondApplication.payload.data.id}/stage`, { method: "POST", token: tokens.reviewer, body: { stage: "reviewing", revision: secondApplication.payload.data.revision } }),
    ]);
    assert.equal(withdrawStageRace.filter((result) => result.status === 200).length, 1, "Withdrawal versus stage update must have one CAS winner");
    const finalSecond = await models.NativeApplication.findById(secondApplication.payload.data.id).lean();
    assert.ok(["withdrawn", "reviewing"].includes(finalSecond.stage), "Application must end in one deterministic state");

    const external = await call("/admin/opportunities", { method: "POST", token: tokens.admin, body: { organizationId: organization.id, type: "internship", title: "External Verification Role", slug: `external-verification-${marker}`, workMode: "remote", applicationUrl: "https://example.com/apply", sourceType: "external" } });
    assert.equal(external.status, 201, JSON.stringify(external.payload)); opportunityIds.push(external.payload.data.id);
    const externalPublished = await call(`/admin/opportunities/${external.payload.data.id}/publish`, { method: "POST", token: tokens.admin, body: { revision: external.payload.data.revision } });
    assert.equal(externalPublished.status, 200, JSON.stringify(externalPublished.payload));
    assert.equal((await call(`/opportunities/${external.payload.data.id}/applications`, { method: "POST", token: tokens.outsider, body: { consent: true } })).status, 400, "External Opportunity must reject native application submission");

    const otherOrganization = await createOrganization("Other");
    const otherGrant = await call(`/admin/organizations/${otherOrganization.id}/grant-management`, { method: "POST", token: tokens.admin, body: { ownerUserId: ids.outsider, revision: otherOrganization.revision } });
    assert.equal(otherGrant.status, 200, JSON.stringify(otherGrant.payload));
    assert.equal((await call(`/organizations/${otherOrganization.id}/applications/${application.id}`, { token: tokens.outsider })).status, 404, "Organization A application must be invisible in Organization B workspace");

    const plans = await Promise.all([
      models.OrganizationMembership.find({ organization_id: organization.id, status: "active" }).sort({ role: 1, joined_at: 1 }).explain("queryPlanner"),
      models.Opportunity.find({ organization_id: organization.id, status: "published" }).sort({ published_at: -1 }).explain("queryPlanner"),
      models.NativeApplication.find({ organization_id: organization.id, stage: "submitted" }).sort({ submitted_at: -1 }).explain("queryPlanner"),
      models.NativeApplication.find({ opportunity_id: draft.payload.data.id, stage: "submitted" }).sort({ submitted_at: -1 }).explain("queryPlanner"),
      models.NativeApplication.find({ candidate_id: ids.candidate, stage: finalSecond.stage }).sort({ submitted_at: -1 }).explain("queryPlanner"),
      models.ApplicationActivity.find({ application_id: application.id }).sort({ created_at: 1 }).explain("queryPlanner"),
    ]);
    ["members", "opportunities", "organization applicants", "opportunity applicants", "candidate applications", "activity"].forEach((label, index) => assertIndexed(plans[index], label));
    process.stdout.write("Phase 9 Organization verification passed: contextual RBAC, admin-controlled ownership, one-owner invariant, invitation/membership/transfer races, Organization-owned Opportunities, native consent and privacy, duplicate submission, stage/withdraw CAS, cross-Organization IDOR, indexes, and Atlas query plans.\n");
  } finally { await cleanup(); }
};

run().catch((error) => { process.stderr.write(`Phase 9 Organization verification failed: ${error.stack || error.message}\n`); process.exitCode = 1; }).finally(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await disconnectDatabase(); });
