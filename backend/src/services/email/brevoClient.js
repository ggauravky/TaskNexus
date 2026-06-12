const { BrevoClient } = require("@getbrevo/brevo");

let clientInstance = null;

const normalizeValue = (value) => String(value || "").trim();
const normalizeUrl = (value) => normalizeValue(value).replace(/\/$/, "");

const isBrevoConfigured = () =>
  Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);

const getBrevoClient = () => {
  if (!isBrevoConfigured()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = new BrevoClient({
      apiKey: process.env.BREVO_API_KEY,
    });
  }

  return clientInstance;
};

const getSender = () => ({
  email: process.env.BREVO_SENDER_EMAIL,
  name: process.env.BREVO_SENDER_NAME || "TaskNexus",
});

const getReplyTo = () => {
  const replyToEmail = process.env.BREVO_REPLY_TO_EMAIL || process.env.BREVO_SENDER_EMAIL;
  if (!replyToEmail) return undefined;

  return {
    email: replyToEmail,
    name: process.env.BREVO_SENDER_NAME || "TaskNexus",
  };
};

const getAdminNotificationEmail = () =>
  normalizeValue(process.env.BREVO_ADMIN_NOTIFICATION_EMAIL || "") || null;

const getNewsletterListId = () => {
  const parsed = Number.parseInt(process.env.BREVO_NEWSLETTER_LIST_ID || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getPublicAppUrl = () => {
  const directClientUrl = normalizeUrl(process.env.CLIENT_URL);
  if (directClientUrl) {
    return directClientUrl;
  }

  const firstAllowedOrigin = normalizeUrl(
    String(process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .find(Boolean)
  );

  return firstAllowedOrigin || "http://localhost:5173";
};

module.exports = {
  getAdminNotificationEmail,
  getBrevoClient,
  getNewsletterListId,
  getPublicAppUrl,
  getReplyTo,
  getSender,
  isBrevoConfigured,
};
