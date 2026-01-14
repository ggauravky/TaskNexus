const logger = require("../utils/logger");
const { ERROR_CODES } = require("../config/constants");

/**
 * Global Error Handler Middleware
 * Catches all errors and sends appropriate response
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.userId,
  });

  // Default error
  let statusCode = err.statusCode || 500;
  let errorResponse = {
    success: false,
    error: {
      code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: err.message || "Internal server error",
    },
  };

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    errorResponse.error = {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Validation failed",
      details: errors,
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern)[0];
    errorResponse.error = {
      code: ERROR_CODES.DUPLICATE_ERROR,
      message: `${field} already exists`,
    };
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    errorResponse.error = {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Invalid ID format",
    };
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    errorResponse.error = {
      code: ERROR_CODES.AUTHENTICATION_ERROR,
      message: "Invalid token",
    };
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    errorResponse.error = {
      code: ERROR_CODES.AUTHENTICATION_ERROR,
      message: "Token expired",
    };
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    errorResponse.error.message = "Internal server error";
    delete errorResponse.error.stack;
  } else if (process.env.NODE_ENV !== "production") {
    errorResponse.error.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found Handler
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${req.originalUrl} not found`,
    },
  });
};

module.exports = {
  errorHandler,
  notFound,
};
