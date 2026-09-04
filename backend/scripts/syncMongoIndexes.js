require("../src/config/loadEnv");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const run = async () => {
  await connectDatabase();
  for (const [name, Model] of Object.entries(models)) {
    const changes = await Model.syncIndexes();
    process.stdout.write(`${name}: indexes synchronized (${changes.length} obsolete removed).\n`);
  }
};

run().catch((error) => {
  process.stderr.write(`Index synchronization failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
