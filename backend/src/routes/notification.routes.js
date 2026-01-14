const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validation");
const { body, param } = require("express-validator");

// All routes require authentication
router.use(authenticate);

// Get all notifications
router.get("/", notificationController.getNotifications);

// Mark single notification as read
router.patch(
  "/:id/read",
  [param("id").isMongoId().withMessage("Invalid notification ID")],
  validate,
  notificationController.markAsRead
);

// Mark all notifications as read
router.patch("/read-all", notificationController.markAllAsRead);

// Delete single notification
router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid notification ID")],
  validate,
  notificationController.deleteNotification
);

// Clear all read notifications
router.delete("/clear-read", notificationController.clearReadNotifications);

// Get notification preferences
router.get("/preferences", notificationController.getPreferences);

// Update notification preferences
router.put(
  "/preferences",
  [
    body("email").optional().isBoolean(),
    body("push").optional().isBoolean(),
    body("taskUpdates").optional().isBoolean(),
    body("paymentAlerts").optional().isBoolean(),
    body("messages").optional().isBoolean(),
  ],
  validate,
  notificationController.updatePreferences
);

module.exports = router;
