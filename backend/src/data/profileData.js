const mongoose = require("mongoose");
const { User, UserProfile, Skill, UserSkill, UserEducation } = require("../models");
const { escapeRegex, runMongo, toApp } = require("./mongoDataUtils");

const profileRow = (value) => {
  const row = toApp(value);
  if (!row) return null;
  row.user_id = row.id;
  delete row.id;
  return row;
};

const findProfileByUserId = (userId) => runMongo(async () => profileRow(await UserProfile.findById(userId).lean()), "Unable to find profile");
const findProfileByUsername = (username) => runMongo(async () => profileRow(await UserProfile.findOne({ username: String(username).toLowerCase() }).lean()), "Unable to find profile");
const isUsernameTaken = (username, excludingUserId = null) => runMongo(async () => Boolean(await UserProfile.exists({ username: String(username).toLowerCase(), ...(excludingUserId ? { _id: mongoose.trusted({ $ne: excludingUserId }) } : {}) })), "Unable to check username");
const upsertProfile = (userId, values) => runMongo(async () => profileRow(await UserProfile.findByIdAndUpdate(userId, { $set: values, $setOnInsert: { _id: userId } }, { upsert: true, returnDocument: "after", runValidators: true }).lean()), "Unable to save profile");

const listEducation = (userId) => runMongo(async () => (await UserEducation.find({ user_id: userId }).sort({ position: 1, start_year: -1 }).lean()).map(toApp), "Unable to list education");
const createEducation = (userId, values) => runMongo(async () => toApp(await UserEducation.create({ user_id: userId, ...values })), "Unable to create education");
const updateEducation = (userId, educationId, values) => runMongo(async () => toApp(await UserEducation.findOneAndUpdate({ _id: educationId, user_id: userId }, { $set: values }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update education");
const deleteEducation = (userId, educationId) => runMongo(async () => toApp(await UserEducation.findOneAndDelete({ _id: educationId, user_id: userId }).lean()), "Unable to delete education");

const listUserSkills = (userId) => runMongo(async () => {
  const assignments = await UserSkill.find({ user_id: userId }).sort({ is_primary: -1, created_at: 1 }).lean();
  const catalog = await Skill.find({ _id: mongoose.trusted({ $in: assignments.map((row) => row.skill_id) }) }).lean();
  const byId = new Map(catalog.map((item) => [String(item._id), toApp(item)]));
  return assignments.map((row) => ({ ...toApp(row), skill: byId.get(row.skill_id) || null }));
}, "Unable to list profile skills");

const replaceUserSkills = (userId, skills) => runMongo(async () => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(userId).select("role freelancer_profile").session(session).lean();
      if (!user) throw new Error("User not found");
      const ids = skills.map((item) => item.skillId);
      const catalog = await Skill.find({ _id: mongoose.trusted({ $in: ids }), is_active: true }).session(session).lean();
      if (catalog.length !== ids.length) throw new Error("One or more skills are invalid");
      await UserSkill.deleteMany({ user_id: userId }, { session });
      if (skills.length) await UserSkill.insertMany(skills.map((item) => ({ _id: `${userId}:${item.skillId}`, user_id: userId, skill_id: item.skillId, proficiency: item.proficiency, is_primary: item.isPrimary })), { session });
      if (user.role === "freelancer") {
        const names = new Map(catalog.map((item) => [String(item._id), item.name]));
        await User.updateOne(
          { _id: userId },
          { $set: { "freelancer_profile.skills": skills.map((item) => names.get(item.skillId)).filter(Boolean) } },
          { session, runValidators: true },
        );
      }
    });
  } finally { await session.endSession(); }
  return listUserSkills(userId);
}, "Unable to replace profile skills");

const searchSkills = ({ query = "", category, limit = 20 }) => runMongo(async () => {
  const filter = { is_active: true };
  if (category) filter.category = category;
  if (query) {
    const pattern = new RegExp(escapeRegex(query), "i");
    filter.$or = mongoose.trusted([{ name: pattern }, { slug: pattern }, { aliases: pattern }]);
  }
  const rows = await Skill.find(filter).sort({ name: 1 }).limit(Math.min(Math.max(limit, 1), 30)).lean();
  const exact = String(query).trim().toLowerCase();
  return rows.map(toApp).sort((a, b) => (a.name.toLowerCase() === exact ? -1 : b.name.toLowerCase() === exact ? 1 : a.name.localeCompare(b.name)));
}, "Unable to search skills");

module.exports = { findProfileByUserId, findProfileByUsername, isUsernameTaken, upsertProfile, listEducation, createEducation, updateEducation, deleteEducation, listUserSkills, replaceUserSkills, searchSkills };
