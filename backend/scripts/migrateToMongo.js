/* Temporary cutover utility. Remove after the verified MongoDB migration. */
require("../src/config/loadEnv");
const { createClient } = require("@supabase/supabase-js");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");
const { profileFromLegacyUser } = require("../src/migration/legacyProfile");

const execute = process.argv.includes("--execute");
const BATCH_SIZE = 500;
const QA_EMAIL_SUFFIXES = ["@staging.invalid", "@example.invalid"];

const entities = [
  ["users", models.User],
  ["skills", models.Skill],
  ["user_profiles", models.UserProfile],
  ["user_skills", models.UserSkill],
  ["user_education", models.UserEducation],
  ["tasks", models.Task],
  ["submissions", models.Submission],
  ["payments", models.Payment],
  ["reviews", models.Review],
  ["notifications", models.Notification],
  ["task_comments", models.TaskComment],
  ["task_milestones", models.TaskMilestone],
  ["task_activity", models.TaskActivity],
  ["newsletter_subscriptions", models.NewsletterSubscription],
  ["service_bookings", models.ServiceBooking],
  ["support_jar_contributions", models.SupportContribution],
  ["audit_logs", models.AuditLog],
];

const sourceConfig = () => {
  const sources = [];
  if (process.env.SUPABASE_MAIN_URL && process.env.SUPABASE_MAIN_KEY) {
    sources.push(["main", process.env.SUPABASE_MAIN_URL, process.env.SUPABASE_MAIN_KEY]);
  }
  const stagingUrl = process.env.SUPABASE_STAGING_URL || process.env.SUPABASE_URL;
  const stagingKey = process.env.SUPABASE_STAGING_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (stagingUrl && stagingKey) sources.push(["staging", stagingUrl, stagingKey]);
  if (!sources.length) throw new Error("Temporary source database credentials are required");
  return sources;
};

const fetchRows = async (client, table) => {
  const rows = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await client.from(table).select("*").range(offset, offset + BATCH_SIZE - 1);
    if (error?.code === "42P01" || /does not exist/i.test(error?.message || "")) return { rows: [], absent: true };
    if (error) throw new Error(`Unable to read source table ${table} (${error.code || "source_error"})`);
    rows.push(...data);
    if (data.length < BATCH_SIZE) return { rows, absent: false };
  }
};

const modelFields = (Model) => new Set(Object.keys(Model.schema.paths).filter((key) => key !== "__v"));

const toDocument = (table, row, Model) => {
  const source = { ...row };
  if (table === "user_profiles") source._id = source.user_id;
  else if (table === "user_skills") source._id = `${source.user_id}:${source.skill_id}`;
  else source._id = source.id;
  delete source.id;
  delete source.user_id_original;
  if (table === "users") {
    source.email = String(source.email).trim().toLowerCase();
    source.refresh_token = null;
    source.password_reset_token = null;
    source.password_reset_expires = null;
  }
  if (table === "skills") source.normalized_name = String(source.name).trim().toLowerCase();
  const allowed = modelFields(Model);
  return Object.fromEntries(Object.entries(source).filter(([key]) => allowed.has(key)));
};

const isSyntheticQaUser = (row) => QA_EMAIL_SUFFIXES.some((suffix) => String(row.email || "").toLowerCase().endsWith(suffix));

const referencesExcluded = (table, row, excludedUsers, excludedTasks) => {
  const userFields = {
    user_profiles: ["user_id"], user_skills: ["user_id"], user_education: ["user_id"],
    tasks: ["client_id", "freelancer_id", "assigned_by_id"], submissions: ["freelancer_id"],
    payments: ["client_id", "freelancer_id"], reviews: ["reviewer_id", "reviewee_id"],
    notifications: ["recipient_id", "actor_id"], task_comments: ["author_id"],
    task_milestones: ["completed_by"], task_activity: ["actor_id"], audit_logs: ["user_id"],
  };
  if ((userFields[table] || []).some((field) => row[field] && excludedUsers.has(row[field]))) return true;
  const taskFields = {
    submissions: "task_id", payments: "task_id", reviews: "task_id", notifications: "related_task_id",
    task_comments: "task_id", task_milestones: "task_id", task_activity: "task_id",
  };
  return taskFields[table] && row[taskFields[table]] && excludedTasks.has(row[taskFields[table]]);
};

