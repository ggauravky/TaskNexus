const taskData = require("../data/taskData");
const submissionData = require("../data/submissionData");
const paymentData = require("../data/paymentData");
const reviewData = require("../data/reviewData");
const auditLogData = require("../data/auditLogData");
const logger = require("../utils/logger");
const NotificationService = require("../services/notificationService");

/**
 * @desc    Get freelancer dashboard overview
 * @route   GET /api/freelancer/dashboard
 * @access  Private (Freelancer)
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const freelancerId = req.user.id;

    const allTasks = await taskData.findTasks({ freelancer_id: freelancerId });
    const payments = await paymentData.findPayments({ freelancer_id: freelancerId });
    const reviews = await reviewData.findReviews({ reviewee_id: freelancerId });

    const activeTasks = allTasks.filter((t) =>
      ["assigned", "in_progress", "submitted_work"].includes(t.status),
    ).length;

    const completedTasks = allTasks.filter(
      (t) => t.status === "completed",
    ).length;

    const totalEarnings = payments
      .filter((p) => p.status === "released")
      .reduce((sum, p) => sum + (p.amounts?.freelancerPayout || 0), 0);
      
    const avgRating =
        reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

    res.status(200).json({
      success: true,
      data: {
        activeTasks,
        completedTasks,
        totalEarnings,
        rating: avgRating,
        totalReviews: reviews.length,
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
    const { category, minBudget, maxBudget } = req.query;

    const filters = {
      status: "under_review",
      freelancer_id: null,
    };

    if (category) {
      filters["task_details->>type"] = category;
    }

    if (minBudget || maxBudget) {
        console.warn("Budget filter is not implemented yet");
    }

    const tasks = await taskData.findTasks(filters);

    res.status(200).json({
      success: true,
      data: { tasks },
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
    const { status } = req.query;

    const filters = { freelancer_id: req.user.id };

    if (status) {
        filters.status = status;
    }

    const tasks = await taskData.findTasks(filters);

    res.status(200).json({
      success: true,
      data: { tasks },
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

    const submission = await submissionData.findSubmissionById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    if (submission.freelancer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this submission",
      });
    }

    if (submission.client_review?.status !== "revision_requested") {
      return res.status(400).json({
        success: false,
        message: "This submission cannot be updated - no revision requested",
      });
    }

    const content = submission.content;
    content.deliverables = deliverables || content.deliverables;
    content.notes = comments || content.notes;
    
    const clientReview = submission.client_review;
    clientReview.status = "pending";
    
    const updatedSubmission = await submissionData.updateSubmission(req.params.id, {
        content,
        client_review: clientReview,
    });

    await taskService.transitionTo(submission.task_id, "submitted_work");
    
    const task = await taskData.findTaskById(submission.task_id);

    try {
      await NotificationService.create({
        recipient_id: task.client_id,
        type: "submission_updated",
        content: {
          title: "Submission Updated",
          message:
            "Freelancer has updated the submission with your requested revisions",
        },
        related_task_id: submission.task_id,
      });
    } catch (notifError) {
      logger.error("Failed to send notification:", notifError);
    }

    logger.info(`Submission updated: ${submission.id}`);

    res.status(200).json({
      success: true,
      message: "Submission updated successfully",
      data: updatedSubmission,
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
    const payments = await paymentData.findPayments({ freelancer_id: req.user.id });

    const summary = payments.reduce((acc, p) => {
        const status = p.status;
        if (!acc[status]) {
            acc[status] = { total: 0, count: 0 };
        }
        acc[status].total += p.amounts.freelancerPayout;
        acc[status].count += 1;
        return acc;
    }, {});


    res.status(200).json({
      success: true,
      data: {
        payments,
        summary,
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
    const reviews = await reviewData.findReviews({ reviewee_id: req.user.id });

    res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    logger.error("Error fetching reviews:", error);
    next(error);
  }
};
