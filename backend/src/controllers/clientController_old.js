const Task = require("../models/Task");
const Review = require("../models/Review");
const Submission = require("../models/Submission");
const Payment = require("../models/Payment");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const logger = require("../utils/logger");
const { sendNotification } = require("../services/notificationService");
const { TASK_STATUS, PAYMENT_STATUS } = require("../config/constants");

/**
 * @desc    Get client dashboard overview with comprehensive statistics
 * @route   GET /api/client/dashboard
 * @access  Private (Client)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const clientId = req.user._id;

    // Get all tasks for statistics
    const allTasks = await Task.find({ client: clientId });

    // Calculate task statistics by status
    const taskStats = {
      total: allTasks.length,
      submitted: allTasks.filter((t) => t.status === TASK_STATUS.SUBMITTED)
        .length,
      underReview: allTasks.filter((t) => t.status === TASK_STATUS.UNDER_REVIEW)
        .length,
      assigned: allTasks.filter((t) => t.status === TASK_STATUS.ASSIGNED)
        .length,
      inProgress: allTasks.filter((t) => t.status === TASK_STATUS.IN_PROGRESS)
        .length,
      submittedWork: allTasks.filter(
        (t) => t.status === TASK_STATUS.SUBMITTED_WORK,
      ).length,
      qaReview: allTasks.filter((t) => t.status === TASK_STATUS.QA_REVIEW)
        .length,
      delivered: allTasks.filter((t) => t.status === TASK_STATUS.DELIVERED)
        .length,
      clientRevision: allTasks.filter(
        (t) => t.status === TASK_STATUS.CLIENT_REVISION,
      ).length,
      completed: allTasks.filter((t) => t.status === TASK_STATUS.COMPLETED)
        .length,
      cancelled: allTasks.filter((t) => t.status === TASK_STATUS.CANCELLED)
        .length,
    };

    // Active tasks (not completed or cancelled)
    const activeTasks = allTasks.filter(
      (t) => ![TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED].includes(t.status),
    ).length;

    // Pending review count (delivered tasks waiting for client action)
    const pendingReview = taskStats.delivered;

    // Financial statistics
    const payments = await Payment.find({ client: clientId });

    const financialStats = {
      totalSpent: payments
        .filter((p) => p.status === PAYMENT_STATUS.RELEASED)
        .reduce((sum, p) => sum + (p.amounts?.taskBudget || 0), 0),

      pendingPayments: payments
        .filter((p) =>
          [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.ESCROWED].includes(p.status),
        )
        .reduce((sum, p) => sum + (p.amounts?.taskBudget || 0), 0),

      platformFeesPaid: payments
        .filter((p) => p.status === PAYMENT_STATUS.RELEASED)
        .reduce((sum, p) => sum + (p.amounts?.platformFee || 0), 0),
    };

    // Calculate average completion time (in days)
    const completedTasksWithDates = allTasks.filter(
      (t) =>
        t.status === TASK_STATUS.COMPLETED &&
        t.timeline?.completedAt &&
        t.createdAt,
    );

    const avgCompletionTime =
      completedTasksWithDates.length > 0
        ? completedTasksWithDates.reduce((sum, task) => {
            const days = Math.ceil(
              (new Date(task.timeline.completedAt) - new Date(task.createdAt)) /
                (1000 * 60 * 60 * 24),
            );
            return sum + days;
          }, 0) / completedTasksWithDates.length
        : 0;

    // Get recent tasks (last 5)
    const recentTasks = await Task.find({ client: clientId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate(
        "freelancer",
        "profile.firstName profile.lastName email freelancerProfile.rating",
      )
      .select(
        "taskDetails.title status taskDetails.deadline taskDetails.budget createdAt",
      );

    // Get pending submissions count
    const pendingSubmissions = await Submission.countDocuments({
      task: { $in: allTasks.map((t) => t._id) },
      "clientReview.status": "pending",
      isActive: true,
    });

    // Calculate task type breakdown
    const taskTypeBreakdown = allTasks.reduce((acc, task) => {
      const type = task.taskDetails?.type || "other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Get freelancer performance data for tasks
    const freelancerIds = allTasks
      .filter((t) => t.freelancer)
      .map((t) => t.freelancer);

    const uniqueFreelancers = [
      ...new Set(freelancerIds.map((id) => id.toString())),
    ];

    res.status(200).json({
      success: true,
      data: {
        taskStats,
        activeTasks,
        pendingReview,
        pendingSubmissions,
        financialStats,
        avgCompletionTime: Math.round(avgCompletionTime * 10) / 10, // Round to 1 decimal
        recentTasks,
        taskTypeBreakdown,
        totalFreelancersWorked: uniqueFreelancers.length,
      },
    });
  } catch (error) {
    logger.error("Error fetching client dashboard:", error);
    next(error);
  }
};

/**
 * @desc    Get client tasks with advanced filtering and sorting
 * @route   GET /api/client/tasks
 * @access  Private (Client)
 */
