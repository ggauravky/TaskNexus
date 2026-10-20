require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();
process.env.EMAIL_ENABLED = "false";

const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const { generateAccessToken } = require("../src/config/jwt");
const models = require("../src/models");

const runId = randomUUID();
const marker = runId.slice(0, 8);
const password = `Tn-PhaseE-${randomBytes(18).toString("base64url")}9aA!`;
const ids = Object.fromEntries([
  "candidateA", "candidateB", "outsider", "recruiterA", "recruiterB", "admin",
  "skill", "sameNameSkill", "team", "privateTeam", "project", "sameNameProject",
  "privateProject", "showcase", "sameNameShowcase", "privateShowcase", "organizationA",
  "organizationB", "opportunity", "membershipA", "membershipB",
].map((key) => [key, randomUUID()]));
const evidenceIds = [randomUUID(), randomUUID(), randomUUID()];
const hiddenEvidenceIds = [randomUUID(), randomUUID(), randomUUID()];
const tokens = {};
let applicationId = null;
let server;
let apiBase;

const trustedIn = (values) => mongoose.trusted({ $in: values });

const call = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch (_error) { payload = { text }; }
  return { status: response.status, payload };
};

const createUser = async (label, role = "freelancer") => {
  const id = ids[label];
  tokens[label] = generateAccessToken(id, role);
  await models.User.create({
    _id: id,
    email: `phase-e-${marker}-${label.toLowerCase()}@example.invalid`,
    password: await bcrypt.hash(password, 6),
    role,
    profile: { firstName: "Phase E", lastName: label },
    status: "active",
  });
  await models.UserProfile.create({
    _id: id,
    username: `phase-e-${marker}-${label.toLowerCase()}`,
    headline: `${label} proof fixture`,
    visibility: role === "admin" ? "private" : "public",
    availability: "open",
    discoverable: role !== "admin",
  });
};

const cleanup = async () => {
  const userIds = [ids.candidateA, ids.candidateB, ids.outsider, ids.recruiterA, ids.recruiterB, ids.admin];
  const projectIds = [ids.project, ids.sameNameProject, ids.privateProject];
  const teamIds = [ids.team, ids.privateTeam];
  const organizationIds = [ids.organizationA, ids.organizationB];
  const opportunityIds = [ids.opportunity];
  const applications = applicationId ? [applicationId] : [];
  await Promise.all([
    models.ApplicationActivity.deleteMany({ application_id: trustedIn(applications) }),
    models.Notification.deleteMany({ $or: mongoose.trusted([
      { recipient_id: trustedIn(userIds) },
      { actor_id: trustedIn(userIds) },
      { entity_id: trustedIn([...applications, ...projectIds, ...opportunityIds]) },
    ]) }),
    models.AuditLog.deleteMany({ $or: mongoose.trusted([
      { user_id: trustedIn(userIds) },
      { resource_id: trustedIn([...organizationIds, ...applications]) },
    ]) }),
  ]);
  await Promise.all([
    models.NativeApplication.deleteMany({ $or: mongoose.trusted([
      { _id: trustedIn(applications) },
      { candidate_id: trustedIn(userIds), opportunity_id: trustedIn(opportunityIds) },
    ]) }),
    models.OpportunityCandidateState.deleteMany({ opportunity_id: trustedIn(opportunityIds) }),
    models.OrganizationMembership.deleteMany({ organization_id: trustedIn(organizationIds) }),
    models.ProjectShowcase.deleteMany({ _id: trustedIn([ids.showcase, ids.sameNameShowcase, ids.privateShowcase]) }),
    models.ContributionEvidence.deleteMany({ project_id: trustedIn(projectIds) }),
    models.ProjectParticipant.deleteMany({ project_id: trustedIn(projectIds) }),
    models.TeamMembership.deleteMany({ team_id: trustedIn(teamIds) }),
    models.UserSkill.deleteMany({ user_id: trustedIn(userIds) }),
  ]);
  await Promise.all([
    models.Opportunity.deleteMany({ _id: trustedIn(opportunityIds) }),
    models.Organization.deleteMany({ _id: trustedIn(organizationIds) }),
    models.Project.deleteMany({ _id: trustedIn(projectIds) }),
    models.Team.deleteMany({ _id: trustedIn(teamIds) }),
    models.Skill.deleteMany({ _id: trustedIn([ids.skill, ids.sameNameSkill]) }),
    models.UserProfile.deleteMany({ _id: trustedIn(userIds) }),
    models.User.deleteMany({ _id: trustedIn(userIds) }),
  ]);
};

