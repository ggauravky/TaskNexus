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
const { commentAttachmentUpload } = require("../middleware/upload");

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
    .withMessage("Description must be between 20 and 5000 characters")
    .customSanitizer((value) => {
      // Remove any potential error stack traces or excessive whitespace
      return value.trim().replace(/\s+/g, " ");
    }),
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
  taskController.createTask,
);

// Get specific task
router.get(
  "/:id",
  param("id").isUUID().withMessage("Invalid task ID"),
  validate,
  taskController.getTaskById,
);

// Update task (Client only)
router.put(
  "/:id",
  requireClient,
  param("id").isUUID().withMessage("Invalid task ID"),
  validate,
  taskController.updateTask,
);

// Delete/Cancel task (Client or Admin)
router.delete(
  "/:id",
  requireRole("client", "admin"),
  param("id").isUUID().withMessage("Invalid task ID"),
  validate,
  taskController.deleteTask,
);

// Submit task work (Freelancer only)
router.post(
  "/:id/submit",
  requireFreelancer,
  param("id").isUUID().withMessage("Invalid task ID"),
  submitTaskValidation,
  validate,
  taskController.submitTask,
);

// Collaboration comments + mentions + attachments
router.get(
  "/:id/comments",
  [param("id").isUUID().withMessage("Invalid task ID")],
  validate,
  taskController.getTaskComments,
);

router.post(
  "/:id/comments",
  [param("id").isUUID().withMessage("Invalid task ID")],
  validate,
  commentAttachmentUpload.array("attachments", 5),
  taskController.addTaskComment,
);

router.get(
  "/:id/activity",
  [param("id").isUUID().withMessage("Invalid task ID")],
  validate,
  taskController.getTaskActivity,
);

// Subtasks and milestones
router.get(
  "/:id/subtasks",
  [param("id").isUUID().withMessage("Invalid task ID")],
  validate,
  taskController.getSubtasks,
);

router.post(
  "/:id/subtasks",
  [
    param("id").isUUID().withMessage("Invalid task ID"),
    body("title")
      .trim()
      .notEmpty()
      .withMessage("Subtask title is required")
      .isLength({ max: 200 })
      .withMessage("Subtask title must be at most 200 characters"),
    body("description")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description must be at most 2000 characters"),
    body("weight")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Weight must be between 0 and 100"),
    body("dueDate").optional({ nullable: true }).isISO8601(),
  ],
  validate,
  taskController.createSubtask,
);

router.patch(
  "/:id/subtasks/:subtaskId",
  [
    param("id").isUUID().withMessage("Invalid task ID"),
    param("subtaskId").trim().notEmpty().withMessage("Subtask ID is required"),
    body("title")
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage("Subtask title must be between 1 and 200 characters"),
    body("description")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description must be at most 2000 characters"),
    body("weight")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Weight must be between 0 and 100"),
    body("dueDate").optional({ nullable: true }).isISO8601(),
    body("completed").optional().isBoolean(),
    body("order").optional().isInt({ min: 0 }),
  ],
  validate,
  taskController.updateSubtask,
);

router.delete(
  "/:id/subtasks/:subtaskId",
  [
    param("id").isUUID().withMessage("Invalid task ID"),
    param("subtaskId").trim().notEmpty().withMessage("Subtask ID is required"),
  ],
  validate,
  taskController.deleteSubtask,
);

module.exports = router;
