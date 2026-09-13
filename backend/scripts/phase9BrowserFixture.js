require("../src/config/loadEnv");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const app = require("../src/app");
const { connectDatabase, databaseName, disconnectDatabase } = require("../src/config/database");
const { generateAccessToken } = require("../src/config/jwt");
const models = require("../src/models");

const CONFIRMATION = "--confirm-tasknexus-v2-staging";
const password = `Tn-QA-${randomBytes(18).toString("base64url")}9aA!`;
const emails = {
  admin: "phase9-browser-admin@example.invalid",
  owner: "phase9-browser-owner@example.invalid",
  recruiter: "phase9-browser-recruiter@example.invalid",
  organizationAdmin: "phase9-browser-org-admin@example.invalid",
  candidate: "phase9-browser-candidate@example.invalid",
  outsider: "phase9-browser-outsider@example.invalid",
};
const organizationSlugs = ["phase9-browser-labs", "phase9-browser-other"];
const opportunitySlugs = ["phase9-browser-external-role"];
const teamSlug = "phase9-browser-evidence-team";
const projectSlug = "phase9-browser-evidence-project";
const usernames = { admin: "p9-browser-admin", owner: "p9-browser-owner", recruiter: "p9-browser-recruiter", organizationAdmin: "p9-browser-org-admin", candidate: "p9-browser-candidate", outsider: "p9-browser-outsider" };
const trustedIn = (values) => mongoose.trusted({ $in: values });
let server;
let apiBase;

const assertSafeTarget = () => {
  if (process.env.NODE_ENV === "production") throw new Error("QA fixtures are disabled when NODE_ENV=production");
  if (databaseName() !== "tasknexus_v2") throw new Error("Phase 9 browser fixtures are restricted to the tasknexus_v2 staging database");
  if (!process.argv.includes(CONFIRMATION)) throw new Error(`Explicit staging confirmation is required: ${CONFIRMATION}`);
};

