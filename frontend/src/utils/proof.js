const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const SAFE_PROOF_TARGET = new RegExp(`^/(?:showcase/${SLUG}/${SLUG}|teams/${SLUG}/projects/${SLUG})$`);
const SAFE_APPLICATION_TARGET = new RegExp(`^/(?:opportunities|organizations)/${SLUG}$`);
const MAX_SELECTED_PROJECTS = 5;
const MAX_SELECTED_EVIDENCE = 12;

const VERIFICATION_LABELS = Object.freeze({
  internal_verified: "TaskNexus verified",
  external_verified: "Source verified",
  unverified: "Unverified claim",
});

const EVIDENCE_TYPE_LABELS = Object.freeze({
  project_participation: "Project participation",
  project_role: "Project role",
  project_task_completion: "Completed project work",
  github_commit: "GitHub commit",
  github_pull_request: "GitHub pull request",
  external_link: "External contribution",
});

export const safeProofTarget = (value) => typeof value === "string" && SAFE_PROOF_TARGET.test(value) ? value : null;
export const safeApplicationTarget = (value) => typeof value === "string" && SAFE_APPLICATION_TARGET.test(value) ? value : null;
export const verificationLabel = (value) => VERIFICATION_LABELS[value] || "Verification unavailable";
export const evidenceTypeLabel = (value) => EVIDENCE_TYPE_LABELS[value] || "Contribution evidence";

const uniqueStrings = (values) => [...new Set((values || []).filter((value) => typeof value === "string"))];

export const toggleProofProject = (state, project, selected) => {
  const selectedProjectIds = uniqueStrings(state?.selectedProjectIds);
  const selectedEvidenceIds = uniqueStrings(state?.selectedEvidenceIds);
  if (!project?.id) return { selectedProjectIds, selectedEvidenceIds };

  if (selected) {
    if (selectedProjectIds.includes(project.id) || selectedProjectIds.length >= MAX_SELECTED_PROJECTS) {
      return { selectedProjectIds, selectedEvidenceIds };
    }
    return { selectedProjectIds: [...selectedProjectIds, project.id], selectedEvidenceIds };
  }

  const projectEvidenceIds = new Set((project.evidence || []).map((item) => item.id));
  return {
    selectedProjectIds: selectedProjectIds.filter((id) => id !== project.id),
    selectedEvidenceIds: selectedEvidenceIds.filter((id) => !projectEvidenceIds.has(id)),
  };
};

export const toggleProofEvidence = (state, evidence, selected) => {
  const selectedProjectIds = uniqueStrings(state?.selectedProjectIds);
  const selectedEvidenceIds = uniqueStrings(state?.selectedEvidenceIds);
  if (!evidence?.id) return { selectedProjectIds, selectedEvidenceIds };

  if (!selected) {
    return { selectedProjectIds, selectedEvidenceIds: selectedEvidenceIds.filter((id) => id !== evidence.id) };
  }
  if (!selectedProjectIds.includes(evidence.project_id)
    || selectedEvidenceIds.includes(evidence.id)
    || selectedEvidenceIds.length >= MAX_SELECTED_EVIDENCE) {
    return { selectedProjectIds, selectedEvidenceIds };
  }
  return { selectedProjectIds, selectedEvidenceIds: [...selectedEvidenceIds, evidence.id] };
};

export const proofSelectionError = (projects = [], state = {}) => {
  const selectedProjectIds = uniqueStrings(state.selectedProjectIds);
  const selectedEvidenceIds = uniqueStrings(state.selectedEvidenceIds);
  if (selectedProjectIds.length > MAX_SELECTED_PROJECTS) return "Select no more than 5 Projects.";
  if (selectedEvidenceIds.length > MAX_SELECTED_EVIDENCE) return "Select no more than 12 evidence items.";
  if (!selectedProjectIds.length) return selectedEvidenceIds.length ? "Evidence requires a selected Project." : null;

  const projectMap = new Map(projects.map((project) => [project.id, project]));
  if (selectedProjectIds.some((id) => !projectMap.has(id))) return "One or more selected Projects are no longer available.";
  const evidenceProjectMap = new Map(projects.flatMap((project) => (project.evidence || []).map((item) => [item.id, project.id])));
  if (selectedEvidenceIds.some((id) => !selectedProjectIds.includes(evidenceProjectMap.get(id)))) {
    return "One or more selected evidence items are no longer available.";
  }
  if (selectedProjectIds.some((projectId) => !selectedEvidenceIds.some((id) => evidenceProjectMap.get(id) === projectId))) {
    return "Select at least one evidence item for each selected Project.";
  }
  return null;
};

export const proofCountLabel = (summary = {}) => {
  const total = Number(summary.total) || 0;
  return `${total} evidence item${total === 1 ? "" : "s"}`;
};
