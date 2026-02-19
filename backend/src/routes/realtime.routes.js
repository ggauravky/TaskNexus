const express = require("express");
const router = express.Router();
const realtimeController = require("../controllers/realtimeController");

router.get("/stream", realtimeController.stream);

module.exports = router;
