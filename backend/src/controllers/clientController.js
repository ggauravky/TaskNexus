const taskData = require("../data/taskData");
const reviewData = require("../data/reviewData");
const submissionData = require("../data/submissionData");
const paymentData = require("../data/paymentData");
const auditLogData = require("../data/auditLogData");
const userData = require("../data/userData");
const logger = require("../utils/logger");
const NotificationService = require("../services/notificationService");
const taskService = require("../services/taskService");
const { TASK_STATUS, PAYMENT_STATUS } = require("../config/constants");

/**
 * @desc    Get client dashboard overview with comprehensive statistics
 * @route   GET /api/client/dashboard
 * @access  Private (Client)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const clientId = req.user.id;

    const allTasks = await taskData.findTasks({ client_id: clientId });

    const taskStats = {
      total: allTasks.length,
      completed: allTasks.filter((t) => t.status === TASK_STATUS.COMPLETED).length,
      inProgress: allTasks.filter((t) => t.status === TASK_STATUS.IN_PROGRESS).length,
    };

    const payments = await paymentData.findPayments({ client_id: clientId });

    const financialStats = {
      totalSpent: payments
        .filter((p) => p.status === PAYMENT_STATUS.RELEASED)
        .reduce((sum, p) => sum + (p.amounts?.taskBudget || 0), 0),
    };

    const recentTasks = allTasks.slice(0, 5);

    res.status(200).json({
      success: true,
      data: {
        taskStats,
        financialStats,
        recentTasks,
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
    const { status, type, search } = req.query;

    const filters = { client_id: req.user.id };

    if (status) {
      filters.status = status;
    }
    if (type) {
        filters["task_details->>type"] = type;
    }

    // Search is not implemented in the new data layer yet
    if (search) {
      console.warn("Search functionality is not implemented yet");
    }
    
    const tasks = await taskData.findTasks(filters);

    res.status(200).json({
      success: true,
      data: tasks,
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
    const task = await taskData.findTaskById(req.params.id);

    if (!task || task.client_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const submissions = await submissionData.findSubmissions({ task_id: task.id });
    const reviews = await reviewData.findReviews({ task_id: task.id });
    const payment = await paymentData.findPayments({ task_id: task.id });

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
 * @desc    Get all submissions for client's tasks
 * @route   GET /api/client/submissions
 * @access  Private (Client)
 */
exports.getSubmissions = async (req, res, next) => {
  try {
    const { status, taskId } = req.query;

    const clientTasks = await taskData.findTasks({ client_id: req.user.id });
    const clientTaskIds = clientTasks.map((t) => t.id);

    const filters = { task_id: clientTaskIds };

    if (taskId) {
      filters.task_id = taskId;
    }

    if (status) {
        filters["client_review->>status"] = status;
    }

    const submissions = await submissionData.findSubmissions(filters);

    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    logger.error("Error fetching submissions:", error);
    next(error);
  }
};

/**
 * @desc    Get single submission details
 * @route   GET /api/client/submissions/:id
 * @access  Private (Client)
 */
