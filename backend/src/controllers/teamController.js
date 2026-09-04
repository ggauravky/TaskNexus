const teamService = require("../services/teamService");
const membershipService = require("../services/membershipService");
const invitationService = require("../services/invitationService");
const joinRequestService = require("../services/joinRequestService");
const { sendSuccess } = require("../utils/apiResponse");

const action = (handler) => async (req, res, next) => {
  try { return await handler(req, res); } catch (error) { return next(error); }
};

exports.listTeams = action(async (req, res) => {
  const result = await teamService.listTeams(req.query, req.userId);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.createTeam = action(async (req, res) => sendSuccess(res, { status: 201, data: await teamService.createTeam(req.userId, req.body), message: "Team created" }));
exports.getTeam = action(async (req, res) => sendSuccess(res, { data: await teamService.getTeamBySlug(req.params.slug, req.userId) }));
exports.updateTeam = action(async (req, res) => sendSuccess(res, { data: await teamService.updateTeam(req.params.id, req.userId, req.body), message: "Team updated" }));
exports.archiveTeam = action(async (req, res) => sendSuccess(res, { data: await teamService.archiveTeam(req.params.id, req.userId), message: "Team archived" }));
exports.listActivity = action(async (req, res) => {
  const result = await teamService.listActivity(req.params.id, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});

exports.listMembers = action(async (req, res) => {
  const result = await membershipService.listMembers(req.params.id, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.joinTeam = action(async (req, res) => sendSuccess(res, { status: 201, data: await membershipService.joinOpenTeam(req.params.id, req.userId), message: "Joined team" }));
exports.leaveTeam = action(async (req, res) => sendSuccess(res, { data: await membershipService.leaveTeam(req.params.id, req.userId), message: "Left team" }));
exports.changeRole = action(async (req, res) => sendSuccess(res, { data: await membershipService.changeRole(req.params.id, req.params.userId, req.userId, req.body.role), message: "Member role updated" }));
exports.removeMember = action(async (req, res) => sendSuccess(res, { data: await membershipService.removeMember(req.params.id, req.params.userId, req.userId), message: "Member removed" }));
exports.transferOwnership = action(async (req, res) => sendSuccess(res, { data: await membershipService.transferOwnership(req.params.id, req.body.userId, req.userId), message: "Ownership transferred" }));

exports.sendInvitation = action(async (req, res) => sendSuccess(res, { status: 201, data: await invitationService.sendInvitation(req.params.id, req.userId, req.body), message: "Invitation sent" }));
exports.listInvitations = action(async (req, res) => {
  const result = await invitationService.listTeamInvitations(req.params.id, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.listInvitationInbox = action(async (req, res) => {
  const result = await invitationService.listInbox(req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.acceptInvitation = action(async (req, res) => sendSuccess(res, { data: await invitationService.respond(req.params.id, req.userId, "accepted"), message: "Invitation accepted" }));
exports.declineInvitation = action(async (req, res) => sendSuccess(res, { data: await invitationService.respond(req.params.id, req.userId, "declined"), message: "Invitation declined" }));
exports.cancelInvitation = action(async (req, res) => sendSuccess(res, { data: await invitationService.cancelInvitation(req.params.id, req.params.invitationId, req.userId), message: "Invitation cancelled" }));
exports.searchCandidates = action(async (req, res) => sendSuccess(res, { data: await invitationService.searchCandidates(req.params.id, req.userId, req.query) }));

exports.createJoinRequest = action(async (req, res) => sendSuccess(res, { status: 201, data: await joinRequestService.createRequest(req.params.id, req.userId, req.body), message: "Join request sent" }));
exports.listJoinRequests = action(async (req, res) => {
  const result = await joinRequestService.listTeamRequests(req.params.id, req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.listOwnJoinRequests = action(async (req, res) => {
  const result = await joinRequestService.listOwnRequests(req.userId, req.query);
  return sendSuccess(res, { data: result.items, meta: result.meta });
});
exports.acceptJoinRequest = action(async (req, res) => sendSuccess(res, { data: await joinRequestService.reviewRequest(req.params.id, req.userId, "accepted"), message: "Join request accepted" }));
exports.rejectJoinRequest = action(async (req, res) => sendSuccess(res, { data: await joinRequestService.reviewRequest(req.params.id, req.userId, "rejected"), message: "Join request rejected" }));
exports.cancelJoinRequest = action(async (req, res) => sendSuccess(res, { data: await joinRequestService.cancelRequest(req.params.id, req.userId), message: "Join request cancelled" }));
