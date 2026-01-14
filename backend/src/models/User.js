const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const {
  USER_ROLES,
  USER_STATUS,
  BUSINESS_RULES,
} = require("../config/constants");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [
        BUSINESS_RULES.PASSWORD_MIN_LENGTH,
        `Password must be at least ${BUSINESS_RULES.PASSWORD_MIN_LENGTH} characters`,
      ],
      select: false, // Don't return password by default
    },

    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: [true, "User role is required"],
    },

    profile: {
      firstName: {
        type: String,
        required: [true, "First name is required"],
        trim: true,
      },
      lastName: {
        type: String,
        required: [true, "Last name is required"],
        trim: true,
      },
      phone: {
        type: String,
        trim: true,
      },
      avatar: {
        type: String,
        default: null,
      },
    },

    // Freelancer-specific fields
    freelancerProfile: {
      skills: [
        {
          type: String,
          trim: true,
        },
      ],
      experience: {
        type: Number, // Years of experience
        min: 0,
        default: 0,
      },
      availability: {
        type: String,
        enum: ["full-time", "part-time", "weekends", "flexible"],
        default: "flexible",
      },
      performanceScore: {
        type: Number,
        min: BUSINESS_RULES.MIN_PERFORMANCE_SCORE,
        max: BUSINESS_RULES.MAX_PERFORMANCE_SCORE,
        default: 50, // Start at middle score
      },
      completedTasks: {
        type: Number,
        default: 0,
      },
      rating: {
        type: Number,
        min: BUSINESS_RULES.MIN_RATING,
        max: BUSINESS_RULES.MAX_RATING,
        default: 0,
      },
      totalRatings: {
        type: Number,
        default: 0,
      },
      // Performance metrics
      metrics: {
        onTimeCompletionRate: {
          type: Number,
          default: 0,
        },
        firstTimeApprovalRate: {
          type: Number,
          default: 0,
        },
        qaPassRate: {
          type: Number,
          default: 0,
        },
        averageCompletionTime: {
          type: Number, // in hours
          default: 0,
        },
        missedDeadlines: {
          type: Number,
          default: 0,
        },
      },
      // Current workload
      currentActiveTasks: {
        type: Number,
        default: 0,
      },
      maxActiveTasks: {
        type: Number,
        default: 3, // Can be adjusted per freelancer
      },
    },

    // Client-specific fields
    clientProfile: {
      company: {
        type: String,
        trim: true,
      },
      totalTasksSubmitted: {
        type: Number,
        default: 0,
      },
      totalSpent: {
        type: Number,
        default: 0,
      },
    },

    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },

    // Refresh token for JWT authentication
    refreshToken: {
      type: String,
      select: false,
    },

    // Account metadata
    lastLogin: {
      type: Date,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ "freelancerProfile.performanceScore": -1 });
userSchema.index({ "freelancerProfile.skills": 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.profile.firstName} ${this.profile.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(
      parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12
    );
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to check if user can accept more tasks (for freelancers)
userSchema.methods.canAcceptTask = function () {
  if (this.role !== USER_ROLES.FREELANCER) {
    return false;
  }
  return (
    this.freelancerProfile.currentActiveTasks <
    this.freelancerProfile.maxActiveTasks
  );
};

// Method to update performance score
userSchema.methods.updatePerformanceScore = function () {
  if (this.role !== USER_ROLES.FREELANCER) {
    return;
  }

  const { PERFORMANCE_WEIGHTS } = require("../config/constants");
  const metrics = this.freelancerProfile.metrics;

  const score =
    metrics.onTimeCompletionRate * PERFORMANCE_WEIGHTS.ON_TIME_COMPLETION +
    metrics.firstTimeApprovalRate * PERFORMANCE_WEIGHTS.FIRST_TIME_APPROVAL +
    this.freelancerProfile.rating *
      20 *
      PERFORMANCE_WEIGHTS.CLIENT_SATISFACTION + // Convert 1-5 to 0-100
    metrics.qaPassRate * PERFORMANCE_WEIGHTS.QA_PASS_RATE;

  this.freelancerProfile.performanceScore = Math.round(
    Math.min(
      BUSINESS_RULES.MAX_PERFORMANCE_SCORE,
      Math.max(BUSINESS_RULES.MIN_PERFORMANCE_SCORE, score)
    )
  );
};

// Static method to find available freelancers for task assignment
userSchema.statics.findAvailableFreelancers = async function (
  taskType,
  requiredSkills = []
) {
  return this.find({
    role: USER_ROLES.FREELANCER,
    status: USER_STATUS.ACTIVE,
    $expr: {
      $lt: [
        "$freelancerProfile.currentActiveTasks",
        "$freelancerProfile.maxActiveTasks",
      ],
    },
    "freelancerProfile.skills": {
      $in: requiredSkills.length > 0 ? requiredSkills : [taskType],
    },
  })
    .sort({ "freelancerProfile.performanceScore": -1 })
    .limit(10);
};

// Remove sensitive fields before JSON conversion
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
