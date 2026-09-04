const { errors } = require("../utils/appError");
const mongoose = require("mongoose");
const { toApp, toApps } = require("../models/helpers");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mongoPath = (key) => key.replace(/->>/g, ".").replace(/->/g, ".");
const buildFilter = (filters = {}) => Object.fromEntries(Object.entries(filters).map(([key, value]) => [
  key === "id" ? "_id" : mongoPath(key), Array.isArray(value) ? mongoose.trusted({ $in: value }) : value,
]));

const trustedOperators = (operators) => mongoose.trusted(operators);

const normalizeMongoError = (error, fallback = "Database operation failed") => {
  if (error?.code === 11000) return errors.conflict("A record with these unique values already exists");
  if (["ValidationError", "CastError", "StrictModeError"].includes(error?.name)) return errors.validation("Database validation failed");
  if (error?.code === "DATABASE_CONNECTION_FAILED" || /server selection|connection/i.test(error?.message || "")) {
    const unavailable = new Error("Database is temporarily unavailable");
    unavailable.statusCode = 503;
    unavailable.code = "DATABASE_UNAVAILABLE";
    return unavailable;
  }
  const safe = new Error(fallback);
  safe.statusCode = 500;
  safe.code = "DATABASE_ERROR";
  return safe;
};

const runMongo = async (operation, fallbackMessage) => {
  try { return await operation(); } catch (error) {
    if (error?.statusCode) throw error;
    throw normalizeMongoError(error, fallbackMessage);
  }
};

module.exports = { buildFilter, escapeRegex, normalizeMongoError, runMongo, toApp, toApps, trustedOperators };
