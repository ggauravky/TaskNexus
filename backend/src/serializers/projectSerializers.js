const projectPermissions = (context, authz) => authz.permissions(context);

const projectSummary = (project, context = {}) => ({
  id: project.id,
  team: context.team ? { id: context.team.id, slug: context.team.slug, name: context.team.name, visibility: context.team.visibility } : null,
  slug: project.slug,
  name: project.name,
  tagline: project.tagline || null,
  status: project.status,
  visibility: project.visibility,
  effective_visibility: context.effectivePublic ? "public" : "team",
  target_date: project.target_date || null,
  skills: context.skills || [],
  tags: project.tags || [],
  participant_count: context.participantCount || 0,
  task_summary: context.taskSummary || { total: 0, done: 0, blocked: 0 },
  milestone_summary: context.milestoneSummary || { total: 0, completed: 0 },
  viewer_relationship: context.viewerRelationship || { kind: "none" },
  viewer_permissions: context.permissions || {},
  updated_at: project.updated_at || null,
  created_at: project.created_at || null,
});

const projectDetail = (project, context = {}) => ({
  ...projectSummary(project, context),
  description: project.description || null,
  start_date: project.start_date || null,
  completed_at: project.completed_at || null,
  repository_url: project.repository_url || null,
  demo_url: project.demo_url || null,
  created_by: context.createdBy || null,
  participants: context.participants || [],
});

const participant = (row, profile) => ({
  id: row.id, project_id: row.project_id, team_id: row.team_id, user_id: row.user_id,
  role: row.role, status: row.status, joined_at: row.joined_at, profile: profile || null,
});

const task = (row, context = {}) => ({
  id: row.id, project_id: row.project_id, title: row.title, description: row.description || null,
  status: row.status, priority: row.priority, assignees: (row.assignee_ids || []).map((id) => context.profiles?.get(id) || { id }),
  assignee_ids: row.assignee_ids || [], due_date: row.due_date || null, milestone_id: row.milestone_id || null,
  milestone: row.milestone_id ? context.milestones?.get(row.milestone_id) || null : null,
  created_by: context.profiles?.get(row.created_by) || { id: row.created_by }, completed_at: row.completed_at || null,
  revision: row.revision || 0, created_at: row.created_at, updated_at: row.updated_at,
});

const milestone = (row) => ({
  id: row.id, project_id: row.project_id, name: row.name, description: row.description || null,
  status: row.status, target_date: row.target_date || null, completed_at: row.completed_at || null,
  created_at: row.created_at, updated_at: row.updated_at,
});

module.exports = { milestone, participant, projectDetail, projectPermissions, projectSummary, task };
