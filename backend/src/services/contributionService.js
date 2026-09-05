const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const {
  ContributionEvidence, Project, ProjectParticipant, ProjectRepository, Team, TeamMembership, UserProfile,
} = require("../models");
const { toApp, toApps } = require("../models/helpers");
const authz = require("./projectAuthorization");
const teamData = require("../data/teamData");
const { createProjectActivity } = require("./projectDomain");
const { createGitHubProvider, parseGitHubEvidenceUrl, parseGitHubProfileUrl } = require("../providers/githubProvider");
const { errors } = require("../utils/appError");
const { projectErrors } = require("../utils/projectErrors");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { parseListQuery } = require("../utils/queryOptions");
const { paginationMeta } = require("../utils/apiResponse");
const { httpsUrl, text } = require("./projectValidation");

const trustedIn = (values) => mongoose.trusted({ $in: values });
const TYPE_LABELS = {
  project_participation: "Joined the project",
  project_role: "Project role recorded",
  project_task_completion: "Completed project work",
  github_commit: "GitHub commit",
  github_pull_request: "GitHub pull request",
  external_link: "External contribution link",
};

const evidenceDto = (row, profiles = new Map()) => ({
  id: row.id, project_id: row.project_id, user_id: row.user_id,
  participant: profiles.get(row.user_id) || null,
  type: row.evidence_type, verification: row.verification_level, status: row.status,
  origin: row.origin, title: row.title, summary: row.summary || null,
  source_url: row.source_url || null, provider: row.provider || null, provider_ref: row.provider_ref || null,
  occurred_at: row.occurred_at, verified_at: row.verified_at || null,
  revoked_at: row.revoked_at || null, revoked_reason: row.revoked_reason || null,
  public_safe: Boolean(row.public_safe), metadata: row.metadata || {}, created_at: row.created_at,
});

const publicEvidenceDto = (row) => ({
  id: row.id, type: row.evidence_type, verification: row.verification_level,
  title: row.evidence_type.startsWith("github_") ? row.title : TYPE_LABELS[row.evidence_type],
  source_url: row.evidence_type.startsWith("github_") ? row.source_url : null,
  occurred_at: row.occurred_at,
});

const buildSummary = (rows) => {
  const summary = { total: rows.length, by_type: {}, by_verification: {} };
  rows.forEach((row) => {
    summary.by_type[row.evidence_type] = (summary.by_type[row.evidence_type] || 0) + 1;
    summary.by_verification[row.verification_level] = (summary.by_verification[row.verification_level] || 0) + 1;
  });
  return summary;
};

const insertSystemEvidence = async (session, payload) => {
  const now = payload.occurred_at || new Date();
  return ContributionEvidence.updateOne(
    { project_id: payload.project_id, source_key: payload.source_key },
    { $setOnInsert: {
      _id: randomUUID(), status: "active", origin: "system", verification_level: "internal_verified",
      public_safe: false, verified_at: now, occurred_at: now, ...payload,
    } },
    { upsert: true, session, runValidators: true },
  );
};

const createTaskCompletionEvidence = async (session, task, actorId) => {
  const assignees = [...new Set(task.assignee_ids || [])];
  if (!assignees.length) return [];
  const collaborative = assignees.length > 1;
  for (const userId of assignees) {
    await insertSystemEvidence(session, {
      team_id: task.team_id, project_id: task.project_id, user_id: userId, created_by: actorId,
      evidence_type: "project_task_completion", task_id: task.id || String(task._id),
      source_key: `task:${task.id || String(task._id)}:completion:r${task.revision || 0}:${userId}`,
      title: collaborative ? "Contributed to completed task" : "Completed assigned task",
      summary: task.title, occurred_at: task.completed_at || new Date(),
      metadata: { attribution: collaborative ? "shared" : "sole", assignee_count: assignees.length },
    });
  }
  return assignees;
};

const revokeTaskCompletionEvidence = (session, taskId, actorId) => ContributionEvidence.updateMany(
  { task_id: taskId, evidence_type: "project_task_completion", status: "active" },
  { $set: { status: "revoked", revoked_at: new Date(), revoked_reason: "Task reopened", "metadata.revoked_by": actorId } },
  { session },
);

const createParticipationEvidence = (session, participant, actorId) => insertSystemEvidence(session, {
  team_id: participant.team_id, project_id: participant.project_id, user_id: participant.user_id, created_by: actorId,
  evidence_type: "project_participation", source_key: `participant:${participant.id || String(participant._id)}:${new Date(participant.joined_at).getTime()}`,
  title: "Joined project", occurred_at: participant.joined_at || new Date(), metadata: { role: participant.role },
});

const createRoleEvidence = (session, participant, actorId) => insertSystemEvidence(session, {
  team_id: participant.team_id, project_id: participant.project_id, user_id: participant.user_id, created_by: actorId,
  evidence_type: "project_role", source_key: `role:${participant.id || String(participant._id)}:${participant.role}:${Date.now()}`,
  title: `Project role: ${participant.role}`, occurred_at: new Date(), metadata: { role: participant.role },
});

