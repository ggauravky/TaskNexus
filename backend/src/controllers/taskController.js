const taskData = require("../data/taskData");
const submissionData = require("../data/submissionData");
const auditLogData = require("../data/auditLogData");
const logger = require("../utils/logger");
const NotificationService = require("../services/notificationService");
const taskService = require("../services/taskService");
const realtimeHub = require("../services/realtimeHub");
const collaborationService = require("../services/collaborationService");
const { TASK_STATUS } = require("../config/constants");

/**
 * @desc    Create a new task (Client only)
 * @route   POST /api/tasks
 * @access  Private (Client)
 */
exports.createTask = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      budget,
      deadline,
      skillsRequired,
      experienceLevel,
    } = req.body;

    const taskType = category.replace(/_/g, "-");

    const task = await taskData.createTask({
      client_id: req.user.id,
      status: TASK_STATUS.UNDER_REVIEW,
      task_details: {
        title: title.trim(),
        type: taskType,
        description: description.trim(),
        budget: parseFloat(budget),
        deadline: new Date(deadline),
        skillsRequired: Array.isArray(skillsRequired) ? skillsRequired : [],
        experienceLevel: experienceLevel || "intermediate",
      },
      workflow: {
        collaboration: {
          comments: [],
          activity: [],
        },
      },
      metrics: {
        subtasks: [],
        milestoneProgress: 0,
      },
    });

    await auditLogData.log({
      user_id: req.user.id,
      action: "task_created",
      resource: "task",
      resource_id: task.id,
      changes: { title, category, budget },
      ip_address: req.ip,
    });

    logger.info(`Task created: ${task.id} by client: ${req.user.id}`);

    realtimeHub.publishToUser(req.user.id, "task.created", {
      taskId: task.id,
      status: task.status,
      title: task.task_details?.title,
    });
    realtimeHub.publishToRole("freelancer", "offer.new", {
      taskId: task.id,
      status: task.status,
      title: task.task_details?.title,
      budget: task.task_details?.budget,
      type: task.task_details?.type,
      deadline: task.task_details?.deadline,
    });

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    logger.error("Error creating task:", error);
    next(error);
  }
};

/**
 * @desc    Get all tasks (filtered by role)
 * @route   GET /api/tasks
 * @access  Private
 */
exports.getTasks = async (req, res, next) => {
  try {
    const { status, category } = req.query;

    const filters = {};

    // Role-based filtering
    if (req.user.role === "client") {
      filters.client_id = req.user.id;
    } else if (req.user.role === "freelancer") {
      if (!status || status === "available") {
        filters.status = "available";
        filters.freelancer_id = null;
      } else {
        filters.freelancer_id = req.user.id;
      }
    }
    // Admin sees all tasks (no filter)

    // Additional filters
    if (status && req.user.role !== "freelancer") {
      filters.status = status;
    }
    if (category) {
      filters["task_details->>type"] = category;
    }

    const tasks = await taskData.findTasks(filters);

    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    logger.error("Error fetching tasks:", error);
    next(error);
  }
};

/**
 * @desc    Get single task by ID
 * @route   GET /api/tasks/:id
 * @access  Private
 */
exports.getTaskById = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Authorization check
    if (
      req.user.role === "client" &&
      task.client_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this task",
      });
    }

    if (
      req.user.role === "freelancer" &&
      task.freelancer_id &&
      task.freelancer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this task",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    logger.error("Error fetching task:", error);
    next(error);
  }
};

/**
 * @desc    Update task (Client only - before assignment)
 * @route   PUT /api/tasks/:id
 * @access  Private (Client)
 */
exports.updateTask = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Only task owner can update
    if (task.client_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this task",
      });
    }

    // Can only update if not yet assigned
    if (task.status !== "submitted" && task.status !== "under_review") {
      return res.status(400).json({
        success: false,
        message: "Cannot update task that is already assigned or in progress",
      });
    }

    const allowedUpdates = [
      "title",
      "description",
      "category",
      "budget",
      "deadline",
    ];
    const updates = {};
    const taskDetailsUpdate = { ...task.task_details };

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        taskDetailsUpdate[field] = req.body[field];
      }
    });

    const updatedTask = await taskData.updateTask(req.params.id, { task_details: taskDetailsUpdate });

    await auditLogData.log({
      user_id: req.user.id,
      action: "task_updated",
      resource: "task",
      resource_id: task.id,
      changes: updates,
      ip_address: req.ip,
    });

    logger.info(`Task updated: ${task.id}`);

    realtimeHub.publish({
      users: [task.client_id, task.freelancer_id].filter(Boolean),
      event: "task.updated",
      payload: {
        taskId: task.id,
        status: updatedTask.status,
        title: updatedTask.task_details?.title,
      },
    });

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error) {
    logger.error("Error updating task:", error);
    next(error);
  }
};

/**
 * @desc    Delete/Cancel task
 * @route   DELETE /api/tasks/:id
 * @access  Private (Client/Admin)
 */
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Authorization
    if (
      req.user.role === "client" &&
      task.client_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this task",
      });
    }

    // Cannot delete if in progress or completed
    if (["in_progress", "submitted_work", "completed"].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete task that is in progress or completed",
      });
    }

    await taskService.transitionTo(task.id, 'cancelled');

    await auditLogData.log({
      user_id: req.user.id,
      action: "task_cancelled",
      resource: "task",
      resource_id: task.id,
      ip_address: req.ip,
    });

    logger.info(`Task cancelled: ${task.id}`);

    realtimeHub.publish({
      users: [task.client_id, task.freelancer_id].filter(Boolean),
      event: "task.status_changed",
      payload: {
        taskId: task.id,
        status: "cancelled",
      },
    });

    res.status(200).json({
      success: true,
      message: "Task cancelled successfully",
    });
  } catch (error) {
    logger.error("Error deleting task:", error);
    next(error);
  }
};

