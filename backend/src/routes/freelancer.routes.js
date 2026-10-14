const express = require("express");
const router = express.Router();
const freelancerController = require("../controllers/freelancerController");
const { authenticate } = require("../middleware/auth");
const { requireFreelancer } = require("../middleware/roleCheck");
const validate = require("../middleware/validation");
const { body, param, query } = require("express-validator");
const { raw: domain } = require("../contracts/domain");

const taskListValidation = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("search").optional().trim().isLength({ max: 200 }),
  query("sortBy").optional().trim(),
  query("sortOrder").optional().isIn(["asc", "desc"]),
];

// All routes require authentication and freelancer role
router.use(authenticate);
router.use(requireFreelancer);

// Dashboard
router.get("/dashboard", freelancerController.getDashboard);

// Available tasks
router.get("/available-tasks", taskListValidation, validate, freelancerController.getAvailableTasks);

// My tasks
router.get("/my-tasks", taskListValidation, validate, freelancerController.getMyTasks);

// Accept a task
router.post(
  "/tasks/:id/accept",
  [param("id").isUUID().withMessage("Invalid task ID")],
  validate,
  freelancerController.acceptTask
);

// Start working on a task
router.put(
  "/tasks/:id/start",
  [param("id").isUUID().withMessage("Invalid task ID")],
  validate,
  freelancerController.startTask
);

// Cancel / unaccept a task
router.put(
  "/tasks/:id/cancel",
  [param("id").isUUID().withMessage("Invalid task ID")],
  validate,
  freelancerController.cancelTask
);

// Update task progress
router.put(
  "/tasks/:id/progress",
  [
    param("id").isUUID().withMessage("Invalid task ID"),
    body("progress").isNumeric().withMessage("Progress must be a number"),
    body("stage").optional().isString(),
    body("note").optional().isString(),
  ],
  validate,
  freelancerController.updateProgress
);

// Update submission
router.put(
  "/submissions/:id",
  [
    param("id").isUUID().withMessage("Invalid submission ID"),
    body("deliverables")
      .optional()
      .isArray({ min: 1 })
      .withMessage("Deliverables must be an array"),
    body("deliverables.*.url")
      .optional()
      .trim()
      .isURL({ protocols: ["https"], require_protocol: true })
      .withMessage("Deliverable URL must use HTTPS"),
    body("deliverables.*.type")
      .optional()
      .isIn(["file", "link", "document"])
      .withMessage("Invalid deliverable type"),
    body("comments").optional().trim().isLength({ max: 3000 }).withMessage("Comments must be under 3000 characters"),
  ],
  validate,
  freelancerController.updateSubmission
);

// Earnings
router.get("/earnings", freelancerController.getEarnings);

// Reviews
router.get("/reviews", freelancerController.getReviews);

// Profile
router.get("/profile", freelancerController.getProfile);
router.put(
  "/profile",
  [
    body("firstName").optional().isString(),
    body("lastName").optional().isString(),
    body("phone").optional().isString(),
    body("avatar").optional().isString(),
    body("title").optional().isString(),
    body("bio").optional().isString(),
    body("skills").optional(),
    body("hourlyRate").optional().isNumeric(),
    body("availability").optional().isIn(domain.freelancerAvailability),
    body("location").optional().isString(),
    body("experienceLevel").optional().isString(),
    body("website").optional().isString(),
    body("linkedin").optional().isString(),
    body("portfolio").optional().isString(),
  ],
  validate,
  freelancerController.updateProfile
);

module.exports = router;
