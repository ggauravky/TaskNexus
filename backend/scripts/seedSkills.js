require("../src/config/loadEnv");
const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const { Skill } = require("../src/models");
const skills = require("../src/seeds/skills");

const run = async () => {
  await connectDatabase();
  const existing = await Skill.find({
    slug: mongoose.trusted({ $in: skills.map((skill) => skill.slug) }),
  }).select("slug").lean();
  const existingSlugs = new Set(existing.map((skill) => skill.slug));
  const missing = skills.filter((skill) => !existingSlugs.has(skill.slug));
  if (missing.length) {
    await Skill.insertMany(missing.map((skill) => ({ ...skill, _id: randomUUID() })), { ordered: true });
  }
  for (const skill of skills.filter((entry) => existingSlugs.has(entry.slug))) {
    await Skill.updateOne({ slug: skill.slug }, { $set: skill });
  }
  process.stdout.write(`Skill catalog ready: ${skills.length} canonical entries (${missing.length} inserted).\n`);
};

run().catch((error) => {
  process.stderr.write(`Skill seed failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
