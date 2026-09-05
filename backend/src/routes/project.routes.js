const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate, optionalAuth } = require("../middleware/auth");
const validate = require("../middleware/validation");
const controller = require("../controllers/projectController");
const contributionController = require("../controllers/contributionController");
const { githubVerificationLimiter } = require("../middleware/rateLimiter");

const router = express.Router();
const uuid = (name) => param(name).isUUID().withMessage(`Invalid ${name}`);
const pagination = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 })];
const slug = (name) => param(name).matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage(`Invalid ${name}`);

router.get("/projects", authenticate, [
  ...pagination, query("status").optional().isIn(["planning", "active", "completed"]),
  query("role").optional().isIn(["lead", "contributor"]), query("search").optional().isString().isLength({ max: 200 }),
], validate, controller.listMyProjects);
router.get("/contributions/me", authenticate, [
  ...pagination, query("projectId").optional().isUUID(),
  query("type").optional().isIn(["project_participation", "project_role", "project_task_completion", "github_commit", "github_pull_request", "external_link"]),
  query("verification").optional().isIn(["internal_verified", "external_verified", "unverified"]),
  query("status").optional().isIn(["active", "revoked"]), query("from").optional().isISO8601(), query("to").optional().isISO8601(),
], validate, contributionController.listMine);
router.get("/showcase/:teamSlug/:projectSlug", [slug("teamSlug"), slug("projectSlug")], validate, contributionController.getPublicShowcase);
router.get("/teams/:teamId/projects", optionalAuth, [
  uuid("teamId"), ...pagination, query("status").optional().isIn(["planning", "active", "completed"]),
  query("skillId").optional().isUUID(), query("participantId").optional().isUUID(),
  query("search").optional().isString().isLength({ max: 200 }),
], validate, controller.listTeamProjects);
router.post("/teams/:teamId/projects", authenticate, [
  uuid("teamId"), body("name").isString().trim().isLength({ min: 3, max: 100 }),
  body("slug").optional().isString().trim().isLength({ min: 3, max: 70 }),
  body("visibility").optional().isIn(["team", "public"]),
  body("skillIds").optional().isArray({ max: 12 }), body("tags").optional().isArray({ max: 8 }),
], validate, controller.createProject);
router.get("/projects/by-slug/:teamSlug/:projectSlug", optionalAuth, [slug("teamSlug"), slug("projectSlug")], validate, controller.getProjectBySlugs);
router.get("/projects/:id", optionalAuth, [uuid("id")], validate, controller.getProject);
router.patch("/projects/:id", authenticate, [
  uuid("id"), body("name").optional().isString().trim().isLength({ min: 3, max: 100 }),
  body("slug").optional().isString().trim().isLength({ min: 3, max: 70 }),
  body("visibility").optional().isIn(["team", "public"]), body("skillIds").optional().isArray({ max: 12 }),
  body("tags").optional().isArray({ max: 8 }),
], validate, controller.updateProject);
router.post("/projects/:id/status", authenticate, [uuid("id"), body("status").isIn(["planning", "active", "completed", "archived"])], validate, controller.transitionProject);
router.post("/projects/:id/complete", authenticate, [uuid("id")], validate, controller.completeProject);
router.post("/projects/:id/archive", authenticate, [uuid("id")], validate, controller.archiveProject);

router.get("/projects/:id/participants", optionalAuth, [uuid("id"), ...pagination], validate, controller.listParticipants);
router.get("/projects/:id/participant-candidates", authenticate, [uuid("id")], validate, controller.listCandidates);
router.post("/projects/:id/participants", authenticate, [uuid("id"), body("userId").isUUID(), body("role").optional().isIn(["lead", "contributor"])], validate, controller.addParticipant);
router.patch("/projects/:id/participants/:userId/role", authenticate, [uuid("id"), uuid("userId"), body("role").isIn(["lead", "contributor"])], validate, controller.changeParticipantRole);
router.delete("/projects/:id/participants/:userId", authenticate, [uuid("id"), uuid("userId")], validate, controller.removeParticipant);

router.get("/projects/:projectId/contributions", authenticate, [uuid("projectId"), ...pagination], validate, contributionController.listProject);
router.get("/projects/:projectId/contributions/:userId", authenticate, [uuid("projectId"), uuid("userId"), ...pagination], validate, contributionController.listUserProject);
router.post("/projects/:projectId/evidence", authenticate, [
  uuid("projectId"), body("type").isIn(["github_commit", "github_pull_request", "external_link"]),
  body("title").isString().trim().isLength({ min: 2, max: 180 }), body("sourceUrl").isURL({ protocols: ["https"], require_protocol: true }),
  body("summary").optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body("occurredAt").optional().isISO8601(), body("publicSafe").optional().isBoolean(),
], validate, contributionController.addEvidence);
router.delete("/contribution-evidence/:id", authenticate, [uuid("id")], validate, contributionController.revokeEvidence);
router.post("/contribution-evidence/:id/verify", authenticate, githubVerificationLimiter, [uuid("id")], validate, contributionController.verifyEvidence);
router.patch("/projects/:projectId/profile-visibility", authenticate, [uuid("projectId"), body("showOnProfile").isBoolean()], validate, contributionController.setProfileVisibility);

