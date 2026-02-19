const express = require("express");
const { body } = require("express-validator");
const settingsController = require("../controllers/settingsController");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validation");

const router = express.Router();

router.use(authenticate);

router.get("/preferences", settingsController.getPreferences);
router.put("/preferences", settingsController.updatePreferences);
router.post("/preferences/reset", settingsController.resetPreferences);

router.get("/presets", settingsController.getPresets);
router.post(
  "/presets/apply",
  [body("presetId").trim().notEmpty().withMessage("presetId is required")],
  validate,
  settingsController.applyPreset,
);
router.post(
  "/presets",
  [body("name").trim().notEmpty().withMessage("Preset name is required")],
  validate,
  settingsController.savePreset,
);

router.get("/board", settingsController.getBoardState);
router.put("/board", settingsController.updateBoardState);
router.post("/board/reset", settingsController.resetBoardState);

module.exports = router;
