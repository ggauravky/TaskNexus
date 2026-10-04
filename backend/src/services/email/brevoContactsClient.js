const { BrevoClient } = require("@getbrevo/brevo");

let clientInstance = null;

const normalize = (value) => String(value || "").trim();
const isBrevoContactsConfigured = (env = process.env) =>
  Boolean(normalize(env.BREVO_CONTACTS_API_KEY));

const getBrevoContactsClient = (env = process.env) => {
  if (!isBrevoContactsConfigured(env)) return null;
  if (!clientInstance) {
    clientInstance = new BrevoClient({ apiKey: normalize(env.BREVO_CONTACTS_API_KEY) });
  }
  return clientInstance;
};

const getNewsletterListId = (env = process.env) => {
  const parsed = Number.parseInt(env.BREVO_NEWSLETTER_LIST_ID || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const resetBrevoContactsClient = () => {
  clientInstance = null;
};

module.exports = {
  getBrevoContactsClient,
  getNewsletterListId,
  isBrevoContactsConfigured,
  resetBrevoContactsClient,
};
