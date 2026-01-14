const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    resource: {
      type: String,
      required: true,
      enum: [
        "user",
        "task",
        "submission",
        "payment",
        "review",
        "notification",
        "settings",
      ],
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    changes: {
      type: mongoose.Schema.Types.Mixed,
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },

    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ timestamp: -1 });

// Static method to log action
auditLogSchema.statics.log = async function (data) {
  const log = new this(data);
  await log.save();
  return log;
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
