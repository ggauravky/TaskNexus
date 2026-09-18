require("../src/config/loadEnv");

const { randomUUID } = require("node:crypto");
const { validateEnvironment } = require("../src/config/environment");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const { Skill } = require("../src/models");
const skills = require("../src/seeds/skills");

const CONFIRMATION = "--confirm-production-skill-seed";

const run = async () => {
  const runtime = validateEnvironment();
  if (!runtime.production) throw new Error("This command requires APP_ENV=production");
  if (!process.argv.includes(CONFIRMATION)) {
    throw new Error(`Explicit production confirmation is required: ${CONFIRMATION}`);
  }
  if (process.env.PRODUCTION_SEED_DB_NAME !== process.env.MONGODB_DB_NAME) {
    throw new Error("PRODUCTION_SEED_DB_NAME must exactly match MONGODB_DB_NAME");
  }

  await connectDatabase();
  const result = await Skill.bulkWrite(skills.map((skill) => ({
    updateOne: {
      filter: { slug: skill.slug },
      update: {
        $set: skill,
        $setOnInsert: { _id: randomUUID() },
      },
      upsert: true,
    },
  })), { ordered: false });

  process.stdout.write(
    `Canonical production skills ready: ${skills.length}; inserted=${result.upsertedCount}; updated=${result.modifiedCount}.\n`,
  );
};

run().catch((error) => {
  process.stderr.write(`Production skill seeding failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
