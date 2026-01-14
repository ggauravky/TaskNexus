/**
 * Utility helper functions
 */

/**
 * Calculate pagination offset and limit
 */
const getPagination = (page = 1, limit = 10) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  return {
    skip,
    limit: limitNum,
    page: pageNum,
  };
};

/**
 * Format pagination response
 */
const paginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

/**
 * Generate random string
 */
const generateRandomString = (length = 32) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Calculate time difference in hours
 */
const getHoursDifference = (date1, date2) => {
  const diff = Math.abs(new Date(date2) - new Date(date1));
  return Math.floor(diff / (1000 * 60 * 60));
};

/**
 * Format currency
 */
const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
};

/**
 * Sanitize user object for response
 */
const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;
  delete userObj.refreshToken;
  delete userObj.passwordResetToken;
  delete userObj.passwordResetExpires;
  return userObj;
};

/**
 * Check if date is in future
 */
const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Check if date is in past
 */
const isPastDate = (date) => {
  return new Date(date) < new Date();
};

/**
 * Calculate percentage
 */
const calculatePercentage = (value, total) => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

/**
 * Sleep function for delays
 */
const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Extract error message from error object
 */
const getErrorMessage = (error) => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return "An unknown error occurred";
};

/**
 * Build query filter from request query params
 */
const buildQueryFilter = (queryParams, allowedFields = []) => {
  const filter = {};

  allowedFields.forEach((field) => {
    if (queryParams[field]) {
      filter[field] = queryParams[field];
    }
  });

  return filter;
};

/**
 * Sort object keys alphabetically
 */
const sortObjectKeys = (obj) => {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
};

module.exports = {
  getPagination,
  paginationResponse,
  generateRandomString,
  getHoursDifference,
  formatCurrency,
  sanitizeUser,
  isFutureDate,
  isPastDate,
  calculatePercentage,
  sleep,
  getErrorMessage,
  buildQueryFilter,
  sortObjectKeys,
};
