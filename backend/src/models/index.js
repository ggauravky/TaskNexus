const mongoose = require("mongoose");
const domain = require("../contracts/domain").raw;
const { json, model, stringId } = require("./helpers");

const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{2,29}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_USERNAMES = new Set([
  "admin", "api", "app", "auth", "blog", "dashboard", "help", "login", "logout", "me",
  "profile", "register", "root", "security", "settings", "support", "system", "tasknexus",
  "tasks", "team", "teams", "u", "users",
]);
const RESERVED_TEAM_SLUGS = new Set([
  "admin", "api", "app", "auth", "create", "discover", "help", "invitations", "join",
  "me", "new", "profile", "requests", "settings", "support", "system", "tasknexus", "teams",
]);
const RESERVED_PROJECT_SLUGS = new Set([
  "activity", "admin", "api", "archive", "complete", "create", "members", "milestones",
  "new", "overview", "projects", "settings", "tasks",
]);
const RESERVED_HACKATHON_SLUGS = new Set([
  "admin", "api", "archive", "create", "discover", "hackathon", "hackathons", "me", "new", "settings", "submissions",
]);
const RESERVED_ORGANIZATION_SLUGS = new Set([
  "admin", "api", "applications", "archive", "create", "me", "new", "opportunities", "organization", "organizations", "settings", "verify",
]);
const RESERVED_OPPORTUNITY_SLUGS = new Set([
  "admin", "api", "applications", "archive", "close", "create", "me", "new", "opportunities", "publish", "saved", "settings",
]);
const httpsUrl = (value) => value == null || /^https:\/\/[^\s]+$/i.test(value);

const hackathonRequirement = new mongoose.Schema({
  type: { type: String, required: true, enum: domain.hackathonRequirementTypes },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  required: { type: Boolean, default: true },
}, { _id: false });

const hackathonChecklistItem = new mongoose.Schema({
  type: { type: String, required: true, enum: domain.hackathonRequirementTypes },
  label: { type: String, required: true, trim: true, maxlength: 120 },
  required: { type: Boolean, default: true },
  completed: { type: Boolean, default: false },
}, { _id: false });

const opportunityLocation = new mongoose.Schema({
  country: { type: String, trim: true, maxlength: 80, default: null },
  state: { type: String, trim: true, maxlength: 100, default: null },
  city: { type: String, trim: true, maxlength: 100, default: null },
  display: { type: String, trim: true, maxlength: 180, default: null },
}, { _id: false });

const opportunityCompensation = new mongoose.Schema({
  min_amount: { type: Number, min: 0, max: 1000000000, default: null },
  max_amount: { type: Number, min: 0, max: 1000000000, default: null },
  currency: { type: String, uppercase: true, trim: true, minlength: 3, maxlength: 3, default: null },
  period: { type: String, enum: domain.compensationPeriods, default: null },
}, { _id: false });

const opportunityEligibility = new mongoose.Schema({
  eligible_degrees: { type: [String], default: [], validate: (items) => items.length <= 12 && items.every((item) => item.length <= 120) },
  eligible_fields: { type: [String], default: [], validate: (items) => items.length <= 12 && items.every((item) => item.length <= 120) },
  graduation_year_min: { type: Number, min: 1900, max: 2100, default: null },
  graduation_year_max: { type: Number, min: 1900, max: 2100, default: null },
  experience_min_months: { type: Number, min: 0, max: 600, default: null },
  experience_max_months: { type: Number, min: 0, max: 600, default: null },
  minimum_cgpa: { type: Number, min: 0, max: 10, default: null },
  allowed_countries: { type: [String], default: [], validate: (items) => items.length <= 20 && items.every((item) => item.length <= 80) },
  work_authorization_notes: { type: String, trim: true, maxlength: 500, default: null },
  final_year_allowed: { type: Boolean, default: false },
  freshers_allowed: { type: Boolean, default: false },
  custom_notes: { type: String, trim: true, maxlength: 1000, default: null },
}, { _id: false });

const user = model("User", {
  _id: stringId(),
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 320, match: EMAIL_PATTERN },
  password: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: domain.userRoles },
  profile: { type: mongoose.Schema.Types.Mixed, required: true, default: () => ({}) },
  freelancer_profile: json,
  client_profile: json,
  notification_preferences: json,
  status: { type: String, enum: domain.userStatuses, default: "active" },
  refresh_token: { type: String, default: null, select: false },
  last_login: { type: Date, default: null },
  is_email_verified: { type: Boolean, default: false },
  password_reset_token: { type: String, default: null, select: false },
  password_reset_expires: { type: Date, default: null, select: false },
}, { collection: "users" });
user.schema.index({ email: 1 }, { unique: true });
user.schema.index({ role: 1 });
user.schema.index({ status: 1 });

const profile = model("UserProfile", {
  _id: { type: String, required: true },
  username: {
    type: String, lowercase: true, trim: true, match: USERNAME_PATTERN, default: null,
    validate: { validator: (value) => value == null || !RESERVED_USERNAMES.has(value), message: "Username is reserved" },
  },
  headline: { type: String, maxlength: 120, default: null },
  bio: { type: String, maxlength: 2000, default: null },
  avatar_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  location: { type: String, maxlength: 120, default: null },
  timezone: { type: String, maxlength: 80, default: null },
  availability: { type: String, enum: domain.profileAvailabilities, default: "unavailable" },
  collaboration_commitment: { type: String, enum: domain.collaborationCommitments, default: "exploring" },
  github_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  linkedin_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  portfolio_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  interests: { type: [String], default: [], validate: (items) => items.length <= 12 },
  preferred_roles: { type: [String], default: [], validate: (items) => items.length <= 8 },
  visibility: { type: String, enum: domain.profileVisibilities, default: "private" },
  discoverable: { type: Boolean, default: false },
  collaboration_revision: { type: Number, default: 0, min: 0, select: false },
  onboarding_completed: { type: Boolean, default: false },
}, { collection: "user_profiles" });
profile.schema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: "string" } } },
);
profile.schema.index({ username: 1, visibility: 1 });
profile.schema.index({ discoverable: 1, visibility: 1, availability: 1, updated_at: -1 });
profile.schema.index({ discoverable: 1, preferred_roles: 1, updated_at: -1 });
profile.schema.index({ discoverable: 1, interests: 1, updated_at: -1 });

