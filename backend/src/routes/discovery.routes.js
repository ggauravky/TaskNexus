const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/auth");
const { collaborationRequestLimiter, discoveryLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validation");
const controller = require("../controllers/discoveryController");

const router = express.Router();
const uuid = (name) => param(name).isUUID().withMessage(`Invalid ${name}`);
const pagination = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 50 })];

router.use(authenticate);
router.get("/people", discoveryLimiter, [
  ...pagination, query("search").optional().isString().isLength({ max: 80 }), query("skillMode").optional().isIn(["all", "any"]),
  query("skills").optional().isString().isLength({ max: 320 }), query("roles").optional().isString().isLength({ max: 320 }),
  query("interests").optional().isString().isLength({ max: 320 }), query("availability").optional().isString().isLength({ max: 80 }),
  query("hasPublishedProjects").optional().isBoolean(), query("hasExternalEvidence").optional().isBoolean(),
], validate, controller.listPeople);

router.get("/team-openings", discoveryLimiter, pagination, validate, controller.listOpenings);
router.get("/teams/:teamId/openings", discoveryLimiter, [uuid("teamId")], validate, controller.listTeamOpenings);
router.post("/teams/:teamId/openings", [
  uuid("teamId"), body("title").isString().trim().isLength({ min: 3, max: 120 }), body("description").optional().isString().isLength({ max: 2000 }),
  body("role").isString().isLength({ max: 60 }), body("requiredSkillIds").optional().isArray({ max: 8 }), body("requiredSkillIds.*").optional().isUUID(),
  body("preferredSkillIds").optional().isArray({ max: 8 }), body("preferredSkillIds.*").optional().isUUID(), body("commitment").optional({ nullable: true }).isString(),
], validate, controller.createOpening);
router.patch("/team-openings/:id", [
  uuid("id"), body("title").optional().isString().trim().isLength({ min: 3, max: 120 }), body("description").optional().isString().isLength({ max: 2000 }),
  body("role").optional().isString().isLength({ max: 60 }), body("requiredSkillIds").optional().isArray({ max: 8 }), body("requiredSkillIds.*").optional().isUUID(),
  body("preferredSkillIds").optional().isArray({ max: 8 }), body("preferredSkillIds.*").optional().isUUID(), body("commitment").optional({ nullable: true }).isString(),
], validate, controller.updateOpening);
router.post("/team-openings/:id/close", [uuid("id")], validate, controller.closeOpening);
router.get("/team-openings/:id/candidates", discoveryLimiter, [uuid("id"), ...pagination], validate, controller.openingCandidates);
router.post("/team-openings/:id/interest", collaborationRequestLimiter, [uuid("id"), body("message").optional().isString().isLength({ max: 500 })], validate, controller.openingInterest);

router.get("/collaboration-requests", pagination, validate, controller.listRequests);
router.post("/collaboration-requests", collaborationRequestLimiter, [
  body("recipientId").isUUID(), body("message").optional().isString().isLength({ max: 500 }), body("teamId").optional({ nullable: true }).isUUID(),
  body("projectId").optional({ nullable: true }).isUUID(), body("teamOpeningId").optional({ nullable: true }).isUUID(),
], validate, controller.createRequest);
router.post("/collaboration-requests/:id/accept", [uuid("id")], validate, controller.acceptRequest);
router.post("/collaboration-requests/:id/decline", [uuid("id")], validate, controller.declineRequest);
router.delete("/collaboration-requests/:id", [uuid("id")], validate, controller.cancelRequest);

router.get("/user-blocks", controller.listBlocks);
router.post("/user-blocks", [body("userId").isUUID()], validate, controller.blockUser);
router.delete("/user-blocks/:userId", [uuid("userId")], validate, controller.unblockUser);

module.exports = router;
