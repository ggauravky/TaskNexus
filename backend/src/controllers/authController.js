const userData = require("../data/userData");
const auditLogData = require("../data/auditLogData");
const { generateTokens, verifyRefreshToken } = require("../config/jwt");
const { sanitizeUser } = require("../utils/helpers");
const logger = require("../utils/logger");
const { ERROR_CODES } = require("../config/constants");

/**
 * Register new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = async (req, res, next) => {
  try {
    const { email, password, role, profile } = req.body;

    // Check if user already exists
    const existingUser = await userData.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.DUPLICATE_ERROR,
          message: "Email already registered",
        },
      });
    }

    // Create user
    const user = await userData.createUser({
      email,
      password,
      role,
      profile,
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Save refresh token
    await userData.updateUser(user.id, { refresh_token: refreshToken });

    // Log audit
    await auditLogData.log({
      user_id: user.id,
      action: "USER_REGISTERED",
      resource: "user",
      resource_id: user.id,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    logger.info(`New user registered: ${email} with role: ${role}`);

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        accessToken,
      },
      message: "Registration successful",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await userData.findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: "Invalid email or password",
        },
      });
    }

    // Check password
    const isPasswordValid = await userData.comparePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: "Invalid email or password",
        },
      });
    }

    // Check if account is active
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: `Account is ${user.status}. Please contact support.`,
        },
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Save refresh token and last login
    await userData.updateUser(user.id, { 
        refresh_token: refreshToken,
        last_login: new Date(),
    });

    // Log audit
    await auditLogData.log({
      user_id: user.id,
      action: "USER_LOGIN",
      resource: "user",
      resource_id: user.id,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    logger.info(`User logged in: ${email}`);

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user),
        accessToken,
      },
      message: "Login successful",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * @route POST /api/auth/refresh
 * @access Public
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.cookies;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: "Refresh token not found",
        },
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: "Invalid or expired refresh token",
        },
      });
    }

    // Find user and verify stored refresh token
    const user = await userData.findUserById(decoded.userId);

    if (!user || user.refresh_token !== token) {
      return res.status(401).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: "Invalid refresh token",
        },
      });
    }

    // Generate new tokens (refresh token rotation)
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id,
      user.role
    );

    // Save new refresh token
    await userData.updateUser(user.id, { refresh_token: newRefreshToken });

    // Set new refresh token in cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      data: {
        accessToken,
      },
      message: "Token refreshed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 * @access Private
 */
const logout = async (req, res, next) => {
  try {
    // Clear refresh token from database
    await userData.updateUser(req.userId, { refresh_token: null });

    // Log audit
    await auditLogData.log({
      user_id: req.userId,
      action: "USER_LOGOUT",
      resource: "user",
      resource_id: req.userId,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    // Clear cookie
    res.clearCookie("refreshToken");

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 * @route GET /api/auth/me
 * @access Private
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await userData.findUserById(req.userId);

    res.status(200).json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getCurrentUser,
};
