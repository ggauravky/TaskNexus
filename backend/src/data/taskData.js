const { Task } = require("../models");
const { buildFilter, escapeRegex, runMongo, toApp, toApps, trustedOperators } = require("./mongoDataUtils");

const createTask = (taskData) => runMongo(async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const task_id = taskData.task_id || `TSK-${dateStr}-${Math.floor(10000 + Math.random() * 90000)}`;
  return toApp(await Task.create({ ...taskData, task_id }));
}, "Unable to create task");
const findTaskById = (id) => runMongo(async () => toApp(await Task.findById(id).lean()), "Unable to find task");
const findTasks = (filters) => runMongo(async () => toApps(await Task.find(buildFilter(filters)).lean()), "Unable to find tasks");

const listTasks = ({ filters = {}, page, limit, sortBy, sortOrder, search }) => runMongo(async () => {
  const query = buildFilter(filters);
  if (search) query["task_details.title"] = trustedOperators({ $regex: escapeRegex(search), $options: "i" });
  const safeSort = ["created_at", "updated_at", "priority", "status", "task_id"].includes(sortBy) ? sortBy : "created_at";
  const [items, total] = await Promise.all([
    Task.find(query).sort({ [safeSort]: sortOrder === "asc" ? 1 : -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Task.countDocuments(query),
  ]);
  return { items: toApps(items), total, page, limit };
}, "Unable to list tasks");

const updateTask = (id, updates) => runMongo(async () => toApp(await Task.findByIdAndUpdate(id, { $set: updates }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update task");
const updateTaskIfStatus = (id, expectedStatus, updates) => runMongo(async () => toApp(await Task.findOneAndUpdate({ _id: id, status: expectedStatus }, { $set: updates }, { returnDocument: "after", runValidators: true }).lean()), "Unable to transition task");
const acceptTaskAtomically = (id, freelancerId) => runMongo(async () => toApp(await Task.findOneAndUpdate(
  { _id: id, status: "under_review", freelancer_id: null },
  { $set: { freelancer_id: freelancerId, status: "assigned", "workflow.assignedAt": new Date().toISOString() } },
  { returnDocument: "after", runValidators: true },
).lean()), "Unable to accept task");

module.exports = { createTask, findTaskById, findTasks, listTasks, updateTask, updateTaskIfStatus, acceptTaskAtomically };