const skill = model("Skill", {
  _id: stringId(),
  slug: { type: String, required: true, lowercase: true, trim: true, match: SLUG_PATTERN },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  normalized_name: { type: String, required: true, lowercase: true, trim: true, select: false },
  category: { type: String, required: true, enum: domain.skillCategories },
  aliases: { type: [String], default: [] },
  is_active: { type: Boolean, default: true },
}, { collection: "skills" });
skill.schema.index({ slug: 1 }, { unique: true });
skill.schema.index({ normalized_name: 1 }, { unique: true });
skill.schema.index({ category: 1, name: 1 });
skill.schema.index({ aliases: 1 });

const userSkill = model("UserSkill", {
  _id: { type: String, required: true },
  user_id: { type: String, required: true },
  skill_id: { type: String, required: true },
  proficiency: { type: String, enum: domain.skillProficiencies, default: "intermediate" },
  is_primary: { type: Boolean, default: false },
}, { collection: "user_skills" });
userSkill.schema.index({ user_id: 1, skill_id: 1 }, { unique: true });
userSkill.schema.index({ skill_id: 1 });
userSkill.schema.index({ user_id: 1, is_primary: 1 });

const education = model("UserEducation", {
  _id: stringId(),
  user_id: { type: String, required: true },
  institution: { type: String, required: true, maxlength: 160 },
  degree_course: { type: String, required: true, maxlength: 160 },
  field_of_study: { type: String, maxlength: 160, default: null },
  start_year: { type: Number, required: true, min: 1900, max: 2100 },
  end_year: { type: Number, min: 1900, max: 2100, default: null },
  currently_studying: { type: Boolean, default: false },
  description: { type: String, maxlength: 1000, default: null },
  position: { type: Number, min: 0, max: 1000, default: 0 },
}, { collection: "user_education" });
education.schema.path("end_year").validate(function validateYearOrder(value) {
  return value == null || (!this.currently_studying && value >= this.start_year);
}, "End year must follow start year and be empty while currently studying");
education.schema.index({ user_id: 1, position: 1, start_year: -1 });

const task = model("Task", {
  _id: stringId(),
  task_id: { type: String, required: true },
  client_id: { type: String, required: true },
  freelancer_id: { type: String, default: null },
  assigned_by_id: { type: String, default: null },
  task_details: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: domain.taskStatuses, default: "submitted" },
  workflow: json,
  metrics: json,
  priority: { type: String, enum: domain.taskPriorities, default: "medium" },
  tags: { type: [String], default: [] },
  admin_notes: { type: String, default: null },
  cancellation_reason: { type: String, default: null },
  dispute: json,
}, { collection: "tasks" });
task.schema.index({ task_id: 1 }, { unique: true });
task.schema.index({ client_id: 1, status: 1, updated_at: -1 });
task.schema.index({ freelancer_id: 1, status: 1, updated_at: -1 });
task.schema.index({ status: 1, updated_at: -1 });
task.schema.index({ "task_details.deadline": 1 });

const submission = model("Submission", {
  _id: stringId(),
  task_id: { type: String, required: true },
  freelancer_id: { type: String, required: true },
  submission_type: { type: String, required: true, enum: domain.submissionTypes },
  content: { type: mongoose.Schema.Types.Mixed, required: true },
  qa_review: json,
  client_review: json,
  version: { type: Number, min: 1, default: 1 },
  is_active: { type: Boolean, default: true },
  idempotency_key: { type: String, default: null },
}, { collection: "submissions" });
submission.schema.index({ task_id: 1, is_active: 1, version: -1 });
submission.schema.index({ freelancer_id: 1, idempotency_key: 1 }, { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } });

const payment = model("Payment", {
  _id: stringId(), payment_id: { type: String, required: true }, task_id: { type: String, required: true },
  client_id: { type: String, required: true }, freelancer_id: { type: String, required: true },
  amounts: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: domain.paymentStatuses, default: "pending" },
  escrow: json, transaction_details: json, refund: json,
}, { collection: "payments" });
payment.schema.index({ payment_id: 1 }, { unique: true });
payment.schema.index({ task_id: 1 }); payment.schema.index({ client_id: 1 }); payment.schema.index({ freelancer_id: 1 });

const review = model("Review", {
  _id: stringId(), task_id: { type: String, required: true }, reviewer_id: { type: String, required: true },
  reviewee_id: { type: String, required: true }, review_type: { type: String, required: true, enum: domain.reviewTypes },
  rating: { type: Number, required: true, min: 1, max: 5 }, feedback: { type: String, default: null },
  is_public: { type: Boolean, default: false },
}, { collection: "reviews" });
review.schema.index({ task_id: 1, reviewer_id: 1, review_type: 1 }, { unique: true });
review.schema.index({ reviewee_id: 1, created_at: -1 });

