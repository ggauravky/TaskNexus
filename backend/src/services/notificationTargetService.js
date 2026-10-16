const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";

const INTERNAL_PATH_PATTERNS = Object.freeze([
  new RegExp(`^/tasks/${UUID}(?:\\?tab=(?:overview|work|delivery|discussion|activity))?$`, "i"),
  /^\/teams$/,
  new RegExp(`^/teams/${SLUG}$`, "i"),
  new RegExp(`^/teams/${SLUG}/settings(?:#openings)?$`, "i"),
  new RegExp(`^/teams/${SLUG}/projects/${SLUG}$`, "i"),
  new RegExp(`^/showcase/${SLUG}/${SLUG}$`, "i"),
  /^\/projects$/,
  /^\/collaboration$/,
  /^\/applications$/,
  /^\/organization-invitations$/,
  new RegExp(`^/organizations/${SLUG}/workspace(?:\\?tab=applicants)?$`, "i"),
  /^\/hackathons$/,
  /^\/notifications$/,
]);

const TASK_DELIVERY_TYPES = new Set([
  "task_submitted",
  "qa_feedback",
  "client_approval",
  "revision_requested",
  "submission_updated",
  "submission_approved",
]);
const TASK_WORK_TYPES = new Set(["task_progress"]);
const TASK_OVERVIEW_TYPES = new Set([
  "task_assigned",
  "payment_released",
  "deadline_reminder",
  "task_cancelled",
  "dispute_raised",
  "task_started",
  "task_unaccepted",
  "task_approved",
  "task_rejected",
  "new_review",
]);
const TASK_TYPES = new Set([
  ...TASK_DELIVERY_TYPES,
  ...TASK_WORK_TYPES,
  ...TASK_OVERVIEW_TYPES,
]);

const TEAM_TYPES = new Set([
  "team_invitation",
  "team_invitation_accepted",
  "team_join_request",
  "team_join_request_accepted",
  "team_join_request_rejected",
  "team_member_removed",
  "team_role_changed",
  "team_ownership_transferred",
  "team_opening_interest",
]);
const PROJECT_TYPES = new Set([
  "project_added",
  "project_removed",
  "project_role_changed",
  "project_task_assigned",
  "project_task_completed",
  "project_milestone_completed",
  "project_showcase_published",
]);
const COLLABORATION_TYPES = new Set([
  "collaboration_request_received",
  "collaboration_request_accepted",
  "collaboration_request_declined",
]);
const HACKATHON_TYPES = new Set([
  "hackathon_registration_confirmed",
  "hackathon_team_registered",
  "hackathon_submission_ready",
  "hackathon_submission_submitted",
]);
const ORGANIZATION_TYPES = new Set([
  "organization_invitation_accepted",
  "organization_role_changed",
  "organization_ownership_transferred",
]);
const APPLICATION_TYPES = new Set([
  "native_application_received",
  "native_application_submitted",
  "application_stage_changed",
  "application_withdrawn",
]);

const isUuid = (value) => new RegExp(`^${UUID}$`, "i").test(String(value || ""));

const normalizeInternalNotificationPath = (value) => {
  if (typeof value !== "string" || value !== value.trim() || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  if ([...value].some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code <= 31 || code === 127;
  })) return null;
  return INTERNAL_PATH_PATTERNS.some((pattern) => pattern.test(value)) ? value : null;
};

const trustedActionPath = (notification) => normalizeInternalNotificationPath(
  notification?.content?.actionUrl,
);

const resolveTaskTarget = (notification) => {
  if (!isUuid(notification.related_task_id)) return "/notifications";
  const base = `/tasks/${notification.related_task_id}`;
  if (notification.type === "task_submitted" && isUuid(notification.content?.commentId)) {
    return `${base}?tab=discussion`;
  }
  if (TASK_DELIVERY_TYPES.has(notification.type)) return `${base}?tab=delivery`;
  if (TASK_WORK_TYPES.has(notification.type)) return `${base}?tab=work`;
  return base;
};

const resolveNotificationTarget = (notification = {}) => {
  const { type } = notification;
  if (TASK_TYPES.has(type)) return resolveTaskTarget(notification);

  const actionPath = trustedActionPath(notification);

  if (TEAM_TYPES.has(type)) {
    return actionPath?.startsWith("/teams") ? actionPath : "/teams";
  }
  if (PROJECT_TYPES.has(type)) {
    return actionPath && (
      actionPath === "/projects"
      || actionPath.startsWith("/teams/")
      || actionPath.startsWith("/showcase/")
    ) ? actionPath : "/projects";
  }
  if (COLLABORATION_TYPES.has(type)) return "/collaboration";
  if (HACKATHON_TYPES.has(type)) return "/hackathons";
  if (type === "organization_invitation") return "/organization-invitations";
  if (ORGANIZATION_TYPES.has(type)) {
    return actionPath?.startsWith("/organizations/") ? actionPath : "/notifications";
  }
  if (APPLICATION_TYPES.has(type)) {
    return actionPath && (
      actionPath === "/applications"
      || actionPath.startsWith("/organizations/")
    ) ? actionPath : "/notifications";
  }
  return "/notifications";
};

module.exports = {
  normalizeInternalNotificationPath,
  resolveNotificationTarget,
};

