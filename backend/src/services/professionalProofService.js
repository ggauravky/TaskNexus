const mongoose = require("mongoose");
const {
  ContributionEvidence,
  Project,
  ProjectParticipant,
  ProjectShowcase,
  Skill,
  Team,
  UserProfile,
  UserSkill,
} = require("../models");
const { toApps } = require("../models/helpers");
const {
  PROOF_LIMITS,
  proofConnectionDto,
  proofEvidenceDto,
  proofProjectDto,
  relevantProofDto,
} = require("../serializers/proofSerializers");
const { errors } = require("../utils/appError");

const trustedIn = (values) => mongoose.trusted({ $in: values });
const unique = (values) => [...new Set(values.filter(Boolean).map(String))];
const idOf = (row) => String(row?.id ?? row?._id);
const byId = (rows) => new Map(rows.map((row) => [idOf(row), row]));

const readRows = async (query, { select, sort, limit, session } = {}) => {
  if (session) query = query.session(session);
  if (select) query = query.select(select);
  if (sort) query = query.sort(sort);
  if (limit) query = query.limit(limit);
  return toApps(await query.lean());
};

const evidencePipeline = (userId, projectIds, previewLimit) => ([
  { $match: { user_id: userId, project_id: trustedIn(projectIds), status: "active", public_safe: true } },
  { $sort: { project_id: 1, occurred_at: -1, _id: 1 } },
  {
    $group: {
      _id: "$project_id",
      total: { $sum: 1 },
      internal_verified: { $sum: { $cond: [{ $eq: ["$verification_level", "internal_verified"] }, 1, 0] } },
      external_verified: { $sum: { $cond: [{ $eq: ["$verification_level", "external_verified"] }, 1, 0] } },
      unverified: { $sum: { $cond: [{ $eq: ["$verification_level", "unverified"] }, 1, 0] } },
      evidence: {
        $push: {
          id: "$_id",
          project_id: "$project_id",
          evidence_type: "$evidence_type",
          verification_level: "$verification_level",
          title: "$title",
          source_url: "$source_url",
          occurred_at: "$occurred_at",
        },
      },
    },
  },
  {
    $project: {
      total: 1,
      internal_verified: 1,
      external_verified: 1,
      unverified: 1,
      evidence: { $slice: ["$evidence", previewLimit] },
    },
  },
]);

const sortProjects = (left, right) => {
  const timeDifference = new Date(right.completed_at || 0).getTime() - new Date(left.completed_at || 0).getTime();
  return timeDifference || idOf(left).localeCompare(idOf(right));
};

const projectTarget = (project, team, showcase) => showcase
  ? `/showcase/${team.slug}/${project.slug}`
  : `/teams/${team.slug}/projects/${project.slug}`;

const loadEvidenceGroups = async (userId, projectIds, previewLimit) => {
  if (!projectIds.length) return new Map();
  const rows = await ContributionEvidence.aggregate(evidencePipeline(userId, projectIds, previewLimit));
  return new Map(rows.map((row) => [String(row._id), {
    total: row.total,
    internal_verified: row.internal_verified,
    external_verified: row.external_verified,
    unverified: row.unverified,
    evidence: (row.evidence || []).map((item) => ({ ...item, id: idOf(item) })),
  }]));
};

