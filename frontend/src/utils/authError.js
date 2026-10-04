const NETWORK_ERROR_CODES = new Set([
  "ERR_NETWORK",
  "ECONNABORTED",
  "ETIMEDOUT",
]);

const STATUS_MESSAGES = {
  400: "Please check the information you entered and try again.",
  401: "Your email or password is incorrect.",
  403: "This account is not allowed to complete that action.",
  404: "The authentication service could not be found.",
  409: "An account with those details already exists.",
  422: "Some account details are invalid.",
  429: "Too many attempts. Please wait a moment and try again.",
};

const asMessage = (value) => typeof value === "string" && value.trim()
  ? value.trim()
  : null;

export const normalizeAuthError = (error, fallback = "Authentication failed. Please try again.") => {
  const responseData = error?.response?.data;
  const responseError = responseData?.error;
  const message = asMessage(responseError?.message)
    || asMessage(responseError)
    || asMessage(responseData?.message);
  const details = Array.isArray(responseError?.details)
    ? responseError.details
    : Array.isArray(responseData?.details)
      ? responseData.details
      : undefined;

  if (message) return { message, details };

  if (!error?.response && (error?.request || NETWORK_ERROR_CODES.has(error?.code))) {
    return {
      message: "Unable to reach the TaskNexus server. Check your connection and try again.",
    };
  }

  const statusMessage = STATUS_MESSAGES[error?.response?.status];
  if (statusMessage) return { message: statusMessage, details };
  if (error?.response?.status >= 500) {
    return { message: "TaskNexus is temporarily unavailable. Please try again shortly." };
  }

  return { message: asMessage(fallback) || "Authentication failed. Please try again." };
};