const notification = model("Notification", {
  _id: stringId(), recipient_id: { type: String, required: true }, actor_id: { type: String, default: null },
  type: { type: String, required: true, enum: domain.notificationTypes },
  content: { type: mongoose.Schema.Types.Mixed, required: true }, related_task_id: { type: String, default: null },
  entity_type: { type: String, default: null }, entity_id: { type: String, default: null },
  status: { type: String, enum: domain.notificationStatuses, default: "unread" },
  priority: { type: String, enum: domain.notificationPriorities, default: "medium" },
  read_at: { type: Date, default: null }, metadata: json,
  event_key: { type: String, default: null, select: false },
  created_at: { type: Date, default: Date.now },
}, { collection: "notifications", timestamps: false });
notification.schema.index({ recipient_id: 1, status: 1, created_at: -1 });
notification.schema.index({ related_task_id: 1 });
notification.schema.index(
  { recipient_id: 1, event_key: 1 },
  { unique: true, partialFilterExpression: { event_key: { $type: "string" } }, name: "one_project_notification_event" },
);

const team = model("Team", {
  _id: stringId(),
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 80 },
  slug: {
    type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 60, match: SLUG_PATTERN,
    validate: { validator: (value) => !RESERVED_TEAM_SLUGS.has(value), message: "Team slug is reserved" },
  },
  tagline: { type: String, trim: true, maxlength: 160, default: null },
  description: { type: String, trim: true, maxlength: 3000, default: null },
  avatar_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  cover_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  created_by: { type: String, required: true },
  owner_id: { type: String, required: true },
  visibility: { type: String, enum: domain.teamVisibilities, default: "public" },
  join_policy: { type: String, enum: domain.teamJoinPolicies, default: "request" },
  status: { type: String, enum: domain.teamStatuses, default: "active" },
  primary_interests: { type: [String], default: [], validate: (items) => items.length <= 12 },
  preferred_skills: { type: [String], default: [], validate: (items) => items.length <= 12 },
}, { collection: "teams" });
team.schema.index({ slug: 1 }, { unique: true });
team.schema.index({ owner_id: 1 });
team.schema.index({ visibility: 1, status: 1, created_at: -1 });
team.schema.index({ primary_interests: 1, visibility: 1, status: 1 });

const teamMembership = model("TeamMembership", {
  _id: stringId(), team_id: { type: String, required: true }, user_id: { type: String, required: true },
  role: { type: String, enum: domain.teamRoles, required: true },
  status: { type: String, enum: domain.teamMembershipStatuses, default: "active" },
  joined_at: { type: Date, default: Date.now }, ended_at: { type: Date, default: null },
}, { collection: "team_memberships" });
teamMembership.schema.index({ team_id: 1, user_id: 1 }, { unique: true });
teamMembership.schema.index({ team_id: 1, role: 1, status: 1 });
teamMembership.schema.index({ user_id: 1, status: 1, updated_at: -1 });
teamMembership.schema.index(
  { team_id: 1 },
  { unique: true, partialFilterExpression: { role: "owner", status: "active" }, name: "one_active_owner_per_team" },
);

const teamInvitation = model("TeamInvitation", {
  _id: stringId(), team_id: { type: String, required: true }, invited_user_id: { type: String, required: true },
  invited_by: { type: String, required: true }, status: { type: String, enum: domain.teamInvitationStatuses, default: "pending" },
  message: { type: String, trim: true, maxlength: 500, default: null }, expires_at: { type: Date, default: null },
  responded_at: { type: Date, default: null },
}, { collection: "team_invitations" });
teamInvitation.schema.index({ team_id: 1, invited_user_id: 1 });
teamInvitation.schema.index({ invited_user_id: 1, status: 1, created_at: -1 });
teamInvitation.schema.index({ team_id: 1, status: 1, created_at: -1 });
teamInvitation.schema.index(
  { team_id: 1, invited_user_id: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_team_invitation" },
);

const teamJoinRequest = model("TeamJoinRequest", {
  _id: stringId(), team_id: { type: String, required: true }, user_id: { type: String, required: true },
  message: { type: String, trim: true, maxlength: 500, default: null },
  status: { type: String, enum: domain.teamJoinRequestStatuses, default: "pending" },
  reviewed_by: { type: String, default: null }, reviewed_at: { type: Date, default: null },
}, { collection: "team_join_requests" });
teamJoinRequest.schema.index({ team_id: 1, user_id: 1 });
teamJoinRequest.schema.index({ team_id: 1, status: 1, created_at: -1 });
teamJoinRequest.schema.index({ user_id: 1, status: 1, created_at: -1 });
teamJoinRequest.schema.index(
  { team_id: 1, user_id: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_team_join_request" },
);

const teamActivity = model("TeamActivity", {
  _id: stringId(), team_id: { type: String, required: true }, actor_id: { type: String, required: true },
  type: { type: String, required: true, enum: domain.teamActivityTypes }, target_user_id: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }, created_at: { type: Date, default: Date.now },
}, { collection: "team_activity", timestamps: false });
teamActivity.schema.index({ team_id: 1, created_at: -1 });
teamActivity.schema.index({ actor_id: 1, created_at: -1 });

const teamOpening = model("TeamOpening", {
  _id: stringId(), team_id: { type: String, required: true },
  hackathon_id: { type: String, default: null }, hackathon_team_id: { type: String, default: null },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000, default: null },
  role: { type: String, required: true, enum: domain.collaborationRoles, maxlength: 60 },
  required_skill_ids: { type: [String], default: [], validate: (items) => items.length <= 8 },
  preferred_skill_ids: { type: [String], default: [], validate: (items) => items.length <= 8 },
  commitment: { type: String, enum: [...domain.collaborationCommitments, null], default: null },
  status: { type: String, enum: domain.teamOpeningStatuses, default: "open" },
  created_by: { type: String, required: true }, closed_by: { type: String, default: null },
  closed_at: { type: Date, default: null }, revision: { type: Number, min: 0, default: 0 },
}, { collection: "team_openings" });
teamOpening.schema.index({ team_id: 1, status: 1, created_at: -1 });
teamOpening.schema.index({ status: 1, role: 1, created_at: -1 });
teamOpening.schema.index({ status: 1, required_skill_ids: 1, created_at: -1 });
teamOpening.schema.index({ hackathon_id: 1, status: 1, created_at: -1 });

