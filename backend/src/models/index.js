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
const httpsUrl = (value) => value == null || /^https:\/\/[^\s]+$/i.test(value);

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
  onboarding_completed: { type: Boolean, default: false },
}, { collection: "user_profiles" });
profile.schema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: "string" } } },
);
profile.schema.index({ username: 1, visibility: 1 });

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
  created_at: { type: Date, default: Date.now },
}, { collection: "notifications", timestamps: false });
notification.schema.index({ recipient_id: 1, status: 1, created_at: -1 });
notification.schema.index({ related_task_id: 1 });

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
};
