const path = require("path");
const {
  applyFilters,
  readCollection,
  withRecordMetadata,
  writeCollection,
} = require("./localStoreUtils");

const FILE_PATH = path.join(__dirname, "../../.local-data/newsletter-subscriptions.json");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const upsertSubscription = async (payload) => {
  const subscriptions = readCollection(FILE_PATH);
  const email = normalizeEmail(payload.email);
  const now = new Date().toISOString();
  const existingIndex = subscriptions.findIndex(
    (subscription) => normalizeEmail(subscription.email) === email
  );

  if (existingIndex >= 0) {
    subscriptions[existingIndex] = {
      ...subscriptions[existingIndex],
      ...payload,
      email,
      updated_at: now,
    };
    writeCollection(FILE_PATH, subscriptions);
    return subscriptions[existingIndex];
  }

  const record = withRecordMetadata({
    source: "blog",
    status: "subscribed",
    subscribed_at: now,
    ...payload,
    email,
  });

  subscriptions.push(record);
  writeCollection(FILE_PATH, subscriptions);
  return record;
};

const findSubscriptionByEmail = async (email) => {
  const subscriptions = readCollection(FILE_PATH);
  return (
    subscriptions.find((subscription) => normalizeEmail(subscription.email) === normalizeEmail(email)) ||
    null
  );
};

const findSubscriptions = async (filters) => {
  const subscriptions = readCollection(FILE_PATH);
  return applyFilters(subscriptions, filters);
};

const updateSubscriptionByEmail = async (email, updates) => {
  const subscriptions = readCollection(FILE_PATH);
  const index = subscriptions.findIndex(
    (subscription) => normalizeEmail(subscription.email) === normalizeEmail(email)
  );

  if (index === -1) {
    return null;
  }

  subscriptions[index] = {
    ...subscriptions[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  writeCollection(FILE_PATH, subscriptions);
  return subscriptions[index];
};

module.exports = {
  findSubscriptionByEmail,
  findSubscriptions,
  upsertSubscription,
  updateSubscriptionByEmail,
};
