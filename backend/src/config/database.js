const dns = require("node:dns");
const net = require("node:net");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

const databaseName = () => process.env.MONGODB_DB_NAME || "tasknexus_v2";

const configureDnsServers = () => {
  const configured = process.env.MONGODB_DNS_SERVERS;
  if (!configured) return;
  const servers = configured.split(",").map((server) => server.trim()).filter(Boolean);
  if (!servers.length || servers.some((server) => !net.isIP(server))) {
    throw new Error("MONGODB_DNS_SERVERS must contain comma-separated IP addresses");
  }
  dns.setServers(servers);
};

const safeMessage = (error) => {
  const code = error?.code ? ` (${error.code})` : "";
  return `MongoDB connection failed${code}`;
};

const connectDatabase = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  configureDnsServers();

  try {
    await mongoose.connect(uri, {
      dbName: databaseName(),
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000,
      connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS) || 10000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 20,
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE) || 0,
      autoIndex: process.env.NODE_ENV !== "production",
    });
    logger.info(`MongoDB connected to database ${databaseName()}`);
    return mongoose.connection;
  } catch (error) {
    const sanitized = new Error(safeMessage(error));
    sanitized.code = "DATABASE_CONNECTION_FAILED";
    throw sanitized;
  }
};

const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

module.exports = {
  configureDnsServers, connectDatabase, databaseName, disconnectDatabase, isDatabaseReady, safeMessage,
};
