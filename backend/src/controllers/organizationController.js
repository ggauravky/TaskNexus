const organizationService = require("../services/organizationService");
const opportunityService = require("../services/opportunityService");
const applicationService = require("../services/nativeApplicationService");
const { sendSuccess } = require("../utils/apiResponse");

const action = (handler) => async (req, res, next) => { try { return await handler(req, res); } catch (error) { return next(error); } };

exports.grantManagement = action(async (req, res) => sendSuccess(res, { data: await organizationService.grantManagement(req.params.id, req.userId, req.body), message: "Organization management granted" }));
exports.workspace = action(async (req, res) => sendSuccess(res, { data: await organizationService.getWorkspace(req.params.id, req.userId) }));
exports.updateOrganization = action(async (req, res) => sendSuccess(res, { data: await organizationService.updateDetails(req.params.id, req.userId, req.body), message: "Organization updated" }));
exports.listMembers = action(async (req, res) => { const result = await organizationService.listMembers(req.params.id, req.userId, req.query); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.changeRole = action(async (req, res) => sendSuccess(res, { data: await organizationService.changeRole(req.params.id, req.params.userId, req.userId, req.body.role), message: "Organization role updated" }));
exports.removeMember = action(async (req, res) => sendSuccess(res, { data: await organizationService.removeMember(req.params.id, req.params.userId, req.userId), message: "Organization member removed" }));
exports.transferOwnership = action(async (req, res) => sendSuccess(res, { data: await organizationService.transferOwnership(req.params.id, req.body.userId, req.userId), message: "Organization ownership transferred" }));
exports.archiveManagement = action(async (req, res) => sendSuccess(res, { data: await organizationService.archiveManagement(req.params.id, req.userId), message: "Organization management archived" }));
exports.sendInvitation = action(async (req, res) => sendSuccess(res, { status: 201, data: await organizationService.sendInvitation(req.params.id, req.userId, req.body), message: "Organization invitation sent" }));
exports.listInvitations = action(async (req, res) => { const result = await organizationService.listInvitations(req.params.id, req.userId, req.query); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.cancelInvitation = action(async (req, res) => sendSuccess(res, { data: await organizationService.cancelInvitation(req.params.id, req.params.invitationId, req.userId), message: "Organization invitation cancelled" }));
exports.invitationInbox = action(async (req, res) => { const result = await organizationService.listInvitationInbox(req.userId, req.query); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.acceptInvitation = action(async (req, res) => sendSuccess(res, { data: await organizationService.respondInvitation(req.params.id, req.userId, "accepted"), message: "Organization invitation accepted" }));
exports.declineInvitation = action(async (req, res) => sendSuccess(res, { data: await organizationService.respondInvitation(req.params.id, req.userId, "declined"), message: "Organization invitation declined" }));
exports.searchCandidates = action(async (req, res) => sendSuccess(res, { data: await organizationService.searchCandidates(req.params.id, req.userId, req.query) }));

exports.createOpportunity = action(async (req, res) => sendSuccess(res, { status: 201, data: await opportunityService.createManagedOpportunity(req.params.id, req.userId, req.body), message: "Organization Opportunity created" }));
exports.updateOpportunity = action(async (req, res) => sendSuccess(res, { data: await opportunityService.updateManagedOpportunity(req.params.id, req.params.opportunityId, req.userId, req.body), message: "Organization Opportunity updated" }));
exports.publishOpportunity = action(async (req, res) => sendSuccess(res, { data: await opportunityService.publishManagedOpportunity(req.params.id, req.params.opportunityId, req.userId, req.body), message: "Organization Opportunity published" }));
exports.closeOpportunity = action(async (req, res) => sendSuccess(res, { data: await opportunityService.closeManagedOpportunity(req.params.id, req.params.opportunityId, req.userId, req.body), message: "Organization Opportunity closed" }));
exports.archiveOpportunity = action(async (req, res) => sendSuccess(res, { data: await opportunityService.archiveManagedOpportunity(req.params.id, req.params.opportunityId, req.userId, req.body), message: "Organization Opportunity archived" }));

exports.eligibleProjects = action(async (req, res) => sendSuccess(res, { data: await applicationService.listEligibleProjects(req.userId) }));
exports.submitApplication = action(async (req, res) => sendSuccess(res, { status: 201, data: await applicationService.submit(req.params.id, req.userId, req.body), message: "TaskNexus application submitted" }));
exports.listMyApplications = action(async (req, res) => { const result = await applicationService.listMine(req.userId, req.query); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.myApplicationDetail = action(async (req, res) => sendSuccess(res, { data: await applicationService.getCandidateDetail(req.params.id, req.userId) }));
exports.withdrawApplication = action(async (req, res) => sendSuccess(res, { data: await applicationService.withdraw(req.params.id, req.userId, req.body), message: "Application withdrawn" }));
exports.listApplicants = action(async (req, res) => { const result = await applicationService.listForOrganization(req.params.id, req.userId, req.query); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.listOpportunityApplicants = action(async (req, res) => { const result = await applicationService.listForOrganization(req.params.id, req.userId, req.query, req.params.opportunityId); return sendSuccess(res, { data: result.items, meta: result.meta }); });
exports.applicantDetail = action(async (req, res) => sendSuccess(res, { data: await applicationService.getForOrganization(req.params.applicationId, req.userId, req.params.id) }));
exports.changeApplicationStage = action(async (req, res) => sendSuccess(res, { data: await applicationService.changeStage(req.params.id, req.userId, req.body), message: "Application stage updated" }));