const seed = async () => {
  await cleanup();
  await Promise.all([
    createUser("candidateA"), createUser("candidateB"), createUser("outsider"),
    createUser("recruiterA"), createUser("recruiterB"), createUser("admin", "admin"),
  ]);
  await models.Skill.insertMany([
    { _id: ids.skill, slug: `phase-e-systems-${marker}`, name: "Reliable Systems", normalized_name: "reliable systems", category: "quality", is_active: true },
    { _id: ids.sameNameSkill, slug: `phase-e-systems-other-${marker}`, name: "Reliable Systems", normalized_name: `reliable systems other ${marker}`, category: "quality", is_active: true },
  ]);
  await models.UserSkill.create({ _id: randomUUID(), user_id: ids.candidateA, skill_id: ids.skill, proficiency: "advanced", is_primary: true });
  await models.Team.insertMany([
    { _id: ids.team, name: `Phase E Public ${marker}`, slug: `phase-e-public-${marker}`, created_by: ids.candidateA, owner_id: ids.candidateA, visibility: "public", join_policy: "invite_only", status: "active" },
    { _id: ids.privateTeam, name: `Phase E Private ${marker}`, slug: `phase-e-private-${marker}`, created_by: ids.candidateA, owner_id: ids.candidateA, visibility: "private", join_policy: "invite_only", status: "active" },
  ]);
  await models.TeamMembership.insertMany([
    { _id: randomUUID(), team_id: ids.team, user_id: ids.candidateA, role: "owner", status: "active" },
    { _id: randomUUID(), team_id: ids.privateTeam, user_id: ids.candidateA, role: "owner", status: "active" },
  ]);
  await models.Project.insertMany([
    { _id: ids.project, team_id: ids.team, name: "Canonical proof Project", slug: `canonical-proof-${marker}`, tagline: "Factual public proof", status: "completed", visibility: "public", skill_ids: [ids.skill], created_by: ids.candidateA, completed_at: new Date("2026-10-01T00:00:00.000Z") },
    { _id: ids.sameNameProject, team_id: ids.team, name: "Same-name different-ID Project", slug: `same-name-proof-${marker}`, status: "completed", visibility: "public", skill_ids: [ids.sameNameSkill], created_by: ids.candidateA, completed_at: new Date("2026-09-01T00:00:00.000Z") },
    { _id: ids.privateProject, team_id: ids.privateTeam, name: "Private ancestry Project", slug: `private-proof-${marker}`, status: "completed", visibility: "public", skill_ids: [ids.skill], created_by: ids.candidateA, completed_at: new Date("2026-08-01T00:00:00.000Z") },
  ]);
  await models.ProjectParticipant.insertMany([
    { _id: randomUUID(), team_id: ids.team, project_id: ids.project, user_id: ids.candidateA, role: "lead", status: "active", show_on_profile: true },
    { _id: randomUUID(), team_id: ids.team, project_id: ids.sameNameProject, user_id: ids.candidateA, role: "contributor", status: "active", show_on_profile: true },
    { _id: randomUUID(), team_id: ids.privateTeam, project_id: ids.privateProject, user_id: ids.candidateA, role: "contributor", status: "active", show_on_profile: true },
  ]);
  await models.ProjectShowcase.insertMany([
    { _id: ids.showcase, team_id: ids.team, project_id: ids.project, status: "published", headline: "Canonical factual proof", created_by: ids.candidateA, updated_by: ids.candidateA, published_at: new Date() },
    { _id: ids.sameNameShowcase, team_id: ids.team, project_id: ids.sameNameProject, status: "published", headline: "Same-name control", created_by: ids.candidateA, updated_by: ids.candidateA, published_at: new Date() },
    { _id: ids.privateShowcase, team_id: ids.privateTeam, project_id: ids.privateProject, status: "published", headline: "Hidden by Team ancestry", created_by: ids.candidateA, updated_by: ids.candidateA, published_at: new Date() },
  ]);
  await models.ContributionEvidence.insertMany([
    { _id: evidenceIds[0], team_id: ids.team, project_id: ids.project, user_id: ids.candidateA, created_by: ids.candidateA, evidence_type: "project_participation", verification_level: "internal_verified", status: "active", origin: "system", title: "Internal verified fixture", source_key: `phase-e:${marker}:internal`, occurred_at: new Date("2026-10-03T00:00:00.000Z"), public_safe: true },
    { _id: evidenceIds[1], team_id: ids.team, project_id: ids.project, user_id: ids.candidateA, created_by: ids.candidateA, evidence_type: "github_pull_request", verification_level: "external_verified", status: "active", origin: "user", title: "External verified fixture", source_key: `phase-e:${marker}:external`, source_url: "https://github.com/octocat/Hello-World/pull/1347", occurred_at: new Date("2026-10-02T00:00:00.000Z"), public_safe: true },
    { _id: evidenceIds[2], team_id: ids.team, project_id: ids.project, user_id: ids.candidateA, created_by: ids.candidateA, evidence_type: "external_link", verification_level: "unverified", status: "active", origin: "user", title: "Unverified public fixture", source_key: `phase-e:${marker}:unverified`, occurred_at: new Date("2026-10-01T00:00:00.000Z"), public_safe: true },
    { _id: hiddenEvidenceIds[0], team_id: ids.team, project_id: ids.project, user_id: ids.candidateA, created_by: ids.candidateA, evidence_type: "external_link", verification_level: "unverified", status: "active", origin: "user", title: "Not public safe", source_key: `phase-e:${marker}:unsafe`, occurred_at: new Date(), public_safe: false },
    { _id: hiddenEvidenceIds[1], team_id: ids.team, project_id: ids.project, user_id: ids.candidateA, created_by: ids.candidateA, evidence_type: "external_link", verification_level: "unverified", status: "revoked", origin: "user", title: "Revoked fixture", source_key: `phase-e:${marker}:revoked`, occurred_at: new Date(), public_safe: true },
    { _id: hiddenEvidenceIds[2], team_id: ids.team, project_id: ids.project, user_id: ids.candidateB, created_by: ids.candidateB, evidence_type: "external_link", verification_level: "unverified", status: "active", origin: "user", title: "Other candidate fixture", source_key: `phase-e:${marker}:other`, occurred_at: new Date(), public_safe: true },
    { _id: randomUUID(), team_id: ids.team, project_id: ids.sameNameProject, user_id: ids.candidateA, created_by: ids.candidateA, evidence_type: "project_participation", verification_level: "internal_verified", status: "active", origin: "system", title: "Same-name skill control", source_key: `phase-e:${marker}:same-name`, occurred_at: new Date(), public_safe: true },
    { _id: randomUUID(), team_id: ids.privateTeam, project_id: ids.privateProject, user_id: ids.candidateA, created_by: ids.candidateA, evidence_type: "project_participation", verification_level: "internal_verified", status: "active", origin: "system", title: "Private ancestry control", source_key: `phase-e:${marker}:private`, occurred_at: new Date(), public_safe: true },
  ]);
  await models.Organization.insertMany([
    { _id: ids.organizationA, name: `Phase E Organization A ${marker}`, slug: `phase-e-org-a-${marker}`, organization_type: "startup", status: "active", management_mode: "organization_managed", owner_id: ids.recruiterA, created_by: ids.admin },
    { _id: ids.organizationB, name: `Phase E Organization B ${marker}`, slug: `phase-e-org-b-${marker}`, organization_type: "startup", status: "active", management_mode: "organization_managed", owner_id: ids.recruiterB, created_by: ids.admin },
  ]);
  await models.OrganizationMembership.insertMany([
    { _id: ids.membershipA, organization_id: ids.organizationA, user_id: ids.recruiterA, role: "owner", status: "active" },
    { _id: ids.membershipB, organization_id: ids.organizationB, user_id: ids.recruiterB, role: "owner", status: "active" },
  ]);
  await models.Opportunity.create({
    _id: ids.opportunity,
    organization_id: ids.organizationA,
    type: "internship",
    title: "Phase E Proof Opportunity",
    slug: `phase-e-proof-opportunity-${marker}`,
    summary: "Canonical skill overlap without opaque scoring.",
    description: "Disposable Phase E verification fixture.",
    responsibilities: ["Inspect factual proof"],
    requirements: ["Canonical Reliable Systems skill"],
    work_mode: "remote",
    application_mode: "tasknexus",
    required_skill_ids: [ids.skill],
    preferred_skill_ids: [],
    status: "published",
    source_type: "organization_owned",
    source_published_at: new Date(),
    last_verified_at: new Date(),
    published_at: new Date(),
    created_by: ids.recruiterA,
  });
};

