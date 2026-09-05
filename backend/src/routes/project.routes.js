const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate, optionalAuth } = require("../middleware/auth");
const validate = require("../middleware/validation");
const controller = require("../controllers/projectController");

const router = express.Router();
const uuid = (name) => param(name).isUUID().withMessage(`Invalid ${name}`);
const pagination = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 })];
const slug = (name) => param(name).matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage(`Invalid ${name}`);

router.get("/projects", authenticate, [
  ...pagination, query("status").optional().isIn(["planning", "active", "completed"]),
  query("role").optional().isIn(["lead", "contributor"]), query("search").optional().isString().isLength({ max: 200 }),
], validate, controller.listMyProjects);
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
