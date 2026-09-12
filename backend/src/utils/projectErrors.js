const { AppError } = require("./appError");
const { ERROR_CODES } = require("../config/constants");

const projectError = (code, message, statusCode = 400, details = null) =>
  new AppError(code, message, statusCode, details);

const projectErrors = {
  notFound: () => projectError(ERROR_CODES.PROJECT_NOT_FOUND, "Project not found", 404),
  denied: (message = "You do not have permission for this project action") =>
    projectError(ERROR_CODES.PROJECT_ACCESS_DENIED, message, 403),
  participantRequired: () => projectError(ERROR_CODES.PROJECT_PARTICIPANT_REQUIRED, "Active project participation required", 403),
  participantExists: () => projectError(ERROR_CODES.PROJECT_PARTICIPANT_EXISTS, "This user is already a project participant", 409),
  participantNotFound: () => projectError(ERROR_CODES.PROJECT_PARTICIPANT_NOT_FOUND, "Active project participant not found", 404),
  taskNotFound: () => projectError(ERROR_CODES.PROJECT_TASK_NOT_FOUND, "Project task not found", 404),
  milestoneNotFound: () => projectError(ERROR_CODES.PROJECT_MILESTONE_NOT_FOUND, "Project milestone not found", 404),
  staleWrite: () => projectError(ERROR_CODES.PROJECT_STALE_WRITE, "This item changed before your update completed. Refresh and try again.", 409),
};

module.exports = { projectError, projectErrors };
