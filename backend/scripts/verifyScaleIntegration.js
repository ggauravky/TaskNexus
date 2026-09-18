require("../src/config/loadEnv");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const CONFIRMATION = "--confirm-phase11-synthetic-scale";
const TARGET_DATABASE = "tasknexus_v2_performance";
const counts = {
  users: 10000,
  user_profiles: 10000,
  teams: 2000,
  projects: 3000,
  project_tasks: 15000,
  contribution_evidence: 50000,
  notifications: 50000,
  hackathons: 500,
  opportunities: 3000,
  opportunity_candidate_states: 20000,
  native_applications: 20000,
  project_participants: 100,
  organizations: 1,
  organization_memberships: 1,
};

const assertSafeTarget = () => {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  if (appEnv === "production" || process.env.NODE_ENV === "production") {
    throw new Error("Synthetic scale verification refuses production mode");
  }
  if (!process.argv.includes(CONFIRMATION)) {
    throw new Error(`Explicit scale confirmation is required: ${CONFIRMATION}`);
  }
};

const insertGenerated = async (collection, count, create, batchSize = 1000) => {
  for (let offset = 0; offset < count; offset += batchSize) {
    const size = Math.min(batchSize, count - offset);
    const documents = Array.from({ length: size }, (_, index) => create(offset + index));
    await collection.insertMany(documents, { ordered: false });
  }
};

const indexName = (node) => {
  if (!node || typeof node !== "object") return null;
  if (node.indexName) return node.indexName;
  for (const value of Object.values(node)) {
    const found = indexName(value);
    if (found) return found;
  }
  return null;
};

const percentile = (values, fraction) => values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];

