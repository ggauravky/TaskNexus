const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const { authenticate } = require("../middleware/auth");
const {
  requireRole,
  requireClient,
  requireFreelancer,
} = require("../middleware/roleCheck");
const validate = require("../middleware/validation");
const { body, query, param } = require("express-validator");

// Validation rules
const createTaskValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required")
    .isLength({ min: 5, max: 200 })
    .withMessage("Title must be between 5 and 200 characters"),
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Description is required")
    .isLength({ min: 20, max: 5000 })
    .withMessage("Description must be between 20 and 5000 characters"),
  body("category")
    .trim()
    .notEmpty()
    .withMessage("Category is required")
    .isIn([
      "web_development",
      "mobile_development",
      "design",
      "writing",
      "marketing",
      "data_entry",
      "video_editing",
      "other",
    ])
    .withMessage("Invalid category"),
  body("budget")
    .isFloat({ min: 10, max: 100000 })
    .withMessage("Budget must be between $10 and $100,000"),
  body("deadline")
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
];

const submitTaskValidation = [
  body("deliverables")
    .isArray({ min: 1 })
    .withMessage("At least one deliverable is required"),
  body("deliverables.*.url")
    .trim()
    .notEmpty()
    .withMessage("Deliverable URL is required"),
  body("deliverables.*.type")
    .isIn(["file", "link", "document"])
    .withMessage("Invalid deliverable type"),
];

// All routes require authentication
router.use(authenticate);

// Task statistics
router.get("/stats", taskController.getTaskStats);

// Get all tasks (role-filtered)
router.get("/", taskController.getTasks);

// Create new task (Client only)
router.post(
  "/",
  requireClient,
  createTaskValidation,
  validate,
  taskController.createTask
);

// Get specific task
router.get(
  "/:id",
  param("id").isMongoId().withMessage("Invalid task ID"),
  validate,
  taskController.getTaskById
);

// Update task (Client only)
router.put(
  "/:id",
  requireClient,
  param("id").isMongoId().withMessage("Invalid task ID"),
  validate,
  taskController.updateTask
);

// Delete/Cancel task (Client or Admin)
router.delete(
  "/:id",
  requireRole("client", "admin"),
  param("id").isMongoId().withMessage("Invalid task ID"),
  validate,
  taskController.deleteTask
);

// Submit task work (Freelancer only)
router.post(
  "/:id/submit",
  requireFreelancer,
  param("id").isMongoId().withMessage("Invalid task ID"),
  submitTaskValidation,
  validate,
  taskController.submitTask
);

module.exports = router;
