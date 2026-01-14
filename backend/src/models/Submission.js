const mongoose = require("mongoose");
const {
  SUBMISSION_TYPE,
  QA_STATUS,
  CLIENT_REVIEW_STATUS,
} = require("../config/constants");

const submissionSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: [true, "Task reference is required"],
    },

    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Freelancer reference is required"],
    },

    submissionType: {
      type: String,
      enum: Object.values(SUBMISSION_TYPE),
      required: true,
    },

    content: {
      description: {
        type: String,
        required: [true, "Submission description is required"],
        trim: true,
      },

      deliverables: [
        {
          filename: String,
          url: String,
          size: Number,
          mimeType: String,
          uploadedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],

      notes: {
        type: String,
        trim: true,
      },
    },

    qaReview: {
      reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      status: {
        type: String,
        enum: Object.values(QA_STATUS),
        default: QA_STATUS.PENDING,
      },
      feedback: {
        type: String,
        trim: true,
      },
      reviewedAt: Date,
      qualityScore: {
        type: Number,
        min: 1,
        max: 5,
      },
    },

    clientReview: {
      status: {
        type: String,
        enum: Object.values(CLIENT_REVIEW_STATUS),
        default: CLIENT_REVIEW_STATUS.PENDING,
      },
      feedback: {
        type: String,
        trim: true,
      },
      reviewedAt: Date,
    },

    version: {
      type: Number,
      required: true,
      default: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
submissionSchema.index({ task: 1, version: -1 });
submissionSchema.index({ freelancer: 1 });
submissionSchema.index({ "qaReview.status": 1 });
submissionSchema.index({ "qaReview.reviewer": 1 });
submissionSchema.index({ createdAt: -1 });

// Static method to get latest submission for a task
submissionSchema.statics.getLatestForTask = function (taskId) {
  return this.findOne({ task: taskId, isActive: true })
    .sort({ version: -1 })
    .populate("freelancer", "profile email")
    .populate("qaReview.reviewer", "profile email");
};

// Static method to get all submissions for a task
submissionSchema.statics.getAllForTask = function (taskId) {
  return this.find({ task: taskId })
    .sort({ version: -1 })
    .populate("freelancer", "profile email")
    .populate("qaReview.reviewer", "profile email");
};

const Submission = mongoose.model("Submission", submissionSchema);

module.exports = Submission;