const collaborationRequest = model("CollaborationRequest", {
  _id: stringId(), sender_id: { type: String, required: true }, recipient_id: { type: String, required: true },
  team_id: { type: String, default: null }, team_opening_id: { type: String, default: null },
  project_id: { type: String, default: null }, context_key: { type: String, required: true, maxlength: 240, select: false },
  hackathon_id: { type: String, default: null },
  message: { type: String, trim: true, maxlength: 500, default: null },
  status: { type: String, enum: domain.collaborationRequestStatuses, default: "pending" },
  responded_at: { type: Date, default: null }, cancelled_at: { type: Date, default: null },
}, { collection: "collaboration_requests" });
collaborationRequest.schema.index({ recipient_id: 1, status: 1, created_at: -1 });
collaborationRequest.schema.index({ sender_id: 1, status: 1, created_at: -1 });
collaborationRequest.schema.index({ team_opening_id: 1, status: 1, created_at: -1 });
collaborationRequest.schema.index({ hackathon_id: 1, status: 1, created_at: -1 });
collaborationRequest.schema.index(
  { sender_id: 1, recipient_id: 1, context_key: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_collaboration_context" },
);

const userBlock = model("UserBlock", {
  _id: stringId(), blocker_id: { type: String, required: true }, blocked_user_id: { type: String, required: true },
}, { collection: "user_blocks" });
userBlock.schema.index({ blocker_id: 1, blocked_user_id: 1 }, { unique: true });
userBlock.schema.index({ blocked_user_id: 1, blocker_id: 1 });

const project = model("Project", {
  _id: stringId(),
  team_id: { type: String, required: true },
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
  slug: {
    type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 70, match: SLUG_PATTERN,
    validate: { validator: (value) => !RESERVED_PROJECT_SLUGS.has(value), message: "Project slug is reserved" },
  },
  tagline: { type: String, trim: true, maxlength: 180, default: null },
  description: { type: String, trim: true, maxlength: 5000, default: null },
  status: { type: String, enum: domain.projectStatuses, default: "planning" },
  visibility: { type: String, enum: domain.projectVisibilities, default: "team" },
  created_by: { type: String, required: true },
  start_date: { type: Date, default: null },
  target_date: { type: Date, default: null },
  completed_at: { type: Date, default: null },
  skill_ids: { type: [String], default: [], validate: (items) => items.length <= 12 },
  tags: { type: [String], default: [], validate: (items) => items.length <= 8 },
  repository_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  demo_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  completion_evidence_ids: { type: [String], default: [], validate: (items) => items.length <= 100 },
  completion_evidence_captured_at: { type: Date, default: null },
}, { collection: "projects" });
project.schema.index({ team_id: 1, slug: 1 }, { unique: true });
project.schema.index({ team_id: 1, status: 1, updated_at: -1 });
project.schema.index({ visibility: 1, status: 1, updated_at: -1 });
project.schema.index({ skill_ids: 1, status: 1 });

const projectParticipant = model("ProjectParticipant", {
  _id: stringId(), team_id: { type: String, required: true }, project_id: { type: String, required: true },
  user_id: { type: String, required: true }, role: { type: String, enum: domain.projectParticipantRoles, required: true },
  status: { type: String, enum: domain.projectParticipantStatuses, default: "active" },
  joined_at: { type: Date, default: Date.now }, ended_at: { type: Date, default: null },
  show_on_profile: { type: Boolean, default: false },
  profile_visibility_updated_at: { type: Date, default: null },
  assignment_epoch: { type: Number, min: 0, default: 0, select: false },
}, { collection: "project_participants" });
projectParticipant.schema.index({ project_id: 1, user_id: 1 }, { unique: true });
projectParticipant.schema.index({ user_id: 1, status: 1, updated_at: -1 });
projectParticipant.schema.index({ project_id: 1, role: 1, status: 1 });
projectParticipant.schema.index({ team_id: 1, user_id: 1, status: 1 });
projectParticipant.schema.index({ user_id: 1, show_on_profile: 1 });

const projectTask = model("ProjectTask", {
  _id: stringId(), team_id: { type: String, required: true }, project_id: { type: String, required: true },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 5000, default: null },
  status: { type: String, enum: domain.projectTaskStatuses, default: "todo" },
  priority: { type: String, enum: domain.taskPriorities, default: "medium" },
  created_by: { type: String, required: true },
  assignee_ids: { type: [String], default: [], validate: (items) => items.length <= 12 },
  due_date: { type: Date, default: null }, milestone_id: { type: String, default: null },
  completed_at: { type: Date, default: null }, revision: { type: Number, min: 0, default: 0 },
}, { collection: "project_tasks" });
projectTask.schema.index({ project_id: 1, status: 1, updated_at: -1 });
projectTask.schema.index({ project_id: 1, due_date: 1 });
projectTask.schema.index({ assignee_ids: 1, status: 1 });
projectTask.schema.index({ project_id: 1, milestone_id: 1 });

const projectMilestone = model("ProjectMilestone", {
  _id: stringId(), team_id: { type: String, required: true }, project_id: { type: String, required: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 140 },
  description: { type: String, trim: true, maxlength: 2000, default: null },
  status: { type: String, enum: domain.projectMilestoneStatuses, default: "planned" },
  target_date: { type: Date, default: null }, completed_at: { type: Date, default: null },
  created_by: { type: String, required: true },
}, { collection: "project_milestones" });
projectMilestone.schema.index({ project_id: 1, status: 1 });
projectMilestone.schema.index({ project_id: 1, target_date: 1 });

