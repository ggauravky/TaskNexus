const express = require("express");
const { query } = require("express-validator");
const { authenticate } = require("../middleware/auth");
const { discoveryLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validation");
const searchController = require("../controllers/searchController");

const router = express.Router();

router.get(
  "/search",
  authenticate,
  discoveryLimiter,
  [
    query("q")
      .exists({ checkFalsy: true })
      .withMessage("Search query is required")
      .bail()
      .isString()
      .withMessage("Search query must be text")
      .bail()
      .customSanitizer((value) => value.trim().replace(/\s+/g, " "))
      .isLength({ min: 2, max: 80 })
      .withMessage("Search query must be between 2 and 80 characters"),
  ],
  validate,
  searchController.search,
);

module.exports = router;
