const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.NODE_ENV === "production"
        ? process.env.MONGODB_URI_PROD
        : process.env.MONGODB_URI;

    const options = {
      // Connection pool size
      maxPoolSize: 10,
      minPoolSize: 5,

      // Timeout settings
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,

      // Retry settings
      retryWrites: true,
      retryReads: true,
    };

    await mongoose.connect(mongoURI, options);

    logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
    logger.info(`Database: ${mongoose.connection.name}`);

    // Connection event listeners
    mongoose.connection.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected successfully");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      logger.info("MongoDB connection closed due to app termination");
      process.exit(0);
    });
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
