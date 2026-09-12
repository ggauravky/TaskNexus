const { errors } = require("../utils/appError");

const text = (value, max, field, { required = false } = {}) => {
  if (value != null && typeof value !== "string") throw errors.validation(`${field} must be text`);
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw errors.validation(`${field} is required`);
  if (normalized.length > max) throw errors.validation(`${field} must be at most ${max} characters`);
  if (/[<>]/.test(normalized)) throw errors.validation(`${field} must be plain text`);
  return normalized || null;
};

const slugify = (value) => String(value || "").trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

const stringList = (value, max, field) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw errors.validation(`${field} must be a list`);
  if (value.some((item) => typeof item !== "string")) throw errors.validation(`${field} contains invalid values`);
  const items = [...new Set(value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
  if (items.length > max || items.some((item) => item.length > 60 || /[<>]/.test(item))) {
    throw errors.validation(`${field} contains invalid values`);
  }
  return items;
};

const idList = (value, max, field) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw errors.validation(`${field} must be a list`);
  if (value.some((item) => typeof item !== "string")) throw errors.validation(`${field} contains invalid IDs`);
  const ids = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  if (ids.length > max || ids.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    throw errors.validation(`${field} contains invalid IDs`);
  }
  return ids;
};

const dateValue = (value, field) => {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw errors.validation(`${field} must be a valid date`);
  return date;
};

const httpsUrl = (value, field) => {
  const normalized = text(value, 500, field);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:") throw new Error("protocol");
  } catch {
    throw errors.validation(`${field} must be a valid HTTPS URL`);
  }
  return normalized;
};

module.exports = { dateValue, httpsUrl, idList, slugify, stringList, text };
