const { NewsletterSubscription } = require("../models");
const { runMongo, toApp } = require("./mongoDataUtils");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const upsertSubscription = (data) => runMongo(async () => toApp(await NewsletterSubscription.findOneAndUpdate(
  { email: normalizeEmail(data.email) },
  { $set: { source: "blog", status: "subscribed", ...data, email: normalizeEmail(data.email) }, $setOnInsert: { subscribed_at: new Date() } },
  { upsert: true, returnDocument: "after", runValidators: true },
).lean()), "Unable to save newsletter subscription");
const findSubscriptionByEmail = (email) => runMongo(async () => toApp(await NewsletterSubscription.findOne({ email: normalizeEmail(email) }).lean()), "Unable to find newsletter subscription");
const updateSubscriptionByEmail = (email, updates) => runMongo(async () => toApp(await NewsletterSubscription.findOneAndUpdate({ email: normalizeEmail(email) }, { $set: updates }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update newsletter subscription");

module.exports = { findSubscriptionByEmail, upsertSubscription, updateSubscriptionByEmail };
