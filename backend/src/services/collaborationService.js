const taskData = require("../data/taskData");
const userData = require("../data/userData");
const NotificationService = require("./notificationService");
const realtimeHub = require("./realtimeHub");

const toArray = (value) => (Array.isArray(value) ? value : []);

const createId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getActorLabel = (user) => {
  const firstName = user?.profile?.firstName || "";
  const lastName = user?.profile?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user?.email || "Unknown user";
};

const ensureTaskAccess = (task, user) => {
  if (!task) {
    const error = new Error("Task not found");
    error.statusCode = 404;
    throw error;
  }

  if (user.role === "admin") return;

  const isClientOwner = task.client_id === user.id;
  const isAssignedFreelancer = task.freelancer_id === user.id;
  if (!isClientOwner && !isAssignedFreelancer) {
    const error = new Error("Not authorized to access this task");
    error.statusCode = 403;
    throw error;
  }
};

const getParticipants = async (task) => {
  const ids = [task.client_id, task.freelancer_id].filter(Boolean);
  const uniqueIds = [...new Set(ids)];

  const participants = await Promise.all(
    uniqueIds.map(async (id) => {
      const user = await userData.findUserById(id);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        displayName: getActorLabel(user),
        role: user.role,
      };
    }),
  );

  return participants.filter(Boolean);
};

const findMentionedUsers = (body, participants) => {
  const text = String(body || "");
  const matches = [...text.matchAll(/@([a-zA-Z0-9._-]{2,})/g)];
  if (matches.length === 0) return [];

  const tokens = matches.map((match) => match[1].toLowerCase());
  const mentioned = participants.filter((participant) => {
    const emailLocal = String(participant.email || "")
      .split("@")[0]
      .toLowerCase();
    const compactName = String(participant.displayName || "")
      .replace(/\s+/g, "")
      .toLowerCase();

    return tokens.some(
      (token) =>
        token === emailLocal ||
        token === compactName ||
        emailLocal.startsWith(token) ||
        compactName.startsWith(token),
    );
  });

  return mentioned;
};

const buildAttachmentMeta = (files, req) => {
  const host = `${req.protocol}://${req.get("host")}`;
  return toArray(files).map((file) => ({
    id: createId("att"),
    originalName: file.originalname,
    filename: file.filename,
    size: file.size,
    mimeType: file.mimetype,
    url: `${host}/uploads/comments/${file.filename}`,
    uploadedAt: new Date().toISOString(),
  }));
};

const getCollaborationState = (task) => {
  const workflow = task.workflow || {};
  const collaboration = workflow.collaboration || {};
  const comments = toArray(collaboration.comments);
  const activity = toArray(collaboration.activity);
  const metrics = task.metrics || {};
  const subtasks = toArray(metrics.subtasks);

  return {
    workflow,
    collaboration,
    comments,
    activity,
    metrics,
    subtasks,
  };
};

const computeMilestoneProgress = (subtasks) => {
  const items = toArray(subtasks);
  if (items.length === 0) {
    return 0;
  }

  const totalWeight = items.reduce(
    (sum, item) => sum + Number(item.weight || 0),
    0,
  );

  // If no weights are set, each subtask contributes equally.
  if (totalWeight <= 0) {
    const completed = items.filter((item) => item.completed).length;
    return Math.round((completed / items.length) * 100);
  }

  const completedWeight = items.reduce((sum, item) => {
    if (!item.completed) return sum;
    return sum + Number(item.weight || 0);
  }, 0);

  return Math.round((completedWeight / totalWeight) * 100);
};

const appendActivity = (activity, entry) => {
  const nextActivity = [...activity, entry];
  return nextActivity
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-200);
};

const emitTaskRealtime = (task, event, payload) => {
  const users = [task.client_id, task.freelancer_id].filter(Boolean);
  realtimeHub.publish({
    users,
    event,
    payload: {
      taskId: task.id,
      ...payload,
      ts: new Date().toISOString(),
    },
  });
};

