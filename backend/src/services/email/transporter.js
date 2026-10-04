const nodemailer = require("nodemailer");

const DEFAULT_APP_URL = "https://task-nexus-official.vercel.app";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class EmailError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = "EmailError";
    this.code = code;
  }
}

const normalize = (value) => String(value || "").trim();
const normalizeUrl = (value) => normalize(value).replace(/\/$/, "");
const parsePositiveInteger = (value, fallback, maximum = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
};
const emailEnabled = (env = process.env) => normalize(env.EMAIL_ENABLED).toLowerCase() === "true";

const getEmailConfig = (env = process.env) => {
  const port = parsePositiveInteger(env.BREVO_SMTP_PORT, 587, 65535);
  const senderEmail = normalize(env.BREVO_SENDER_EMAIL);
  const senderName = normalize(env.BREVO_SENDER_NAME) || "TaskNexus";
  const replyToEmail = normalize(env.BREVO_REPLY_TO_EMAIL) || senderEmail;
  const replyToName = normalize(env.BREVO_REPLY_TO_NAME) || senderName;

  return Object.freeze({
    enabled: emailEnabled(env),
    appName: normalize(env.EMAIL_APP_NAME) || "TaskNexus",
    appUrl: normalizeUrl(env.EMAIL_APP_URL || env.APP_ORIGIN) || DEFAULT_APP_URL,
    supportUrl: normalizeUrl(env.EMAIL_SUPPORT_URL || env.EMAIL_APP_URL || env.APP_ORIGIN)
      || DEFAULT_APP_URL,
    host: normalize(env.BREVO_SMTP_HOST),
    port,
    secure: port === 465,
    user: normalize(env.BREVO_SMTP_USER),
    pass: normalize(env.BREVO_SMTP_PASS),
    sender: { address: senderEmail, name: senderName },
    replyTo: replyToEmail ? { address: replyToEmail, name: replyToName } : undefined,
    adminNotificationEmail: normalize(env.BREVO_ADMIN_NOTIFICATION_EMAIL) || null,
    maxAttempts: parsePositiveInteger(env.EMAIL_MAX_ATTEMPTS, 3, 5),
    retryBaseMs: parsePositiveInteger(env.EMAIL_RETRY_BASE_MS, 1000, 60000),
  });
};

const missingConfiguration = (config) => [
  ["BREVO_SMTP_HOST", config.host],
  ["BREVO_SMTP_USER", config.user],
  ["BREVO_SMTP_PASS", config.pass],
  ["BREVO_SENDER_EMAIL", config.sender.address],
  ["BREVO_SENDER_NAME", config.sender.name],
].filter(([, value]) => !value).map(([name]) => name);

const validateEmailConfig = (config) => {
  if (!config.enabled) return config;
  const missing = missingConfiguration(config);
  if (missing.length) {
    throw new EmailError(
      "EMAIL_CONFIGURATION_ERROR",
      `Email configuration is missing: ${missing.join(", ")}`,
    );
  }
  if (!EMAIL_PATTERN.test(config.sender.address)) {
    throw new EmailError("EMAIL_CONFIGURATION_ERROR", "BREVO_SENDER_EMAIL is invalid");
  }
  if (config.replyTo && !EMAIL_PATTERN.test(config.replyTo.address)) {
    throw new EmailError("EMAIL_CONFIGURATION_ERROR", "BREVO_REPLY_TO_EMAIL is invalid");
  }
  return config;
};

let transporterInstance = null;
let transporterKey = null;

const getTransporter = (env = process.env) => {
  const config = validateEmailConfig(getEmailConfig(env));
  if (!config.enabled) return null;

  const key = JSON.stringify([config.host, config.port, config.secure, config.user]);
  if (!transporterInstance || transporterKey !== key) {
    transporterInstance = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      requireTLS: !config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    transporterKey = key;
  }
  return transporterInstance;
};

const resetTransporter = () => {
  transporterInstance = null;
  transporterKey = null;
};

const verifyTransport = async (env = process.env) => {
  const config = validateEmailConfig(getEmailConfig(env));
  if (!config.enabled) {
    return { status: "skipped", reason: "EMAIL_DISABLED" };
  }
  await getTransporter(env).verify();
  return { status: "verified", provider: "brevo-smtp" };
};

module.exports = {
  EMAIL_PATTERN,
  EmailError,
  emailEnabled,
  getEmailConfig,
  getTransporter,
  resetTransporter,
  validateEmailConfig,
  verifyTransport,
};
