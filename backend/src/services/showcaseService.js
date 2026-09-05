const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const {
  ContributionEvidence, Project, ProjectParticipant, ProjectRepository, ProjectShowcase, Team, UserProfile,
} = require("../models");
const { toApp, toApps } = require("../models/helpers");
const authz = require("./projectAuthorization");
const teamData = require("../data/teamData");
const { createProjectActivity, createProjectNotification } = require("./projectDomain");
const { publicEvidenceDto } = require("./contributionService");
const { errors } = require("../utils/appError");
const { projectErrors } = require("../utils/projectErrors");
const { withTransaction } = require("../utils/transactions");
const { httpsUrl, stringList, text } = require("./projectValidation");

const trustedIn = (values) => mongoose.trusted({ $in: values });
const showcaseDto = (row) => ({
  id: row.id, project_id: row.project_id, status: row.status,
  headline: row.headline || "", summary: row.summary || "", problem: row.problem || "",
  solution: row.solution || "", outcome: row.outcome || "", featured_evidence_ids: row.featured_evidence_ids || [],
  featured_skills: row.featured_skills || [], hero_image_url: row.hero_image_url || null,
  published_at: row.published_at || null, updated_at: row.updated_at || null, revision: row.revision || 0,
});

const validateFeaturedEvidence = async (projectId, ids, session = null) => {
  const unique = [...new Set(ids || [])];
  if (unique.length > 12 || unique.some((id) => typeof id !== "string")) throw errors.validation("Featured evidence must contain at most 12 evidence IDs");
  if (!unique.length) return [];
  const count = await ContributionEvidence.countDocuments({ _id: trustedIn(unique), project_id: projectId, status: "active" }).session(session);
  if (count !== unique.length) throw errors.validation("Featured evidence must be active evidence from this project");
  return unique;
};

const getShowcase = async (projectId, actorId) => {
  const context = await authz.getContext(projectId, actorId);
  authz.requireWorkspaceAccess(context);
  const row = toApp(await ProjectShowcase.findOne({ project_id: projectId }).lean());
  return row ? showcaseDto(row) : null;
};

const updateShowcase = async (projectId, actorId, input) => {
  const context = await authz.getContext(projectId, actorId);
  authz.requireManager(context);
  const featuredEvidenceIds = await validateFeaturedEvidence(projectId, input.featuredEvidenceIds || input.featured_evidence_ids || []);
  const payload = {
    headline: text(input.headline, 180, "Showcase headline"), summary: text(input.summary, 1000, "Showcase summary"),
    problem: text(input.problem, 3000, "Problem"), solution: text(input.solution, 3000, "Solution"),
    outcome: text(input.outcome, 3000, "Outcome"), featured_evidence_ids: featuredEvidenceIds,
    featured_skills: stringList(input.featuredSkills || input.featured_skills, 12, "Featured skills"),
    hero_image_url: httpsUrl(input.heroImageUrl ?? input.hero_image_url, "Hero image URL"), updated_by: actorId,
  };
  const existing = toApp(await ProjectShowcase.findOne({ project_id: projectId }).lean());
  const expectedRevision = Number(input.revision ?? existing?.revision ?? 0);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) throw errors.validation("Current showcase revision is required");
  let row;
  await withTransaction(async (session) => {
    if (!existing) {
      [row] = await ProjectShowcase.create([{
        _id: randomUUID(), team_id: context.team.id, project_id: projectId, status: "draft",
        created_by: actorId, revision: 0, ...payload,
      }], { session });
      row = toApp(row);
    } else {
      row = toApp(await ProjectShowcase.findOneAndUpdate(
        { _id: existing.id, revision: expectedRevision }, { $set: payload, $inc: { revision: 1 } },
        { session, returnDocument: "after", runValidators: true },
      ).lean());
      if (!row) throw projectErrors.staleWrite();
    }
    await createProjectActivity(session, {
      team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: row.id,
      type: "showcase_updated", metadata: { fields: Object.keys(payload).filter((key) => key !== "updated_by") },
    });
  });
  return showcaseDto(row);
};

