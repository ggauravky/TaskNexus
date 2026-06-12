// backend/src/services/performanceService.js
const taskData = require("../data/taskData");
const submissionData = require("../data/submissionData");
const reviewData = require("../data/reviewData");
const userData = require("../data/userData");
const logger = require("../utils/logger");

/**
 * Calculates dynamic performance statistics for a freelancer
 * Formula:
 * Performance Score (0-100) =
 *   (On-time Completion Rate * 40) +
 *   (First-time Approval Rate * 30) +
 *   (Client Satisfaction * 20) +
 *   (Admin QA Pass Rate * 10)
 */
const calculatePerformanceMetrics = async (freelancerId) => {
  try {
    const tasks = await taskData.findTasks({ freelancer_id: freelancerId });
    const submissions = await submissionData.findSubmissions({ freelancer_id: freelancerId });
    const ratingsObj = await reviewData.getAverageRating(freelancerId);

    const completedTasks = tasks.filter((t) => t.status === "completed");
    const totalCompleted = completedTasks.length;

    // 1. On-time Completion Rate (default to 100% if no tasks completed)
    let onTimeDeliveryRate = 100;
    if (totalCompleted > 0) {
      const onTimeCount = completedTasks.filter((t) => {
        const deadline = t.task_details?.deadline ? new Date(t.task_details.deadline) : null;
        const completedAt = t.workflow?.completedAt ? new Date(t.workflow.completedAt) : null;
        if (!deadline || !completedAt) return true; // default to ontime if missing dates
        return completedAt <= deadline;
      }).length;
      onTimeDeliveryRate = Math.round((onTimeCount / totalCompleted) * 100);
    }

    // 2. First-time Approval Rate (default to 100%)
    let firstTimeApprovalRate = 100;
    if (totalCompleted > 0) {
      const firstTimeApprovals = completedTasks.filter((t) => {
        const revisionsUsed = t.metrics?.revisionsUsed ?? 0;
        return revisionsUsed === 0;
      }).length;
      firstTimeApprovalRate = Math.round((firstTimeApprovals / totalCompleted) * 100);
    }

    // 3. Client Satisfaction (Rating converted to percentage, default to 100% / 5 stars)
    const clientSatisfaction = ratingsObj.averageRating ? (ratingsObj.averageRating / 5) * 100 : 100;

    // 4. Admin QA Pass Rate (default to 100%)
    let qaPassRate = 100;
    if (submissions.length > 0) {
      const approvedQa = submissions.filter((s) => s.qa_review?.status === "approved").length;
      qaPassRate = Math.round((approvedQa / submissions.length) * 100);
    }

    // Performance Score formula
    const performanceScore = Math.round(
      onTimeDeliveryRate * 0.4 +
      firstTimeApprovalRate * 0.3 +
      clientSatisfaction * 0.2 +
      qaPassRate * 0.1
    );

    // Bound the score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, performanceScore));

    // Update freelancer profile stats in background for caching/relational checks
    const freelancer = await userData.findUserById(freelancerId);
    if (freelancer && freelancer.freelancer_profile) {
      const freelancerProfile = { ...freelancer.freelancer_profile };
      freelancerProfile.performanceScore = finalScore;
      freelancerProfile.onTimeDeliveryRate = onTimeDeliveryRate;
      await userData.updateUser(freelancerId, {
        freelancer_profile: freelancerProfile,
      });
    }

    return {
      performanceScore: finalScore,
      onTimeDeliveryRate,
    };
  } catch (error) {
    logger.error(`Error calculating performance metrics for freelancer ${freelancerId}:`, error);
    // Return sensible defaults in case of any failures
    return {
      performanceScore: 85,
      onTimeDeliveryRate: 95,
    };
  }
};

module.exports = {
  calculatePerformanceMetrics,
};