const addTaskComment = async ({ task, actor, body, files = [], req }) => {
  const { workflow, collaboration, comments, activity } = getCollaborationState(task);
  const participants = await getParticipants(task);
  const mentionedUsers = findMentionedUsers(body, participants).filter(
    (participant) => participant.id !== actor.id,
  );

  const attachments = buildAttachmentMeta(files, req);
  const comment = {
    id: createId("cmt"),
    taskId: task.id,
    authorId: actor.id,
    authorName: getActorLabel(actor),
    body: String(body || "").trim(),
    mentions: mentionedUsers.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      email: participant.email,
    })),
    attachments,
    createdAt: new Date().toISOString(),
  };

  const activityEntry = {
    id: createId("act"),
    type: "comment_added",
    actorId: actor.id,
    actorName: getActorLabel(actor),
    message: `${getActorLabel(actor)} added a comment`,
    metadata: {
      commentId: comment.id,
      mentions: comment.mentions.map((item) => item.id),
      attachments: attachments.length,
    },
    createdAt: new Date().toISOString(),
  };

  const nextWorkflow = {
    ...workflow,
    collaboration: {
      ...collaboration,
      comments: [...comments, comment].slice(-400),
      activity: appendActivity(activity, activityEntry),
    },
  };

  await taskData.updateTask(task.id, { workflow: nextWorkflow });

  if (mentionedUsers.length > 0) {
    await Promise.all(
      mentionedUsers.map(async (participant) =>
        NotificationService.create({
          recipient_id: participant.id,
          type: "task_submitted",
          content: {
            title: "Mentioned in a task comment",
            message: `${getActorLabel(actor)} mentioned you in "${task.task_details?.title || "Task"}".`,
            commentId: comment.id,
          },
          related_task_id: task.id,
          priority: "medium",
        }),
      ),
    );
  }

  emitTaskRealtime(task, "task.comment.created", {
    comment,
    mentions: comment.mentions,
  });

  return {
    comment,
    mentions: comment.mentions,
  };
};

const listTaskComments = async (task) => {
  const { comments } = getCollaborationState(task);
  return comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const listTaskActivity = async (task) => {
  const { activity } = getCollaborationState(task);
  return activity.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
};

const addSubtask = async ({ task, actor, payload }) => {
  const { workflow, collaboration, activity, metrics, subtasks } =
    getCollaborationState(task);

  const dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) {
    const error = new Error("Invalid subtask due date");
    error.statusCode = 400;
    throw error;
  }

  const subtask = {
    id: createId("milestone"),
    title: String(payload.title || "").trim(),
    description: String(payload.description || "").trim(),
    dueDate: dueDate ? dueDate.toISOString() : null,
    weight: Number(payload.weight || 0),
    completed: false,
    completedAt: null,
    completedBy: null,
    order:
      payload.order !== undefined
        ? Number(payload.order || 0)
        : subtasks.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!subtask.title) {
    const error = new Error("Subtask title is required");
    error.statusCode = 400;
    throw error;
  }

  const nextSubtasks = [...subtasks, subtask];
  const milestoneProgress = computeMilestoneProgress(nextSubtasks);

  const nextMetrics = {
    ...metrics,
    subtasks: nextSubtasks,
    milestoneProgress,
  };

  const activityEntry = {
    id: createId("act"),
    type: "subtask_created",
    actorId: actor.id,
    actorName: getActorLabel(actor),
    message: `${getActorLabel(actor)} added milestone "${subtask.title}"`,
    metadata: { subtaskId: subtask.id },
    createdAt: new Date().toISOString(),
  };

  const nextWorkflow = {
    ...workflow,
    collaboration: {
      ...collaboration,
      activity: appendActivity(activity, activityEntry),
    },
  };

  await taskData.updateTask(task.id, {
    metrics: nextMetrics,
    workflow: nextWorkflow,
  });

  emitTaskRealtime(task, "task.subtask.created", {
    subtask,
    milestoneProgress,
  });

  return { subtask, milestoneProgress };
};

