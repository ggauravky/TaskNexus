const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { ProjectParticipant, ProjectTask, TeamMembership } = require("../models");
const { toApp } = require("../models/helpers");
const projectData = require("../data/projectData");
const teamData = require("../data/teamData");
const authz = require("./projectAuthorization");
const { createProjectActivity, createProjectNotification } = require("./projectDomain");
const { participant: participantDto } = require("../serializers/projectSerializers");
const { projectErrors } = require("../utils/projectErrors");
const { errors } = require("../utils/appError");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { parseListQuery } = require("../utils/queryOptions");
const { paginationMeta } = require("../utils/apiResponse");

const listParticipants = async (projectId, userId, query) => {
  const context = await authz.getContext(projectId, userId);
  authz.requireVisible(context);
  const options = parseListQuery(query, { allowedSorts: ["joined_at"], defaultLimit: 30, maxLimit: 50 });
  const result = await projectData.listParticipants(projectId, options);
  const profiles = await teamData.profileSummaries(result.items.map((item) => item.user_id), { publicOnly: true });
  return { items: result.items.map((item) => participantDto(item, profiles.get(item.user_id))), meta: paginationMeta(result) };
};

const listCandidates = async (projectId, userId) => {
  const context = await authz.getContext(projectId, userId);
  authz.requireManager(context);
  const [members, participants] = await Promise.all([
    TeamMembership.find({ team_id: context.team.id, status: "active" }).sort({ role: 1, joined_at: 1 }).limit(100).lean(),
    ProjectParticipant.find({ project_id: projectId, status: "active" }).select("user_id").lean(),
  ]);
  const activeIds = new Set(participants.map((item) => item.user_id));
  const candidates = members.filter((item) => !activeIds.has(item.user_id));
  const profiles = await teamData.profileSummaries(candidates.map((item) => item.user_id), { publicOnly: true });
  return candidates.map((item) => ({
    user_id: item.user_id, team_role: item.role, profile: profiles.get(item.user_id) || null,
  }));
};

const addParticipant = async (projectId, actorId, input) => {
  const userId = String(input.userId || input.user_id || "");
  const role = input.role || "contributor";
  if (!new Set(["lead", "contributor"]).has(role)) throw errors.validation("Role must be lead or contributor");
  const operationKey = randomUUID();
  try {
    const result = await withTransaction(async (session) => {
      const context = await authz.getContext(projectId, actorId, session);
      authz.requireManager(context);
      if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Participants cannot be added to this project state");
      const teamMembership = toApp(await TeamMembership.findOne({ team_id: context.team.id, user_id: userId, status: "active" }).session(session).lean());
      if (!teamMembership) throw errors.validation("Only active team members can join a project");
      const existing = toApp(await ProjectParticipant.findOne({ project_id: projectId, user_id: userId }).session(session).lean());
      if (existing?.status === "active") throw projectErrors.participantExists();
      let row;
      if (existing) {
        row = await ProjectParticipant.findOneAndUpdate(
          { _id: existing.id, status: "removed" },
          { $set: { role, status: "active", joined_at: new Date(), ended_at: null } },
          { session, returnDocument: "after", runValidators: true },
        ).lean();
      } else {
        [row] = await ProjectParticipant.create([{
          _id: randomUUID(), team_id: context.team.id, project_id: projectId, user_id: userId,
          role, status: "active", joined_at: new Date(),
        }], { session });
      }
      if (!row) throw projectErrors.participantExists();
      await createProjectActivity(session, {
        team_id: context.team.id, project_id: projectId, actor_id: actorId,
        target_user_id: userId, type: "participant_added", metadata: { role },
      });
      if (userId !== actorId) {
        await createProjectNotification(session, {
          recipient_id: userId, actor_id: actorId, type: "project_added", entity_id: projectId,
          event_key: `project-added:${operationKey}:${userId}`,
          content: { title: "Added to project", message: `You were added to ${context.project.name}.`, actionUrl: `/teams/${context.team.slug}/projects/${context.project.slug}` },
          metadata: { team_id: context.team.id, role },
        });
      }
      return toApp(row);
    });
    const profiles = await teamData.profileSummaries([result.user_id], { publicOnly: true });
    return participantDto(result, profiles.get(result.user_id));
  } catch (error) {
    if (isDuplicateKey(error)) throw projectErrors.participantExists();
    throw error;
  }
};

