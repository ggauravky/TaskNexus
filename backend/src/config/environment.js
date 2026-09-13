const VALID_APP_ENVIRONMENTS = new Set(["development", "test", "staging", "production"]);
const VALID_UPLOAD_MODES = new Set(["local", "disabled"]);
const VALID_EMAIL_MODES = new Set(["disabled", "optional", "required"]);

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
  if (production && databaseName === "tasknexus_v2") {
    errors.push("MONGODB_DB_NAME must not use the staging database in production");
  }

  const uploadMode = value(env, "UPLOAD_STORAGE_MODE") || (production ? "disabled" : "local");
  if (!VALID_UPLOAD_MODES.has(uploadMode)) errors.push("UPLOAD_STORAGE_MODE must be local or disabled");
  if (production && uploadMode === "local") {
    errors.push("UPLOAD_STORAGE_MODE=local is unsafe in production; use disabled until durable storage is configured");
  }

  const emailMode = value(env, "EMAIL_DELIVERY_MODE") || "optional";
  if (!VALID_EMAIL_MODES.has(emailMode)) errors.push("EMAIL_DELIVERY_MODE must be disabled, optional, or required");
  if (emailMode === "required") {
    ["BREVO_API_KEY", "BREVO_SENDER_EMAIL", "BREVO_SENDER_NAME"].forEach(requireValue);
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
    emailMode,
    trustProxyHops,
    bodyLimitBytes,
  });
};

module.exports = { parseInteger, parseOrigins, validateEnvironment };
