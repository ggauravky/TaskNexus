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
export const TASK_TRANSITIONS = Object.freeze(domain.taskTransitions);
export const CONTRACT_VALUES = Object.freeze(domain);
