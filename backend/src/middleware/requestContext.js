const { randomUUID } = require("crypto");

const requestContext = (req, res, next) => {
  const incoming = req.get("x-request-id");
  req.requestId = incoming && /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)
    ? incoming
    : randomUUID();
  res.setHeader("x-request-id", req.requestId);

  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 && body?.success === false) {
      const fallbackCodes = { 400: "VALIDATION_FAILED", 401: "AUTHENTICATION_ERROR", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 429: "RATE_LIMIT_EXCEEDED" };
      if (!body.error || typeof body.error !== "object") {
        body = {
          success: false,
          error: {
            code: fallbackCodes[res.statusCode] || "INTERNAL_SERVER_ERROR",
            message: body.message || "Request failed",
            request_id: req.requestId,
          },
        };
      } else if (!body.error.request_id) {
        body = { ...body, error: { ...body.error, request_id: req.requestId } };
      }
    }
    return sendJson(body);
  };
  next();
};

module.exports = requestContext;
