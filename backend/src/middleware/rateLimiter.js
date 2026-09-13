const rateLimit = require("express-rate-limit");
const { ERROR_CODES } = require("../config/constants");

const rateLimitHandler = (message) => (req, res) => {
  res.status(429).json({
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message,
      request_id: req.requestId,
    },
  });
};

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  // Allow a healthier burst by default; override via env as needed
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  handler: rateLimitHandler("Too many requests, please try again later"),
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
  handler: rateLimitHandler("Too many login attempts, please try again after 15 minutes"),
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for task creation
 */
const taskCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 tasks per hour
  handler: rateLimitHandler("Task creation limit exceeded, please try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  handler: rateLimitHandler("Too many form submissions, please try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const githubVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.GITHUB_VERIFICATION_MAX_REQUESTS) || 20,
  handler: rateLimitHandler("GitHub verification limit exceeded; try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const discoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.DISCOVERY_MAX_REQUESTS) || 180,
  handler: rateLimitHandler("Discovery request limit exceeded; try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const collaborationRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: parseInt(process.env.COLLABORATION_REQUEST_MAX_PER_DAY) || 30,
  handler: rateLimitHandler("Collaboration request limit exceeded; try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const hackathonMutationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.HACKATHON_MUTATION_MAX_PER_HOUR) || 60,
  handler: rateLimitHandler("Hackathon action limit exceeded; try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const hackathonSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.HACKATHON_SUBMISSION_MAX_PER_HOUR) || 120,
  handler: rateLimitHandler("Submission action limit exceeded; try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const opportunitySearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.OPPORTUNITY_SEARCH_MAX_REQUESTS) || 240,
  handler: rateLimitHandler("Opportunity search limit exceeded; try again later"),
  standardHeaders: true, legacyHeaders: false,
});

const opportunityCandidateMutationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.OPPORTUNITY_CANDIDATE_MUTATION_MAX_PER_HOUR) || 180,
  handler: rateLimitHandler("Opportunity action limit exceeded; try again later"),
  standardHeaders: true, legacyHeaders: false,
});

const opportunityCatalogLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.OPPORTUNITY_CATALOG_MAX_PER_HOUR) || 120,
  handler: rateLimitHandler("Opportunity catalog limit exceeded; try again later"),
  standardHeaders: true, legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_REFRESH_MAX_REQUESTS) || 30,
  handler: rateLimitHandler("Too many session refresh attempts, please try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const adminMutationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.ADMIN_MUTATION_MAX_PER_HOUR) || 120,
  handler: rateLimitHandler("Administrative action limit exceeded; try again later"),
  standardHeaders: true,
  legacyHeaders: false,
});

const organizationInvitationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.ORGANIZATION_INVITATION_MAX_PER_HOUR) || 60,
  handler: rateLimitHandler("Organization invitation limit exceeded; try again later"),
  standardHeaders: true, legacyHeaders: false,
});

const nativeApplicationSubmissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.NATIVE_APPLICATION_MAX_PER_HOUR) || 30,
  handler: rateLimitHandler("Native application submission limit exceeded; try again later"),
  standardHeaders: true, legacyHeaders: false,
});

const applicationStageMutationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.APPLICATION_STAGE_MUTATION_MAX_PER_HOUR) || 180,
  handler: rateLimitHandler("Application stage update limit exceeded; try again later"),
  standardHeaders: true, legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  refreshLimiter,
  adminMutationLimiter,
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
  organizationInvitationLimiter,
  nativeApplicationSubmissionLimiter,
  applicationStageMutationLimiter,
};
