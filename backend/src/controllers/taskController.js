const Task = require("../models/Task");
const Submission = require("../models/Submission");
const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");
const { sendNotification } = require("../services/notificationService");

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

    // Validate required fields
    if (!title || !description || !category || !budget || !deadline) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Missing required fields",
          details: [
            { field: "title", message: "Title is required" },
            { field: "description", message: "Description is required" },
            { field: "category", message: "Category is required" },
            { field: "budget", message: "Budget is required" },
            { field: "deadline", message: "Deadline is required" },
          ].filter((err) => !eval(err.field.toLowerCase())),
        },
      });
    }

    // Generate unique task ID
    const taskId = `TASK-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Map category to valid task type (convert underscores to dashes)
    const taskType = category.replace(/_/g, "-");

    // Create task with correct structure
    const task = await Task.create({
      taskId,
      client: req.user._id,
      taskDetails: {
        title: title.trim(),
        type: taskType, // Convert web_development to web-development
        description: description.trim(),
        budget: parseFloat(budget),
        deadline: new Date(deadline),
      },
      skillsRequired: Array.isArray(skillsRequired) ? skillsRequired : [],
      experienceLevel: experienceLevel || "intermediate",
      status: "submitted", // Valid initial status
    });

    // Log activity
    await AuditLog.create({
      user: req.user._id,
      action: "task_created",
      resource: "task",
      resourceId: task._id,
      changes: { title, category, budget },
      ipAddress: req.ip,
    });

    logger.info(`Task created: ${task._id} by client: ${req.user._id}`);

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
    const {
      status,
      category,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const query = {};

    // Role-based filtering
    if (req.user.role === "client") {
      query.clientId = req.user._id;
    } else if (req.user.role === "freelancer") {
      // Freelancers see available or their assigned tasks
      if (!status || status === "available") {
        query.status = "available";
        query.freelancerId = null;
      } else {
        query.freelancerId = req.user._id;
      }
    }
    // Admin sees all tasks (no filter)

    // Additional filters
    if (status && req.user.role !== "freelancer") {
      query.status = status;
    }
    if (category) {
      query.category = category;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "desc" ? -1 : 1;

    const tasks = await Task.find(query)
      .populate("clientId", "name email companyName")
      .populate("freelancerId", "name email rating")
      .sort({ [sortBy]: sortOrder })
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
    const task = await Task.findById(req.params.id)
      .populate("clientId", "name email companyName phone")
      .populate("freelancerId", "name email rating completedTasks");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Authorization check
    if (
      req.user.role === "client" &&
      task.clientId._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this task",
      });
    }

    if (
      req.user.role === "freelancer" &&
      task.freelancerId &&
      task.freelancerId._id.toString() !== req.user._id.toString()
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
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Only task owner can update
    if (task.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this task",
      });
    }

    // Can only update if not yet assigned
    if (task.status !== "pending_review" && task.status !== "available") {
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
      "requirements",
      "attachments",
    ];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    Object.assign(task, updates);
    await task.save();

    await AuditLog.create({
      user: req.user._id,
      action: "task_updated",
      resource: "task",
      resourceId: task._id,
      changes: updates,
      ipAddress: req.ip,
    });

    logger.info(`Task updated: ${task._id}`);

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
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
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Authorization
    if (
      req.user.role === "client" &&
      task.clientId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this task",
      });
    }

    // Cannot delete if in progress or completed
    if (["in_progress", "submitted", "completed"].includes(task.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete task that is in progress or completed",
      });
    }

    task.status = "cancelled";
    await task.save();

    await AuditLog.create({
      user: req.user._id,
      action: "task_cancelled",
      resource: "task",
      resourceId: task._id,
      ipAddress: req.ip,
    });

    logger.info(`Task cancelled: ${task._id}`);

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

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Verify assigned freelancer
    if (
      !task.freelancerId ||
      task.freelancerId.toString() !== req.user._id.toString()
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
    const submission = await Submission.create({
      taskId: task._id,
      freelancerId: req.user._id,
      clientId: task.clientId,
      deliverables: deliverables || [],
      comments: comments || "",
      status: "pending",
    });

    // Update task status
    task.status = "submitted";
    task.submittedAt = new Date();
    await task.save();

    // Notify client
    await sendNotification({
      userId: task.clientId,
      type: "task_submitted",
      title: "Task Submitted",
      message: `Freelancer has submitted work for task: ${task.title}`,
      metadata: { taskId: task._id, submissionId: submission._id },
    });

    await AuditLog.create({
      user: req.user._id,
      action: "task_submitted",
      resource: "task",
      resourceId: task._id,
      changes: { submissionId: submission._id },
      ipAddress: req.ip,
    });

    logger.info(`Task submitted: ${task._id} by freelancer: ${req.user._id}`);

    res.status(201).json({
      success: true,
      message: "Work submitted successfully",
      data: { task, submission },
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
    const query = {};

    if (req.user.role === "client") {
      query.clientId = req.user._id;
    } else if (req.user.role === "freelancer") {
      query.freelancerId = req.user._id;
    }

    const stats = await Task.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalBudget: { $sum: "$budget" },
        },
      },
    ]);

    const total = await Task.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        total,
        byStatus: stats,
      },
    });
  } catch (error) {
    logger.error("Error fetching task stats:", error);
    next(error);
  }
};
