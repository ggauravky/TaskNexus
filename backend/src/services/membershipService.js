const mongoose = require("mongoose");
const { Team, TeamMembership } = require("../models");
const teamData = require("../data/teamData");
const { membership: membershipDto } = require("../serializers/teamSerializers");
const authz = require("./teamAuthorization");
const {
  activateMembership, cancelPendingAccess, createActivity, createNotification,
} = require("./teamDomain");
const { errors } = require("../utils/appError");
const { teamErrors } = require("../utils/teamErrors");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { parseListQuery } = require("../utils/queryOptions");
const { paginationMeta } = require("../utils/apiResponse");
const { toApp } = require("../models/helpers");

const listMembers = async (teamId, userId, query) => {
  const team = await authz.getTeam(teamId);
  await authz.requireVisible(team, userId);
  const options = parseListQuery(query, { allowedSorts: ["joined_at"], defaultLimit: 20, maxLimit: 50 });
  const result = await teamData.listMembers(teamId, options);
  const profiles = await teamData.profileSummaries(result.items.map((item) => item.user_id), { publicOnly: true });
  return { items: result.items.map((item) => membershipDto(item, profiles.get(item.user_id))), meta: paginationMeta(result) };
};

const joinOpenTeam = async (teamId, userId) => {
  try {
    await withTransaction(async (session) => {
      const team = await authz.getTeam(teamId, session);
      if (team.join_policy !== "open") throw errors.validation("This team does not allow direct joining");
      const active = await authz.getMembership(teamId, userId, session);
      if (active) throw teamErrors.alreadyMember();
      await activateMembership(session, teamId, userId);
      await cancelPendingAccess(session, teamId, userId);
      await createActivity(session, { team_id: teamId, actor_id: userId, target_user_id: userId, type: "member_joined", metadata: { source: "open" } });
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw teamErrors.alreadyMember();
    throw error;
  }
  return { team_id: teamId, status: "active", role: "member" };
};

const leaveTeam = async (teamId, userId) => withTransaction(async (session) => {
  await authz.getTeam(teamId, session);
  const membership = await authz.requireMember(teamId, userId, session);
  if (membership.role === "owner") throw teamErrors.ownerTransferRequired();
  const row = await TeamMembership.findOneAndUpdate(
    { _id: membership.id, status: "active" },
    { $set: { status: "left", ended_at: new Date() } },
    { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw teamErrors.notMember();
  await createActivity(session, { team_id: teamId, actor_id: userId, target_user_id: userId, type: "member_left" });
  return toApp(row);
});

const changeRole = async (teamId, targetUserId, actorId, role) => withTransaction(async (session) => {
  const team = await authz.getTeam(teamId, session);
  await authz.requireOwner(teamId, actorId, session);
  if (!new Set(["admin", "member"]).has(role)) throw errors.validation("Role must be admin or member");
  const target = await authz.requireMember(teamId, targetUserId, session);
  if (target.role === "owner") throw teamErrors.denied("Ownership changes require the transfer workflow");
  const updated = await TeamMembership.findOneAndUpdate(
    { _id: target.id, status: "active", role: mongoose.trusted({ $ne: "owner" }) },
    { $set: { role } }, { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated) throw teamErrors.notMember();
  if (target.role !== role) {
    await createActivity(session, { team_id: teamId, actor_id: actorId, target_user_id: targetUserId, type: "role_changed", metadata: { from: target.role, to: role } });
    await createNotification(session, {
      recipient_id: targetUserId, actor_id: actorId, type: "team_role_changed", entity_id: teamId,
      content: { title: "Team role updated", message: `Your team role is now ${role}.`, actionUrl: `/teams/${team.slug}` },
      metadata: { role },
    });
  }
  return toApp(updated);
});

const removeMember = async (teamId, targetUserId, actorId) => withTransaction(async (session) => {
  await authz.getTeam(teamId, session);
  const actor = await authz.requireAdmin(teamId, actorId, session);
  const target = await authz.requireMember(teamId, targetUserId, session);
  if (!authz.canManageMember(actor, target)) throw teamErrors.denied("You cannot remove this team member");
  const updated = await TeamMembership.findOneAndUpdate(
    { _id: target.id, status: "active" },
    { $set: { status: "removed", ended_at: new Date() } },
    { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated) throw teamErrors.notMember();
  await createActivity(session, { team_id: teamId, actor_id: actorId, target_user_id: targetUserId, type: "member_removed" });
  await createNotification(session, {
    recipient_id: targetUserId, actor_id: actorId, type: "team_member_removed", entity_id: teamId,
    content: { title: "Removed from team", message: "Your team membership was removed.", actionUrl: "/teams" },
  });
  return toApp(updated);
});

const transferOwnership = async (teamId, targetUserId, actorId) => withTransaction(async (session) => {
  const team = await authz.getTeam(teamId, session);
  const owner = await authz.requireOwner(teamId, actorId, session);
  const target = await authz.requireMember(teamId, targetUserId, session);
  if (target.user_id === actorId || target.role === "owner") throw errors.validation("Select another active member");
  const teamWrite = await Team.updateOne(
    { _id: team.id, status: "active", owner_id: actorId }, { $set: { owner_id: targetUserId } }, { session },
  );
  if (teamWrite.modifiedCount !== 1) throw teamErrors.denied("Ownership changed before this request completed");
  await TeamMembership.updateOne({ _id: owner.id, role: "owner", status: "active" }, { $set: { role: "admin" } }, { session, runValidators: true });
  const targetWrite = await TeamMembership.updateOne({ _id: target.id, status: "active" }, { $set: { role: "owner" } }, { session, runValidators: true });
  if (targetWrite.modifiedCount !== 1) throw teamErrors.notMember();
  await createActivity(session, { team_id: teamId, actor_id: actorId, target_user_id: targetUserId, type: "ownership_transferred" });
  await createNotification(session, {
    recipient_id: targetUserId, actor_id: actorId, type: "team_ownership_transferred", entity_id: teamId,
    content: { title: "Team ownership transferred", message: "You are now the team owner.", actionUrl: `/teams/${team.slug}` },
  });
  return { team_id: teamId, owner_id: targetUserId, previous_owner_role: "admin" };
});

module.exports = { changeRole, joinOpenTeam, leaveTeam, listMembers, removeMember, transferOwnership };
