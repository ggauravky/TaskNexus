const CONFIRMATION = "--confirm-tasknexus-v2-staging";

const assertStagingMutationAllowed = () => {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const databaseName = String(process.env.MONGODB_DB_NAME || "tasknexus_v2").trim();
  if (appEnv === "production") {
    throw new Error("QA and verification mutations are disabled in production");
  }
  if (databaseName !== "tasknexus_v2") {
    throw new Error("QA and verification mutations are restricted to the tasknexus_v2 staging database");
  }
  if (!process.argv.includes(CONFIRMATION)) {
    throw new Error(`Explicit staging confirmation is required: ${CONFIRMATION}`);
  }
};

module.exports = { CONFIRMATION, assertStagingMutationAllowed };
