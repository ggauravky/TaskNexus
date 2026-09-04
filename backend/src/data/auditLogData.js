const { AuditLog } = require("../models");
const { buildFilter, runMongo, toApp, toApps } = require("./mongoDataUtils");

const log = (data) => runMongo(async () => toApp(await AuditLog.create(data)), "Unable to create audit log");
const findAuditLogs = (filters) => runMongo(async () => toApps(await AuditLog.find(buildFilter(filters)).sort({ timestamp: -1 }).lean()), "Unable to find audit logs");

module.exports = { log, findAuditLogs };
