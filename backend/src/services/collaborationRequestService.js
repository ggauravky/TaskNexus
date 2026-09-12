const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const {
  CollaborationRequest, Hackathon, HackathonParticipant, Notification, Project, ProjectParticipant, Team, TeamMembership,
  TeamOpening, User, UserBlock, UserProfile,
} = require("../models");
const { toApp, toApps } = require("../models/helpers");
const { errors } = require("../utils/appError");
const { paginationMeta } = require("../utils/apiResponse");
const { parseListQuery } = require("../utils/queryOptions");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { createNotification, activeManagerIds } = require("./teamDomain");

const trustedIn = (values) => mongoose.trusted({ $in: values });
const genericUnavailable = () => errors.notFound("User is not available for collaboration");

const messageValue = (value) => {
  const message = String(value || "").trim();
  if (message.length > 500 || /[<>]/.test(message)) throw errors.validation("Message must be plain text and at most 500 characters");
  return message || null;
};

const partyMap = async (ids) => {
  const unique = [...new Set(ids.filter(Boolean))];
  const [users, profiles] = await Promise.all([
    User.find({ _id: trustedIn(unique), status: "active" }).select("_id profile").lean(),
    UserProfile.find({ _id: trustedIn(unique) }).lean(),
  ]);
  const userMap = new Map(users.map((row) => [String(row._id), row]));
  const profileMap = new Map(profiles.map((row) => [String(row._id), row]));
  return new Map(unique.map((id) => {
    const user = userMap.get(id); const profile = profileMap.get(id); const isPublic = profile?.visibility === "public";
    const legacy = user?.profile || {};
    const name = [legacy.firstName || legacy.first_name, legacy.lastName || legacy.last_name].filter(Boolean).join(" ") || (isPublic ? profile?.username : null) || "TaskNexus member";
    return [id, { id, display_name: name, username: isPublic ? profile?.username || null : null, avatar_url: isPublic ? profile?.avatar_url || null : null, headline: isPublic ? profile?.headline || null : null }];
  }));
};

const requestDto = (row, context = {}) => ({
  id: row.id, sender: context.parties?.get(row.sender_id) || { id: row.sender_id },
  recipient: context.parties?.get(row.recipient_id) || { id: row.recipient_id },
  team: context.teams?.get(row.team_id) || null, opening: context.openings?.get(row.team_opening_id) || null,
  project: context.projects?.get(row.project_id) || null, message: row.message || null, status: row.status,
  hackathon: context.hackathons?.get(row.hackathon_id) || null,
  created_at: row.created_at, updated_at: row.updated_at, responded_at: row.responded_at || null, cancelled_at: row.cancelled_at || null,
});

const decorate = async (rows) => {
  if (!rows.length) return [];
  const [parties, teams, openings, projects, hackathons] = await Promise.all([
    partyMap(rows.flatMap((row) => [row.sender_id, row.recipient_id])),
    Team.find({ _id: trustedIn(rows.map((row) => row.team_id).filter(Boolean)) }).select("_id name slug visibility").lean(),
    TeamOpening.find({ _id: trustedIn(rows.map((row) => row.team_opening_id).filter(Boolean)) }).select("_id title role status team_id").lean(),
    Project.find({ _id: trustedIn(rows.map((row) => row.project_id).filter(Boolean)) }).select("_id name slug team_id").lean(),
    Hackathon.find({ _id: trustedIn(rows.map((row) => row.hackathon_id).filter(Boolean)) }).select("_id name slug status").lean(),
  ]);
  const teamMap = new Map(toApps(teams).map((row) => [row.id, { id: row.id, name: row.name, slug: row.slug }]));
  const openingMap = new Map(toApps(openings).map((row) => [row.id, { id: row.id, title: row.title, role: row.role, status: row.status }]));
  const projectMap = new Map(toApps(projects).map((row) => [row.id, { id: row.id, name: row.name, slug: row.slug }]));
  const hackathonMap = new Map(toApps(hackathons).map((row) => [row.id, { id: row.id, name: row.name, slug: row.slug, status: row.status }]));
  return rows.map((row) => requestDto(row, { parties, teams: teamMap, openings: openingMap, projects: projectMap, hackathons: hackathonMap }));
};

