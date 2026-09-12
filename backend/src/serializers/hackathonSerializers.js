const locationDto = (hackathon) => (
  hackathon.mode === "online" ? null : { city: hackathon.city || null, venue: hackathon.venue || null }
);

const hackathonCard = (hackathon, context = {}) => ({
  id: hackathon.id,
  slug: hackathon.slug,
  name: hackathon.name,
  tagline: hackathon.tagline || null,
  organizer_name: hackathon.organizer_name,
  logo_url: hackathon.logo_url || null,
  mode: hackathon.mode,
  location: locationDto(hackathon),
  registration_start: hackathon.registration_start || null,
  registration_deadline: hackathon.registration_deadline || null,
  event_start: hackathon.event_start,
  event_end: hackathon.event_end,
  submission_deadline: hackathon.submission_deadline || null,
  team_size: { min: hackathon.team_min_size || null, max: hackathon.team_max_size || null },
  themes: hackathon.themes || [],
  status: hackathon.status,
  viewer_participation: context.participation || null,
  viewer_team: context.team || null,
  updated_at: hackathon.updated_at || null,
});

const hackathonDetail = (hackathon, context = {}) => ({
  ...hackathonCard(hackathon, context),
  description: hackathon.description || null,
  website_url: hackathon.website_url || null,
  registration_url: hackathon.registration_url || null,
  cover_url: hackathon.cover_url || null,
  allowed_roles: hackathon.allowed_roles || [],
  recommended_skills: context.skills || [],
  submission_requirements: (hackathon.submission_requirements || []).map((item) => ({
    type: item.type, label: item.label, required: Boolean(item.required),
  })),
  registered_team_count: context.registeredTeamCount || 0,
  viewer_permissions: context.permissions || { participate: false, manage_catalog: false },
});

const participationDto = (row) => row ? ({
  id: row.id,
  hackathon_id: row.hackathon_id,
  status: row.status,
  looking_for_team: Boolean(row.looking_for_team),
  preferred_roles: row.preferred_roles || [],
  preferred_skill_ids: row.preferred_skill_ids || [],
  commitment: row.commitment,
  message: row.message || null,
  visible_on_hackathon: Boolean(row.visible_on_hackathon),
  joined_at: row.joined_at,
  updated_at: row.updated_at || null,
}) : null;

const teamRegistrationDto = (row, context = {}) => row ? ({
  id: row.id,
  hackathon_id: row.hackathon_id,
  status: row.status,
  team: context.team || null,
  project: context.project || null,
  submission: context.submission || null,
  eligibility: {
    eligible: !row.eligibility_warning,
    warning: row.eligibility_warning ? row.eligibility_message : null,
    active_member_count: context.memberCount ?? null,
  },
  revision: row.revision,
  viewer_permissions: context.permissions || {},
  created_at: row.created_at || null,
  updated_at: row.updated_at || null,
}) : null;

const submissionDto = (row, readiness = null) => row ? ({
  id: row.id,
  hackathon_id: row.hackathon_id,
  hackathon_team_id: row.hackathon_team_id,
  team_id: row.team_id,
  project_id: row.project_id,
  status: row.status,
  repository_url: row.repository_url || null,
  demo_url: row.demo_url || null,
  presentation_url: row.presentation_url || null,
  video_url: row.video_url || null,
  submission_url: row.submission_url || null,
  checklist: (row.checklist || []).map((item) => ({ type: item.type, label: item.label, required: Boolean(item.required), completed: Boolean(item.completed) })),
  readiness: readiness || null,
  submitted_at: row.submitted_at || null,
  revision: row.revision,
  created_at: row.created_at || null,
  updated_at: row.updated_at || null,
}) : null;

module.exports = { hackathonCard, hackathonDetail, participationDto, submissionDto, teamRegistrationDto };
