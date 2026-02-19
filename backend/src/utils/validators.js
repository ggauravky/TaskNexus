const { body, param, query } = require("express-validator");
const {
  USER_ROLES,
  TASK_TYPES,
  TASK_PRIORITY,
} = require("../config/constants");

/**
 * Validation rules for user registration
 */
const registerValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .trim(),

  body("role").isIn(Object.values(USER_ROLES)).withMessage("Invalid role"),

  body("profile.firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("profile.lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("profile.phone")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),
];

/**
 * Validation rules for login
 */
const loginValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),
];

/**
 * Validation rules for task creation
 */
const createTaskValidation = [
  body("taskDetails.title")
    .trim()
    .notEmpty()
    .withMessage("Task title is required")
    .isLength({ min: 10, max: 200 })
    .withMessage("Title must be between 10 and 200 characters"),

  body("taskDetails.type")
    .isIn(Object.values(TASK_TYPES))
    .withMessage("Invalid task type"),

  body("taskDetails.description")
    .trim()
    .notEmpty()
    .withMessage("Task description is required")
    .isLength({ min: 50 })
    .withMessage("Description must be at least 50 characters"),

  body("taskDetails.deadline")
    .isISO8601()
    .withMessage("Invalid deadline format")
    .custom((value) => {
      const deadline = new Date(value);
      const now = new Date();
      if (deadline <= now) {
        throw new Error("Deadline must be in the future");
      }
      return true;
    }),

  body("taskDetails.budget")
    .isFloat({ min: 1 })
    .withMessage("Budget must be at least $1"),

  body("priority")
    .optional()
    .isIn(Object.values(TASK_PRIORITY))
    .withMessage("Invalid priority"),
];

/**
 * Validation rules for task ID parameter
 */
const taskIdValidation = [
  param("id").isUUID().withMessage("Invalid task ID"),
];

/**
 * Validation rules for submission
 */
const submitWorkValidation = [
  body("content.description")
    .trim()
    .notEmpty()
    .withMessage("Submission description is required")
    .isLength({ min: 20 })
    .withMessage("Description must be at least 20 characters"),

  body("content.deliverables")
    .isArray({ min: 1 })
    .withMessage("At least one deliverable is required"),
];

/**
 * Validation rules for QA review
 */
const qaReviewValidation = [
  body("status")
    .isIn(["approved", "rejected"])
    .withMessage("Status must be approved or rejected"),

  body("feedback").trim().notEmpty().withMessage("Feedback is required"),

  body("qualityScore")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Quality score must be between 1 and 5"),
];

/**
 * Validation rules for review/rating
 */
const reviewValidation = [
  body("rating")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),

  body("feedback")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Feedback cannot exceed 1000 characters"),
];

module.exports = {
  registerValidation,
  loginValidation,
  createTaskValidation,
  taskIdValidation,
  submitWorkValidation,
  qaReviewValidation,
  reviewValidation,
};