const rewriteReferences = (table, row, aliases) => {
  const result = { ...row };
  const userFields = {
    user_profiles: ["user_id"], user_skills: ["user_id"], user_education: ["user_id"],
    tasks: ["client_id", "freelancer_id", "assigned_by_id"], submissions: ["freelancer_id"],
    payments: ["client_id", "freelancer_id"], reviews: ["reviewer_id", "reviewee_id"],
    notifications: ["recipient_id", "actor_id"], task_comments: ["author_id"],
    task_milestones: ["completed_by"], task_activity: ["actor_id"], audit_logs: ["user_id"],
  };
  for (const field of userFields[table] || []) if (result[field]) result[field] = aliases.users.get(result[field]) || result[field];
  const taskFields = {
    submissions: "task_id", payments: "task_id", reviews: "task_id", notifications: "related_task_id",
    task_comments: "task_id", task_milestones: "task_id", task_activity: "task_id",
  };
  if (taskFields[table] && result[taskFields[table]]) result[taskFields[table]] = aliases.tasks.get(result[taskFields[table]]) || result[taskFields[table]];
  if (table === "user_skills" && result.skill_id) result.skill_id = aliases.skills.get(result.skill_id) || result.skill_id;
  if (table === "audit_logs" && result.resource_id) {
    if (result.resource === "user") result.resource_id = aliases.users.get(result.resource_id) || result.resource_id;
    if (result.resource === "task") result.resource_id = aliases.tasks.get(result.resource_id) || result.resource_id;
  }
  return result;
};

const isCrossSourceDuplicate = (table, row, seen, aliases) => {
  const definitions = {
    users: ["email", aliases.users], skills: ["slug", aliases.skills], tasks: ["task_id", aliases.tasks],
  };
  const definition = definitions[table];
  if (!definition) return false;
  const [field, aliasMap] = definition;
  const key = String(row[field] || "").trim().toLowerCase();
  const canonicalId = seen[table].get(key);
  if (!canonicalId) { seen[table].set(key, row.id); return false; }
  if (canonicalId === row.id) return false;
  aliasMap.set(row.id, canonicalId);
  return true;
};

const validateRows = async (table, Model, rows) => {
  let failed = 0;
  for (const row of rows) {
    try { await new Model(toDocument(table, row, Model)).validate(); } catch { failed += 1; }
  }
  return failed;
};

const importRows = async (table, Model, rows) => {
  if (!rows.length) return { migrated: 0, skipped: 0 };
  const result = await Model.bulkWrite(rows.map((row) => {
    const document = toDocument(table, row, Model);
    return { updateOne: { filter: { _id: document._id }, update: { $setOnInsert: document }, upsert: true } };
  }), { ordered: false });
  return { migrated: result.upsertedCount, skipped: result.matchedCount };
};

const backfillProfiles = async () => {
  const users = await models.User.find({}).select("+password").lean();
  let created = 0;
  for (const user of users) {
    const exists = await models.UserProfile.exists({ _id: user._id });
    if (!exists) {
      await models.UserProfile.create(profileFromLegacyUser({ ...user, id: user._id }));
      created += 1;
    }
  }
  return created;
};

const run = async () => {
  const summary = {};
  const aliases = { users: new Map(), tasks: new Map(), skills: new Map() };
  const seen = { users: new Map(), tasks: new Map(), skills: new Map() };
  if (execute) await connectDatabase();
  for (const [sourceName, url, key] of sourceConfig()) {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const excludedUsers = new Set();
    const excludedTasks = new Set();
    for (const [table, Model] of entities) {
      const { rows: fetched, absent } = await fetchRows(client, table);
      if (table === "users") fetched.filter(isSyntheticQaUser).forEach((row) => excludedUsers.add(row.id));
      if (table === "tasks") fetched.filter((row) => referencesExcluded(table, row, excludedUsers, excludedTasks)).forEach((row) => excludedTasks.add(row.id));
      const eligible = fetched.filter((row) => (
        table === "users" ? !excludedUsers.has(row.id) : !referencesExcluded(table, row, excludedUsers, excludedTasks)
      ));
      const rewritten = eligible.map((row) => rewriteReferences(table, row, aliases));
      const rows = rewritten.filter((row) => !isCrossSourceDuplicate(table, row, seen, aliases));
      const excluded = fetched.length - eligible.length;
      const deduplicated = rewritten.length - rows.length;
      const failed = await validateRows(table, Model, rows);
      if (failed) throw new Error(`${sourceName}.${table}: ${failed} rows failed Mongoose validation`);
      const result = execute ? await importRows(table, Model, rows) : { migrated: 0, skipped: rows.length };
      summary[`${sourceName}.${table}`] = {
        source: fetched.length, migrated: result.migrated, skipped: result.skipped + excluded + deduplicated,
        excluded, deduplicated, failed, absent,
      };
      process.stdout.write(`${sourceName}.${table}: source=${fetched.length} migrated=${result.migrated} skipped=${result.skipped + excluded + deduplicated} excluded=${excluded} deduplicated=${deduplicated} failed=${failed}\n`);
    }
  }
  if (execute) summary.profileBackfill = { migrated: await backfillProfiles() };
  process.stdout.write(`${execute ? "EXECUTE" : "DRY RUN"} complete. ${JSON.stringify(summary)}\n`);
};

run().catch((error) => {
  process.stderr.write(`Migration failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
