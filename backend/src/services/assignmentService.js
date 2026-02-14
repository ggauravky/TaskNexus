const userData = require("../data/userData");
const taskData = require("../data/taskData");
const {
  ASSIGNMENT_WEIGHTS,
  USER_ROLES,
  TASK_TYPES,
} = require("../config/constants");
const logger = require("../utils/logger");

const canAcceptTask = (freelancer) => {
    if (freelancer.role !== USER_ROLES.FREELANCER) {
        return false;
    }
    return (
        freelancer.freelancer_profile.currentActiveTasks <
        freelancer.freelancer_profile.maxActiveTasks
    );
};

/**
 * Smart Task Assignment Service
 * Core business logic for assigning tasks to freelancers
 */
class AssignmentService {
  /**
   * Calculate assignment score for a freelancer
   */
  static calculateAssignmentScore(freelancer, taskType, taskPriority) {
    const profile = freelancer.freelancer_profile;

    // Performance Score (0-100)
    const performanceScore = profile.performanceScore || 50;

    // Skill Match (0-100)
    const skillMatch = profile.skills.includes(taskType) ? 100 : 0;

    // Availability (0-100)
    const availabilityScore = canAcceptTask(freelancer) ? 100 : 0;

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
      const taskType = task.task_details.type;
      const priority = task.priority;

      const freelancers = await userData.findUsers({
        role: USER_ROLES.FREELANCER,
        status: "active",
        "freelancer_profile->skills": [taskType],
      });
      
      const availableFreelancers = freelancers.filter(f => canAcceptTask(f));

      if (availableFreelancers.length === 0) {
        logger.warn(
          `No available freelancers found for task type: ${taskType}`
        );
        return null;
      }

      // Score each freelancer
      const scoredFreelancers = availableFreelancers.map((freelancer) => ({
        freelancer,
        score: this.calculateAssignmentScore(freelancer, taskType, priority),
      }));

      // Sort by score (highest first)
      scoredFreelancers.sort((a, b) => b.score - a.score);

      // Log top candidates
      logger.info(
        `Top 3 candidates for task ${task.task_id}:`,
        scoredFreelancers.slice(0, 3).map((sf) => ({
          name: sf.freelancer.profile.firstName + ' ' + sf.freelancer.profile.lastName,
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
      const freelancer = await userData.findUserById(freelancerId);

      if (!freelancer || freelancer.role !== USER_ROLES.FREELANCER) {
        throw new Error("Invalid freelancer");
      }

      if (!canAcceptTask(freelancer)) {
        throw new Error("Freelancer cannot accept more tasks");
      }

      // Update task
      const updatedTask = await taskService.transitionTo(task.id, "assigned");
      await taskData.updateTask(task.id, { freelancer_id: freelancerId, assigned_by_id: assignedBy });

      // Update freelancer's active task count
      const freelancerProfile = freelancer.freelancer_profile;
      freelancerProfile.currentActiveTasks += 1;
      await userData.updateUser(freelancerId, { freelancer_profile: freelancerProfile });

      logger.info(
        `Task ${task.task_id} assigned to freelancer ${freelancer.profile.firstName} ${freelancer.profile.lastName}`
      );

      return { task: updatedTask, freelancer };
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

      return await this.assignTask(task, bestFreelancer.id, assignedBy);
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
      const oldFreelancerId = task.freelancer_id;

      // Decrease old freelancer's active task count
      if (oldFreelancerId) {
        const oldFreelancer = await userData.findUserById(oldFreelancerId);
        const freelancerProfile = oldFreelancer.freelancer_profile;
        freelancerProfile.currentActiveTasks -= 1;
        await userData.updateUser(oldFreelancerId, { freelancer_profile: freelancerProfile });
      }

      // Assign to new freelancer
      const result = await this.assignTask(task, newFreelancerId, assignedBy);

      // Update metrics
      const metrics = task.metrics;
      metrics.reassignmentCount += 1;
      const adminNotes = `Reassignment ${metrics.reassignmentCount}: ${reason}`;
      await taskData.updateTask(task.id, { metrics, admin_notes: adminNotes });


      logger.info(
        `Task ${task.task_id} reassigned from ${oldFreelancerId} to ${newFreelancerId}`
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
      const taskType = task.task_details.type;
      const freelancers = await userData.findUsers({
        role: USER_ROLES.FREELANCER,
        status: "active",
        "freelancer_profile->skills": [taskType],
      });
      
      const availableFreelancers = freelancers.filter(f => canAcceptTask(f));

      const scoredFreelancers = availableFreelancers.map((freelancer) => ({
        freelancer: {
          id: freelancer.id,
          name: freelancer.profile.firstName + ' ' + freelancer.profile.lastName,
          email: freelancer.email,
          skills: freelancer.freelancer_profile.skills,
          performanceScore: freelancer.freelancer_profile.performanceScore,
          completedTasks: freelancer.freelancer_profile.completedTasks,
          rating: freelancer.freelancer_profile.rating,
          currentActiveTasks: freelancer.freelancer_profile.currentActiveTasks,
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
