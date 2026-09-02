const { randomUUID } = require("crypto");

const requestContext = (req, res, next) => {
  const incoming = req.get("x-request-id");
  req.requestId = incoming && /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)
    ? incoming
    : randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};

module.exports = requestContext;
