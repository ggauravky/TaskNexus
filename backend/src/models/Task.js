const mongoose = require("mongoose");
const {
  TASK_STATUS,
  TASK_TYPES,
  TASK_PRIORITY,
  BUSINESS_RULES,
} = require("../config/constants");

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      unique: true,
      required: true,
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Client is required"],
    },

    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    taskDetails: {
      title: {
        type: String,
        required: [true, "Task title is required"],
        trim: true,
        maxlength: [200, "Title cannot exceed 200 characters"],
      },

      type: {
        type: String,
        enum: Object.values(TASK_TYPES),
        required: [true, "Task type is required"],
      },

      description: {
        type: String,
        required: [true, "Task description is required"],
        trim: true,
      },

      requirements: {
        type: String,
        trim: true,
      },

      attachments: [
        {
          filename: String,
          url: String,
          size: Number,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],

      deadline: {
        type: Date,
        required: [true, "Deadline is required"],
        validate: {
          validator: function (value) {
            return value > new Date();
          },
          message: "Deadline must be in the future",
        },
      },

      budget: {
        type: Number,
        required: [true, "Budget is required"],
        min: [1, "Budget must be at least $1"],
      },

      revisionLimit: {
        type: Number,
        default: BUSINESS_RULES.DEFAULT_REVISION_LIMIT,
        min: 0,
      },
    },

    status: {
      type: String,
      enum: Object.values(TASK_STATUS),
      default: TASK_STATUS.SUBMITTED,
    },

    workflow: {
      submittedAt: {
        type: Date,
        default: Date.now,
      },
      reviewedAt: Date,
      assignedAt: Date,
      startedAt: Date,
      submittedWorkAt: Date,
      qaCompletedAt: Date,
      deliveredAt: Date,
      completedAt: Date,
      cancelledAt: Date,
    },

    metrics: {
      revisionsUsed: {
        type: Number,
        default: 0,
      },
      reassignmentCount: {
        type: Number,
        default: 0,
      },
      actualCompletionTime: {
        type: Number, // in hours
        default: 0,
      },
      isOverdue: {
        type: Boolean,
        default: false,
      },
    },

    priority: {
      type: String,
      enum: Object.values(TASK_PRIORITY),
      default: TASK_PRIORITY.MEDIUM,
    },

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    // Admin notes (internal)
    adminNotes: {
      type: String,
      select: false,
    },

    // Cancellation/rejection reason
    cancellationReason: {
      type: String,
    },

    // Dispute information
    dispute: {
      isDisputed: {
        type: Boolean,
        default: false,
      },
      raisedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reason: String,
      raisedAt: Date,
      resolvedAt: Date,
      resolution: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Note: taskId index is created automatically by unique: true in schema
taskSchema.index({ client: 1, status: 1 });
taskSchema.index({ freelancer: 1, status: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ "taskDetails.type": 1 });
taskSchema.index({ "taskDetails.deadline": 1 });
taskSchema.index({ priority: 1 });
taskSchema.index({ createdAt: -1 });
taskSchema.index({ "workflow.submittedAt": -1 });

// Virtual for days until deadline
taskSchema.virtual("daysUntilDeadline").get(function () {
  if (!this.taskDetails.deadline) return null;
  const now = new Date();
  const deadline = new Date(this.taskDetails.deadline);
  const diff = deadline - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual for is overdue
taskSchema.virtual("isOverdue").get(function () {
  if (!this.taskDetails.deadline) return false;
  return new Date() > new Date(this.taskDetails.deadline);
});

// Pre-save middleware to generate taskId
taskSchema.pre("save", async function (next) {
  if (this.isNew && !this.taskId) {
    // Generate unique task ID: TSK-YYYYMMDD-XXXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(10000 + Math.random() * 90000);
    this.taskId = `TSK-${dateStr}-${random}`;

    // Check if taskId already exists (rare collision)
    const exists = await this.constructor.findOne({ taskId: this.taskId });
    if (exists) {
      const newRandom = Math.floor(10000 + Math.random() * 90000);
      this.taskId = `TSK-${dateStr}-${newRandom}`;
    }
  }
  next();
});

// Method to check if task can transition to new status
taskSchema.methods.canTransitionTo = function (newStatus) {
  const { TASK_STATE_TRANSITIONS } = require("../config/constants");
  const allowedTransitions = TASK_STATE_TRANSITIONS[this.status] || [];
  return allowedTransitions.includes(newStatus);
};

// Method to transition to new status
taskSchema.methods.transitionTo = function (newStatus, updatedBy = null) {
  if (!this.canTransitionTo(newStatus)) {
    throw new Error(
      `Invalid state transition from ${this.status} to ${newStatus}`
    );
  }

  this.status = newStatus;

  // Update workflow timestamps
  const workflowMap = {
    [TASK_STATUS.UNDER_REVIEW]: "reviewedAt",
    [TASK_STATUS.ASSIGNED]: "assignedAt",
    [TASK_STATUS.IN_PROGRESS]: "startedAt",
    [TASK_STATUS.SUBMITTED_WORK]: "submittedWorkAt",
    [TASK_STATUS.DELIVERED]: "deliveredAt",
    [TASK_STATUS.COMPLETED]: "completedAt",
    [TASK_STATUS.CANCELLED]: "cancelledAt",
  };

  if (workflowMap[newStatus]) {
    this.workflow[workflowMap[newStatus]] = new Date();
  }

  return this;
};

// Method to check if revisions are available
taskSchema.methods.canRequestRevision = function () {
  return this.metrics.revisionsUsed < this.taskDetails.revisionLimit;
};

// Method to increment revision count
taskSchema.methods.incrementRevisions = function () {
  if (!this.canRequestRevision()) {
    throw new Error("Revision limit reached");
  }
  this.metrics.revisionsUsed += 1;

  // Extend deadline by 48 hours for revision
  const deadline = new Date(this.taskDetails.deadline);
  deadline.setHours(
    deadline.getHours() + BUSINESS_RULES.REVISION_DEADLINE_EXTENSION_HOURS
  );
  this.taskDetails.deadline = deadline;

  return this;
};

// Static method to find overdue tasks
taskSchema.statics.findOverdueTasks = function () {
  return this.find({
    "taskDetails.deadline": { $lt: new Date() },
    status: {
      $in: [
        TASK_STATUS.ASSIGNED,
        TASK_STATUS.IN_PROGRESS,
        TASK_STATUS.SUBMITTED_WORK,
        TASK_STATUS.QA_REVIEW,
      ],
    },
  });
};

// Static method to find tasks needing deadline reminders
taskSchema.statics.findTasksNeedingReminders = function () {
  const reminderThreshold = new Date();
  reminderThreshold.setHours(
    reminderThreshold.getHours() + BUSINESS_RULES.DEADLINE_WARNING_HOURS
  );

  return this.find({
    "taskDetails.deadline": {
      $lte: reminderThreshold,
      $gt: new Date(),
    },
    status: {
      $in: [
        TASK_STATUS.ASSIGNED,
        TASK_STATUS.IN_PROGRESS,
        TASK_STATUS.SUBMITTED_WORK,
      ],
    },
  });
};

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