const call = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}: ${payload.error?.message || "Unknown error"}`);
  return payload.data;
};

const cleanup = async () => {
  const users = await models.User.find({ email: trustedIn(Object.values(emails)) }).select("_id").lean();
  const userIds = users.map((row) => String(row._id));
  const organizations = await models.Organization.find({ slug: trustedIn(organizationSlugs) }).select("_id").lean();
  const organizationIds = organizations.map((row) => String(row._id));
  const opportunities = await models.Opportunity.find({
    $or: mongoose.trusted([{ slug: trustedIn(opportunitySlugs) }, { organization_id: trustedIn(organizationIds) }]),
  }).select("_id").lean();
  const opportunityIds = opportunities.map((row) => String(row._id));
  const applications = await models.NativeApplication.find({
    $or: mongoose.trusted([{ organization_id: trustedIn(organizationIds) }, { candidate_id: trustedIn(userIds) }]),
  }).select("_id").lean();
  const applicationIds = applications.map((row) => String(row._id));
  const teams = await models.Team.find({ slug: teamSlug }).select("_id").lean();
  const teamIds = teams.map((row) => String(row._id));
  const projects = await models.Project.find({ $or: mongoose.trusted([{ slug: projectSlug }, { team_id: trustedIn(teamIds) }]) }).select("_id").lean();
  const projectIds = projects.map((row) => String(row._id));

  await Promise.all([
    models.ApplicationActivity.deleteMany({ application_id: trustedIn(applicationIds) }),
    models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: trustedIn(userIds) }, { actor_id: trustedIn(userIds) }, { entity_id: trustedIn([...applicationIds, ...organizationIds, ...opportunityIds]) }]) }),
    models.AuditLog.deleteMany({ $or: mongoose.trusted([{ user_id: trustedIn(userIds) }, { resource_id: trustedIn([...applicationIds, ...organizationIds, ...opportunityIds, ...projectIds, ...teamIds]) }]) }),
    models.OpportunityCandidateState.deleteMany({ $or: mongoose.trusted([{ opportunity_id: trustedIn(opportunityIds) }, { user_id: trustedIn(userIds) }]) }),
    models.OrganizationInvitation.deleteMany({ organization_id: trustedIn(organizationIds) }),
    models.OrganizationMembership.deleteMany({ organization_id: trustedIn(organizationIds) }),
    models.ContributionEvidence.deleteMany({ project_id: trustedIn(projectIds) }),
    models.ProjectParticipant.deleteMany({ project_id: trustedIn(projectIds) }),
    models.TeamMembership.deleteMany({ team_id: trustedIn(teamIds) }),
  ]);
  await models.NativeApplication.deleteMany({ _id: trustedIn(applicationIds) });
  await models.Project.deleteMany({ _id: trustedIn(projectIds) });
  await models.Team.deleteMany({ _id: trustedIn(teamIds) });
  await models.Opportunity.deleteMany({ _id: trustedIn(opportunityIds) });
  await models.Organization.deleteMany({ _id: trustedIn(organizationIds) });
  await Promise.all([
    models.UserSkill.deleteMany({ user_id: trustedIn(userIds) }),
    models.UserEducation.deleteMany({ user_id: trustedIn(userIds) }),
    models.UserProfile.deleteMany({ _id: trustedIn(userIds) }),
    models.User.deleteMany({ _id: trustedIn(userIds) }),
  ]);
};

const createUser = async (label, role = "freelancer") => {
  const id = randomUUID();
  await models.User.create({
    _id: id,
    email: emails[label],
    password: await bcrypt.hash(password, 6),
    role,
    profile: { firstName: label === "organizationAdmin" ? "Organization" : "Phase 9", lastName: label === "organizationAdmin" ? "Admin" : label },
    status: "active",
  });
  await models.UserProfile.create({
    _id: id,
    username: usernames[label],
    headline: `${label} browser acceptance account`,
    location: "Bengaluru, India",
    visibility: label === "admin" ? "private" : "public",
    availability: label === "admin" ? "unavailable" : "open",
    discoverable: label !== "admin",
  });
  return { id, token: generateAccessToken(id, role) };
};

const createOrganization = async (token, name, slug) => call("/admin/organizations", {
  method: "POST",
  token,
  body: {
    name,
    slug,
    organizationType: "startup",
    tagline: "Disposable recruiter browser acceptance workspace",
    description: "Temporary Organization used only for Phase 9 authenticated browser QA.",
    websiteUrl: "https://example.com",
    industry: "Developer tools",
    headquarters: { city: "Bengaluru", country: "India" },
  },
});

const setup = async () => {
  await cleanup();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  apiBase = `http://127.0.0.1:${server.address().port}/api`;

  const accounts = {};
  for (const label of Object.keys(emails)) accounts[label] = await createUser(label, label === "admin" ? "admin" : "freelancer");

  const organization = await createOrganization(accounts.admin.token, "Phase 9 Browser Labs", organizationSlugs[0]);
  await call(`/admin/organizations/${organization.id}/grant-management`, {
    method: "POST",
    token: accounts.admin.token,
    body: { ownerUserId: accounts.owner.id, revision: organization.revision },
  });
  const otherOrganization = await createOrganization(accounts.admin.token, "Phase 9 Browser Other", organizationSlugs[1]);
  await call(`/admin/organizations/${otherOrganization.id}/grant-management`, {
    method: "POST",
    token: accounts.admin.token,
    body: { ownerUserId: accounts.outsider.id, revision: otherOrganization.revision },
  });

  const skills = await models.Skill.find({ is_active: true }).sort({ name: 1 }).limit(2).lean();
  if (!skills.length) throw new Error("At least one seeded Skill is required for the browser fixture");
  await models.UserSkill.insertMany(skills.map((skill, index) => ({
    _id: randomUUID(), user_id: accounts.candidate.id, skill_id: String(skill._id), proficiency: index ? "intermediate" : "advanced", is_primary: index === 0,
  })));
  await models.UserEducation.create({
    _id: randomUUID(), user_id: accounts.candidate.id, institution: "TaskNexus QA Institute", degree_course: "B.Tech",
    field_of_study: "Computer Science", start_year: 2023, end_year: 2027,
  });

  const teamId = randomUUID();
  const projectId = randomUUID();
  await models.Team.create({
    _id: teamId, name: "Phase 9 Browser Evidence Team", slug: teamSlug, created_by: accounts.candidate.id,
    owner_id: accounts.candidate.id, visibility: "private", join_policy: "invite_only", status: "active",
  });
  await models.TeamMembership.create({ _id: randomUUID(), team_id: teamId, user_id: accounts.candidate.id, role: "owner", status: "active" });
  await models.Project.create({
    _id: projectId, team_id: teamId, name: "Phase 9 Evidence-backed Project", slug: projectSlug,
    tagline: "A public completed Project for native application consent QA.", status: "completed", visibility: "public",
    created_by: accounts.candidate.id, completed_at: new Date(), repository_url: "https://github.com/octocat/Hello-World",
  });
  await models.ProjectParticipant.create({ _id: randomUUID(), team_id: teamId, project_id: projectId, user_id: accounts.candidate.id, role: "lead", status: "active", show_on_profile: true });
  await models.ContributionEvidence.create({
    _id: randomUUID(), team_id: teamId, project_id: projectId, user_id: accounts.candidate.id, created_by: accounts.candidate.id,
    evidence_type: "project_participation", verification_level: "internal_verified", status: "active", origin: "system",
    title: "Verified browser QA Project participation", source_key: "phase9-browser:project", occurred_at: new Date(), public_safe: true,
  });

  const external = await call("/admin/opportunities", {
    method: "POST",
    token: accounts.admin.token,
    body: {
      organizationId: organization.id,
      type: "internship",
      title: "Phase 9 External Career Regression",
      slug: opportunitySlugs[0],
      summary: "Disposable external Opportunity for Phase 8 regression browser QA.",
      description: "This role keeps external application tracking separate from native applications.",
      workMode: "remote",
      applicationUrl: "https://example.com/apply",
      sourceType: "external",
      sourceUrl: "https://example.com",
    },
  });
  await call(`/admin/opportunities/${external.id}/publish`, { method: "POST", token: accounts.admin.token, body: { revision: external.revision } });

  process.stdout.write(JSON.stringify({
    database: databaseName(),
    urls: {
      organization: `http://localhost:5174/organizations/${organizationSlugs[0]}`,
      workspace: `http://localhost:5174/organizations/${organizationSlugs[0]}/workspace`,
      invitations: "http://localhost:5174/organization-invitations",
      opportunities: "http://localhost:5174/opportunities",
      applications: "http://localhost:5174/applications",
    },
    credentials: Object.fromEntries(Object.keys(emails).map((label) => [label, { email: emails[label], password }])),
  }, null, 2));
};

const run = async () => {
  await connectDatabase();
  try {
    assertSafeTarget();
    if (process.argv[2] === "cleanup") {
      await cleanup();
      process.stdout.write("Phase 9 browser fixture cleaned.\n");
    } else if (process.argv[2] === "setup") {
      await setup();
    } else {
      throw new Error(`Use setup or cleanup with ${CONFIRMATION}`);
    }
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
};

run().catch((error) => {
  process.stderr.write(`Phase 9 browser fixture failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
