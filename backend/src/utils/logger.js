const winston = require("winston");

const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api[-_]?key|mongodb_uri)/i;
const redactValue = (input, key = "", seen = new WeakSet()) => {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (typeof input === "string") return input.replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]");
  if (!input || typeof input !== "object") return input;
  if (seen.has(input)) return "[Circular]";
  seen.add(input);
  if (Array.isArray(input)) return input.map((item) => redactValue(item, "", seen));
  return Object.fromEntries(
    Object.entries(input).map(([childKey, childValue]) => [childKey, redactValue(childValue, childKey, seen)]),
  );
};

const redact = winston.format((info) => {
  for (const key of Object.keys(info)) info[key] = redactValue(info[key], key);
  return info;
})();

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  redact,
  winston.format.json()
);

const production = (process.env.APP_ENV || process.env.NODE_ENV) === "production";
const test = (process.env.APP_ENV || process.env.NODE_ENV) === "test";
const consoleFormat = production
  ? logFormat
  : winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    redact,
    winston.format.printf(({ timestamp, level, message, service: _service, ...meta }) => {
      const suffix = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
      return `${timestamp} [${level}]: ${message}${suffix}`;
    }),
  );

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "tasknexus-api" },
  silent: test && process.env.LOG_TEST_LOGS !== "true",
  // Production platforms collect stdout. Local file transports are deliberately
  // avoided because container filesystems are ephemeral and can fill the disk.
  transports: [new winston.transports.Console({ format: consoleFormat })],
});

// Create a stream object for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
