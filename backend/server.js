require("./src/config/loadEnv");
const app = require("./src/app");
const logger = require("./src/utils/logger");
const { connectDatabase, disconnectDatabase } = require("./src/config/database");
const fs = require("fs");
const path = require("path");

// Create necessary directories
const createDirectories = () => {
  const dirs = [
    path.join(__dirname, "logs"),
    path.resolve(process.env.UPLOAD_PATH || path.join(__dirname, "uploads")),
    path.join(
      path.resolve(process.env.UPLOAD_PATH || path.join(__dirname, "uploads")),
      "comments",
    ),
  ];

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
    const PORT = process.env.PORT || 5000;

    // Start listening
    const server = app.listen(PORT, () => {
      logger.info(`=================================================`);
      logger.info(`🚀 TaskNexus API Server Running`);
      logger.info(`=================================================`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`Port: ${PORT}`);
      logger.info(`URL: http://localhost:${PORT}`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
      logger.info(`=================================================`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`\n${signal} received. Starting graceful shutdown...`);

      server.close(async () => {
        logger.info("HTTP server closed");
        await disconnectDatabase();
        logger.info("MongoDB connection closed");
        logger.info("Graceful shutdown completed");
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception:", error);
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Rejection at:", promise, "reason:", reason);
      gracefulShutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