const measureQuery = async (db, definition) => {
  const collection = db.collection(definition.collection);
  const cursor = () => collection.find(definition.filter).sort(definition.sort).limit(50);
  await cursor().toArray();
  const durations = [];
  for (let index = 0; index < 12; index += 1) {
    const started = process.hrtime.bigint();
    await cursor().toArray();
    durations.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  durations.sort((left, right) => left - right);
  const plan = await cursor().explain("executionStats");
  const stats = plan.executionStats || {};
  return {
    name: definition.name,
    collection: definition.collection,
    index: indexName(stats.executionStages) || "none",
    returned: stats.nReturned ?? null,
    documentsExamined: stats.totalDocsExamined ?? null,
    keysExamined: stats.totalKeysExamined ?? null,
    executionTimeMs: stats.executionTimeMillis ?? null,
    p50Ms: Number(percentile(durations, 0.5).toFixed(3)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(3)),
    samples: durations.length,
  };
};

const measureEndpoint = async (apiBase, definition) => {
  const durations = [];
  let errors = 0;
  for (let index = 0; index < 12; index += 1) {
    const started = process.hrtime.bigint();
    const response = await fetch(`${apiBase}${definition.path}`, {
      method: definition.method || "GET",
      headers: {
        ...(definition.token ? { Authorization: `Bearer ${definition.token}` } : {}),
        ...(definition.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(definition.body ? { body: JSON.stringify(definition.body) } : {}),
    });
    await response.arrayBuffer();
    durations.push(Number(process.hrtime.bigint() - started) / 1e6);
    if (!response.ok) errors += 1;
  }
  durations.sort((left, right) => left - right);
  return {
    name: definition.name,
    method: definition.method || "GET",
    path: definition.path,
    samples: durations.length,
    p50Ms: Number(percentile(durations, 0.5).toFixed(3)),
    p95Ms: Number(percentile(durations, 0.95).toFixed(3)),
    errorRate: errors / durations.length,
  };
};

const run = async () => {
  assertSafeTarget();
  process.env.APP_ENV = "staging";
  process.env.MONGODB_DB_NAME = TARGET_DATABASE;
  let connected = false;
  let server;
  let result;
  const startedAt = new Date();
  try {
    await connectDatabase();
    connected = true;
    const db = mongoose.connection.db;
    await db.dropDatabase();

    for (const name of [
      "User", "UserProfile", "Team", "Project", "ProjectTask", "ContributionEvidence",
      "Notification", "Hackathon", "Opportunity", "OpportunityCandidateState", "NativeApplication",
      "ProjectParticipant", "OrganizationMembership",
    ]) {
      await models[name].createIndexes();
    }

    const now = Date.now();
    const users = Array.from({ length: counts.users }, () => randomUUID());
    const teams = Array.from({ length: counts.teams }, () => randomUUID());
    const projects = Array.from({ length: counts.projects }, () => randomUUID());
    const hackathons = Array.from({ length: counts.hackathons }, () => randomUUID());
    const opportunities = Array.from({ length: counts.opportunities }, () => randomUUID());
    const organizationId = randomUUID();

    await insertGenerated(db.collection("users"), counts.users, (index) => ({
      _id: users[index], email: `phase11-scale-${index}@example.invalid`, password: "synthetic-no-login",
      role: index % 10 === 0 ? "client" : "freelancer", status: "active",
      profile: { firstName: "Synthetic", lastName: `User ${index}` },
      created_at: new Date(now - index * 1000), updated_at: new Date(now - index * 1000),
    }));
    const performancePassword = `Phase11-${randomUUID()}-Aa1!`;
    await db.collection("users").updateOne(
      { _id: users[0] },
      { $set: { password: await bcrypt.hash(performancePassword, 6), role: "client" } },
    );
    await insertGenerated(db.collection("user_profiles"), counts.user_profiles, (index) => ({
      _id: users[index], username: `phase11-scale-${index}`, headline: "Synthetic launch-scale profile",
      visibility: "public", discoverable: true, availability: index % 4 ? "open" : "limited",
      preferred_roles: [index % 2 ? "backend_developer" : "frontend_developer"], interests: ["open_source"],
      created_at: new Date(now - index * 1000), updated_at: new Date(now - index * 1000),
    }));
    await insertGenerated(db.collection("teams"), counts.teams, (index) => ({
      _id: teams[index], name: `Synthetic Team ${index}`, slug: `phase11-scale-team-${index}`,
      created_by: users[index], owner_id: users[index], visibility: "public", join_policy: "open",
      status: "active", created_at: new Date(now - index * 2000), updated_at: new Date(now - index * 2000),
    }));
    await insertGenerated(db.collection("projects"), counts.projects, (index) => ({
      _id: projects[index], team_id: teams[index % teams.length], name: `Synthetic Project ${index}`,
      slug: `phase11-scale-project-${index}`, status: index % 3 ? "active" : "completed", visibility: "public",
      created_by: users[index % users.length], created_at: new Date(now - index * 3000), updated_at: new Date(now - index * 3000),
    }));
    await insertGenerated(db.collection("project_participants"), counts.project_participants, (index) => ({
      _id: randomUUID(), team_id: teams[index % teams.length], project_id: projects[index],
      user_id: users[0], role: index === 0 ? "lead" : "contributor", status: "active",
      show_on_profile: true, joined_at: new Date(now - index * 1000), created_at: new Date(), updated_at: new Date(),
    }));
    await insertGenerated(db.collection("project_tasks"), counts.project_tasks, (index) => ({
      _id: randomUUID(), team_id: teams[index % teams.length], project_id: projects[index % projects.length],
      title: `Synthetic Task ${index}`, status: index % 2 ? "todo" : "done", position: index % 20,
      assignee_ids: [users[index % users.length]], created_by: users[index % users.length],
      created_at: new Date(now - index * 500), updated_at: new Date(now - index * 500),
    }));
    await insertGenerated(db.collection("contribution_evidence"), counts.contribution_evidence, (index) => ({
      _id: randomUUID(), team_id: teams[index % teams.length], project_id: projects[index % projects.length],
      user_id: users[index % users.length], created_by: users[index % users.length],
      evidence_type: "project_participation", verification_level: "internal_verified", status: "active",
      origin: "system", title: `Synthetic Evidence ${index}`, source_key: `phase11-scale:${index}`,
      occurred_at: new Date(now - index * 250), public_safe: true,
    }));
    await insertGenerated(db.collection("notifications"), counts.notifications, (index) => ({
      _id: randomUUID(), recipient_id: users[index % users.length], type: "task_assigned",
      title: "Synthetic notification", message: "Synthetic scale-test data", status: index % 3 ? "unread" : "read",
      priority: "medium", created_at: new Date(now - index * 200), updated_at: new Date(now - index * 200),
    }));
    await insertGenerated(db.collection("hackathons"), counts.hackathons, (index) => ({
      _id: hackathons[index], name: `Synthetic Hackathon ${index}`, slug: `phase11-scale-hackathon-${index}`,
      organizer_name: "Synthetic Organizer", mode: "online", status: "registration_open", visibility: "public",
      event_start: new Date(now + (index + 30) * 86400000), event_end: new Date(now + (index + 32) * 86400000),
      registration_deadline: new Date(now + (index + 20) * 86400000), created_by: users[0],
      created_at: new Date(now - index * 1000), updated_at: new Date(now - index * 1000),
    }));
    await db.collection("organizations").insertOne({
      _id: organizationId, name: "Synthetic Organization", slug: "phase11-scale-organization",
      organization_type: "startup", status: "active", created_by: users[0], created_at: new Date(), updated_at: new Date(),
    });
    await db.collection("organization_memberships").insertOne({
      _id: randomUUID(), organization_id: organizationId, user_id: users[2], role: "recruiter",
      status: "active", joined_at: new Date(), created_at: new Date(), updated_at: new Date(),
    });
    await insertGenerated(db.collection("opportunities"), counts.opportunities, (index) => ({
      _id: opportunities[index], organization_id: organizationId, type: "internship",
      title: `Synthetic Opportunity ${index}`, slug: `phase11-scale-opportunity-${index}`,
      summary: "Synthetic performance fixture", description: "Synthetic performance fixture only.",
      work_mode: "remote", application_mode: "tasknexus", source_type: "organization_owned",
      status: "published", published_at: new Date(now - index * 1000), created_by: users[0],
      created_at: new Date(now - index * 1000), updated_at: new Date(now - index * 1000),
    }));
    await insertGenerated(db.collection("opportunity_candidate_states"), counts.opportunity_candidate_states, (index) => ({
      _id: randomUUID(), opportunity_id: opportunities[index % opportunities.length], user_id: users[index % users.length],
      saved: index % 2 === 0, application_status: index % 3 ? "applied" : "interested", source: "user_tracked",
      created_at: new Date(now - index * 500), updated_at: new Date(now - index * 500),
    }));
    await insertGenerated(db.collection("native_applications"), counts.native_applications, (index) => ({
      _id: randomUUID(), opportunity_id: opportunities[index % opportunities.length], organization_id: organizationId,
      candidate_id: users[index % users.length], stage: index % 4 ? "submitted" : "reviewing",
      submitted_profile_snapshot: { display_name: `Synthetic User ${index % users.length}`, headline: "Synthetic applicant" },
      submitted_at: new Date(now - index * 500), created_at: new Date(now - index * 500), updated_at: new Date(now - index * 500),
    }));

    const definitions = [
      { name: "People discovery", collection: "user_profiles", filter: { discoverable: true, visibility: "public", availability: "open" }, sort: { updated_at: -1 } },
      { name: "Team listing", collection: "teams", filter: { visibility: "public", status: "active" }, sort: { created_at: -1 } },
      { name: "Project task listing", collection: "project_tasks", filter: { project_id: projects[1], status: "todo" }, sort: { updated_at: -1 } },
      { name: "Contribution history", collection: "contribution_evidence", filter: { user_id: users[0], status: "active" }, sort: { occurred_at: -1 } },
      { name: "Hackathon discovery", collection: "hackathons", filter: { visibility: "public", status: "registration_open" }, sort: { event_start: 1 } },
      { name: "Opportunity feed", collection: "opportunities", filter: { type: "internship", status: "published" }, sort: { published_at: -1 } },
      { name: "Eligibility state", collection: "opportunity_candidate_states", filter: { user_id: users[0], opportunity_id: opportunities[0] }, sort: { updated_at: -1 } },
      { name: "Candidate applications", collection: "native_applications", filter: { candidate_id: users[1], stage: "submitted" }, sort: { submitted_at: -1 } },
      { name: "Recruiter applicant list", collection: "native_applications", filter: { organization_id: organizationId, stage: "submitted" }, sort: { submitted_at: -1 } },
      { name: "Notifications", collection: "notifications", filter: { recipient_id: users[0], status: "unread" }, sort: { created_at: -1 } },
    ];
    const queries = [];
    for (const definition of definitions) queries.push(await measureQuery(db, definition));

    process.env.EMAIL_DELIVERY_MODE = "disabled";
    process.env.RATE_LIMIT_MAX_REQUESTS = "10000";
    const app = require("../src/app");
    const { generateAccessToken } = require("../src/config/jwt");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const apiBase = `http://127.0.0.1:${server.address().port}`;
    const clientToken = generateAccessToken(users[0], "client");
    const recruiterToken = generateAccessToken(users[2], "freelancer");
    const endpoints = [];
    for (const definition of [
      { name: "Login", method: "POST", path: "/api/auth/login", body: { email: "phase11-scale-0@example.invalid", password: performancePassword } },
      { name: "People", path: "/api/people?limit=50", token: clientToken },
      { name: "Projects", path: "/api/projects?limit=20", token: clientToken },
      { name: "Opportunities", path: "/api/opportunities?limit=20", token: clientToken },
      { name: "Applications", path: "/api/applications?limit=20", token: clientToken },
      { name: "Recruiter applicants", path: `/api/organizations/${organizationId}/applications?limit=20`, token: recruiterToken },
    ]) endpoints.push(await measureEndpoint(apiBase, definition));
    await new Promise((resolve) => server.close(resolve));
    server = null;

    result = {
      environment: "synthetic non-production",
      database: TARGET_DATABASE,
      startedAt: startedAt.toISOString(),
      dataset: counts,
      queries,
      endpoints,
    };
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connected && mongoose.connection.db?.databaseName === TARGET_DATABASE) {
      await mongoose.connection.db.dropDatabase();
    }
    await disconnectDatabase();
  }

  const completedAt = new Date();
  result.completedAt = completedAt.toISOString();
  result.durationSeconds = Number(((completedAt - startedAt) / 1000).toFixed(3));
  result.cleanup = "completed before evidence was written";
  const output = path.resolve(__dirname, "../../artifacts/phase11-scale-results.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
};

run().catch((error) => {
  process.stderr.write(`Synthetic scale verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
