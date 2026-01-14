const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validation");
const { registerValidation, loginValidation } = require("../utils/validators");

// Public routes
router.post(
  "/register",
  authLimiter,
  registerValidation,
  validate,
  authController.register
);
router.post(
  "/login",
  authLimiter,
  loginValidation,
  validate,
  authController.login
);
router.post("/refresh", authController.refreshToken);

// Protected routes
router.post("/logout", authenticate, authController.logout);
router.get("/me", authenticate, authController.getCurrentUser);

module.exports = router;
