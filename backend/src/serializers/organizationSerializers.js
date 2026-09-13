const organizationPermissions = (role) => ({
  view_workspace: Boolean(role),
  edit_organization: role === "owner" || role === "admin",
  manage_members: role === "owner" || role === "admin",
  invite_members: role === "owner" || role === "admin",
  create_opportunities: Boolean(role),
  edit_opportunities: Boolean(role),
  publish_opportunities: Boolean(role),
  view_applicants: Boolean(role),
  change_application_stage: Boolean(role),
  transfer_ownership: role === "owner",
  archive_management: role === "owner",
});

const memberDto = (membership, profile = null) => ({
  id: membership.id, organization_id: membership.organization_id, user_id: membership.user_id,
  role: membership.role, status: membership.status, joined_at: membership.joined_at || null,
  profile,
});

const invitationDto = (invitation, context = {}) => ({
  id: invitation.id, organization_id: invitation.organization_id,
  invited_user_id: invitation.invited_user_id, invited_by: invitation.invited_by,
  role: invitation.role, status: invitation.status, message: invitation.message || null,
  expires_at: invitation.expires_at || null, created_at: invitation.created_at || null,
  responded_at: invitation.responded_at || null,
  organization: context.organization || undefined,
  invited_user: context.invitedUser || undefined,
  invited_by_user: context.invitedByUser || undefined,
});

const applicationActivityDto = (activity) => ({
  id: activity.id, application_id: activity.application_id, type: activity.type,
  actor_id: activity.actor_id, from_stage: activity.from_stage || null,
  to_stage: activity.to_stage, created_at: activity.created_at,
});

const candidateApplicationDto = (application, context = {}) => ({
  id: application.id, opportunity_id: application.opportunity_id,
  organization_id: application.organization_id, stage: application.stage,
  submitted_at: application.submitted_at, withdrawn_at: application.withdrawn_at || null,
  revision: application.revision,
  opportunity: context.opportunity || null,
  organization: context.organization || null,
  activity: (context.activity || []).map(applicationActivityDto),
  shared_snapshot: context.includeSnapshot ? application.submitted_profile_snapshot : undefined,
});

const applicantSummaryDto = (application) => ({
  id: application.id, opportunity_id: application.opportunity_id, stage: application.stage,
  submitted_at: application.submitted_at, revision: application.revision,
  candidate: {
    display_name: application.submitted_profile_snapshot.display_name,
    username: application.submitted_profile_snapshot.username || null,
    headline: application.submitted_profile_snapshot.headline || null,
    avatar_url: application.submitted_profile_snapshot.avatar_url || null,
    education: application.submitted_profile_snapshot.education || [],
    skills: application.submitted_profile_snapshot.skills || [],
    projects: application.submitted_profile_snapshot.projects || [],
  },
});

const applicantDetailDto = (application, context = {}) => ({
  ...applicantSummaryDto(application),
  cover_note: application.cover_note || null,
  selected_project_ids: application.selected_project_ids || [],
  selected_evidence_ids: application.selected_evidence_ids || [],
  candidate: { ...applicantSummaryDto(application).candidate, evidence: application.submitted_profile_snapshot.evidence || [] },
  opportunity: context.opportunity || null,
  activity: (context.activity || []).map(applicationActivityDto),
});

module.exports = {
  applicantDetailDto, applicantSummaryDto, applicationActivityDto, candidateApplicationDto,
  invitationDto, memberDto, organizationPermissions,
};
