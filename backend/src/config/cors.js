const { errors } = require("../utils/appError");
const { parseOrigins } = require("./environment");

const normalizeOrigin = (origin) => (origin ? String(origin).replace(/\/$/, "") : origin);

const createCorsOptions = (env = process.env) => {
  const allowedOrigins = parseOrigins(env).map(normalizeOrigin);

  return {
    origin: (origin, callback) => {
      // Requests without a browser Origin header are server-to-server traffic.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(normalizeOrigin(origin))) return callback(null, true);
      return callback(errors.forbidden("Origin is not allowed by CORS"));
    },
    credentials: true,
    optionsSuccessStatus: 200,
  };
};

module.exports = { createCorsOptions, normalizeOrigin };
