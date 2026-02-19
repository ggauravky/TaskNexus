const express = require("express");
const router = express.Router();
const freelancerController = require("../controllers/freelancerController");
const { authenticate } = require("../middleware/auth");
const { requireFreelancer } = require("../middleware/roleCheck");
const validate = require("../middleware/validation");
const { body, param } = require("express-validator");

// All routes require authentication and freelancer role
router.use(authenticate);
router.use(requireFreelancer);

// Dashboard
router.get("/dashboard", freelancerController.getDashboard);

// Available tasks
router.get("/available-tasks", freelancerController.getAvailableTasks);

// My tasks
router.get("/my-tasks", freelancerController.getMyTasks);

// Accept a task
router.post(
  "/tasks/:id/accept",
  [param("id").notEmpty().withMessage("Task ID is required")],
  validate,
  freelancerController.acceptTask
);

// Start working on a task
router.put(
  "/tasks/:id/start",
  [param("id").notEmpty().withMessage("Task ID is required")],
  validate,
  freelancerController.startTask
);

// Cancel / unaccept a task
router.put(
  "/tasks/:id/cancel",
  [param("id").notEmpty().withMessage("Task ID is required")],
  validate,
  freelancerController.cancelTask
);

// Update task progress
router.put(
  "/tasks/:id/progress",
  [
    param("id").notEmpty().withMessage("Task ID is required"),
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
      .isArray()
      .withMessage("Deliverables must be an array"),
    body("comments").optional().trim(),
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
    body("availability").optional().isString(),
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
