const { TaskComment, TaskActivity, TaskMilestone } = require("../models");
const { runMongo, toApp } = require("./mongoDataUtils");

const mapComment = (value) => { const row = toApp(value); return row && ({ id: row.id, taskId: row.task_id, authorId: row.author_id, authorName: row.author_name, body: row.body, mentions: row.mentions || [], attachments: row.attachments || [], createdAt: row.created_at }); };
const mapActivity = (value) => { const row = toApp(value); return row && ({ id: row.id, type: row.activity_type, actorId: row.actor_id, actorName: row.actor_name, message: row.message, metadata: row.metadata || {}, createdAt: row.created_at }); };
const mapMilestone = (value) => { const row = toApp(value); return row && ({ id: row.id, title: row.title, description: row.description, dueDate: row.due_at, weight: Number(row.weight || 0), completed: row.completed, completedAt: row.completed_at, completedBy: row.completed_by, order: row.position, createdAt: row.created_at, updatedAt: row.updated_at }); };

const listComments = (taskId) => runMongo(async () => (await TaskComment.find({ task_id: taskId }).sort({ created_at: 1 }).lean()).map(mapComment), "Unable to list comments");
const createComment = (item) => runMongo(async () => mapComment(await TaskComment.create({ _id: item.id, task_id: item.taskId, author_id: item.authorId, author_name: item.authorName, body: item.body, mentions: item.mentions, attachments: item.attachments, created_at: item.createdAt })), "Unable to create comment");
const listActivity = (taskId) => runMongo(async () => (await TaskActivity.find({ task_id: taskId }).sort({ created_at: 1 }).lean()).map(mapActivity), "Unable to list activity");
const createActivity = (taskId, item) => runMongo(async () => mapActivity(await TaskActivity.create({ _id: item.id, task_id: taskId, activity_type: item.type, actor_id: item.actorId, actor_name: item.actorName, message: item.message, metadata: item.metadata, created_at: item.createdAt })), "Unable to create activity");
const listMilestones = (taskId) => runMongo(async () => (await TaskMilestone.find({ task_id: taskId }).sort({ position: 1, created_at: 1 }).lean()).map(mapMilestone), "Unable to list milestones");
const createMilestone = (taskId, item) => runMongo(async () => mapMilestone(await TaskMilestone.create({ _id: item.id, task_id: taskId, title: item.title, description: item.description, due_at: item.dueDate, weight: item.weight, completed: item.completed, position: item.order, created_at: item.createdAt, updated_at: item.updatedAt })), "Unable to create milestone");
const updateMilestone = (taskId, item) => runMongo(async () => mapMilestone(await TaskMilestone.findOneAndUpdate({ _id: item.id, task_id: taskId }, { $set: { title: item.title, description: item.description, due_at: item.dueDate, weight: item.weight, completed: item.completed, completed_at: item.completedAt, completed_by: item.completedBy, position: item.order, updated_at: item.updatedAt } }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update milestone");
const deleteMilestone = (taskId, id) => runMongo(async () => mapMilestone(await TaskMilestone.findOneAndDelete({ _id: id, task_id: taskId }).lean()), "Unable to delete milestone");

module.exports = { listComments, createComment, listActivity, createActivity, listMilestones, createMilestone, updateMilestone, deleteMilestone };
