const { validationResult } = require("express-validator");
const { ERROR_CODES } = require("../config/constants");

/**
 * Validation Middleware
 * Checks for validation errors from express-validator
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: "Validation failed",
        details: formattedErrors,
      },
    });
  }

  next();
};

module.exports = validate;
