const VALID_APP_ENVIRONMENTS = new Set(["development", "test", "staging", "production"]);
const VALID_UPLOAD_MODES = new Set(["local", "gridfs", "disabled"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const value = (env, name) => String(env[name] || "").trim();

const parseInteger = (env, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = value(env, name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
};

const parseOrigins = (env) => {
  const appOrigin = value(env, "APP_ORIGIN").replace(/\/$/, "");
  const extras = value(env, "ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return [...new Set([appOrigin, ...extras].filter(Boolean))];
};

const parseBoolean = (env, name, fallback = false) => {
  const raw = value(env, name).toLowerCase();
  if (!raw) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be true or false`);
};

const unsafeProductionDatabaseName = (databaseName) =>
  databaseName === "tasknexus_v2" ||
  /(^|[_-])(dev|development|test|testing|qa|stage|staging|performance)([_-]|$)/i.test(databaseName);

const validateEnvironment = (env = process.env) => {
  const appEnv = value(env, "APP_ENV") || value(env, "NODE_ENV") || "development";
  const nodeEnv = value(env, "NODE_ENV");
  const production = appEnv === "production";
  const errors = [];
  const requireValue = (name) => {
    if (!value(env, name)) errors.push(`${name} is required`);
  };

  if (!VALID_APP_ENVIRONMENTS.has(appEnv)) {
    errors.push("APP_ENV must be development, test, staging, or production");
  }
  if (production && nodeEnv && nodeEnv !== "production") {
    errors.push("NODE_ENV must be production when APP_ENV is production");
  }

  if (appEnv !== "test") {
    requireValue("MONGODB_URI");
    requireValue("JWT_ACCESS_SECRET");
    requireValue("JWT_REFRESH_SECRET");
  }
  if (production) requireValue("MONGODB_DB_NAME");

  const accessSecret = value(env, "JWT_ACCESS_SECRET");
  const refreshSecret = value(env, "JWT_REFRESH_SECRET");
  if (accessSecret && accessSecret.length < 32) errors.push("JWT_ACCESS_SECRET must be at least 32 characters");
  if (refreshSecret && refreshSecret.length < 32) errors.push("JWT_REFRESH_SECRET must be at least 32 characters");
  if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    errors.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
  }

  const appOrigin = value(env, "APP_ORIGIN").replace(/\/$/, "");
  if (production && !/^https:\/\/[^/]+(?::[0-9]+)?$/.test(appOrigin)) {
    errors.push("APP_ORIGIN must be a single HTTPS origin in production");
  }

  const databaseName = value(env, "MONGODB_DB_NAME");
  if (production && unsafeProductionDatabaseName(databaseName)) {
    errors.push("MONGODB_DB_NAME must not use a development, test, QA, staging, or performance database in production");
  }

  const uploadMode = value(env, "UPLOAD_STORAGE_MODE") || (production ? "disabled" : "local");
  if (!VALID_UPLOAD_MODES.has(uploadMode)) errors.push("UPLOAD_STORAGE_MODE must be local, gridfs, or disabled");
  if (production && uploadMode !== "gridfs") {
    errors.push("UPLOAD_STORAGE_MODE must be gridfs in production so attachments use durable storage");
  }

  const gridFsBucketName = value(env, "GRIDFS_BUCKET_NAME") || "tasknexus_attachments";
  if (!/^[A-Za-z][A-Za-z0-9_.-]{2,63}$/.test(gridFsBucketName)) {
    errors.push("GRIDFS_BUCKET_NAME must be a safe name between 3 and 64 characters");
  }

  let emailEnabled = false;
  try {
    emailEnabled = parseBoolean(env, "EMAIL_ENABLED", false);
  } catch (error) {
    errors.push(error.message);
  }

  if (emailEnabled) {
    [
      "BREVO_SMTP_HOST",
      "BREVO_SMTP_PORT",
      "BREVO_SMTP_USER",
      "BREVO_SMTP_PASS",
      "BREVO_SENDER_EMAIL",
      "BREVO_SENDER_NAME",
    ].forEach(requireValue);
  }

  const smtpPort = value(env, "BREVO_SMTP_PORT");
  if (smtpPort && (!Number.isInteger(Number(smtpPort)) || Number(smtpPort) < 1 || Number(smtpPort) > 65535)) {
    errors.push("BREVO_SMTP_PORT must be an integer between 1 and 65535");
  }
  const senderEmail = value(env, "BREVO_SENDER_EMAIL");
  if (senderEmail && !EMAIL_PATTERN.test(senderEmail)) {
    errors.push("BREVO_SENDER_EMAIL must be a valid email address");
  }
  const replyToEmail = value(env, "BREVO_REPLY_TO_EMAIL");
  if (replyToEmail && !EMAIL_PATTERN.test(replyToEmail)) {
    errors.push("BREVO_REPLY_TO_EMAIL must be a valid email address");
  }
  try {
    parseInteger(env, "EMAIL_MAX_ATTEMPTS", 3, { min: 1, max: 5 });
    parseInteger(env, "EMAIL_RETRY_BASE_MS", 1000, { min: 1, max: 60000 });
  } catch (error) {
    errors.push(error.message);
  }
  for (const name of ["EMAIL_APP_URL", "EMAIL_SUPPORT_URL"]) {
    const url = value(env, name).replace(/\/$/, "");
    if (production && url && !/^https:\/\/[^/]+(?:\/[^\s]*)?$/.test(url)) {
      errors.push(`${name} must be an HTTPS URL in production`);
    }
  }

  const origins = parseOrigins(env);
  if (production && origins.some((origin) => !/^https:\/\/[^/]+(?::[0-9]+)?$/.test(origin))) {
    errors.push("Every production CORS origin must be an exact HTTPS origin");
  }

  let trustProxyHops;
  let bodyLimitBytes;
  try {
    trustProxyHops = parseInteger(env, "TRUST_PROXY_HOPS", production ? 1 : 0, { min: 0, max: 10 });
    bodyLimitBytes = parseInteger(env, "API_BODY_LIMIT_BYTES", 1024 * 1024, {
      min: 16 * 1024,
      max: 10 * 1024 * 1024,
    });
  } catch (error) {
    errors.push(error.message);
  }

  if (errors.length) {
    const error = new Error(`Invalid runtime configuration:\n- ${errors.join("\n- ")}`);
    error.code = "INVALID_RUNTIME_CONFIGURATION";
    throw error;
  }

  return Object.freeze({
    appEnv,
    production,
    appOrigin,
    allowedOrigins: origins,
    uploadMode,
    gridFsBucketName,
    emailEnabled,
    trustProxyHops,
    bodyLimitBytes,
  });
};

module.exports = {
  parseBoolean,
  parseInteger,
  parseOrigins,
  unsafeProductionDatabaseName,
  validateEnvironment,
};
