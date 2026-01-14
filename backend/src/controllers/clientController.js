const Task = require("../models/Task");
const Review = require("../models/Review");
const Submission = require("../models/Submission");
const Payment = require("../models/Payment");
const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");
const { sendNotification } = require("../services/notificationService");

/**
 * @desc    Get client dashboard overview
 * @route   GET /api/client/dashboard
 * @access  Private (Client)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const clientId = req.user._id;

    // Get all tasks for statistics
    const allTasks = await Task.find({ clientId });

    // Calculate statistics
    const totalTasks = allTasks.length;
    const activeTasks = allTasks.filter((t) =>
      ["open", "assigned", "in_progress"].includes(t.status)
    ).length;
    const completedTasks = allTasks.filter(
      (t) => t.status === "completed"
    ).length;
    const pendingReview = allTasks.filter(
      (t) => t.status === "submitted"
    ).length;

    // Calculate total spent from completed/paid tasks
    const totalSpent = allTasks
      .filter((t) => ["completed", "paid"].includes(t.status))
      .reduce((sum, task) => sum + (task.budget || 0), 0);

    // Calculate average completion time (in days)
    const completedTasksWithDates = allTasks.filter(
      (t) => t.status === "completed" && t.completedAt && t.createdAt
    );
    const avgCompletionTime =
      completedTasksWithDates.length > 0
        ? completedTasksWithDates.reduce((sum, task) => {
            const days = Math.ceil(
              (task.completedAt - task.createdAt) / (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / completedTasksWithDates.length
        : 0;

    res.status(200).json({
      success: true,
      data: {
        totalTasks,
        activeTasks,
        completedTasks,
        pendingReview,
        totalSpent,
        avgCompletionTime: Math.round(avgCompletionTime),
      },
    });
  } catch (error) {
    logger.error("Error fetching client dashboard:", error);
    next(error);
  }
};

/**
 * @desc    Get client tasks
 * @route   GET /api/client/tasks
 * @access  Private (Client)
 */
exports.getTasks = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, sort = "-createdAt" } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { clientId: req.user._id };
    if (status) {
      query.status = status;
    }

    const tasks = await Task.find(query)
      .populate(
        "freelancerId",
        "profile.firstName profile.lastName email freelancerProfile.rating"
      )
      .sort(sort)
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
    logger.error("Error fetching client tasks:", error);
    next(error);
  }
};

/**
 * @desc    Review and approve/reject submission
 * @route   POST /api/client/submissions/:id/review
 * @access  Private (Client)
 */
exports.reviewSubmission = async (req, res, next) => {
  try {
    const { action, feedback, revisionRequested } = req.body;

    // Validate action
    if (!["approve", "reject", "request_revision"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be approve, reject, or request_revision",
      });
    }

    const submission = await Submission.findById(req.params.id)
      .populate("taskId")
      .populate("freelancerId", "name email");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // Verify ownership
    if (submission.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to review this submission",
      });
    }

    if (submission.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Submission has already been reviewed",
      });
    }

    const task = submission.taskId;

    if (action === "approve") {
      submission.status = "approved";
      submission.reviewedAt = new Date();
      submission.feedback = feedback || "";
      await submission.save();

      task.status = "completed";
      task.completedAt = new Date();
      await task.save();

      // Create payment record
      await Payment.create({
        taskId: task._id,
        clientId: req.user._id,
        freelancerId: task.freelancerId,
        amount: task.budget,
        status: "pending",
        type: "task_payment",
      });

      // Notify freelancer
      await sendNotification({
        userId: submission.freelancerId._id,
        type: "submission_approved",
        title: "Submission Approved",
        message: `Your submission for task "${task.title}" has been approved!`,
        metadata: { taskId: task._id, submissionId: submission._id },
      });

      logger.info(`Submission approved: ${submission._id}`);
    } else if (action === "reject") {
      submission.status = "rejected";
      submission.reviewedAt = new Date();
      submission.feedback = feedback || "";
      await submission.save();

      task.status = "available";
      task.freelancerId = null;
      await task.save();

      // Notify freelancer
      await sendNotification({
        userId: submission.freelancerId._id,
        type: "submission_rejected",
        title: "Submission Rejected",
        message: `Your submission for task "${task.title}" was not accepted.`,
        metadata: { taskId: task._id, feedback },
      });

      logger.info(`Submission rejected: ${submission._id}`);
    } else if (action === "request_revision") {
      submission.status = "revision_requested";
      submission.revisionRequested = revisionRequested || feedback;
      await submission.save();

      task.status = "in_progress";
      await task.save();

      // Notify freelancer
      await sendNotification({
        userId: submission.freelancerId._id,
        type: "revision_requested",
        title: "Revision Requested",
        message: `Client has requested revisions for task "${task.title}"`,
        metadata: { taskId: task._id, revisionDetails: revisionRequested },
      });

      logger.info(`Revision requested: ${submission._id}`);
    }

    // Log audit
    await AuditLog.create({
      userId: req.user._id,
      action: `submission_${action}`,
      resourceType: "Submission",
      resourceId: submission._id,
      metadata: { taskId: task._id, feedback },
    });

    res.status(200).json({
      success: true,
      message: `Submission ${action}d successfully`,
      data: submission,
    });
  } catch (error) {
    logger.error("Error reviewing submission:", error);
    next(error);
  }
};

/**
 * @desc    Get all submissions for client's tasks
 * @route   GET /api/client/submissions
 * @access  Private (Client)
 */
exports.getSubmissions = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = { clientId: req.user._id };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const submissions = await Submission.find(query)
      .populate("taskId", "title category budget")
      .populate("freelancerId", "name email rating")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Submission.countDocuments(query);

    res.status(200).json({
      success: true,
      data: submissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching submissions:", error);
    next(error);
  }
};

/**
 * @desc    Rate a freelancer after task completion
 * @route   POST /api/client/rate-freelancer
 * @access  Private (Client)
 */
exports.rateFreelancer = async (req, res, next) => {
  try {
    const { taskId, rating, comment } = req.body;

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Verify ownership and completion
    if (task.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to rate this task",
      });
    }

    if (task.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "Can only rate completed tasks",
      });
    }

    // Check if already rated
    const existingReview = await Review.findOne({
      taskId,
      reviewerId: req.user._id,
    });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this task",
      });
    }

    // Create review
    const review = await Review.create({
      taskId,
      reviewerId: req.user._id,
      revieweeId: task.freelancerId,
      rating,
      comment: comment || "",
      type: "client_to_freelancer",
    });

    // Update freelancer rating
    const User = require("../models/User");
    const freelancer = await User.findById(task.freelancerId);

    const allReviews = await Review.find({
      revieweeId: task.freelancerId,
      type: "client_to_freelancer",
    });

    const averageRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    freelancer.rating = averageRating;
    await freelancer.save();

    logger.info(`Freelancer rated: ${task.freelancerId} - Rating: ${rating}`);

    res.status(201).json({
      success: true,
      message: "Rating submitted successfully",
      data: review,
    });
  } catch (error) {
    logger.error("Error rating freelancer:", error);
    next(error);
  }
};

/**
 * @desc    Get payment history
 * @route   GET /api/client/payments
 * @access  Private (Client)
 */
exports.getPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find({ clientId: req.user._id })
      .populate("taskId", "title")
      .populate("freelancerId", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Payment.countDocuments({ clientId: req.user._id });

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Error fetching payments:", error);
    next(error);
  }
};
