const notificationData = require("../data/notificationData");
const userData = require("../data/userData");
const logger = require("../utils/logger");

/**
 * @desc    Get all notifications for current user
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const { unreadOnly = false } = req.query;

    const filters = { recipient_id: req.user.id };

    if (unreadOnly === "true") {
      filters.status = "unread";
    }

    const notifications = await notificationData.findNotifications(filters);
    const unreadCount = notifications.filter(n => n.status === 'unread').length;

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    logger.error("Error fetching notifications:", error);
    next(error);
  }
};

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await notificationData.findNotifications({ id: req.params.id, recipient_id: req.user.id });

    if (notification.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    const updatedNotification = await notificationData.updateNotification(req.params.id, { status: "read", read_at: new Date() });

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: updatedNotification,
    });
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    next(error);
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    const result = await notificationData.updateManyNotifications(
      { recipient_id: req.user.id, status: "unread" },
      { status: "read", read_at: new Date() }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: { modifiedCount: result.length },
    });
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    next(error);
  }
};

/**
 * @desc    Delete notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await notificationData.findNotifications({ id: req.params.id, recipient_id: req.user.id });

    if (notification.length === 0) {
        return res.status(404).json({
            success: false,
            message: "Notification not found",
        });
    }

    await notificationData.deleteNotification(req.params.id);

    res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    logger.error("Error deleting notification:", error);
    next(error);
  }
};

/**
 * @desc    Delete all read notifications
 * @route   DELETE /api/notifications/clear-read
 * @access  Private
 */
exports.clearReadNotifications = async (req, res, next) => {
  try {
    const result = await notificationData.deleteManyNotifications({
      recipient_id: req.user.id,
      status: "read",
    });

    res.status(200).json({
      success: true,
      message: "Read notifications cleared",
      data: { deletedCount: result.length },
    });
  } catch (error) {
    logger.error("Error clearing read notifications:", error);
    next(error);
  }
};

/**
 * @desc    Get notification preferences
 * @route   GET /api/notifications/preferences
 * @access  Private
 */
exports.getPreferences = async (req, res, next) => {
  try {
    const user = await userData.findUserById(req.user.id);
    const preferences = user.notification_preferences || {
      email: true,
      push: true,
      taskUpdates: true,
      paymentAlerts: true,
      messages: true,
    };

    res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    logger.error("Error fetching notification preferences:", error);
    next(error);
  }
};

/**
 * @desc    Update notification preferences
 * @route   PUT /api/notifications/preferences
 * @access  Private
 */
exports.updatePreferences = async (req, res, next) => {
  try {
    const { email, push, taskUpdates, paymentAlerts, messages } = req.body;

    const user = await userData.findUserById(req.user.id);

    const preferences = user.notification_preferences || {};
    
    preferences.email = email !== undefined ? email : preferences.email;
    preferences.push = push !== undefined ? push : preferences.push;
    preferences.taskUpdates = taskUpdates !== undefined ? taskUpdates : preferences.taskUpdates;
    preferences.paymentAlerts = paymentAlerts !== undefined ? paymentAlerts : preferences.paymentAlerts;
    preferences.messages = messages !== undefined ? messages : preferences.messages;

    const updatedUser = await userData.updateUser(req.user.id, { notification_preferences: preferences });

    logger.info(`Notification preferences updated for user: ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      data: updatedUser.notification_preferences,
    });
  } catch (error) {
    logger.error("Error updating notification preferences:", error);
    next(error);
  }
};
