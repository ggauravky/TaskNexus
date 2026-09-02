const logger = require("../utils/logger");
const { ERROR_CODES } = require("../config/constants");

/**
 * Global Error Handler Middleware
 * Catches all errors and sends appropriate response
 */
const errorHandler = (err, req, res, _next) => {
  const safeUrl = String(req.originalUrl || req.path || "").split("?")[0];
  // Log error
  logger.error("Error:", {
    message: err.message,
    stack: err.stack,
    url: safeUrl,
    method: req.method,
    ip: req.ip,
    userId: req.userId,
    requestId: req.requestId,
  });

  // Default error
  let statusCode = err.statusCode || 500;
  let errorResponse = {
    success: false,
    error: {
      code: err.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: err.message || "Internal server error",
      request_id: req.requestId,
    },
  };

  if (err.details) {
    errorResponse.error.details = err.details;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    errorResponse.error = {
      code: ERROR_CODES.AUTHENTICATION_ERROR,
      message: "Invalid token",
      request_id: req.requestId,
    };
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    errorResponse.error = {
      code: ERROR_CODES.AUTHENTICATION_ERROR,
      message: "Token expired",
      request_id: req.requestId,
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
const notFound = (req, res, _next) => {
  res.status(404).json({
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${String(req.originalUrl || req.path || "").split("?")[0]} not found`,
      request_id: req.requestId,
    },
  });
};

module.exports = {
  errorHandler,
  notFound,
};
