const taskData = require("../data/taskData");
const userData = require("../data/userData");
const paymentData = require("../data/paymentData");
const auditLogData = require("../data/auditLogData");
const submissionData = require("../data/submissionData");
const reviewData = require("../data/reviewData");
const logger = require("../utils/logger");
const NotificationService = require("../services/notificationService");
const AssignmentService = require("../services/assignmentService");

/**
 * @desc    Get admin dashboard overview
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const users = await userData.findUsers({});
    const tasks = await taskData.findTasks({});
    const payments = await paymentData.findPayments({});

    const totalUsers = users.length;
    const totalClients = users.filter((u) => u.role === "client").length;
    const totalFreelancers = users.filter((u) => u.role === "freelancer").length;
    const totalTasks = tasks.length;

    const recentTasks = tasks.slice(0, 10);

    const platformRevenue = payments
        .filter((p) => p.status === "released")
        .reduce((sum, p) => sum + (p.amounts?.platformFee || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          clients: totalClients,
          freelancers: totalFreelancers,
        },
        tasks: {
          total: totalTasks,
        },
        platformRevenue,
        recentTasks,
      },
    });
  } catch (error) {
    logger.error("Error fetching admin dashboard:", error);
    next(error);
  }
};

/**
 * @desc    Get all users with filtering
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { role, status, search } = req.query;

    const filters = {};

    if (role) {
      filters.role = role;
    }

    if (status) {
      filters.status = status;
    }
    
    // Search is not implemented in the new data layer yet
    if (search) {
        console.warn("Search functionality is not implemented yet");
    }

    const users = await userData.findUsers(filters);

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    logger.error("Error fetching users:", error);
    next(error);
  }
};

/**
 * @desc    Update user status (suspend/activate)
 * @route   PATCH /api/admin/users/:id/status
 * @access  Private (Admin)
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["active", "suspended", "banned"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const user = await userData.findUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot modify admin user status",
      });
    }

    const updatedUser = await userData.updateUser(req.params.id, { status });

    await NotificationService.create({
      recipient_id: user.id,
      type: "account_status_changed",
      content: {
        title: "Account Status Changed",
        message: `Your account status has been changed to: ${status}`,
      },
    });

    await auditLogData.log({
      user_id: req.user.id,
      action: "user_status_updated",
      resource: "user",
      resource_id: user.id,
      changes: { oldStatus: user.status, newStatus: status },
      ip_address: req.ip,
    });

    logger.info(`User status updated: ${user.id} to ${status}`);

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    logger.error("Error updating user status:", error);
    next(error);
  }
};

/**
 * @desc    Review and approve/reject task submission
 * @route   POST /api/admin/tasks/:id/review
 * @access  Private (Admin)
 */
exports.reviewTask = async (req, res, next) => {
  try {
    const { action, reason } = req.body;

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      });
    }

    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.status !== "submitted") {
      return res.status(400).json({
        success: false,
        message: "Task is not pending review",
      });
    }

    if (action === "approve") {
      const updatedTask = await taskService.transitionTo(task.id, "under_review");

      await NotificationService.create({
        recipient_id: task.client_id,
        type: "task_approved",
        content: {
            title: "Task Approved",
            message: `Your task "${task.task_details.title}" has been approved and is now available`,
        },
        related_task_id: task.id,
      });

      logger.info(`Task approved: ${task.id}`);
      res.status(200).json({
        success: true,
        message: `Task approved successfully`,
        data: updatedTask,
      });
    } else {
        const updatedTask = await taskData.updateTask(task.id, {
            status: "rejected",
            cancellation_reason: reason || "Task does not meet platform guidelines",
        });

      await NotificationService.create({
        recipient_id: task.client_id,
        type: "task_rejected",
        content: {
            title: "Task Rejected",
            message: `Your task "${task.task_details.title}" has been rejected. Reason: ${reason}`,
        },
        related_task_id: task.id,
      });

      logger.info(`Task rejected: ${task.id}`);
        res.status(200).json({
            success: true,
            message: `Task rejected successfully`,
            data: updatedTask,
        });
    }

    await auditLogData.log({
      user_id: req.user.id,
      action: `task_${action}`,
      resource: "task",
      resource_id: task.id,
      changes: { reason },
      ip_address: req.ip,
    });

  } catch (error) {
    logger.error("Error reviewing task:", error);
    next(error);
  }
};

/**
 * @desc    Manually assign task to freelancer
 * @route   POST /api/admin/tasks/:id/assign
 * @access  Private (Admin)
 */
exports.assignTask = async (req, res, next) => {
  try {
    const { freelancerId } = req.body;

    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.status !== "under_review") {
      return res.status(400).json({
        success: false,
        message: "Task is not available for assignment",
      });
    }

    const freelancer = await userData.findUserById(freelancerId);

    if (!freelancer || freelancer.role !== "freelancer") {
      return res.status(404).json({
        success: false,
        message: "Freelancer not found",
      });
    }

    if (freelancer.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Freelancer is not active",
      });
    }

    const result = await AssignmentService.assignTask(task, freelancerId, req.user.id);

    await auditLogData.log({
      user_id: req.user.id,
      action: "task_assigned_manually",
      resource: "task",
      resource_id: task.id,
      changes: { freelancerId },
      ip_address: req.ip,
    });

    logger.info(`Task manually assigned: ${task.id} to ${freelancerId}`);

    res.status(200).json({
      success: true,
      message: "Task assigned successfully",
      data: result,
    });
  } catch (error) {
    logger.error("Error assigning task:", error);
    next(error);
  }
};

/**
 * @desc    Get all audit logs
 * @route   GET /api/admin/audit-logs
 * @access  Private (Admin)
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { action, userId } = req.query;

    const filters = {};

    if (action) {
      filters.action = action;
    }

    if (userId) {
      filters.user_id = userId;
    }

    const logs = await auditLogData.findAuditLogs(filters);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    logger.error("Error fetching audit logs:", error);
    next(error);
  }
};

/**
 * @desc    Get platform statistics
 * @route   GET /api/admin/statistics
 * @access  Private (Admin)
 */
exports.getStatistics = async (req, res, next) => {
  try {
    const tasks = await taskData.findTasks({});
    const users = await userData.findUsers({});
    const payments = await paymentData.findPayments({});

    const taskCount = tasks.length;
    const userCount = users.length;
    const totalRevenue = payments
        .filter((p) => p.status === "released")
        .reduce((sum, p) => sum + (p.amounts?.platformFee || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        tasks: {
            count: taskCount,
        },
        users: {
            count: userCount,
        },
        revenue: {
            total: totalRevenue,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching statistics:", error);
    next(error);
  }
};

/**
 * @desc    Resolve dispute
 * @route   POST /api/admin/disputes/:id/resolve
 * @access  Private (Admin)
 */
exports.resolveDispute = async (req, res, next) => {
  try {
    const { resolution, refundClient, payFreelancer, notes } = req.body;

    // Implementation would depend on having a Dispute model
    // This is a placeholder for the dispute resolution logic

    await auditLogData.log({
      user_id: req.user.id,
      action: "dispute_resolved",
      resource: "task",
      resource_id: req.params.id,
      changes: { resolution, refundClient, payFreelancer, notes },
      ip_address: req.ip,
    });

    logger.info(`Dispute resolved: ${req.params.id}`);

    res.status(200).json({
      success: true,
      message: "Dispute resolved successfully",
    });
  } catch (error) {
    logger.error("Error resolving dispute:", error);
    next(error);
  }
};
