const express = require("express");
const publicController = require("../controllers/publicController");
const validate = require("../middleware/validation");
const {
  newsletterSubscribeValidation,
  serviceBookingValidation,
  supportJarValidation,
} = require("../utils/validators");

const router = express.Router();
const { publicFormLimiter } = require("../middleware/rateLimiter");
const profileController = require("../controllers/profileController");

router.get("/profiles/:username", profileController.getPublic);
router.get("/skills", profileController.searchSkills);

router.get("/services/catalog", publicController.getServicesCatalog);
router.post(
  "/newsletter/subscribe",
  publicFormLimiter,
  newsletterSubscribeValidation,
  validate,
  publicController.subscribeNewsletter
);
router.post(
  "/services/book",
  publicFormLimiter,
  serviceBookingValidation,
  validate,
  publicController.bookService
);
router.post(
  "/support-jar",
  publicFormLimiter,
  supportJarValidation,
  validate,
  publicController.contributeSupportJar
);

module.exports = router;
