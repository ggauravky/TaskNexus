const Task = require("../models/Task");
const Submission = require("../models/Submission");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");
const NotificationService = require("../services/notificationService");

/**
 * @desc    Get freelancer dashboard overview
 * @route   GET /api/freelancer/dashboard
 * @access  Private (Freelancer)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const freelancerId = req.user._id;

    // Get all tasks for this freelancer
    const allTasks = await Task.find({ freelancer: freelancerId }).lean();

    // Calculate task statistics
    const activeTasks = allTasks.filter((t) =>
      ["assigned", "in_progress", "submitted_work"].includes(t.status),
    ).length;

    const completedTasks = allTasks.filter(
      (t) => t.status === "completed",
    ).length;

    const pendingTasks = allTasks.filter((t) =>
      ["submitted_work", "qa_review"].includes(t.status),
    ).length;

    // Calculate earnings
    const completedPayments = await Payment.find({
      freelancer: freelancerId,
      status: "released",
    }).lean();

    const totalEarnings = completedPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );

    const pendingPayments = await Payment.find({
      freelancer: freelancerId,
      status: { $in: ["pending", "escrowed"] },
    }).lean();

    const pendingEarnings = pendingPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );

    // Get recent reviews and calculate average rating
    const reviews = await Review.find({
      task: { $in: allTasks.map((t) => t._id) },
      freelancer: freelancerId,
    }).lean();

    const avgRating =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

    // Calculate on-time delivery rate
    const completedWithDeadline = allTasks.filter(
      (t) =>
        t.status === "completed" &&
        t.workflow?.completedAt &&
        t.taskDetails?.deadline,
    );

    const onTimeDeliveries = completedWithDeadline.filter(
      (t) =>
        new Date(t.workflow.completedAt) <= new Date(t.taskDetails.deadline),
    ).length;

    const onTimeRate =
      completedWithDeadline.length > 0
        ? Math.round((onTimeDeliveries / completedWithDeadline.length) * 100)
        : 0;

    // Get task breakdown by status
    const taskBreakdown = allTasks.reduce((acc, task) => {
      const status = task.status || "unknown";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        activeTasks,
        completedTasks,
        pendingTasks,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingEarnings: Math.round(pendingEarnings * 100) / 100,
        rating: Math.round(avgRating * 10) / 10,
        totalReviews: reviews.length,
        onTimeDeliveryRate: onTimeRate,
        performanceScore: Math.min(
          100,
          Math.round((avgRating / 5) * 50 + onTimeRate * 0.5),
        ),
        taskBreakdown,
        totalTasks: allTasks.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching freelancer dashboard:", error);
    next(error);
  }
};

/**
 * @desc    Get available tasks for freelancers
 * @route   GET /api/freelancer/available-tasks
 * @access  Private (Freelancer)
 */