const projectActivity = model("ProjectActivity", {
  _id: stringId(), team_id: { type: String, required: true }, project_id: { type: String, required: true },
  actor_id: { type: String, required: true }, type: { type: String, enum: domain.projectActivityTypes, required: true },
  target_user_id: { type: String, default: null }, entity_id: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }, created_at: { type: Date, default: Date.now },
}, { collection: "project_activity", timestamps: false });
projectActivity.schema.index({ project_id: 1, created_at: -1 });
projectActivity.schema.index({ team_id: 1, created_at: -1 });
projectActivity.schema.index({ actor_id: 1, created_at: -1 });

const contributionEvidence = model("ContributionEvidence", {
  _id: stringId(), team_id: { type: String, required: true }, project_id: { type: String, required: true },
  user_id: { type: String, required: true }, created_by: { type: String, required: true },
  evidence_type: { type: String, enum: domain.contributionEvidenceTypes, required: true },
  verification_level: { type: String, enum: domain.contributionVerificationLevels, required: true },
  status: { type: String, enum: domain.contributionEvidenceStatuses, default: "active" },
  origin: { type: String, enum: domain.contributionEvidenceOrigins, required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  summary: { type: String, trim: true, maxlength: 1000, default: null },
  source_key: { type: String, required: true, maxlength: 500, select: false },
  source_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  task_id: { type: String, default: null }, repository_id: { type: String, default: null },
  provider: { type: String, enum: ["github", null], default: null },
  provider_ref: { type: String, maxlength: 160, default: null },
  occurred_at: { type: Date, required: true }, verified_at: { type: Date, default: null },
  revoked_at: { type: Date, default: null }, revoked_reason: { type: String, maxlength: 300, default: null },
  public_safe: { type: Boolean, default: false }, metadata: json,
}, { collection: "contribution_evidence" });
contributionEvidence.schema.index({ project_id: 1, source_key: 1 }, { unique: true, name: "one_evidence_source_per_project" });
contributionEvidence.schema.index({ user_id: 1, status: 1, occurred_at: -1 });
contributionEvidence.schema.index({ project_id: 1, status: 1, occurred_at: -1 });
contributionEvidence.schema.index({ project_id: 1, user_id: 1, status: 1, occurred_at: -1 });
contributionEvidence.schema.index({ repository_id: 1, provider_ref: 1 });

const projectRepository = model("ProjectRepository", {
  _id: stringId(), team_id: { type: String, required: true }, project_id: { type: String, required: true },
  provider: { type: String, enum: domain.repositoryProviders, default: "github" },
  owner: { type: String, required: true, trim: true, maxlength: 100 },
  repository: { type: String, required: true, trim: true, maxlength: 100 },
  owner_key: { type: String, required: true, lowercase: true, select: false },
  repository_key: { type: String, required: true, lowercase: true, select: false },
  canonical_url: { type: String, required: true, maxlength: 500, validate: httpsUrl },
  added_by: { type: String, required: true },
  verification_status: { type: String, enum: domain.repositoryVerificationStatuses, default: "pending" },
  verified_at: { type: Date, default: null }, last_checked_at: { type: Date, default: null },
  metadata: json,
}, { collection: "project_repositories" });
projectRepository.schema.index(
  { project_id: 1, provider: 1, owner_key: 1, repository_key: 1 },
  { unique: true, name: "one_link_per_project_repository" },
);
projectRepository.schema.index({ project_id: 1, created_at: 1 });

const projectShowcase = model("ProjectShowcase", {
  _id: stringId(), team_id: { type: String, required: true }, project_id: { type: String, required: true },
  status: { type: String, enum: domain.showcaseStatuses, default: "draft" },
  headline: { type: String, trim: true, maxlength: 180, default: null },
  summary: { type: String, trim: true, maxlength: 1000, default: null },
  problem: { type: String, trim: true, maxlength: 3000, default: null },
  solution: { type: String, trim: true, maxlength: 3000, default: null },
  outcome: { type: String, trim: true, maxlength: 3000, default: null },
  featured_evidence_ids: { type: [String], default: [], validate: (items) => items.length <= 12 },
  featured_skills: { type: [String], default: [], validate: (items) => items.length <= 12 },
  hero_image_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  created_by: { type: String, required: true }, updated_by: { type: String, required: true },
  published_at: { type: Date, default: null }, unpublished_at: { type: Date, default: null },
  revision: { type: Number, min: 0, default: 0 },
}, { collection: "project_showcases" });
projectShowcase.schema.index({ project_id: 1 }, { unique: true });
projectShowcase.schema.index({ team_id: 1, status: 1, published_at: -1 });

const hackathon = model("Hackathon", {
  _id: stringId(),
  name: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
  slug: {
    type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 80, match: SLUG_PATTERN,
    validate: { validator: (value) => !RESERVED_HACKATHON_SLUGS.has(value), message: "Hackathon slug is reserved" },
  },
  tagline: { type: String, trim: true, maxlength: 180, default: null },
  description: { type: String, trim: true, maxlength: 6000, default: null },
  organizer_name: { type: String, required: true, trim: true, maxlength: 160 },
  website_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  registration_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  logo_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  cover_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  mode: { type: String, required: true, enum: domain.hackathonModes },
  city: { type: String, trim: true, maxlength: 120, default: null },
  venue: { type: String, trim: true, maxlength: 200, default: null },
  registration_start: { type: Date, default: null },
  registration_deadline: { type: Date, default: null },
  event_start: { type: Date, required: true },
  event_end: { type: Date, required: true },
  submission_deadline: { type: Date, default: null },
  team_min_size: { type: Number, min: 1, max: 50, default: null },
  team_max_size: { type: Number, min: 1, max: 50, default: null },
  status: { type: String, required: true, enum: domain.hackathonStatuses, default: "upcoming" },
  visibility: { type: String, required: true, enum: domain.hackathonVisibilities, default: "public" },
  allowed_roles: { type: [String], default: [], validate: (items) => items.length <= 12 && items.every((item) => domain.collaborationRoles.includes(item)) },
  recommended_skill_ids: { type: [String], default: [], validate: (items) => items.length <= 16 },
  themes: { type: [String], default: [], validate: (items) => items.length <= 12 },
  submission_requirements: { type: [hackathonRequirement], default: [] },
  created_by: { type: String, required: true },
}, { collection: "hackathons" });
hackathon.schema.path("submission_requirements").validate((items) => items.length <= 12, "Too many submission requirements");
hackathon.schema.pre("validate", function validateHackathonDates() {
  if (this.event_start && this.event_end && this.event_end <= this.event_start) this.invalidate("event_end", "Event end must be after event start");
  if (this.registration_start && this.registration_deadline && this.registration_deadline <= this.registration_start) this.invalidate("registration_deadline", "Registration deadline must follow registration start");
  if (this.registration_deadline && this.event_end && this.registration_deadline > this.event_end) this.invalidate("registration_deadline", "Registration deadline cannot follow event end");
  if (this.submission_deadline && this.event_start && this.submission_deadline < this.event_start) this.invalidate("submission_deadline", "Submission deadline cannot precede event start");
  if (this.team_min_size && this.team_max_size && this.team_min_size > this.team_max_size) this.invalidate("team_max_size", "Maximum team size must be at least the minimum");
  if (this.mode === "online") { this.city = null; this.venue = null; }
});
hackathon.schema.index({ slug: 1 }, { unique: true });
hackathon.schema.index({ visibility: 1, status: 1, registration_deadline: 1 });
hackathon.schema.index({ visibility: 1, status: 1, event_start: 1 });
hackathon.schema.index({ mode: 1, status: 1, event_start: 1 });
hackathon.schema.index({ themes: 1, status: 1, event_start: 1 });
hackathon.schema.index({ recommended_skill_ids: 1, status: 1, event_start: 1 });

const hackathonParticipant = model("HackathonParticipant", {
  _id: stringId(), hackathon_id: { type: String, required: true }, user_id: { type: String, required: true },
  status: { type: String, enum: domain.hackathonParticipationStatuses, default: "interested" },
  looking_for_team: { type: Boolean, default: false },
  preferred_roles: { type: [String], default: [], validate: (items) => items.length <= 8 && items.every((item) => domain.collaborationRoles.includes(item)) },
  preferred_skill_ids: { type: [String], default: [], validate: (items) => items.length <= 12 },
  commitment: { type: String, enum: domain.collaborationCommitments, default: "exploring" },
  message: { type: String, trim: true, maxlength: 500, default: null },
  visible_on_hackathon: { type: Boolean, default: false }, joined_at: { type: Date, default: Date.now },
}, { collection: "hackathon_participants" });
hackathonParticipant.schema.index({ hackathon_id: 1, user_id: 1 }, { unique: true });
hackathonParticipant.schema.index({ hackathon_id: 1, looking_for_team: 1, status: 1, updated_at: -1 });
hackathonParticipant.schema.index({ user_id: 1, status: 1, updated_at: -1 });

const hackathonTeam = model("HackathonTeam", {
  _id: stringId(), hackathon_id: { type: String, required: true }, team_id: { type: String, required: true },
  registered_by: { type: String, required: true }, status: { type: String, enum: domain.hackathonTeamStatuses, default: "registered" },
  project_id: { type: String, default: null }, eligibility_warning: { type: Boolean, default: false },
  eligibility_message: { type: String, maxlength: 240, default: null }, withdrawn_at: { type: Date, default: null },
  revision: { type: Number, min: 0, default: 0 },
}, { collection: "hackathon_teams" });
hackathonTeam.schema.index({ hackathon_id: 1, team_id: 1 }, { unique: true });
hackathonTeam.schema.index({ hackathon_id: 1, status: 1, created_at: -1 });
hackathonTeam.schema.index({ team_id: 1, status: 1, updated_at: -1 });

const hackathonSubmission = model("HackathonSubmission", {
  _id: stringId(), hackathon_id: { type: String, required: true }, hackathon_team_id: { type: String, required: true },
  team_id: { type: String, required: true }, project_id: { type: String, required: true },
  status: { type: String, enum: domain.hackathonSubmissionStatuses, default: "draft" },
  repository_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  demo_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  presentation_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  video_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  submission_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  checklist: { type: [hackathonChecklistItem], default: [] },
  submitted_by: { type: String, default: null }, submitted_at: { type: Date, default: null },
  revision: { type: Number, min: 0, default: 0 },
}, { collection: "hackathon_submissions" });
hackathonSubmission.schema.path("checklist").validate((items) => items.length <= 12, "Too many checklist items");
hackathonSubmission.schema.index({ hackathon_team_id: 1 }, { unique: true });
hackathonSubmission.schema.index({ hackathon_id: 1, status: 1, updated_at: -1 });

const hackathonActivity = model("HackathonActivity", {
  _id: stringId(), hackathon_id: { type: String, required: true }, actor_id: { type: String, required: true },
  type: { type: String, required: true, enum: domain.hackathonActivityTypes },
  hackathon_team_id: { type: String, default: null }, team_id: { type: String, default: null }, project_id: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }, created_at: { type: Date, default: Date.now },
}, { collection: "hackathon_activity", timestamps: false });
hackathonActivity.schema.index({ hackathon_id: 1, created_at: -1 });
hackathonActivity.schema.index({ hackathon_team_id: 1, created_at: -1 });