const loadProofBundle = async ({
  userId,
  requirePublicProfile = false,
  requireProfileOptIn = false,
  requirePublishedShowcase = false,
  requiredSkillIds = null,
  uniqueProjectLimit = PROOF_LIMITS.uniqueProjects,
  projectsPerSkill = PROOF_LIMITS.projectsPerSkill,
  evidencePreviewLimit = PROOF_LIMITS.profileEvidencePreview,
  includeApplicationFields = false,
}) => {
  if (requirePublicProfile) {
    const publicProfile = await UserProfile.exists({ _id: userId, visibility: "public" });
    if (!publicProfile) return { connections: [], projects: [], applicationProjects: [] };
  }

  const participantFilter = { user_id: userId, status: "active" };
  if (requireProfileOptIn) participantFilter.show_on_profile = true;
  const [participants, userSkills] = await Promise.all([
    readRows(ProjectParticipant.find(participantFilter), {
      select: "_id project_id team_id role show_on_profile updated_at",
      sort: { updated_at: -1, _id: 1 },
      limit: PROOF_LIMITS.participantCandidates,
    }),
    readRows(UserSkill.find({ user_id: userId }), {
      select: "_id skill_id is_primary created_at",
      sort: { is_primary: -1, created_at: 1, _id: 1 },
      limit: PROOF_LIMITS.profileSkills,
    }),
  ]);
  if (!participants.length) return { connections: [], projects: [], applicationProjects: [] };

  const participantProjectIds = unique(participants.map((row) => row.project_id));
  const projects = await readRows(Project.find({
    _id: trustedIn(participantProjectIds), status: "completed", visibility: "public",
  }), {
    select: "_id team_id name slug tagline completed_at skill_ids repository_url demo_url",
  });
  if (!projects.length) return { connections: [], projects: [], applicationProjects: [] };

  const teams = await readRows(Team.find({
    _id: trustedIn(unique(projects.map((row) => row.team_id))), status: "active", visibility: "public",
  }), { select: "_id name slug" });
  const teamMap = byId(teams);
  let effectiveProjects = projects.filter((project) => teamMap.has(String(project.team_id)));
  if (!effectiveProjects.length) return { connections: [], projects: [], applicationProjects: [] };

  const showcases = await readRows(ProjectShowcase.find({
    project_id: trustedIn(effectiveProjects.map(idOf)), status: "published",
  }), { select: "_id project_id status headline summary hero_image_url published_at" });
  const showcaseMap = new Map(showcases.map((row) => [String(row.project_id), row]));
  if (requirePublishedShowcase) effectiveProjects = effectiveProjects.filter((project) => showcaseMap.has(idOf(project)));
  if (!effectiveProjects.length) return { connections: [], projects: [], applicationProjects: [] };

  const evidenceGroups = await loadEvidenceGroups(userId, effectiveProjects.map(idOf), evidencePreviewLimit);
  effectiveProjects = effectiveProjects.filter((project) => evidenceGroups.has(idOf(project))).sort(sortProjects).slice(0, uniqueProjectLimit);
  if (!effectiveProjects.length) return { connections: [], projects: [], applicationProjects: [] };

  const allowedRequiredSkills = requiredSkillIds === null ? null : new Set(requiredSkillIds.map(String));
  const userSkillIds = new Set(userSkills.map((row) => String(row.skill_id)));
  const connectedSkillIds = unique(effectiveProjects.flatMap((project) => project.skill_ids || []))
    .filter((skillId) => includeApplicationFields || (userSkillIds.has(skillId) && (!allowedRequiredSkills || allowedRequiredSkills.has(skillId))));
  const skills = connectedSkillIds.length
    ? await readRows(Skill.find({ _id: trustedIn(connectedSkillIds), is_active: true }), { select: "_id slug name is_active" })
    : [];
  const skillMap = byId(skills);
  const participantMap = new Map(participants.map((row) => [String(row.project_id), row]));

  const projectDtos = new Map(effectiveProjects.map((project) => {
    const projectId = idOf(project);
    const team = teamMap.get(String(project.team_id));
    const showcase = showcaseMap.get(projectId);
    const group = evidenceGroups.get(projectId);
    return [projectId, proofProjectDto(project, {
      team,
      targetPath: projectTarget(project, team, showcase),
      evidenceSummary: {
        total: group.total,
        internal_verified: group.internal_verified,
        external_verified: group.external_verified,
        unverified: group.unverified,
      },
      evidencePreviewRows: group.evidence,
    })];
  }));

  const orderedSkillIds = userSkills.map((row) => String(row.skill_id))
    .filter((skillId) => skillMap.has(skillId) && (!allowedRequiredSkills || allowedRequiredSkills.has(skillId)));
  const connections = orderedSkillIds.slice(0, PROOF_LIMITS.profileSkills).map((skillId) => {
    const connectedProjects = effectiveProjects
      .filter((project) => (project.skill_ids || []).map(String).includes(skillId))
      .slice(0, projectsPerSkill)
      .map((project) => projectDtos.get(idOf(project)));
    return proofConnectionDto(skillMap.get(skillId), connectedProjects);
  }).filter((connection) => connection.projects.length);

  const legacyProjects = effectiveProjects.map((project) => {
    const team = teamMap.get(String(project.team_id));
    const showcase = showcaseMap.get(idOf(project));
    return {
      name: project.name,
      slug: project.slug,
      team: { name: team.name, slug: team.slug },
      headline: showcase?.headline || null,
      summary: showcase?.summary || null,
      hero_image_url: showcase?.hero_image_url || null,
      url: projectTarget(project, team, showcase),
    };
  });

  const applicationProjects = includeApplicationFields ? effectiveProjects.map((project) => {
    const projectId = idOf(project);
    const group = evidenceGroups.get(projectId);
    const team = teamMap.get(String(project.team_id));
    return {
      id: projectId,
      name: project.name,
      tagline: project.tagline || null,
      participant_role: participantMap.get(projectId)?.role || null,
      completed_at: project.completed_at || null,
      team: { name: team.name, slug: team.slug },
      skills: (project.skill_ids || []).map(String).map((id) => skillMap.get(id)).filter(Boolean).map((skill) => ({
        id: idOf(skill), slug: skill.slug, name: skill.name,
      })),
      target_path: projectTarget(project, team, null),
      evidence_count: group.total,
      evidence: group.evidence.map((row) => proofEvidenceDto(row, { includeProjectId: true })),
    };
  }) : [];

  return { connections, projects: legacyProjects, applicationProjects };
};

