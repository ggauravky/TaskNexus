const { parseOrigins } = require("../config/environment");
const { errors } = require("../utils/appError");

const requireTrustedOrigin = (req, _res, next) => {
  const production = (process.env.APP_ENV || process.env.NODE_ENV) === "production";
  if (!production) return next();

  const origin = String(req.get("origin") || "").replace(/\/$/, "");
  if (!origin || !parseOrigins(process.env).includes(origin)) {
    return next(errors.forbidden("A trusted browser origin is required"));
  }
  return next();
};

module.exports = requireTrustedOrigin;
