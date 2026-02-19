const taskData = require("../data/taskData");
const submissionData = require("../data/submissionData");
const paymentData = require("../data/paymentData");
const reviewData = require("../data/reviewData");
const auditLogData = require("../data/auditLogData");
const logger = require("../utils/logger");
const NotificationService = require("../services/notificationService");
const { TASK_STATUS } = require("../config/constants");
const userData = require("../data/userData");
const realtimeHub = require("../services/realtimeHub");

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
      ["assigned", "in_progress"].includes(t.status),
    ).length;
    
    const pendingTasks = allTasks.filter((t) =>
      ["submitted_work", "qa_review", "client_revision"].includes(t.status),
    ).length;

    const completedTasks = allTasks.filter(
      (t) => t.status === "completed",
    ).length;

    const totalEarnings = payments
      .filter((p) => p.status === "released")
      .reduce((sum, p) => sum + (p.amounts?.freelancerPayout || 0), 0);

    const pendingEarnings = payments
      .filter((p) => ["pending", "escrowed"].includes(p.status))
      .reduce((sum, p) => sum + (p.amounts?.freelancerPayout || 0), 0);
      
    const avgRating =
        reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : 0;

    // TODO: Implement performance score calculation
    const performanceScore = 85;

    // TODO: Implement on-time delivery rate calculation
    const onTimeDeliveryRate = 95;

    res.status(200).json({
      success: true,
      data: {
        activeTasks,
        pendingTasks,
        completedTasks,
        totalEarnings,
        pendingEarnings,
        rating: avgRating,
        totalReviews: reviews.length,
        totalTasks: allTasks.length,
        performanceScore,
        onTimeDeliveryRate,
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

    // Show any task that is unassigned and not cancelled/completed
    const filters = { freelancer_id: null };

    if (category) {
      filters["task_details->>type"] = category;
    }

    if (minBudget || maxBudget) {
        console.warn("Budget filter is not implemented yet");
    }

    const tasks = await taskData.findTasks(filters);

    // Include tasks that are newly created (null status) or in submitted/under_review
    const allowedStatuses = new Set([
      TASK_STATUS.SUBMITTED,
      TASK_STATUS.UNDER_REVIEW,
      null,
      undefined,
    ]);

    const filteredTasks = tasks.filter(
      (t) =>
        allowedStatuses.has(t.status ?? null) &&
        ![TASK_STATUS.CANCELLED, TASK_STATUS.COMPLETED, TASK_STATUS.DISPUTED].includes(
          t.status,
        ),
    );

    res.status(200).json({
      success: true,
      data: { tasks: filteredTasks },
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
    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    logger.info(
      `Task ${task.id} status: ${task.status}, freelancer: ${task.freelancer_id}`,
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

    if (task.freelancer_id) {
      return res.status(400).json({
        success: false,
        message: "Task is already assigned to another freelancer",
      });
    }

    // Check if freelancer has too many active tasks
    const activeTasks = await taskData.findTasks({
      freelancer_id: req.user.id,
      status: ["assigned", "in_progress", "submitted_work"],
    });

    if (activeTasks.length >= 10) {
      return res.status(400).json({
        success: false,
        message: "You have reached the maximum number of active tasks (10)",
      });
    }

    // Assign task to freelancer
    const workflow = task.workflow || {};
    workflow.assignedAt = new Date();

    const updatedTask = await taskData.updateTask(req.params.id, {
        freelancer_id: req.user.id,
        status: "assigned",
        workflow,
    });


    // Try to notify client (don't fail if notification fails)
    try {
      await NotificationService.create({
        recipient_id: task.client_id,
        type: "task_assigned",
        content: {
          title: "Freelancer Assigned",
          message: `A freelancer has been assigned to your task: ${task.task_details.title}`,
        },
        related_task_id: task.id,
        priority: "medium",
      });
    } catch (notifError) {
      logger.error("Failed to send notification:", notifError);
      // Continue execution even if notification fails
    }

    // Log audit
    await auditLogData.log({
      user_id: req.user.id,
      action: "task_accepted",
      resource: "task",
      resource_id: task.id,
      ip_address: req.ip,
    });

    logger.info(`Task accepted: ${task.id} by freelancer: ${req.user.id}`);

    realtimeHub.publish({
      users: [task.client_id, req.user.id].filter(Boolean),
      event: "task.status_changed",
      payload: {
        taskId: task.id,
        status: updatedTask.status,
      },
    });
    realtimeHub.publishToRole("freelancer", "offer.updated", {
      taskId: task.id,
      status: updatedTask.status,
    });

    res.status(200).json({
      success: true,
      message: "Task accepted successfully",
      data: updatedTask,
    });
  } catch (error) {
    logger.error("Error accepting task:", error);
    next(error);
  }
};

/**
 * @desc    Start working on an assigned task
 * @route   PUT /api/freelancer/tasks/:id/start
 * @access  Private (Freelancer)
 */
exports.startTask = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.freelancer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this task",
      });
    }

    if (task.status !== TASK_STATUS.ASSIGNED) {
      return res.status(400).json({
        success: false,
        message: `Task must be in '${TASK_STATUS.ASSIGNED}' status to start work`,
      });
    }

    const workflow = task.workflow || {};
    workflow.startedAt = new Date();

    const updatedTask = await taskData.updateTask(task.id, {
      status: TASK_STATUS.IN_PROGRESS,
      workflow,
    });

    // Optional notification to client
    try {
      await NotificationService.create({
        recipient_id: task.client_id,
        type: "task_started",
        content: {
          title: "Task In Progress",
          message: "Your freelancer has started working on your task",
        },
        related_task_id: task.id,
      });
    } catch (notifError) {
      logger.error("Failed to send task start notification:", notifError);
    }

    await auditLogData.log({
      user_id: req.user.id,
      action: "task_started",
      resource: "task",
      resource_id: task.id,
      ip_address: req.ip,
    });

    realtimeHub.publish({
      users: [task.client_id, req.user.id].filter(Boolean),
      event: "task.status_changed",
      payload: {
        taskId: task.id,
        status: updatedTask.status,
      },
    });

    res.status(200).json({
      success: true,
      message: "Task marked as in progress",
      data: updatedTask,
    });
  } catch (error) {
    logger.error("Error starting task:", error);
    next(error);
  }
};

