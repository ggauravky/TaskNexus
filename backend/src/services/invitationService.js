const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const { Team, TeamInvitation, TeamMembership, User, UserProfile, UserSkill, Skill } = require("../models");
const { escapeRegex } = require("../data/mongoDataUtils");
const teamData = require("../data/teamData");
const authz = require("./teamAuthorization");
const {
  activateMembership, cancelPendingAccess, createActivity, createNotification,
} = require("./teamDomain");
const { errors } = require("../utils/appError");
const { teamErrors } = require("../utils/teamErrors");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { parseListQuery } = require("../utils/queryOptions");
const { paginationMeta } = require("../utils/apiResponse");
const { toApp, toApps } = require("../models/helpers");

const messageValue = (value) => {
  const message = String(value || "").trim();
  if (message.length > 500 || /[<>]/.test(message)) throw errors.validation("Invitation message must be plain text and at most 500 characters");
  return message || null;
};

const sendInvitation = async (teamId, actorId, input) => {
  const invitedUserId = String(input.userId || input.invited_user_id || "");
  if (!invitedUserId) throw errors.validation("An invited user is required");
  try {
    const invitationId = await withTransaction(async (session) => {
      const team = await authz.getTeam(teamId, session);
      await authz.requireAdmin(teamId, actorId, session);
      const user = await User.findOne({ _id: invitedUserId, status: "active" }).session(session).lean();
      if (!user) throw errors.notFound("Eligible user not found");
      if (await authz.getMembership(teamId, invitedUserId, session)) throw teamErrors.alreadyMember();
      const [invitation] = await TeamInvitation.create([{
        _id: randomUUID(), team_id: teamId, invited_user_id: invitedUserId, invited_by: actorId,
        status: "pending", message: messageValue(input.message),
      }], { session });
      await createActivity(session, { team_id: teamId, actor_id: actorId, target_user_id: invitedUserId, type: "invitation_sent" });
      await createNotification(session, {
        recipient_id: invitedUserId, actor_id: actorId, type: "team_invitation", entity_id: teamId,
        content: { title: `Invitation to ${team.name}`, message: "You have been invited to join a team.", actionUrl: "/teams" },
        metadata: { invitation_id: invitation._id },
      });
      return invitation._id;
    });
    return toApp(await TeamInvitation.findById(invitationId).lean());
  } catch (error) {
    if (isDuplicateKey(error)) throw teamErrors.invitationExists();
    throw error;
  }
};

