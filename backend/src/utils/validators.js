const { body, param } = require("express-validator");
const {
  PUBLIC_REGISTRATION_ROLES,
  TASK_TYPES,
  TASK_PRIORITY,
} = require("../config/constants");
const { findServiceBySlug } = require("../config/serviceCatalog");

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

  body("role")
    .isIn(PUBLIC_REGISTRATION_ROLES)
    .withMessage("Role must be client or freelancer"),

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
    .optional({ checkFalsy: true })
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

/**
 * Validation rules for public newsletter subscription
 */
const newsletterSubscribeValidation = [
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),
];

/**
 * Validation rules for public service booking
 */
const serviceBookingValidation = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("Full name must be between 2 and 120 characters"),

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("phone")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 30 })
    .withMessage("Phone number must be 30 characters or fewer"),

  body("serviceSlug")
    .trim()
    .notEmpty()
    .withMessage("Service selection is required")
    .custom((value) => {
      if (!findServiceBySlug(value)) {
        throw new Error("Choose a valid service option");
      }
      return true;
    }),

  body("preferredDate")
    .isISO8601()
    .withMessage("Preferred date must be a valid ISO date")
    .custom((value) => {
      const selectedDate = new Date(`${value}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (Number.isNaN(selectedDate.getTime()) || selectedDate < today) {
        throw new Error("Preferred date cannot be in the past");
      }
      return true;
    }),

  body("preferredTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage("Preferred time must be in HH:MM format"),

  body("timezone")
    .trim()
    .notEmpty()
    .withMessage("Timezone is required")
    .isLength({ max: 80 })
    .withMessage("Timezone must be 80 characters or fewer"),

  body("notes")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1200 })
    .withMessage("Notes must be 1200 characters or fewer"),
];

/**
 * Validation rules for support jar contributions
 */
const supportJarValidation = [
  body("fullName")
    .trim()
    .notEmpty()
    .withMessage("Full name is required")
    .isLength({ min: 2, max: 120 })
    .withMessage("Full name must be between 2 and 120 characters"),

  body("email")
    .isEmail()
    .withMessage("Please provide a valid email")
    .normalizeEmail(),

  body("amount")
    .isFloat({ min: 1 })
    .withMessage("Amount must be at least 1"),

  body("currency")
    .trim()
    .matches(/^[A-Za-z]{3}$/)
    .withMessage("Currency must be a 3-letter currency code"),

  body("message")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Message must be 1000 characters or fewer"),
];

module.exports = {
  registerValidation,
  loginValidation,
  createTaskValidation,
  taskIdValidation,
  submitWorkValidation,
  qaReviewValidation,
  reviewValidation,
  newsletterSubscribeValidation,
  serviceBookingValidation,
  supportJarValidation,
};
