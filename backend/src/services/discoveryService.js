const mongoose = require("mongoose");
const {
  ContributionEvidence, Project, ProjectParticipant, ProjectShowcase, Skill, Team,
  User, UserBlock, UserProfile, UserSkill,
} = require("../models");
const { raw: domain } = require("../contracts/domain");
const { escapeRegex } = require("../data/mongoDataUtils");
const { toApp, toApps } = require("../models/helpers");
const { errors } = require("../utils/appError");
const { paginationMeta } = require("../utils/apiResponse");
const { parseListQuery } = require("../utils/queryOptions");

const trustedIn = (values) => mongoose.trusted({ $in: values });
const MAX_CANDIDATES = 250;

const csv = (value, max = 12) => {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(source.map((item) => String(item).trim().toLowerCase()).filter(Boolean))].slice(0, max);
};

const allowlisted = (value, allowed, field) => {
  const values = csv(value);
  const invalid = values.find((item) => !allowed.includes(item));
  if (invalid) throw errors.validation(`Unsupported ${field}: ${invalid}`);
  return values;
};

const parsePeopleQuery = (query = {}) => {
  const list = parseListQuery(query, { allowedSorts: ["relevance", "updated_at"], defaultSort: "relevance", defaultLimit: 18, maxLimit: 30 });
  const skillMode = query.skillMode === "any" ? "any" : "all";
  return {
    ...list,
    search: list.search.slice(0, 80),
    skills: csv(query.skills, 8),
    roles: allowlisted(query.roles, domain.collaborationRoles || [], "role"),
    interests: allowlisted(query.interests, domain.profileInterests || [], "interest"),
    availability: allowlisted(query.availability, ["open", "limited"], "availability"),
    skillMode,
    hasPublishedProjects: query.hasPublishedProjects === "true" || query.hasPublishedProjects === true,
    hasExternalEvidence: query.hasExternalEvidence === "true" || query.hasExternalEvidence === true,
  };
};

const blockExclusions = async (viewerId) => {
  if (!viewerId) return new Set();
  const rows = await UserBlock.find({
    $or: mongoose.trusted([{ blocker_id: viewerId }, { blocked_user_id: viewerId }]),
  }).lean();
  return new Set(rows.map((row) => row.blocker_id === viewerId ? row.blocked_user_id : row.blocker_id));
};

const displayName = (user, profile) => {
  const legacy = user?.profile || {};
  return [legacy.firstName || legacy.first_name, legacy.lastName || legacy.last_name]
    .filter(Boolean).join(" ") || profile.username;
};

const publicContext = async (userIds) => {
  if (!userIds.length) return { evidence: new Map(), projects: new Map(), projectCounts: new Map() };
  const participations = await ProjectParticipant.find({ user_id: trustedIn(userIds), show_on_profile: true }).lean();
  const projectIds = [...new Set(participations.map((row) => row.project_id))];
  const [projects, showcases] = await Promise.all([
    Project.find({ _id: trustedIn(projectIds), status: "completed", visibility: "public" }).lean(),
    ProjectShowcase.find({ project_id: trustedIn(projectIds), status: "published" }).lean(),
  ]);
  const teamIds = [...new Set(projects.map((row) => row.team_id))];
  const teams = await Team.find({ _id: trustedIn(teamIds), status: "active", visibility: "public" }).lean();
  const teamMap = new Map(teams.map((row) => [String(row._id), toApp(row)]));
  const showcaseMap = new Map(showcases.map((row) => [row.project_id, toApp(row)]));
  const projectMap = new Map(projects
    .filter((row) => teamMap.has(row.team_id) && showcaseMap.has(String(row._id)))
    .map((row) => [String(row._id), toApp(row)]));
  const publicPairs = participations.filter((row) => projectMap.has(row.project_id));
  const evidenceRows = await ContributionEvidence.find({
    user_id: trustedIn(userIds), project_id: trustedIn([...projectMap.keys()]), status: "active",
    verification_level: trustedIn(["internal_verified", "external_verified"]),
  }).select("user_id project_id evidence_type verification_level public_safe").lean();
  const evidencedPairs = new Set(evidenceRows.map((row) => `${row.user_id}:${row.project_id}`));
  const projectsByUser = new Map();
  const projectCounts = new Map();
  publicPairs.forEach((row) => {
    if (!evidencedPairs.has(`${row.user_id}:${row.project_id}`)) return;
    const project = projectMap.get(row.project_id);
    const team = teamMap.get(project.team_id);
    const showcase = showcaseMap.get(project.id);
    const preview = {
      name: project.name, slug: project.slug, headline: showcase.headline, summary: showcase.summary,
      hero_image_url: showcase.hero_image_url || null, team: { name: team.name, slug: team.slug },
      url: `/showcase/${team.slug}/${project.slug}`,
    };
    projectsByUser.set(row.user_id, [...(projectsByUser.get(row.user_id) || []), preview]);
    projectCounts.set(row.user_id, (projectCounts.get(row.user_id) || 0) + 1);
  });
  const summary = new Map(userIds.map((id) => [id, {
    internal_task_contributions: 0, verified_github_pull_requests: 0, verified_external_evidence: 0,
  }]));
  evidenceRows.forEach((row) => {
    if (!evidencedPairs.has(`${row.user_id}:${row.project_id}`)) return;
    const current = summary.get(row.user_id);
    if (row.verification_level === "internal_verified" && row.evidence_type === "project_task_completion") current.internal_task_contributions += 1;
    if (row.verification_level === "external_verified" && row.public_safe) {
      current.verified_external_evidence += 1;
      if (row.evidence_type === "github_pull_request") current.verified_github_pull_requests += 1;
    }
  });
  return { evidence: summary, projects: projectsByUser, projectCounts };
};