const ensureActive = async (userId, session = null) => {
  const user = await User.findOne({ _id: userId, status: "active" }).session(session).select("_id").lean();
  if (!user) throw errors.forbidden("An active account is required");
};

const lockCollaborationPair = async (session, firstId, secondId) => {
  const ids = [...new Set([firstId, secondId].filter(Boolean))].sort();
  for (const id of ids) {
    await UserProfile.updateOne({ _id: id }, { $inc: { collaboration_revision: 1 } }, { session });
  }
};

const ensureRecipientEligible = async (senderId, recipientId, session = null) => {
  if (!recipientId || recipientId === senderId) throw errors.validation("Choose another eligible collaborator");
  const user = await User.findOne({ _id: recipientId, status: "active" }).session(session).select("_id").lean();
  const profile = await UserProfile.findOne({ _id: recipientId, visibility: "public", discoverable: true, availability: trustedIn(["open", "limited"]) }).session(session).lean();
  const blocked = await UserBlock.exists({ $or: mongoose.trusted([{ blocker_id: senderId, blocked_user_id: recipientId }, { blocker_id: recipientId, blocked_user_id: senderId }]) }).session(session);
  if (!user || !profile || blocked) throw genericUnavailable();
};

const ensureContextRecipient = async (senderId, recipientId, session = null) => {
  if (!recipientId || recipientId === senderId) throw errors.validation("Choose another eligible collaborator");
  const user = await User.findOne({ _id: recipientId, status: "active" }).session(session).select("_id").lean();
  const blocked = await UserBlock.exists({ $or: mongoose.trusted([{ blocker_id: senderId, blocked_user_id: recipientId }, { blocker_id: recipientId, blocked_user_id: senderId }]) }).session(session);
  if (!user || blocked) throw genericUnavailable();
};

const validateContext = async (senderId, input, session) => {
  const teamId = input.teamId || null; const openingId = input.teamOpeningId || null; const projectId = input.projectId || null; const hackathonId = input.hackathonId || null;
  if ([teamId, openingId, projectId, hackathonId].filter(Boolean).length > 1) throw errors.validation("Choose only one collaboration context");
  if (openingId) throw errors.validation("Use the opening interest action for a Team opening");
  if (teamId) {
    const team = await Team.findOne({ _id: teamId, status: "active" }).session(session).lean();
    const membership = await TeamMembership.findOne({ team_id: teamId, user_id: senderId, status: "active" }).session(session).lean();
    if (!team || !membership) throw errors.forbidden("Only active Team members may reference that Team");
    return { teamId, openingId: null, projectId: null, hackathonId: null, key: `team:${teamId}` };
  }
  if (projectId) {
    const project = await Project.findOne({ _id: projectId, status: trustedIn(["planning", "active", "completed"]) }).session(session).lean();
    const participant = await ProjectParticipant.findOne({ project_id: projectId, user_id: senderId, status: "active" }).session(session).lean();
    if (!project || !participant) throw errors.forbidden("Only active Project participants may reference that Project");
    return { teamId: project.team_id, openingId: null, projectId, hackathonId: null, key: `project:${projectId}` };
  }
  if (hackathonId) {
    const hackathon = await Hackathon.findOne({ _id: hackathonId, status: mongoose.trusted({ $nin: ["completed", "archived"] }), visibility: "public" }).session(session).lean();
    const sender = await HackathonParticipant.findOne({ hackathon_id: hackathonId, user_id: senderId, status: mongoose.trusted({ $ne: "withdrawn" }) }).session(session).lean();
    const recipient = await HackathonParticipant.findOne({ hackathon_id: hackathonId, user_id: input.recipientId, status: mongoose.trusted({ $ne: "withdrawn" }), looking_for_team: true, visible_on_hackathon: true }).session(session).lean();
    if (!hackathon || !sender || !recipient) throw genericUnavailable();
    return { teamId: null, openingId: null, projectId: null, hackathonId, key: `hackathon:${hackathonId}` };
  }
  return { teamId: null, openingId: null, projectId: null, hackathonId: null, key: "general" };
};

