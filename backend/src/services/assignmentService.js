const User = require("../models/User");
const Task = require("../models/Task");
const {
  ASSIGNMENT_WEIGHTS,
  USER_ROLES,
  TASK_TYPES,
} = require("../config/constants");
const logger = require("../utils/logger");

/**
 * Smart Task Assignment Service
 * Core business logic for assigning tasks to freelancers
 */
class AssignmentService {
  /**
   * Calculate assignment score for a freelancer
   */
  static calculateAssignmentScore(freelancer, taskType, taskPriority) {
    const profile = freelancer.freelancerProfile;

    // Performance Score (0-100)
    const performanceScore = profile.performanceScore || 50;

    // Skill Match (0-100)
    const skillMatch = profile.skills.includes(taskType) ? 100 : 0;

    // Availability (0-100)
    const availabilityScore = freelancer.canAcceptTask() ? 100 : 0;

    // Completion Rate (0-100)
    const completionRate = profile.metrics.onTimeCompletionRate || 50;

    // Calculate weighted score
    const score =
      performanceScore * ASSIGNMENT_WEIGHTS.PERFORMANCE_SCORE +
      skillMatch * ASSIGNMENT_WEIGHTS.SKILL_MATCH +
      availabilityScore * ASSIGNMENT_WEIGHTS.AVAILABILITY +
      completionRate * ASSIGNMENT_WEIGHTS.COMPLETION_RATE;

    return Math.round(score);
  }

  /**
   * Find best freelancer for a task
   */
  static async findBestFreelancer(task) {
    try {
      const taskType = task.taskDetails.type;
      const priority = task.priority;

      // Get all available freelancers with matching skills
      const freelancers = await User.findAvailableFreelancers(taskType, [
        taskType,
      ]);

      if (freelancers.length === 0) {
        logger.warn(
          `No available freelancers found for task type: ${taskType}`
        );
        return null;
      }

      // Score each freelancer
      const scoredFreelancers = freelancers.map((freelancer) => ({
        freelancer,
        score: this.calculateAssignmentScore(freelancer, taskType, priority),
      }));

      // Sort by score (highest first)
      scoredFreelancers.sort((a, b) => b.score - a.score);

      // Log top candidates
      logger.info(
        `Top 3 candidates for task ${task.taskId}:`,
        scoredFreelancers.slice(0, 3).map((sf) => ({
          name: sf.freelancer.fullName,
          score: sf.score,
        }))
      );

      // Return best freelancer
      return scoredFreelancers[0].freelancer;
    } catch (error) {
      logger.error("Error in findBestFreelancer:", error);
      throw error;
    }
  }

  /**
   * Assign task to a specific freelancer
   */
  static async assignTask(task, freelancerId, assignedBy) {
    try {
      const freelancer = await User.findById(freelancerId);

      if (!freelancer || freelancer.role !== USER_ROLES.FREELANCER) {
        throw new Error("Invalid freelancer");
      }

      if (!freelancer.canAcceptTask()) {
        throw new Error("Freelancer cannot accept more tasks");
      }

      // Update task
      task.freelancer = freelancerId;
      task.assignedBy = assignedBy;
      task.transitionTo("assigned");
      await task.save();

      // Update freelancer's active task count
      freelancer.freelancerProfile.currentActiveTasks += 1;
      await freelancer.save();

      logger.info(
        `Task ${task.taskId} assigned to freelancer ${freelancer.fullName}`
      );

      return { task, freelancer };
    } catch (error) {
      logger.error("Error in assignTask:", error);
      throw error;
    }
  }

  /**
   * Auto-assign task using smart algorithm
   */
  static async autoAssignTask(task, assignedBy) {
    try {
      const bestFreelancer = await this.findBestFreelancer(task);

      if (!bestFreelancer) {
        throw new Error("No available freelancer found");
      }

      return await this.assignTask(task, bestFreelancer._id, assignedBy);
    } catch (error) {
      logger.error("Error in autoAssignTask:", error);
      throw error;
    }
  }

  /**
   * Reassign task to a different freelancer
   */
  static async reassignTask(task, newFreelancerId, assignedBy, reason) {
    try {
      const oldFreelancerId = task.freelancer;

      // Decrease old freelancer's active task count
      if (oldFreelancerId) {
        await User.findByIdAndUpdate(oldFreelancerId, {
          $inc: { "freelancerProfile.currentActiveTasks": -1 },
        });
      }

      // Assign to new freelancer
      const result = await this.assignTask(task, newFreelancerId, assignedBy);

      // Update metrics
      task.metrics.reassignmentCount += 1;
      if (reason) {
        task.adminNotes = `Reassignment ${task.metrics.reassignmentCount}: ${reason}`;
      }
      await task.save();

      logger.info(
        `Task ${task.taskId} reassigned from ${oldFreelancerId} to ${newFreelancerId}`
      );

      return result;
    } catch (error) {
      logger.error("Error in reassignTask:", error);
      throw error;
    }
  }

  /**
   * Get freelancer recommendations for a task
   */
  static async getRecommendations(task, limit = 5) {
    try {
      const taskType = task.taskDetails.type;
      const freelancers = await User.findAvailableFreelancers(taskType, [
        taskType,
      ]);

      const scoredFreelancers = freelancers.map((freelancer) => ({
        freelancer: {
          _id: freelancer._id,
          name: freelancer.fullName,
          email: freelancer.email,
          skills: freelancer.freelancerProfile.skills,
          performanceScore: freelancer.freelancerProfile.performanceScore,
          completedTasks: freelancer.freelancerProfile.completedTasks,
          rating: freelancer.freelancerProfile.rating,
          currentActiveTasks: freelancer.freelancerProfile.currentActiveTasks,
        },
        assignmentScore: this.calculateAssignmentScore(
          freelancer,
          taskType,
          task.priority
        ),
      }));

      scoredFreelancers.sort((a, b) => b.assignmentScore - a.assignmentScore);

      return scoredFreelancers.slice(0, limit);
    } catch (error) {
      logger.error("Error in getRecommendations:", error);
      throw error;
    }
  }
}

module.exports = AssignmentService;
