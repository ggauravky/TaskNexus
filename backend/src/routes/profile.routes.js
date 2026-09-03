const express = require("express");
const { param, query } = require("express-validator");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validation");
const profileController = require("../controllers/profileController");

const router = express.Router();
router.use(authenticate);

router.get("/", profileController.getOwn);
router.put("/", profileController.updateOwn);
router.put("/onboarding", profileController.completeOnboarding);
router.get(
  "/username",
  [query("username").isString().isLength({ min: 3, max: 30 })],
  validate,
  profileController.checkUsername,
);
router.put("/skills", profileController.replaceSkills);
router.post("/education", profileController.createEducation);
router.put(
  "/education/:id",
  [param("id").isUUID().withMessage("Invalid education ID")],
  validate,
  profileController.updateEducation,
);
router.delete(
  "/education/:id",
  [param("id").isUUID().withMessage("Invalid education ID")],
  validate,
  profileController.deleteEducation,
);

module.exports = router;