const organization = model("Organization", {
  _id: stringId(),
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  slug: {
    type: String, required: true, lowercase: true, trim: true, minlength: 2, maxlength: 80, match: SLUG_PATTERN,
    validate: { validator: (value) => !RESERVED_ORGANIZATION_SLUGS.has(value), message: "Organization slug is reserved" },
  },
  organization_type: { type: String, required: true, enum: domain.organizationTypes },
  tagline: { type: String, trim: true, maxlength: 180, default: null },
  description: { type: String, trim: true, maxlength: 6000, default: null },
  logo_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  website_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  industry: { type: String, trim: true, maxlength: 120, default: null },
  company_size: { type: String, trim: true, maxlength: 80, default: null },
  headquarters: { type: opportunityLocation, default: null },
  locations: { type: [opportunityLocation], default: [], validate: (items) => items.length <= 10 },
  verification_status: { type: String, enum: domain.organizationVerificationStatuses, default: "unverified" },
  verified_at: { type: Date, default: null }, verified_by: { type: String, default: null },
  status: { type: String, enum: domain.organizationStatuses, default: "active" },
  created_by: { type: String, required: true },
  revision: { type: Number, min: 0, default: 0 },
}, { collection: "organizations" });
organization.schema.index({ slug: 1 }, { unique: true });
organization.schema.index({ status: 1, name: 1 });
organization.schema.index({ verification_status: 1, status: 1, name: 1 });