exports.getTasks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate,
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { client: req.user._id };

    // Filter by status
    if (status) {
      if (status.includes(",")) {
        query.status = { $in: status.split(",") };
      } else {
        query.status = status;
      }
    }

    // Filter by task type
    if (type) {
      query["taskDetails.type"] = type;
    }

    // Search by title or description
    if (search) {
      query.$or = [
        { "taskDetails.title": { $regex: search, $options: "i" } },
        { "taskDetails.description": { $regex: search, $options: "i" } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;

    const tasks = await Task.find(query)
      .populate(
        "freelancer",
        "profile.firstName profile.lastName email freelancerProfile.rating freelancerProfile.completedTasks",
      )
      .populate("assignedBy", "profile.firstName profile.lastName")
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Task.countDocuments(query);

    // Enhance tasks with additional data
    const enhancedTasks = await Promise.all(
      tasks.map(async (task) => {
        // Get latest submission if exists
        const latestSubmission = await Submission.findOne({
          task: task._id,
          isActive: true,
        })
          .sort({ createdAt: -1 })
          .select("submissionType clientReview.status createdAt")
          .lean();

        // Check if task has unread submissions
        const hasUnreadSubmission =
          latestSubmission &&
          latestSubmission.clientReview.status === "pending";

        return {
          ...task,
          latestSubmission,
          hasUnreadSubmission,
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: enhancedTasks,
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
 * @desc    Get single task details
 * @route   GET /api/client/tasks/:id
 * @access  Private (Client)
 */
exports.getTaskDetails = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      client: req.user._id,
    })
      .populate(
        "freelancer",
        "profile.firstName profile.lastName email freelancerProfile.rating freelancerProfile.completedTasks freelancerProfile.skills",
      )
      .populate("assignedBy", "profile.firstName profile.lastName")
      .lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Get all submissions for this task
    const submissions = await Submission.find({ task: task._id })
      .populate("freelancer", "profile.firstName profile.lastName")
      .sort({ createdAt: -1 })
      .lean();

    // Get reviews for this task
    const reviews = await Review.find({ task: task._id })
      .populate("reviewer", "profile.firstName profile.lastName")
      .populate("reviewee", "profile.firstName profile.lastName")
      .lean();

    // Get payment information
    const payment = await Payment.findOne({ task: task._id }).lean();

    res.status(200).json({
      success: true,
      data: {
        task,
        submissions,
        reviews,
        payment,
      },
    });
  } catch (error) {
    logger.error("Error fetching task details:", error);
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
    if (!["approve", "request_revision"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be approve or request_revision",
      });
    }

    const submission = await Submission.findById(req.params.id)
      .populate("task")
      .populate("freelancer", "profile.firstName profile.lastName email");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const task = submission.task;

    // Verify ownership
    if (task.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to review this submission",
      });
    }

    // Check if submission can be reviewed
    if (submission.clientReview.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Submission has already been reviewed",
      });
    }

    // Check task status
    if (task.status !== TASK_STATUS.DELIVERED) {
      return res.status(400).json({
        success: false,
        message: "Task is not in delivered status",
      });
    }

    if (action === "approve") {
      // Update submission
      submission.clientReview.status = "approved";
      submission.clientReview.reviewedAt = new Date();
      submission.clientReview.feedback = feedback || "";
      await submission.save();

      // Update task status
      task.status = TASK_STATUS.COMPLETED;
      task.timeline.completedAt = new Date();
      await task.save();

      // Calculate payment amounts
      const taskBudget = task.taskDetails.budget;
      const platformCommission = 15; // From constants
      const platformFee = (taskBudget * platformCommission) / 100;
      const freelancerPayout = taskBudget - platformFee;

      // Create payment record
      const paymentId = `PAY-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)
        .toUpperCase()}`;

      await Payment.create({
        paymentId,
        task: task._id,
        client: req.user._id,
        freelancer: task.freelancer,
        amounts: {
          taskBudget,
          platformCommission,
          platformFee,
          freelancerPayout,
        },
        status: PAYMENT_STATUS.ESCROWED,
        escrow: {
          heldAt: new Date(),
        },
      });

      // Notify freelancer
      await sendNotification({
        userId: submission.freelancer._id,
        type: "submission_approved",
        title: "Submission Approved",
        message: `Your submission for task "${task.taskDetails.title}" has been approved!`,
        metadata: { taskId: task._id, submissionId: submission._id },
      });

      logger.info(`Submission approved: ${submission._id}`);
    } else if (action === "request_revision") {
      // Check revision limit
      const revisionCount = await Submission.countDocuments({
        task: task._id,
        submissionType: "revision",
      });

      if (revisionCount >= task.taskDetails.revisionLimit) {
        return res.status(400).json({
          success: false,
          message: "Revision limit exceeded for this task",
        });
      }

      // Update submission
      submission.clientReview.status = "revision_requested";
      submission.clientReview.reviewedAt = new Date();
      submission.clientReview.feedback = revisionRequested || feedback || "";
      submission.isActive = false; // Mark as inactive
      await submission.save();

      // Update task status
      task.status = TASK_STATUS.CLIENT_REVISION;
      await task.save();

      // Notify freelancer
      await sendNotification({
        userId: submission.freelancer._id,
        type: "revision_requested",
        title: "Revision Requested",
        message: `Client has requested revisions for task "${task.taskDetails.title}"`,
        metadata: {
          taskId: task._id,
          revisionDetails: revisionRequested || feedback,
        },
      });

      logger.info(`Revision requested: ${submission._id}`);
    }

    // Log audit
    await AuditLog.create({
      user: req.user._id,
      action: `submission_${action}`,
      details: `Client ${action}d submission ${submission._id}`,
      ipAddress: req.ip,
      metadata: { taskId: task._id, submissionId: submission._id, feedback },
    });

    res.status(200).json({
      success: true,
      message: `Submission ${
        action === "approve" ? "approved" : "revision requested"
      } successfully`,
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