const assertPublishable = (context, row) => {
  if (context.project.status !== "completed") throw errors.invalidTransition("Complete the project before publishing its showcase");
  if (context.team.visibility !== "public" || context.project.visibility !== "public") {
    throw errors.validation("The Team and Project must both be public before publishing");
  }
  for (const field of ["headline", "summary", "problem", "solution", "outcome"]) {
    if (!row[field]) throw errors.validation(`Showcase ${field} is required before publishing`);
  }
};

const publishShowcase = async (projectId, actorId, revision) => withTransaction(async (session) => {
  const context = await authz.getContext(projectId, actorId, session);
  authz.requireManager(context);
  const row = toApp(await ProjectShowcase.findOne({ project_id: projectId }).session(session).lean());
  if (!row) throw errors.validation("Create the showcase before publishing it");
  assertPublishable(context, row);
  const expected = Number(revision);
  if (!Number.isInteger(expected) || expected < 0) throw errors.validation("Current showcase revision is required");
  await validateFeaturedEvidence(projectId, row.featured_evidence_ids, session);
  const now = new Date();
  const updated = toApp(await ProjectShowcase.findOneAndUpdate(
    { _id: row.id, revision: expected, status: mongoose.trusted({ $ne: "published" }) },
    { $set: { status: "published", published_at: now, unpublished_at: null, updated_by: actorId }, $inc: { revision: 1 } },
    { session, returnDocument: "after", runValidators: true },
  ).lean());
  if (!updated) throw projectErrors.staleWrite();
  await createProjectActivity(session, {
    team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: row.id,
    type: "showcase_published", metadata: { published_at: now },
  });
  const participantIds = await ProjectParticipant.distinct("user_id", { project_id: projectId, status: "active" }).session(session);
  for (const userId of participantIds.filter((id) => id !== actorId)) {
    await createProjectNotification(session, {
      recipient_id: userId, actor_id: actorId, type: "project_showcase_published", entity_id: projectId,
      event_key: `showcase-published:${row.id}:${updated.revision}:${userId}`,
      content: { title: "Project showcase published", message: `${context.project.name} now has a public showcase.`, actionUrl: `/showcase/${context.team.slug}/${context.project.slug}` },
    });
  }
  return showcaseDto(updated);
});

const unpublishShowcase = async (projectId, actorId, revision) => withTransaction(async (session) => {
  const context = await authz.getContext(projectId, actorId, session);
  authz.requireManager(context);
  const expected = Number(revision);
  if (!Number.isInteger(expected) || expected < 0) throw errors.validation("Current showcase revision is required");
  const updated = toApp(await ProjectShowcase.findOneAndUpdate(
    { project_id: projectId, revision: expected, status: "published" },
    { $set: { status: "unpublished", unpublished_at: new Date(), updated_by: actorId }, $inc: { revision: 1 } },
    { session, returnDocument: "after", runValidators: true },
  ).lean());
  if (!updated) throw projectErrors.staleWrite();
  await createProjectActivity(session, {
    team_id: context.team.id, project_id: projectId, actor_id: actorId, entity_id: updated.id,
    type: "showcase_unpublished",
  });
  return showcaseDto(updated);
});

