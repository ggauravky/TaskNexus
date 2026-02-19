const { verifyAccessToken } = require("../config/jwt");
const userData = require("../data/userData");
const realtimeHub = require("../services/realtimeHub");

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  if (typeof req.query.token === "string" && req.query.token.trim()) {
    return req.query.token.trim();
  }

  return null;
};

exports.stream = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Missing access token for realtime stream",
      });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid realtime access token",
      });
    }

    const user = await userData.findUserById(decoded.userId);
    if (!user || user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "User is not allowed to open realtime stream",
      });
    }

    realtimeHub.subscribe(req, res, user);
  } catch (error) {
    next(error);
  }
};
