require("./src/config/loadEnv");
const { validateEnvironment } = require("./src/config/environment");
let runtime;
try {
  runtime = validateEnvironment();
} catch (error) {
  process.stderr.write(`Startup configuration rejected: ${error.message}\n`);
  process.exit(1);
}
const app = require("./src/app");
const logger = require("./src/utils/logger");
const { connectDatabase, disconnectDatabase } = require("./src/config/database");
const realtimeHub = require("./src/services/realtimeHub");
const fs = require("fs");
const path = require("path");

// Create necessary directories
const createDirectories = () => {
  if (runtime.uploadMode !== "local") return;
  const uploadsRoot = path.resolve(process.env.UPLOAD_PATH || path.join(__dirname, "uploads"));
  const dirs = [uploadsRoot, path.join(uploadsRoot, "comments")];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

// Start server
const startServer = async () => {
  try {
    // Create directories
    createDirectories();

    // MongoDB is the canonical persistence layer. Startup fails rather than
    // falling back to local files when the database is unavailable.
    await connectDatabase();

    // Get port from environment or use default
    const PORT = Number(process.env.PORT) || 5000;

    // Start listening
    const server = app.listen(PORT, () => {
      logger.info("TaskNexus API listening", {
        environment: runtime.appEnv,
        port: PORT,
        uploadMode: runtime.uploadMode,
      });
    });

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    server.requestTimeout = 30000;

    // Graceful shutdown
    let shuttingDown = false;
    const gracefulShutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info("Graceful shutdown started", { signal });
      realtimeHub.closeAll();

      const forceTimer = setTimeout(() => {
        logger.error("Forced shutdown after timeout", { signal });
        process.exit(1);
      }, 30000);
      forceTimer.unref();

      server.close(async (closeError) => {
        try {
          if (closeError) logger.error("HTTP server close failed", { errorMessage: closeError.message });
          await disconnectDatabase();
          clearTimeout(forceTimer);
          logger.info("Graceful shutdown completed", { signal });
          process.exit(closeError ? 1 : 0);
        } catch (error) {
          logger.error("Shutdown failed", { errorMessage: error.message });
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception", { errorMessage: error.message, stack: error.stack });
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection", { errorMessage: reason?.message || String(reason), stack: reason?.stack });
      gracefulShutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    logger.error("Failed to start server", { code: error.code, errorMessage: error.message });
    process.exit(1);
  }
};

// Start the server
startServer();
