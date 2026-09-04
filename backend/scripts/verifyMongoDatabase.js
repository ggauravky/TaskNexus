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
  process.stdout.write(`MongoDB verification passed for ${databaseName()} (${Object.keys(counts).length} collections).\n`);
};

run().catch((error) => {
  process.stderr.write(`MongoDB verification failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
