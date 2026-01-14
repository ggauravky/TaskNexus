const Notification = require("../models/Notification");
const logger = require("../utils/logger");

/**
 * @desc    Get all notifications for current user
 * @route   GET /api/notifications
 * @access  Private
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;

    const query = { userId: req.user._id };

    if (unreadOnly === "true") {
      query.read = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
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
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Verify ownership
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
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
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: { modifiedCount: result.modifiedCount },
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
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    // Verify ownership
    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    await notification.deleteOne();

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
    const result = await Notification.deleteMany({
      userId: req.user._id,
      read: true,
    });

    res.status(200).json({
      success: true,
      message: "Read notifications cleared",
      data: { deletedCount: result.deletedCount },
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
    // In a full implementation, this would fetch from a NotificationPreferences model
    // For now, return default preferences from user model if they exist
    const preferences = req.user.notificationPreferences || {
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

    // In a full implementation, this would update a NotificationPreferences model
    // For now, update user model
    const User = require("../models/User");
    const user = await User.findById(req.user._id);

    user.notificationPreferences = {
      email:
        email !== undefined
          ? email
          : user.notificationPreferences?.email || true,
      push:
        push !== undefined ? push : user.notificationPreferences?.push || true,
      taskUpdates:
        taskUpdates !== undefined
          ? taskUpdates
          : user.notificationPreferences?.taskUpdates || true,
      paymentAlerts:
        paymentAlerts !== undefined
          ? paymentAlerts
          : user.notificationPreferences?.paymentAlerts || true,
      messages:
        messages !== undefined
          ? messages
          : user.notificationPreferences?.messages || true,
    };

    await user.save();

    logger.info(`Notification preferences updated for user: ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      data: user.notificationPreferences,
    });
  } catch (error) {
    logger.error("Error updating notification preferences:", error);
    next(error);
  }
};
