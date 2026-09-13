const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { authLimiter, refreshLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validation");
const { registerValidation, loginValidation } = require("../utils/validators");
const requireTrustedOrigin = require("../middleware/trustedOrigin");

// Public routes
router.post(
  "/register",
  requireTrustedOrigin,
  authLimiter,
  registerValidation,
  validate,
  authController.register
);
router.post(
  "/login",
  requireTrustedOrigin,
  authLimiter,
  loginValidation,
  validate,
  authController.login
);
router.post("/refresh", requireTrustedOrigin, refreshLimiter, authController.refreshToken);

// Protected routes
router.post("/logout", requireTrustedOrigin, authController.logout);
router.get("/me", authenticate, authController.getCurrentUser);

module.exports = router;
