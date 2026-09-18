const mongoose = require("mongoose");
const {
  Project, ProjectActivity, ProjectMilestone, ProjectParticipant, ProjectTask, Skill, Team,
} = require("../models");
const { toApp, toApps } = require("../models/helpers");
const { escapeRegex } = require("./mongoDataUtils");

const trustedIn = (values) => mongoose.trusted({ $in: values });

const findById = async (id, session = null) => toApp(await Project.findById(id).session(session).lean());
const findBySlugs = async (teamSlug, projectSlug) => {
  const team = toApp(await Team.findOne({ slug: String(teamSlug).toLowerCase(), status: "active" }).lean());
  if (!team) return { team: null, project: null };
  const project = toApp(await Project.findOne({ team_id: team.id, slug: String(projectSlug).toLowerCase() }).lean());
  return { team, project };
};

const listForTeam = async (teamId, filters) => {
  const filter = { team_id: teamId, status: mongoose.trusted({ $ne: "archived" }) };
  if (filters.publicOnly) filter.visibility = "public";
  if (filters.status) filter.status = filters.status;
  if (filters.skillId) filter.skill_ids = filters.skillId;
  if (filters.search) {
    const pattern = new RegExp(escapeRegex(filters.search), "i");
    filter.$or = mongoose.trusted([{ name: pattern }, { tagline: pattern }, { slug: pattern }]);
  }
  if (filters.participantId) {
    const rows = await ProjectParticipant.find({ user_id: filters.participantId, status: "active" }).select("project_id").lean();
    filter._id = trustedIn(rows.map((item) => item.project_id));
  }
  const [items, total] = await Promise.all([
    Project.find(filter).sort({ updated_at: -1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    Project.countDocuments(filter),
  ]);
  return { items: toApps(items), total, page: filters.page, limit: filters.limit };
};

const listMine = async (userId, filters) => {
  const participantFilter = { user_id: userId, status: "active" };
  if (filters.role) participantFilter.role = filters.role;
  const projectFilter = { "project.status": { $ne: "archived" } };
  if (filters.status) projectFilter["project.status"] = filters.status;
  if (filters.search) {
    const pattern = new RegExp(escapeRegex(filters.search), "i");
    projectFilter.$or = [
      { "project.name": pattern },
      { "project.tagline": pattern },
    ];
  }
  const [result = { items: [], total: [] }] = await ProjectParticipant.aggregate([
    { $match: participantFilter },
    { $lookup: { from: "projects", localField: "project_id", foreignField: "_id", as: "project" } },
    { $unwind: "$project" },
    { $match: projectFilter },
    { $sort: { "project.updated_at": -1, "project._id": 1 } },
    { $facet: {
      items: [
        { $skip: (filters.page - 1) * filters.limit },
        { $limit: filters.limit },
        { $replaceWith: "$project" },
      ],
      total: [{ $count: "value" }],
    } },
  ]);
  return {
    items: toApps(result.items),
    total: result.total[0]?.value || 0,
    page: filters.page,
    limit: filters.limit,
  };
};

const projectCounts = async (projectIds) => {
  if (!projectIds.length) return { participants: new Map(), tasks: new Map(), milestones: new Map() };
  const [participantRows, taskRows, milestoneRows] = await Promise.all([
    ProjectParticipant.aggregate([
      { $match: { project_id: { $in: projectIds }, status: "active" } },
      { $group: { _id: "$project_id", count: { $sum: 1 } } },
    ]),
    ProjectTask.aggregate([
      { $match: { project_id: { $in: projectIds } } },
      { $group: { _id: "$project_id", total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } }, blocked: { $sum: { $cond: [{ $eq: ["$status", "blocked"] }, 1, 0] } } } },
    ]),
    ProjectMilestone.aggregate([
      { $match: { project_id: { $in: projectIds } } },
      { $group: { _id: "$project_id", total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
    ]),
  ]);
  return {
    participants: new Map(participantRows.map((row) => [row._id, row.count])),
    tasks: new Map(taskRows.map((row) => [row._id, { total: row.total, done: row.done, blocked: row.blocked }])),
    milestones: new Map(milestoneRows.map((row) => [row._id, { total: row.total, completed: row.completed }])),
  };
};

const skillsByIds = async (skillIds) => {
  const ids = [...new Set(skillIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await Skill.find({ _id: trustedIn(ids), is_active: true }).select("_id slug name category").lean();
  return new Map(rows.map((row) => [String(row._id), toApp(row)]));
};

const listParticipants = async (projectId, filters = {}) => {
  const filter = { project_id: projectId, ...(filters.activeOnly === false ? {} : { status: "active" }) };
  const [items, total] = await Promise.all([
    ProjectParticipant.find(filter).sort({ role: 1, joined_at: 1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    ProjectParticipant.countDocuments(filter),
  ]);
  return { items: toApps(items), total, page: filters.page, limit: filters.limit };
};

const listTasks = async (projectId, filters) => {
  const filter = { project_id: projectId };
  if (filters.status) filter.status = filters.status;
  if (filters.priority) filter.priority = filters.priority;
  if (filters.assigneeId) filter.assignee_ids = filters.assigneeId;
  if (filters.milestoneId) filter.milestone_id = filters.milestoneId;
  const [items, total] = await Promise.all([
    ProjectTask.find(filter).sort({ status: 1, due_date: 1, updated_at: -1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    ProjectTask.countDocuments(filter),
  ]);
  return { items: toApps(items), total, page: filters.page, limit: filters.limit };
};

const listMilestones = async (projectId) => toApps(await ProjectMilestone.find({ project_id: projectId }).sort({ target_date: 1, created_at: 1 }).lean());

const listActivity = async (projectId, filters) => {
  const filter = { project_id: projectId };
  const [items, total] = await Promise.all([
    ProjectActivity.find(filter).sort({ created_at: -1, _id: 1 }).skip((filters.page - 1) * filters.limit).limit(filters.limit).lean(),
    ProjectActivity.countDocuments(filter),
  ]);
  return { items: toApps(items), total, page: filters.page, limit: filters.limit };
};

module.exports = {
  findById, findBySlugs, listActivity, listForTeam, listMilestones, listMine, listParticipants,
  listTasks, projectCounts, skillsByIds,
};
