const notificationData = require("../data/notificationData");
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
      return await notificationData.createNotification(data);
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
      recipient_id: freelancer.id,
      type: NOTIFICATION_TYPES.TASK_ASSIGNED,
      content: {
        title: "New Task Assigned",
        message: `You have been assigned a new task: ${task.task_details.title}`,
        actionUrl: `/freelancer/tasks/${task.id}`,
        actionLabel: "View Task",
      },
      related_task_id: task.id,
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
      recipient_id: adminId,
      type: NOTIFICATION_TYPES.TASK_SUBMITTED,
      content: {
        title: "New Task Submitted",
        message: `A new task "${task.task_details.title}" has been submitted by ${task.client_id}`,
        actionUrl: `/admin/tasks/${task.id}`,
        actionLabel: "Review Task",
      },
      related_task_id: task.id,
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
      recipient_id: freelancer.id,
      type: NOTIFICATION_TYPES.QA_FEEDBACK,
      content: {
        title: approved ? "Submission Approved" : "Revision Requested",
        message,
        actionUrl: `/freelancer/tasks/${submission.task_id}`,
        actionLabel: "View Details",
      },
      related_task_id: submission.task_id,
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
      recipient_id: client.id,
      type: NOTIFICATION_TYPES.CLIENT_APPROVAL,
      content: {
        title: "Task Delivered",
        message: `Your task "${task.task_details.title}" has been completed and is ready for review`,
        actionUrl: `/client/tasks/${task.id}`,
        actionLabel: "Review Delivery",
      },
      related_task_id: task.id,
      priority: NOTIFICATION_PRIORITY.HIGH,
    });
  }

  /**
   * Notify freelancer of payment release
   */
  static async notifyPaymentReleased(payment, freelancer) {
    return await this.create({
      recipient_id: freelancer.id,
      type: NOTIFICATION_TYPES.PAYMENT_RELEASED,
      content: {
        title: "Payment Released",
        message: `You received $${payment.amounts.freelancerPayout} for task completion`,
        actionUrl: `/freelancer/earnings`,
        actionLabel: "View Earnings",
      },
      related_task_id: payment.task_id,
      priority: NOTIFICATION_PRIORITY.HIGH,
    });
  }

  /**
   * Notify deadline reminder
   */
  static async notifyDeadlineReminder(task, freelancer) {
    const hoursRemaining = Math.floor(
      (new Date(task.task_details.deadline) - new Date()) / (1000 * 60 * 60)
    );

    return await this.create({
      recipient_id: freelancer.id,
      type: NOTIFICATION_TYPES.DEADLINE_REMINDER,
      content: {
        title: "Deadline Approaching",
        message: `Task "${task.task_details.title}" is due in ${hoursRemaining} hours`,
        actionUrl: `/freelancer/tasks/${task.id}`,
        actionLabel: "View Task",
      },
      related_task_id: task.id,
      priority: NOTIFICATION_PRIORITY.HIGH,
    });
  }

  /**
   * Notify client of revision request
   */
  static async notifyRevisionRequested(task, client) {
    return await this.create({
      recipient_id: client.id,
      type: NOTIFICATION_TYPES.REVISION_REQUESTED,
      content: {
        title: "Revision in Progress",
        message: `Your revision request for "${task.task_details.title}" is being worked on`,
        actionUrl: `/client/tasks/${task.id}`,
        actionLabel: "View Task",
      },
      related_task_id: task.id,
      priority: NOTIFICATION_PRIORITY.MEDIUM,
    });
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId, filters = {}) {
    const query = { recipient_id: userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    return await notificationData.findNotifications(query);
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    const notifications = await notificationData.findNotifications({
      id: notificationId,
      recipient_id: userId,
    });

    if (notifications.length === 0) {
      throw new Error("Notification not found");
    }
    
    return await notificationData.updateNotification(notificationId, { status: "read", read_at: new Date() });
  }

  /**
   * Mark all as read
   */
  static async markAllAsRead(userId) {
    return await notificationData.updateManyNotifications({ recipient_id: userId }, { status: "read", read_at: new Date() });
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(userId) {
    const notifications = await notificationData.findNotifications({
        recipient_id: userId,
        status: "unread",
    });
    return notifications.length;
  }
}

module.exports = NotificationService;
