const mongoose = require("mongoose");
const { PAYMENT_STATUS, BUSINESS_RULES } = require("../config/constants");

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      unique: true,
      required: true,
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: [true, "Task reference is required"],
    },

    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Client reference is required"],
    },

    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Freelancer reference is required"],
    },

    amounts: {
      taskBudget: {
        type: Number,
        required: true,
        min: 0,
      },
      platformCommission: {
        type: Number,
        required: true,
        default: BUSINESS_RULES.PLATFORM_COMMISSION,
      },
      platformFee: {
        type: Number,
        required: true,
        min: 0,
      },
      freelancerPayout: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },

    escrow: {
      heldAt: Date,
      releaseScheduled: Date,
      releasedAt: Date,
    },

    transactionDetails: {
      paymentMethod: {
        type: String,
        default: "mock_payment", // Future: 'stripe', 'paypal', etc.
      },
      transactionId: String,
      gateway: {
        type: String,
        default: "mock", // Future: 'stripe'
      },
      gatewayResponse: mongoose.Schema.Types.Mixed,
    },

    refund: {
      isRefunded: {
        type: Boolean,
        default: false,
      },
      refundedAt: Date,
      refundReason: String,
      refundAmount: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// Note: paymentId index is created automatically by unique: true in schema
paymentSchema.index({ task: 1 });
paymentSchema.index({ client: 1 });
paymentSchema.index({ freelancer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

// Pre-save middleware to generate paymentId
paymentSchema.pre("save", async function (next) {
  if (this.isNew && !this.paymentId) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(100000 + Math.random() * 900000);
    this.paymentId = `PAY-${dateStr}-${random}`;

    // Check collision
    const exists = await this.constructor.findOne({
      paymentId: this.paymentId,
    });
    if (exists) {
      const newRandom = Math.floor(100000 + Math.random() * 900000);
      this.paymentId = `PAY-${dateStr}-${newRandom}`;
    }
  }
  next();
});

// Pre-save middleware to calculate fees
paymentSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("amounts.taskBudget")) {
    const budget = this.amounts.taskBudget;
    const commission = this.amounts.platformCommission;

    this.amounts.platformFee =
      Math.round(((budget * commission) / 100) * 100) / 100;
    this.amounts.freelancerPayout =
      Math.round((budget - this.amounts.platformFee) * 100) / 100;
  }
  next();
});

// Method to escrow payment
paymentSchema.methods.escrowPayment = function () {
  if (this.status !== PAYMENT_STATUS.PENDING) {
    throw new Error("Can only escrow pending payments");
  }

  this.status = PAYMENT_STATUS.ESCROWED;
  this.escrow.heldAt = new Date();

  return this;
};

// Method to release payment to freelancer
paymentSchema.methods.releasePayment = function () {
  if (this.status !== PAYMENT_STATUS.ESCROWED) {
    throw new Error("Can only release escrowed payments");
  }

  this.status = PAYMENT_STATUS.RELEASED;
  this.escrow.releasedAt = new Date();

  return this;
};

// Method to refund payment to client
paymentSchema.methods.refundPayment = function (reason) {
  if (this.status === PAYMENT_STATUS.RELEASED) {
    throw new Error("Cannot refund released payment");
  }

  this.status = PAYMENT_STATUS.REFUNDED;
  this.refund.isRefunded = true;
  this.refund.refundedAt = new Date();
  this.refund.refundReason = reason;
  this.refund.refundAmount = this.amounts.taskBudget;

  return this;
};

// Static method to calculate platform revenue
paymentSchema.statics.calculatePlatformRevenue = async function (
  startDate,
  endDate
) {
  const result = await this.aggregate([
    {
      $match: {
        status: PAYMENT_STATUS.RELEASED,
        "escrow.releasedAt": {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amounts.platformFee" },
        totalTransactions: { $sum: 1 },
        totalVolume: { $sum: "$amounts.taskBudget" },
      },
    },
  ]);

  return result[0] || { totalRevenue: 0, totalTransactions: 0, totalVolume: 0 };
};

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