const assertLeadCanManageTarget = async (context, targetUserId, session) => {
  if (authz.isTeamManager(context)) return;
  const targetTeamMembership = toApp(await TeamMembership.findOne({
    team_id: context.team.id, user_id: targetUserId, status: "active",
  }).session(session).lean());
  if (new Set(["owner", "admin"]).has(targetTeamMembership?.role)) {
    throw projectErrors.denied("A project lead cannot override the team owner or team admins");
  }
};

const removeParticipant = async (projectId, targetUserId, actorId) => {
  const operationKey = randomUUID();
  const result = await withTransaction(async (session) => {
    const context = await authz.getContext(projectId, actorId, session);
    authz.requireManager(context);
    if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Participants are preserved in this project state");
    await assertLeadCanManageTarget(context, targetUserId, session);
    const target = toApp(await ProjectParticipant.findOne({ project_id: projectId, user_id: targetUserId, status: "active" }).session(session).lean());
    if (!target) throw projectErrors.participantNotFound();
    const updated = await ProjectParticipant.findOneAndUpdate(
      { _id: target.id, status: "active" }, { $set: { status: "removed", ended_at: new Date() } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw projectErrors.participantNotFound();
    const taskWrite = await ProjectTask.updateMany(
      { project_id: projectId, status: mongoose.trusted({ $ne: "done" }), assignee_ids: targetUserId },
      { $pull: { assignee_ids: targetUserId }, $inc: { revision: 1 } }, { session },
    );
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: projectId, actor_id: actorId, target_user_id: targetUserId,
      type: "participant_removed", metadata: { unassigned_open_tasks: taskWrite.modifiedCount },
    });
    if (targetUserId !== actorId) {
      await createProjectNotification(session, {
        recipient_id: targetUserId, actor_id: actorId, type: "project_removed", entity_id: projectId,
        event_key: `project-removed:${operationKey}:${targetUserId}`,
        content: { title: "Removed from project", message: `You were removed from ${context.project.name}.`, actionUrl: `/teams/${context.team.slug}` },
      });
    }
    return { ...toApp(updated), unassigned_open_tasks: taskWrite.modifiedCount };
  });
  const profiles = await teamData.profileSummaries([result.user_id], { publicOnly: true });
  return { ...participantDto(result, profiles.get(result.user_id)), unassigned_open_tasks: result.unassigned_open_tasks };
};

const changeParticipantRole = async (projectId, targetUserId, actorId, role) => {
  if (!new Set(["lead", "contributor"]).has(role)) throw errors.validation("Role must be lead or contributor");
  const operationKey = randomUUID();
  const result = await withTransaction(async (session) => {
    const context = await authz.getContext(projectId, actorId, session);
    authz.requireManager(context);
    if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Participant roles are preserved in this project state");
    await assertLeadCanManageTarget(context, targetUserId, session);
    const target = toApp(await ProjectParticipant.findOne({ project_id: projectId, user_id: targetUserId, status: "active" }).session(session).lean());
    if (!target) throw projectErrors.participantNotFound();
    if (target.role === role) return target;
    const updated = await ProjectParticipant.findOneAndUpdate(
      { _id: target.id, status: "active", role: target.role }, { $set: { role } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw projectErrors.staleWrite();
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: projectId, actor_id: actorId, target_user_id: targetUserId,
      type: "participant_role_changed", metadata: { from: target.role, to: role },
    });
    if (targetUserId !== actorId) {
      await createProjectNotification(session, {
        recipient_id: targetUserId, actor_id: actorId, type: "project_role_changed", entity_id: projectId,
        event_key: `project-role:${operationKey}:${targetUserId}`,
        content: { title: "Project role updated", message: `Your role in ${context.project.name} is now ${role}.`, actionUrl: `/teams/${context.team.slug}/projects/${context.project.slug}` },
        metadata: { from: target.role, to: role },
      });
    }
    return toApp(updated);
  });
  const profiles = await teamData.profileSummaries([result.user_id], { publicOnly: true });
  return participantDto(result, profiles.get(result.user_id));
};

module.exports = { addParticipant, changeParticipantRole, listCandidates, listParticipants, removeParticipant };