exports.getAvailableTasks = async (req, res, next) => {
  try {
    const { category, minBudget, maxBudget, page = 1, limit = 10 } = req.query;

    const query = {
      status: { $in: ["submitted", "under_review"] },
      freelancer: null,
    };

    if (category) {
      query["taskDetails.type"] = category;
    }

    if (minBudget || maxBudget) {
      query["taskDetails.budget"] = {};
      if (minBudget) query["taskDetails.budget"].$gte = parseFloat(minBudget);
      if (maxBudget) query["taskDetails.budget"].$lte = parseFloat(maxBudget);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await Task.find(query)
      .populate("client", "profile.firstName profile.lastName email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Flatten taskDetails for frontend
    const formattedTasks = tasks.map((task) => ({
      ...task,
      title: task.taskDetails?.title,
      description: task.taskDetails?.description,
      budget: task.taskDetails?.budget,
      deadline: task.taskDetails?.deadline,
      type: task.taskDetails?.type,
    }));

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: { tasks: formattedTasks },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching available tasks:", error);
    next(error);
  }
};

/**
 * @desc    Apply for/Accept a task
 * @route   POST /api/freelancer/tasks/:id/accept
 * @access  Private (Freelancer)
 */
exports.acceptTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    logger.info(
      `Task ${task._id} status: ${task.status}, freelancer: ${task.freelancer}`,
    );

    if (!["submitted", "under_review"].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: `Task is not available for acceptance. Current status: ${task.status}`,
        error: {
          code: "INVALID_TASK_STATUS",
          currentStatus: task.status,
          requiredStatus: ["submitted", "under_review"],
        },
      });
    }

    if (task.freelancer) {
      return res.status(400).json({
        success: false,
        message: "Task is already assigned to another freelancer",
      });
    }

    // Check if freelancer has too many active tasks
    const activeTasks = await Task.countDocuments({
      freelancer: req.user._id,
      status: { $in: ["assigned", "in_progress", "submitted_work"] },
    });

    if (activeTasks >= 10) {
      return res.status(400).json({
        success: false,
        message: "You have reached the maximum number of active tasks (10)",
      });
    }

    // Assign task to freelancer
    task.freelancer = req.user._id;
    task.status = "assigned";
    task.workflow = task.workflow || {};
    task.workflow.assignedAt = new Date();
    await task.save();

    // Try to notify client (don't fail if notification fails)
    try {
      await NotificationService.create({
        recipient: task.client,
        type: "task_accepted",
        content: {
          title: "Freelancer Accepted Task",
          message: `A freelancer has accepted your task: ${task.taskDetails.title}`,
          actionUrl: `/client/tasks/${task._id}`,
          actionLabel: "View Task",
        },
        relatedTask: task._id,
        priority: "medium",
      });
    } catch (notifError) {
      logger.error("Failed to send notification:", notifError);
      // Continue execution even if notification fails
    }

    // Log audit
    await AuditLog.create({
      user: req.user._id,
      action: "task_accepted",
      resource: "task",
      resourceId: task._id,
      ipAddress: req.ip,
    });

    logger.info(`Task accepted: ${task._id} by freelancer: ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: "Task accepted successfully",
      data: task,
    });
  } catch (error) {
    logger.error("Error accepting task:", error);
    next(error);
  }
};

/**
 * @desc    Get freelancer's active tasks
 * @route   GET /api/freelancer/my-tasks
 * @access  Private (Freelancer)
 */
exports.getMyTasks = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { freelancer: req.user._id };

    if (status) {
      if (status.includes(",")) {
        query.status = { $in: status.split(",") };
      } else {
        query.status = status;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await Task.find(query)
      .populate("client", "profile.firstName profile.lastName email")
      .sort({ "taskDetails.deadline": 1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Flatten taskDetails for frontend
    const formattedTasks = tasks.map((task) => ({
      ...task,
      title: task.taskDetails?.title,
      description: task.taskDetails?.description,
      budget: task.taskDetails?.budget,
      deadline: task.taskDetails?.deadline,
      type: task.taskDetails?.type,
    }));

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: { tasks: formattedTasks },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching freelancer tasks:", error);
    next(error);
  }
};

/**
 * @desc    Update submission (after revision request)
 * @route   PUT /api/freelancer/submissions/:id
 * @access  Private (Freelancer)
 */
exports.updateSubmission = async (req, res, next) => {
  try {
    const { deliverables, comments } = req.body;

    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // Verify ownership
    if (submission.freelancer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this submission",
      });
    }

    if (submission.clientReview?.status !== "revision_requested") {
      return res.status(400).json({
        success: false,
        message: "This submission cannot be updated - no revision requested",
      });
    }

    // Update submission
    submission.deliverables = deliverables || submission.deliverables;
    submission.freelancerComments = comments || submission.freelancerComments;
    submission.clientReview.status = "pending";
    submission.submittedAt = new Date();
    await submission.save();

    // Update task status
    await Task.findByIdAndUpdate(submission.task, {
      status: "submitted_work",
    });

    const task = await Task.findById(submission.task);

    // Try to notify client (don't fail if notification fails)
    try {
      await NotificationService.create({
        recipient: task.client,
        type: "submission_updated",
        content: {
          title: "Submission Updated",
          message:
            "Freelancer has updated the submission with your requested revisions",
          actionUrl: `/client/tasks/${task._id}`,
          actionLabel: "View Submission",
        },
        relatedTask: submission.task,
        priority: "high",
      });
    } catch (notifError) {
      logger.error("Failed to send notification:", notifError);
    }

    logger.info(`Submission updated: ${submission._id}`);

    res.status(200).json({
      success: true,
      message: "Submission updated successfully",
      data: submission,
    });
  } catch (error) {
    logger.error("Error updating submission:", error);
    next(error);
  }
};

/**
 * @desc    Get freelancer earnings
 * @route   GET /api/freelancer/earnings
 * @access  Private (Freelancer)
 */
exports.getEarnings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find({ freelancer: req.user._id })
      .populate("task", "taskDetails.title")
      .populate("client", "profile.firstName profile.lastName")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Flatten task title
    const formattedPayments = payments.map((p) => ({
      ...p,
      taskTitle: p.task?.taskDetails?.title || "Untitled Task",
    }));

    const total = await Payment.countDocuments({ freelancer: req.user._id });

    // Calculate totals
    const earnings = await Payment.aggregate([
      { $match: { freelancer: req.user._id } },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        payments: formattedPayments,
        summary: earnings,
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching earnings:", error);
    next(error);
  }
};

/**
 * @desc    Get freelancer reviews
 * @route   GET /api/freelancer/reviews
 * @access  Private (Freelancer)
 */
exports.getReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({
      freelancer: req.user._id,
    })
      .populate("client", "profile.firstName profile.lastName")
      .populate("task", "taskDetails.title")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Flatten task title
    const formattedReviews = reviews.map((r) => ({
      ...r,
      taskTitle: r.task?.taskDetails?.title || "Untitled Task",
    }));

    const total = await Review.countDocuments({
      freelancer: req.user._id,
    });

    res.status(200).json({
      success: true,
      data: formattedReviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching reviews:", error);
    next(error);
  }
};
