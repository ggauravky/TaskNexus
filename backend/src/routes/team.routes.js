const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate, optionalAuth } = require("../middleware/auth");
const validate = require("../middleware/validation");
const controller = require("../controllers/teamController");

const router = express.Router();
const teamId = param("id").isUUID().withMessage("Invalid team ID");
const userId = param("userId").isUUID().withMessage("Invalid user ID");
const invitationId = param("invitationId").isUUID().withMessage("Invalid invitation ID");
const globalId = param("id").isUUID().withMessage("Invalid request ID");
const pagination = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 50 })];

router.get("/teams", optionalAuth, pagination, validate, controller.listTeams);
router.post("/teams", authenticate, [
  body("name").isString().trim().isLength({ min: 3, max: 80 }),
  body("slug").optional().isString().trim().isLength({ min: 3, max: 60 }),
  body("visibility").optional().isIn(["public", "private"]),
  body("joinPolicy").optional().isIn(["open", "request", "invite_only"]),
], validate, controller.createTeam);
router.get("/teams/:slug", optionalAuth, [param("slug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)], validate, controller.getTeam);
router.patch("/teams/:id", authenticate, [
  teamId,
  body("name").optional().isString().trim().isLength({ min: 3, max: 80 }),
  body("tagline").optional().isString().isLength({ max: 160 }),
  body("description").optional().isString().isLength({ max: 3000 }),
  body("visibility").optional().isIn(["public", "private"]),
  body("joinPolicy").optional().isIn(["open", "request", "invite_only"]),
  body("primaryInterests").optional().isArray({ max: 12 }),
], validate, controller.updateTeam);
router.post("/teams/:id/archive", authenticate, [teamId], validate, controller.archiveTeam);

router.get("/teams/:id/members", optionalAuth, [teamId, ...pagination], validate, controller.listMembers);
router.post("/teams/:id/join", authenticate, [teamId], validate, controller.joinTeam);
router.post("/teams/:id/leave", authenticate, [teamId], validate, controller.leaveTeam);
router.patch("/teams/:id/members/:userId/role", authenticate, [teamId, userId, body("role").isIn(["admin", "member"])], validate, controller.changeRole);
router.delete("/teams/:id/members/:userId", authenticate, [teamId, userId], validate, controller.removeMember);
router.post("/teams/:id/transfer-ownership", authenticate, [teamId, body("userId").isUUID()], validate, controller.transferOwnership);

router.get("/teams/:id/invitations", authenticate, [teamId, ...pagination], validate, controller.listInvitations);
router.post("/teams/:id/invitations", authenticate, [teamId, body("userId").isUUID(), body("message").optional().isString().isLength({ max: 500 })], validate, controller.sendInvitation);
router.delete("/teams/:id/invitations/:invitationId", authenticate, [teamId, invitationId], validate, controller.cancelInvitation);
router.get("/teams/:id/invite-candidates", authenticate, [teamId, query("search").isString().isLength({ min: 2, max: 80 })], validate, controller.searchCandidates);
router.get("/team-invitations", authenticate, pagination, validate, controller.listInvitationInbox);
router.post("/team-invitations/:id/accept", authenticate, [globalId], validate, controller.acceptInvitation);
router.post("/team-invitations/:id/decline", authenticate, [globalId], validate, controller.declineInvitation);

router.post("/teams/:id/join-requests", authenticate, [teamId, body("message").optional().isString().isLength({ max: 500 })], validate, controller.createJoinRequest);
router.get("/teams/:id/join-requests", authenticate, [teamId, ...pagination], validate, controller.listJoinRequests);
router.get("/team-join-requests", authenticate, pagination, validate, controller.listOwnJoinRequests);
router.post("/team-join-requests/:id/accept", authenticate, [globalId], validate, controller.acceptJoinRequest);
router.post("/team-join-requests/:id/reject", authenticate, [globalId], validate, controller.rejectJoinRequest);
router.delete("/team-join-requests/:id", authenticate, [globalId], validate, controller.cancelJoinRequest);

router.get("/teams/:id/activity", authenticate, [teamId, ...pagination], validate, controller.listActivity);

module.exports = router;
