const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientController");
const { authenticate } = require("../middleware/auth");
const { requireClient } = require("../middleware/roleCheck");
const validate = require("../middleware/validation");
const { body, param, query } = require("express-validator");

// All routes require authentication and client role
router.use(authenticate);
router.use(requireClient);

// Dashboard
router.get("/dashboard", clientController.getDashboard);

// Analytics
router.get("/analytics", clientController.getAnalytics);

// Profile
router.get("/profile", clientController.getProfile);
router.put(
  "/profile",
  [
    body("firstName").optional({ checkFalsy: true }).trim(),
    body("lastName").optional({ checkFalsy: true }).trim(),
    body("phone").optional({ checkFalsy: true }).trim(),
    body("avatar").optional({ checkFalsy: true }).trim().isURL(),
  ],
  validate,
  clientController.updateProfile,
);

// Tasks
router.get(
  "/tasks",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().trim(),
    query("type").optional().trim(),
    query("search").optional().trim(),
    query("sortBy").optional().trim(),
    query("sortOrder").optional().isIn(["asc", "desc"]),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
  ],
  validate,
  clientController.getTasks,
);

router.get(
  "/tasks/:id",
  [param("id").isMongoId().withMessage("Invalid task ID")],
  validate,
  clientController.getTaskDetails,
);

// Submissions
router.get(
  "/submissions",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().trim(),
    query("taskId").optional().isMongoId(),
    query("sortBy").optional().trim(),
    query("sortOrder").optional().isIn(["asc", "desc"]),
  ],
  validate,
  clientController.getSubmissions,
);

router.get(
  "/submissions/:id",
  [param("id").isMongoId().withMessage("Invalid submission ID")],
  validate,
  clientController.getSubmissionDetails,
);

// Review submission
router.post(
  "/submissions/:id/review",
  [
    param("id").isMongoId().withMessage("Invalid submission ID"),
    body("action")
      .isIn(["approve", "request_revision"])
      .withMessage("Invalid action"),
    body("feedback").optional().trim(),
    body("revisionRequested").optional().trim(),
  ],
  validate,
  clientController.reviewSubmission,
);

// Rate freelancer
router.post(
  "/rate-freelancer",
  [
    body("taskId").isMongoId().withMessage("Invalid task ID"),
    body("rating")
      .isInt({ min: 1, max: 5 })
      .withMessage("Rating must be between 1 and 5"),
    body("feedback").optional().trim(),
  ],
  validate,
  clientController.rateFreelancer,
);

// Payments
router.get(
  "/payments",
  [
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
    query("status").optional().trim(),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    query("sortBy").optional().trim(),
    query("sortOrder").optional().isIn(["asc", "desc"]),
  ],
  validate,
  clientController.getPayments,
);

router.get(
  "/payments/:id",
  [param("id").isMongoId().withMessage("Invalid payment ID")],
  validate,
  clientController.getPaymentDetails,
);

module.exports = router;
