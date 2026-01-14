const Task = require("../models/Task");
const User = require("../models/User");
const Payment = require("../models/Payment");
const AuditLog = require("../models/AuditLog");
const Submission = require("../models/Submission");
const Review = require("../models/Review");
const logger = require("../utils/logger");
const { sendNotification } = require("../services/notificationService");
const { assignTaskToFreelancer } = require("../services/assignmentService");

/**
 * @desc    Get admin dashboard overview
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    // Get overall statistics
    const totalUsers = await User.countDocuments();
    const totalClients = await User.countDocuments({ role: "client" });
    const totalFreelancers = await User.countDocuments({ role: "freelancer" });
    const totalTasks = await Task.countDocuments();

    // Task statistics by status
    const tasksByStatus = await Task.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: "$budget" },
        },
      },
    ]);

    // Recent activities
    const recentTasks = await Task.find()
      .populate("clientId", "name email")
      .populate("freelancerId", "name email")
      .sort({ createdAt: -1 })
      .limit(10);

    // Payment statistics
    const paymentStats = await Payment.aggregate([
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Platform revenue (10% commission)
    const completedPayments = await Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const platformRevenue = (completedPayments[0]?.total || 0) * 0.1;

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
          byStatus: tasksByStatus,
        },
        payments: paymentStats,
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
    const { role, status, page = 1, limit = 20, search } = req.query;

    const query = {};

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { companyName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select("-password -refreshTokens")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
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

    const user = await User.findById(req.params.id);

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

    user.status = status;
    await user.save();

    // Notify user
    await sendNotification({
      userId: user._id,
      type: "account_status_changed",
      title: "Account Status Changed",
      message: `Your account status has been changed to: ${status}`,
    });

    await AuditLog.create({
      userId: req.user._id,
      action: "user_status_updated",
      resourceType: "User",
      resourceId: user._id,
      metadata: { oldStatus: user.status, newStatus: status },
    });

    logger.info(`User status updated: ${user._id} to ${status}`);

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: user,
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

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.status !== "pending_review") {
      return res.status(400).json({
        success: false,
        message: "Task is not pending review",
      });
    }

    if (action === "approve") {
      task.status = "available";
      task.approvedAt = new Date();
      await task.save();

      // Notify client
      await sendNotification({
        userId: task.clientId,
        type: "task_approved",
        title: "Task Approved",
        message: `Your task "${task.title}" has been approved and is now available`,
        metadata: { taskId: task._id },
      });

      logger.info(`Task approved: ${task._id}`);
    } else {
      task.status = "rejected";
      task.rejectedReason = reason || "Task does not meet platform guidelines";
      await task.save();

      // Notify client
      await sendNotification({
        userId: task.clientId,
        type: "task_rejected",
        title: "Task Rejected",
        message: `Your task "${task.title}" has been rejected. Reason: ${reason}`,
        metadata: { taskId: task._id },
      });

      logger.info(`Task rejected: ${task._id}`);
    }

    await AuditLog.create({
      userId: req.user._id,
      action: `task_${action}`,
      resourceType: "Task",
      resourceId: task._id,
      metadata: { reason },
    });

    res.status(200).json({
      success: true,
      message: `Task ${action}d successfully`,
      data: task,
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

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.status !== "available") {
      return res.status(400).json({
        success: false,
        message: "Task is not available for assignment",
      });
    }

    const freelancer = await User.findById(freelancerId);

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

    // Assign task
    const result = await assignTaskToFreelancer(task._id, freelancerId);

    await AuditLog.create({
      userId: req.user._id,
      action: "task_assigned_manually",
      resourceType: "Task",
      resourceId: task._id,
      metadata: { freelancerId },
    });

    logger.info(`Task manually assigned: ${task._id} to ${freelancerId}`);

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
    const { action, userId, page = 1, limit = 50 } = req.query;

    const query = {};

    if (action) {
      query.action = action;
    }

    if (userId) {
      query.userId = userId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await AuditLog.find(query)
      .populate("userId", "name email role")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await AuditLog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
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
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    const matchStage =
      Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // Task statistics
    const taskStats = await Task.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
          totalValue: { $sum: "$budget" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // User registration stats
    const userStats = await User.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            role: "$role",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Revenue statistics
    const revenueStats = await Payment.aggregate([
      { $match: { status: "completed", ...matchStage } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalRevenue: { $sum: "$amount" },
          platformRevenue: { $sum: { $multiply: ["$amount", 0.1] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        tasks: taskStats,
        users: userStats,
        revenue: revenueStats,
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

    await AuditLog.create({
      userId: req.user._id,
      action: "dispute_resolved",
      resourceType: "Dispute",
      resourceId: req.params.id,
      metadata: { resolution, refundClient, payFreelancer, notes },
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
