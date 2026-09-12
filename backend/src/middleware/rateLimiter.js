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

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: "Too many form submissions, please try again later",
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const githubVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.GITHUB_VERIFICATION_MAX_REQUESTS) || 20,
  message: {
    success: false,
    error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: "GitHub verification limit exceeded; try again later" },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const discoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.DISCOVERY_MAX_REQUESTS) || 180,
  message: { success: false, error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: "Discovery request limit exceeded; try again later" } },
  standardHeaders: true,
  legacyHeaders: false,
});

const collaborationRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: parseInt(process.env.COLLABORATION_REQUEST_MAX_PER_DAY) || 30,
  message: { success: false, error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: "Collaboration request limit exceeded; try again later" } },
  standardHeaders: true,
  legacyHeaders: false,
});

const hackathonMutationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.HACKATHON_MUTATION_MAX_PER_HOUR) || 60,
  message: { success: false, error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: "Hackathon action limit exceeded; try again later" } },
  standardHeaders: true,
  legacyHeaders: false,
});

const hackathonSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.HACKATHON_SUBMISSION_MAX_PER_HOUR) || 120,
  message: { success: false, error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: "Submission action limit exceeded; try again later" } },
  standardHeaders: true,
  legacyHeaders: false,
});

const opportunitySearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.OPPORTUNITY_SEARCH_MAX_REQUESTS) || 240,
  message: { success: false, error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: "Opportunity search limit exceeded; try again later" } },
  standardHeaders: true, legacyHeaders: false,
});

const opportunityCandidateMutationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.OPPORTUNITY_CANDIDATE_MUTATION_MAX_PER_HOUR) || 180,
  message: { success: false, error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: "Opportunity action limit exceeded; try again later" } },
  standardHeaders: true, legacyHeaders: false,
});

const opportunityCatalogLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.OPPORTUNITY_CATALOG_MAX_PER_HOUR) || 120,
  message: { success: false, error: { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: "Opportunity catalog limit exceeded; try again later" } },
  standardHeaders: true, legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  taskCreationLimiter,
  publicFormLimiter,
  githubVerificationLimiter,
  discoveryLimiter,
  collaborationRequestLimiter,
  hackathonMutationLimiter,
  hackathonSubmissionLimiter,
  opportunitySearchLimiter,
  opportunityCandidateMutationLimiter,
  opportunityCatalogLimiter,
};
