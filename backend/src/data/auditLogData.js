const { AuditLog } = require("../models");
const { buildFilter, runMongo, toApp, toApps } = require("./mongoDataUtils");

const insertLog = async (data, session) => {
  const [entry] = await AuditLog.create([data], { session });
  return toApp(entry);
};
const log = (data, session = null) => session
  ? insertLog(data, session)
  : runMongo(() => insertLog(data, null), "Unable to create audit log");
const listAuditLogs = ({ filters = {}, page, limit }) => runMongo(async () => {
  const query = buildFilter(filters);
  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(query),
  ]);
  return { items: toApps(items), total, page, limit };
}, "Unable to list audit logs");

module.exports = { log, listAuditLogs };
