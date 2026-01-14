const jwt = require("jsonwebtoken");

/**
 * Generate JWT access token
 * Short-lived token for API authentication
 */
const generateAccessToken = (userId, role) => {
  return jwt.sign(
    {
      userId,
      role,
      type: "access",
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m" }
  );
};

/**
 * Generate JWT refresh token
 * Long-lived token for refreshing access tokens
 */
const generateRefreshToken = (userId, role) => {
  return jwt.sign(
    {
      userId,
      role,
      type: "refresh",
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || "7d" }
  );
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (decoded.type !== "access") {
      throw new Error("Invalid token type");
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    if (decoded.type !== "refresh") {
      throw new Error("Invalid token type");
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

/**
 * Generate both access and refresh tokens
 */
const generateTokens = (userId, role) => {
  return {
    accessToken: generateAccessToken(userId, role),
    refreshToken: generateRefreshToken(userId, role),
  };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokens,
};
