const mongoose = require("mongoose");
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
  NOTIFICATION_PRIORITY,
} = require("../config/constants");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
    },

    type: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      required: true,
    },

    content: {
      title: {
        type: String,
        required: true,
        trim: true,
      },
      message: {
        type: String,
        required: true,
        trim: true,
      },
      actionUrl: {
        type: String,
        trim: true,
      },
      actionLabel: {
        type: String,
        trim: true,
      },
    },

    relatedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },

    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.UNREAD,
    },

    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITY),
      default: NOTIFICATION_PRIORITY.MEDIUM,
    },

    readAt: Date,

    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ recipient: 1, status: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });
notificationSchema.index({ relatedTask: 1 });

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
  if (this.status === NOTIFICATION_STATUS.UNREAD) {
    this.status = NOTIFICATION_STATUS.READ;
    this.readAt = new Date();
  }
  return this;
};

// Static method to create notification
notificationSchema.statics.createNotification = async function (data) {
  const notification = new this(data);
  await notification.save();

  // Here you could trigger real-time notification via WebSocket
  // Future: emit to Socket.io

  return notification;
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function (userId) {
  return this.updateMany(
    {
      recipient: userId,
      status: NOTIFICATION_STATUS.UNREAD,
    },
    {
      status: NOTIFICATION_STATUS.READ,
      readAt: new Date(),
    }
  );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    recipient: userId,
    status: NOTIFICATION_STATUS.UNREAD,
  });
};

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
