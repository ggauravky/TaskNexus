const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const {
  Notification, ProjectActivity, ProjectParticipant, ProjectTask,
} = require("../models");

const createProjectActivity = async (session, data) => {
  const [activity] = await ProjectActivity.create([{ _id: randomUUID(), ...data }], { session });
  return activity;
};

const createProjectNotification = async (session, data) => {
  const payload = {
    _id: randomUUID(), status: "unread", priority: "medium", entity_type: "project", ...data,
  };
  try {
    const [notification] = await Notification.create([payload], { session });
    return notification;
  } catch (error) {
    if (error?.code === 11000 && payload.event_key) return null;
    throw error;
  }
};

const deactivateUserParticipations = async (session, teamId, userId, actorId) => {
  const participations = await ProjectParticipant.find({ team_id: teamId, user_id: userId, status: "active" })
    .session(session).lean();
  if (!participations.length) return { projects: 0, tasks: 0 };
  const projectIds = participations.map((item) => item.project_id);
  const now = new Date();
  await ProjectParticipant.updateMany(
    { team_id: teamId, user_id: userId, status: "active" },
    { $set: { status: "removed", ended_at: now } },
    { session },
  );
  const taskWrite = await ProjectTask.updateMany(
    { project_id: mongoose.trusted({ $in: projectIds }), status: mongoose.trusted({ $ne: "done" }), assignee_ids: userId },
    { $pull: { assignee_ids: userId }, $inc: { revision: 1 } },
    { session },
  );
  await ProjectActivity.insertMany(projectIds.map((projectId) => ({
    _id: randomUUID(), team_id: teamId, project_id: projectId, actor_id: actorId,
    target_user_id: userId, type: "participant_removed", metadata: { source: "team_membership_ended" },
    created_at: now,
  })), { session });
  return { projects: projectIds.length, tasks: taskWrite.modifiedCount };
};

module.exports = { createProjectActivity, createProjectNotification, deactivateUserParticipations };
