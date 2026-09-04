const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const { Team, TeamInvitation, TeamJoinRequest } = require("../models");
const teamData = require("../data/teamData");
const authz = require("./teamAuthorization");
const {
  activateMembership, activeManagerIds, cancelPendingAccess, createActivity, createNotification,
} = require("./teamDomain");
const { errors } = require("../utils/appError");
const { teamErrors } = require("../utils/teamErrors");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { parseListQuery } = require("../utils/queryOptions");
const { paginationMeta } = require("../utils/apiResponse");
const { toApp, toApps } = require("../models/helpers");

const messageValue = (value) => {
  const message = String(value || "").trim();
  if (message.length > 500 || /[<>]/.test(message)) throw errors.validation("Join request message must be plain text and at most 500 characters");
  return message || null;
};

const createRequest = async (teamId, userId, input) => {
  try {
    const requestId = await withTransaction(async (session) => {
      const team = await authz.getTeam(teamId, session);
      if (team.join_policy !== "request") throw errors.validation("This team is not accepting join requests");
      if (await authz.getMembership(teamId, userId, session)) throw teamErrors.alreadyMember();
      const invitation = await TeamInvitation.exists({ team_id: teamId, invited_user_id: userId, status: "pending" }).session(session);
      if (invitation) throw errors.conflict("Accept or decline your pending invitation first");
      const [request] = await TeamJoinRequest.create([{
        _id: randomUUID(), team_id: teamId, user_id: userId, message: messageValue(input.message), status: "pending",
      }], { session });
      await createActivity(session, { team_id: teamId, actor_id: userId, target_user_id: userId, type: "join_request_created" });
      const managerIds = await activeManagerIds(session, teamId);
      for (const managerId of managerIds.filter((id) => id !== userId)) {
        await createNotification(session, {
          recipient_id: managerId, actor_id: userId, type: "team_join_request", entity_id: teamId,
          content: { title: `Join request for ${team.name}`, message: "A member requested to join your team.", actionUrl: `/teams/${team.slug}/settings` },
          metadata: { join_request_id: request._id },
        });
      }
      return request._id;
    });
    return toApp(await TeamJoinRequest.findById(requestId).lean());
  } catch (error) {
    if (isDuplicateKey(error)) throw teamErrors.requestExists();
    throw error;
  }
};

const listTeamRequests = async (teamId, actorId, query) => {
  await authz.getTeam(teamId);
  await authz.requireAdmin(teamId, actorId);
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 20, maxLimit: 50 });
  const filter = { team_id: teamId, status: query.status || "pending" };
  const [rows, total] = await Promise.all([
    TeamJoinRequest.find(filter).sort({ created_at: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    TeamJoinRequest.countDocuments(filter),
  ]);
  const items = toApps(rows);
  const profiles = await teamData.profileSummaries(items.map((item) => item.user_id), { publicOnly: true });
  return { items: items.map((item) => ({ ...item, requester: profiles.get(item.user_id) || null })), meta: paginationMeta({ ...options, total }) };
};

const listOwnRequests = async (userId, query) => {
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 20, maxLimit: 50 });
  const filter = { user_id: userId, status: query.status || "pending" };
  const [rows, total] = await Promise.all([
    TeamJoinRequest.find(filter).sort({ created_at: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    TeamJoinRequest.countDocuments(filter),
  ]);
  const items = toApps(rows);
  const teams = await Team.find({ _id: mongoose.trusted({ $in: items.map((item) => item.team_id) }), status: "active" }).lean();
  const byId = new Map(teams.map((item) => [String(item._id), toApp(item)]));
  return { items: items.map((item) => ({ ...item, team: byId.get(item.team_id) })).filter((item) => item.team), meta: paginationMeta({ ...options, total }) };
};

const reviewRequest = async (requestId, actorId, action) => {
  if (!new Set(["accepted", "rejected"]).has(action)) throw errors.validation("Invalid join request response");
  try {
    return await withTransaction(async (session) => {
      const pending = await TeamJoinRequest.findOne({ _id: requestId, status: "pending" }).session(session).lean();
      if (!pending) throw teamErrors.requestNotFound();
      const team = await authz.getTeam(pending.team_id, session);
      await authz.requireAdmin(team.id, actorId, session);
      const row = await TeamJoinRequest.findOneAndUpdate(
        { _id: requestId, status: "pending" },
        { $set: { status: action, reviewed_by: actorId, reviewed_at: new Date() } },
        { session, returnDocument: "before" },
      ).lean();
      if (!row) throw teamErrors.requestNotFound();
      if (action === "accepted") {
        await activateMembership(session, team.id, row.user_id);
        await cancelPendingAccess(session, team.id, row.user_id, { keepRequest: true });
        await createActivity(session, { team_id: team.id, actor_id: actorId, target_user_id: row.user_id, type: "join_request_accepted" });
      } else {
        await createActivity(session, { team_id: team.id, actor_id: actorId, target_user_id: row.user_id, type: "join_request_rejected" });
      }
      await createNotification(session, {
        recipient_id: row.user_id, actor_id: actorId,
        type: action === "accepted" ? "team_join_request_accepted" : "team_join_request_rejected", entity_id: team.id,
        content: {
          title: action === "accepted" ? `Welcome to ${team.name}` : `Update from ${team.name}`,
          message: action === "accepted" ? "Your join request was accepted." : "Your join request was not accepted.",
          actionUrl: `/teams/${team.slug}`,
        },
        metadata: { join_request_id: requestId },
      });
      return { id: requestId, status: action, team_slug: team.slug };
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw teamErrors.alreadyMember();
    throw error;
  }
};

const cancelRequest = async (requestId, userId) => withTransaction(async (session) => {
  const row = await TeamJoinRequest.findOneAndUpdate(
    { _id: requestId, user_id: userId, status: "pending" },
    { $set: { status: "cancelled", reviewed_at: new Date() } },
    { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!row) throw teamErrors.requestNotFound();
  return toApp(row);
});

module.exports = { cancelRequest, createRequest, listOwnRequests, listTeamRequests, reviewRequest };
