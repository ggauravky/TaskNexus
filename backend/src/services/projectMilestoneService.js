const { randomUUID } = require("crypto");
const { ProjectMilestone, ProjectParticipant, ProjectTask } = require("../models");
const { toApp } = require("../models/helpers");
const projectData = require("../data/projectData");
const authz = require("./projectAuthorization");
const { createProjectActivity, createProjectNotification } = require("./projectDomain");
const { milestone: milestoneDto } = require("../serializers/projectSerializers");
const { PROJECT_MILESTONE_TRANSITIONS } = require("../config/constants");
const { errors } = require("../utils/appError");
const { projectErrors } = require("../utils/projectErrors");
const { withTransaction } = require("../utils/transactions");
const { dateValue, text } = require("./projectValidation");

const listMilestones = async (projectId, userId) => {
  const context = await authz.getContext(projectId, userId);
  authz.requireWorkspaceAccess(context);
  return (await projectData.listMilestones(projectId)).map(milestoneDto);
};

const createMilestone = async (projectId, actorId, input) => {
  const name = text(input.name, 140, "Milestone name", { required: true });
  const id = randomUUID();
  await withTransaction(async (session) => {
    const context = await authz.getContext(projectId, actorId, session);
    authz.requireManager(context);
    if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Milestones cannot be created in this project state");
    await ProjectMilestone.create([{
      _id: id, team_id: context.team.id, project_id: projectId, name,
      description: text(input.description, 2000, "Description"), status: "planned",
      target_date: dateValue(input.targetDate || input.target_date, "Target date"),
      completed_at: null, created_by: actorId,
    }], { session });
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: id,
      type: "milestone_created", metadata: { name },
    });
  });
  return milestoneDto(toApp(await ProjectMilestone.findById(id).lean()));
};

const updateMilestone = async (milestoneId, actorId, input) => {
  const operationKey = randomUUID();
  const row = await withTransaction(async (session) => {
    const milestone = toApp(await ProjectMilestone.findById(milestoneId).session(session).lean());
    if (!milestone) throw projectErrors.milestoneNotFound();
    const context = await authz.getContext(milestone.project_id, actorId, session);
    authz.requireManager(context);
    if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Reopen the project before editing milestones");
    const updates = {};
    if (input.name !== undefined) updates.name = text(input.name, 140, "Milestone name", { required: true });
    if (input.description !== undefined) updates.description = text(input.description, 2000, "Description");
    if (input.targetDate !== undefined || input.target_date !== undefined) updates.target_date = dateValue(input.targetDate ?? input.target_date, "Target date");
    if (input.status !== undefined) {
      const allowed = PROJECT_MILESTONE_TRANSITIONS[milestone.status] || [];
      if (!allowed.includes(input.status)) throw errors.invalidTransition(`Milestone cannot move from ${milestone.status} to ${input.status}`);
      updates.status = input.status;
      updates.completed_at = input.status === "completed" ? new Date() : null;
    }
    if (!Object.keys(updates).length) throw errors.validation("No editable milestone fields supplied");
    const updated = await ProjectMilestone.findOneAndUpdate(
      { _id: milestoneId, status: milestone.status }, { $set: updates },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw projectErrors.staleWrite();
    const completed = updates.status === "completed";
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: milestone.project_id, actor_id: actorId, entity_id: milestoneId,
      type: completed ? "milestone_completed" : "milestone_updated", metadata: { fields: Object.keys(updates), name: milestone.name },
    });
    if (completed) {
      const participants = await ProjectParticipant.find({ project_id: milestone.project_id, status: "active" })
        .session(session).select("user_id").lean();
      for (const participant of participants.filter((item) => item.user_id !== actorId)) {
        await createProjectNotification(session, {
          recipient_id: participant.user_id, actor_id: actorId, type: "project_milestone_completed", entity_id: milestone.project_id,
          event_key: `milestone-completed:${operationKey}:${milestoneId}:${participant.user_id}`,
          content: { title: "Project milestone completed", message: `“${milestone.name}” was completed.`, actionUrl: `/teams/${context.team.slug}/projects/${context.project.slug}` },
          metadata: { milestone_id: milestoneId },
        });
      }
    }
    return toApp(updated);
  });
  return milestoneDto(row);
};

const deleteMilestone = async (milestoneId, actorId) => withTransaction(async (session) => {
  const milestone = toApp(await ProjectMilestone.findById(milestoneId).session(session).lean());
  if (!milestone) throw projectErrors.milestoneNotFound();
  const context = await authz.getContext(milestone.project_id, actorId, session);
  authz.requireManager(context);
  if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Reopen the project before removing milestones");
  if (milestone.status !== "planned") throw projectErrors.denied("Only planned milestones can be removed");
  const linkedTasks = await ProjectTask.countDocuments({ project_id: milestone.project_id, milestone_id: milestoneId }).session(session);
  if (linkedTasks) throw errors.conflict("Move linked tasks before removing this milestone");
  const result = await ProjectMilestone.deleteOne({ _id: milestoneId, status: "planned" }, { session });
  if (result.deletedCount !== 1) throw projectErrors.staleWrite();
  await createProjectActivity(session, {
    team_id: context.team.id, project_id: milestone.project_id, actor_id: actorId,
    type: "milestone_updated", metadata: { action: "removed", name: milestone.name },
  });
  return { id: milestoneId, removed: true };
});

module.exports = { createMilestone, deleteMilestone, listMilestones, updateMilestone };
