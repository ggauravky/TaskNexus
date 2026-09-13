require("../src/config/loadEnv");
const { validateEnvironment } = require("../src/config/environment");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const CONFIRMATION = "--confirm-production-index-create";

const run = async () => {
  const runtime = validateEnvironment();
  if (!runtime.production) throw new Error("This command requires APP_ENV=production");
  if (!process.argv.includes(CONFIRMATION)) {
    throw new Error(`Explicit production confirmation is required: ${CONFIRMATION}`);
  }
  await connectDatabase();
  for (const [name, Model] of Object.entries(models)) {
    // createIndexes is additive. Unlike syncIndexes, it does not drop existing
    // production indexes; removals require a separately reviewed maintenance.
    await Model.createIndexes();
    process.stdout.write(`${name}: declared indexes created or confirmed.\n`);
  }
};

run().catch((error) => {
  process.stderr.write(`Production index creation failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
