const { AppError } = require("./appError");
const { ERROR_CODES } = require("../config/constants");

const teamError = (code, message, statusCode = 400, details = null) =>
  new AppError(code, message, statusCode, details);

const teamErrors = {
  notFound: () => teamError(ERROR_CODES.TEAM_NOT_FOUND, "Team not found", 404),
  denied: (message = "You do not have permission for this team action") =>
    teamError(ERROR_CODES.TEAM_ACCESS_DENIED, message, 403),
  alreadyMember: () => teamError(ERROR_CODES.ALREADY_TEAM_MEMBER, "You are already a team member", 409),
  notMember: () => teamError(ERROR_CODES.NOT_TEAM_MEMBER, "Active team membership required", 403),
  invitationExists: () => teamError(ERROR_CODES.TEAM_INVITATION_EXISTS, "A pending invitation already exists", 409),
  invitationNotFound: () => teamError(ERROR_CODES.TEAM_INVITATION_NOT_FOUND, "Pending invitation not found", 404),
  requestExists: () => teamError(ERROR_CODES.JOIN_REQUEST_EXISTS, "A pending join request already exists", 409),
  requestNotFound: () => teamError(ERROR_CODES.JOIN_REQUEST_NOT_FOUND, "Pending join request not found", 404),
  ownerTransferRequired: () => teamError(ERROR_CODES.OWNER_TRANSFER_REQUIRED, "Transfer ownership before leaving", 409),
};

module.exports = { teamError, teamErrors };
