const { resolveNotificationTarget } = require("../services/notificationTargetService");

const SEARCH_GROUPS = Object.freeze([
  "teams",
  "projects",
  "people",
  "hackathons",
  "opportunities",
  "organizations",
  "tasks",
]);
const SEARCH_RESULT_LIMIT = 5;
const SEARCH_RESULT_TYPES = new Set([
  "team",
  "project",
  "person",
  "hackathon",
  "opportunity",
  "organization",
  "marketplace_task",
]);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeSearchQuery = (value) => {
  if (typeof value !== "string") {
    throw new TypeError("Search query must be between 2 and 80 characters");
  }
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 80) {
    throw new TypeError("Search query must be between 2 and 80 characters");
  }
  return normalized;
};

const validIdentifier = (value, pattern) => (
  typeof value === "string" && value === value.trim() && pattern.test(value)
);

const buildSearchTarget = (type, identifiers = {}) => {
  const { slug, teamSlug, username, taskId } = identifiers;
  if (type === "team" && validIdentifier(slug, SLUG_PATTERN)) return `/teams/${slug}`;
  if (
    type === "project"
    && validIdentifier(teamSlug, SLUG_PATTERN)
    && validIdentifier(slug, SLUG_PATTERN)
  ) return `/teams/${teamSlug}/projects/${slug}`;
  if (type === "person" && validIdentifier(username, USERNAME_PATTERN)) return `/u/${username}`;
  if (type === "hackathon" && validIdentifier(slug, SLUG_PATTERN)) return `/hackathons/${slug}`;
  if (type === "opportunity" && validIdentifier(slug, SLUG_PATTERN)) return `/opportunities/${slug}`;
  if (type === "organization" && validIdentifier(slug, SLUG_PATTERN)) return `/organizations/${slug}`;
  if (type === "marketplace_task" && validIdentifier(taskId, UUID_PATTERN)) return `/tasks/${taskId}`;
  return null;
};

const SEARCH_TARGET_PATTERNS = Object.freeze({
  team: /^\/teams\/[a-z0-9]+(?:-[a-z0-9]+)*$/i,
  project: /^\/teams\/[a-z0-9]+(?:-[a-z0-9]+)*\/projects\/[a-z0-9]+(?:-[a-z0-9]+)*$/i,
  person: /^\/u\/[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/i,
  hackathon: /^\/hackathons\/[a-z0-9]+(?:-[a-z0-9]+)*$/i,
  opportunity: /^\/opportunities\/[a-z0-9]+(?:-[a-z0-9]+)*$/i,
  organization: /^\/organizations\/[a-z0-9]+(?:-[a-z0-9]+)*$/i,
  marketplace_task: new RegExp(`^/tasks/${UUID_PATTERN.source.slice(1, -1)}$`, "i"),
});

const serializeSearchResult = ({ id, type, title, subtitle, status, targetPath } = {}) => {
  if (
    !SEARCH_RESULT_TYPES.has(type)
    || typeof id !== "string"
    || !id
    || typeof title !== "string"
    || !title.trim()
    || typeof targetPath !== "string"
    || !SEARCH_TARGET_PATTERNS[type].test(targetPath)
  ) return null;

  const dto = {
    id,
    type,
    title: title.trim(),
  };
  if (typeof subtitle === "string" && subtitle.trim()) dto.subtitle = subtitle.trim();
  if (typeof status === "string" && status.trim()) dto.status = status.trim();
  dto.target_path = targetPath;
  return dto;
};

const cloneJson = (value, fallback) => {
  if (value === undefined || value === null) return fallback;
  return JSON.parse(JSON.stringify(value));
};

const serializeUser = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    profile: cloneJson(user.profile, {}),
    freelancer_profile: cloneJson(user.freelancer_profile, null),
    client_profile: cloneJson(user.client_profile, null),
    notification_preferences: cloneJson(user.notification_preferences, null),
    last_login: user.last_login || null,
    is_email_verified: Boolean(user.is_email_verified),
    created_at: user.created_at || null,
    updated_at: user.updated_at || null,
  };
};

const serializeTask = (task) => {
  if (!task) return null;
  const dto = {
    id: task.id,
    task_id: task.task_id,
    client_id: task.client_id,
    freelancer_id: task.freelancer_id || null,
    assigned_by_id: task.assigned_by_id || null,
    task_details: cloneJson(task.task_details, {}),
    status: task.status,
    workflow: cloneJson(task.workflow, {}),
    metrics: cloneJson(task.metrics, {}),
    priority: task.priority,
    tags: cloneJson(task.tags, []),
    admin_notes: task.admin_notes || null,
    cancellation_reason: task.cancellation_reason || null,
    dispute: cloneJson(task.dispute, null),
    created_at: task.created_at || null,
    updated_at: task.updated_at || null,
  };
  if (Object.prototype.hasOwnProperty.call(task, "client")) dto.client = serializeUser(task.client);
  if (Object.prototype.hasOwnProperty.call(task, "freelancer")) dto.freelancer = serializeUser(task.freelancer);
  return dto;
};

const serializeSubmission = (submission) => {
  if (!submission) return null;
  const dto = {
    id: submission.id,
    task_id: submission.task_id,
    freelancer_id: submission.freelancer_id,
    submission_type: submission.submission_type,
    content: cloneJson(submission.content, {}),
    qa_review: cloneJson(submission.qa_review, null),
    client_review: cloneJson(submission.client_review, null),
    version: submission.version,
    is_active: Boolean(submission.is_active),
    created_at: submission.created_at || null,
    updated_at: submission.updated_at || null,
  };
  if (submission.task) dto.task = serializeTask(submission.task);
  return dto;
};

const serializeNotification = (notification) => {
  if (!notification) return null;
  return {
    id: notification.id,
    recipient_id: notification.recipient_id,
    actor_id: notification.actor_id || null,
    type: notification.type,
    entity_type: notification.entity_type || (notification.related_task_id ? "task" : null),
    entity_id: notification.entity_id || notification.related_task_id || null,
    related_task_id: notification.related_task_id || null,
    content: cloneJson(notification.content, {}),
    status: notification.status,
    priority: notification.priority,
    read_at: notification.read_at || null,
    metadata: cloneJson(notification.metadata, null),
    created_at: notification.created_at || null,
    target_path: resolveNotificationTarget(notification),
  };
};

module.exports = {
  SEARCH_GROUPS,
  SEARCH_RESULT_LIMIT,
  normalizeSearchQuery,
  buildSearchTarget,
  serializeSearchResult,
  serializeUser,
  serializeTask,
  serializeSubmission,
  serializeNotification,
};
