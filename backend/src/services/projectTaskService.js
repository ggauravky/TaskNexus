const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { ProjectMilestone, ProjectParticipant, ProjectTask, TeamMembership } = require("../models");
const { toApp } = require("../models/helpers");
const projectData = require("../data/projectData");
const teamData = require("../data/teamData");
const authz = require("./projectAuthorization");
const { createProjectActivity, createProjectNotification } = require("./projectDomain");
const { createTaskCompletionEvidence, revokeTaskCompletionEvidence } = require("./contributionService");
const { task: taskDto, milestone: milestoneDto } = require("../serializers/projectSerializers");
const { PROJECT_TASK_TRANSITIONS } = require("../config/constants");
const { errors } = require("../utils/appError");
const { projectErrors } = require("../utils/projectErrors");
const { withTransaction } = require("../utils/transactions");
const { parseListQuery } = require("../utils/queryOptions");
const { paginationMeta } = require("../utils/apiResponse");
const { dateValue, idList, text } = require("./projectValidation");

const trustedIn = (values) => mongoose.trusted({ $in: values });

const validateAssignees = async (session, context, userIds) => {
  if (!userIds.length) return [];
  const [participantRows, memberships] = await Promise.all([
    ProjectParticipant.find({ project_id: context.project.id, user_id: trustedIn(userIds), status: "active" }).session(session).select("_id").lean(),
    TeamMembership.countDocuments({ team_id: context.team.id, user_id: trustedIn(userIds), status: "active" }).session(session),
  ]);
  if (participantRows.length !== userIds.length || memberships !== userIds.length) {
    throw errors.validation("Assignees must be active project participants and active team members");
  }
  const fence = await ProjectParticipant.updateMany(
    { _id: trustedIn(participantRows.map((item) => String(item._id))), status: "active" },
    { $inc: { assignment_epoch: 1 } }, { session },
  );
  if (fence.modifiedCount !== userIds.length) {
    throw errors.validation("Assignees must remain active project participants");
  }
  return userIds;
};

const validateMilestone = async (session, projectId, milestoneId) => {
  if (!milestoneId) return null;
  const exists = await ProjectMilestone.exists({ _id: milestoneId, project_id: projectId }).session(session);
  if (!exists) throw errors.validation("Milestone does not belong to this project");
  return milestoneId;
};

const decorateTasks = async (rows) => {
  const userIds = rows.flatMap((row) => [row.created_by, ...(row.assignee_ids || [])]);
  const milestoneIds = [...new Set(rows.map((row) => row.milestone_id).filter(Boolean))];
  const [profiles, milestones] = await Promise.all([
    teamData.profileSummaries(userIds, { publicOnly: true }),
    milestoneIds.length ? ProjectMilestone.find({ _id: trustedIn(milestoneIds) }).lean() : [],
  ]);
  const milestoneMap = new Map(milestones.map((row) => [String(row._id), milestoneDto(toApp(row))]));
  return rows.map((row) => taskDto(row, { profiles, milestones: milestoneMap }));
};

const listTasks = async (projectId, userId, query) => {
  const context = await authz.getContext(projectId, userId);
  authz.requireWorkspaceAccess(context);
  const options = parseListQuery(query, { allowedSorts: ["updated_at"], defaultLimit: 50, maxLimit: 100 });
  const result = await projectData.listTasks(projectId, {
    ...options,
    status: query.status, priority: query.priority,
    assigneeId: query.assigneeId, milestoneId: query.milestoneId,
  });
  return { items: await decorateTasks(result.items), meta: paginationMeta(result) };
};

const getTaskContext = async (taskId, userId, session = null) => {
  const row = toApp(await ProjectTask.findById(taskId).session(session).lean());
  if (!row) throw projectErrors.taskNotFound();
  const context = await authz.getContext(row.project_id, userId, session);
  authz.requireWorkspaceAccess(context);
  return { row, context };
};

const getTask = async (taskId, userId) => {
  const { row } = await getTaskContext(taskId, userId);
  return (await decorateTasks([row]))[0];
};

