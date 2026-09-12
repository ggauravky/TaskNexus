const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { ContributionEvidence, Project, ProjectParticipant, Skill, Team, TeamMembership } = require("../models");
const { toApp } = require("../models/helpers");
const projectData = require("../data/projectData");
const teamData = require("../data/teamData");
const authz = require("./projectAuthorization");
const { createProjectActivity } = require("./projectDomain");
const { createParticipationEvidence, createRoleEvidence } = require("./contributionService");
const { projectDetail, projectSummary } = require("../serializers/projectSerializers");
const { errors } = require("../utils/appError");
const { projectError, projectErrors } = require("../utils/projectErrors");
const { ERROR_CODES, PROJECT_STATE_TRANSITIONS } = require("../config/constants");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { paginationMeta } = require("../utils/apiResponse");
const { parseListQuery } = require("../utils/queryOptions");
const { dateValue, httpsUrl, idList, slugify, stringList, text } = require("./projectValidation");

const trustedIn = (values) => mongoose.trusted({ $in: values });

const validateSkills = async (skillIds, session = null) => {
  if (!skillIds.length) return [];
  const count = await Skill.countDocuments({ _id: trustedIn(skillIds), is_active: true }).session(session);
  if (count !== skillIds.length) throw errors.validation("Every project skill must reference an active catalog skill");
  return skillIds;
};

const decorateProjects = async (projects, userId, knownTeams = new Map()) => {
  if (!projects.length) return [];
  const projectIds = projects.map((item) => item.id);
  const teamIds = [...new Set(projects.map((item) => item.team_id))];
  const missingTeamIds = teamIds.filter((id) => !knownTeams.has(id));
  if (missingTeamIds.length) {
    const rows = await Team.find({ _id: trustedIn(missingTeamIds), status: "active" }).lean();
    rows.forEach((row) => knownTeams.set(String(row._id), toApp(row)));
  }
  const [counts, skillMap, memberships, participations] = await Promise.all([
    projectData.projectCounts(projectIds),
    projectData.skillsByIds(projects.flatMap((item) => item.skill_ids || [])),
    userId ? TeamMembership.find({ team_id: trustedIn(teamIds), user_id: userId, status: "active" }).lean() : [],
    userId ? ProjectParticipant.find({ project_id: trustedIn(projectIds), user_id: userId, status: "active" }).lean() : [],
  ]);
  const membershipMap = new Map(memberships.map((item) => [item.team_id, toApp(item)]));
  const participantMap = new Map(participations.map((item) => [item.project_id, toApp(item)]));
  return projects.map((project) => {
    const team = knownTeams.get(project.team_id);
    if (!team) return null;
    const context = { project, team, membership: membershipMap.get(project.team_id) || null, participant: participantMap.get(project.id) || null };
    return projectSummary(project, {
      team, effectivePublic: authz.isEffectivePublic(context),
      skills: (project.skill_ids || []).map((id) => skillMap.get(id)).filter(Boolean),
      participantCount: counts.participants.get(project.id) || 0,
      taskSummary: counts.tasks.get(project.id), milestoneSummary: counts.milestones.get(project.id),
      viewerRelationship: context.participant ? { kind: "participant", role: context.participant.role } : context.membership ? { kind: "team_member", role: context.membership.role } : { kind: "none" },
      permissions: authz.permissions(context),
    });
  }).filter(Boolean);
};

