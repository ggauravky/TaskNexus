const rateLimit = require("express-rate-limit");
const { ERROR_CODES } = require("../config/constants");

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  // Allow a healthier burst by default; override via env as needed
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: "Too many requests, please try again later",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict rate limiter for authentication routes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: "Too many login attempts, please try again after 15 minutes",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for task creation
 */
const taskCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 tasks per hour
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: "Task creation limit exceeded, please try again later",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  taskCreationLimiter,
};
