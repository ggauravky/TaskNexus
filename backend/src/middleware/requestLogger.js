const logger = require("../utils/logger");

const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info("Request completed", {
      requestId: req.requestId,
      method: req.method,
      route: String(req.originalUrl || req.path || "").split("?")[0],
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
    });
  });
  next();
};

module.exports = requestLogger;
