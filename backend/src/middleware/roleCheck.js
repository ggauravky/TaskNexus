const { USER_ROLES, ERROR_CODES } = require("../config/constants");
const logger = require("../utils/logger");

/**
 * Role-Based Access Control Middleware
 * Checks if user has required role(s)
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated
      if (!req.user || !req.userRole) {
        return res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTHENTICATION_ERROR,
            message: "Authentication required",
          },
        });
      }

      // Check if user has allowed role
      if (!allowedRoles.includes(req.userRole)) {
        logger.warn(
          `Access denied for user ${req.userId} with role ${
            req.userRole
          }. Required: ${allowedRoles.join(", ")}`
        );

        return res.status(403).json({
          success: false,
          error: {
            code: ERROR_CODES.AUTHORIZATION_ERROR,
            message: "You do not have permission to access this resource",
          },
        });
      }

      next();
    } catch (error) {
      logger.error("Role check error:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: "Authorization check failed",
        },
      });
    }
  };
};

/**
 * Middleware to check if user is a client
 */
const requireClient = requireRole(USER_ROLES.CLIENT);

/**
 * Middleware to check if user is a freelancer
 */
const requireFreelancer = requireRole(USER_ROLES.FREELANCER);

/**
 * Middleware to check if user is an admin
 */
const requireAdmin = requireRole(USER_ROLES.ADMIN);

/**
 * Middleware to check if user is client or admin
 */
const requireClientOrAdmin = requireRole(USER_ROLES.CLIENT, USER_ROLES.ADMIN);

/**
 * Middleware to check if user is freelancer or admin
 */
const requireFreelancerOrAdmin = requireRole(
  USER_ROLES.FREELANCER,
  USER_ROLES.ADMIN
);

module.exports = {
  requireRole,
  requireClient,
  requireFreelancer,
  requireAdmin,
  requireClientOrAdmin,
  requireFreelancerOrAdmin,
};
