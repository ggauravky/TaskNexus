const locationDto = (item) => item ? ({ country: item.country || null, state: item.state || null, city: item.city || null, display: item.display || null }) : null;

const organizationPublicDto = (organization, context = {}) => ({
  id: organization.id, name: organization.name, slug: organization.slug, organization_type: organization.organization_type,
  tagline: organization.tagline || null, description: organization.description || null, logo_url: organization.logo_url || null,
  website_url: organization.website_url || null, industry: organization.industry || null, company_size: organization.company_size || null,
  headquarters: locationDto(organization.headquarters), locations: (organization.locations || []).map(locationDto),
  verification_status: organization.verification_status, active_opportunity_count: context.activeOpportunityCount ?? undefined,
});

const compensationDto = (value) => value ? ({ min_amount: value.min_amount ?? null, max_amount: value.max_amount ?? null, currency: value.currency || null, period: value.period || null }) : null;
const eligibilityRulesDto = (rules = {}) => ({
  eligible_degrees: rules.eligible_degrees || [], eligible_fields: rules.eligible_fields || [],
  graduation_year_min: rules.graduation_year_min ?? null, graduation_year_max: rules.graduation_year_max ?? null,
  experience_min_months: rules.experience_min_months ?? null, experience_max_months: rules.experience_max_months ?? null,
  minimum_cgpa: rules.minimum_cgpa ?? null, allowed_countries: rules.allowed_countries || [],
  work_authorization_notes: rules.work_authorization_notes || null, final_year_allowed: Boolean(rules.final_year_allowed),
  freshers_allowed: Boolean(rules.freshers_allowed), custom_notes: rules.custom_notes || null,
});

const candidateStateDto = (state) => state ? ({
  id: state.id, opportunity_id: state.opportunity_id, saved: Boolean(state.saved), application_status: state.application_status || null,
  applied_at: state.applied_at || null, notes: state.notes || null, external_application_url: state.external_application_url || null,
  source: "user_tracked", revision: state.revision, updated_at: state.updated_at || null,
}) : null;

const opportunityPublicDto = (opportunity, context = {}) => ({
  id: opportunity.id, organization: context.organization ? organizationPublicDto(context.organization) : null,
  type: opportunity.type, title: opportunity.title, slug: opportunity.slug, summary: opportunity.summary || null,
  description: context.detail ? opportunity.description || null : undefined,
  responsibilities: context.detail ? opportunity.responsibilities || [] : undefined,
  requirements: context.detail ? opportunity.requirements || [] : undefined,
  work_mode: opportunity.work_mode, locations: (opportunity.locations || []).map(locationDto), employment_type: opportunity.employment_type,
  duration: opportunity.duration || null, compensation: compensationDto(opportunity.compensation), application_url: opportunity.application_url,
  application_deadline: opportunity.application_deadline || null, start_date: opportunity.start_date || null,
  required_skills: context.requiredSkills || [], preferred_skills: context.preferredSkills || [],
  eligibility_rules: context.detail ? eligibilityRulesDto(opportunity.eligibility) : undefined,
  status: opportunity.status, is_open: Boolean(context.isOpen),
  source: { type: opportunity.source_type, url: opportunity.source_url || null, published_at: opportunity.source_published_at || null, last_verified_at: opportunity.last_verified_at || null },
  published_at: opportunity.published_at || null, expires_at: opportunity.expires_at || null,
});

const opportunityCandidateDto = (opportunity, context = {}) => ({
  ...opportunityPublicDto(opportunity, context),
  ...(context.includeCandidate ? {
    eligibility: context.eligibility || null,
    viewer_state: candidateStateDto(context.state),
  } : {}),
});

const opportunityAdminDto = (opportunity, context = {}) => ({
  ...opportunityCandidateDto(opportunity, { ...context, detail: true }), revision: opportunity.revision,
});

module.exports = { candidateStateDto, organizationPublicDto, opportunityAdminDto, opportunityCandidateDto, opportunityPublicDto };
