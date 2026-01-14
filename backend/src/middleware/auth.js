const { verifyAccessToken } = require("../config/jwt");
const User = require("../models/User");
const logger = require("../utils/logger");
const { ERROR_CODES } = require("../config/constants");

/**
 * Authentication Middleware
 * Verifies JWT access token and attaches user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: "No token provided. Please login.",
        },
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTHENTICATION_ERROR,
            message: "Token expired. Please refresh your token.",
          },
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: "Invalid token.",
        },
      });
    }

    // Find user
    const user = await User.findById(decoded.userId).select(
      "-password -refreshToken"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: "User not found. Token invalid.",
        },
      });
    }

    // Check if user is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: `Account is ${user.status}. Please contact support.`,
        },
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    return res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: "Authentication failed",
      },
    });
  }
};

/**
 * Optional Authentication Middleware
 * Tries to authenticate but doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId).select(
        "-password -refreshToken"
      );

      if (user && user.status === "active") {
        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
      }
    } catch (error) {
      // Ignore errors for optional auth
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};
