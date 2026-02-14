const taskData = require("../data/taskData");
const submissionData = require("../data/submissionData");
const auditLogData = require("../data/auditLogData");
const logger = require("../utils/logger");
const NotificationService = require("../services/notificationService");

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
    } = req.body;

    const taskType = category.replace(/_/g, "-");

    const task = await taskData.createTask({
      client_id: req.user.id,
      task_details: {
        title: title.trim(),
        type: taskType,
        description: description.trim(),
        budget: parseFloat(budget),
        deadline: new Date(deadline),
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
