const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const LOCAL_DATA_DIR = path.join(__dirname, "../../.local-data");

const ensureLocalDirectory = () => {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }
};

const ensureCollectionFile = (filePath) => {
  ensureLocalDirectory();

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "[]", "utf8");
  }
};

const readCollection = (filePath) => {
  ensureCollectionFile(filePath);

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writeCollection = (filePath, records) => {
  ensureCollectionFile(filePath);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2), "utf8");
};

const readJsonPath = (obj, key) => {
  if (!obj || typeof obj !== "object") return undefined;
  return obj[key];
};

const matchesFilter = (record, key, value) => {
  if (key.includes("->>")) {
    const [column, jsonKey] = key.split("->>");
    const target = readJsonPath(record[column], jsonKey);
    return String(target ?? "") === String(value ?? "");
  }

  if (key.includes("->")) {
    const [column, jsonKey] = key.split("->");
    const target = readJsonPath(record[column], jsonKey);
    return target === value;
  }

  if (value === null) {
    return record[key] === null || record[key] === undefined;
  }

  if (Array.isArray(value)) {
    return value.includes(record[key]);
  }

  return record[key] === value;
};

const applyFilters = (records, filters = {}) => {
  if (!filters || Object.keys(filters).length === 0) {
    return records;
  }

  return records.filter((record) =>
    Object.entries(filters).every(([key, value]) => matchesFilter(record, key, value))
  );
};

const withRecordMetadata = (payload) => {
  const now = new Date().toISOString();

  return {
    id: payload.id || crypto.randomUUID(),
    ...payload,
    created_at: payload.created_at || now,
    updated_at: payload.updated_at || now,
  };
};

module.exports = {
  LOCAL_DATA_DIR,
  applyFilters,
  readCollection,
  withRecordMetadata,
  writeCollection,
};