/**
 * @desc    Submit work for a task (Freelancer only)
 * @route   POST /api/tasks/:id/submit
 * @access  Private (Freelancer)
 */
exports.submitTask = async (req, res, next) => {
  try {
    const { deliverables, comments } = req.body;

    const task = await taskData.findTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Verify assigned freelancer
    if (
      !task.freelancer_id ||
      task.freelancer_id !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to submit this task",
      });
    }

    if (task.status !== "in_progress") {
      return res.status(400).json({
        success: false,
        message: "Task is not in progress",
      });
    }

    // Create submission
    const submission = await submissionData.createSubmission({
      task_id: task.id,
      freelancer_id: req.user.id,
      content: {
          deliverables: deliverables || [],
          notes: comments || "",
      },
      submission_type: 'initial', // TODO: handle revisions
    });

    // Update task status
    const updatedTask = await taskService.transitionTo(task.id, "submitted_work");

    // Notify client
    await NotificationService.create({
      recipient_id: task.client_id,
      type: "task_submitted",
      content: {
        title: "Task Submitted",
        message: `Freelancer has submitted work for task: ${task.task_details.title}`,
      },
      related_task_id: task.id,
    });

    await auditLogData.log({
      user_id: req.user.id,
      action: "task_submitted",
      resource: "task",
      resource_id: task.id,
      changes: { submissionId: submission.id },
      ip_address: req.ip,
    });

    logger.info(`Task submitted: ${task.id} by freelancer: ${req.user.id}`);

    realtimeHub.publish({
      users: [task.client_id, task.freelancer_id].filter(Boolean),
      event: "task.status_changed",
      payload: {
        taskId: task.id,
        status: updatedTask.status,
      },
    });

    res.status(201).json({
      success: true,
      message: "Work submitted successfully",
      data: { task: updatedTask, submission },
    });
  } catch (error) {
    logger.error("Error submitting task:", error);
    next(error);
  }
};

/**
 * @desc    Get task statistics
 * @route   GET /api/tasks/stats
 * @access  Private
 */
exports.getTaskStats = async (req, res, next) => {
  try {
    const filters = {};

    if (req.user.role === "client") {
      filters.client_id = req.user.id;
    } else if (req.user.role === "freelancer") {
      filters.freelancer_id = req.user.id;
    }

    const tasks = await taskData.findTasks(filters);
    const total = tasks.length;

    res.status(200).json({
      success: true,
      data: {
        total,
      },
    });
  } catch (error) {
    logger.error("Error fetching task stats:", error);
    next(error);
  }
};

/**
 * @desc    Get collaboration comments for a task
 * @route   GET /api/tasks/:id/comments
 * @access  Private
 */
exports.getTaskComments = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);
    collaborationService.ensureTaskAccess(task, req.user);

    const [comments, participants] = await Promise.all([
      collaborationService.listTaskComments(task),
      collaborationService.getParticipants(task),
    ]);

    res.status(200).json({
      success: true,
      data: {
        comments,
        participants,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add comment with mentions and attachments
 * @route   POST /api/tasks/:id/comments
 * @access  Private
 */
exports.addTaskComment = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);
    collaborationService.ensureTaskAccess(task, req.user);

    const body = String(req.body?.body || "").trim();
    if (!body && (!req.files || req.files.length === 0)) {
      return res.status(400).json({
        success: false,
        message: "Comment body or attachment is required",
      });
    }

    const result = await collaborationService.addTaskComment({
      task,
      actor: req.user,
      body,
      files: req.files || [],
      req,
    });

    res.status(201).json({
      success: true,
      message: "Comment added",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get task activity history
 * @route   GET /api/tasks/:id/activity
 * @access  Private
 */
exports.getTaskActivity = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);
    collaborationService.ensureTaskAccess(task, req.user);

    const history = await collaborationService.listTaskActivity(task);
    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get task subtasks/milestones
 * @route   GET /api/tasks/:id/subtasks
 * @access  Private
 */
exports.getSubtasks = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);
    collaborationService.ensureTaskAccess(task, req.user);

    const subtasks = Array.isArray(task.metrics?.subtasks)
      ? task.metrics.subtasks
      : [];
    const milestoneProgress = task.metrics?.milestoneProgress ?? 0;

    res.status(200).json({
      success: true,
      data: {
        subtasks,
        milestoneProgress,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a subtask/milestone
 * @route   POST /api/tasks/:id/subtasks
 * @access  Private
 */
exports.createSubtask = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);
    collaborationService.ensureTaskAccess(task, req.user);

    const result = await collaborationService.addSubtask({
      task,
      actor: req.user,
      payload: req.body || {},
    });

    res.status(201).json({
      success: true,
      message: "Subtask created",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update subtask/milestone
 * @route   PATCH /api/tasks/:id/subtasks/:subtaskId
 * @access  Private
 */
exports.updateSubtask = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);
    collaborationService.ensureTaskAccess(task, req.user);

    const result = await collaborationService.updateSubtask({
      task,
      actor: req.user,
      subtaskId: req.params.subtaskId,
      payload: req.body || {},
    });

    res.status(200).json({
      success: true,
      message: "Subtask updated",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete subtask/milestone
 * @route   DELETE /api/tasks/:id/subtasks/:subtaskId
 * @access  Private
 */
exports.deleteSubtask = async (req, res, next) => {
  try {
    const task = await taskData.findTaskById(req.params.id);
    collaborationService.ensureTaskAccess(task, req.user);

    const result = await collaborationService.deleteSubtask({
      task,
      actor: req.user,
      subtaskId: req.params.subtaskId,
    });

    res.status(200).json({
      success: true,
      message: "Subtask deleted",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
