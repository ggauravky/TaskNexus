const Task = require("../models/Task");
const Submission = require("../models/Submission");
const Payment = require("../models/Payment");
const Review = require("../models/Review");
const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");
const { sendNotification } = require("../services/notificationService");

/**
 * @desc    Get freelancer dashboard overview
 * @route   GET /api/freelancer/dashboard
 * @access  Private (Freelancer)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const freelancerId = req.user._id;

    // Get task statistics
    const taskStats = await Task.aggregate([
      { $match: { freelancerId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalEarnings: { $sum: "$budget" },
        },
      },
    ]);

    // Get active tasks
    const activeTasks = await Task.find({
      freelancerId,
      status: { $in: ["in_progress", "submitted"] },
    })
      .populate("clientId", "name companyName")
      .sort({ deadline: 1 })
      .limit(5);

    // Get available tasks
    const availableTasks = await Task.find({
      status: "available",
      freelancerId: null,
    })
      .populate("clientId", "name companyName")
      .sort({ createdAt: -1 })
      .limit(5);

    // Calculate total earnings
    const totalEarnings = await Payment.aggregate([
      { $match: { freelancerId, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Get recent reviews
    const recentReviews = await Review.find({
      revieweeId: freelancerId,
      type: "client_to_freelancer",
    })
      .populate("reviewerId", "name")
      .populate("taskId", "title")
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        taskStats,
        activeTasks,
        availableTasks,
        totalEarnings: totalEarnings[0]?.total || 0,
        recentReviews,
        rating: req.user.rating,
        completedTasks: req.user.completedTasks,
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
      status: "available",
      freelancerId: null,
    };

    if (category) {
      query.category = category;
    }

    if (minBudget || maxBudget) {
      query.budget = {};
      if (minBudget) query.budget.$gte = parseFloat(minBudget);
      if (maxBudget) query.budget.$lte = parseFloat(maxBudget);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await Task.find(query)
      .populate("clientId", "name companyName rating")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tasks,
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

    if (task.status !== "available") {
      return res.status(400).json({
        success: false,
        message: "Task is not available",
      });
    }

    if (task.freelancerId) {
      return res.status(400).json({
        success: false,
        message: "Task is already assigned",
      });
    }

    // Check if freelancer has too many active tasks
    const activeTasks = await Task.countDocuments({
      freelancerId: req.user._id,
      status: { $in: ["in_progress", "submitted"] },
    });

    if (activeTasks >= 5) {
      return res.status(400).json({
        success: false,
        message: "You have reached the maximum number of active tasks (5)",
      });
    }

    // Assign task to freelancer
    task.freelancerId = req.user._id;
    task.status = "in_progress";
    task.acceptedAt = new Date();
    await task.save();

    // Notify client
    await sendNotification({
      userId: task.clientId,
      type: "task_accepted",
      title: "Task Accepted",
      message: `A freelancer has accepted your task: ${task.title}`,
      metadata: { taskId: task._id, freelancerId: req.user._id },
    });

    // Log audit
    await AuditLog.create({
      userId: req.user._id,
      action: "task_accepted",
      resourceType: "Task",
      resourceId: task._id,
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

    const query = { freelancerId: req.user._id };

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await Task.find(query)
      .populate("clientId", "name email companyName")
      .sort({ deadline: 1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: tasks,
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
    if (submission.freelancerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this submission",
      });
    }

    if (submission.status !== "revision_requested") {
      return res.status(400).json({
        success: false,
        message: "This submission cannot be updated",
      });
    }

    // Update submission
    submission.deliverables = deliverables || submission.deliverables;
    submission.comments = comments || submission.comments;
    submission.status = "pending";
    submission.updatedAt = new Date();
    await submission.save();

    // Update task status
    await Task.findByIdAndUpdate(submission.taskId, {
      status: "submitted",
    });

    // Notify client
    await sendNotification({
      userId: submission.clientId,
      type: "submission_updated",
      title: "Submission Updated",
      message:
        "Freelancer has updated the submission with your requested revisions",
      metadata: { submissionId: submission._id, taskId: submission.taskId },
    });

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

    const payments = await Payment.find({ freelancerId: req.user._id })
      .populate("taskId", "title")
      .populate("clientId", "name companyName")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Payment.countDocuments({ freelancerId: req.user._id });

    // Calculate totals
    const earnings = await Payment.aggregate([
      { $match: { freelancerId: req.user._id } },
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
        payments,
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
      revieweeId: req.user._id,
      type: "client_to_freelancer",
    })
      .populate("reviewerId", "name companyName")
      .populate("taskId", "title")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Review.countDocuments({
      revieweeId: req.user._id,
      type: "client_to_freelancer",
    });

    res.status(200).json({
      success: true,
      data: reviews,
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