const getPublicShowcase = async (teamSlug, projectSlug) => {
  const team = toApp(await Team.findOne({ slug: String(teamSlug).toLowerCase(), status: "active", visibility: "public" }).lean());
  if (!team) throw projectErrors.notFound();
  const project = toApp(await Project.findOne({ team_id: team.id, slug: String(projectSlug).toLowerCase(), status: "completed", visibility: "public" }).lean());
  if (!project) throw projectErrors.notFound();
  const showcase = toApp(await ProjectShowcase.findOne({ project_id: project.id, status: "published" }).lean());
  if (!showcase) throw projectErrors.notFound();
  const evidenceRows = toApps(await ContributionEvidence.find({ project_id: project.id, status: "active" }).sort({ occurred_at: -1 }).lean());
  const evidenceById = new Map(evidenceRows.map((row) => [row.id, row]));
  const featuredEvidence = (showcase.featured_evidence_ids || []).map((id) => evidenceById.get(id)).filter(Boolean).map(publicEvidenceDto);
  const evidenceUsers = [...new Set(evidenceRows.map((row) => row.user_id))];
  const [participants, profiles, repositories] = await Promise.all([
    ProjectParticipant.find({ project_id: project.id, user_id: trustedIn(evidenceUsers) }).lean(),
    UserProfile.find({ _id: trustedIn(evidenceUsers), visibility: "public" }).lean(),
    ProjectRepository.find({ project_id: project.id, verification_status: "verified" }).sort({ created_at: 1 }).lean(),
  ]);
  const profileMap = new Map(profiles.map((row) => [String(row._id), toApp(row)]));
  const counts = new Map();
  evidenceRows.forEach((row) => {
    const current = counts.get(row.user_id) || { total: 0, internal_verified: 0, external_verified: 0, unverified: 0 };
    current.total += 1; current[row.verification_level] += 1; counts.set(row.user_id, current);
  });
  const users = await teamData.profileSummaries(evidenceUsers, { publicOnly: true });
  const participantDtos = participants.filter((row) => profileMap.has(row.user_id) && users.has(row.user_id)).map((row) => ({
    profile: users.get(row.user_id), role: row.role, evidence: counts.get(row.user_id),
  })).sort((a, b) => String(a.profile.display_name).localeCompare(String(b.profile.display_name)));
  return {
    team: { name: team.name, slug: team.slug, avatar_url: team.avatar_url || null },
    project: { name: project.name, slug: project.slug, tagline: project.tagline || null, completed_at: project.completed_at, demo_url: project.demo_url || null },
    showcase: showcaseDto(showcase), participants: participantDtos, featured_evidence: featuredEvidence,
    repositories: toApps(repositories).map((row) => ({ provider: row.provider, owner: row.owner, repository: row.repository, url: row.canonical_url })),
    seo: { title: `${showcase.headline} | ${team.name}`, description: showcase.summary, canonical: `/showcase/${team.slug}/${project.slug}`, image: showcase.hero_image_url || null },
  };
};

const listPublicProfileProjects = async (userId) => {
  const publicProfile = await UserProfile.exists({ _id: userId, visibility: "public" });
  if (!publicProfile) return [];
  const participations = await ProjectParticipant.find({ user_id: userId, show_on_profile: true }).lean();
  if (!participations.length) return [];
  const projectIds = participations.map((row) => row.project_id);
  const evidenceProjectIds = await ContributionEvidence.distinct("project_id", { user_id: userId, project_id: trustedIn(projectIds), status: "active" });
  if (!evidenceProjectIds.length) return [];
  const projects = toApps(await Project.find({ _id: trustedIn(evidenceProjectIds), status: "completed", visibility: "public" }).lean());
  const teams = toApps(await Team.find({ _id: trustedIn(projects.map((row) => row.team_id)), status: "active", visibility: "public" }).lean());
  const teamMap = new Map(teams.map((row) => [row.id, row]));
  const showcases = toApps(await ProjectShowcase.find({ project_id: trustedIn(projects.map((row) => row.id)), status: "published" }).lean());
  const showcaseMap = new Map(showcases.map((row) => [row.project_id, row]));
  return projects.filter((project) => teamMap.has(project.team_id) && showcaseMap.has(project.id)).map((project) => {
    const team = teamMap.get(project.team_id); const showcase = showcaseMap.get(project.id);
    return { name: project.name, slug: project.slug, team: { name: team.name, slug: team.slug }, headline: showcase.headline, summary: showcase.summary, hero_image_url: showcase.hero_image_url || null, url: `/showcase/${team.slug}/${project.slug}` };
  });
};

module.exports = {
  getPublicShowcase, getShowcase, listPublicProfileProjects, publishShowcase, showcaseDto, unpublishShowcase, updateShowcase,
};
