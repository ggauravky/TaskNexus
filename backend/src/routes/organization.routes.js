const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/roleCheck");
const {
  applicationStageMutationLimiter, nativeApplicationSubmissionLimiter,
  opportunityCatalogLimiter, organizationInvitationLimiter,
} = require("../middleware/rateLimiter");
const validate = require("../middleware/validation");
const controller = require("../controllers/organizationController");

const router = express.Router();
const uuid = (name) => param(name).isUUID().withMessage(`Invalid ${name}`);
const revision = body("revision").isInt({ min: 0 });
const pagination = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 50 })];

router.post("/admin/organizations/:id/grant-management", authenticate, requireAdmin, opportunityCatalogLimiter, [uuid("id"), body("ownerUserId").isUUID(), revision], validate, controller.grantManagement);

router.get("/organizations/:id/workspace", authenticate, [uuid("id")], validate, controller.workspace);
router.patch("/organizations/:id", authenticate, opportunityCatalogLimiter, [uuid("id"), revision], validate, controller.updateOrganization);
router.get("/organizations/:id/members", authenticate, [...pagination, uuid("id")], validate, controller.listMembers);
router.patch("/organizations/:id/members/:userId/role", authenticate, organizationInvitationLimiter, [uuid("id"), uuid("userId"), body("role").isIn(["admin", "recruiter"])], validate, controller.changeRole);
router.delete("/organizations/:id/members/:userId", authenticate, organizationInvitationLimiter, [uuid("id"), uuid("userId")], validate, controller.removeMember);
router.post("/organizations/:id/transfer-ownership", authenticate, organizationInvitationLimiter, [uuid("id"), body("userId").isUUID()], validate, controller.transferOwnership);
router.post("/organizations/:id/archive-management", authenticate, organizationInvitationLimiter, [uuid("id")], validate, controller.archiveManagement);
router.get("/organizations/:id/invitation-candidates", authenticate, [uuid("id"), query("search").isString().isLength({ min: 2, max: 80 })], validate, controller.searchCandidates);
router.post("/organizations/:id/invitations", authenticate, organizationInvitationLimiter, [uuid("id"), body("userId").isUUID(), body("role").isIn(["admin", "recruiter"]), body("message").optional({ nullable: true }).isString().isLength({ max: 500 })], validate, controller.sendInvitation);
router.get("/organizations/:id/invitations", authenticate, [...pagination, uuid("id"), query("status").optional().isIn(["pending", "accepted", "declined", "cancelled", "expired"])], validate, controller.listInvitations);
router.delete("/organizations/:id/invitations/:invitationId", authenticate, organizationInvitationLimiter, [uuid("id"), uuid("invitationId")], validate, controller.cancelInvitation);
router.get("/organization-invitations", authenticate, pagination, validate, controller.invitationInbox);
router.post("/organization-invitations/:id/accept", authenticate, organizationInvitationLimiter, [uuid("id")], validate, controller.acceptInvitation);
router.post("/organization-invitations/:id/decline", authenticate, organizationInvitationLimiter, [uuid("id")], validate, controller.declineInvitation);

router.post("/organizations/:id/opportunities", authenticate, opportunityCatalogLimiter, [uuid("id"), body("type").isString(), body("title").isString().isLength({ min: 3, max: 180 }), body("slug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), body("workMode").isString(), body("applicationMode").optional().isIn(["external", "tasknexus"]), body("applicationUrl").optional({ nullable: true }).isURL({ protocols: ["https"], require_protocol: true })], validate, controller.createOpportunity);
router.patch("/organizations/:id/opportunities/:opportunityId", authenticate, opportunityCatalogLimiter, [uuid("id"), uuid("opportunityId"), revision], validate, controller.updateOpportunity);
router.post("/organizations/:id/opportunities/:opportunityId/publish", authenticate, opportunityCatalogLimiter, [uuid("id"), uuid("opportunityId"), revision], validate, controller.publishOpportunity);
router.post("/organizations/:id/opportunities/:opportunityId/close", authenticate, opportunityCatalogLimiter, [uuid("id"), uuid("opportunityId"), revision], validate, controller.closeOpportunity);
router.post("/organizations/:id/opportunities/:opportunityId/archive", authenticate, opportunityCatalogLimiter, [uuid("id"), uuid("opportunityId"), revision], validate, controller.archiveOpportunity);

router.get("/native-applications/eligible-projects", authenticate, controller.eligibleProjects);
router.post("/opportunities/:id/applications", authenticate, nativeApplicationSubmissionLimiter, [uuid("id"), body("consent").custom((value) => value === true).withMessage("Application consent is required"), body("coverNote").optional({ nullable: true }).isString().isLength({ max: 2000 }), body("selectedProjectIds").optional().isArray({ max: 5 }), body("selectedEvidenceIds").optional().isArray({ max: 12 })], validate, controller.submitApplication);
router.get("/native-applications/me", authenticate, [...pagination, query("stage").optional().isString()], validate, controller.listMyApplications);
router.get("/native-applications/:id", authenticate, [uuid("id")], validate, controller.myApplicationDetail);
router.post("/native-applications/:id/withdraw", authenticate, nativeApplicationSubmissionLimiter, [uuid("id"), revision], validate, controller.withdrawApplication);
router.get("/organizations/:id/applications", authenticate, [...pagination, uuid("id"), query("stage").optional().isString()], validate, controller.listApplicants);
router.get("/organizations/:id/opportunities/:opportunityId/applications", authenticate, [...pagination, uuid("id"), uuid("opportunityId"), query("stage").optional().isString()], validate, controller.listOpportunityApplicants);
router.get("/organizations/:id/applications/:applicationId", authenticate, [uuid("id"), uuid("applicationId")], validate, controller.applicantDetail);
router.post("/native-applications/:id/stage", authenticate, applicationStageMutationLimiter, [uuid("id"), revision, body("stage").isString()], validate, controller.changeApplicationStage);

module.exports = router;
