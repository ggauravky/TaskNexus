require("../src/config/loadEnv");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const password = "TaskNexus-QA-2026!";
const labels = ["candidateA", "candidateB", "candidateC"];
const emails = {
  candidateA: "phase8-candidate-a@example.invalid",
  candidateB: "phase8-candidate-b@example.invalid",
  candidateC: "phase8-candidate-c@example.invalid",
  admin: "phase8-admin@example.invalid",
};
const organizationSlugs = ["phase8-qa-organization-a", "phase8-qa-organization-b"];
const opportunitySlugs = [
  "phase8-qa-internship-full-stack",
  "phase8-qa-internship-ai",
  "phase8-qa-entry-level-backend",
  "phase8-qa-closed-opportunity",
];
const trustedIn = (values) => mongoose.trusted({ $in: values });
let server;
let apiBase;

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
  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}: ${payload.error?.message || "Unknown error"}`);
  return payload.data;
};

const cleanup = async () => {
  const users = await models.User.find({ email: trustedIn(Object.values(emails)) }).select("_id").lean();
  const userIds = users.map((row) => String(row._id));
  const organizations = await models.Organization.find({ slug: trustedIn(organizationSlugs) }).select("_id").lean();
  const organizationIds = organizations.map((row) => String(row._id));
  const opportunities = await models.Opportunity.find({
    $or: mongoose.trusted([
      { slug: trustedIn(opportunitySlugs) },
      { organization_id: trustedIn(organizationIds) },
    ]),
  }).select("_id").lean();
  const opportunityIds = opportunities.map((row) => String(row._id));

  await Promise.all([
    models.OpportunityCandidateState.deleteMany({
      $or: mongoose.trusted([
        { opportunity_id: trustedIn(opportunityIds) },
        { user_id: trustedIn(userIds) },
      ]),
    }),
    models.UserSkill.deleteMany({ user_id: trustedIn(userIds) }),
    models.UserEducation.deleteMany({ user_id: trustedIn(userIds) }),
    models.AuditLog.deleteMany({ user_id: trustedIn(userIds) }),
  ]);
  await models.Opportunity.deleteMany({ _id: trustedIn(opportunityIds) });
  await models.Organization.deleteMany({ _id: trustedIn(organizationIds) });
  await models.UserProfile.deleteMany({ _id: trustedIn(userIds) });
  await models.User.deleteMany({ _id: trustedIn(userIds) });
};

const register = async (label, firstName, lastName, profile) => {
  const data = await call("/auth/register", {
    method: "POST",
    body: { email: emails[label], password, role: "freelancer", profile: { firstName, lastName } },
  });
  await call("/profile", { method: "PUT", token: data.accessToken, body: profile });
  return { id: data.user.id, token: data.accessToken };
};

const opportunityBody = ({ organizationId, title, slug, type = "internship", skillIds, eligibility, workMode = "hybrid" }) => ({
  organizationId,
  type,
  title,
  slug,
  summary: "A controlled TaskNexus Opportunity used only for Phase 8 browser acceptance.",
  description: "Review deterministic eligibility, save the role, open the official source, and track the external application privately.",
  responsibilities: ["Build a tested product increment", "Document decisions and outcomes"],
  requirements: ["Early-career applicant", "Evidence of practical project work"],
  workMode,
  locations: [{ city: "Bengaluru", country: "India", display: "Bengaluru, India" }],
  employmentType: "full_time",
  duration: type === "internship" ? "6 months" : "Permanent",
  compensation: { minAmount: 40000, maxAmount: 65000, currency: "INR", period: "month" },
  applicationUrl: `https://careers.example.com/${slug}`,
  applicationDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
  requiredSkillIds: skillIds,
  preferredSkillIds: [],
  eligibility,
  sourceType: "official",
  sourceUrl: "https://careers.example.com",
  sourcePublishedAt: new Date().toISOString(),
});

const createPublishedOpportunity = async (token, body, close = false) => {
  const draft = await call("/admin/opportunities", { method: "POST", token, body });
  const published = await call(`/admin/opportunities/${draft.id}/publish`, {
    method: "POST",
    token,
    body: { revision: draft.revision },
  });
  if (!close) return published;
  return call(`/admin/opportunities/${published.id}/close`, {
    method: "POST",
    token,
    body: { revision: published.revision },
  });
};

