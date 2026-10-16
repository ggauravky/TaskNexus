const isTaskParticipant = (task, user) => {
  if (!task || !user) return false;
  if (user.role === "admin") return true;
  if (user.role === "client") return task.client_id === user.id;
  if (user.role === "freelancer") return task.freelancer_id === user.id;
  return false;
};

export const resolveCollaborationPermissions = ({ task, user, authoritative }) => {
  if (authoritative) {
    return {
      canCollaborate: Boolean(authoritative.can_collaborate),
      canManageSubtasks: Boolean(authoritative.can_manage_subtasks),
    };
  }

  const participant = isTaskParticipant(task, user);
  return {
    canCollaborate: participant,
    canManageSubtasks: participant,
  };
};

export const isWorkspaceActionAvailable = (workspace, action, permission) => (
  Boolean(workspace?.permissions?.[permission])
  && Array.isArray(workspace?.available_actions)
  && workspace.available_actions.includes(action)
);

export const deliveryRefreshKey = (workspace) => {
  const submission = workspace?.current_submission;
  return [
    submission?.id || "none",
    submission?.updated_at || submission?.submitted_at || "none",
    submission?.review_status || "none",
    workspace?.task?.status || "none",
  ].join(":");
};

export const shouldClearWorkspaceForStatus = (status) => status === 403 || status === 404;
