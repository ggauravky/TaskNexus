const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticate, optionalAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/roleCheck");
const { opportunitySearchLimiter, opportunityCandidateMutationLimiter, opportunityCatalogLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validation");
const controller = require("../controllers/opportunityController");

const router = express.Router(); const uuid = (name) => param(name).isUUID().withMessage(`Invalid ${name}`);
const pagination = [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 50 })];
const revision = body("revision").isInt({ min: 0 });
const slug = param("slug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

router.get("/organizations", opportunitySearchLimiter, [...pagination, query("search").optional().isString().isLength({ max: 200 })], validate, controller.listOrganizations);
router.get("/organizations/:slug", opportunitySearchLimiter, [slug], validate, controller.organizationDetail);
router.post("/admin/organizations", authenticate, requireAdmin, opportunityCatalogLimiter, [body("name").isString().isLength({ min: 2, max: 160 }), body("slug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), body("organizationType").isString()], validate, controller.createOrganization);
router.patch("/admin/organizations/:id", authenticate, requireAdmin, opportunityCatalogLimiter, [uuid("id"), revision], validate, controller.updateOrganization);
router.post("/admin/organizations/:id/verify", authenticate, requireAdmin, opportunityCatalogLimiter, [uuid("id"), revision, body("verified").optional().isBoolean()], validate, controller.verifyOrganization);

router.get("/opportunities", optionalAuth, opportunitySearchLimiter, [...pagination, query("search").optional().isString().isLength({ max: 200 }), query("type").optional().isString(), query("workMode").optional().isString(), query("organization").optional().isUUID(), query("skills").optional().isString().isLength({ max: 500 }), query("location").optional().isString().isLength({ max: 100 }), query("graduationYear").optional().isInt({ min: 1950, max: 2200 }), query("freshersAllowed").optional().isBoolean(), query("compensationDisclosed").optional().isBoolean(), query("sortBy").optional().isIn(["published_at", "application_deadline", "last_verified_at"])], validate, controller.listOpportunities);
router.get("/opportunities/me/saved", authenticate, [...pagination], validate, controller.listSaved);
router.get("/applications", authenticate, [...pagination, query("status").optional().isString()], validate, controller.listApplications);
router.get("/opportunities/:slug", optionalAuth, opportunitySearchLimiter, [slug], validate, controller.opportunityDetail);

router.post("/admin/opportunities", authenticate, requireAdmin, opportunityCatalogLimiter, [body("organizationId").isUUID(), body("type").isString(), body("title").isString().isLength({ min: 3, max: 180 }), body("slug").matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), body("workMode").isString(), body("applicationUrl").isURL({ protocols: ["https"], require_protocol: true }), body("sourceType").isString()], validate, controller.createOpportunity);
router.patch("/admin/opportunities/:id", authenticate, requireAdmin, opportunityCatalogLimiter, [uuid("id"), revision], validate, controller.updateOpportunity);
router.post("/admin/opportunities/:id/publish", authenticate, requireAdmin, opportunityCatalogLimiter, [uuid("id"), revision], validate, controller.publishOpportunity);
router.post("/admin/opportunities/:id/close", authenticate, requireAdmin, opportunityCatalogLimiter, [uuid("id"), revision], validate, controller.closeOpportunity);
router.post("/admin/opportunities/:id/archive", authenticate, requireAdmin, opportunityCatalogLimiter, [uuid("id"), revision], validate, controller.archiveOpportunity);

router.post("/opportunities/:id/save", authenticate, opportunityCandidateMutationLimiter, [uuid("id")], validate, controller.save);
router.delete("/opportunities/:id/save", authenticate, opportunityCandidateMutationLimiter, [uuid("id")], validate, controller.unsave);
router.put("/opportunities/:id/application", authenticate, opportunityCandidateMutationLimiter, [uuid("id"), body("status").isString(), body("revision").optional().isInt({ min: 0 }), body("notes").optional({ nullable: true }).isString().isLength({ max: 2000 })], validate, controller.saveApplication);
router.delete("/opportunities/:id/application", authenticate, opportunityCandidateMutationLimiter, [uuid("id"), revision], validate, controller.deleteApplication);

module.exports = router;
