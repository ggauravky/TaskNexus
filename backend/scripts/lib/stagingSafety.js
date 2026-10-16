const CONFIRMATION = "--confirm-tasknexus-v2-staging";
const SAFE_DATABASE_MARKERS = Object.freeze([
  "development",
  "dev",
  "test",
  "testing",
  "integration",
  "qa",
]);
const PRODUCTION_DATABASE_MARKERS = Object.freeze(["prod", "production", "live"]);

const requiredValue = (name) => {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) throw new Error(`${name} is required for QA and verification mutations`);
  return value;
};

const assertStagingMutationAllowed = () => {
  const nodeEnv = requiredValue("NODE_ENV");
  const appEnv = requiredValue("APP_ENV");
  const databaseName = requiredValue("MONGODB_DB_NAME");

  if (nodeEnv === "production" || appEnv === "production") {
    throw new Error("QA and verification mutations are disabled in production");
  }
  if (PRODUCTION_DATABASE_MARKERS.some((marker) => databaseName.includes(marker))) {
    throw new Error("QA and verification mutations are disabled for production-like database names");
  }
  if (!SAFE_DATABASE_MARKERS.some((marker) => databaseName.includes(marker))) {
    throw new Error("QA and verification database name must identify development, test, integration, or QA use");
  }
  if (!process.argv.includes(CONFIRMATION)) {
    throw new Error(`Explicit staging confirmation is required: ${CONFIRMATION}`);
  }
};

module.exports = {
  CONFIRMATION,
  SAFE_DATABASE_MARKERS,
  PRODUCTION_DATABASE_MARKERS,
  assertStagingMutationAllowed,
};
