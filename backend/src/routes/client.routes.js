const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientController");
const { authenticate } = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");
const validate = require("../middleware/validation");
const { body, param, query } = require("express-validator");

// All routes require authentication and client role
router.use(authenticate);
router.use(checkRole(["client"]));

// Dashboard
router.get("/dashboard", clientController.getDashboard);

// Submissions
router.get("/submissions", clientController.getSubmissions);

// Review submission
router.post(
  "/submissions/:id/review",
  [
    param("id").isMongoId().withMessage("Invalid submission ID"),
    body("action")
      .isIn(["approve", "reject", "request_revision"])
      .withMessage("Invalid action"),
    body("feedback").optional().trim(),
    body("revisionRequested").optional().trim(),
  ],
  validate,
  clientController.reviewSubmission
);

// Rate freelancer
router.post(
  "/rate-freelancer",
  [
    body("taskId").isMongoId().withMessage("Invalid task ID"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("comment").optional().trim(),
  ],
  validate,
  clientController.rateFreelancer
);

// Payment history
router.get("/payments", clientController.getPayments);

module.exports = router;
