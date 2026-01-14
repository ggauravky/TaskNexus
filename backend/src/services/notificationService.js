const Notification = require("../models/Notification");
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
} = require("../config/constants");
const logger = require("../utils/logger");

/**
 * Notification Service
 * Handles creation and management of notifications
 */
class NotificationService {
  /**
   * Create a notification
   */
  static async create(data) {
    try {
      return await Notification.createNotification(data);
    } catch (error) {
      logger.error("Error creating notification:", error);
      throw error;
    }
  }

  /**
   * Notify freelancer of task assignment
   */
  static async notifyTaskAssigned(task, freelancer) {
    return await this.create({
      recipient: freelancer._id,
      type: NOTIFICATION_TYPES.TASK_ASSIGNED,
      content: {
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${task.taskDetails.title}`,
        actionUrl: `/freelancer/tasks/${task._id}`,
        actionLabel: "View Task",
      },
      relatedTask: task._id,
      priority:
        task.priority === "urgent"
          ? NOTIFICATION_PRIORITY.HIGH
          : NOTIFICATION_PRIORITY.MEDIUM,
    });
  }

  /**
   * Notify admin of new task submission
   */
  static async notifyTaskSubmitted(task, adminId) {
    return await this.create({
      recipient: adminId,
      type: NOTIFICATION_TYPES.TASK_SUBMITTED,
      content: {
        title: "New Task Submitted",
        message: `A new task "${task.taskDetails.title}" has been submitted by ${task.client}`,
        actionUrl: `/admin/tasks/${task._id}`,
        actionLabel: "Review Task",
      },
      relatedTask: task._id,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    });
  }

  /**
   * Notify freelancer of QA feedback
   */
  static async notifyQAFeedback(submission, freelancer, approved) {
    const message = approved
      ? `Your submission has been approved by QA!`
      : `Your submission needs revision. Please check the feedback.`;

    return await this.create({
      recipient: freelancer._id,
      type: NOTIFICATION_TYPES.QA_FEEDBACK,
      content: {
        title: approved ? "Submission Approved" : "Revision Requested",
        message,
        actionUrl: `/freelancer/tasks/${submission.task}`,
        actionLabel: "View Details",
      },
      relatedTask: submission.task,
      priority: approved
        ? NOTIFICATION_PRIORITY.MEDIUM
        : NOTIFICATION_PRIORITY.HIGH,
    });
  }

  /**
   * Notify client of task delivery
   */
  static async notifyTaskDelivered(task, client) {
    return await this.create({
      recipient: client._id,
      type: NOTIFICATION_TYPES.CLIENT_APPROVAL,
      content: {
        title: "Task Delivered",
        message: `Your task "${task.taskDetails.title}" has been completed and is ready for review`,
        actionUrl: `/client/tasks/${task._id}`,
        actionLabel: "Review Delivery",
      },
      relatedTask: task._id,
      priority: NOTIFICATION_PRIORITY.HIGH,
    });
  }

  /**
   * Notify freelancer of payment release
   */
  static async notifyPaymentReleased(payment, freelancer) {
    return await this.create({
      recipient: freelancer._id,
      type: NOTIFICATION_TYPES.PAYMENT_RELEASED,
      content: {
        title: "Payment Released",
        message: `You received $${payment.amounts.freelancerPayout} for task completion`,
        actionUrl: `/freelancer/earnings`,
        actionLabel: "View Earnings",
      },
      relatedTask: payment.task,
      priority: NOTIFICATION_PRIORITY.HIGH,
    });
  }

  /**
   * Notify deadline reminder
   */
  static async notifyDeadlineReminder(task, freelancer) {
    const hoursRemaining = Math.floor(
      (new Date(task.taskDetails.deadline) - new Date()) / (1000 * 60 * 60)
    );

    return await this.create({
      recipient: freelancer._id,
      type: NOTIFICATION_TYPES.DEADLINE_REMINDER,
      content: {
        title: "Deadline Approaching",
        message: `Task "${task.taskDetails.title}" is due in ${hoursRemaining} hours`,
        actionUrl: `/freelancer/tasks/${task._id}`,
        actionLabel: "View Task",
      },
      relatedTask: task._id,
      priority: NOTIFICATION_PRIORITY.HIGH,
    });
  }

  /**
   * Notify client of revision request
   */
  static async notifyRevisionRequested(task, client) {
    return await this.create({
      recipient: client._id,
      type: NOTIFICATION_TYPES.REVISION_REQUESTED,
      content: {
        title: "Revision in Progress",
        message: `Your revision request for "${task.taskDetails.title}" is being worked on`,
        actionUrl: `/client/tasks/${task._id}`,
        actionLabel: "View Task",
      },
      relatedTask: task._id,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    });
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId, filters = {}) {
    const query = { recipient: userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    return await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit || 50)
      .populate("relatedTask", "taskId taskDetails.title status");
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: userId,
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    notification.markAsRead();
    await notification.save();

    return notification;
  }

  /**
   * Mark all as read
   */
  static async markAllAsRead(userId) {
    return await Notification.markAllAsRead(userId);
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId) {
    return await Notification.getUnreadCount(userId);
  }
}

module.exports = NotificationService;
