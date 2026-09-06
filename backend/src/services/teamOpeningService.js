const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const { CollaborationRequest, Skill, Team, TeamMembership, TeamOpening } = require("../models");
const { raw: domain } = require("../contracts/domain");
const { toApp, toApps } = require("../models/helpers");
const authz = require("./teamAuthorization");
const { createActivity } = require("./teamDomain");
const { discoverPeople } = require("./discoveryService");
const { errors } = require("../utils/appError");
const { paginationMeta } = require("../utils/apiResponse");
const { parseListQuery } = require("../utils/queryOptions");
const { withTransaction } = require("../utils/transactions");

const trustedIn = (values) => mongoose.trusted({ $in: values });

const text = (value, max, field, required = false) => {
  const clean = String(value ?? "").trim();
  if (required && !clean) throw errors.validation(`${field} is required`);
  if (clean.length > max || /[<>]/.test(clean)) throw errors.validation(`${field} must be plain text and at most ${max} characters`);
  return clean || null;
};

const skillIds = async (value, field) => {
  if (!Array.isArray(value)) throw errors.validation(`${field} must be an array`);
  const ids = [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  if (ids.length > 8 || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) throw errors.validation(`${field} contains invalid skill IDs`);
  const found = await Skill.countDocuments({ _id: trustedIn(ids), is_active: true });
  if (found !== ids.length) throw errors.validation(`${field} contains an unknown skill`);
  return ids;
};

const openingDto = (opening, skills = new Map(), team = null, extra = {}) => ({
  id: opening.id, team_id: opening.team_id, title: opening.title, description: opening.description || null,
  role: opening.role,
  required_skills: (opening.required_skill_ids || []).map((id) => skills.get(id)).filter(Boolean),
  preferred_skills: (opening.preferred_skill_ids || []).map((id) => skills.get(id)).filter(Boolean),
  commitment: opening.commitment || null, status: opening.status, revision: opening.revision || 0,
  team: team ? { id: team.id, name: team.name, slug: team.slug, avatar_url: team.avatar_url || null, primary_interests: team.primary_interests || [] } : null,
  interested_count: extra.interestedCount || 0, created_at: opening.created_at, updated_at: opening.updated_at,
  closed_at: opening.closed_at || null,
});

const decorate = async (openings, { includePrivateTeams = false, includeCounts = false } = {}) => {
  if (!openings.length) return [];
  const [skillRows, teamRows, counts] = await Promise.all([
    Skill.find({ _id: trustedIn([...new Set(openings.flatMap((row) => [...row.required_skill_ids, ...row.preferred_skill_ids]))]) }).lean(),
    Team.find({ _id: trustedIn([...new Set(openings.map((row) => row.team_id))]), status: "active", ...(includePrivateTeams ? {} : { visibility: "public" }) }).lean(),
    includeCounts ? CollaborationRequest.aggregate([{ $match: { team_opening_id: { $in: openings.map((row) => row.id) } } }, { $group: { _id: "$team_opening_id", count: { $sum: 1 } } }]) : [],
  ]);
  const skills = new Map(toApps(skillRows).map((row) => [row.id, { id: row.id, slug: row.slug, name: row.name, category: row.category }]));
  const teams = new Map(toApps(teamRows).map((row) => [row.id, row]));
  const countMap = new Map(counts.map((row) => [row._id, row.count]));
  return openings.filter((row) => teams.has(row.team_id)).map((row) => openingDto(row, skills, teams.get(row.team_id), { interestedCount: countMap.get(row.id) || 0 }));
};

const getOpening = async (id, session = null) => {
  const opening = toApp(await TeamOpening.findById(id).session(session).lean());
  if (!opening) throw errors.notFound("Team opening not found");
  return opening;
};

const listPublicOpenings = async (query = {}) => {
  const options = parseListQuery(query, { allowedSorts: ["created_at"], defaultLimit: 18, maxLimit: 30 });
  const filter = { status: "open" };
  if (domain.collaborationRoles.includes(query.role)) filter.role = query.role;
  const teamFilter = { status: "active", visibility: "public" };
  if (query.interest && domain.profileInterests.includes(query.interest)) teamFilter.primary_interests = query.interest;
  if (query.team) teamFilter.slug = String(query.team).trim().toLowerCase().slice(0, 60);
  const publicTeams = await Team.find(teamFilter).select("_id").lean();
  filter.team_id = trustedIn(publicTeams.map((row) => String(row._id)));
  const skill = String(query.skill || "").trim();
  if (skill) {
    const catalog = await Skill.findOne({ $or: mongoose.trusted([{ _id: skill }, { slug: skill.toLowerCase() }]), is_active: true }).select("_id").lean();
    if (!catalog) return { items: [], meta: paginationMeta({ ...options, total: 0 }) };
    filter.$or = mongoose.trusted([{ required_skill_ids: String(catalog._id) }, { preferred_skill_ids: String(catalog._id) }]);
  }
  const [rows, total] = await Promise.all([
    TeamOpening.find(filter).sort({ created_at: -1, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    TeamOpening.countDocuments(filter),
  ]);
  return { items: await decorate(toApps(rows)), meta: paginationMeta({ ...options, total }) };
};

const listTeamOpenings = async (teamId, actorId, query = {}) => {
  const team = await authz.getTeam(teamId);
  const membership = await authz.requireVisible(team, actorId);
  const manager = membership && ["owner", "admin"].includes(membership.role);
  const filter = { team_id: teamId };
  if (!manager) filter.status = "open";
  else if (["open", "closed"].includes(query.status)) filter.status = query.status;
  const rows = toApps(await TeamOpening.find(filter).sort({ status: -1, created_at: -1 }).limit(100).lean());
  return decorate(rows, { includePrivateTeams: true, includeCounts: manager });
};

const createOpening = async (teamId, actorId, input) => {
  const role = String(input.role || "").trim().toLowerCase();
  if (!domain.collaborationRoles.includes(role)) throw errors.validation("A canonical collaboration role is required");
  const [required, preferred] = await Promise.all([skillIds(input.requiredSkillIds || [], "Required skills"), skillIds(input.preferredSkillIds || [], "Preferred skills")]);
  if (preferred.some((id) => required.includes(id))) throw errors.validation("A skill cannot be both required and preferred");
  const commitment = input.commitment || null;
  if (commitment && !domain.collaborationCommitments.includes(commitment)) throw errors.validation("Unsupported commitment");
  const payload = {
    _id: randomUUID(), team_id: teamId, title: text(input.title, 120, "Title", true), description: text(input.description, 2000, "Description"),
    role, required_skill_ids: required, preferred_skill_ids: preferred, commitment, status: "open", created_by: actorId,
  };
  await withTransaction(async (session) => {
    await authz.getTeam(teamId, session);
    await authz.requireAdmin(teamId, actorId, session);
    await TeamOpening.create([payload], { session });
    await createActivity(session, { team_id: teamId, actor_id: actorId, type: "team_opening_created", metadata: { opening_id: payload._id, role } });
  });
  return (await decorate([toApp(await TeamOpening.findById(payload._id).lean())], { includePrivateTeams: true }))[0];
};

const updateOpening = async (id, actorId, input) => {
  const current = await getOpening(id);
  await authz.requireAdmin(current.team_id, actorId);
  if (current.status !== "open") throw errors.conflict("Closed openings cannot be edited");
  const updates = {};
  if (input.title !== undefined) updates.title = text(input.title, 120, "Title", true);
  if (input.description !== undefined) updates.description = text(input.description, 2000, "Description");
  if (input.role !== undefined) {
    const role = String(input.role).trim().toLowerCase();
    if (!domain.collaborationRoles.includes(role)) throw errors.validation("Unsupported collaboration role");
    updates.role = role;
  }
  if (input.requiredSkillIds !== undefined) updates.required_skill_ids = await skillIds(input.requiredSkillIds, "Required skills");
  if (input.preferredSkillIds !== undefined) updates.preferred_skill_ids = await skillIds(input.preferredSkillIds, "Preferred skills");
  const effectiveRequired = updates.required_skill_ids || current.required_skill_ids;
  const effectivePreferred = updates.preferred_skill_ids || current.preferred_skill_ids;
  if (effectivePreferred.some((skillId) => effectiveRequired.includes(skillId))) throw errors.validation("A skill cannot be both required and preferred");
  if (input.commitment !== undefined) {
    if (input.commitment !== null && !domain.collaborationCommitments.includes(input.commitment)) throw errors.validation("Unsupported commitment");
    updates.commitment = input.commitment;
  }
  if (!Object.keys(updates).length) throw errors.validation("No editable opening fields supplied");
  updates.revision = current.revision + 1;
  const updated = await withTransaction(async (session) => {
    const row = toApp(await TeamOpening.findOneAndUpdate({ _id: id, status: "open", revision: current.revision }, { $set: updates }, { session, returnDocument: "after", runValidators: true }).lean());
    if (!row) throw errors.conflict("Opening changed before this update completed");
    await createActivity(session, { team_id: current.team_id, actor_id: actorId, type: "team_opening_updated", metadata: { opening_id: id, fields: Object.keys(updates).filter((key) => key !== "revision") } });
    return row;
  });
  return (await decorate([updated], { includePrivateTeams: true }))[0];
};

const closeOpening = async (id, actorId) => withTransaction(async (session) => {
  const opening = await getOpening(id, session);
  await authz.requireAdmin(opening.team_id, actorId, session);
  const updated = toApp(await TeamOpening.findOneAndUpdate(
    { _id: id, status: "open" }, { $set: { status: "closed", closed_at: new Date(), closed_by: actorId }, $inc: { revision: 1 } },
    { session, returnDocument: "after", runValidators: true },
  ).lean());
  if (!updated) throw errors.conflict("Opening is already closed");
  await createActivity(session, { team_id: opening.team_id, actor_id: actorId, type: "team_opening_closed", metadata: { opening_id: id } });
  return openingDto(updated);
});

const candidateSearch = async (id, actorId, query = {}) => {
  const opening = await getOpening(id);
  await authz.requireAdmin(opening.team_id, actorId);
  const memberships = await TeamMembership.find({ team_id: opening.team_id, status: "active" }).select("user_id").lean();
  const result = await discoverPeople(actorId, {
    ...query, skills: opening.required_skill_ids.join(","), roles: opening.role,
    skillMode: "all", availability: query.availability || "open,limited", limit: Math.min(Number(query.limit) || 20, 30),
  }, { excludeUserIds: memberships.map((row) => row.user_id) });
  const interests = await CollaborationRequest.find({ team_opening_id: id, sender_id: trustedIn(result.items.map((row) => row.id)) }).sort({ created_at: -1 }).lean();
  const interestMap = new Map(interests.map((row) => [row.sender_id, toApp(row)]));
  result.items = result.items.map((card) => ({ ...card, opening_interest: interestMap.has(card.id) ? { request_id: interestMap.get(card.id).id, status: interestMap.get(card.id).status } : null }));
  return result;
};

module.exports = { candidateSearch, closeOpening, createOpening, decorate, getOpening, listPublicOpenings, listTeamOpenings, openingDto, updateOpening };
