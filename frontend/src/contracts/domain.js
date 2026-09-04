import domain from "../../../shared/contracts/domain.json";

const toEnum = (values) =>
  Object.freeze(
    Object.fromEntries(
      values.map((value) => [value.toUpperCase().replace(/-/g, "_").replace(/[^A-Z0-9_]/g, "_"), value]),
    ),
  );

export const USER_ROLES = toEnum(domain.userRoles);
export const USER_STATUS = toEnum(domain.userStatuses);
export const TASK_STATUS = toEnum(domain.taskStatuses);
export const TASK_TYPES = toEnum(domain.taskTypes);
export const TASK_PRIORITY = toEnum(domain.taskPriorities);
export const NOTIFICATION_TYPES = toEnum(domain.notificationTypes);
export const TEAM_VISIBILITY = toEnum(domain.teamVisibilities);
export const TEAM_JOIN_POLICY = toEnum(domain.teamJoinPolicies);
export const TEAM_STATUS = toEnum(domain.teamStatuses);
export const TEAM_ROLE = toEnum(domain.teamRoles);
export const TEAM_INVITATION_STATUS = toEnum(domain.teamInvitationStatuses);
export const TEAM_JOIN_REQUEST_STATUS = toEnum(domain.teamJoinRequestStatuses);
export const TEAM_ACTIVITY_TYPES = toEnum(domain.teamActivityTypes);
export const TASK_TRANSITIONS = Object.freeze(domain.taskTransitions);
export const CONTRACT_VALUES = Object.freeze(domain);