const opportunity = model("Opportunity", {
  _id: stringId(), organization_id: { type: String, required: true },
  type: { type: String, required: true, enum: domain.opportunityTypes },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 180 },
  slug: {
    type: String, required: true, lowercase: true, trim: true, minlength: 3, maxlength: 100, match: SLUG_PATTERN,
    validate: { validator: (value) => !RESERVED_OPPORTUNITY_SLUGS.has(value), message: "Opportunity slug is reserved" },
  },
  summary: { type: String, trim: true, maxlength: 320, default: null },
  description: { type: String, trim: true, maxlength: 8000, default: null },
  responsibilities: { type: [String], default: [], validate: (items) => items.length <= 20 && items.every((item) => item.length <= 500) },
  requirements: { type: [String], default: [], validate: (items) => items.length <= 20 && items.every((item) => item.length <= 500) },
  work_mode: { type: String, required: true, enum: domain.workModes },
  locations: { type: [opportunityLocation], default: [], validate: (items) => items.length <= 10 },
  employment_type: { type: String, enum: domain.employmentTypes, default: "full_time" },
  duration: { type: String, trim: true, maxlength: 120, default: null },
  compensation: { type: opportunityCompensation, default: null },
  application_url: { type: String, required: true, maxlength: 500, validate: httpsUrl },
  application_deadline: { type: Date, default: null }, start_date: { type: Date, default: null },
  required_skill_ids: { type: [String], default: [], validate: (items) => items.length <= 16 },
  preferred_skill_ids: { type: [String], default: [], validate: (items) => items.length <= 16 },
  eligibility: { type: opportunityEligibility, default: () => ({}) },
  status: { type: String, required: true, enum: domain.opportunityStatuses, default: "draft" },
  source_type: { type: String, required: true, enum: domain.opportunitySourceTypes },
  source_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  source_published_at: { type: Date, default: null }, last_verified_at: { type: Date, default: null },
  published_at: { type: Date, default: null }, expires_at: { type: Date, default: null },
  created_by: { type: String, required: true }, revision: { type: Number, min: 0, default: 0 },
  candidate_write_revision: { type: Number, min: 0, default: 0, select: false },
}, { collection: "opportunities" });
opportunity.schema.pre("validate", function validateOpportunity() {
  if (this.work_mode !== "remote" && !this.locations.length) this.invalidate("locations", "Hybrid and onsite Opportunities require a location");
  if (this.compensation) {
    const { min_amount: min, max_amount: max, currency, period } = this.compensation;
    if (min != null && max != null && max < min) this.invalidate("compensation.max_amount", "Maximum compensation must be at least the minimum");
    if ((min != null || max != null) && (!currency || !period)) this.invalidate("compensation", "Currency and period are required with compensation amounts");
  }
  const rules = this.eligibility || {};
  if (rules.graduation_year_min && rules.graduation_year_max && rules.graduation_year_max < rules.graduation_year_min) this.invalidate("eligibility.graduation_year_max", "Maximum graduation year must follow the minimum");
  if (rules.experience_min_months != null && rules.experience_max_months != null && rules.experience_max_months < rules.experience_min_months) this.invalidate("eligibility.experience_max_months", "Maximum experience must be at least the minimum");
  if (this.required_skill_ids.some((id) => this.preferred_skill_ids.includes(id))) this.invalidate("preferred_skill_ids", "A skill cannot be both required and preferred");
  if (this.status === "published" && !this.published_at) this.invalidate("published_at", "Published Opportunities require a publication timestamp");
});
opportunity.schema.index({ slug: 1 }, { unique: true });
opportunity.schema.index({ status: 1, published_at: -1 });
opportunity.schema.index({ type: 1, status: 1, published_at: -1 });
opportunity.schema.index({ organization_id: 1, status: 1, published_at: -1 });
opportunity.schema.index({ work_mode: 1, status: 1, published_at: -1 });
opportunity.schema.index({ required_skill_ids: 1, status: 1, published_at: -1 });
opportunity.schema.index({ application_deadline: 1, status: 1 });

const opportunityCandidateState = model("OpportunityCandidateState", {
  _id: stringId(), opportunity_id: { type: String, required: true }, user_id: { type: String, required: true },
  saved: { type: Boolean, default: false },
  application_status: { type: String, enum: [...domain.applicationStatuses, null], default: null },
  applied_at: { type: Date, default: null }, notes: { type: String, trim: true, maxlength: 2000, default: null },
  external_application_url: { type: String, maxlength: 500, validate: httpsUrl, default: null },
  source: { type: String, enum: ["user_tracked"], default: "user_tracked" },
  revision: { type: Number, min: 0, default: 0 },
}, { collection: "opportunity_candidate_states" });
opportunityCandidateState.schema.index({ user_id: 1, opportunity_id: 1 }, { unique: true });
opportunityCandidateState.schema.index({ user_id: 1, application_status: 1, updated_at: -1 });
opportunityCandidateState.schema.index({ user_id: 1, saved: 1, updated_at: -1 });

