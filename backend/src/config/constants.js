/**
 * Application-wide constants
 * Centralized configuration for business rules and enums
 */

const USER_ROLES = {
  CLIENT: "client",
  FREELANCER: "freelancer",
  ADMIN: "admin",
};

const USER_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  BLOCKED: "blocked",
};

const TASK_STATUS = {
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  SUBMITTED_WORK: "submitted_work",
  QA_REVIEW: "qa_review",
  REVISION_REQUESTED: "revision_requested",
  DELIVERED: "delivered",
  CLIENT_REVISION: "client_revision",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  DISPUTED: "disputed",
};

const TASK_TYPES = {
  VIDEO_EDITING: "video-editing",
  WEB_DEVELOPMENT: "web-development",
  DESIGN: "design",
  WRITING: "writing",
  OTHER: "other",
};

const TASK_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

const SUBMISSION_TYPE = {
  INITIAL: "initial",
  REVISION: "revision",
};

const QA_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const CLIENT_REVIEW_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REVISION_REQUESTED: "revision_requested",
};

const PAYMENT_STATUS = {
  PENDING: "pending",
  ESCROWED: "escrowed",
  RELEASED: "released",
  REFUNDED: "refunded",
};

const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: "task_assigned",
  TASK_SUBMITTED: "task_submitted",
  QA_FEEDBACK: "qa_feedback",
  CLIENT_APPROVAL: "client_approval",
  REVISION_REQUESTED: "revision_requested",
  PAYMENT_RELEASED: "payment_released",
  DEADLINE_REMINDER: "deadline_reminder",
  TASK_CANCELLED: "task_cancelled",
  DISPUTE_RAISED: "dispute_raised",
  ACCOUNT_WARNING: "account_warning",
};

const NOTIFICATION_STATUS = {
  UNREAD: "unread",
  READ: "read",
};

const NOTIFICATION_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

const REVIEW_TYPE = {
  CLIENT_TO_PLATFORM: "client_to_platform",
  PLATFORM_TO_FREELANCER: "platform_to_freelancer",
};

// Business Rules
const BUSINESS_RULES = {
  PLATFORM_COMMISSION:
    parseFloat(process.env.PLATFORM_COMMISSION_PERCENTAGE) || 15,
  DEFAULT_REVISION_LIMIT: parseInt(process.env.DEFAULT_REVISION_LIMIT) || 2,
  QA_REVIEW_SLA_HOURS: parseInt(process.env.QA_REVIEW_SLA_HOURS) || 12,
  DISPUTE_RESOLUTION_SLA_HOURS:
    parseInt(process.env.DISPUTE_RESOLUTION_SLA_HOURS) || 48,
  DEADLINE_WARNING_HOURS: 24,
  REVISION_DEADLINE_EXTENSION_HOURS: 48,
  MISSED_DEADLINE_PENALTY: 5,
  SUSPENSION_THRESHOLD_MISSED_DEADLINES: 3,
  MIN_PERFORMANCE_SCORE: 0,
  MAX_PERFORMANCE_SCORE: 100,
  MIN_RATING: 1,
  MAX_RATING: 5,
  PASSWORD_MIN_LENGTH: 8,
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
  ALLOWED_FILE_TYPES: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "video/mp4",
    "video/quicktime",
    "application/zip",
  ],
};

// Task State Machine - Valid state transitions
const TASK_STATE_TRANSITIONS = {
  [TASK_STATUS.SUBMITTED]: [TASK_STATUS.UNDER_REVIEW, TASK_STATUS.CANCELLED],
  [TASK_STATUS.UNDER_REVIEW]: [TASK_STATUS.ASSIGNED, TASK_STATUS.CANCELLED],
  [TASK_STATUS.ASSIGNED]: [TASK_STATUS.IN_PROGRESS, TASK_STATUS.CANCELLED],
  [TASK_STATUS.IN_PROGRESS]: [
    TASK_STATUS.SUBMITTED_WORK,
    TASK_STATUS.CANCELLED,
  ],
  [TASK_STATUS.SUBMITTED_WORK]: [TASK_STATUS.QA_REVIEW],
  [TASK_STATUS.QA_REVIEW]: [
    TASK_STATUS.DELIVERED,
    TASK_STATUS.REVISION_REQUESTED,
    TASK_STATUS.ASSIGNED, // Reassignment
  ],
  [TASK_STATUS.REVISION_REQUESTED]: [TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.DELIVERED]: [
    TASK_STATUS.COMPLETED,
    TASK_STATUS.CLIENT_REVISION,
    TASK_STATUS.DISPUTED,
  ],
  [TASK_STATUS.CLIENT_REVISION]: [TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.DISPUTED]: [TASK_STATUS.QA_REVIEW, TASK_STATUS.CANCELLED],
  [TASK_STATUS.COMPLETED]: [], // Final state
  [TASK_STATUS.CANCELLED]: [], // Final state
};

// Assignment scoring weights
const ASSIGNMENT_WEIGHTS = {
  PERFORMANCE_SCORE: 0.4,
  SKILL_MATCH: 0.3,
  AVAILABILITY: 0.2,
  COMPLETION_RATE: 0.1,
};

// Performance score calculation weights
const PERFORMANCE_WEIGHTS = {
  ON_TIME_COMPLETION: 0.4,
  FIRST_TIME_APPROVAL: 0.3,
  CLIENT_SATISFACTION: 0.2,
  QA_PASS_RATE: 0.1,
};

// Error codes
const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE_ERROR: "DUPLICATE_ERROR",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  FILE_UPLOAD_ERROR: "FILE_UPLOAD_ERROR",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
};

module.exports = {
  USER_ROLES,
  USER_STATUS,
  TASK_STATUS,
  TASK_TYPES,
  TASK_PRIORITY,
  SUBMISSION_TYPE,
  QA_STATUS,
  CLIENT_REVIEW_STATUS,
  PAYMENT_STATUS,
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  NOTIFICATION_PRIORITY,
  REVIEW_TYPE,
  BUSINESS_RULES,
  TASK_STATE_TRANSITIONS,
  ASSIGNMENT_WEIGHTS,
  PERFORMANCE_WEIGHTS,
  ERROR_CODES,
};
