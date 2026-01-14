const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/roleCheck");
const validate = require("../middleware/validation");
const { body, param, query } = require("express-validator");

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Dashboard
router.get("/dashboard", adminController.getDashboard);

// Users management
router.get("/users", adminController.getUsers);

router.patch(
  "/users/:id/status",
  [
    param("id").isMongoId().withMessage("Invalid user ID"),
    body("status")
      .isIn(["active", "suspended", "banned"])
      .withMessage("Invalid status"),
  ],
  validate,
  adminController.updateUserStatus
);

// Task management
router.post(
  "/tasks/:id/review",
  [
    param("id").isMongoId().withMessage("Invalid task ID"),
    body("action").isIn(["approve", "reject"]).withMessage("Invalid action"),
    body("reason").optional().trim(),
  ],
  validate,
  adminController.reviewTask
);

router.post(
  "/tasks/:id/assign",
  [
    param("id").isMongoId().withMessage("Invalid task ID"),
    body("freelancerId").isMongoId().withMessage("Invalid freelancer ID"),
  ],
  validate,
  adminController.assignTask
);

// Audit logs
router.get("/audit-logs", adminController.getAuditLogs);

// Statistics
router.get("/statistics", adminController.getStatistics);

// Dispute resolution
router.post(
  "/disputes/:id/resolve",
  [
    param("id").isMongoId().withMessage("Invalid dispute ID"),
    body("resolution").trim().notEmpty().withMessage("Resolution is required"),
    body("refundClient").optional().isBoolean(),
    body("payFreelancer").optional().isBoolean(),
    body("notes").optional().trim(),
  ],
  validate,
  adminController.resolveDispute
);

module.exports = router;
