const supabase = require("../config/supabase");
const logger = require("../utils/logger");

const unavailable = (error) => {
  const code = error?.code;
  return code === "PGRST205" || code === "42P01" || error?.cause?.code === "ENOTFOUND";
};

const run = async (factory, operation) => {
  try {
    const { data, error } = await factory();
    if (error) throw error;
    return data;
  } catch (error) {
    if (process.env.NODE_ENV !== "production" && unavailable(error)) {
      logger.warn(`Normalized collaboration storage unavailable during ${operation}; using legacy JSONB fallback.`);
      return null;
    }
    throw error;
  }
};

const mapComment = (row) => ({
  id: row.id,
  taskId: row.task_id,
  authorId: row.author_id,
  authorName: row.author_name,
  body: row.body,
  mentions: row.mentions || [],
  attachments: row.attachments || [],
  createdAt: row.created_at,
});

const mapActivity = (row) => ({
  id: row.id,
  type: row.activity_type,
  actorId: row.actor_id,
  actorName: row.actor_name,
  message: row.message,
  metadata: row.metadata || {},
  createdAt: row.created_at,
});

const mapMilestone = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  dueDate: row.due_at,
  weight: Number(row.weight || 0),
  completed: row.completed,
  completedAt: row.completed_at,
  completedBy: row.completed_by,
  order: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listComments = async (taskId) => {
  const rows = await run(
    () => supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at"),
    "listing comments",
  );
  return rows === null ? null : rows.map(mapComment);
};

const createComment = async (comment) => {
  const rows = await run(
    () => supabase.from("task_comments").insert({
      id: comment.id,
      task_id: comment.taskId,
      author_id: comment.authorId,
      author_name: comment.authorName,
      body: comment.body,
      mentions: comment.mentions,
      attachments: comment.attachments,
      created_at: comment.createdAt,
    }).select().single(),
    "creating comment",
  );
  return rows === null ? null : mapComment(rows);
};

const listActivity = async (taskId) => {
  const rows = await run(
    () => supabase.from("task_activity").select("*").eq("task_id", taskId).order("created_at"),
    "listing activity",
  );
  return rows === null ? null : rows.map(mapActivity);
};

const createActivity = async (taskId, activity) => {
  const row = await run(
    () => supabase.from("task_activity").insert({
      id: activity.id,
      task_id: taskId,
      activity_type: activity.type,
      actor_id: activity.actorId,
      actor_name: activity.actorName,
      message: activity.message,
      metadata: activity.metadata,
      created_at: activity.createdAt,
    }).select().single(),
    "creating activity",
  );
  return row === null ? null : mapActivity(row);
};

const listMilestones = async (taskId) => {
  const rows = await run(
    () => supabase.from("task_milestones").select("*").eq("task_id", taskId).order("position").order("created_at"),
    "listing milestones",
  );
  return rows === null ? null : rows.map(mapMilestone);
};

const createMilestone = async (taskId, milestone) => {
  const row = await run(
    () => supabase.from("task_milestones").insert({
      id: milestone.id,
      task_id: taskId,
      title: milestone.title,
      description: milestone.description,
      due_at: milestone.dueDate,
      weight: milestone.weight,
      completed: milestone.completed,
      position: milestone.order,
      created_at: milestone.createdAt,
      updated_at: milestone.updatedAt,
    }).select().single(),
    "creating milestone",
  );
  return row === null ? null : mapMilestone(row);
};

const updateMilestone = async (taskId, milestone) => {
  const row = await run(
    () => supabase.from("task_milestones").update({
      title: milestone.title,
      description: milestone.description,
      due_at: milestone.dueDate,
      weight: milestone.weight,
      completed: milestone.completed,
      completed_at: milestone.completedAt,
      completed_by: milestone.completedBy,
      position: milestone.order,
      updated_at: milestone.updatedAt,
    }).eq("task_id", taskId).eq("id", milestone.id).select().maybeSingle(),
    "updating milestone",
  );
  return row === null ? null : mapMilestone(row);
};

const deleteMilestone = async (taskId, milestoneId) => {
  const row = await run(
    () => supabase.from("task_milestones").delete().eq("task_id", taskId).eq("id", milestoneId).select().maybeSingle(),
    "deleting milestone",
  );
  return row === null ? null : mapMilestone(row);
};

module.exports = {
  listComments,
  createComment,
  listActivity,
  createActivity,
  listMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
};