const getPublicProfileProofBundle = (userId) => loadProofBundle({
  userId,
  requirePublicProfile: true,
  requireProfileOptIn: true,
  requirePublishedShowcase: true,
  evidencePreviewLimit: PROOF_LIMITS.profileEvidencePreview,
});

const listPublicProfileConnections = async (userId) => (await getPublicProfileProofBundle(userId)).connections;

const listOpportunityRelevantProof = async (userId, opportunity) => {
  const requiredSkillIds = unique(opportunity?.required_skill_ids || []);
  if (!requiredSkillIds.length) return relevantProofDto([]);
  const bundle = await loadProofBundle({
    userId,
    requiredSkillIds,
    evidencePreviewLimit: PROOF_LIMITS.opportunityEvidencePreview,
  });
  return relevantProofDto(bundle.connections);
};

const listApplicationEligibleProof = async (userId) => (await loadProofBundle({
  userId,
  includeApplicationFields: true,
  uniqueProjectLimit: PROOF_LIMITS.applicationProjects,
  projectsPerSkill: PROOF_LIMITS.applicationProjects,
  evidencePreviewLimit: PROOF_LIMITS.applicationEvidencePerProject,
})).applicationProjects;

const sessionQuery = (query, session) => session ? query.session(session) : query;

const loadSelectedApplicationProof = async (userId, projectIds, evidenceIds, session = null) => {
  if (!projectIds.length && evidenceIds.length) throw errors.validation("Evidence must belong to a selected Project");
  if (!projectIds.length) return { projects: [], evidence: [] };

  const participants = toApps(await sessionQuery(ProjectParticipant.find({
    user_id: userId, project_id: trustedIn(projectIds), status: "active",
  }), session).select("project_id team_id role").lean());
  if (participants.length !== projectIds.length) throw errors.forbidden("A selected Project is not available to this candidate");

  const projects = toApps(await sessionQuery(Project.find({
    _id: trustedIn(projectIds), visibility: "public", status: "completed",
  }), session).select("_id team_id name tagline completed_at repository_url demo_url").lean());
  if (projects.length !== projectIds.length) throw errors.forbidden("Only completed public Projects may be shared");

  const teams = toApps(await sessionQuery(Team.find({
    _id: trustedIn(unique(projects.map((row) => row.team_id))), status: "active", visibility: "public",
  }), session).select("_id").lean());
  if (teams.length !== unique(projects.map((row) => row.team_id)).length) {
    throw errors.forbidden("Only Projects in active public Teams may be shared");
  }

  const allEvidence = toApps(await sessionQuery(ContributionEvidence.find({
    user_id: userId, project_id: trustedIn(projectIds), status: "active", public_safe: true,
  }), session).select("_id project_id title summary evidence_type verification_level source_url occurred_at").sort({ occurred_at: -1, _id: 1 }).lean());
  const evidenceByProject = new Map();
  allEvidence.forEach((row) => evidenceByProject.set(String(row.project_id), [...(evidenceByProject.get(String(row.project_id)) || []), row]));
  if (projectIds.some((id) => !(evidenceByProject.get(String(id)) || []).length)) {
    throw errors.validation("Each selected Project must have public-safe contribution evidence");
  }

  let selectedEvidence = evidenceIds.length
    ? allEvidence.filter((row) => evidenceIds.includes(idOf(row)))
    : projectIds.flatMap((id) => (evidenceByProject.get(String(id)) || []).slice(0, 2));
  if (evidenceIds.length && selectedEvidence.length !== evidenceIds.length) {
    throw errors.forbidden("A selected evidence item is not public-safe or does not belong to this candidate");
  }
  selectedEvidence = selectedEvidence.slice(0, PROOF_LIMITS.applicationSelectedEvidence);
  const roleByProject = new Map(participants.map((row) => [String(row.project_id), row.role]));
  return {
    projects: projects.map((row) => ({
      id: idOf(row),
      name: row.name,
      tagline: row.tagline || null,
      participant_role: roleByProject.get(idOf(row)),
      completed_at: row.completed_at || null,
      repository_url: row.repository_url || null,
      demo_url: row.demo_url || null,
    })),
    evidence: selectedEvidence.map((row) => ({
      id: idOf(row),
      project_id: row.project_id,
      title: row.title,
      summary: row.summary || null,
      evidence_type: row.evidence_type,
      verification_level: row.verification_level,
      source_url: row.source_url || null,
      occurred_at: row.occurred_at,
    })),
  };
};

const hasPublicProfileProof = async (userId) => (await listPublicProfileConnections(userId)).length > 0;

module.exports = {
  getPublicProfileProofBundle,
  hasPublicProfileProof,
  listApplicationEligibleProof,
  listOpportunityRelevantProof,
  listPublicProfileConnections,
  loadSelectedApplicationProof,
  _private: { evidencePipeline, loadProofBundle, sortProjects },
};
