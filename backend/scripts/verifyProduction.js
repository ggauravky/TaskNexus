const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { validateEnvironment } = require("../src/config/environment");
const models = require("../src/models");

const root = path.resolve(__dirname, "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const checks = [];
const check = (name, callback) => {
  callback();
  checks.push(name);
};

check("production environment contract", () => {
  const runtime = validateEnvironment({
    NODE_ENV: "production",
    APP_ENV: "production",
    APP_ORIGIN: "https://app.example.invalid",
    ALLOWED_ORIGINS: "https://app.example.invalid",
    MONGODB_URI: "mongodb+srv://user:password@example.invalid/app",
    MONGODB_DB_NAME: "tasknexus_production",
    JWT_ACCESS_SECRET: "a".repeat(48),
    JWT_REFRESH_SECRET: "b".repeat(48),
    UPLOAD_STORAGE_MODE: "disabled",
    EMAIL_DELIVERY_MODE: "disabled",
  });
  assert.equal(runtime.production, true);
});

check("MongoDB model registry", () => {
  assert.equal(Object.keys(models).length, 45, "Expected the canonical 45-model registry");
});

check("Render deployment guardrails", () => {
  const render = read("render.yaml");
  assert.match(render, /buildCommand: npm ci/);
  assert.match(render, /healthCheckPath: \/api\/ready/);
  assert.match(render, /maxShutdownDelaySeconds: 30/);
  assert.match(render, /key: UPLOAD_STORAGE_MODE\s+value: disabled/);
});

check("Vercel browser security headers", () => {
  const vercel = read("frontend/vercel.json");
  for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Permissions-Policy"]) {
    assert.ok(vercel.includes(header), `Missing ${header}`);
  }
  const builtHtml = read("frontend/dist/index.html");
  const inlineJsonLd = [...builtHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const match of inlineJsonLd) {
    const hash = crypto.createHash("sha256").update(match[1]).digest("base64");
    assert.ok(vercel.includes(`sha256-${hash}`), "CSP is missing an inline JSON-LD hash");
  }
});

check("QA mutation fences", () => {
  const destructiveScripts = [
    "phase5BrowserFixture.js", "phase6BrowserFixture.js", "phase7BrowserFixture.js", "phase8BrowserFixture.js",
    "verifyMongoIntegration.js", "verifyMongoApi.js", "verifyTeamsIntegration.js", "verifyProjectsIntegration.js",
    "verifyPhase5Integration.js", "verifyDiscoveryIntegration.js", "verifyHackathonIntegration.js",
    "verifyOpportunityIntegration.js", "verifyOrganizationIntegration.js", "syncMongoIndexes.js", "seedSkills.js",
  ];
  for (const filename of destructiveScripts) {
    assert.match(read(`backend/scripts/${filename}`), /assertStagingMutationAllowed/);
  }
  assert.match(read("backend/scripts/phase9BrowserFixture.js"), /QA fixtures are disabled in production/);
});

check("operations documentation", () => {
  for (const filename of [
    "PRODUCTION_READINESS.md", "DEPLOYMENT.md", "OPERATIONS_RUNBOOK.md", "ENVIRONMENT_VARIABLES.md",
    "SECURITY_MODEL.md", "BACKUP_RESTORE.md", "PHASE10_COMPLETION_REPORT.md",
  ]) {
    assert.ok(fs.existsSync(path.join(root, "docs", filename)), `Missing docs/${filename}`);
  }
});

process.stdout.write(`Production verification passed (${checks.length} checks): ${checks.join(", ")}\n`);