const assertIndexedAndBounded = (plan, label, maxDocs, maxReturned) => {
  const winningPlan = JSON.stringify(plan.queryPlanner?.winningPlan || {});
  assert.match(winningPlan, /IXSCAN/, `${label} must use an index`);
  assert.doesNotMatch(winningPlan, /COLLSCAN/, `${label} must not use a collection scan`);
  assert.ok(plan.executionStats.totalDocsExamined <= maxDocs, `${label} examined too many documents`);
  assert.ok(plan.executionStats.nReturned <= maxReturned, `${label} returned an unbounded result`);
};

const verifyQueryPlans = async () => {
  for (const Model of [models.ProjectParticipant, models.ContributionEvidence, models.ProjectShowcase, models.UserSkill]) {
    await Model.syncIndexes();
  }
  const plans = await Promise.all([
    models.ProjectParticipant.find({ user_id: ids.candidateA, status: "active", show_on_profile: true }).select("project_id team_id role show_on_profile updated_at").sort({ updated_at: -1, _id: 1 }).limit(100).explain("executionStats"),
    models.ContributionEvidence.find({ user_id: ids.candidateA, status: "active", public_safe: true, project_id: trustedIn([ids.project, ids.sameNameProject]) }).select("project_id evidence_type verification_level title source_url occurred_at").sort({ occurred_at: -1, _id: 1 }).limit(25).explain("executionStats"),
    models.ProjectShowcase.find({ project_id: trustedIn([ids.project, ids.sameNameProject]), status: "published" }).select("project_id status published_at").limit(12).explain("executionStats"),
    models.UserSkill.find({ user_id: ids.candidateA }).select("skill_id is_primary created_at").sort({ is_primary: -1, created_at: 1, _id: 1 }).limit(20).explain("executionStats"),
    models.Project.find({ _id: trustedIn([ids.project, ids.sameNameProject]), status: "completed", visibility: "public" }).select("team_id skill_ids").limit(12).explain("executionStats"),
    models.Team.find({ _id: trustedIn([ids.team]), status: "active", visibility: "public" }).select("slug name").limit(12).explain("executionStats"),
  ]);
  const checks = [
    ["participant candidates", 100, 100], ["public evidence", 25, 25], ["published showcases", 12, 12],
    ["profile skills", 20, 20], ["eligible Projects", 12, 12], ["public Team ancestry", 12, 12],
  ];
  checks.forEach(([label, maxDocs, maxReturned], index) => assertIndexedAndBounded(plans[index], label, maxDocs, maxReturned));
};