const updateSubtask = async ({ task, actor, subtaskId, payload }) => {
  const { workflow, collaboration, activity, metrics, subtasks } =
    getCollaborationState(task);

  const index = subtasks.findIndex((item) => item.id === subtaskId);
  if (index === -1) {
    const error = new Error("Subtask not found");
    error.statusCode = 404;
    throw error;
  }

  const current = subtasks[index];
  const next = { ...current };

  if (payload.title !== undefined) {
    const title = String(payload.title || "").trim();
    if (!title) {
      const error = new Error("Subtask title cannot be empty");
      error.statusCode = 400;
      throw error;
    }
    next.title = title;
  }

  if (payload.description !== undefined) {
    next.description = String(payload.description || "").trim();
  }

  if (payload.dueDate !== undefined) {
    if (!payload.dueDate) {
      next.dueDate = null;
    } else {
      const dueDate = new Date(payload.dueDate);
      if (Number.isNaN(dueDate.getTime())) {
        const error = new Error("Invalid subtask due date");
        error.statusCode = 400;
        throw error;
      }
      next.dueDate = dueDate.toISOString();
    }
  }

  if (payload.weight !== undefined) {
    next.weight = Number(payload.weight || 0);
  }

  if (payload.order !== undefined) {
    next.order = Number(payload.order || 0);
  }

  if (payload.completed !== undefined) {
    const completed = Boolean(payload.completed);
    next.completed = completed;
    next.completedAt = completed ? new Date().toISOString() : null;
    next.completedBy = completed ? actor.id : null;
  }

  next.updatedAt = new Date().toISOString();

  const nextSubtasks = [...subtasks];
  nextSubtasks[index] = next;

  const milestoneProgress = computeMilestoneProgress(nextSubtasks);
  const nextMetrics = {
    ...metrics,
    subtasks: nextSubtasks,
    milestoneProgress,
  };

  const activityEntry = {
    id: createId("act"),
    type: "subtask_updated",
    actorId: actor.id,
    actorName: getActorLabel(actor),
    message: `${getActorLabel(actor)} updated milestone "${next.title}"`,
    metadata: {
      subtaskId: next.id,
      completed: next.completed,
    },
    createdAt: new Date().toISOString(),
  };

  const nextWorkflow = {
    ...workflow,
    collaboration: {
      ...collaboration,
      activity: appendActivity(activity, activityEntry),
    },
  };

  await taskData.updateTask(task.id, {
    metrics: nextMetrics,
    workflow: nextWorkflow,
  });

  emitTaskRealtime(task, "task.subtask.updated", {
    subtask: next,
    milestoneProgress,
  });

  return { subtask: next, milestoneProgress };
};

const deleteSubtask = async ({ task, actor, subtaskId }) => {
  const { workflow, collaboration, activity, metrics, subtasks } =
    getCollaborationState(task);

  const current = subtasks.find((item) => item.id === subtaskId);
  if (!current) {
    const error = new Error("Subtask not found");
    error.statusCode = 404;
    throw error;
  }

  const nextSubtasks = subtasks.filter((item) => item.id !== subtaskId);
  const milestoneProgress = computeMilestoneProgress(nextSubtasks);
  const nextMetrics = {
    ...metrics,
    subtasks: nextSubtasks,
    milestoneProgress,
  };

  const activityEntry = {
    id: createId("act"),
    type: "subtask_deleted",
    actorId: actor.id,
    actorName: getActorLabel(actor),
    message: `${getActorLabel(actor)} removed milestone "${current.title}"`,
    metadata: { subtaskId: current.id },
    createdAt: new Date().toISOString(),
  };

  const nextWorkflow = {
    ...workflow,
    collaboration: {
      ...collaboration,
      activity: appendActivity(activity, activityEntry),
    },
  };

  await taskData.updateTask(task.id, {
    metrics: nextMetrics,
    workflow: nextWorkflow,
  });

  emitTaskRealtime(task, "task.subtask.deleted", {
    subtaskId,
    milestoneProgress,
  });

  return { subtaskId, milestoneProgress };
};

module.exports = {
  ensureTaskAccess,
  getParticipants,
  listTaskComments,
  listTaskActivity,
  addTaskComment,
  addSubtask,
  updateSubtask,
  deleteSubtask,
  computeMilestoneProgress,
};
