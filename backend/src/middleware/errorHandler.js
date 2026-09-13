const logger = require("../utils/logger");
const { ERROR_CODES } = require("../config/constants");

/**
 * Global Error Handler Middleware
 * Catches all errors and sends appropriate response
 */
const errorHandler = (err, req, res, _next) => {
  const safeUrl = String(req.originalUrl || req.path || "").split("?")[0];
  let statusCode = err.statusCode || err.status || 500;
  let code = err.code || ERROR_CODES.INTERNAL_SERVER_ERROR;
  let message = err.message || "Internal server error";
  let details = err.details;

  if (err instanceof SyntaxError && statusCode === 400) {
    code = ERROR_CODES.VALIDATION_FAILED;
    message = "Malformed JSON request body";
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_FAILED;
    message = "Request validation failed";
    details = Object.keys(err.errors || {}).map((field) => ({ field, message: err.errors[field].message }));
  } else if (err.name === "CastError") {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_FAILED;
    message = "Invalid resource identifier";
  } else if (err.code === 11000) {
    statusCode = 409;
    code = ERROR_CODES.CONFLICT;
    message = "Resource already exists";
  } else if (err.type === "entity.too.large" || err.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request payload is too large";
  } else if (err.name === "MulterError") {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_FAILED;
    message = "Invalid file upload";
  }

  const log = statusCode >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log("Request failed", {
    errorMessage: err.message,
    ...(statusCode >= 500 ? { stack: err.stack } : {}),
    url: safeUrl,
    method: req.method,
    requestId: req.requestId,
    statusCode,
    code,
  });

  let errorResponse = {
    success: false,
    error: {
      code,
      message,
      request_id: req.requestId,
    },
  };

  if (details) {
    errorResponse.error.details = details;
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
  if (process.env.NODE_ENV === "production" && statusCode >= 500) {
    if (statusCode === 500) errorResponse.error.message = "Internal server error";
    delete errorResponse.error.details;
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
