const { randomUUID } = require("crypto");
const { ProjectRepository } = require("../models");
const { toApp, toApps } = require("../models/helpers");
const authz = require("./projectAuthorization");
const { createProjectActivity } = require("./projectDomain");
const { createGitHubProvider, parseGitHubRepositoryUrl } = require("../providers/githubProvider");
const { errors } = require("../utils/appError");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");

const repositoryDto = (row) => ({
  id: row.id, project_id: row.project_id, provider: row.provider,
  owner: row.owner, repository: row.repository, url: row.canonical_url,
  verification_status: row.verification_status, verified_at: row.verified_at || null,
  last_checked_at: row.last_checked_at || null, metadata: row.metadata || {}, created_at: row.created_at,
});

const listRepositories = async (projectId, actorId) => {
  const context = await authz.getContext(projectId, actorId);
  authz.requireWorkspaceAccess(context);
  return toApps(await ProjectRepository.find({ project_id: projectId }).sort({ created_at: 1 }).lean()).map(repositoryDto);
};

const addRepository = async (projectId, actorId, input) => {
  const context = await authz.getContext(projectId, actorId);
  authz.requireManager(context);
  const parsed = parseGitHubRepositoryUrl(input.url || input.repositoryUrl || input.repository_url);
  const payload = {
    _id: randomUUID(), team_id: context.team.id, project_id: projectId, provider: "github",
    owner: parsed.owner, repository: parsed.repository, owner_key: parsed.ownerKey, repository_key: parsed.repositoryKey,
    canonical_url: parsed.canonicalUrl, added_by: actorId, verification_status: "pending",
  };
  try {
    await withTransaction(async (session) => {
      await ProjectRepository.create([payload], { session });
      await createProjectActivity(session, {
        team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: payload._id,
        type: "repository_linked", metadata: { provider: "github", repository: `${parsed.owner}/${parsed.repository}` },
      });
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("This GitHub repository is already linked to the project");
    throw error;
  }
  return repositoryDto(toApp(await ProjectRepository.findById(payload._id).lean()));
};

const removeRepository = async (projectId, repositoryId, actorId) => withTransaction(async (session) => {
  const context = await authz.getContext(projectId, actorId, session);
  authz.requireManager(context);
  const row = toApp(await ProjectRepository.findOneAndDelete({ _id: repositoryId, project_id: projectId }, { session }).lean());
  if (!row) throw errors.notFound("Linked repository not found");
  await createProjectActivity(session, {
    team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: repositoryId,
    type: "repository_removed", metadata: { provider: row.provider, repository: `${row.owner}/${row.repository}` },
  });
  return { id: row.id };
});

const verifyRepository = async (projectId, repositoryId, actorId, provider = createGitHubProvider()) => {
  const context = await authz.getContext(projectId, actorId);
  authz.requireManager(context);
  const row = toApp(await ProjectRepository.findOne({ _id: repositoryId, project_id: projectId }).lean());
  if (!row) throw errors.notFound("Linked repository not found");
  const verified = await provider.verifyRepository({ owner: row.owner, repository: row.repository });
  if (verified.isPrivate) throw errors.validation("TaskNexus Phase 5 only supports public GitHub repositories");
  const now = new Date();
  const updated = await withTransaction(async (session) => {
    const changed = toApp(await ProjectRepository.findOneAndUpdate(
      { _id: repositoryId, project_id: projectId },
      { $set: {
        owner: verified.owner, repository: verified.repository,
        owner_key: verified.owner.toLowerCase(), repository_key: verified.repository.toLowerCase(),
        canonical_url: verified.canonicalUrl, verification_status: "verified", verified_at: now, last_checked_at: now,
        metadata: { description: verified.description, default_branch: verified.defaultBranch, archived: verified.archived },
      } },
      { session, returnDocument: "after", runValidators: true },
    ).lean());
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: repositoryId,
      type: "repository_verified", metadata: { provider: "github" },
    });
    return changed;
  });
  return repositoryDto(updated);
};

module.exports = { addRepository, listRepositories, removeRepository, repositoryDto, verifyRepository };