router.get("/projects/:projectId/repositories", authenticate, [uuid("projectId")], validate, contributionController.listRepositories);
router.post("/projects/:projectId/repositories", authenticate, [uuid("projectId"), body("url").isURL({ protocols: ["https"], require_protocol: true })], validate, contributionController.addRepository);
router.delete("/projects/:projectId/repositories/:repositoryId", authenticate, [uuid("projectId"), uuid("repositoryId")], validate, contributionController.removeRepository);
router.post("/projects/:projectId/repositories/:repositoryId/verify", authenticate, githubVerificationLimiter, [uuid("projectId"), uuid("repositoryId")], validate, contributionController.verifyRepository);

router.get("/projects/:projectId/showcase", authenticate, [uuid("projectId")], validate, contributionController.getShowcase);
router.put("/projects/:projectId/showcase", authenticate, [
  uuid("projectId"), body("revision").optional().isInt({ min: 0 }),
  body("headline").optional({ nullable: true }).isString().isLength({ max: 180 }),
  body("summary").optional({ nullable: true }).isString().isLength({ max: 1000 }),
  body("problem").optional({ nullable: true }).isString().isLength({ max: 3000 }),
  body("solution").optional({ nullable: true }).isString().isLength({ max: 3000 }),
  body("outcome").optional({ nullable: true }).isString().isLength({ max: 3000 }),
  body("featuredEvidenceIds").optional().isArray({ max: 12 }), body("featuredSkills").optional().isArray({ max: 12 }),
  body("heroImageUrl").optional({ nullable: true }).isURL({ protocols: ["https"], require_protocol: true }),
], validate, contributionController.updateShowcase);
router.post("/projects/:projectId/showcase/publish", authenticate, [uuid("projectId"), body("revision").isInt({ min: 0 })], validate, contributionController.publishShowcase);
router.post("/projects/:projectId/showcase/unpublish", authenticate, [uuid("projectId"), body("revision").isInt({ min: 0 })], validate, contributionController.unpublishShowcase);

router.get("/projects/:id/tasks", authenticate, [
  uuid("id"), ...pagination, query("status").optional().isIn(["todo", "in_progress", "blocked", "done"]),
  query("priority").optional().isIn(["low", "medium", "high", "urgent"]),
  query("assigneeId").optional().isUUID(), query("milestoneId").optional().isUUID(),
], validate, controller.listTasks);
router.post("/projects/:id/tasks", authenticate, [
  uuid("id"), body("title").isString().trim().isLength({ min: 2, max: 180 }),
  body("priority").optional().isIn(["low", "medium", "high", "urgent"]), body("assigneeIds").optional().isArray({ max: 12 }),
], validate, controller.createTask);
router.get("/project-tasks/:id", authenticate, [uuid("id")], validate, controller.getTask);
router.patch("/project-tasks/:id", authenticate, [
  uuid("id"), body("revision").isInt({ min: 0 }), body("priority").optional().isIn(["low", "medium", "high", "urgent"]),
], validate, controller.updateTask);
router.post("/project-tasks/:id/status", authenticate, [uuid("id"), body("revision").isInt({ min: 0 }), body("status").isIn(["todo", "in_progress", "blocked", "done"])], validate, controller.changeTaskStatus);
router.post("/project-tasks/:id/assignees", authenticate, [uuid("id"), body("revision").isInt({ min: 0 }), body("assigneeIds").isArray({ max: 12 })], validate, controller.setTaskAssignees);
router.delete("/project-tasks/:id/assignees/:userId", authenticate, [uuid("id"), uuid("userId"), body("revision").isInt({ min: 0 })], validate, controller.removeTaskAssignee);

router.get("/projects/:id/milestones", authenticate, [uuid("id")], validate, controller.listMilestones);
router.post("/projects/:id/milestones", authenticate, [uuid("id"), body("name").isString().trim().isLength({ min: 2, max: 140 })], validate, controller.createMilestone);
router.patch("/project-milestones/:id", authenticate, [uuid("id"), body("status").optional().isIn(["planned", "in_progress", "completed"])], validate, controller.updateMilestone);
router.delete("/project-milestones/:id", authenticate, [uuid("id")], validate, controller.deleteMilestone);
router.get("/projects/:id/activity", authenticate, [uuid("id"), ...pagination], validate, controller.listActivity);

module.exports = router;
