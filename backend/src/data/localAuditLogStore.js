const path = require("path");
const {
  applyFilters,
  readCollection,
  withRecordMetadata,
  writeCollection,
} = require("./localStoreUtils");

const FILE_PATH = path.join(__dirname, "../../.local-data/audit-logs.json");

const log = async (payload) => {
  const logs = readCollection(FILE_PATH);
  const record = withRecordMetadata(payload);
  logs.push(record);
  writeCollection(FILE_PATH, logs);
  return record;
};

const findAuditLogs = async (filters) => {
  const logs = readCollection(FILE_PATH);
  return applyFilters(logs, filters);
};

module.exports = {
  log,
  findAuditLogs,
};