const comment = model("TaskComment", {
  _id: { type: String, required: true }, task_id: { type: String, required: true }, author_id: { type: String, default: null },
  author_name: { type: String, required: true }, body: { type: String, default: "" },
  mentions: { type: [mongoose.Schema.Types.Mixed], default: [] }, attachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  created_at: { type: Date, default: Date.now },
}, { collection: "task_comments", timestamps: false });
comment.schema.index({ task_id: 1, created_at: 1 }); comment.schema.index({ author_id: 1 });

const milestone = model("TaskMilestone", {
  _id: { type: String, required: true }, task_id: { type: String, required: true }, title: { type: String, required: true },
  description: { type: String, default: "" }, due_at: { type: Date, default: null }, weight: { type: Number, min: 0, max: 100, default: 0 },
  completed: { type: Boolean, default: false }, completed_at: { type: Date, default: null }, completed_by: { type: String, default: null },
  position: { type: Number, min: 0, default: 0 },
}, { collection: "task_milestones" });
milestone.schema.index({ task_id: 1, position: 1, created_at: 1 });

const activity = model("TaskActivity", {
  _id: { type: String, required: true }, task_id: { type: String, required: true }, activity_type: { type: String, required: true },
  actor_id: { type: String, default: null }, actor_name: { type: String, required: true }, message: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }, created_at: { type: Date, default: Date.now },
}, { collection: "task_activity", timestamps: false });
activity.schema.index({ task_id: 1, created_at: 1 }); activity.schema.index({ actor_id: 1 });

const newsletter = model("NewsletterSubscription", {
  _id: stringId(), email: { type: String, required: true, lowercase: true, trim: true }, source: { type: String, default: "blog" },
  status: { type: String, default: "subscribed" }, brevo_contact_id: { type: Number, default: null }, subscribed_at: { type: Date, default: Date.now },
}, { collection: "newsletter_subscriptions" });
newsletter.schema.index({ email: 1 }, { unique: true }); newsletter.schema.index({ status: 1 });

const booking = model("ServiceBooking", {
  _id: stringId(), booking_id: { type: String, required: true }, session_id: { type: String, required: true }, full_name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true }, phone: { type: String, default: null }, service_slug: { type: String, required: true },
  service_snapshot: { type: mongoose.Schema.Types.Mixed, required: true }, preferred_date: { type: Date, required: true }, preferred_time: { type: String, required: true },
  timezone: { type: String, required: true }, notes: { type: String, default: null }, status: { type: String, default: "requested" },
  email_status: { type: String, default: "pending" }, brevo_message_ids: json,
}, { collection: "service_bookings" });
booking.schema.index({ booking_id: 1 }, { unique: true }); booking.schema.index({ session_id: 1 }, { unique: true }); booking.schema.index({ email: 1 });

const support = model("SupportContribution", {
  _id: stringId(), full_name: { type: String, required: true }, email: { type: String, required: true, lowercase: true, trim: true },
  amount: { type: Number, required: true, min: 0 }, currency: { type: String, required: true }, message: { type: String, default: null },
  email_status: { type: String, default: "pending" }, brevo_message_ids: json,
}, { collection: "support_jar_contributions" });
support.schema.index({ email: 1 }); support.schema.index({ created_at: -1 });

const audit = model("AuditLog", {
  _id: stringId(), user_id: { type: String, default: null }, action: { type: String, required: true }, resource: { type: String, required: true },
  resource_id: { type: String, default: null }, changes: json, ip_address: { type: String, default: null }, user_agent: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
}, { collection: "audit_logs", timestamps: false });
audit.schema.index({ user_id: 1, timestamp: -1 }); audit.schema.index({ resource: 1, resource_id: 1 }); audit.schema.index({ timestamp: -1 });

module.exports = {
  User: user.register(), UserProfile: profile.register(), Skill: skill.register(), UserSkill: userSkill.register(), UserEducation: education.register(),
  Task: task.register(), Submission: submission.register(), Payment: payment.register(), Review: review.register(), Notification: notification.register(),
  TaskComment: comment.register(), TaskMilestone: milestone.register(), TaskActivity: activity.register(), NewsletterSubscription: newsletter.register(),
  ServiceBooking: booking.register(), SupportContribution: support.register(), AuditLog: audit.register(),
  Team: team.register(), TeamMembership: teamMembership.register(), TeamInvitation: teamInvitation.register(),
  TeamJoinRequest: teamJoinRequest.register(), TeamActivity: teamActivity.register(),
  TeamOpening: teamOpening.register(), CollaborationRequest: collaborationRequest.register(), UserBlock: userBlock.register(),
  Project: project.register(), ProjectParticipant: projectParticipant.register(), ProjectTask: projectTask.register(),
  ProjectMilestone: projectMilestone.register(), ProjectActivity: projectActivity.register(),
  ContributionEvidence: contributionEvidence.register(), ProjectRepository: projectRepository.register(),
  ProjectShowcase: projectShowcase.register(),
  Hackathon: hackathon.register(), HackathonParticipant: hackathonParticipant.register(), HackathonTeam: hackathonTeam.register(),
  HackathonSubmission: hackathonSubmission.register(), HackathonActivity: hackathonActivity.register(),
  Organization: organization.register(), Opportunity: opportunity.register(), OpportunityCandidateState: opportunityCandidateState.register(),
};