const createProject = async (teamId, userId, input) => {
  const name = text(input.name, 100, "Project name", { required: true });
  const skillIds = idList(input.skillIds || input.skill_ids, 12, "Skills");
  const payload = {
    _id: randomUUID(), team_id: teamId, name, slug: slugify(input.slug || name),
    tagline: text(input.tagline, 180, "Tagline"), description: text(input.description, 5000, "Description"),
    status: "planning", visibility: input.visibility || "team", created_by: userId,
    start_date: dateValue(input.startDate || input.start_date, "Start date"),
    target_date: dateValue(input.targetDate || input.target_date, "Target date"),
    skill_ids: skillIds, tags: stringList(input.tags, 8, "Tags"),
    repository_url: httpsUrl(input.repositoryUrl || input.repository_url, "Repository URL"),
    demo_url: httpsUrl(input.demoUrl || input.demo_url, "Demo URL"), completed_at: null,
  };
  if (!payload.slug) throw errors.validation("A valid project slug is required");
  try {
    await withTransaction(async (session) => {
      const team = toApp(await Team.findOne({ _id: teamId, status: "active" }).session(session).lean());
      if (!team) throw projectErrors.notFound();
      const membership = toApp(await TeamMembership.findOne({ team_id: teamId, user_id: userId, status: "active" }).session(session).lean());
      if (!membership || !new Set(["owner", "admin"]).has(membership.role)) throw projectErrors.denied("Only the team owner or a team admin can create projects");
      if (team.visibility === "private") payload.visibility = "team";
      await validateSkills(skillIds, session);
      await Project.create([payload], { session });
      const [participant] = await ProjectParticipant.create([{
        _id: randomUUID(), team_id: teamId, project_id: payload._id, user_id: userId,
        role: "lead", status: "active", joined_at: new Date(),
      }], { session });
      await createParticipationEvidence(session, toApp(participant), userId);
      await createRoleEvidence(session, toApp(participant), userId);
      await createProjectActivity(session, {
        team_id: teamId, project_id: payload._id, actor_id: userId, type: "project_created",
      });
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw projectError(ERROR_CODES.PROJECT_SLUG_TAKEN, "That project slug is already in use for this team", 409);
    throw error;
  }
  return getProject(payload._id, userId);
};

const listTeamProjects = async (teamId, userId, query) => {
  const team = toApp(await Team.findOne({ _id: teamId, status: "active" }).lean());
  if (!team) throw projectErrors.notFound();
  const membership = userId ? toApp(await TeamMembership.findOne({ team_id: teamId, user_id: userId, status: "active" }).lean()) : null;
  if (team.visibility === "private" && !membership) throw projectErrors.notFound();
  const options = parseListQuery(query, { allowedSorts: ["updated_at"], defaultLimit: 12, maxLimit: 30 });
  const result = await projectData.listForTeam(teamId, {
    ...options, publicOnly: !membership,
    status: ["planning", "active", "completed"].includes(query.status) ? query.status : null,
    skillId: typeof query.skillId === "string" ? query.skillId : null,
    participantId: typeof query.participantId === "string" ? query.participantId : null,
  });
  return { items: await decorateProjects(result.items, userId, new Map([[team.id, team]])), meta: paginationMeta(result) };
};

const listMyProjects = async (userId, query) => {
  const options = parseListQuery(query, { allowedSorts: ["updated_at"], defaultLimit: 20, maxLimit: 50 });
  const result = await projectData.listMine(userId, {
    ...options, status: ["planning", "active", "completed"].includes(query.status) ? query.status : null,
    role: ["lead", "contributor"].includes(query.role) ? query.role : null,
  });
  return { items: await decorateProjects(result.items, userId), meta: paginationMeta(result) };
};

const getProject = async (projectId, userId, options = {}) => {
  const context = await authz.getContext(projectId, userId, null, options);
  authz.requireVisible(context);
  const [counts, skillMap, participantRows, creatorMap] = await Promise.all([
    projectData.projectCounts([projectId]),
    projectData.skillsByIds(context.project.skill_ids || []),
    projectData.listParticipants(projectId, { page: 1, limit: 50 }),
    teamData.profileSummaries([context.project.created_by], { publicOnly: true }),
  ]);
  const profiles = await teamData.profileSummaries(participantRows.items.map((item) => item.user_id), { publicOnly: true });
  const participants = participantRows.items.map((row) => ({
    id: row.id, user_id: row.user_id, role: row.role, joined_at: row.joined_at,
    show_on_profile: Boolean(row.show_on_profile), profile: profiles.get(row.user_id) || null,
  }));
  return projectDetail(context.project, {
    team: context.team, effectivePublic: authz.isEffectivePublic(context),
    skills: (context.project.skill_ids || []).map((id) => skillMap.get(id)).filter(Boolean),
    participantCount: counts.participants.get(projectId) || 0,
    taskSummary: counts.tasks.get(projectId), milestoneSummary: counts.milestones.get(projectId),
    viewerRelationship: context.participant ? { kind: "participant", role: context.participant.role } : context.membership ? { kind: "team_member", role: context.membership.role } : { kind: "none" },
    permissions: authz.permissions(context), participants, createdBy: creatorMap.get(context.project.created_by) || null,
  });
};

const getProjectBySlugs = async (teamSlug, projectSlug, userId) => {
  const { team, project } = await projectData.findBySlugs(teamSlug, projectSlug);
  if (!team || !project || project.status === "archived") throw projectErrors.notFound();
  return getProject(project.id, userId);
};

const updateProject = async (projectId, userId, input) => {
  try {
    await withTransaction(async (session) => {
      const context = await authz.getContext(projectId, userId, session);
      authz.requireManager(context);
      if (context.project.status === "completed") throw projectErrors.denied("Reopen the project before editing it");
      const updates = {};
      if (input.name !== undefined) updates.name = text(input.name, 100, "Project name", { required: true });
      if (input.slug !== undefined) updates.slug = slugify(input.slug);
      if (input.tagline !== undefined) updates.tagline = text(input.tagline, 180, "Tagline");
      if (input.description !== undefined) updates.description = text(input.description, 5000, "Description");
      if (input.visibility !== undefined) updates.visibility = context.team.visibility === "private" ? "team" : input.visibility;
      if (input.startDate !== undefined || input.start_date !== undefined) updates.start_date = dateValue(input.startDate ?? input.start_date, "Start date");
      if (input.targetDate !== undefined || input.target_date !== undefined) updates.target_date = dateValue(input.targetDate ?? input.target_date, "Target date");
      if (input.skillIds !== undefined || input.skill_ids !== undefined) {
        updates.skill_ids = await validateSkills(idList(input.skillIds || input.skill_ids, 12, "Skills"), session);
      }
      if (input.tags !== undefined) updates.tags = stringList(input.tags, 8, "Tags");
      if (input.repositoryUrl !== undefined || input.repository_url !== undefined) updates.repository_url = httpsUrl(input.repositoryUrl ?? input.repository_url, "Repository URL");
      if (input.demoUrl !== undefined || input.demo_url !== undefined) updates.demo_url = httpsUrl(input.demoUrl ?? input.demo_url, "Demo URL");
      if (!updates.slug && input.slug !== undefined) throw errors.validation("A valid project slug is required");
      if (!Object.keys(updates).length) throw errors.validation("No editable project fields supplied");
      const updated = await Project.findOneAndUpdate(
        { _id: projectId, status: mongoose.trusted({ $ne: "archived" }) }, { $set: updates },
        { session, returnDocument: "after", runValidators: true },
      ).lean();
      if (!updated) throw projectErrors.notFound();
      await createProjectActivity(session, {
        team_id: context.team.id, project_id: projectId, actor_id: userId,
        type: "project_updated", metadata: { fields: Object.keys(updates) },
      });
    });
    return getProject(projectId, userId);
  } catch (error) {
    if (isDuplicateKey(error)) throw projectError(ERROR_CODES.PROJECT_SLUG_TAKEN, "That project slug is already in use for this team", 409);
    throw error;
  }
};

const transitionProject = async (projectId, userId, targetStatus) => {
  await withTransaction(async (session) => {
    const context = await authz.getContext(projectId, userId, session);
    if (targetStatus === "archived") authz.requireTeamManager(context); else authz.requireManager(context);
    const allowed = PROJECT_STATE_TRANSITIONS[context.project.status] || [];
    if (!allowed.includes(targetStatus)) throw errors.invalidTransition(`Project cannot move from ${context.project.status} to ${targetStatus}`);
    const now = new Date();
    const completionEvidence = targetStatus === "completed" ? await ContributionEvidence.find({
      project_id: projectId, status: "active",
    }).sort({ occurred_at: -1 }).limit(100).select("_id").session(session).lean() : null;
    const statusUpdates = { status: targetStatus, completed_at: targetStatus === "completed" ? now : null };
    if (completionEvidence) {
      statusUpdates.completion_evidence_ids = completionEvidence.map((item) => String(item._id));
      statusUpdates.completion_evidence_captured_at = now;
    }
    const updated = await Project.findOneAndUpdate(
      { _id: projectId, status: context.project.status },
      { $set: statusUpdates },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw projectErrors.staleWrite();
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: projectId, actor_id: userId, type: "project_status_changed",
      metadata: { from: context.project.status, to: targetStatus },
    });
  });
  return targetStatus === "archived" ? { id: projectId, status: "archived" } : getProject(projectId, userId);
};

const listActivity = async (projectId, userId, query) => {
  const context = await authz.getContext(projectId, userId);
  authz.requireWorkspaceAccess(context);
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 30, maxLimit: 50 });
  const result = await projectData.listActivity(projectId, options);
  const profiles = await teamData.profileSummaries(
    result.items.flatMap((item) => [item.actor_id, item.target_user_id]), { publicOnly: true },
  );
  return {
    items: result.items.map((item) => ({
      id: item.id, project_id: item.project_id, type: item.type, entity_id: item.entity_id || null,
      actor: profiles.get(item.actor_id) || null, target_user: profiles.get(item.target_user_id) || null,
      metadata: item.metadata || {}, created_at: item.created_at,
    })),
    meta: paginationMeta(result),
  };
};

module.exports = {
  createProject, decorateProjects, getProject, getProjectBySlugs, listActivity, listMyProjects, listTeamProjects,
  transitionProject, updateProject,
};
