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
export const PROFILE_INTEREST = toEnum(domain.profileInterests);
export const COLLABORATION_ROLE = toEnum(domain.collaborationRoles);
export const TEAM_VISIBILITY = toEnum(domain.teamVisibilities);
export const TEAM_JOIN_POLICY = toEnum(domain.teamJoinPolicies);
export const TEAM_STATUS = toEnum(domain.teamStatuses);
export const TEAM_ROLE = toEnum(domain.teamRoles);
export const TEAM_INVITATION_STATUS = toEnum(domain.teamInvitationStatuses);
export const TEAM_JOIN_REQUEST_STATUS = toEnum(domain.teamJoinRequestStatuses);
export const TEAM_ACTIVITY_TYPES = toEnum(domain.teamActivityTypes);
export const TEAM_OPENING_STATUS = toEnum(domain.teamOpeningStatuses);
export const COLLABORATION_REQUEST_STATUS = toEnum(domain.collaborationRequestStatuses);
export const HACKATHON_STATUS = toEnum(domain.hackathonStatuses);
export const HACKATHON_MODE = toEnum(domain.hackathonModes);
export const HACKATHON_VISIBILITY = toEnum(domain.hackathonVisibilities);
export const HACKATHON_PARTICIPATION_STATUS = toEnum(domain.hackathonParticipationStatuses);
export const HACKATHON_TEAM_STATUS = toEnum(domain.hackathonTeamStatuses);
export const HACKATHON_SUBMISSION_STATUS = toEnum(domain.hackathonSubmissionStatuses);
export const HACKATHON_REQUIREMENT_TYPE = toEnum(domain.hackathonRequirementTypes);
export const HACKATHON_ACTIVITY_TYPES = toEnum(domain.hackathonActivityTypes);
export const ORGANIZATION_TYPE = toEnum(domain.organizationTypes);
export const ORGANIZATION_STATUS = toEnum(domain.organizationStatuses);
export const ORGANIZATION_VERIFICATION = toEnum(domain.organizationVerificationStatuses);
export const OPPORTUNITY_TYPE = toEnum(domain.opportunityTypes);
export const OPPORTUNITY_STATUS = toEnum(domain.opportunityStatuses);
export const WORK_MODE = toEnum(domain.workModes);
export const EMPLOYMENT_TYPE = toEnum(domain.employmentTypes);
export const ELIGIBILITY_RESULT = toEnum(domain.eligibilityResults);
export const ELIGIBILITY_CHECK_RESULT = toEnum(domain.eligibilityCheckResults);
export const APPLICATION_STATUS = toEnum(domain.applicationStatuses);
export const COMPENSATION_PERIOD = toEnum(domain.compensationPeriods);
export const OPPORTUNITY_SOURCE_TYPE = toEnum(domain.opportunitySourceTypes);
export const PROJECT_STATUS = toEnum(domain.projectStatuses);
export const PROJECT_VISIBILITY = toEnum(domain.projectVisibilities);
export const PROJECT_PARTICIPANT_ROLE = toEnum(domain.projectParticipantRoles);
export const PROJECT_TASK_STATUS = toEnum(domain.projectTaskStatuses);
export const PROJECT_MILESTONE_STATUS = toEnum(domain.projectMilestoneStatuses);
export const PROJECT_ACTIVITY_TYPES = toEnum(domain.projectActivityTypes);
export const PROJECT_TRANSITIONS = Object.freeze(domain.projectTransitions);
export const PROJECT_TASK_TRANSITIONS = Object.freeze(domain.projectTaskTransitions);
export const TASK_TRANSITIONS = Object.freeze(domain.taskTransitions);
export const CONTRACT_VALUES = Object.freeze(domain);
