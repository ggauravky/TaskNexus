const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/roleCheck");
const { discoveryLimiter, hackathonMutationLimiter, hackathonSubmissionLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validation");
const controller = require("../controllers/hackathonController");

const router = express.Router();
const uuid = (name) => param(name).isUUID().withMessage(`Invalid ${name}`);
const pagination = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 30 })];
const participantFields = [
  body("status").optional().isIn(["interested", "participating"]), body("lookingForTeam").optional().isBoolean(),
  body("preferredRoles").optional().isArray({ max: 8 }), body("preferredRoles.*").optional().isString().isLength({ max: 60 }),
  body("preferredSkillIds").optional().isArray({ max: 12 }), body("preferredSkillIds.*").optional().isUUID(),
  body("commitment").optional().isString().isLength({ max: 40 }), body("message").optional({ nullable: true }).isString().isLength({ max: 500 }),
  body("visibleOnHackathon").optional().isBoolean(),
];
const catalogFields = [
  body("name").optional().isString().isLength({ min: 3, max: 140 }), body("slug").optional().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  body("tagline").optional({ nullable: true }).isString().isLength({ max: 180 }), body("description").optional({ nullable: true }).isString().isLength({ max: 6000 }),
  body("organizerName").optional().isString().isLength({ min: 2, max: 160 }), body("mode").optional().isIn(["online", "offline", "hybrid"]),
  body("status").optional().isIn(["upcoming", "registration_open", "active", "submission_closed", "completed"]), body("visibility").optional().isIn(["public", "private"]),
  body("teamMinSize").optional({ nullable: true }).isInt({ min: 1, max: 50 }), body("teamMaxSize").optional({ nullable: true }).isInt({ min: 1, max: 50 }),
  body("allowedRoles").optional().isArray({ max: 12 }), body("recommendedSkillIds").optional().isArray({ max: 16 }), body("recommendedSkillIds.*").optional().isUUID(),
  body("themes").optional().isArray({ max: 12 }), body("submissionRequirements").optional().isArray({ max: 12 }),
  body("submissionRequirements.*.type").optional().isString(), body("submissionRequirements.*.label").optional().isString().isLength({ min: 1, max: 120 }),
  body("submissionRequirements.*.required").optional().isBoolean(),
];

router.get("/hackathons", optionalAuth, discoveryLimiter, [
  ...pagination, query("search").optional().isString().isLength({ max: 200 }), query("status").optional().isString(), query("mode").optional().isString(),
  query("theme").optional().isString().isLength({ max: 60 }), query("skill").optional().isUUID(), query("date").optional().isISO8601(),
  query("sortBy").optional().isIn(["registration_deadline", "event_start", "updated_at"]), query("sortOrder").optional().isIn(["asc", "desc"]), query("my").optional().isBoolean(),
], validate, controller.list);
router.get("/hackathons/:slug", optionalAuth, [param("slug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)], validate, controller.detail);

router.post("/admin/hackathons", authenticate, requireAdmin, hackathonMutationLimiter, [
  body("name").isString().isLength({ min: 3, max: 140 }), body("slug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), body("organizerName").isString().isLength({ min: 2, max: 160 }),
  body("mode").isIn(["online", "offline", "hybrid"]), body("status").isIn(["upcoming", "registration_open", "active", "submission_closed", "completed"]),
  body("eventStart").isISO8601(), body("eventEnd").isISO8601(), ...catalogFields,
], validate, controller.create);
router.patch("/admin/hackathons/:id", authenticate, requireAdmin, hackathonMutationLimiter, [uuid("id"), ...catalogFields], validate, controller.update);
router.post("/admin/hackathons/:id/archive", authenticate, requireAdmin, hackathonMutationLimiter, [uuid("id")], validate, controller.archive);

router.post("/hackathons/:id/participation", authenticate, hackathonMutationLimiter, [uuid("id"), ...participantFields], validate, controller.join);
router.patch("/hackathons/:id/participation", authenticate, hackathonMutationLimiter, [uuid("id"), ...participantFields], validate, controller.updateParticipation);
router.delete("/hackathons/:id/participation", authenticate, hackathonMutationLimiter, [uuid("id")], validate, controller.withdrawParticipation);
router.get("/hackathons/:id/people", authenticate, discoveryLimiter, [uuid("id"), ...pagination], validate, controller.people);
router.post("/hackathons/:id/teams", authenticate, hackathonMutationLimiter, [uuid("id"), body("teamId").isUUID()], validate, controller.registerTeam);
router.get("/hackathons/:id/teams/me", authenticate, [uuid("id")], validate, controller.myTeam);
router.post("/hackathon-teams/:id/withdraw", authenticate, hackathonMutationLimiter, [uuid("id")], validate, controller.withdrawTeam);
router.post("/hackathon-teams/:id/project", authenticate, hackathonMutationLimiter, [uuid("id"), body("projectId").isUUID(), body("revision").isInt({ min: 0 })], validate, controller.linkProject);
router.delete("/hackathon-teams/:id/project", authenticate, hackathonMutationLimiter, [uuid("id"), body("revision").isInt({ min: 0 })], validate, controller.unlinkProject);
router.get("/hackathon-teams/:id/submission", authenticate, [uuid("id")], validate, controller.submission);
router.put("/hackathon-teams/:id/submission", authenticate, hackathonSubmissionLimiter, [
  uuid("id"), body("revision").isInt({ min: 0 }),
  ...["repositoryUrl", "demoUrl", "presentationUrl", "videoUrl", "submissionUrl"].map((field) => body(field).optional({ nullable: true }).isString().isLength({ max: 500 })),
  body("checklist").optional().isArray({ max: 12 }), body("checklist.*.type").optional().isString(), body("checklist.*.completed").optional().isBoolean(),
], validate, controller.saveSubmission);
router.post("/hackathon-teams/:id/submission/submit", authenticate, hackathonSubmissionLimiter, [uuid("id"), body("revision").isInt({ min: 0 }), body("confirm").equals("true")], validate, controller.submitFinal);

module.exports = router;
