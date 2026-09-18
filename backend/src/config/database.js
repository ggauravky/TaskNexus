const dns = require("node:dns");
const net = require("node:net");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

mongoose.set("strictQuery", true);
mongoose.set("sanitizeFilter", true);

const databaseName = () => process.env.MONGODB_DB_NAME || "tasknexus_v2";

const configureDnsServers = () => {
  const configured = process.env.MONGODB_DNS_SERVERS;
  if (configured) {
    const servers = configured.split(",").map((server) => server.trim()).filter(Boolean);
    if (!servers.length || servers.some((server) => !net.isIP(server))) {
      throw new Error("MONGODB_DNS_SERVERS must contain comma-separated IP addresses");
    }
    dns.setServers(servers);
    return;
  }

  if (process.env.NODE_ENV !== "test") {
    const current = dns.getServers();
    if (current.length === 1 && current[0] === "127.0.0.1") {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    }
  }
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
      socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS) || 45000,
      heartbeatFrequencyMS: Number(process.env.MONGODB_HEARTBEAT_FREQUENCY_MS) || 10000,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || 20,
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE) || 0,
      autoIndex: process.env.NODE_ENV !== "production",
    });
    logger.info(`MongoDB connected to database ${databaseName()}`);
    return mongoose.connection;
  } catch (error) {
    let isIpAccessError = /whitelist|access list|SSL alert number 80|tlsv1 alert/i.test(error?.message || "");
    if (!isIpAccessError && error?.reason?.servers) {
      for (const [, desc] of error.reason.servers) {
        if (/alert number 80|tlsv1 alert/i.test(desc?.error?.message || "")) {
          isIpAccessError = true;
          break;
        }
      }
    }

    if (isIpAccessError) {
      logger.error("MongoDB Atlas connection rejected: client IP may not be allowed in Atlas Network Access", {
        hint: "Add your current public IP address to MongoDB Atlas -> Network Access -> IP Access List (or allow 0.0.0.0/0 for development).",
      });
    } else if (error?.code === "ETIMEOUT" || error?.code === "ECONNREFUSED") {
      logger.error("MongoDB DNS / connection timed out or refused", {
        code: error?.code,
        dnsServers: dns.getServers(),
        hint: "Verify MONGODB_DNS_SERVERS in .env or .env.local (recommended: 8.8.8.8, 1.1.1.1).",
      });
    }

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