exports.getSubmissionDetails = async (req, res, next) => {
  try {
    const submission = await submissionData.findSubmissionById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    // Verify ownership
    if (submission.task.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this submission",
      });
    }

    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    logger.error("Error fetching submission details:", error);
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

    if (!["approve", "request_revision"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be approve or request_revision",
      });
    }

    const submission = await submissionData.findSubmissionById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const task = submission.task;

    if (task.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to review this submission",
      });
    }

    if (submission.client_review.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Submission has already been reviewed",
      });
    }

    if (task.status !== TASK_STATUS.DELIVERED) {
      return res.status(400).json({
        success: false,
        message: "Task is not in delivered status",
      });
    }

    if (action === "approve") {
      await submissionData.updateSubmission(submission.id, {
        client_review: {
          status: "approved",
          reviewedAt: new Date(),
          feedback: feedback || "",
        },
      });

      await taskService.transitionTo(task.id, TASK_STATUS.COMPLETED);

      const taskBudget = task.task_details.budget;
      const platformCommission = 15;
      const platformFee = (taskBudget * platformCommission) / 100;
      const freelancerPayout = taskBudget - platformFee;

      await paymentData.createPayment({
        task_id: task.id,
        client_id: req.user.id,
        freelancer_id: task.freelancer_id,
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

      await NotificationService.create({
        recipient_id: submission.freelancer_id,
        type: "submission_approved",
        content: {
            title: "Submission Approved",
            message: `Your submission for task "${task.task_details.title}" has been approved!`,
        },
        related_task_id: task.id,
      });

      logger.info(`Submission approved: ${submission.id}`);
    } else if (action === "request_revision") {
        const revisionCount = await submissionData.getRevisionCount(task.id);

      if (revisionCount.length >= task.task_details.revisionLimit) {
        return res.status(400).json({
          success: false,
          message: "Revision limit exceeded for this task",
        });
      }

      await submissionData.updateSubmission(submission.id, {
        client_review: {
          status: "revision_requested",
          reviewedAt: new Date(),
          feedback: revisionRequested || feedback || "",
        },
        is_active: false,
      });

      await taskService.transitionTo(task.id, TASK_STATUS.CLIENT_REVISION);

      await NotificationService.create({
        recipient_id: submission.freelancer_id,
        type: "revision_requested",
        content: {
            title: "Revision Requested",
            message: `Client has requested revisions for task "${task.task_details.title}"`,
        },
        related_task_id: task.id,
      });

      logger.info(`Revision requested: ${submission.id}`);
    }

    await auditLogData.log({
      user_id: req.user.id,
      action: `submission_${action}`,
      resource: "submission",
      resource_id: submission.id,
      changes: { taskId: task.id, feedback, action },
      ip_address: req.ip,
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
 * @desc    Rate a freelancer after task completion
 * @route   POST /api/client/rate-freelancer
 * @access  Private (Client)
 */
exports.rateFreelancer = async (req, res, next) => {
  try {
    const { taskId, rating, feedback } = req.body;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    const task = await taskData.findTaskById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to rate this task",
      });
    }

    if (task.status !== TASK_STATUS.COMPLETED) {
      return res.status(400).json({
        success: false,
        message: "Can only rate completed tasks",
      });
    }

    if (!task.freelancer_id) {
      return res.status(400).json({
        success: false,
        message: "No freelancer assigned to this task",
      });
    }

    const existingReviews = await reviewData.findReviews({
      task_id: taskId,
      reviewer_id: req.user.id,
      review_type: "client_to_platform",
    });

    if (existingReviews.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You have already rated this task",
      });
    }

    const review = await reviewData.createReview({
      task_id: taskId,
      reviewer_id: req.user.id,
      reviewee_id: task.freelancer_id,
      review_type: "client_to_platform",
      rating,
      feedback: feedback || "",
    });

    const { averageRating, totalReviews } = await reviewData.getAverageRating(
      task.freelancer_id,
    );

    const freelancer = await userData.findUserById(task.freelancer_id);
    const freelancerProfile = freelancer.freelancer_profile;
    freelancerProfile.rating = averageRating;
    freelancerProfile.totalRatings = totalReviews;

    await userData.updateUser(task.freelancer_id, {
        freelancer_profile: freelancerProfile,
    });

    await NotificationService.create({
      recipient_id: task.freelancer_id,
      type: "new_review",
      content: {
        title: "New Review Received",
        message: `You received a ${rating}-star review from a client`,
      },
      related_task_id: task.id,
    });

    logger.info(`Freelancer rated: ${task.freelancer_id} - Rating: ${rating}`);

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
 * @desc    Get payment history with detailed statistics
 * @route   GET /api/client/payments
 * @access  Private (Client)
 */
exports.getPayments = async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;

    const filters = { client_id: req.user.id };

    if (status) {
      filters.status = status;
    }

    // Date range filter is not implemented in the new data layer yet
    if (startDate || endDate) {
        console.warn("Date range filter is not implemented yet");
    }

    const payments = await paymentData.findPayments(filters);

    const totalPaid = payments
        .filter((p) => p.status === PAYMENT_STATUS.RELEASED)
        .reduce((sum, p) => sum + (p.amounts?.taskBudget || 0), 0);

    res.status(200).json({
      success: true,
      data: payments,
      statistics: {
          totalPaid,
      },
    });
  } catch (error) {
    logger.error("Error fetching payments:", error);
    next(error);
  }
};