/**
 * @desc    Cancel / unaccept an assigned task (freelancer backs out)
 * @route   PUT /api/freelancer/tasks/:id/cancel
 * @access  Private (Freelancer)
 */
exports.cancelTask = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.freelancer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this task",
      });
    }

    if (![TASK_STATUS.ASSIGNED, TASK_STATUS.IN_PROGRESS].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: "Only assigned or in-progress tasks can be cancelled by freelancer",
      });
    }

    const workflow = task.workflow || {};
    workflow.unassignedAt = new Date();

    const updatedTask = await taskData.updateTask(task.id, {
      status: TASK_STATUS.UNDER_REVIEW,
      freelancer_id: null,
      workflow,
    });

    // Notify client
    try {
      await NotificationService.create({
        recipient_id: task.client_id,
        type: "task_unaccepted",
        content: {
          title: "Freelancer Unassigned",
          message: "Your task has been returned to the pool for review.",
        },
        related_task_id: task.id,
      });
    } catch (notifError) {
      logger.error("Failed to send unassignment notification:", notifError);
    }

    await auditLogData.log({
      user_id: req.user.id,
      action: "task_cancelled_by_freelancer",
      resource: "task",
      resource_id: task.id,
      ip_address: req.ip,
    });

    realtimeHub.publish({
      users: [task.client_id, req.user.id].filter(Boolean),
      event: "task.status_changed",
      payload: {
        taskId: task.id,
        status: updatedTask.status,
      },
    });
    realtimeHub.publishToRole("freelancer", "offer.new", {
      taskId: task.id,
      status: updatedTask.status,
      title: updatedTask.task_details?.title,
      budget: updatedTask.task_details?.budget,
      deadline: updatedTask.task_details?.deadline,
    });

    res.status(200).json({
      success: true,
      message: "Task returned to under review",
      data: updatedTask,
    });
  } catch (error) {
    logger.error("Error cancelling task:", error);
    next(error);
  }
};

/**
 * @desc    Update task progress (percentage + stage) by freelancer
 * @route   PUT /api/freelancer/tasks/:id/progress
 * @access  Private (Freelancer)
 */
