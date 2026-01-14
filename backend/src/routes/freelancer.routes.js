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
  [param("id").isMongoId().withMessage("Invalid task ID")],
  validate,
  freelancerController.acceptTask
);

// Update submission
router.put(
  "/submissions/:id",
  [
    param("id").isMongoId().withMessage("Invalid submission ID"),
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

module.exports = router;
