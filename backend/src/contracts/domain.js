const domain = require("../../../shared/contracts/domain.json");

const toEnum = (values) =>
  Object.freeze(
    Object.fromEntries(
      values.map((value) => [value.toUpperCase().replace(/-/g, "_").replace(/[^A-Z0-9_]/g, "_"), value]),
    ),
  );

const contracts = Object.freeze({
  raw: domain,
  USER_ROLES: toEnum(domain.userRoles),
  PUBLIC_REGISTRATION_ROLES: Object.freeze([...domain.publicRegistrationRoles]),
  USER_STATUS: toEnum(domain.userStatuses),
  TASK_STATUS: toEnum(domain.taskStatuses),
  TASK_TYPES: toEnum(domain.taskTypes),
  TASK_PRIORITY: toEnum(domain.taskPriorities),
  SUBMISSION_TYPE: toEnum(domain.submissionTypes),
  QA_STATUS: toEnum(domain.qaStatuses),
  CLIENT_REVIEW_STATUS: toEnum(domain.clientReviewStatuses),
  PAYMENT_STATUS: toEnum(domain.paymentStatuses),
  REVIEW_TYPE: toEnum(domain.reviewTypes),
  NOTIFICATION_TYPES: toEnum(domain.notificationTypes),
  NOTIFICATION_STATUS: toEnum(domain.notificationStatuses),
  NOTIFICATION_PRIORITY: toEnum(domain.notificationPriorities),
  PROFILE_VISIBILITY: toEnum(domain.profileVisibilities),
  PROFILE_AVAILABILITY: toEnum(domain.profileAvailabilities),
  COLLABORATION_COMMITMENT: toEnum(domain.collaborationCommitments),
  SKILL_PROFICIENCY: toEnum(domain.skillProficiencies),
  SKILL_CATEGORY: toEnum(domain.skillCategories),
  TEAM_VISIBILITY: toEnum(domain.teamVisibilities),
  TEAM_JOIN_POLICY: toEnum(domain.teamJoinPolicies),
  TEAM_STATUS: toEnum(domain.teamStatuses),
  TEAM_ROLE: toEnum(domain.teamRoles),
  TEAM_MEMBERSHIP_STATUS: toEnum(domain.teamMembershipStatuses),
  TEAM_INVITATION_STATUS: toEnum(domain.teamInvitationStatuses),
  TEAM_JOIN_REQUEST_STATUS: toEnum(domain.teamJoinRequestStatuses),
  TEAM_ACTIVITY_TYPES: toEnum(domain.teamActivityTypes),
  TEAM_NOTIFICATION_TYPES: Object.freeze(Object.fromEntries(
    domain.notificationTypes.filter((value) => value.startsWith("team_")).map((value) => [value.toUpperCase(), value]),
  )),
  TASK_STATE_TRANSITIONS: Object.freeze(domain.taskTransitions),
});

const isContractValue = (group, value) =>
  Array.isArray(domain[group]) && domain[group].includes(value);

module.exports = {
  ...contracts,
  isContractValue,
};
