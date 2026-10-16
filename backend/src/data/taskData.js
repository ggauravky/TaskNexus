const { Task } = require("../models");
const { buildFilter, escapeRegex, runMongo, toApp, toApps, trustedOperators } = require("./mongoDataUtils");
const { raw: domain } = require("../contracts/domain");

const searchMarketplaceTasks = ({ search, viewer }) => runMongo(async () => {
  const participantFilter = viewer.role === "client"
    ? { client_id: viewer.id }
    : viewer.role === "freelancer"
      ? { freelancer_id: viewer.id }
      : viewer.role === "admin"
        ? { status: trustedOperators({ $in: domain.taskStatuses }) }
        : null;
  if (!participantFilter) return [];
  const query = {
    ...participantFilter,
    "task_details.title": trustedOperators({ $regex: escapeRegex(search), $options: "i" }),
  };
  const rows = await Task.find(query)
    .select("_id task_details.title task_details.description status updated_at")
    .sort({ updated_at: -1, _id: 1 })
    .limit(5)
    .lean();
  return toApps(rows);
}, "Unable to search tasks");

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
    Task.find(query).sort({ [safeSort]: sortOrder === "asc" ? 1 : -1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
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

module.exports = { createTask, findTaskById, findTasks, listTasks, searchMarketplaceTasks, updateTask, updateTaskIfStatus, acceptTaskAtomically };
