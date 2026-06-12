const express = require("express");
const publicController = require("../controllers/publicController");
const validate = require("../middleware/validation");
const {
  newsletterSubscribeValidation,
  serviceBookingValidation,
  supportJarValidation,
} = require("../utils/validators");

const router = express.Router();

router.get("/services/catalog", publicController.getServicesCatalog);
router.post(
  "/newsletter/subscribe",
  newsletterSubscribeValidation,
  validate,
  publicController.subscribeNewsletter
);
router.post(
  "/services/book",
  serviceBookingValidation,
  validate,
  publicController.bookService
);
router.post(
  "/support-jar",
  supportJarValidation,
  validate,
  publicController.contributeSupportJar
);

module.exports = router;
