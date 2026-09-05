const contributionService = require("../services/contributionService");
const repositoryService = require("../services/projectRepositoryService");
const showcaseService = require("../services/showcaseService");
const { sendSuccess } = require("../utils/apiResponse");

const action = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) { return next(error); }
};

exports.listProject = action(async (req, res) => {
  const result = await contributionService.listProjectContributions(req.params.projectId, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: { ...result.meta, summary: result.summary } });
});
exports.listMine = action(async (req, res) => {
  const result = await contributionService.listMine(req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: { ...result.meta, summary: result.summary } });
});
exports.listUserProject = action(async (req, res) => {
  const result = await contributionService.listUserProjectContributions(req.params.projectId, req.params.userId, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: { ...result.meta, summary: result.summary } });
});
exports.addEvidence = action(async (req, res) => sendSuccess(res, {
  status: 201, data: await contributionService.addEvidence(req.params.projectId, req.userId, req.body), message: "Evidence added",
}));
exports.revokeEvidence = action(async (req, res) => sendSuccess(res, {
  data: await contributionService.revokeEvidence(req.params.id, req.userId), message: "Evidence removed from active history",
}));
exports.verifyEvidence = action(async (req, res) => sendSuccess(res, {
  data: await contributionService.verifyEvidence(req.params.id, req.userId), message: "GitHub evidence verified",
}));
exports.setProfileVisibility = action(async (req, res) => sendSuccess(res, {
  data: await contributionService.setProfileVisibility(req.params.projectId, req.userId, req.body.showOnProfile), message: "Profile project visibility updated",
}));

exports.listRepositories = action(async (req, res) => sendSuccess(res, { data: await repositoryService.listRepositories(req.params.projectId, req.userId) }));
exports.addRepository = action(async (req, res) => sendSuccess(res, {
  status: 201, data: await repositoryService.addRepository(req.params.projectId, req.userId, req.body), message: "Repository linked",
}));
exports.removeRepository = action(async (req, res) => sendSuccess(res, {
  data: await repositoryService.removeRepository(req.params.projectId, req.params.repositoryId, req.userId), message: "Repository removed",
}));
exports.verifyRepository = action(async (req, res) => sendSuccess(res, {
  data: await repositoryService.verifyRepository(req.params.projectId, req.params.repositoryId, req.userId), message: "Repository verified",
}));

exports.getShowcase = action(async (req, res) => sendSuccess(res, { data: await showcaseService.getShowcase(req.params.projectId, req.userId) }));
exports.updateShowcase = action(async (req, res) => sendSuccess(res, { data: await showcaseService.updateShowcase(req.params.projectId, req.userId, req.body), message: "Showcase saved" }));
exports.publishShowcase = action(async (req, res) => sendSuccess(res, { data: await showcaseService.publishShowcase(req.params.projectId, req.userId, req.body.revision), message: "Showcase published" }));
exports.unpublishShowcase = action(async (req, res) => sendSuccess(res, { data: await showcaseService.unpublishShowcase(req.params.projectId, req.userId, req.body.revision), message: "Showcase unpublished" }));
exports.getPublicShowcase = action(async (req, res) => sendSuccess(res, { data: await showcaseService.getPublicShowcase(req.params.teamSlug, req.params.projectSlug) }));