const ensureNoRecentDuplicate = async (senderId, recipientId, contextKey, session) => {
  const existing = await CollaborationRequest.findOne({ sender_id: senderId, recipient_id: recipientId, context_key: contextKey }).sort({ created_at: -1 }).session(session).lean();
  if (!existing) return;
  if (["pending", "accepted"].includes(existing.status)) throw errors.conflict("A collaboration request already exists for this context");
  if (new Date(existing.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000) throw errors.conflict("Please wait before sending another request for this context");
};

const insertRequest = async (session, payload) => {
  const pendingCount = await CollaborationRequest.countDocuments({ sender_id: payload.sender_id, status: "pending" }).session(session);
  if (pendingCount >= 20) throw errors.conflict("Resolve or cancel an outgoing request before sending more");
  await ensureNoRecentDuplicate(payload.sender_id, payload.recipient_id, payload.context_key, session);
  const [request] = await CollaborationRequest.create([{ _id: randomUUID(), status: "pending", ...payload }], { session });
  return request;
};

const createRequest = async (senderId, input) => {
  try {
    const id = await withTransaction(async (session) => {
      const recipientId = String(input.recipientId || "").trim();
      await lockCollaborationPair(session, senderId, recipientId);
      await ensureActive(senderId, session);
      await ensureRecipientEligible(senderId, recipientId, session);
      const context = await validateContext(senderId, input, session);
      const request = await insertRequest(session, {
        sender_id: senderId, recipient_id: recipientId, team_id: context.teamId,
        team_opening_id: context.openingId, project_id: context.projectId,
        hackathon_id: context.hackathonId, context_key: context.key, message: messageValue(input.message),
      });
      await createNotification(session, {
        recipient_id: recipientId, actor_id: senderId, type: "collaboration_request_received", entity_type: "collaboration_request", entity_id: request._id,
        content: { title: "New collaboration request", message: "A developer wants to collaborate with you.", actionUrl: "/collaboration" },
        metadata: { request_id: request._id, team_id: context.teamId, project_id: context.projectId, hackathon_id: context.hackathonId },
      });
      return request._id;
    });
    return (await decorate([toApp(await CollaborationRequest.findById(id).lean())]))[0];
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("A pending collaboration request already exists for this context");
    throw error;
  }
};

const createOpeningInterest = async (openingId, senderId, input = {}) => {
  try {
    const id = await withTransaction(async (session) => {
      await ensureActive(senderId, session);
      const opening = await TeamOpening.findOne({ _id: openingId, status: "open" }).session(session).lean();
      const profile = await UserProfile.findOne({ _id: senderId, visibility: "public", discoverable: true, availability: trustedIn(["open", "limited"]) }).session(session).lean();
      if (!opening) throw errors.notFound("Team opening not found");
      if (!profile) throw errors.forbidden("Enable People Discovery before expressing interest");
      const team = await Team.findOne({ _id: opening.team_id, status: "active", visibility: "public" }).session(session).lean();
      if (!team) throw errors.notFound("Team opening not found");
      await lockCollaborationPair(session, senderId, team.owner_id);
      const reserved = await TeamOpening.updateOne({ _id: openingId, status: "open", revision: opening.revision || 0 }, { $inc: { revision: 1 } }, { session });
      if (reserved.modifiedCount !== 1) throw errors.conflict("Opening changed before interest could be recorded");
      await ensureContextRecipient(senderId, team.owner_id, session);
      const request = await insertRequest(session, {
        sender_id: senderId, recipient_id: team.owner_id, team_id: team._id, team_opening_id: openingId,
        project_id: null, hackathon_id: opening.hackathon_id || null, context_key: `opening:${openingId}`, message: messageValue(input.message),
      });
      const managers = await activeManagerIds(session, team._id);
      for (const managerId of managers.filter((id) => id !== senderId)) {
        await createNotification(session, {
          recipient_id: managerId, actor_id: senderId, type: "team_opening_interest", entity_type: "team_opening", entity_id: openingId,
          content: { title: `Interest in ${opening.title}`, message: "A discoverable developer expressed interest in your Team opening.", actionUrl: `/teams/${team.slug}/settings#openings` },
          metadata: { request_id: request._id, team_id: team._id, opening_id: openingId },
          event_key: `opening-interest:${request._id}:${managerId}`,
        });
      }
      return request._id;
    });
    return (await decorate([toApp(await CollaborationRequest.findById(id).lean())]))[0];
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("You already expressed interest in this opening");
    throw error;
  }
};

const listRequests = async (userId, query = {}) => {
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 20, maxLimit: 50 });
  const scope = query.scope === "outgoing" ? "outgoing" : "incoming";
  const filter = scope === "incoming" ? { recipient_id: userId } : { sender_id: userId };
  if (["pending", "accepted", "declined", "cancelled"].includes(query.status)) filter.status = query.status;
  const [rows, total] = await Promise.all([
    CollaborationRequest.find(filter).sort({ created_at: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    CollaborationRequest.countDocuments(filter),
  ]);
  return { items: await decorate(toApps(rows)), meta: paginationMeta({ ...options, total }) };
};

const respond = async (id, recipientId, action) => {
  if (!["accepted", "declined"].includes(action)) throw errors.validation("Unsupported response");
  return withTransaction(async (session) => {
    const before = toApp(await CollaborationRequest.findOneAndUpdate(
      { _id: id, recipient_id: recipientId, status: "pending" },
      { $set: { status: action, responded_at: new Date() } }, { session, returnDocument: "before", runValidators: true },
    ).lean());
    if (!before) throw errors.notFound("Pending collaboration request not found");
    await createNotification(session, {
      recipient_id: before.sender_id, actor_id: recipientId, type: action === "accepted" ? "collaboration_request_accepted" : "collaboration_request_declined",
      entity_type: "collaboration_request", entity_id: id,
      content: { title: `Collaboration request ${action}`, message: `Your collaboration request was ${action}.`, actionUrl: "/collaboration" },
      metadata: { request_id: id, team_id: before.team_id, opening_id: before.team_opening_id },
      event_key: `collaboration:${id}:${action}`,
    });
    return { id, status: action };
  });
};

const cancel = async (id, senderId) => {
  const row = toApp(await CollaborationRequest.findOneAndUpdate(
    { _id: id, sender_id: senderId, status: "pending" }, { $set: { status: "cancelled", cancelled_at: new Date() } },
    { returnDocument: "after", runValidators: true },
  ).lean());
  if (!row) throw errors.notFound("Pending collaboration request not found");
  return { id, status: "cancelled" };
};

const blockUser = async (blockerId, blockedUserId) => {
  if (!blockedUserId || blockerId === blockedUserId) throw errors.validation("Choose another user to block");
  if (!await User.exists({ _id: blockedUserId, status: "active" })) throw errors.notFound("User not found");
  try {
    await withTransaction(async (session) => {
      await lockCollaborationPair(session, blockerId, blockedUserId);
      await UserBlock.updateOne({ blocker_id: blockerId, blocked_user_id: blockedUserId }, { $setOnInsert: { _id: randomUUID() } }, { upsert: true, session });
      await CollaborationRequest.updateMany({
        status: "pending", $or: mongoose.trusted([{ sender_id: blockerId, recipient_id: blockedUserId }, { sender_id: blockedUserId, recipient_id: blockerId }]),
      }, { $set: { status: "cancelled", cancelled_at: new Date() } }, { session });
      await Notification.deleteMany({ recipient_id: blockerId, actor_id: blockedUserId, status: "unread", type: "collaboration_request_received" }, { session });
    });
    return { blocked_user_id: blockedUserId };
  } catch (error) {
    if (isDuplicateKey(error)) return { blocked_user_id: blockedUserId };
    throw error;
  }
};

const unblockUser = async (blockerId, blockedUserId) => {
  const result = await UserBlock.deleteOne({ blocker_id: blockerId, blocked_user_id: blockedUserId });
  if (!result.deletedCount) throw errors.notFound("Blocked user not found");
  return { blocked_user_id: blockedUserId };
};

const listBlocks = async (blockerId) => {
  const rows = toApps(await UserBlock.find({ blocker_id: blockerId }).sort({ created_at: -1 }).lean());
  const parties = await partyMap(rows.map((row) => row.blocked_user_id));
  return rows.map((row) => ({ id: row.id, user: parties.get(row.blocked_user_id), created_at: row.created_at }));
};

module.exports = { blockUser, cancel, createOpeningInterest, createRequest, decorate, listBlocks, listRequests, requestDto, respond, unblockUser };