const createTask = async (projectId, actorId, input) => {
  const title = text(input.title, 180, "Task title", { required: true });
  const assigneeIds = idList(input.assigneeIds || input.assignee_ids, 12, "Assignees");
  const operationKey = randomUUID();
  const id = randomUUID();
  await withTransaction(async (session) => {
    const context = await authz.getContext(projectId, actorId, session);
    authz.requireContributor(context);
    if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Tasks cannot be created in this project state");
    if (assigneeIds.length) authz.requireManager(context);
    await validateAssignees(session, context, assigneeIds);
    const milestoneId = await validateMilestone(session, projectId, input.milestoneId || input.milestone_id || null);
    const payload = {
      _id: id, team_id: context.team.id, project_id: projectId, title,
      description: text(input.description, 5000, "Description"), status: "todo",
      priority: input.priority || "medium", created_by: actorId, assignee_ids: assigneeIds,
      due_date: dateValue(input.dueDate || input.due_date, "Due date"), milestone_id: milestoneId,
      completed_at: null, revision: 0,
    };
    await ProjectTask.create([payload], { session });
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: id,
      type: "task_created", metadata: { title },
    });
    for (const userId of assigneeIds.filter((value) => value !== actorId)) {
      await createProjectNotification(session, {
        recipient_id: userId, actor_id: actorId, type: "project_task_assigned", entity_id: projectId,
        event_key: `task-assigned:${operationKey}:${id}:${userId}`,
        content: { title: "Project task assigned", message: `You were assigned “${title}”.`, actionUrl: `/teams/${context.team.slug}/projects/${context.project.slug}` },
        metadata: { task_id: id },
      });
    }
  });
  return getTask(id, actorId);
};

const updateTask = async (taskId, actorId, input) => {
  const result = await withTransaction(async (session) => {
  const { row, context } = await getTaskContext(taskId, actorId, session);
  authz.requireManager(context);
  if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Reopen the project before editing tasks");
  const revision = Number(input.revision);
  if (!Number.isInteger(revision) || revision < 0) throw errors.validation("Current task revision is required");
  const updates = {};
  if (input.title !== undefined) updates.title = text(input.title, 180, "Task title", { required: true });
  if (input.description !== undefined) updates.description = text(input.description, 5000, "Description");
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.dueDate !== undefined || input.due_date !== undefined) updates.due_date = dateValue(input.dueDate ?? input.due_date, "Due date");
  if (input.milestoneId !== undefined || input.milestone_id !== undefined) {
    updates.milestone_id = await validateMilestone(session, row.project_id, input.milestoneId ?? input.milestone_id);
  }
  if (!Object.keys(updates).length) throw errors.validation("No editable task fields supplied");
  const updated = await ProjectTask.findOneAndUpdate(
    { _id: taskId, project_id: row.project_id, revision }, { $set: updates, $inc: { revision: 1 } },
    { session, returnDocument: "after", runValidators: true },
  ).lean();
  if (!updated) throw projectErrors.staleWrite();
  await createProjectActivity(session, {
    team_id: context.team.id, project_id: row.project_id, actor_id: actorId, entity_id: taskId,
    type: "task_updated", metadata: { fields: Object.keys(updates) },
  });
    return toApp(updated);
  });
  return (await decorateTasks([result]))[0];
};

const setAssignees = async (taskId, actorId, input) => {
  const assigneeIds = idList(input.assigneeIds || input.assignee_ids, 12, "Assignees");
  const revision = Number(input.revision);
  if (!Number.isInteger(revision) || revision < 0) throw errors.validation("Current task revision is required");
  const operationKey = randomUUID();
  const result = await withTransaction(async (session) => {
    const { row, context } = await getTaskContext(taskId, actorId, session);
    authz.requireManager(context);
    if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Reopen the project before changing assignments");
    if (row.status === "done") throw projectErrors.denied("Completed task assignments are preserved as history");
    await validateAssignees(session, context, assigneeIds);
    const updated = await ProjectTask.findOneAndUpdate(
      { _id: taskId, revision, status: mongoose.trusted({ $ne: "done" }) },
      { $set: { assignee_ids: assigneeIds }, $inc: { revision: 1 } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw projectErrors.staleWrite();
    const previous = new Set(row.assignee_ids || []);
    const added = assigneeIds.filter((id) => !previous.has(id));
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: row.project_id, actor_id: actorId, entity_id: taskId,
      type: "task_assigned", metadata: { assignee_ids: assigneeIds },
    });
    for (const userId of added.filter((value) => value !== actorId)) {
      await createProjectNotification(session, {
        recipient_id: userId, actor_id: actorId, type: "project_task_assigned", entity_id: row.project_id,
        event_key: `task-assigned:${operationKey}:${taskId}:${userId}`,
        content: { title: "Project task assigned", message: `You were assigned “${row.title}”.`, actionUrl: `/teams/${context.team.slug}/projects/${context.project.slug}` },
        metadata: { task_id: taskId },
      });
    }
    return toApp(updated);
  });
  return (await decorateTasks([result]))[0];
};

