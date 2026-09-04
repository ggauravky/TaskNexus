const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { User, UserProfile } = require("../models");
const { buildFilter, escapeRegex, runMongo, toApp, toApps, trustedOperators } = require("./mongoDataUtils");

const createUser = async ({ email, password, role, profile, freelancerProfile, clientProfile }) => runMongo(async () => {
  const salt = await bcrypt.genSalt(Number.parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12);
  const hashedPassword = await bcrypt.hash(password, salt);
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      [created] = await User.create([{
        email: String(email).trim().toLowerCase(), password: hashedPassword, role, profile,
        freelancer_profile: freelancerProfile, client_profile: clientProfile,
      }], { session });
      await UserProfile.create([{ _id: created._id }], { session });
    });
  } finally { await session.endSession(); }
  return toApp(created);
}, "Unable to create user");

const sensitive = "+password +refresh_token +password_reset_token +password_reset_expires";
const findUserByEmail = (email) => runMongo(async () => toApp(await User.findOne({ email: String(email).trim().toLowerCase() }).select(sensitive).lean()), "Unable to find user");
const findUserById = (id) => runMongo(async () => toApp(await User.findById(id).select(sensitive).lean()), "Unable to find user");
const findUsers = (filters) => runMongo(async () => toApps(await User.find(buildFilter(filters)).lean()), "Unable to find users");

const listUsers = ({ filters = {}, page, limit, sortBy, sortOrder, search }) => runMongo(async () => {
  const query = buildFilter(filters);
  if (search) query.email = trustedOperators({ $regex: escapeRegex(search), $options: "i" });
  const safeSort = ["created_at", "updated_at", "email", "role", "status"].includes(sortBy) ? sortBy : "created_at";
  const [items, total] = await Promise.all([
    User.find(query).sort({ [safeSort]: sortOrder === "asc" ? 1 : -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(query),
  ]);
  return { items: toApps(items), total, page, limit };
}, "Unable to list users");

const updateUser = (id, updates) => runMongo(async () => toApp(await User.findByIdAndUpdate(id, { $set: updates }, { returnDocument: "after", runValidators: true }).select(sensitive).lean()), "Unable to update user");
const comparePassword = (candidatePassword, userPassword) => bcrypt.compare(candidatePassword, userPassword);

module.exports = { createUser, findUserByEmail, findUserById, findUsers, listUsers, updateUser, comparePassword };
