const taskData = require("../data/taskData");
const userData = require("../data/userData");
const submissionData = require("../data/submissionData");
const reviewData = require("../data/reviewData");
const { TASK_STATUS } = require("../contracts/domain");
const { serializeSubmission } = require("../serializers");
const { errors } = require("../utils/appError");

const workspaceRelationship = (task, actor) => {
  if (actor.role === "admin") return "admin";
  if (actor.role === "client" && task.client_id === actor.id) return "client";
  if (actor.role === "freelancer" && task.freelancer_id === actor.id) return "freelancer";
  return null;
};

const ensureWorkspaceAccess = (task, actor) => {
  if (!task) throw errors.notFound("Task not found");
  const relationship = workspaceRelationship(task, actor);
  if (!relationship) throw errors.forbidden("Not authorized to access this task workspace");
  return relationship;
};

const displayName = (user, fallback) => {
  const profile = user?.profile || {};
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  return name || profile.name || profile.displayName || fallback;
};

const serializeParticipant = (user, role) => {
  if (!user) return null;
  const profile = user.profile || {};
  return {
    id: user.id,
    role,
    name: displayName(user, role === "client" ? "Client" : "Freelancer"),
    avatar_url: profile.avatar_url || profile.avatarUrl || profile.avatar || null,
  };
};

const pickFields = (value, fields) => Object.fromEntries(
  fields
    .filter((field) => Object.prototype.hasOwnProperty.call(value || {}, field))
    .map((field) => [field, value[field]]),
);

const WORKFLOW_FIELDS = Object.freeze([
  "submittedAt",
  "underReviewAt",
  "reviewedAt",
  "approvedAt",
  "assignedAt",
  "startedAt",
  "submittedWorkAt",
  "deliveredAt",
  "completedAt",
  "cancelledAt",
  "unassignedAt",
]);

const METRIC_FIELDS = Object.freeze([
  "progress",
  "stage",
  "progressNote",
  "progressUpdatedAt",
  "revisionsUsed",
  "milestoneProgress",
]);

const serializeWorkspaceTask = (task) => ({
  id: task.id,
  task_id: task.task_id,
  client_id: task.client_id,
  freelancer_id: task.freelancer_id || null,
  task_details: task.task_details || {},
  status: task.status,
  workflow: pickFields(task.workflow, WORKFLOW_FIELDS),
  metrics: pickFields(task.metrics, METRIC_FIELDS),
  priority: task.priority || "medium",
  tags: Array.isArray(task.tags) ? task.tags : [],
  cancellation_reason: task.cancellation_reason || null,
  dispute: task.dispute || null,
  created_at: task.created_at || null,
  updated_at: task.updated_at || null,
});

const byNewestSubmission = (left, right) => {
  const versionDifference = Number(right.version || 0) - Number(left.version || 0);
  if (versionDifference) return versionDifference;
  return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
};

const currentSubmissionSummary = (submission) => {
  if (!submission) return null;
  return {
    id: submission.id,
    version: Number(submission.version || 1),
    is_active: Boolean(submission.is_active),
    submission_type: submission.submission_type || null,
    review_status: submission.client_review?.status || null,
    submitted_at: submission.created_at || null,
    updated_at: submission.updated_at || null,
  };
};

const deriveCapabilities = ({
  task,
  relationship,
  currentSubmission,
  hasRated,
  revisionLimitReached = false,
}) => {
  const permissions = {
    can_start: false,
    can_return_task: false,
    can_update_progress: false,
    can_submit: false,
    can_resubmit: false,
    can_review: false,
    can_request_revision: false,
    can_rate: false,
    can_manage_subtasks: true,
    can_collaborate: true,
  };
  const actions = [];

  if (relationship === "freelancer") {
    if (task.status === TASK_STATUS.ASSIGNED) {
      permissions.can_start = true;
      permissions.can_return_task = true;
      actions.push("start_work", "return_task");
    } else if (task.status === TASK_STATUS.IN_PROGRESS) {
      permissions.can_update_progress = true;
      permissions.can_submit = true;
      permissions.can_return_task = true;
      actions.push("update_progress", "submit_work", "return_task");
    } else if (
      task.status === TASK_STATUS.CLIENT_REVISION
      && currentSubmission?.client_review?.status === "revision_requested"
    ) {
      permissions.can_resubmit = true;
      actions.push("resubmit_work");
    }
  }

  if (
    relationship === "client"
    && task.status === TASK_STATUS.DELIVERED
    && currentSubmission?.client_review?.status === "pending"
  ) {
    permissions.can_review = true;
    permissions.can_request_revision = !revisionLimitReached;
    actions.push("approve_delivery");
    if (!revisionLimitReached) actions.push("request_revision");
  }

  if (
    relationship === "client"
    && task.status === TASK_STATUS.COMPLETED
    && task.freelancer_id
    && !hasRated
  ) {
    permissions.can_rate = true;
    actions.push("rate_freelancer");
  }

  return { permissions, available_actions: actions };
};

const getWorkspace = async (taskId, actor, { section } = {}) => {
  const task = await taskData.findTaskById(taskId);
  const relationship = ensureWorkspaceAccess(task, actor);

  const [client, freelancer, submissions, reviews, revisionCount] = await Promise.all([
    userData.findUserById(task.client_id),
    task.freelancer_id ? userData.findUserById(task.freelancer_id) : Promise.resolve(null),
    section === "delivery"
      ? submissionData.listRecentSubmissions(task.id, 25)
      : submissionData.findSubmissions({ task_id: task.id, is_active: true }),
    task.status === TASK_STATUS.COMPLETED
      ? reviewData.findReviews({
        task_id: task.id,
        reviewer_id: task.client_id,
        review_type: "client_to_platform",
      })
      : Promise.resolve([]),
    relationship === "client" && task.status === TASK_STATUS.DELIVERED
      ? submissionData.getRevisionCount(task.id)
      : Promise.resolve(0),
  ]);

  const currentSubmission = submissions
    .filter((submission) => submission.is_active)
    .sort(byNewestSubmission)[0] || null;
  const hasRated = reviews.length > 0;
  const revisionLimit = Number(task.task_details?.revisionLimit || 2);
  const capabilities = deriveCapabilities({
    task,
    relationship,
    currentSubmission,
    hasRated,
    revisionLimitReached: Number(revisionCount || 0) >= revisionLimit,
  });
  const workspace = {
    task: serializeWorkspaceTask(task),
    viewer: { role: actor.role, relationship },
    participants: {
      client: serializeParticipant(client, "client"),
      freelancer: serializeParticipant(freelancer, "freelancer"),
    },
    progress: {
      percentage: Number(task.metrics?.progress || 0),
      stage: task.metrics?.stage || null,
      note: task.metrics?.progressNote || null,
      updated_at: task.metrics?.progressUpdatedAt || null,
    },
    current_submission: currentSubmissionSummary(currentSubmission),
    submission_summary: {
      has_active_submission: Boolean(currentSubmission),
      active_version: currentSubmission ? Number(currentSubmission.version || 1) : null,
      review_status: currentSubmission?.client_review?.status || null,
    },
    rating: { has_rated: hasRated },
    ...capabilities,
  };

  if (section === "delivery") {
    workspace.delivery = {
      submissions: [...submissions].sort(byNewestSubmission).map(serializeSubmission),
      rating: { has_rated: hasRated },
    };
  }

  return workspace;
};

module.exports = {
  deriveCapabilities,
  ensureWorkspaceAccess,
  getWorkspace,
};
