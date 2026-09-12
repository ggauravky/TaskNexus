const projectService = require("../services/projectService");
const participantService = require("../services/projectParticipantService");
const taskService = require("../services/projectTaskService");
const milestoneService = require("../services/projectMilestoneService");
const { sendSuccess } = require("../utils/apiResponse");

const action = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) { return next(error); }
};

exports.listMyProjects = action(async (req, res) => {
  const result = await projectService.listMyProjects(req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.listTeamProjects = action(async (req, res) => {
  const result = await projectService.listTeamProjects(req.params.teamId, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.createProject = action(async (req, res) => sendSuccess(res, {
  status: 201, data: await projectService.createProject(req.params.teamId, req.userId, req.body), message: "Project created",
}));
exports.getProject = action(async (req, res) => sendSuccess(res, { data: await projectService.getProject(req.params.id, req.userId) }));
exports.getProjectBySlugs = action(async (req, res) => sendSuccess(res, {
  data: await projectService.getProjectBySlugs(req.params.teamSlug, req.params.projectSlug, req.userId),
}));
exports.updateProject = action(async (req, res) => sendSuccess(res, {
  data: await projectService.updateProject(req.params.id, req.userId, req.body), message: "Project updated",
}));
exports.transitionProject = action(async (req, res) => sendSuccess(res, {
  data: await projectService.transitionProject(req.params.id, req.userId, req.body.status), message: "Project status updated",
}));
exports.completeProject = action(async (req, res) => sendSuccess(res, {
  data: await projectService.transitionProject(req.params.id, req.userId, "completed"), message: "Project completed",
}));
exports.archiveProject = action(async (req, res) => sendSuccess(res, {
  data: await projectService.transitionProject(req.params.id, req.userId, "archived"), message: "Project archived",
}));
exports.listActivity = action(async (req, res) => {
  const result = await projectService.listActivity(req.params.id, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});

exports.listParticipants = action(async (req, res) => {
  const result = await participantService.listParticipants(req.params.id, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.listCandidates = action(async (req, res) => sendSuccess(res, { data: await participantService.listCandidates(req.params.id, req.userId) }));
exports.addParticipant = action(async (req, res) => sendSuccess(res, {
  status: 201, data: await participantService.addParticipant(req.params.id, req.userId, req.body), message: "Participant added",
}));
exports.changeParticipantRole = action(async (req, res) => sendSuccess(res, {
  data: await participantService.changeParticipantRole(req.params.id, req.params.userId, req.userId, req.body.role), message: "Project role updated",
}));
exports.removeParticipant = action(async (req, res) => sendSuccess(res, {
  data: await participantService.removeParticipant(req.params.id, req.params.userId, req.userId), message: "Participant removed",
}));

exports.listTasks = action(async (req, res) => {
  const result = await taskService.listTasks(req.params.id, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.createTask = action(async (req, res) => sendSuccess(res, {
  status: 201, data: await taskService.createTask(req.params.id, req.userId, req.body), message: "Project task created",
}));
exports.getTask = action(async (req, res) => sendSuccess(res, { data: await taskService.getTask(req.params.id, req.userId) }));
exports.updateTask = action(async (req, res) => sendSuccess(res, {
  data: await taskService.updateTask(req.params.id, req.userId, req.body), message: "Project task updated",
}));
exports.changeTaskStatus = action(async (req, res) => sendSuccess(res, {
  data: await taskService.changeStatus(req.params.id, req.userId, req.body), message: "Task status updated",
}));
exports.setTaskAssignees = action(async (req, res) => sendSuccess(res, {
  data: await taskService.setAssignees(req.params.id, req.userId, req.body), message: "Task assignments updated",
}));
exports.removeTaskAssignee = action(async (req, res) => sendSuccess(res, {
  data: await taskService.removeAssignee(req.params.id, req.params.userId, req.userId, req.body.revision), message: "Task assignee removed",
}));

exports.listMilestones = action(async (req, res) => sendSuccess(res, { data: await milestoneService.listMilestones(req.params.id, req.userId) }));
exports.createMilestone = action(async (req, res) => sendSuccess(res, {
  status: 201, data: await milestoneService.createMilestone(req.params.id, req.userId, req.body), message: "Milestone created",
}));
exports.updateMilestone = action(async (req, res) => sendSuccess(res, {
  data: await milestoneService.updateMilestone(req.params.id, req.userId, req.body), message: "Milestone updated",
}));
exports.deleteMilestone = action(async (req, res) => sendSuccess(res, {
  data: await milestoneService.deleteMilestone(req.params.id, req.userId), message: "Milestone removed",
}));
