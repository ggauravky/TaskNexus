const { ERROR_CODES } = require("../config/constants");

class AppError extends Error {
  constructor(code, message, statusCode = 500, details = null) {
    super(message);
    this.name = "AppError";
    this.code = code || ERROR_CODES.INTERNAL_SERVER_ERROR;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const errors = {
  notFound: (message = "Resource not found", details = null) =>
    new AppError(ERROR_CODES.NOT_FOUND, message, 404, details),
  forbidden: (message = "Forbidden", details = null) =>
    new AppError(ERROR_CODES.FORBIDDEN, message, 403, details),
  conflict: (message = "Resource conflict", details = null) =>
    new AppError(ERROR_CODES.CONFLICT, message, 409, details),
  invalidTransition: (message, details = null) =>
    new AppError(ERROR_CODES.INVALID_STATE_TRANSITION, message, 409, details),
  validation: (message = "Validation failed", details = null) =>
    new AppError(ERROR_CODES.VALIDATION_FAILED, message, 400, details),
};

module.exports = { AppError, errors };