const listRows = async (filter, query) => {
  const options = parseListQuery(query, { allowedSorts: ["occurred_at"], defaultLimit: 30, maxLimit: 100 });
  if (["project_participation", "project_role", "project_task_completion", "github_commit", "github_pull_request", "external_link"].includes(query.type)) filter.evidence_type = query.type;
  if (["internal_verified", "external_verified", "unverified"].includes(query.verification)) filter.verification_level = query.verification;
  if (query.from || query.to) {
    filter.occurred_at = {};
    if (query.from) filter.occurred_at.$gte = new Date(query.from);
    if (query.to) filter.occurred_at.$lte = new Date(query.to);
  }
  const [raw, total] = await Promise.all([
    ContributionEvidence.find(filter).sort({ occurred_at: -1, _id: -1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    ContributionEvidence.countDocuments(filter),
  ]);
  const rows = toApps(raw);
  const profiles = await teamData.profileSummaries(rows.map((row) => row.user_id), { publicOnly: true });
  return { items: rows.map((row) => evidenceDto(row, profiles)), raw: rows, meta: paginationMeta({ ...options, total }) };
};

const listProjectContributions = async (projectId, actorId, query = {}) => {
  const context = await authz.getContext(projectId, actorId);
  authz.requireWorkspaceAccess(context);
  const result = await listRows({ project_id: projectId, status: query.status === "revoked" ? "revoked" : "active" }, query);
  const activeRows = result.raw.filter((row) => row.status === "active");
  return { items: result.items, summary: buildSummary(activeRows), meta: result.meta };
};

const listUserProjectContributions = async (projectId, targetUserId, actorId, query = {}) => {
  const context = await authz.getContext(projectId, actorId);
  authz.requireWorkspaceAccess(context);
  const result = await listRows({ project_id: projectId, user_id: targetUserId, status: "active" }, query);
  return { items: result.items, summary: buildSummary(result.raw), meta: result.meta };
};

const listMine = async (actorId, query = {}) => {
  const filter = { user_id: actorId, status: query.status === "revoked" ? "revoked" : "active" };
  if (query.projectId) filter.project_id = String(query.projectId);
  const result = await listRows(filter, query);
  const projectIds = [...new Set(result.raw.map((row) => row.project_id))];
  const projects = await Project.find({ _id: trustedIn(projectIds) }).select("_id name slug team_id").lean();
  const teams = await Team.find({ _id: trustedIn(projects.map((row) => row.team_id)) }).select("_id name slug").lean();
  const teamMap = new Map(teams.map((row) => [String(row._id), toApp(row)]));
  const projectMap = new Map(projects.map((row) => [String(row._id), { ...toApp(row), team: teamMap.get(row.team_id) || null }]));
  return { items: result.items.map((item) => ({ ...item, project: projectMap.get(item.project_id) || null })), summary: buildSummary(result.raw.filter((row) => row.status === "active")), meta: result.meta };
};

const addEvidence = async (projectId, actorId, input) => {
  const context = await authz.getContext(projectId, actorId);
  authz.requireContributor(context);
  if (!context.participant || !context.membership) throw projectErrors.participantRequired();
  const sourceUrl = httpsUrl(input.sourceUrl || input.source_url, "Evidence URL");
  if (!sourceUrl) throw errors.validation("Evidence URL is required");
  let evidenceType = input.type || input.evidenceType || "external_link";
  let github = null;
  if (evidenceType === "github_commit" || evidenceType === "github_pull_request") {
    github = parseGitHubEvidenceUrl(sourceUrl);
    if (github.kind !== evidenceType) throw errors.validation("Evidence type does not match the GitHub URL");
    const repository = toApp(await ProjectRepository.findOne({
      project_id: projectId, provider: "github", owner_key: github.owner.toLowerCase(), repository_key: github.repository.toLowerCase(),
    }).lean());
    if (!repository) throw errors.validation("Link this GitHub repository to the project before adding evidence");
    github.repositoryId = repository.id;
  } else if (evidenceType !== "external_link") {
    throw errors.validation("Users may only submit GitHub or external-link evidence");
  }
  const providerRef = github?.ref || sourceUrl.toLowerCase();
  const sourceKey = github ? `${evidenceType}:${github.owner.toLowerCase()}/${github.repository.toLowerCase()}:${github.ref}` : `external:${providerRef}`;
  const payload = {
    _id: randomUUID(), team_id: context.team.id, project_id: projectId, user_id: actorId, created_by: actorId,
    evidence_type: evidenceType, verification_level: "unverified", status: "active", origin: "user",
    title: text(input.title, 180, "Evidence title", { required: true }), summary: text(input.summary, 1000, "Evidence summary"),
    source_key: sourceKey, source_url: sourceUrl, repository_id: github?.repositoryId || null,
    provider: github ? "github" : null, provider_ref: providerRef,
    occurred_at: input.occurredAt ? new Date(input.occurredAt) : new Date(), public_safe: Boolean(input.publicSafe && github),
    metadata: github ? { owner: github.owner, repository: github.repository } : {},
  };
  if (Number.isNaN(payload.occurred_at.getTime())) throw errors.validation("Evidence date is invalid");
  try {
    await withTransaction(async (session) => {
      await ContributionEvidence.create([payload], { session });
      await createProjectActivity(session, {
        team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: payload._id,
        type: "evidence_added", metadata: { evidence_type: evidenceType, verification: "unverified" },
      });
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("This evidence is already attached to the project");
    throw error;
  }
  return evidenceDto(toApp(await ContributionEvidence.findById(payload._id).lean()));
};

const revokeEvidence = async (evidenceId, actorId) => {
  return withTransaction(async (session) => {
    const row = toApp(await ContributionEvidence.findById(evidenceId).session(session).lean());
    if (!row) throw errors.notFound("Contribution evidence not found");
    if (row.origin === "system") throw errors.forbidden("System evidence is immutable");
    if (row.user_id !== actorId) throw errors.forbidden("Only the claimant can remove this evidence");
    if (row.status !== "active") return evidenceDto(row);
    const updated = toApp(await ContributionEvidence.findOneAndUpdate(
      { _id: evidenceId, status: "active" },
      { $set: { status: "revoked", revoked_at: new Date(), revoked_reason: "Removed by claimant" } },
      { session, returnDocument: "after" },
    ).lean());
    await createProjectActivity(session, {
      team_id: row.team_id, project_id: row.project_id, actor_id: actorId, entity_id: row.id,
      type: "evidence_revoked", metadata: { evidence_type: row.evidence_type },
    });
    return evidenceDto(updated);
  });
};

const verifyEvidence = async (evidenceId, actorId, provider = createGitHubProvider()) => {
  const row = toApp(await ContributionEvidence.findById(evidenceId).lean());
  if (!row) throw errors.notFound("Contribution evidence not found");
  if (row.user_id !== actorId) throw errors.forbidden("Only the claimant can verify this evidence");
  if (row.status !== "active" || !new Set(["github_commit", "github_pull_request"]).has(row.evidence_type)) {
    throw errors.validation("Only active GitHub evidence can be verified");
  }
  const [profile, repository] = await Promise.all([
    UserProfile.findById(actorId).lean(), ProjectRepository.findById(row.repository_id).lean(),
  ]);
  if (!profile?.github_url) throw errors.validation("Add a public GitHub profile URL to your TaskNexus profile first");
  const expectedLogin = parseGitHubProfileUrl(profile.github_url).toLowerCase();
  if (!repository) throw errors.validation("The linked project repository no longer exists");
  const target = { owner: repository.owner, repository: repository.repository, ref: row.provider_ref };
  const verified = row.evidence_type === "github_commit" ? await provider.verifyCommit(target) : await provider.verifyPullRequest(target);
  if (!verified.authorLogin || verified.authorLogin.toLowerCase() !== expectedLogin) {
    throw errors.validation("GitHub author does not match the username in your TaskNexus profile");
  }
  const now = new Date();
  const updates = {
    verification_level: "external_verified", verified_at: now, source_url: verified.url,
    title: verified.title, occurred_at: verified.occurredAt ? new Date(verified.occurredAt) : row.occurred_at,
    public_safe: true,
    metadata: row.evidence_type === "github_commit"
      ? { owner: repository.owner, repository: repository.repository, sha: verified.sha, github_author: verified.authorLogin, signature_reason: verified.verification }
      : { owner: repository.owner, repository: repository.repository, number: verified.number, github_author: verified.authorLogin, state: verified.state, merged: verified.merged },
  };
  const updated = toApp(await ContributionEvidence.findOneAndUpdate(
    { _id: evidenceId, user_id: actorId, status: "active" }, { $set: updates }, { returnDocument: "after", runValidators: true },
  ).lean());
  if (!updated) throw errors.conflict("Evidence changed before verification completed");
  return evidenceDto(updated);
};

const setProfileVisibility = async (projectId, actorId, show) => {
  const participant = await ProjectParticipant.findOne({ project_id: projectId, user_id: actorId }).lean();
  if (!participant) throw projectErrors.participantNotFound();
  const membership = await TeamMembership.findOne({ team_id: participant.team_id, user_id: actorId, status: "active" }).lean();
  if (!membership) throw projectErrors.participantRequired();
  const updated = toApp(await ProjectParticipant.findOneAndUpdate(
    { _id: participant._id, user_id: actorId },
    { $set: { show_on_profile: Boolean(show), profile_visibility_updated_at: new Date() } },
    { returnDocument: "after", runValidators: true },
  ).lean());
  return { project_id: projectId, show_on_profile: updated.show_on_profile };
};

module.exports = {
  addEvidence, buildSummary, createParticipationEvidence, createRoleEvidence, createTaskCompletionEvidence,
  evidenceDto, listMine, listProjectContributions, listUserProjectContributions, publicEvidenceDto,
  revokeEvidence, revokeTaskCompletionEvidence, setProfileVisibility, verifyEvidence,
};
