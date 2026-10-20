const TYPE_LABELS = Object.freeze({
  project_participation: "Joined the project",
  project_role: "Project role recorded",
  project_task_completion: "Completed project work",
  github_commit: "GitHub commit",
  github_pull_request: "GitHub pull request",
  external_link: "External contribution link",
});

const PROOF_LIMITS = Object.freeze({
  participantCandidates: 100,
  profileSkills: 20,
  projectsPerSkill: 3,
  uniqueProjects: 12,
  profileEvidencePreview: 3,
  opportunityEvidencePreview: 2,
  applicationProjects: 25,
  applicationEvidencePerProject: 5,
  applicationSelectedProjects: 5,
  applicationSelectedEvidence: 12,
});

const PROOF_DISCLAIMER = "Factual overlap from your TaskNexus profile and permitted Project proof. This is not a score or eligibility decision.";
const SAFE_SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const SAFE_TARGET = new RegExp(`^/(?:showcase/${SAFE_SLUG}/${SAFE_SLUG}|teams/${SAFE_SLUG}/projects/${SAFE_SLUG})$`);

const safeProofTarget = (value) => typeof value === "string" && SAFE_TARGET.test(value) ? value : null;

const proofEvidenceDto = (row, { includeProjectId = false } = {}) => ({
  id: row.id,
  ...(includeProjectId ? { project_id: row.project_id } : {}),
  type: row.evidence_type,
  verification: row.verification_level,
  title: row.evidence_type?.startsWith("github_") ? row.title : TYPE_LABELS[row.evidence_type],
  source_url: row.evidence_type?.startsWith("github_") ? row.source_url || null : null,
  occurred_at: row.occurred_at,
});

const evidenceSummary = (rows = []) => rows.reduce((summary, row) => {
  summary.total += 1;
  if (Object.prototype.hasOwnProperty.call(summary, row.verification_level)) {
    summary[row.verification_level] += 1;
  }
  return summary;
}, {
  total: 0,
  internal_verified: 0,
  external_verified: 0,
  unverified: 0,
});

const proofProjectDto = (project, context = {}) => ({
  id: project.id,
  name: project.name,
  completed_at: project.completed_at || null,
  team: context.team ? { name: context.team.name, slug: context.team.slug } : null,
  target_path: safeProofTarget(context.targetPath),
  evidence_summary: context.evidenceSummary || evidenceSummary(context.evidenceRows),
  evidence: (context.evidencePreviewRows || []).map((row) => proofEvidenceDto(row, {
    includeProjectId: Boolean(context.includeProjectId),
  })),
});

const proofConnectionDto = (skill, projects = []) => ({
  skill: { id: skill.id, slug: skill.slug, name: skill.name },
  projects,
});

const relevantProofDto = (connections = []) => {
  const uniqueProjects = new Map();
  connections.forEach((connection) => {
    connection.projects.forEach((project) => {
      if (!uniqueProjects.has(project.id)) uniqueProjects.set(project.id, project);
    });
  });

  return {
    required_skills: connections,
    project_count: uniqueProjects.size,
    evidence_count: [...uniqueProjects.values()].reduce((total, project) => total + (project.evidence_summary?.total || 0), 0),
    disclaimer: PROOF_DISCLAIMER,
  };
};

module.exports = {
  PROOF_DISCLAIMER,
  PROOF_LIMITS,
  evidenceSummary,
  proofConnectionDto,
  proofEvidenceDto,
  proofProjectDto,
  relevantProofDto,
  safeProofTarget,
};
