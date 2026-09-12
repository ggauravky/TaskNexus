const { Project, ProjectParticipant, Team, TeamMembership } = require("../models");
const { toApp } = require("../models/helpers");
const { projectErrors } = require("../utils/projectErrors");

const MANAGER_TEAM_ROLES = new Set(["owner", "admin"]);

const findMembership = async (teamId, userId, session = null) => {
  if (!userId) return null;
  return toApp(await TeamMembership.findOne({ team_id: teamId, user_id: userId, status: "active" })
    .session(session).lean());
};

const findParticipant = async (projectId, userId, session = null) => {
  if (!userId) return null;
  return toApp(await ProjectParticipant.findOne({ project_id: projectId, user_id: userId, status: "active" })
    .session(session).lean());
};

const getContext = async (projectId, userId, session = null, options = {}) => {
  const project = toApp(await Project.findById(projectId).session(session).lean());
  if (!project || (!options.allowArchived && project.status === "archived")) throw projectErrors.notFound();
  const team = toApp(await Team.findOne({ _id: project.team_id, status: "active" }).session(session).lean());
  if (!team) throw projectErrors.notFound();
  const [membership, participant] = await Promise.all([
    findMembership(team.id, userId, session),
    findParticipant(project.id, userId, session),
  ]);
  return { project, team, membership, participant };
};

const isTeamManager = (context) => MANAGER_TEAM_ROLES.has(context.membership?.role);
const isProjectLead = (context) => context.participant?.role === "lead";
const isProjectContributor = (context) => context.participant?.role === "contributor";
const isEffectivePublic = (context) =>
  context.team.visibility === "public" && context.project.visibility === "public" && context.project.status !== "archived";

const requireVisible = (context) => {
  if (isEffectivePublic(context) || context.membership) return context;
  throw projectErrors.notFound();
};

const requireWorkspaceAccess = (context) => {
  if (!isEffectivePublic(context) && !context.membership) throw projectErrors.notFound();
  if (isTeamManager(context) || (context.membership && context.participant)) return context;
  throw projectErrors.denied("Project workspace access requires active participation");
};

const requireManager = (context) => {
  if (!isEffectivePublic(context) && !context.membership) throw projectErrors.notFound();
  if (isTeamManager(context) || (context.membership && isProjectLead(context))) return context;
  throw projectErrors.denied();
};

const requireTeamManager = (context) => {
  if (!isEffectivePublic(context) && !context.membership) throw projectErrors.notFound();
  if (isTeamManager(context)) return context;
  throw projectErrors.denied("Only the team owner or a team admin can perform this action");
};

const requireContributor = (context) => {
  if (!isEffectivePublic(context) && !context.membership) throw projectErrors.notFound();
  if (isTeamManager(context) || (context.membership && context.participant)) return context;
  throw projectErrors.participantRequired();
};

const permissions = (context) => {
  const teamManager = isTeamManager(context);
  const lead = Boolean(context.membership && isProjectLead(context));
  const contributor = Boolean(context.membership && isProjectContributor(context));
  const workspace = teamManager || lead || contributor;
  return {
    view_project: isEffectivePublic(context) || Boolean(context.membership),
    view_workspace: workspace,
    edit_project: teamManager || lead,
    archive_project: teamManager,
    complete_project: teamManager || lead,
    manage_participants: teamManager || lead,
    create_task: workspace,
    manage_tasks: teamManager || lead,
    update_assigned_task: workspace,
    manage_milestones: teamManager || lead,
    view_activity: workspace,
    view_settings: teamManager || lead,
    view_contributions: workspace,
    add_evidence: workspace,
    manage_repositories: teamManager || lead,
    manage_showcase: teamManager || lead,
  };
};

module.exports = {
  findMembership, findParticipant, getContext, isEffectivePublic, isProjectLead, isTeamManager,
  permissions, requireContributor, requireManager, requireTeamManager, requireVisible, requireWorkspaceAccess,
};
