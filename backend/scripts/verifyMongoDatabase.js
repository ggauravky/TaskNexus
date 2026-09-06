require("../src/config/loadEnv");
const { connectDatabase, databaseName, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const relationships = [
  [models.UserProfile, "_id", models.User, "profile owner"],
  [models.UserSkill, "user_id", models.User, "skill owner"],
  [models.UserSkill, "skill_id", models.Skill, "skill reference"],
  [models.UserEducation, "user_id", models.User, "education owner"],
  [models.Task, "client_id", models.User, "task client"],
  [models.Task, "freelancer_id", models.User, "task freelancer"],
  [models.Task, "assigned_by_id", models.User, "task assigner"],
  [models.Submission, "task_id", models.Task, "submission task"],
  [models.Submission, "freelancer_id", models.User, "submission freelancer"],
  [models.Payment, "task_id", models.Task, "payment task"],
  [models.Payment, "client_id", models.User, "payment client"],
  [models.Payment, "freelancer_id", models.User, "payment freelancer"],
  [models.Review, "task_id", models.Task, "review task"],
  [models.Review, "reviewer_id", models.User, "review author"],
  [models.Review, "reviewee_id", models.User, "review subject"],
  [models.Notification, "recipient_id", models.User, "notification recipient"],
  [models.Notification, "actor_id", models.User, "notification actor"],
  [models.Notification, "related_task_id", models.Task, "notification task"],
  [models.TaskComment, "task_id", models.Task, "comment task"],
  [models.TaskComment, "author_id", models.User, "comment author"],
  [models.TaskMilestone, "task_id", models.Task, "milestone task"],
  [models.TaskMilestone, "completed_by", models.User, "milestone completer"],
  [models.TaskActivity, "task_id", models.Task, "activity task"],
  [models.TaskActivity, "actor_id", models.User, "activity actor"],
  [models.AuditLog, "user_id", models.User, "audit actor"],
  [models.Team, "created_by", models.User, "team creator"],
  [models.Team, "owner_id", models.User, "team owner"],
  [models.TeamMembership, "team_id", models.Team, "membership team"],
  [models.TeamMembership, "user_id", models.User, "membership user"],
  [models.TeamInvitation, "team_id", models.Team, "invitation team"],
  [models.TeamInvitation, "invited_user_id", models.User, "invited user"],
  [models.TeamInvitation, "invited_by", models.User, "invitation actor"],
  [models.TeamJoinRequest, "team_id", models.Team, "join request team"],
  [models.TeamJoinRequest, "user_id", models.User, "join requester"],
  [models.TeamJoinRequest, "reviewed_by", models.User, "join request reviewer"],
  [models.TeamActivity, "team_id", models.Team, "team activity team"],
  [models.TeamActivity, "actor_id", models.User, "team activity actor"],
  [models.TeamActivity, "target_user_id", models.User, "team activity target"],
  [models.Project, "team_id", models.Team, "project team"],
  [models.Project, "created_by", models.User, "project creator"],
  [models.ProjectParticipant, "project_id", models.Project, "project participant project"],
  [models.ProjectParticipant, "team_id", models.Team, "project participant team"],
  [models.ProjectParticipant, "user_id", models.User, "project participant user"],
  [models.ProjectTask, "project_id", models.Project, "project task project"],
  [models.ProjectTask, "team_id", models.Team, "project task team"],
  [models.ProjectTask, "created_by", models.User, "project task creator"],
  [models.ProjectTask, "milestone_id", models.ProjectMilestone, "project task milestone"],
  [models.ProjectMilestone, "project_id", models.Project, "project milestone project"],
  [models.ProjectMilestone, "team_id", models.Team, "project milestone team"],
  [models.ProjectMilestone, "created_by", models.User, "project milestone creator"],
  [models.ProjectActivity, "project_id", models.Project, "project activity project"],
  [models.ProjectActivity, "team_id", models.Team, "project activity team"],
  [models.ProjectActivity, "actor_id", models.User, "project activity actor"],
  [models.ProjectActivity, "target_user_id", models.User, "project activity target"],
  [models.ContributionEvidence, "project_id", models.Project, "contribution project"],
  [models.ContributionEvidence, "team_id", models.Team, "contribution team"],
  [models.ContributionEvidence, "user_id", models.User, "contribution subject"],
  [models.ContributionEvidence, "created_by", models.User, "contribution creator"],
  [models.ProjectRepository, "project_id", models.Project, "repository project"],
  [models.ProjectRepository, "team_id", models.Team, "repository team"],
  [models.ProjectRepository, "added_by", models.User, "repository actor"],
  [models.ProjectShowcase, "project_id", models.Project, "showcase project"],
  [models.ProjectShowcase, "team_id", models.Team, "showcase team"],
  [models.ProjectShowcase, "created_by", models.User, "showcase creator"],
  [models.ProjectShowcase, "updated_by", models.User, "showcase updater"],
  [models.TeamOpening, "team_id", models.Team, "opening team"],
  [models.TeamOpening, "created_by", models.User, "opening creator"],
  [models.TeamOpening, "closed_by", models.User, "opening closer"],
  [models.CollaborationRequest, "sender_id", models.User, "collaboration sender"],
  [models.CollaborationRequest, "recipient_id", models.User, "collaboration recipient"],
  [models.CollaborationRequest, "team_id", models.Team, "collaboration team"],
  [models.CollaborationRequest, "team_opening_id", models.TeamOpening, "collaboration opening"],
  [models.CollaborationRequest, "project_id", models.Project, "collaboration project"],
  [models.UserBlock, "blocker_id", models.User, "block actor"],
  [models.UserBlock, "blocked_user_id", models.User, "blocked user"],
];

const verifyDeclaredIndexes = async (Model) => {
  const actual = await Model.collection.indexes();
  const signatures = new Set(actual.map((index) => JSON.stringify(index.key)));
  for (const [keys] of Model.schema.indexes()) {
    if (!signatures.has(JSON.stringify(keys))) throw new Error(`${Model.modelName} is missing index ${JSON.stringify(keys)}`);
  }
};

const countOrphans = async (Model, field, Parent) => {
  const [result] = await Model.aggregate([
    { $match: { [field]: { $ne: null } } },
    { $lookup: { from: Parent.collection.name, localField: field, foreignField: "_id", as: "parent" } },
    { $match: { parent: { $size: 0 } } },
    { $count: "count" },
  ]);
  return result?.count || 0;
};

const run = async () => {
  await connectDatabase();
  const counts = {};
  for (const [name, Model] of Object.entries(models)) {
    await verifyDeclaredIndexes(Model);
    counts[Model.collection.name] = await Model.estimatedDocumentCount();
    process.stdout.write(`${name}: ${counts[Model.collection.name]} documents; declared indexes present.\n`);
  }
  for (const [Model, field, Parent, label] of relationships) {
    const count = await countOrphans(Model, field, Parent);
    if (count) throw new Error(`${label}: ${count} orphaned documents`);
  }
  const plan = await models.Notification.find({ recipient_id: "__verification__", status: "unread" })
    .sort({ created_at: -1 }).explain("queryPlanner");
  const planText = JSON.stringify(plan.queryPlanner?.winningPlan || {});
  if (!planText.includes("IXSCAN")) throw new Error("Notification query did not use an index");
  const teamPlan = await models.Team.find({ visibility: "public", status: "active" }).sort({ created_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(teamPlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Team discovery query did not use an index");
  const projectPlan = await models.Project.find({ team_id: "__verification__", status: "active" }).sort({ updated_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(projectPlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Team project query did not use an index");
  const taskPlan = await models.ProjectTask.find({ project_id: "__verification__", status: "todo" }).sort({ updated_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(taskPlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Project task query did not use an index");
  const activityPlan = await models.ProjectActivity.find({ project_id: "__verification__" }).sort({ created_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(activityPlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Project activity query did not use an index");
  const evidencePlan = await models.ContributionEvidence.find({ user_id: "__verification__", status: "active" }).sort({ occurred_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(evidencePlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Contribution history query did not use an index");
  const projectEvidencePlan = await models.ContributionEvidence.find({ project_id: "__verification__", status: "active" }).sort({ occurred_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(projectEvidencePlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Project evidence query did not use an index");
  const showcasePlan = await models.ProjectShowcase.find({ team_id: "__verification__", status: "published" }).sort({ published_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(showcasePlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Public showcase query did not use an index");
  const peoplePlan = await models.UserProfile.find({ discoverable: true, visibility: "public", availability: "open" }).sort({ updated_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(peoplePlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("People discovery query did not use an index");
  const openingPlan = await models.TeamOpening.find({ status: "open", role: "backend_developer" }).sort({ created_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(openingPlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Team opening discovery query did not use an index");
  const inboxPlan = await models.CollaborationRequest.find({ recipient_id: "__verification__", status: "pending" }).sort({ created_at: -1 }).explain("queryPlanner");
  if (!JSON.stringify(inboxPlan.queryPlanner?.winningPlan || {}).includes("IXSCAN")) throw new Error("Collaboration inbox query did not use an index");
  process.stdout.write(`MongoDB verification passed for ${databaseName()} (${Object.keys(counts).length} collections).\n`);
};

run().catch((error) => {
  process.stderr.write(`MongoDB verification failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
