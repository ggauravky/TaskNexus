const { Organization, OrganizationMembership } = require("../models");
const { toApp } = require("../models/helpers");
const { errors } = require("../utils/appError");

const getOrganization = async (organizationId, session = null) => {
  const organization = toApp(await Organization.findOne({ _id: organizationId, status: "active" }).session(session).lean());
  if (!organization) throw errors.notFound("Organization not found");
  return organization;
};

const getMembership = async (organizationId, userId, session = null) =>
  toApp(await OrganizationMembership.findOne({ organization_id: organizationId, user_id: userId, status: "active" }).session(session).lean());

const requireMember = async (organizationId, userId, session = null) => {
  const membership = await getMembership(organizationId, userId, session);
  if (!membership) throw errors.forbidden("Active Organization membership required");
  return membership;
};

const requireManager = async (organizationId, userId, session = null) => {
  const membership = await requireMember(organizationId, userId, session);
  if (!new Set(["owner", "admin"]).has(membership.role)) throw errors.forbidden("Organization owner or admin access required");
  return membership;
};

const requireOwner = async (organizationId, userId, session = null) => {
  const membership = await requireMember(organizationId, userId, session);
  if (membership.role !== "owner") throw errors.forbidden("Only the current Organization owner can perform this action");
  return membership;
};

const canManageMember = (actor, target) => Boolean(actor && target && target.role !== "owner" && (
  actor.role === "owner" || (actor.role === "admin" && target.role === "recruiter")
));

module.exports = { canManageMember, getMembership, getOrganization, requireManager, requireMember, requireOwner };
