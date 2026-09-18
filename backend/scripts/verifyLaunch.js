const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath));
const checks = [];
const check = (name, callback) => {
  callback();
  checks.push(name);
};

check("Phase 11 operating documents", () => {
  for (const filename of [
    "LAUNCH_BLOCKERS.md",
    "PRIVACY_OPERATIONS.md",
    "MONITORING_RUNBOOK.md",
    "PHASE11_COMPLETION_REPORT.md",
  ]) {
    assert.ok(fs.existsSync(path.join(root, "docs", filename)), `Missing docs/${filename}`);
  }
});

check("external monitoring configuration contract", () => {
  const config = readJson("ops/monitoring-checks.example.json");
  assert.equal(config.version, 1);
  assert.ok(String(config.provider).trim());
  assert.ok(String(config.notificationChannel).trim());
  assert.deepEqual(config.checks.map((item) => item.name), [
    "frontend-availability",
    "backend-liveness",
    "backend-readiness",
  ]);
  for (const monitor of config.checks) {
    assert.match(monitor.url, /^https:\/\//);
    assert.ok(monitor.intervalSeconds >= 60 && monitor.intervalSeconds <= 300);
    assert.ok(monitor.failureThreshold >= 2);
  }
});

check("production-scale evidence", () => {
  const evidence = readJson("artifacts/phase11-scale-results.json");
  assert.equal(evidence.environment, "synthetic non-production");
  assert.equal(evidence.database, "tasknexus_v2_performance");
  assert.equal(evidence.cleanup, "completed before evidence was written");
  assert.ok(Object.values(evidence.dataset).reduce((sum, count) => sum + count, 0) >= 180000);
  assert.equal(evidence.queries.length, 10);
  for (const query of evidence.queries) {
    assert.notEqual(query.index, "COLLSCAN", `${query.name} used a collection scan`);
    assert.equal(query.documentsExamined, query.returned, `${query.name} examined excess documents`);
    assert.equal(query.keysExamined, query.returned, `${query.name} examined excess index keys`);
    assert.ok(Number.isFinite(query.p50Ms) && Number.isFinite(query.p95Ms));
  }
  assert.equal(evidence.endpoints.length, 6);
  for (const endpoint of evidence.endpoints) {
    assert.equal(endpoint.errorRate, 0, `${endpoint.name} returned errors`);
    assert.ok(Number.isFinite(endpoint.p50Ms) && Number.isFinite(endpoint.p95Ms));
  }
});

check("controlled production bootstrap", () => {
  const skills = read("backend/scripts/seedProductionSkills.js");
  assert.match(skills, /APP_ENV=production/);
  assert.match(skills, /--confirm-production-skill-seed/);
  assert.match(skills, /PRODUCTION_SEED_DB_NAME/);
  assert.match(skills, /bulkWrite/);

  const admin = read("backend/scripts/createAdmin.js");
  assert.match(admin, /--confirm-admin-provision/);
  assert.match(admin, /ADMIN_PROVISION_DB_NAME/);
  assert.match(admin, /PLATFORM_ADMIN_PROVISIONED/);
});

process.stdout.write(`Launch verification passed (${checks.length} checks): ${checks.join(", ")}\n`);