exports.updateProgress = async (req, res, next) => {
  try {
    const { progress, stage, note } = req.body;
    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, message: "Task not found" });
    }

    if (task.freelancer_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this task",
      });
    }

    const pct = Number(progress);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({
        success: false,
        message: "Progress must be a number between 0 and 100",
      });
    }

    const metrics = task.metrics || {};
    metrics.progress = pct;
    metrics.stage = stage || metrics.stage || "in_progress";
    metrics.progressNote = note ?? metrics.progressNote;
    metrics.progressUpdatedAt = new Date();

    const updatedTask = await taskData.updateTask(task.id, { metrics });

    // Notify client best-effort
    try {
      await NotificationService.create({
        recipient_id: task.client_id,
        type: "task_progress",
        content: {
          title: "Task progress updated",
          message: `Progress set to ${pct}%${stage ? ` (${stage})` : ""}`,
        },
        related_task_id: task.id,
      });
    } catch (notifError) {
      logger.error("Failed to send progress notification:", notifError);
    }

    await auditLogData.log({
      user_id: req.user.id,
      action: "task_progress_updated",
      resource: "task",
      resource_id: task.id,
      ip_address: req.ip,
      changes: { progress: pct, stage },
    });

    realtimeHub.publish({
      users: [task.client_id, req.user.id].filter(Boolean),
      event: "task.progress.updated",
      payload: {
        taskId: task.id,
        progress: pct,
        stage: metrics.stage,
      },
    });

    res.status(200).json({
      success: true,
      message: "Progress updated",
      data: updatedTask,
    });
  } catch (error) {
    logger.error("Error updating progress:", error);
    next(error);
  }
};

/**
 * @desc    Get freelancer profile
 * @route   GET /api/freelancer/profile
 * @access  Private (Freelancer)
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await userData.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Freelancer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        profile: user.profile || {},
        freelancerProfile: user.freelancer_profile || {},
      },
    });
  } catch (error) {
    logger.error("Error fetching freelancer profile:", error);
    next(error);
  }
};

/**
 * @desc    Update freelancer profile
 * @route   PUT /api/freelancer/profile
 * @access  Private (Freelancer)
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      avatar,
      title,
      bio,
      skills,
      hourlyRate,
      availability,
      location,
      experienceLevel,
      website,
      linkedin,
      portfolio,
    } = req.body;

    const user = await userData.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Freelancer not found",
      });
    }

    const profile = { ...(user.profile || {}) };
    if (firstName !== undefined) profile.firstName = firstName;
    if (lastName !== undefined) profile.lastName = lastName;
    if (phone !== undefined) profile.phone = phone;
    if (avatar !== undefined) profile.avatar = avatar;
    if (location !== undefined) profile.location = location;

    const freelancerProfile = { ...(user.freelancer_profile || {}) };
    if (title !== undefined) freelancerProfile.title = title;
    if (bio !== undefined) freelancerProfile.bio = bio;
    if (skills !== undefined)
      freelancerProfile.skills = Array.isArray(skills)
        ? skills
        : String(skills || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    if (hourlyRate !== undefined) freelancerProfile.hourlyRate = Number(hourlyRate) || 0;
    if (availability !== undefined) freelancerProfile.availability = availability;
    if (experienceLevel !== undefined) freelancerProfile.experienceLevel = experienceLevel;
    if (website !== undefined) freelancerProfile.website = website;
    if (linkedin !== undefined) freelancerProfile.linkedin = linkedin;
    if (portfolio !== undefined) freelancerProfile.portfolio = portfolio;

    const updatedUser = await userData.updateUser(req.user.id, {
      profile,
      freelancer_profile: freelancerProfile,
    });

    await auditLogData.log({
      user_id: req.user.id,
      action: "freelancer_profile_updated",
      resource: "user",
      resource_id: req.user.id,
      ip_address: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        profile: updatedUser.profile,
        freelancerProfile: updatedUser.freelancer_profile,
      },
    });
  } catch (error) {
    logger.error("Error updating freelancer profile:", error);
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

    await taskData.updateTask(submission.task_id, { status: "submitted_work" });
    
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
