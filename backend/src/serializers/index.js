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
  };
};

module.exports = {
  serializeUser,
  serializeTask,
  serializeSubmission,
  serializeNotification,
};