/**
 * @desc    Get single payment details
 * @route   GET /api/client/payments/:id
 * @access  Private (Client)
 */
exports.getPaymentDetails = async (req, res, next) => {
  try {
    const payment = await paymentData.findPaymentById(req.params.id);

    if (!payment || payment.client_id !== req.user.id) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    logger.error("Error fetching payment details:", error);
    next(error);
  }
};

/**
 * @desc    Get client statistics and analytics
 * @route   GET /api/client/analytics
 * @access  Private (Client)
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { period = "30d" } = req.query;

    const tasks = await taskData.findTasks({ client_id: req.user.id });
    const payments = await paymentData.findPayments({ client_id: req.user.id });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.status === TASK_STATUS.COMPLETED,
    ).length;
    const completionRate =
      totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    const avgTaskBudget =
      totalTasks > 0
        ? tasks.reduce((sum, t) => sum + (t.task_details?.budget || 0), 0) /
          totalTasks
        : 0;

    const totalSpent = payments
        .filter((p) => p.status === PAYMENT_STATUS.RELEASED)
        .reduce((sum, p) => sum + (p.amounts?.taskBudget || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        period,
        overview: {
          totalTasks,
          completedTasks,
          completionRate: Math.round(completionRate * 10) / 10,
          avgTaskBudget: Math.round(avgTaskBudget * 100) / 100,
          totalSpent,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching analytics:", error);
    next(error);
  }
};

/**
 * @desc    Get client profile
 * @route   GET /api/client/profile
 * @access  Private (Client)
 */
exports.getProfile = async (req, res, next) => {
  try {
    const client = await userData.findUserById(req.user.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const tasks = await taskData.findTasks({ client_id: req.user.id });
    const payments = await paymentData.findPayments({ client_id: req.user.id });

    const totalTasksPosted = tasks.length;
    const completedTasks = tasks.filter(
        (t) => t.status === TASK_STATUS.COMPLETED,
    ).length;
    const totalSpent = payments
        .filter((p) => p.status === PAYMENT_STATUS.RELEASED)
        .reduce((sum, p) => sum + (p.amounts?.taskBudget || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        ...client,
        statistics: {
          totalTasksPosted,
          completedTasks,
          totalSpent,
        },
      },
    });
  } catch (error) {
    logger.error("Error fetching client profile:", error);
    next(error);
  }
};

/**
 * @desc    Update client profile
 * @route   PUT /api/client/profile
 * @access  Private (Client)
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body || {};

    const user = await userData.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const profileUpdate = { ...(user.profile || {}) };
    const clean = (v) => (typeof v === "string" ? v.trim() : undefined);

    const fn = clean(firstName);
    const ln = clean(lastName);
    const ph = clean(phone);
    const av = clean(avatar);

    if (fn) profileUpdate.firstName = fn;
    if (ln) profileUpdate.lastName = ln;
    if (ph) profileUpdate.phone = ph;
    if (av) profileUpdate.avatar = av;

    const updatedClient = await userData.updateUser(req.user.id, { profile: profileUpdate });

    logger.info(`Client profile updated: ${req.user.id}`);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedClient,
    });
  } catch (error) {
    logger.error("Error updating client profile:", error);
    next(error);
  }
};
