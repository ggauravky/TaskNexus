require("../src/config/loadEnv");
const { randomUUID } = require("crypto");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const { Skill } = require("../src/models");
const skills = require("../src/seeds/skills");

const run = async () => {
  await connectDatabase();
  const result = await Skill.bulkWrite(skills.map((skill) => ({
    updateOne: {
      filter: { slug: skill.slug },
      update: { $set: skill, $setOnInsert: { _id: randomUUID() } },
      upsert: true,
    },
  })), { ordered: true });
  process.stdout.write(`Skill catalog ready: ${skills.length} canonical entries (${result.upsertedCount} inserted).\n`);
};

run().catch((error) => {
  process.stderr.write(`Skill seed failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