const run = async () => {
  await connectDatabase();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  apiBase = `http://127.0.0.1:${server.address().port}/api`;
  try {
    await seed();

    const profilePath = `/public/profiles/phase-e-${marker}-candidatea`;
    let profile = await call(profilePath);
    assert.equal(profile.status, 200, JSON.stringify(profile.payload));
    assert.equal(profile.payload.data.proof_connections.length, 1);
    assert.equal(profile.payload.data.proof_connections[0].skill.id, ids.skill, "skill connections must use canonical IDs");
    assert.deepEqual(profile.payload.data.proof_connections[0].projects.map((item) => item.id), [ids.project]);
    assert.deepEqual(profile.payload.data.proof_connections[0].projects[0].evidence_summary, {
      total: 3, internal_verified: 1, external_verified: 1, unverified: 1,
    });
    const publicText = JSON.stringify(profile.payload.data.proof_connections);
    assert.equal(publicText.includes(ids.privateProject), false);
    assert.equal(publicText.includes(ids.sameNameProject), false);
    assert.equal(publicText.includes("Not public safe"), false);
    assert.equal(publicText.includes("Other candidate fixture"), false);

    await models.ProjectParticipant.updateOne({ project_id: ids.project, user_id: ids.candidateA }, { $set: { show_on_profile: false } });
    profile = await call(profilePath);
    assert.equal(profile.status, 200);
    assert.equal(profile.payload.data.proof_connections.length, 0, "profile opt-out must remove the connection");
    await models.ProjectParticipant.updateOne({ project_id: ids.project, user_id: ids.candidateA }, { $set: { show_on_profile: true } });
    await models.UserProfile.updateOne({ _id: ids.candidateA }, { $set: { visibility: "private" } });
    assert.equal((await call(profilePath)).status, 404, "private profiles must remain undiscoverable");
    await models.UserProfile.updateOne({ _id: ids.candidateA }, { $set: { visibility: "public" } });

    const opportunityPath = `/opportunities/phase-e-proof-opportunity-${marker}`;
    const anonymous = await call(opportunityPath);
    assert.equal(anonymous.status, 200, JSON.stringify(anonymous.payload));
    assert.equal(Object.hasOwn(anonymous.payload.data, "relevant_proof"), false, "anonymous detail must not receive candidate proof");
    const candidateA = await call(opportunityPath, { token: tokens.candidateA });
    assert.equal(candidateA.status, 200, JSON.stringify(candidateA.payload));
    assert.equal(candidateA.payload.data.relevant_proof.project_count, 1);
    assert.equal(candidateA.payload.data.relevant_proof.required_skills[0].skill.id, ids.skill);
    assert.deepEqual(candidateA.payload.data.relevant_proof.required_skills[0].projects.map((item) => item.id), [ids.project]);
    const candidateBInjected = await call(`${opportunityPath}?candidateId=${ids.candidateA}`, { token: tokens.candidateB });
    assert.equal(candidateBInjected.payload.data.relevant_proof.project_count, 0, "candidate ID injection must not cross identities");
    for (const token of [tokens.outsider, tokens.recruiterA, tokens.recruiterB, tokens.admin]) {
      const selfOnly = await call(opportunityPath, { token });
      assert.equal(selfOnly.status, 200);
      assert.equal(selfOnly.payload.data.relevant_proof.project_count, 0, "other roles must receive only their own proof context");
    }

    const eligible = await call("/native-applications/eligible-projects", { token: tokens.candidateA });
    assert.equal(eligible.status, 200, JSON.stringify(eligible.payload));
    assert.equal(eligible.payload.data.some((item) => item.id === ids.privateProject), false, "private Team ancestry must be excluded");
    const canonicalEligible = eligible.payload.data.find((item) => item.id === ids.project);
    assert.ok(canonicalEligible);
    assert.deepEqual(canonicalEligible.evidence.map((item) => item.id), evidenceIds);

    const rejectedEvidence = await call(`/opportunities/${ids.opportunity}/applications`, {
      method: "POST", token: tokens.candidateA,
      body: { selectedProjectIds: [ids.project], selectedEvidenceIds: [hiddenEvidenceIds[0]], consent: true },
    });
    assert.equal(rejectedEvidence.status, 403, "non-public-safe evidence must be rejected by the backend");
    const submitted = await call(`/opportunities/${ids.opportunity}/applications`, {
      method: "POST", token: tokens.candidateA,
      body: { coverNote: "Exact Phase E proof selection.", selectedProjectIds: [ids.project], selectedEvidenceIds: [evidenceIds[0], evidenceIds[1]], consent: true },
    });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.payload));
    applicationId = submitted.payload.data.id;
    const storedBefore = await models.NativeApplication.findById(applicationId).select("submitted_profile_snapshot").lean();
    const immutableSnapshot = JSON.stringify(storedBefore.submitted_profile_snapshot);
    assert.deepEqual(storedBefore.submitted_profile_snapshot.evidence.map((item) => item.id).sort(), [evidenceIds[0], evidenceIds[1]].sort());
    assert.equal((await call(`/native-applications/${applicationId}`, { token: tokens.candidateB })).status, 404, "another candidate must not read the snapshot");
    assert.equal((await call(`/organizations/${ids.organizationB}/applications/${applicationId}`, { token: tokens.recruiterB })).status, 404, "another Organization must not read the snapshot");
    assert.equal((await call(`/organizations/${ids.organizationA}/applications/${applicationId}`, { token: tokens.outsider })).status, 403, "an outsider must not read applicants");
    assert.equal((await call(`/organizations/${ids.organizationA}/applications/${applicationId}`, { token: tokens.admin })).status, 403, "platform admin must not gain implicit applicant proof access");
    const recruiterDetail = await call(`/organizations/${ids.organizationA}/applications/${applicationId}`, { token: tokens.recruiterA });
    assert.equal(recruiterDetail.status, 200, JSON.stringify(recruiterDetail.payload));
    assert.deepEqual(recruiterDetail.payload.data.candidate.evidence.map((item) => item.id).sort(), [evidenceIds[0], evidenceIds[1]].sort());

    await models.UserProfile.updateOne({ _id: ids.candidateA }, { $set: { visibility: "private", headline: "Changed after submission" } });
    await models.Team.updateOne({ _id: ids.team }, { $set: { visibility: "private" } });
    await models.Project.updateOne({ _id: ids.project }, { $set: { visibility: "team" } });
    await models.ContributionEvidence.updateMany({ _id: trustedIn(evidenceIds) }, { $set: { status: "revoked", revoked_at: new Date() } });
    const storedAfter = await models.NativeApplication.findById(applicationId).select("submitted_profile_snapshot").lean();
    assert.equal(JSON.stringify(storedAfter.submitted_profile_snapshot), immutableSnapshot, "submitted snapshots must remain byte-stable");

    await models.UserProfile.updateOne({ _id: ids.candidateA }, { $set: { visibility: "public" } });
    await models.Team.updateOne({ _id: ids.team }, { $set: { visibility: "public" } });
    await models.Project.updateOne({ _id: ids.project }, { $set: { visibility: "public" } });
    await models.ContributionEvidence.updateMany({ _id: trustedIn(evidenceIds) }, { $set: { status: "active" }, $unset: { revoked_at: "" } });
    await verifyQueryPlans();

    const marketplaceImports = [require.resolve("../src/services/professionalProofService"), require.resolve("../src/serializers/proofSerializers")]
      .map((file) => require("node:fs").readFileSync(file, "utf8")).join("\n");
    assert.doesNotMatch(marketplaceImports, /\bTask\b|project_tasks/, "Phase E proof must not cross marketplace Task and ProjectTask domains");
    process.stdout.write("Phase E integration passed: canonical proof, privacy/IDOR, exact immutable snapshots, bounded indexed queries, and marketplace separation.\n");
  } finally {
    await cleanup();
  }
};

run().catch((error) => {
  process.stderr.write(`Phase E integration failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
}).finally(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDatabase();
});