const removeAssignee = async (taskId, targetUserId, actorId, revision) => {
  const numericRevision = Number(revision);
  if (!Number.isInteger(numericRevision) || numericRevision < 0) throw errors.validation("Current task revision is required");
  const result = await withTransaction(async (session) => {
    const { row, context } = await getTaskContext(taskId, actorId, session);
    authz.requireManager(context);
    if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Reopen the project before changing assignments");
    if (row.status === "done") throw projectErrors.denied("Completed task assignments are preserved as history");
    const updated = await ProjectTask.findOneAndUpdate(
      { _id: taskId, revision: numericRevision, assignee_ids: targetUserId, status: mongoose.trusted({ $ne: "done" }) },
      { $pull: { assignee_ids: targetUserId }, $inc: { revision: 1 } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw projectErrors.staleWrite();
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: row.project_id, actor_id: actorId, entity_id: taskId,
      target_user_id: targetUserId, type: "task_assigned", metadata: { removed_assignee_id: targetUserId },
    });
    return toApp(updated);
  });
  return (await decorateTasks([result]))[0];
};

const changeStatus = async (taskId, actorId, input) => {
  const revision = Number(input.revision);
  const status = input.status;
  if (!Number.isInteger(revision) || revision < 0) throw errors.validation("Current task revision is required");
  const operationKey = randomUUID();
  const result = await withTransaction(async (session) => {
    const { row, context } = await getTaskContext(taskId, actorId, session);
    if (!new Set(["planning", "active"]).has(context.project.status)) throw projectErrors.denied("Reopen the project before changing task status");
    const manager = authz.isTeamManager(context) || authz.isProjectLead(context);
    const assigned = Boolean(context.membership && context.participant && (row.assignee_ids || []).includes(actorId));
    if (!manager && !assigned) throw projectErrors.denied("Only project managers or task assignees can change task status");
    const allowed = PROJECT_TASK_TRANSITIONS[row.status] || [];
    if (!allowed.includes(status)) throw errors.invalidTransition(`Task cannot move from ${row.status} to ${status}`);
    if (!manager) {
      const assigneeTransitions = new Set(["todo:in_progress", "todo:blocked", "in_progress:blocked", "blocked:in_progress", "in_progress:done"]);
      if (!assigneeTransitions.has(`${row.status}:${status}`)) throw projectErrors.denied("That task transition requires a project manager");
    }
    const now = new Date();
    const updated = await ProjectTask.findOneAndUpdate(
      { _id: taskId, revision, status: row.status },
      { $set: { status, completed_at: status === "done" ? now : null }, $inc: { revision: 1 } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw projectErrors.staleWrite();
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: row.project_id, actor_id: actorId, entity_id: taskId,
      type: status === "done" ? "task_completed" : "task_status_changed", metadata: { from: row.status, to: status, title: row.title },
    });
    if (status === "done") {
      await createTaskCompletionEvidence(session, toApp(updated), actorId);
      const recipients = [...new Set([row.created_by, ...(row.assignee_ids || [])])].filter((id) => id !== actorId);
      for (const userId of recipients) {
        await createProjectNotification(session, {
          recipient_id: userId, actor_id: actorId, type: "project_task_completed", entity_id: row.project_id,
          event_key: `task-completed:${operationKey}:${taskId}:${userId}`,
          content: { title: "Project task completed", message: `“${row.title}” was completed.`, actionUrl: `/teams/${context.team.slug}/projects/${context.project.slug}` },
          metadata: { task_id: taskId },
        });
      }
    } else if (row.status === "done") {
      const revoked = await revokeTaskCompletionEvidence(session, taskId, actorId);
      await createProjectActivity(session, {
        team_id: context.team.id, project_id: row.project_id, actor_id: actorId, entity_id: taskId,
        type: "evidence_revoked", metadata: { reason: "task_reopened", evidence_count: revoked.modifiedCount },
      });
    }
    return toApp(updated);
  });
  return (await decorateTasks([result]))[0];
};

module.exports = { changeStatus, createTask, decorateTasks, getTask, listTasks, removeAssignee, setAssignees, updateTask };
