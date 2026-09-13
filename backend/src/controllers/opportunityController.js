const service = require("../services/opportunityService");
const { sendSuccess } = require("../utils/apiResponse");

const action = (handler) => async (req, res, next) => { try { return await handler(req, res); } catch (error) { return next(error); } };

exports.listOrganizations = action(async (req, res) => { const result = await service.listOrganizations(req.query); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.organizationDetail = action(async (req, res) => sendSuccess(res, { data: await service.getOrganization(req.params.slug, req.userId) }));
exports.createOrganization = action(async (req, res) => sendSuccess(res, { status: 201, data: await service.createOrganization(req.userId, req.body), message: "Organization created" }));
exports.updateOrganization = action(async (req, res) => sendSuccess(res, { data: await service.updateOrganization(req.params.id, req.userId, req.body), message: "Organization updated" }));
exports.verifyOrganization = action(async (req, res) => sendSuccess(res, { data: await service.verifyOrganization(req.params.id, req.userId, req.body), message: "Organization verification updated" }));

exports.listOpportunities = action(async (req, res) => { const result = await service.listOpportunities(req.query, req.userId); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.opportunityDetail = action(async (req, res) => sendSuccess(res, { data: await service.getOpportunity(req.params.slug, req.userId, req.userRole) }));
exports.createOpportunity = action(async (req, res) => sendSuccess(res, { status: 201, data: await service.createOpportunity(req.userId, req.body), message: "Opportunity created as a draft" }));
exports.updateOpportunity = action(async (req, res) => sendSuccess(res, { data: await service.updateOpportunity(req.params.id, req.userId, req.body), message: "Opportunity updated" }));
exports.publishOpportunity = action(async (req, res) => sendSuccess(res, { data: await service.publishOpportunity(req.params.id, req.userId, req.body), message: "Opportunity published" }));
exports.closeOpportunity = action(async (req, res) => sendSuccess(res, { data: await service.closeOpportunity(req.params.id, req.userId, req.body), message: "Opportunity closed" }));
exports.archiveOpportunity = action(async (req, res) => sendSuccess(res, { data: await service.archiveOpportunity(req.params.id, req.userId, req.body), message: "Opportunity archived" }));

exports.listSaved = action(async (req, res) => { const result = await service.listSaved(req.userId, req.query); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.save = action(async (req, res) => sendSuccess(res, { status: 201, data: await service.saveOpportunity(req.params.id, req.userId), message: "Opportunity saved" }));
exports.unsave = action(async (req, res) => sendSuccess(res, { data: await service.unsaveOpportunity(req.params.id, req.userId), message: "Opportunity removed from saved items" }));
exports.listApplications = action(async (req, res) => { const result = await service.listApplications(req.userId, req.query); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.saveApplication = action(async (req, res) => sendSuccess(res, { data: await service.saveApplication(req.params.id, req.userId, req.body), message: "Application tracking updated" }));
exports.deleteApplication = action(async (req, res) => sendSuccess(res, { data: await service.deleteApplication(req.params.id, req.userId, req.body), message: "Application tracking removed" }));
