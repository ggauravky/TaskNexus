const { AuditLog } = require("../models");
const { buildFilter, runMongo, toApp, toApps } = require("./mongoDataUtils");

const log = (data) => runMongo(async () => toApp(await AuditLog.create(data)), "Unable to create audit log");
const listAuditLogs = ({ filters = {}, page, limit }) => runMongo(async () => {
  const query = buildFilter(filters);
  const [items, total] = await Promise.all([
    AuditLog.find(query).sort({ timestamp: -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(query),
  ]);
  return { items: toApps(items), total, page, limit };
}, "Unable to list audit logs");

module.exports = { log, listAuditLogs };
