const discoveryService = require("../services/discoveryService");
const openingService = require("../services/teamOpeningService");
const requestService = require("../services/collaborationRequestService");
const { sendSuccess } = require("../utils/apiResponse");

const action = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) { return next(error); }
};

exports.listPeople = action(async (req, res) => {
  const result = await discoveryService.discoverPeople(req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: { ...result.meta, filters: result.filters } });
});

exports.listOpenings = action(async (req, res) => {
  const result = await openingService.listPublicOpenings(req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.listTeamOpenings = action(async (req, res) => sendSuccess(res, { data: await openingService.listTeamOpenings(req.params.teamId, req.userId, req.query) }));
exports.createOpening = action(async (req, res) => sendSuccess(res, { status: 201, data: await openingService.createOpening(req.params.teamId, req.userId, req.body), message: "Team opening created" }));
exports.updateOpening = action(async (req, res) => sendSuccess(res, { data: await openingService.updateOpening(req.params.id, req.userId, req.body), message: "Team opening updated" }));
exports.closeOpening = action(async (req, res) => sendSuccess(res, { data: await openingService.closeOpening(req.params.id, req.userId), message: "Team opening closed" }));
exports.openingCandidates = action(async (req, res) => {
  const result = await openingService.candidateSearch(req.params.id, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.openingInterest = action(async (req, res) => sendSuccess(res, { status: 201, data: await requestService.createOpeningInterest(req.params.id, req.userId, req.body), message: "Interest sent" }));

exports.listRequests = action(async (req, res) => {
  const result = await requestService.listRequests(req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.createRequest = action(async (req, res) => sendSuccess(res, { status: 201, data: await requestService.createRequest(req.userId, req.body), message: "Collaboration request sent" }));
exports.acceptRequest = action(async (req, res) => sendSuccess(res, { data: await requestService.respond(req.params.id, req.userId, "accepted"), message: "Collaboration request accepted" }));
exports.declineRequest = action(async (req, res) => sendSuccess(res, { data: await requestService.respond(req.params.id, req.userId, "declined"), message: "Collaboration request declined" }));
exports.cancelRequest = action(async (req, res) => sendSuccess(res, { data: await requestService.cancel(req.params.id, req.userId), message: "Collaboration request cancelled" }));

exports.listBlocks = action(async (req, res) => sendSuccess(res, { data: await requestService.listBlocks(req.userId) }));
exports.blockUser = action(async (req, res) => sendSuccess(res, { status: 201, data: await requestService.blockUser(req.userId, req.body.userId), message: "User blocked" }));
exports.unblockUser = action(async (req, res) => sendSuccess(res, { data: await requestService.unblockUser(req.userId, req.params.userId), message: "User unblocked" }));
