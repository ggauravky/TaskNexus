const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const { Notification, TeamActivity, TeamInvitation, TeamJoinRequest, TeamMembership } = require("../models");
const { teamErrors } = require("../utils/teamErrors");

const createActivity = async (session, data) => {
  const [activity] = await TeamActivity.create([{ _id: randomUUID(), ...data }], { session });
  return activity;
};

const createNotification = async (session, data) => {
  const [notification] = await Notification.create([{
    _id: randomUUID(), status: "unread", priority: "medium", entity_type: "team", ...data,
  }], { session });
  return notification;
};

const activateMembership = async (session, teamId, userId, role = "member") => {
  const existing = await TeamMembership.findOne({ team_id: teamId, user_id: userId }).session(session).lean();
  if (existing?.status === "active") throw teamErrors.alreadyMember();
  if (existing) {
    const updated = await TeamMembership.findOneAndUpdate(
      { _id: existing._id, status: mongoose.trusted({ $ne: "active" }) },
      { $set: { role, status: "active", joined_at: new Date(), ended_at: null } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw teamErrors.alreadyMember();
    return updated;
  }
  const [membership] = await TeamMembership.create([{
    _id: randomUUID(), team_id: teamId, user_id: userId, role, status: "active", joined_at: new Date(),
  }], { session });
  return membership;
};

const cancelPendingAccess = async (session, teamId, userId, options = {}) => {
  if (!options.keepInvitation) {
    await TeamInvitation.updateMany(
      { team_id: teamId, invited_user_id: userId, status: "pending" },
      { $set: { status: "cancelled", responded_at: new Date() } },
      { session },
    );
  }
  if (!options.keepRequest) {
    await TeamJoinRequest.updateMany(
      { team_id: teamId, user_id: userId, status: "pending" },
      { $set: { status: "cancelled", reviewed_at: new Date() } },
      { session },
    );
  }
};

const activeManagerIds = async (session, teamId) => {
  const rows = await TeamMembership.find({
    team_id: teamId, status: "active", role: mongoose.trusted({ $in: ["owner", "admin"] }),
  }).session(session).select("user_id").lean();
  return rows.map((item) => item.user_id);
};

module.exports = { activateMembership, activeManagerIds, cancelPendingAccess, createActivity, createNotification };