const setup = async () => {
  await cleanup();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  apiBase = `http://127.0.0.1:${server.address().port}/api`;

  const [candidateA, candidateB, candidateC] = await Promise.all([
    register("candidateA", "Asha", "Candidate", { username: "phase8-candidate-a", headline: "Full-stack student developer", location: "Bengaluru, India", visibility: "public", availability: "open", discoverable: true }),
    register("candidateB", "Bina", "Candidate", { username: "phase8-candidate-b", headline: "Machine-learning graduate", location: "Pune, India", visibility: "public", availability: "limited", discoverable: true }),
    register("candidateC", "Chetan", "Candidate", { username: "phase8-candidate-c", location: "India", visibility: "private", availability: "unavailable", discoverable: false }),
  ]);

  const skills = await models.Skill.find({ slug: trustedIn(["react", "node-js", "mongodb", "python", "machine-learning"]) }).lean();
  const skill = new Map(skills.map((row) => [row.slug, String(row._id)]));
  for (const required of ["react", "node-js", "mongodb", "python", "machine-learning"]) {
    if (!skill.has(required)) throw new Error(`Seeded skill is missing: ${required}`);
  }
  await models.UserSkill.insertMany([
    ...["react", "node-js", "mongodb"].map((slug, index) => ({ _id: randomUUID(), user_id: candidateA.id, skill_id: skill.get(slug), proficiency: index ? "intermediate" : "advanced", is_primary: index === 0 })),
    ...["python", "machine-learning"].map((slug, index) => ({ _id: randomUUID(), user_id: candidateB.id, skill_id: skill.get(slug), proficiency: "advanced", is_primary: index === 0 })),
  ]);
  await models.UserEducation.insertMany([
    { _id: randomUUID(), user_id: candidateA.id, institution: "QA Institute of Technology", degree_course: "BCA", field_of_study: "Computer Applications", start_year: 2024, end_year: 2027 },
    { _id: randomUUID(), user_id: candidateB.id, institution: "QA Engineering University", degree_course: "B.Tech", field_of_study: "Artificial Intelligence", start_year: 2022, end_year: 2026 },
  ]);

  const adminId = randomUUID();
  await models.User.create({ _id: adminId, email: emails.admin, password: await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 12), role: "admin", profile: { firstName: "Phase 8", lastName: "Admin" }, status: "active" });
  await models.UserProfile.create({ _id: adminId, username: "phase8-admin", visibility: "private", availability: "unavailable" });
  const adminLogin = await call("/auth/login", { method: "POST", body: { email: emails.admin, password } });

  const organizationA = await call("/admin/organizations", { method: "POST", token: adminLogin.accessToken, body: { name: "QA Organization A", slug: organizationSlugs[0], organizationType: "startup", tagline: "Developer tools for dependable teams.", description: "Disposable Organization A for Phase 8 browser acceptance.", websiteUrl: "https://example.com/qa-a", industry: "Developer tools", headquarters: { city: "Bengaluru", country: "India" } } });
  const organizationB = await call("/admin/organizations", { method: "POST", token: adminLogin.accessToken, body: { name: "QA Organization B", slug: organizationSlugs[1], organizationType: "company", tagline: "Applied AI for practical products.", description: "Disposable Organization B for Phase 8 browser acceptance.", websiteUrl: "https://example.com/qa-b", industry: "Artificial intelligence", headquarters: { city: "Pune", country: "India" } } });
  for (const organization of [organizationA, organizationB]) {
    await call(`/admin/organizations/${organization.id}/verify`, { method: "POST", token: adminLogin.accessToken, body: { revision: organization.revision } });
  }

  const commonYears = { graduationYearMin: 2026, graduationYearMax: 2028, allowedCountries: ["India"], finalYearAllowed: true, freshersAllowed: true };
  await Promise.all([
    createPublishedOpportunity(adminLogin.accessToken, opportunityBody({ organizationId: organizationA.id, title: "QA Internship — Full Stack", slug: opportunitySlugs[0], skillIds: [skill.get("react"), skill.get("node-js")], eligibility: { ...commonYears, eligibleDegrees: ["BCA"], eligibleFields: ["Computer Applications"] } })),
    createPublishedOpportunity(adminLogin.accessToken, opportunityBody({ organizationId: organizationB.id, title: "QA Internship — AI", slug: opportunitySlugs[1], skillIds: [skill.get("python"), skill.get("machine-learning")], eligibility: { ...commonYears, eligibleDegrees: ["B.Tech"], eligibleFields: ["Artificial Intelligence"] }, workMode: "remote" })),
    createPublishedOpportunity(adminLogin.accessToken, opportunityBody({ organizationId: organizationA.id, title: "QA Entry-Level Job — Backend", slug: opportunitySlugs[2], type: "entry_level_job", skillIds: [skill.get("node-js"), skill.get("mongodb")], eligibility: { ...commonYears, eligibleDegrees: ["BCA", "B.Tech"], eligibleFields: ["Computer Applications", "Computer Science"] }, workMode: "onsite" })),
    createPublishedOpportunity(adminLogin.accessToken, opportunityBody({ organizationId: organizationB.id, title: "QA Closed Opportunity", slug: opportunitySlugs[3], skillIds: [skill.get("python")], eligibility: { ...commonYears, eligibleDegrees: ["B.Tech"], eligibleFields: ["Artificial Intelligence"] } }), true),
  ]);

  process.stdout.write(JSON.stringify({
    urls: { hub: "http://localhost:5174/opportunities", applications: "http://localhost:5174/applications" },
    credentials: Object.fromEntries([...labels, "admin"].map((label) => [label, { email: emails[label], password }])),
    candidates: { candidateA: candidateA.id, candidateB: candidateB.id, candidateC: candidateC.id },
  }, null, 2));
};

const run = async () => {
  await connectDatabase();
  try {
    if (process.argv[2] === "cleanup") {
      await cleanup();
      process.stdout.write("Phase 8 browser fixture cleaned.\n");
    } else {
      await setup();
    }
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDatabase();
  }
};

run().catch((error) => {
  process.stderr.write(`Phase 8 browser fixture failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
