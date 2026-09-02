const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "../sql/migrations");
const names = fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

if (new Set(names).size !== names.length) {
  throw new Error("Migration filenames must be unique");
}

names.forEach((name) => {
  if (!/^\d{8}_[a-z0-9_]+\.sql$/.test(name)) {
    throw new Error(`Invalid migration filename: ${name}`);
  }
  const sql = fs.readFileSync(path.join(migrationsDir, name), "utf8").trim();
  if (!sql) throw new Error(`Migration is empty: ${name}`);
});

const phase1 = fs.readFileSync(
  path.join(migrationsDir, "20260902_phase1_architecture_stabilization.sql"),
  "utf8",
);
[
  "FUNCTION accept_task",
  "FUNCTION submit_task_work",
  "ENABLE ROW LEVEL SECURITY",
  "CREATE TABLE IF NOT EXISTS task_comments",
  "CREATE TABLE IF NOT EXISTS task_milestones",
  "CREATE TABLE IF NOT EXISTS task_activity",
].forEach((required) => {
  if (!phase1.includes(required)) throw new Error(`Phase 1 migration is missing: ${required}`);
});

process.stdout.write(`Validated ${names.length} ordered SQL migrations.\n`);
