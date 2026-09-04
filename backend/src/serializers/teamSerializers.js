const teamPermissions = (role) => ({
  view_members: Boolean(role),
  view_activity: Boolean(role),
  edit_team: role === "owner" || role === "admin",
  invite_members: role === "owner" || role === "admin",
  review_requests: role === "owner" || role === "admin",
  manage_roles: role === "owner",
  remove_members: role === "owner" || role === "admin",
  transfer_ownership: role === "owner",
  archive_team: role === "owner",
});

const teamSummary = (team, { memberCount = 0, owner = null, relationship = null } = {}) => ({
  id: team.id,
  slug: team.slug,
  name: team.name,
  tagline: team.tagline || null,
  avatar_url: team.avatar_url || null,
  visibility: team.visibility,
  join_policy: team.join_policy,
  status: team.status,
  member_count: memberCount,
  primary_interests: team.primary_interests || [],
  preferred_skills: team.preferred_skills || [],
  owner,
  viewer_relationship: relationship || { kind: "none" },
  created_at: team.created_at || null,
});

const teamDetail = (team, context = {}) => ({
  ...teamSummary(team, context),
  description: team.description || null,
  cover_url: team.cover_url || null,
  members_preview: context.membersPreview || [],
  viewer_permissions: teamPermissions(context.relationship?.role),
  updated_at: team.updated_at || null,
});

const membership = (row, profile) => ({
  id: row.id,
  team_id: row.team_id,
  user_id: row.user_id,
  role: row.role,
  status: row.status,
  joined_at: row.joined_at,
  profile: profile || null,
});

module.exports = { membership, teamDetail, teamPermissions, teamSummary };
