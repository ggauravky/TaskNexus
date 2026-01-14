const mongoose = require("mongoose");
const { REVIEW_TYPE, BUSINESS_RULES } = require("../config/constants");

const reviewSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: [true, "Task reference is required"],
    },

    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reviewer is required"],
    },

    reviewee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Reviewee is required"],
    },

    reviewType: {
      type: String,
      enum: Object.values(REVIEW_TYPE),
      required: true,
    },

    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: BUSINESS_RULES.MIN_RATING,
      max: BUSINESS_RULES.MAX_RATING,
    },

    feedback: {
      type: String,
      trim: true,
      maxlength: [1000, "Feedback cannot exceed 1000 characters"],
    },

    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
reviewSchema.index({ task: 1 });
reviewSchema.index({ reviewer: 1 });
reviewSchema.index({ reviewee: 1 });
reviewSchema.index({ reviewType: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ createdAt: -1 });

// Compound index to prevent duplicate reviews
reviewSchema.index({ task: 1, reviewer: 1, reviewType: 1 }, { unique: true });

// Static method to get average rating for a user
reviewSchema.statics.getAverageRating = async function (userId) {
  const result = await this.aggregate([
    { $match: { reviewee: userId } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  return result[0] || { averageRating: 0, totalReviews: 0 };
};

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
