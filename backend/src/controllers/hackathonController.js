const service = require("../services/hackathonService");
const { sendSuccess } = require("../utils/apiResponse");

const action = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) { return next(error); }
};

exports.list = action(async (req, res) => {
  const result = await service.listHackathons(req.query, req.userId, req.userRole);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.detail = action(async (req, res) => sendSuccess(res, { data: await service.getHackathon(req.params.slug, req.userId, req.userRole) }));
exports.create = action(async (req, res) => sendSuccess(res, { status: 201, data: await service.createHackathon(req.userId, req.body), message: "Hackathon created" }));
exports.update = action(async (req, res) => sendSuccess(res, { data: await service.updateHackathon(req.params.id, req.userId, req.body), message: "Hackathon updated" }));
exports.archive = action(async (req, res) => sendSuccess(res, { data: await service.archiveHackathon(req.params.id), message: "Hackathon archived" }));
exports.join = action(async (req, res) => sendSuccess(res, { status: 201, data: await service.saveParticipation(req.params.id, req.userId, req.body, { create: true }), message: "Hackathon participation recorded" }));
exports.updateParticipation = action(async (req, res) => sendSuccess(res, { data: await service.saveParticipation(req.params.id, req.userId, req.body), message: "Hackathon participation updated" }));
exports.withdrawParticipation = action(async (req, res) => sendSuccess(res, { data: await service.withdrawParticipation(req.params.id, req.userId), message: "Hackathon participation withdrawn" }));
exports.people = action(async (req, res) => {
  const result = await service.discoverTeammates(req.params.id, req.userId, req.userRole, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.registerTeam = action(async (req, res) => sendSuccess(res, { status: 201, data: await service.registerTeam(req.params.id, req.userId, req.body.teamId), message: "Team registered" }));
exports.myTeam = action(async (req, res) => sendSuccess(res, { data: await service.getMyTeam(req.params.id, req.userId) }));
exports.withdrawTeam = action(async (req, res) => sendSuccess(res, { data: await service.withdrawTeam(req.params.id, req.userId), message: "Team registration withdrawn" }));
exports.linkProject = action(async (req, res) => sendSuccess(res, { data: await service.linkProject(req.params.id, req.userId, req.body.projectId, req.body.revision), message: "Project linked" }));
exports.unlinkProject = action(async (req, res) => sendSuccess(res, { data: await service.unlinkProject(req.params.id, req.userId, req.body.revision), message: "Project unlinked" }));
exports.submission = action(async (req, res) => sendSuccess(res, { data: await service.getSubmission(req.params.id, req.userId) }));
exports.saveSubmission = action(async (req, res) => sendSuccess(res, { data: await service.saveSubmission(req.params.id, req.userId, req.body), message: "Submission saved" }));
exports.submitFinal = action(async (req, res) => sendSuccess(res, { data: await service.submitFinal(req.params.id, req.userId, req.body), message: "Hackathon entry submitted" }));