const listTeamInvitations = async (teamId, actorId, query) => {
  await authz.getTeam(teamId);
  await authz.requireAdmin(teamId, actorId);
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 20, maxLimit: 50 });
  const filter = { team_id: teamId, status: query.status || "pending" };
  const [rows, total] = await Promise.all([
    TeamInvitation.find(filter).sort({ created_at: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    TeamInvitation.countDocuments(filter),
  ]);
  const items = toApps(rows);
  const profiles = await teamData.profileSummaries(items.flatMap((item) => [item.invited_user_id, item.invited_by]), { publicOnly: true });
  return { items: items.map((item) => ({ ...item, invited_user: profiles.get(item.invited_user_id), invited_by_user: profiles.get(item.invited_by) })), meta: paginationMeta({ ...options, total }) };
};

const listInbox = async (userId, query) => {
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 20, maxLimit: 50 });
  const filter = { invited_user_id: userId, status: "pending" };
  const [rows, total] = await Promise.all([
    TeamInvitation.find(filter).sort({ created_at: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    TeamInvitation.countDocuments(filter),
  ]);
  const items = toApps(rows);
  const teams = await Team.find({ _id: mongoose.trusted({ $in: items.map((item) => item.team_id) }), status: "active" }).lean();
  const teamById = new Map(teams.map((item) => [String(item._id), toApp(item)]));
  const profiles = await teamData.profileSummaries(items.map((item) => item.invited_by), { publicOnly: true });
  return { items: items.map((item) => ({ ...item, team: teamById.get(item.team_id), invited_by_user: profiles.get(item.invited_by) })).filter((item) => item.team), meta: paginationMeta({ ...options, total }) };
};

const respond = async (invitationId, userId, action) => {
  if (!new Set(["accepted", "declined"]).has(action)) throw errors.validation("Invalid invitation response");
  try {
    return await withTransaction(async (session) => {
      const invitation = await TeamInvitation.findOneAndUpdate(
        { _id: invitationId, invited_user_id: userId, status: "pending" },
        { $set: { status: action, responded_at: new Date() } },
        { session, returnDocument: "before" },
      ).lean();
      if (!invitation) throw teamErrors.invitationNotFound();
      const team = await authz.getTeam(invitation.team_id, session);
      if (action === "accepted") {
        await activateMembership(session, team.id, userId);
        await cancelPendingAccess(session, team.id, userId, { keepInvitation: true });
        await createActivity(session, { team_id: team.id, actor_id: userId, target_user_id: userId, type: "invitation_accepted" });
        await createNotification(session, {
          recipient_id: invitation.invited_by, actor_id: userId, type: "team_invitation_accepted", entity_id: team.id,
          content: { title: "Invitation accepted", message: `A member joined ${team.name}.`, actionUrl: `/teams/${team.slug}` },
          metadata: { invitation_id: invitationId },
        });
      }
      return { id: invitationId, status: action, team_slug: team.slug };
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw teamErrors.alreadyMember();
    throw error;
  }
};

const cancelInvitation = async (teamId, invitationId, actorId) => withTransaction(async (session) => {
  await authz.getTeam(teamId, session);
  await authz.requireAdmin(teamId, actorId, session);
  const row = await TeamInvitation.findOneAndUpdate(
    { _id: invitationId, team_id: teamId, status: "pending" },
    { $set: { status: "cancelled", responded_at: new Date() } },
    { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw teamErrors.invitationNotFound();
  return toApp(row);
});

const searchCandidates = async (teamId, actorId, query) => {
  await authz.getTeam(teamId);
  await authz.requireAdmin(teamId, actorId);
  const search = String(query.search || "").trim().slice(0, 80);
  if (search.length < 2) return [];
  const pattern = new RegExp(escapeRegex(search), "i");
  const [profiles, users, skills] = await Promise.all([
    UserProfile.find({ visibility: "public", $or: mongoose.trusted([{ username: pattern }, { headline: pattern }]) }).limit(30).lean(),
    User.find({ status: "active", $or: mongoose.trusted([{ "profile.firstName": pattern }, { "profile.lastName": pattern }]) }).select("_id").limit(30).lean(),
    Skill.find({ is_active: true, $or: mongoose.trusted([{ name: pattern }, { aliases: pattern }]) }).select("_id").limit(10).lean(),
  ]);
  const assignments = await UserSkill.find({ skill_id: mongoose.trusted({ $in: skills.map((item) => String(item._id)) }) }).select("user_id").limit(30).lean();
  const ids = [...new Set([...profiles.map((item) => String(item._id)), ...users.map((item) => String(item._id)), ...assignments.map((item) => item.user_id)])].slice(0, 30);
  const [memberships, invitations, summaries] = await Promise.all([
    TeamMembership.find({ team_id: teamId, user_id: mongoose.trusted({ $in: ids }), status: "active" }).lean(),
    TeamInvitation.find({ team_id: teamId, invited_user_id: mongoose.trusted({ $in: ids }), status: "pending" }).lean(),
    teamData.profileSummaries(ids, { publicOnly: true }),
  ]);
  const excluded = new Set([...memberships.map((item) => item.user_id), ...invitations.map((item) => item.invited_user_id)]);
  return ids.filter((id) => !excluded.has(id) && summaries.get(id)?.profile_visibility === "public").map((id) => summaries.get(id)).slice(0, 20);
};

module.exports = { cancelInvitation, listInbox, listTeamInvitations, respond, searchCandidates, sendInvitation };
