const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const {
  AuditLog, NativeApplication, Notification, Opportunity, Organization,
  OrganizationInvitation, OrganizationMembership, User,
} = require("../models");
const { toApp, toApps } = require("../models/helpers");
const { errors } = require("../utils/appError");
const { paginationMeta } = require("../utils/apiResponse");
const { parseListQuery } = require("../utils/queryOptions");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const teamData = require("../data/teamData");
const { discoverPeople } = require("./discoveryService");
const authz = require("./organizationAuthorization");
const { invitationDto, memberDto, organizationPermissions } = require("../serializers/organizationSerializers");
const opportunityService = require("./opportunityService");

const trustedIn = (values) => mongoose.trusted({ $in: values });
const textValue = (value, max, label) => {
  const result = String(value || "").trim();
  if (result.length > max || /[<>]/.test(result)) throw errors.validation(`${label} must be plain text and at most ${max} characters`);
  return result || null;
};
const revisionValue = (value) => {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) throw errors.validation("Revision is required");
  return revision;
};

const createAudit = (session, data) => AuditLog.create([{
  _id: randomUUID(), timestamp: new Date(), changes: {}, ...data,
}], { session });

const createNotification = (session, data) => Notification.create([{
  _id: randomUUID(), entity_type: "organization", status: "unread", priority: "medium", ...data,
}], { session });

