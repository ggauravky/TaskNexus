// backend/src/services/taskService.js
const { TASK_STATUS, TASK_STATE_TRANSITIONS, BUSINESS_RULES } = require('../config/constants');
const taskData = require('../data/taskData');

const canTransitionTo = (currentStatus, newStatus) => {
    const allowedTransitions = TASK_STATE_TRANSITIONS[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
};

const transitionTo = async (taskId, newStatus) => {
    const task = await taskData.findTaskById(taskId);
    if (!task) {
        throw new Error('Task not found');
    }

    if (!canTransitionTo(task.status, newStatus)) {
        throw new Error(`Invalid state transition from ${task.status} to ${newStatus}`);
    }

    const workflowUpdate = { ...task.workflow };
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
        workflowUpdate[workflowMap[newStatus]] = new Date();
    }

    return await taskData.updateTask(taskId, { status: newStatus, workflow: workflowUpdate });
};

const canRequestRevision = (task) => {
    return task.metrics.revisionsUsed < task.task_details.revisionLimit;
};

const incrementRevisions = async (taskId) => {
    const task = await taskData.findTaskById(taskId);
    if (!task) {
        throw new Error('Task not found');
    }

    if (!canRequestRevision(task)) {
        throw new Error("Revision limit reached");
    }

    const newRevisionsUsed = task.metrics.revisionsUsed + 1;
    const deadline = new Date(task.task_details.deadline);
    deadline.setHours(deadline.getHours() + BUSINESS_RULES.REVISION_DEADLINE_EXTENSION_HOURS);

    const updates = {
        metrics: { ...task.metrics, revisionsUsed: newRevisionsUsed },
        task_details: { ...task.task_details, deadline: deadline.toISOString() },
    };

    return await taskData.updateTask(taskId, updates);
};

module.exports = {
    canTransitionTo,
    transitionTo,
    canRequestRevision,
    incrementRevisions,
};