const discoverPeople = async (viewerId, rawQuery = {}, options = {}) => {
  const query = parsePeopleQuery(rawQuery);
  const excluded = await blockExclusions(viewerId);
  excluded.add(viewerId);
  const profileFilter = { discoverable: true, visibility: "public", availability: trustedIn(query.availability.length ? query.availability : ["open", "limited"]) };
  if (query.roles.length) profileFilter.preferred_roles = query.roles.length === 1 ? query.roles[0] : mongoose.trusted({ $all: query.roles });
  if (query.interests.length) profileFilter.interests = query.interests.length === 1 ? query.interests[0] : mongoose.trusted({ $all: query.interests });
  let profiles = toApps(await UserProfile.find(profileFilter).sort({ updated_at: -1, username: 1 }).limit(MAX_CANDIDATES).lean());
  profiles = profiles.filter((profile) => !excluded.has(profile.id));
  let ids = profiles.map((profile) => profile.id);

  const requestedSkills = query.skills.length ? toApps(await Skill.find({
    is_active: true, $or: mongoose.trusted([{ _id: trustedIn(query.skills) }, { slug: trustedIn(query.skills) }]),
  }).lean()) : [];
  if (query.skills.length && requestedSkills.length !== query.skills.length) throw errors.validation("One or more selected skills are invalid");
  const requestedIds = requestedSkills.map((skill) => skill.id);
  const matchedByUser = new Map();
  if (requestedIds.length) {
    const matches = await UserSkill.find({ user_id: trustedIn(ids), skill_id: trustedIn(requestedIds) }).lean();
    matches.forEach((row) => matchedByUser.set(row.user_id, [...(matchedByUser.get(row.user_id) || []), row.skill_id]));
    ids = ids.filter((id) => query.skillMode === "all" ? (matchedByUser.get(id)?.length || 0) === requestedIds.length : matchedByUser.has(id));
  }

  const search = query.search.toLowerCase();
  const searchMatches = new Set();
  if (search && ids.length) {
    const pattern = new RegExp(escapeRegex(search), "i");
    const [nameUsers, textProfiles, textSkills] = await Promise.all([
      User.find({ _id: trustedIn(ids), status: "active", $or: mongoose.trusted([{ "profile.firstName": pattern }, { "profile.lastName": pattern }]) }).select("_id").lean(),
      UserProfile.find({ _id: trustedIn(ids), $or: mongoose.trusted([{ username: pattern }, { headline: pattern }, { preferred_roles: pattern }, { interests: pattern }]) }).select("_id").lean(),
      Skill.find({ is_active: true, $or: mongoose.trusted([{ name: pattern }, { slug: pattern }, { aliases: pattern }]) }).select("_id").lean(),
    ]);
    nameUsers.forEach((row) => searchMatches.add(String(row._id)));
    textProfiles.forEach((row) => searchMatches.add(String(row._id)));
    if (textSkills.length) {
      const rows = await UserSkill.find({ user_id: trustedIn(ids), skill_id: trustedIn(textSkills.map((row) => String(row._id))) }).select("user_id").lean();
      rows.forEach((row) => searchMatches.add(row.user_id));
    }
    ids = ids.filter((id) => searchMatches.has(id));
  }

  const [users, assignments, context] = await Promise.all([
    User.find({ _id: trustedIn(ids), status: "active" }).select("_id profile status").lean(),
    UserSkill.find({ user_id: trustedIn(ids) }).sort({ is_primary: -1, created_at: 1 }).lean(),
    publicContext(ids),
  ]);
  const activeIds = new Set(users.map((row) => String(row._id)));
  profiles = profiles.filter((profile) => ids.includes(profile.id) && activeIds.has(profile.id));
  const catalog = toApps(await Skill.find({ _id: trustedIn([...new Set(assignments.map((row) => row.skill_id))]) }).lean());
  const skillMap = new Map(catalog.map((row) => [row.id, row]));
  const skillsByUser = new Map();
  assignments.forEach((row) => skillsByUser.set(row.user_id, [...(skillsByUser.get(row.user_id) || []), {
    id: row.skill_id, slug: skillMap.get(row.skill_id)?.slug || null, name: skillMap.get(row.skill_id)?.name || null,
    category: skillMap.get(row.skill_id)?.category || null, is_primary: Boolean(row.is_primary),
  }].filter((item) => item.name)));
  const userMap = new Map(users.map((row) => [String(row._id), row]));
  let cards = profiles.map((profile) => {
    const userSkills = (skillsByUser.get(profile.id) || []).slice(0, 10);
    const matchedIds = matchedByUser.get(profile.id) || [];
    const matchedSkills = userSkills.filter((skill) => matchedIds.includes(skill.id));
    return {
      id: profile.id, username: profile.username, display_name: displayName(userMap.get(profile.id), profile),
      avatar_url: profile.avatar_url || null, headline: profile.headline || null, location: profile.location || null,
      availability: profile.availability, collaboration_commitment: profile.collaboration_commitment,
      preferred_roles: profile.preferred_roles || [], interests: profile.interests || [], skills: userSkills,
      match_context: { skill_mode: query.skillMode, matched_skills: matchedSkills, matched_roles: query.roles.filter((role) => profile.preferred_roles?.includes(role)), matched_interests: query.interests.filter((interest) => profile.interests?.includes(interest)), availability: query.availability.includes(profile.availability) ? profile.availability : null },
      evidence_summary: context.evidence.get(profile.id) || { internal_task_contributions: 0, verified_github_pull_requests: 0, verified_external_evidence: 0 },
      published_project_count: context.projectCounts.get(profile.id) || 0,
      published_projects: (context.projects.get(profile.id) || []).slice(0, 2),
      updated_at: profile.updated_at || null,
    };
  });
  if (query.hasPublishedProjects) cards = cards.filter((card) => card.published_project_count > 0);
  if (query.hasExternalEvidence) cards = cards.filter((card) => card.evidence_summary.verified_external_evidence > 0);
  if (options.allowedUserIds) {
    const allowed = new Set(options.allowedUserIds);
    cards = cards.filter((card) => allowed.has(card.id));
  }
  const availabilityRank = { open: 0, limited: 1 };
  cards.sort((a, b) => {
    if (search) {
      const aExact = a.username === search ? 0 : a.username?.startsWith(search) ? 1 : a.display_name.toLowerCase().includes(search) ? 2 : 3;
      const bExact = b.username === search ? 0 : b.username?.startsWith(search) ? 1 : b.display_name.toLowerCase().includes(search) ? 2 : 3;
      if (aExact !== bExact) return aExact - bExact;
    }
    const skillDelta = b.match_context.matched_skills.length - a.match_context.matched_skills.length;
    if (skillDelta) return skillDelta;
    const availabilityDelta = availabilityRank[a.availability] - availabilityRank[b.availability];
    if (availabilityDelta) return availabilityDelta;
    const dateDelta = new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    return dateDelta || a.username.localeCompare(b.username);
  });
  if (options.excludeUserIds?.length) cards = cards.filter((card) => !options.excludeUserIds.includes(card.id));
  const total = cards.length;
  const start = (query.page - 1) * query.limit;
  return { items: cards.slice(start, start + query.limit), meta: paginationMeta({ ...query, total }), filters: { skill_mode: query.skillMode } };
};

module.exports = { blockExclusions, discoverPeople, parsePeopleQuery, publicContext };
