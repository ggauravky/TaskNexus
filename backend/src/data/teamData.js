const mongoose = require("mongoose");
const {
  Skill, Team, TeamActivity, TeamInvitation, TeamJoinRequest, TeamMembership,
  User, UserProfile, UserSkill,
} = require("../models");
const { escapeRegex } = require("./mongoDataUtils");
const { toApp, toApps } = require("../models/helpers");

const trustedIn = (values) => mongoose.trusted({ $in: values });

const findTeamById = async (id, options = {}) => toApp(await Team.findById(id).session(options.session || null).lean());
const findTeamBySlug = async (slug) => toApp(await Team.findOne({ slug: String(slug).toLowerCase() }).lean());
const findMembership = async (teamId, userId, options = {}) => toApp(await TeamMembership.findOne({
  team_id: teamId, user_id: userId, ...(options.activeOnly === false ? {} : { status: "active" }),
}).session(options.session || null).lean());

const listTeams = async ({ userId, scope, search, interest, joinPolicy, page, limit }) => {
  if (scope === "mine") {
    if (!userId) return { items: [], total: 0, page, limit };
    const memberships = await TeamMembership.find({ user_id: userId, status: "active" })
      .sort({ updated_at: -1 }).skip((page - 1) * limit).limit(limit).lean();
    const total = await TeamMembership.countDocuments({ user_id: userId, status: "active" });
    const teams = await Team.find({ _id: trustedIn(memberships.map((item) => item.team_id)), status: "active" }).lean();
    const byId = new Map(teams.map((item) => [String(item._id), toApp(item)]));
    return { items: memberships.map((item) => ({ team: byId.get(item.team_id), membership: toApp(item) })).filter((item) => item.team), total, page, limit };
  }
  const filter = { visibility: "public", status: "active" };
  if (interest) filter.primary_interests = interest;
  if (joinPolicy) filter.join_policy = joinPolicy;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = mongoose.trusted([{ name: pattern }, { tagline: pattern }, { slug: pattern }]);
  }
  const [items, total] = await Promise.all([
    Team.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Team.countDocuments(filter),
  ]);
  return { items: toApps(items), total, page, limit };
};

const countMembers = async (teamIds) => {
  if (!teamIds.length) return new Map();
  const rows = await TeamMembership.aggregate([
    { $match: { team_id: { $in: teamIds }, status: "active" } },
    { $group: { _id: "$team_id", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
};

const profileSummaries = async (userIds, { publicOnly = false, session = null } = {}) => {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const [users, profiles, assignments] = await Promise.all([
    User.find({ _id: trustedIn(ids) }).select("_id profile").session(session).lean(),
    UserProfile.find({ _id: trustedIn(ids) }).session(session).lean(),
    UserSkill.find({ user_id: trustedIn(ids), is_primary: true }).session(session).lean(),
  ]);
  const skills = await Skill.find({ _id: trustedIn(assignments.map((item) => item.skill_id)) }).session(session).lean();
  const usersById = new Map(users.map((item) => [String(item._id), item]));
  const profilesById = new Map(profiles.map((item) => [String(item._id), item]));
  const skillById = new Map(skills.map((item) => [String(item._id), toApp(item)]));
  const skillsByUser = new Map();
  assignments.forEach((item) => skillsByUser.set(item.user_id, [...(skillsByUser.get(item.user_id) || []), skillById.get(item.skill_id)].filter(Boolean)));
  return new Map(ids.map((id) => {
    const user = usersById.get(id);
    const profile = profilesById.get(id);
    const visible = !publicOnly || profile?.visibility === "public";
    const legacy = user?.profile || {};
    const displayName = [legacy.firstName || legacy.first_name, legacy.lastName || legacy.last_name].filter(Boolean).join(" ") || profile?.username || "TaskNexus member";
    return [id, {
      id, display_name: displayName, username: visible ? profile?.username || null : null,
      avatar_url: visible ? profile?.avatar_url || null : null, headline: visible ? profile?.headline || null : null,
      primary_skills: visible ? skillsByUser.get(id) || [] : [], preferred_roles: visible ? profile?.preferred_roles || [] : [],
      profile_visibility: profile?.visibility || "private",
    }];
  }));
};

const viewerRelationships = async (teamIds, userId) => {
  const result = new Map();
  if (!userId || !teamIds.length) return result;
  const [memberships, invitations, requests] = await Promise.all([
    TeamMembership.find({ team_id: trustedIn(teamIds), user_id: userId, status: "active" }).lean(),
    TeamInvitation.find({ team_id: trustedIn(teamIds), invited_user_id: userId, status: "pending" }).lean(),
    TeamJoinRequest.find({ team_id: trustedIn(teamIds), user_id: userId, status: "pending" }).lean(),
  ]);
  memberships.forEach((item) => result.set(item.team_id, { kind: "member", role: item.role, membership_id: String(item._id) }));
  invitations.forEach((item) => { if (!result.has(item.team_id)) result.set(item.team_id, { kind: "invited", invitation_id: String(item._id) }); });
  requests.forEach((item) => { if (!result.has(item.team_id)) result.set(item.team_id, { kind: "pending_request", request_id: String(item._id) }); });
  return result;
};

const listMembers = async (teamId, { page, limit }) => {
  const filter = { team_id: teamId, status: "active" };
  const [items, total] = await Promise.all([
    TeamMembership.find(filter).sort({ role: 1, joined_at: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    TeamMembership.countDocuments(filter),
  ]);
  return { items: toApps(items), total, page, limit };
};

const listActivity = async (teamId, { page, limit }) => {
  const filter = { team_id: teamId };
  const [items, total] = await Promise.all([
    TeamActivity.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    TeamActivity.countDocuments(filter),
  ]);
  return { items: toApps(items), total, page, limit };
};

module.exports = {
  countMembers, findMembership, findTeamById, findTeamBySlug, listActivity, listMembers,
  listTeams, profileSummaries, viewerRelationships,
};