const activateMembership = async (session, organizationId, userId, role) => {
  const existing = await OrganizationMembership.findOne({ organization_id: organizationId, user_id: userId }).session(session).lean();
  if (existing?.status === "active") throw errors.conflict("User is already an active Organization member");
  if (existing) {
    const row = await OrganizationMembership.findOneAndUpdate(
      { _id: existing._id, status: mongoose.trusted({ $ne: "active" }) },
      { $set: { role, status: "active", joined_at: new Date(), ended_at: null } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!row) throw errors.conflict("Organization membership changed; refresh and try again");
    return row;
  }
  const [row] = await OrganizationMembership.create([{
    _id: randomUUID(), organization_id: organizationId, user_id: userId, role, status: "active", joined_at: new Date(),
  }], { session });
  return row;
};

const grantManagement = async (organizationId, actorId, input) => {
  const ownerUserId = String(input.ownerUserId || "");
  if (!ownerUserId) throw errors.validation("Owner user is required");
  const revision = revisionValue(input.revision);
  try {
    return await withTransaction(async (session) => {
      const user = await User.findOne({ _id: ownerUserId, status: "active" }).session(session).select("_id").lean();
      if (!user) throw errors.notFound("Eligible owner user not found");
      const organization = await Organization.findOneAndUpdate(
        { _id: organizationId, status: "active", management_mode: mongoose.trusted({ $in: ["platform_managed", null] }), owner_id: null, revision },
        { $set: { management_mode: "organization_managed", owner_id: ownerUserId }, $inc: { revision: 1 } },
        { session, returnDocument: "after", runValidators: true },
      ).lean();
      if (!organization) throw errors.conflict("Organization management changed; refresh before assigning an owner");
      await activateMembership(session, organizationId, ownerUserId, "owner");
      await createAudit(session, { user_id: actorId, action: "organization.management_granted", resource: "organization", resource_id: organizationId, changes: { owner_id: ownerUserId } });
      await createNotification(session, {
        recipient_id: ownerUserId, actor_id: actorId, type: "organization_role_changed", entity_id: organizationId,
        content: { title: "Organization management granted", message: `You are now the owner of ${organization.name}.`, actionUrl: `/organizations/${organization.slug}/workspace` },
      });
      return { organization_id: organizationId, owner_id: ownerUserId, management_mode: "organization_managed", revision: organization.revision };
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("This Organization already has an active owner");
    throw error;
  }
};

const listMembers = async (organizationId, actorId, query = {}) => {
  await authz.getOrganization(organizationId);
  await authz.requireMember(organizationId, actorId);
  const options = parseListQuery(query, { allowedSorts: ["joined_at"], defaultLimit: 20, maxLimit: 50 });
  const filter = { organization_id: organizationId, status: "active" };
  const [rows, total] = await Promise.all([
    OrganizationMembership.find(filter).sort({ role: 1, joined_at: 1, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    OrganizationMembership.countDocuments(filter),
  ]);
  const items = toApps(rows);
  const profiles = await teamData.profileSummaries(items.map((item) => item.user_id), { publicOnly: false });
  return { items: items.map((item) => memberDto(item, profiles.get(item.user_id))), meta: paginationMeta({ ...options, total }) };
};

const sendInvitation = async (organizationId, actorId, input) => {
  const invitedUserId = String(input.userId || "");
  const role = String(input.role || "recruiter");
  if (!invitedUserId) throw errors.validation("Invited user is required");
  if (!new Set(["admin", "recruiter"]).has(role)) throw errors.validation("Invitation role must be admin or recruiter");
  if (invitedUserId === actorId) throw errors.validation("You cannot invite yourself");
  try {
    const invitationId = await withTransaction(async (session) => {
      const organization = await authz.getOrganization(organizationId, session);
      const actor = await authz.requireManager(organizationId, actorId, session);
      if (actor.role === "admin" && role !== "recruiter") throw errors.forbidden("Organization admins may invite recruiters only");
      if (await authz.getMembership(organizationId, invitedUserId, session)) throw errors.conflict("User is already an active Organization member");
      const user = await User.findOne({ _id: invitedUserId, status: "active" }).session(session).select("_id").lean();
      if (!user) throw errors.notFound("Eligible user not found");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const [invitation] = await OrganizationInvitation.create([{
        _id: randomUUID(), organization_id: organizationId, invited_user_id: invitedUserId, invited_by: actorId,
        role, status: "pending", message: textValue(input.message, 500, "Invitation message"), expires_at: expiresAt,
      }], { session });
      await createAudit(session, { user_id: actorId, action: "organization.invitation_sent", resource: "organization_invitation", resource_id: invitation._id, changes: { organization_id: organizationId, invited_user_id: invitedUserId, role } });
      await createNotification(session, {
        recipient_id: invitedUserId, actor_id: actorId, type: "organization_invitation", entity_id: organizationId,
        content: { title: `Invitation to ${organization.name}`, message: `You were invited as ${role}.`, actionUrl: "/organization-invitations" },
        metadata: { invitation_id: invitation._id },
      });
      return invitation._id;
    });
    return invitationDto(toApp(await OrganizationInvitation.findById(invitationId).lean()));
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("A pending Organization invitation already exists for this user");
    throw error;
  }
};

const listInvitations = async (organizationId, actorId, query = {}) => {
  await authz.requireManager(organizationId, actorId);
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 20, maxLimit: 50 });
  const status = query.status || "pending";
  const filter = { organization_id: organizationId, status };
  const [rows, total] = await Promise.all([
    OrganizationInvitation.find(filter).sort({ created_at: -1, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    OrganizationInvitation.countDocuments(filter),
  ]);
  const items = toApps(rows);
  const profiles = await teamData.profileSummaries(items.flatMap((item) => [item.invited_user_id, item.invited_by]), { publicOnly: false });
  return { items: items.map((item) => invitationDto(item, { invitedUser: profiles.get(item.invited_user_id), invitedByUser: profiles.get(item.invited_by) })), meta: paginationMeta({ ...options, total }) };
};

const listInvitationInbox = async (userId, query = {}) => {
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 20, maxLimit: 50 });
  await OrganizationInvitation.updateMany({ invited_user_id: userId, status: "pending", expires_at: mongoose.trusted({ $lte: new Date() }) }, { $set: { status: "expired", responded_at: new Date() } });
  const filter = { invited_user_id: userId, status: "pending" };
  const [rows, total] = await Promise.all([
    OrganizationInvitation.find(filter).sort({ created_at: -1, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    OrganizationInvitation.countDocuments(filter),
  ]);
  const items = toApps(rows);
  const organizations = toApps(await Organization.find({ _id: trustedIn(items.map((item) => item.organization_id)), status: "active" }).select("_id name slug logo_url").lean());
  const orgMap = new Map(organizations.map((item) => [item.id, item]));
  const profiles = await teamData.profileSummaries(items.map((item) => item.invited_by), { publicOnly: false });
  return { items: items.map((item) => invitationDto(item, { organization: orgMap.get(item.organization_id), invitedByUser: profiles.get(item.invited_by) })).filter((item) => item.organization), meta: paginationMeta({ ...options, total }) };
};

const respondInvitation = async (invitationId, userId, action) => {
  if (!new Set(["accepted", "declined"]).has(action)) throw errors.validation("Invalid invitation response");
  try {
    return await withTransaction(async (session) => {
      const invitation = await OrganizationInvitation.findOneAndUpdate(
        { _id: invitationId, invited_user_id: userId, status: "pending", expires_at: mongoose.trusted({ $gt: new Date() }) },
        { $set: { status: action, responded_at: new Date() } },
        { session, returnDocument: "before" },
      ).lean();
      if (!invitation) throw errors.notFound("Pending Organization invitation not found");
      const organization = await authz.getOrganization(invitation.organization_id, session);
      if (action === "accepted") {
        await activateMembership(session, organization.id, userId, invitation.role);
        await createAudit(session, { user_id: userId, action: "organization.invitation_accepted", resource: "organization_invitation", resource_id: invitationId, changes: { organization_id: organization.id, role: invitation.role } });
        await createNotification(session, {
          recipient_id: invitation.invited_by, actor_id: userId, type: "organization_invitation_accepted", entity_id: organization.id,
          content: { title: "Organization invitation accepted", message: `A new ${invitation.role} joined ${organization.name}.`, actionUrl: `/organizations/${organization.slug}/workspace` },
        });
      }
      return { id: invitationId, status: action, organization_slug: organization.slug };
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("User is already an active Organization member");
    throw error;
  }
};

const cancelInvitation = async (organizationId, invitationId, actorId) => withTransaction(async (session) => {
  await authz.requireManager(organizationId, actorId, session);
  const invitation = await OrganizationInvitation.findOneAndUpdate(
    { _id: invitationId, organization_id: organizationId, status: "pending" },
    { $set: { status: "cancelled", responded_at: new Date() } },
    { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!invitation) throw errors.notFound("Pending Organization invitation not found");
  await createAudit(session, { user_id: actorId, action: "organization.invitation_cancelled", resource: "organization_invitation", resource_id: invitationId });
  return invitationDto(toApp(invitation));
});

const changeRole = async (organizationId, targetUserId, actorId, role) => withTransaction(async (session) => {
  if (!new Set(["admin", "recruiter"]).has(role)) throw errors.validation("Role must be admin or recruiter");
  await authz.requireOwner(organizationId, actorId, session);
  const target = await authz.requireMember(organizationId, targetUserId, session);
  if (target.role === "owner") throw errors.forbidden("Ownership changes require the transfer workflow");
  const row = await OrganizationMembership.findOneAndUpdate(
    { _id: target.id, status: "active", role: mongoose.trusted({ $ne: "owner" }) }, { $set: { role } },
    { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw errors.conflict("Organization membership changed; refresh and try again");
  await createAudit(session, { user_id: actorId, action: "organization.role_changed", resource: "organization_membership", resource_id: target.id, changes: { from: target.role, to: role } });
  await createNotification(session, { recipient_id: targetUserId, actor_id: actorId, type: "organization_role_changed", entity_id: organizationId, content: { title: "Organization role updated", message: `Your Organization role is now ${role}.`, actionUrl: "/organizations" } });
  return memberDto(toApp(row));
});

const removeMember = async (organizationId, targetUserId, actorId) => withTransaction(async (session) => {
  const actor = await authz.requireManager(organizationId, actorId, session);
  const target = await authz.requireMember(organizationId, targetUserId, session);
  if (!authz.canManageMember(actor, target)) throw errors.forbidden("You cannot remove this Organization member");
  const row = await OrganizationMembership.findOneAndUpdate(
    { _id: target.id, status: "active", role: mongoose.trusted({ $ne: "owner" }) },
    { $set: { status: "removed", ended_at: new Date() } },
    { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw errors.conflict("Organization membership changed; refresh and try again");
  await createAudit(session, { user_id: actorId, action: "organization.member_removed", resource: "organization_membership", resource_id: target.id, changes: { user_id: targetUserId } });
  return memberDto(toApp(row));
});

const transferOwnership = async (organizationId, targetUserId, actorId) => {
  if (targetUserId === actorId) throw errors.validation("Select another active Organization member");
  try {
    return await withTransaction(async (session) => {
      const organization = await authz.getOrganization(organizationId, session);
      const owner = await authz.requireOwner(organizationId, actorId, session);
      const target = await authz.requireMember(organizationId, targetUserId, session);
      if (target.role === "owner") throw errors.validation("Select another active Organization member");
      const organizationWrite = await Organization.updateOne(
        { _id: organizationId, owner_id: actorId, management_mode: "organization_managed", status: "active" },
        { $set: { owner_id: targetUserId }, $inc: { revision: 1 } }, { session },
      );
      if (organizationWrite.modifiedCount !== 1) throw errors.conflict("Organization ownership changed before this request completed");
      const oldWrite = await OrganizationMembership.updateOne({ _id: owner.id, role: "owner", status: "active" }, { $set: { role: "admin" } }, { session, runValidators: true });
      if (oldWrite.modifiedCount !== 1) throw errors.conflict("Organization ownership changed before this request completed");
      const targetWrite = await OrganizationMembership.updateOne({ _id: target.id, status: "active", role: mongoose.trusted({ $ne: "owner" }) }, { $set: { role: "owner" } }, { session, runValidators: true });
      if (targetWrite.modifiedCount !== 1) throw errors.conflict("Target Organization member changed before this request completed");
      await createAudit(session, { user_id: actorId, action: "organization.ownership_transferred", resource: "organization", resource_id: organizationId, changes: { from: actorId, to: targetUserId } });
      await createNotification(session, { recipient_id: targetUserId, actor_id: actorId, type: "organization_ownership_transferred", entity_id: organizationId, content: { title: "Organization ownership transferred", message: `You are now the owner of ${organization.name}.`, actionUrl: `/organizations/${organization.slug}/workspace` } });
      return { organization_id: organizationId, owner_id: targetUserId, previous_owner_role: "admin" };
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("Organization ownership changed before this request completed");
    throw error;
  }
};

const archiveManagement = async (organizationId, actorId) => withTransaction(async (session) => {
  await authz.requireOwner(organizationId, actorId, session);
  const write = await Organization.updateOne(
    { _id: organizationId, owner_id: actorId, management_mode: "organization_managed", status: "active" },
    { $set: { management_mode: "platform_managed", owner_id: null }, $inc: { revision: 1 } }, { session },
  );
  if (write.modifiedCount !== 1) throw errors.conflict("Organization management changed; refresh and try again");
  await OrganizationMembership.updateMany({ organization_id: organizationId, status: "active" }, { $set: { status: "removed", ended_at: new Date() } }, { session });
  await OrganizationInvitation.updateMany({ organization_id: organizationId, status: "pending" }, { $set: { status: "cancelled", responded_at: new Date() } }, { session });
  await createAudit(session, { user_id: actorId, action: "organization.management_archived", resource: "organization", resource_id: organizationId });
  return { organization_id: organizationId, management_mode: "platform_managed" };
});

const getWorkspace = async (organizationId, actorId) => {
  const organization = await authz.getOrganization(organizationId);
  const membership = await authz.requireMember(organizationId, actorId);
  const [memberCount, opportunityCount, applicantCount, stages, opportunities] = await Promise.all([
    OrganizationMembership.countDocuments({ organization_id: organizationId, status: "active" }),
    Opportunity.countDocuments({ organization_id: organizationId, source_type: "organization_owned", status: mongoose.trusted({ $ne: "archived" }) }),
    NativeApplication.countDocuments({ organization_id: organizationId }),
    NativeApplication.aggregate([{ $match: { organization_id: organizationId } }, { $group: { _id: "$stage", count: { $sum: 1 } } }]),
    Opportunity.find({ organization_id: organizationId, source_type: "organization_owned", status: mongoose.trusted({ $ne: "archived" }) })
      .sort({ updated_at: -1, _id: 1 }).limit(50).select("_id title slug type summary status application_mode application_deadline published_at revision updated_at").lean(),
  ]);
  const counts = await NativeApplication.aggregate([{ $match: { opportunity_id: trustedIn(opportunities.map((item) => String(item._id))) } }, { $group: { _id: "$opportunity_id", count: { $sum: 1 } } }]);
  const countMap = new Map(counts.map((item) => [item._id, item.count]));
  return {
    organization: { id: organization.id, name: organization.name, slug: organization.slug, tagline: organization.tagline || null, logo_url: organization.logo_url || null, management_mode: organization.management_mode, owner_id: organization.owner_id, revision: organization.revision },
    membership: memberDto(membership), permissions: organizationPermissions(membership.role),
    metrics: { members: memberCount, opportunities: opportunityCount, applicants: applicantCount, stages: Object.fromEntries(stages.map((item) => [item._id, item.count])) },
    opportunities: opportunities.map((item) => ({ id: String(item._id), title: item.title, slug: item.slug, type: item.type, summary: item.summary || null, status: item.status, application_mode: item.application_mode, application_deadline: item.application_deadline || null, published_at: item.published_at || null, updated_at: item.updated_at, revision: item.revision, applicant_count: countMap.get(String(item._id)) || 0 })),
  };
};

const searchCandidates = async (organizationId, actorId, query = {}) => {
  await authz.requireManager(organizationId, actorId);
  const search = String(query.search || "").trim().slice(0, 80);
  if (search.length < 2) return [];
  const discovered = await discoverPeople(actorId, { search, limit: 30, availability: "open,limited" });
  const ids = discovered.items.map((item) => item.id);
  const [memberships, invitations] = await Promise.all([
    OrganizationMembership.find({ organization_id: organizationId, user_id: trustedIn(ids), status: "active" }).select("user_id").lean(),
    OrganizationInvitation.find({ organization_id: organizationId, invited_user_id: trustedIn(ids), status: "pending" }).select("invited_user_id").lean(),
  ]);
  const excluded = new Set([...memberships.map((item) => item.user_id), ...invitations.map((item) => item.invited_user_id)]);
  return discovered.items.filter((item) => !excluded.has(item.id)).slice(0, 20);
};

const updateDetails = async (organizationId, actorId, input) => {
  await authz.requireManager(organizationId, actorId);
  return opportunityService.updateOrganization(organizationId, actorId, input);
};

module.exports = {
  archiveManagement, cancelInvitation, changeRole, getWorkspace, grantManagement, listInvitationInbox,
  listInvitations, listMembers, removeMember, respondInvitation, searchCandidates, sendInvitation, transferOwnership,
  updateDetails,
};
