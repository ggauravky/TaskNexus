const { randomUUID } = require("crypto");
const { Team, TeamMembership } = require("../models");
const teamData = require("../data/teamData");
const { teamDetail, teamSummary, membership: membershipDto } = require("../serializers/teamSerializers");
const authz = require("./teamAuthorization");
const { createActivity } = require("./teamDomain");
const { errors } = require("../utils/appError");
const { teamError, teamErrors } = require("../utils/teamErrors");
const { ERROR_CODES } = require("../config/constants");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { parseListQuery } = require("../utils/queryOptions");
const { paginationMeta } = require("../utils/apiResponse");
const { toApp } = require("../models/helpers");

const text = (value, max, field, { required = false } = {}) => {
  const normalized = String(value ?? "").trim();
  if (required && !normalized) throw errors.validation(`${field} is required`);
  if (normalized.length > max) throw errors.validation(`${field} must be at most ${max} characters`);
  if (/[<>]/.test(normalized)) throw errors.validation(`${field} must be plain text`);
  return normalized || null;
};

const slugify = (value) => String(value || "").trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

const stringList = (value, max, field) => {
  if (!Array.isArray(value)) return [];
  const items = [...new Set(value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
  if (items.length > max || items.some((item) => item.length > 60 || /[<>]/.test(item))) {
    throw errors.validation(`${field} contains invalid values`);
  }
  return items;
};

const decorate = async (teams, userId) => {
  const ids = teams.map((team) => team.id);
  const [counts, relationships, owners] = await Promise.all([
    teamData.countMembers(ids),
    teamData.viewerRelationships(ids, userId),
    teamData.profileSummaries(teams.map((team) => team.owner_id), { publicOnly: true }),
  ]);
  return teams.map((team) => teamSummary(team, {
    memberCount: counts.get(team.id) || 0,
    owner: owners.get(team.owner_id) || null,
    relationship: relationships.get(team.id) || { kind: "none" },
  }));
};

const createTeam = async (userId, input) => {
  const name = text(input.name, 80, "Team name", { required: true });
  const payload = {
    _id: randomUUID(), name, slug: slugify(input.slug || name),
    tagline: text(input.tagline, 160, "Tagline"), description: text(input.description, 3000, "Description"),
    visibility: input.visibility || "public", join_policy: input.joinPolicy || input.join_policy || "request",
    primary_interests: stringList(input.primaryInterests || input.primary_interests, 12, "Interests"),
    preferred_skills: stringList(input.preferredSkills || input.preferred_skills, 12, "Preferred skills"),
    created_by: userId, owner_id: userId, status: "active",
  };
  if (!payload.slug) throw errors.validation("A valid team slug is required");
  try {
    await withTransaction(async (session) => {
      await Team.create([payload], { session });
      await TeamMembership.create([{
        _id: randomUUID(), team_id: payload._id, user_id: userId, role: "owner", status: "active", joined_at: new Date(),
      }], { session });
      await createActivity(session, { team_id: payload._id, actor_id: userId, type: "team_created" });
    });
  } catch (error) {
    if (isDuplicateKey(error)) throw teamError(ERROR_CODES.TEAM_SLUG_TAKEN, "That team slug is already in use", 409);
    throw error;
  }
  return getTeamBySlug(payload.slug, userId);
};

const listTeams = async (query, userId) => {
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 12, maxLimit: 30 });
  const scope = query.scope === "mine" ? "mine" : "discover";
  const result = await teamData.listTeams({
    ...options, userId, scope, interest: String(query.interest || "").trim().slice(0, 60),
    joinPolicy: ["open", "request", "invite_only"].includes(query.joinPolicy) ? query.joinPolicy : null,
  });
  const teams = scope === "mine" ? result.items.map((item) => item.team) : result.items;
  return { items: await decorate(teams, userId), meta: paginationMeta(result) };
};

const getTeamBySlug = async (slug, userId) => {
  const team = await teamData.findTeamBySlug(slug);
  if (!team || team.status !== "active") throw teamErrors.notFound();
  const visibleMembership = await authz.requireVisible(team, userId);
  const [counts, owners, previewRows] = await Promise.all([
    teamData.countMembers([team.id]),
    teamData.profileSummaries([team.owner_id], { publicOnly: true }),
    teamData.listMembers(team.id, { page: 1, limit: 6 }),
  ]);
  const profiles = await teamData.profileSummaries(previewRows.items.map((item) => item.user_id), { publicOnly: true });
  const relationship = visibleMembership
    ? { kind: "member", role: visibleMembership.role, membership_id: visibleMembership.id }
    : (await teamData.viewerRelationships([team.id], userId)).get(team.id) || { kind: "none" };
  return teamDetail(team, {
    memberCount: counts.get(team.id) || 0, owner: owners.get(team.owner_id) || null, relationship,
    membersPreview: previewRows.items.map((item) => membershipDto(item, profiles.get(item.user_id))),
  });
};

const updateTeam = async (teamId, userId, input) => withTransaction(async (session) => {
  const team = await authz.getTeam(teamId, session);
  await authz.requireAdmin(teamId, userId, session);
  const updates = {};
  if (input.name !== undefined) updates.name = text(input.name, 80, "Team name", { required: true });
  if (input.tagline !== undefined) updates.tagline = text(input.tagline, 160, "Tagline");
  if (input.description !== undefined) updates.description = text(input.description, 3000, "Description");
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.joinPolicy !== undefined || input.join_policy !== undefined) updates.join_policy = input.joinPolicy || input.join_policy;
  if (input.primaryInterests !== undefined || input.primary_interests !== undefined) updates.primary_interests = stringList(input.primaryInterests || input.primary_interests, 12, "Interests");
  if (!Object.keys(updates).length) throw errors.validation("No editable team fields supplied");
  const updated = await Team.findByIdAndUpdate(team.id, { $set: updates }, { session, returnDocument: "after", runValidators: true }).lean();
  await createActivity(session, { team_id: team.id, actor_id: userId, type: "team_updated", metadata: { fields: Object.keys(updates) } });
  return toApp(updated);
});

const archiveTeam = async (teamId, userId) => withTransaction(async (session) => {
  const team = await authz.getTeam(teamId, session);
  await authz.requireOwner(teamId, userId, session);
  await Team.updateOne({ _id: team.id, status: "active", owner_id: userId }, { $set: { status: "archived" } }, { session });
  await createActivity(session, { team_id: team.id, actor_id: userId, type: "team_archived" });
  return { id: team.id, status: "archived" };
});

const listActivity = async (teamId, userId, query) => {
  await authz.getTeam(teamId);
  await authz.requireMember(teamId, userId);
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 20, maxLimit: 50 });
  const result = await teamData.listActivity(teamId, options);
  const profiles = await teamData.profileSummaries(result.items.flatMap((item) => [item.actor_id, item.target_user_id]), { publicOnly: true });
  return {
    items: result.items.map((item) => ({ ...item, actor: profiles.get(item.actor_id) || null, target_user: profiles.get(item.target_user_id) || null })),
    meta: paginationMeta(result),
  };
};

module.exports = { archiveTeam, createTeam, getTeamBySlug, listActivity, listTeams, updateTeam };
