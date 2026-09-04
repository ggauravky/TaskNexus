const { Team, TeamMembership } = require("../models");
const { toApp } = require("../models/helpers");
const { teamErrors } = require("../utils/teamErrors");

const getTeam = async (teamId, session = null) => {
  const team = toApp(await Team.findOne({ _id: teamId, status: "active" }).session(session).lean());
  if (!team) throw teamErrors.notFound();
  return team;
};

const getMembership = async (teamId, userId, session = null) =>
  toApp(await TeamMembership.findOne({ team_id: teamId, user_id: userId, status: "active" }).session(session).lean());

const requireMember = async (teamId, userId, session = null) => {
  const membership = await getMembership(teamId, userId, session);
  if (!membership) throw teamErrors.notMember();
  return membership;
};

const requireAdmin = async (teamId, userId, session = null) => {
  const membership = await requireMember(teamId, userId, session);
  if (!new Set(["owner", "admin"]).has(membership.role)) throw teamErrors.denied();
  return membership;
};

const requireOwner = async (teamId, userId, session = null) => {
  const membership = await requireMember(teamId, userId, session);
  if (membership.role !== "owner") throw teamErrors.denied("Only the current team owner can perform this action");
  return membership;
};

const requireVisible = async (team, userId) => {
  if (team.visibility === "public") return userId ? getMembership(team.id, userId) : null;
  if (!userId) throw teamErrors.notFound();
  const membership = await getMembership(team.id, userId);
  if (!membership) throw teamErrors.notFound();
  return membership;
};

const canManageMember = (actor, target) => {
  if (!actor || !target || target.role === "owner") return false;
  if (actor.role === "owner") return true;
  return actor.role === "admin" && target.role === "member";
};

module.exports = { canManageMember, getMembership, getTeam, requireAdmin, requireMember, requireOwner, requireVisible };
