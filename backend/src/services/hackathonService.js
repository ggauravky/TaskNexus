const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const {
  Hackathon, HackathonActivity, HackathonParticipant, HackathonSubmission, HackathonTeam,
  Notification, Project, Skill, Team, TeamMembership,
} = require("../models");
const { raw: domain } = require("../contracts/domain");
const { escapeRegex } = require("../data/mongoDataUtils");
const { toApp, toApps } = require("../models/helpers");
const { hackathonCard, hackathonDetail, participationDto, submissionDto, teamRegistrationDto } = require("../serializers/hackathonSerializers");
const { teamSummary } = require("../serializers/teamSerializers");
const { discoverPeople } = require("./discoveryService");
const teamAuth = require("./teamAuthorization");
const { errors } = require("../utils/appError");
const { paginationMeta } = require("../utils/apiResponse");
const { parseListQuery } = require("../utils/queryOptions");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");

const trustedIn = (values) => mongoose.trusted({ $in: values });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const plainText = (value, max, field, required = false) => {
  const clean = String(value ?? "").trim();
  if (required && !clean) throw errors.validation(`${field} is required`);
  if (clean.length > max || /[<>]/.test(clean)) throw errors.validation(`${field} must be plain text and at most ${max} characters`);
  return clean || null;
};

const httpsUrl = (value, field) => {
  const clean = String(value ?? "").trim();
  if (!clean) return null;
  try {
    const url = new URL(clean);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe");
    return url.toString();
  } catch (_error) {
    throw errors.validation(`${field} must be a valid HTTPS URL`);
  }
};

const dateValue = (value, field, required = false) => {
  if (value == null || value === "") {
    if (required) throw errors.validation(`${field} is required`);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw errors.validation(`${field} must be a valid timestamp`);
  return date;
};

const enumValue = (value, values, field, required = false) => {
  if (value == null || value === "") {
    if (required) throw errors.validation(`${field} is required`);
    return null;
  }
  if (!values.includes(value)) throw errors.validation(`Unsupported ${field}`);
  return value;
};

const uniqueList = (value, max, field, transform = (item) => String(item).trim()) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw errors.validation(`${field} must be an array`);
  const items = [...new Set(value.map(transform).filter(Boolean))];
  if (items.length > max) throw errors.validation(`${field} may contain at most ${max} items`);
  return items;
};

const verifySkills = async (ids, session = null) => {
  if (ids.some((id) => !UUID.test(id))) throw errors.validation("One or more skill IDs are invalid");
  const count = await Skill.countDocuments({ _id: trustedIn(ids), is_active: true }).session(session);
  if (count !== ids.length) throw errors.validation("One or more skills are unknown");
  return ids;
};

const normalizeRequirements = (value) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 12) throw errors.validation("Submission requirements must contain at most 12 items");
  const seen = new Set();
  return value.map((item) => {
    const type = enumValue(item?.type, domain.hackathonRequirementTypes, "requirement type", true);
    if (seen.has(type)) throw errors.validation(`Duplicate submission requirement: ${type}`);
    seen.add(type);
    return { type, label: plainText(item?.label, 120, "Requirement label", true), required: item?.required !== false };
  });
};

const catalogInput = async (input, { partial = false, session = null } = {}) => {
  const result = {};
  const assign = (inputKey, key, value) => { if (!partial || input[inputKey] !== undefined) result[key] = value; };
  assign("name", "name", plainText(input.name, 140, "Name", !partial));
  const rawSlug = String(input.slug ?? "").trim().toLowerCase();
  if (!partial || input.slug !== undefined) {
    if (!SLUG.test(rawSlug)) throw errors.validation("Slug must be lowercase and URL-safe");
    result.slug = rawSlug;
  }
  assign("tagline", "tagline", plainText(input.tagline, 180, "Tagline"));
  assign("description", "description", plainText(input.description, 6000, "Description"));
  assign("organizerName", "organizer_name", plainText(input.organizerName, 160, "Organizer name", !partial));
  for (const [inputKey, key, label] of [
    ["websiteUrl", "website_url", "Website URL"], ["registrationUrl", "registration_url", "Registration URL"],
    ["logoUrl", "logo_url", "Logo URL"], ["coverUrl", "cover_url", "Cover URL"],
  ]) assign(inputKey, key, httpsUrl(input[inputKey], label));
  assign("mode", "mode", enumValue(input.mode, domain.hackathonModes, "mode", !partial));
  assign("city", "city", plainText(input.city, 120, "City"));
  assign("venue", "venue", plainText(input.venue, 200, "Venue"));
  for (const [inputKey, key, label, required] of [
    ["registrationStart", "registration_start", "Registration start", false],
    ["registrationDeadline", "registration_deadline", "Registration deadline", false],
    ["eventStart", "event_start", "Event start", true], ["eventEnd", "event_end", "Event end", true],
    ["submissionDeadline", "submission_deadline", "Submission deadline", false],
  ]) assign(inputKey, key, dateValue(input[inputKey], label, !partial && required));
  for (const [inputKey, key] of [["teamMinSize", "team_min_size"], ["teamMaxSize", "team_max_size"]]) {
    if (!partial || input[inputKey] !== undefined) {
      const value = input[inputKey] == null || input[inputKey] === "" ? null : Number(input[inputKey]);
      if (value != null && (!Number.isInteger(value) || value < 1 || value > 50)) throw errors.validation("Team size must be an integer from 1 to 50");
      result[key] = value;
    }
  }
  assign("status", "status", enumValue(input.status, domain.hackathonStatuses, "status", !partial));
  assign("visibility", "visibility", enumValue(input.visibility, domain.hackathonVisibilities, "visibility", false) || "public");
  if (!partial || input.allowedRoles !== undefined) {
    result.allowed_roles = uniqueList(input.allowedRoles, 12, "Allowed roles", (item) => String(item).trim().toLowerCase());
    if (result.allowed_roles.some((item) => !domain.collaborationRoles.includes(item))) throw errors.validation("Unsupported allowed role");
  }
  if (!partial || input.recommendedSkillIds !== undefined) result.recommended_skill_ids = await verifySkills(uniqueList(input.recommendedSkillIds, 16, "Recommended skills"), session);
  if (!partial || input.themes !== undefined) result.themes = uniqueList(input.themes, 12, "Themes", (item) => plainText(item, 60, "Theme")?.toLowerCase());
  if (!partial || input.submissionRequirements !== undefined) result.submission_requirements = normalizeRequirements(input.submissionRequirements);
  return result;
};

const findHackathon = async (id, session = null, { allowArchived = false } = {}) => {
  const row = toApp(await Hackathon.findById(id).session(session).lean());
  if (!row || (!allowArchived && row.status === "archived")) throw errors.notFound("Hackathon not found");
  return row;
};

const assertVisible = (hackathon, actorRole) => {
  if (hackathon.visibility !== "public" && actorRole !== "admin") throw errors.notFound("Hackathon not found");
};

const participationWritable = (hackathon, now) => {
  if (["completed", "archived"].includes(hackathon.status) || now > new Date(hackathon.event_end)) throw errors.conflict("This Hackathon is no longer accepting participation changes");
};

const registrationWritable = (hackathon, now) => {
  if (hackathon.status !== "registration_open") throw errors.conflict("Team registration is not open");
  if (hackathon.registration_deadline && now > new Date(hackathon.registration_deadline)) throw errors.conflict("The Team registration deadline has passed");
};

const submissionWritable = (hackathon, now) => {
  if (["submission_closed", "completed", "archived"].includes(hackathon.status)) throw errors.conflict("Hackathon submissions are closed");
  if (hackathon.submission_deadline && now > new Date(hackathon.submission_deadline)) throw errors.conflict("The submission deadline has passed");
};

const listHackathons = async (query = {}, actorId = null, actorRole = null) => {
  const options = parseListQuery(query, { allowedSorts: ["registration_deadline", "event_start", "updated_at"], defaultSort: "event_start", defaultLimit: 18, maxLimit: 30 });
  const filter = actorRole === "admin" && query.includePrivate === "true" ? {} : { visibility: "public" };
  if (query.status) filter.status = enumValue(query.status, domain.hackathonStatuses, "status", true);
  else filter.status = mongoose.trusted({ $ne: "archived" });
  if (query.mode) filter.mode = enumValue(query.mode, domain.hackathonModes, "mode", true);
  if (query.theme) filter.themes = plainText(query.theme, 60, "Theme", true).toLowerCase();
  if (query.skill) {
    if (!UUID.test(query.skill)) throw errors.validation("Skill must be a UUID");
    filter.recommended_skill_ids = query.skill;
  }
  if (options.search) {
    const pattern = new RegExp(escapeRegex(options.search), "i");
    filter.$or = mongoose.trusted([{ name: pattern }, { tagline: pattern }, { organizer_name: pattern }, { themes: pattern }]);
  }
  if (query.date) {
    const start = dateValue(query.date, "Date", true); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
    filter.event_start = mongoose.trusted({ $lt: end }); filter.event_end = mongoose.trusted({ $gte: start });
  }
  if (query.my === "true") {
    if (!actorId) return { items: [], meta: paginationMeta({ ...options, total: 0 }) };
    const rows = await HackathonParticipant.find({ user_id: actorId, status: mongoose.trusted({ $ne: "withdrawn" }) }).select("hackathon_id").lean();
    filter._id = trustedIn(rows.map((row) => row.hackathon_id));
  }
  const sort = { [options.sortBy]: options.sortOrder === "asc" ? 1 : -1, _id: 1 };
  const [rows, total] = await Promise.all([
    Hackathon.find(filter).sort(sort).skip((options.page - 1) * options.limit).limit(options.limit).lean(), Hackathon.countDocuments(filter),
  ]);
  const items = toApps(rows); const ids = items.map((row) => row.id);
  const [participations, memberships] = actorId ? await Promise.all([
    HackathonParticipant.find({ hackathon_id: trustedIn(ids), user_id: actorId }).lean(), TeamMembership.find({ user_id: actorId, status: "active" }).select("team_id role").lean(),
  ]) : [[], []];
  const teamRows = memberships.length ? await HackathonTeam.find({ hackathon_id: trustedIn(ids), team_id: trustedIn(memberships.map((row) => row.team_id)), status: "registered" }).lean() : [];
  const participationMap = new Map(toApps(participations).map((row) => [row.hackathon_id, participationDto(row)]));
  const teamMap = new Map(toApps(teamRows).map((row) => [row.hackathon_id, { id: row.id, team_id: row.team_id, status: row.status }]));
  return { items: items.map((row) => hackathonCard(row, { participation: participationMap.get(row.id) || null, team: teamMap.get(row.id) || null })), meta: paginationMeta({ ...options, total }) };
};

const registrationPermissions = (membership, submission) => ({
  view_workspace: Boolean(membership),
  manage_registration: ["owner", "admin"].includes(membership?.role),
  link_project: ["owner", "admin"].includes(membership?.role) && submission?.status !== "submitted",
  edit_submission: ["owner", "admin"].includes(membership?.role) && submission?.status !== "submitted",
  submit: ["owner", "admin"].includes(membership?.role) && submission?.status !== "submitted",
});

const projectSummary = (project) => project ? ({ id: project.id, team_id: project.team_id, slug: project.slug, name: project.name, status: project.status, repository_url: project.repository_url || null, demo_url: project.demo_url || null }) : null;

const eligibility = (hackathon, count) => {
  if (hackathon.team_min_size && count < hackathon.team_min_size) return `Team has ${count} active members; minimum is ${hackathon.team_min_size}`;
  if (hackathon.team_max_size && count > hackathon.team_max_size) return `Team has ${count} active members; maximum is ${hackathon.team_max_size}`;
  return null;
};

const decorateRegistration = async (registration, actorId, hackathon = null) => {
  if (!registration) return null;
  const [event, team, membership, project, submission, memberCount] = await Promise.all([
    hackathon || findHackathon(registration.hackathon_id), Team.findById(registration.team_id).lean(),
    TeamMembership.findOne({ team_id: registration.team_id, user_id: actorId, status: "active" }).lean(),
    registration.project_id ? Project.findById(registration.project_id).lean() : null,
    HackathonSubmission.findOne({ hackathon_team_id: registration.id }).lean(),
    TeamMembership.countDocuments({ team_id: registration.team_id, status: "active" }),
  ]);
  const warning = eligibility(event, memberCount);
  if (Boolean(warning) !== Boolean(registration.eligibility_warning) || (warning || null) !== (registration.eligibility_message || null)) {
    await HackathonTeam.updateOne({ _id: registration.id, status: "registered" }, { $set: { eligibility_warning: Boolean(warning), eligibility_message: warning } });
    registration.eligibility_warning = Boolean(warning); registration.eligibility_message = warning;
  }
  const teamRow = toApp(team); const member = toApp(membership); const projectRow = toApp(project); const submissionRow = toApp(submission);
  return teamRegistrationDto(registration, {
    team: teamRow ? teamSummary(teamRow, { memberCount, relationship: member ? { kind: "member", role: member.role } : { kind: "none" } }) : null,
    project: projectSummary(projectRow), submission: submissionRow ? { id: submissionRow.id, status: submissionRow.status, revision: submissionRow.revision } : null,
    memberCount, permissions: registrationPermissions(member, submissionRow),
  });
};

const getHackathon = async (slug, actorId = null, actorRole = null) => {
  const row = toApp(await Hackathon.findOne({ slug: String(slug).toLowerCase() }).lean());
  if (!row || row.status === "archived") throw errors.notFound("Hackathon not found");
  assertVisible(row, actorRole);
  const [skills, participation, memberships, registeredTeamCount] = await Promise.all([
    Skill.find({ _id: trustedIn(row.recommended_skill_ids || []), is_active: true }).select("_id slug name category").lean(),
    actorId ? HackathonParticipant.findOne({ hackathon_id: row.id, user_id: actorId }).lean() : null,
    actorId ? TeamMembership.find({ user_id: actorId, status: "active" }).select("team_id role").lean() : [],
    HackathonTeam.countDocuments({ hackathon_id: row.id, status: "registered" }),
  ]);
  const registration = memberships.length ? toApp(await HackathonTeam.findOne({ hackathon_id: row.id, team_id: trustedIn(memberships.map((item) => item.team_id)), status: "registered" }).sort({ created_at: -1 }).lean()) : null;
  return hackathonDetail(row, {
    skills: toApps(skills).map((skill) => ({ id: skill.id, slug: skill.slug, name: skill.name, category: skill.category })),
    participation: participationDto(toApp(participation)), team: registration ? await decorateRegistration(registration, actorId, row) : null,
    registeredTeamCount, permissions: { participate: Boolean(actorId) && !["completed", "archived"].includes(row.status), manage_catalog: actorRole === "admin" },
  });
};

const createHackathon = async (actorId, input) => {
  const payload = { _id: randomUUID(), ...(await catalogInput(input)), created_by: actorId };
  const document = new Hackathon(payload); await document.validate();
  try { await Hackathon.create(payload); } catch (error) { if (isDuplicateKey(error)) throw errors.conflict("Hackathon slug is already in use"); throw error; }
  return getHackathon(payload.slug, actorId, "admin");
};

const updateHackathon = async (id, actorId, input) => {
  const current = await findHackathon(id, null, { allowArchived: true });
  if (current.status === "archived") throw errors.conflict("Archived Hackathons cannot be edited");
  const updates = await catalogInput(input, { partial: true });
  if (!Object.keys(updates).length) throw errors.validation("No editable Hackathon fields supplied");
  const candidate = new Hackathon({ ...current, _id: current.id, ...updates, created_by: current.created_by }); await candidate.validate();
  try { await Hackathon.updateOne({ _id: id, status: mongoose.trusted({ $ne: "archived" }) }, { $set: updates }, { runValidators: true }); }
  catch (error) { if (isDuplicateKey(error)) throw errors.conflict("Hackathon slug is already in use"); throw error; }
  return getHackathon(updates.slug || current.slug, actorId, "admin");
};

const archiveHackathon = async (id) => {
  const row = await Hackathon.findOneAndUpdate({ _id: id, status: mongoose.trusted({ $ne: "archived" }) }, { $set: { status: "archived" } }, { returnDocument: "after" }).lean();
  if (!row) throw errors.notFound("Hackathon not found");
  return { id, status: "archived" };
};

const saveParticipation = async (hackathonId, actorId, input, { create = false } = {}) => {
  const now = new Date(); const hackathon = await findHackathon(hackathonId); participationWritable(hackathon, now);
  const preferredRoles = uniqueList(input.preferredRoles, 8, "Preferred roles", (item) => String(item).trim().toLowerCase());
  if (preferredRoles.some((item) => !domain.collaborationRoles.includes(item))) throw errors.validation("Unsupported preferred role");
  const skillIds = await verifySkills(uniqueList(input.preferredSkillIds, 12, "Preferred skills"));
  const status = input.status !== undefined
    ? enumValue(input.status, ["interested", "participating"], "participation status", true)
    : (create ? "participating" : undefined);
  const updates = {
    ...(status ? { status } : {}), ...(input.lookingForTeam !== undefined ? { looking_for_team: Boolean(input.lookingForTeam) } : {}),
    ...(input.preferredRoles !== undefined ? { preferred_roles: preferredRoles } : {}), ...(input.preferredSkillIds !== undefined ? { preferred_skill_ids: skillIds } : {}),
    ...(input.commitment !== undefined ? { commitment: enumValue(input.commitment, domain.collaborationCommitments, "commitment", true) } : {}),
    ...(input.message !== undefined ? { message: plainText(input.message, 500, "Message") } : {}),
    ...(input.visibleOnHackathon !== undefined ? { visible_on_hackathon: Boolean(input.visibleOnHackathon) } : {}),
  };
  let saved;
  try {
    saved = await withTransaction(async (session) => {
      await findHackathon(hackathonId, session); participationWritable(hackathon, now);
      const existing = toApp(await HackathonParticipant.findOne({ hackathon_id: hackathonId, user_id: actorId }).session(session).lean());
      if (create && existing && existing.status !== "withdrawn") throw errors.conflict("You already participate in this Hackathon");
      if (!create && (!existing || existing.status === "withdrawn")) throw errors.notFound("Active Hackathon participation not found");
      if (create && existing) {
        saved = toApp(await HackathonParticipant.findOneAndUpdate({ _id: existing.id, status: "withdrawn" }, { $set: { ...updates, joined_at: now } }, { session, returnDocument: "after", runValidators: true }).lean());
      } else if (create) {
        const [created] = await HackathonParticipant.create([{ _id: randomUUID(), hackathon_id: hackathonId, user_id: actorId, status: "participating", ...updates, joined_at: now }], { session }); saved = toApp(created);
      } else saved = toApp(await HackathonParticipant.findOneAndUpdate({ _id: existing.id, status: mongoose.trusted({ $ne: "withdrawn" }) }, { $set: updates }, { session, returnDocument: "after", runValidators: true }).lean());
      await HackathonActivity.create([{ _id: randomUUID(), hackathon_id: hackathonId, actor_id: actorId, type: create ? "participant_joined" : "participant_updated" }], { session });
      return saved;
    });
  } catch (error) { if (isDuplicateKey(error)) throw errors.conflict("You already participate in this Hackathon"); throw error; }
  return participationDto(saved);
};

const withdrawParticipation = async (hackathonId, actorId) => withTransaction(async (session) => {
  const row = toApp(await HackathonParticipant.findOneAndUpdate({ hackathon_id: hackathonId, user_id: actorId, status: mongoose.trusted({ $ne: "withdrawn" }) }, { $set: { status: "withdrawn", looking_for_team: false } }, { session, returnDocument: "after" }).lean());
  if (!row) throw errors.notFound("Active Hackathon participation not found");
  await HackathonActivity.create([{ _id: randomUUID(), hackathon_id: hackathonId, actor_id: actorId, type: "participant_withdrawn" }], { session });
  return participationDto(row);
});

const discoverTeammates = async (hackathonId, actorId, actorRole, query) => {
  const hackathon = await findHackathon(hackathonId); assertVisible(hackathon, actorRole);
  const participants = toApps(await HackathonParticipant.find({ hackathon_id: hackathonId, status: mongoose.trusted({ $ne: "withdrawn" }), looking_for_team: true, visible_on_hackathon: true }).lean());
  const result = await discoverPeople(actorId, query, { allowedUserIds: participants.map((row) => row.user_id) });
  const participantMap = new Map(participants.map((row) => [row.user_id, row]));
  result.items = result.items.map((person) => {
    const participant = participantMap.get(person.id);
    return { ...person, hackathon_context: { preferred_roles: participant.preferred_roles, preferred_skill_ids: participant.preferred_skill_ids, commitment: participant.commitment, message: participant.message } };
  });
  return result;
};

const registerTeam = async (hackathonId, actorId, teamId) => {
  const now = new Date(); let registration;
  try {
    registration = await withTransaction(async (session) => {
      const hackathon = await findHackathon(hackathonId, session); registrationWritable(hackathon, now);
      const team = await teamAuth.getTeam(teamId, session); await teamAuth.requireAdmin(teamId, actorId, session);
      const memberCount = await TeamMembership.countDocuments({ team_id: teamId, status: "active" }).session(session);
      const warning = eligibility(hackathon, memberCount); if (warning) throw errors.validation(warning);
      const [row] = await HackathonTeam.create([{ _id: randomUUID(), hackathon_id: hackathonId, team_id: team.id, registered_by: actorId, status: "registered" }], { session });
      await HackathonActivity.create([{ _id: randomUUID(), hackathon_id: hackathonId, hackathon_team_id: String(row._id), team_id: team.id, actor_id: actorId, type: "team_registered" }], { session });
      await Notification.create([{ _id: randomUUID(), recipient_id: actorId, actor_id: actorId, type: "hackathon_team_registered", content: { title: "Team registered", message: `${team.name} is registered for ${hackathon.name}.` }, entity_type: "hackathon_team", entity_id: String(row._id), status: "unread", priority: "medium", event_key: `hackathon-team-registered:${row._id}:${actorId}` }], { session });
      return toApp(row);
    });
  } catch (error) { if (isDuplicateKey(error)) throw errors.conflict("This Team is already registered for the Hackathon"); throw error; }
  return decorateRegistration(registration, actorId);
};

const getMyTeam = async (hackathonId, actorId) => {
  const memberships = await TeamMembership.find({ user_id: actorId, status: "active" }).select("team_id").lean();
  const row = toApp(await HackathonTeam.findOne({ hackathon_id: hackathonId, team_id: trustedIn(memberships.map((item) => item.team_id)), status: "registered" }).sort({ created_at: -1 }).lean());
  return row ? decorateRegistration(row, actorId) : null;
};

const getRegistration = async (id, actorId, session = null, manager = false) => {
  const row = toApp(await HackathonTeam.findOne({ _id: id, status: "registered" }).session(session).lean());
  if (!row) throw errors.notFound("Hackathon Team registration not found");
  const membership = manager ? await teamAuth.requireAdmin(row.team_id, actorId, session) : await teamAuth.requireMember(row.team_id, actorId, session);
  return { row, membership };
};

const withdrawTeam = async (id, actorId) => withTransaction(async (session) => {
  const { row } = await getRegistration(id, actorId, session, true);
  const submission = await HackathonSubmission.findOne({ hackathon_team_id: id }).session(session).lean();
  if (submission?.status === "submitted") throw errors.conflict("A submitted Hackathon Team cannot be withdrawn");
  const updated = toApp(await HackathonTeam.findOneAndUpdate({ _id: id, status: "registered", revision: row.revision }, { $set: { status: "withdrawn", withdrawn_at: new Date() }, $inc: { revision: 1 } }, { session, returnDocument: "after" }).lean());
  if (!updated) throw errors.conflict("Hackathon Team registration changed before withdrawal completed");
  await HackathonActivity.create([{ _id: randomUUID(), hackathon_id: row.hackathon_id, hackathon_team_id: id, team_id: row.team_id, actor_id: actorId, type: "team_withdrawn" }], { session });
  return { id, status: "withdrawn" };
});

const linkProject = async (id, actorId, projectId, revision) => withTransaction(async (session) => {
  const { row } = await getRegistration(id, actorId, session, true); const hackathon = await findHackathon(row.hackathon_id, session); submissionWritable(hackathon, new Date());
  const project = toApp(await Project.findOne({ _id: projectId, team_id: row.team_id, status: mongoose.trusted({ $ne: "archived" }) }).session(session).lean());
  if (!project) throw errors.forbidden("Only an active Project owned by the registered Team may be linked");
  const submitted = await HackathonSubmission.findOne({ hackathon_team_id: id, status: "submitted" }).session(session).lean();
  if (submitted) throw errors.conflict("The Project cannot change after final submission");
  const updated = toApp(await HackathonTeam.findOneAndUpdate({ _id: id, status: "registered", revision }, { $set: { project_id: projectId }, $inc: { revision: 1 } }, { session, returnDocument: "after" }).lean());
  if (!updated) throw errors.conflict("Hackathon Team registration changed; refresh before linking the Project");
  await HackathonSubmission.updateOne({ hackathon_team_id: id, status: mongoose.trusted({ $ne: "submitted" }) }, { $set: { project_id: projectId }, $inc: { revision: 1 } }, { session });
  await HackathonActivity.create([{ _id: randomUUID(), hackathon_id: row.hackathon_id, hackathon_team_id: id, team_id: row.team_id, project_id: projectId, actor_id: actorId, type: "project_linked" }], { session });
  return teamRegistrationDto(updated, { project: projectSummary(project), permissions: registrationPermissions({ role: "admin" }) });
});

const unlinkProject = async (id, actorId, revision) => withTransaction(async (session) => {
  const { row } = await getRegistration(id, actorId, session, true); const submission = await HackathonSubmission.findOne({ hackathon_team_id: id }).session(session).lean();
  if (submission?.status === "submitted") throw errors.conflict("The Project cannot be unlinked after final submission");
  const updated = toApp(await HackathonTeam.findOneAndUpdate({ _id: id, status: "registered", revision, project_id: mongoose.trusted({ $ne: null }) }, { $set: { project_id: null }, $inc: { revision: 1 } }, { session, returnDocument: "after" }).lean());
  if (!updated) throw errors.conflict("Hackathon Team registration changed; refresh before unlinking the Project");
  await HackathonSubmission.deleteOne({ hackathon_team_id: id, status: mongoose.trusted({ $ne: "submitted" }) }, { session });
  await HackathonActivity.create([{ _id: randomUUID(), hackathon_id: row.hackathon_id, hackathon_team_id: id, team_id: row.team_id, project_id: row.project_id, actor_id: actorId, type: "project_unlinked" }], { session });
  return { id, project: null, revision: updated.revision };
});

const manualCompletion = (input, type) => Boolean((input.checklist || []).find((item) => item?.type === type)?.completed);
const completionFor = (type, row, project, eligible, input = {}) => ({
  project_title: Boolean(project?.name), project_description: Boolean(project?.description),
  repository: Boolean(row.repository_url || project?.repository_url), demo: Boolean(row.demo_url || project?.demo_url),
  presentation: Boolean(row.presentation_url), video: Boolean(row.video_url), submission_url: Boolean(row.submission_url),
  team_confirmed: eligible && manualCompletion(input, type), required_form: manualCompletion(input, type),
}[type] ?? manualCompletion(input, type));

const buildReadiness = (hackathon, row, project, eligible, input = {}) => {
  const checklist = (hackathon.submission_requirements || []).map((item) => ({ type: item.type, label: item.label, required: Boolean(item.required), completed: completionFor(item.type, row, project, eligible, input) }));
  const required = checklist.filter((item) => item.required); const completed = required.filter((item) => item.completed).length;
  return { checklist, readiness: { complete: completed, total: required.length, ready: completed === required.length, missing: required.filter((item) => !item.completed).map((item) => item.type) } };
};

const getSubmission = async (id, actorId) => {
  const { row } = await getRegistration(id, actorId); const [hackathon, project, submission, memberCount] = await Promise.all([
    findHackathon(row.hackathon_id), row.project_id ? Project.findById(row.project_id).lean() : null,
    HackathonSubmission.findOne({ hackathon_team_id: id }).lean(), TeamMembership.countDocuments({ team_id: row.team_id, status: "active" }),
  ]);
  if (!submission) return null;
  const app = toApp(submission); const ready = buildReadiness(hackathon, app, toApp(project), !eligibility(hackathon, memberCount), { checklist: app.checklist });
  return submissionDto({ ...app, checklist: ready.checklist }, ready.readiness);
};

const saveSubmission = async (id, actorId, input) => {
  const now = new Date(); const revision = Number(input.revision);
  if (!Number.isInteger(revision) || revision < 0) throw errors.validation("A non-negative revision is required");
  let saved; let readiness;
  try {
    saved = await withTransaction(async (session) => {
      const { row } = await getRegistration(id, actorId, session, true); const hackathon = await findHackathon(row.hackathon_id, session); submissionWritable(hackathon, now);
      if (!row.project_id) throw errors.validation("Link a Team Project before preparing the submission");
      const project = toApp(await Project.findOne({ _id: row.project_id, team_id: row.team_id, status: mongoose.trusted({ $ne: "archived" }) }).session(session).lean());
      if (!project) throw errors.validation("The linked Project is no longer eligible");
      const current = toApp(await HackathonSubmission.findOne({ hackathon_team_id: id }).session(session).lean());
      if (current?.status === "submitted") throw errors.conflict("Final submissions are immutable");
      const values = { repository_url: httpsUrl(input.repositoryUrl, "Repository URL"), demo_url: httpsUrl(input.demoUrl, "Demo URL"), presentation_url: httpsUrl(input.presentationUrl, "Presentation URL"), video_url: httpsUrl(input.videoUrl, "Video URL"), submission_url: httpsUrl(input.submissionUrl, "Final submission URL") };
      const base = { ...(current || {}), ...values }; const memberCount = await TeamMembership.countDocuments({ team_id: row.team_id, status: "active" }).session(session);
      const built = buildReadiness(hackathon, base, project, !eligibility(hackathon, memberCount), input); readiness = built.readiness;
      if (current) {
        saved = toApp(await HackathonSubmission.findOneAndUpdate({ _id: current.id, status: mongoose.trusted({ $ne: "submitted" }), revision }, { $set: { ...values, checklist: built.checklist, status: readiness.ready ? "ready" : "draft" }, $inc: { revision: 1 } }, { session, returnDocument: "after", runValidators: true }).lean());
        if (!saved) throw errors.conflict("Submission changed; refresh before saving again");
      } else {
        if (revision !== 0) throw errors.conflict("Submission revision is stale");
        const [created] = await HackathonSubmission.create([{ _id: randomUUID(), hackathon_id: row.hackathon_id, hackathon_team_id: id, team_id: row.team_id, project_id: row.project_id, ...values, checklist: built.checklist, status: readiness.ready ? "ready" : "draft" }], { session }); saved = toApp(created);
      }
      await HackathonActivity.create([{ _id: randomUUID(), hackathon_id: row.hackathon_id, hackathon_team_id: id, team_id: row.team_id, project_id: row.project_id, actor_id: actorId, type: current ? "submission_updated" : "submission_started" }], { session });
      return saved;
    });
  } catch (error) { if (isDuplicateKey(error)) throw errors.conflict("Submission changed; refresh before saving again"); throw error; }
  return submissionDto(saved, readiness);
};

const submitFinal = async (id, actorId, input) => {
  const now = new Date(); const revision = Number(input.revision);
  if (input.confirm !== true) throw errors.validation("Final submission confirmation is required");
  if (!Number.isInteger(revision) || revision < 0) throw errors.validation("A non-negative revision is required");
  let final; let readiness;
  await withTransaction(async (session) => {
    const { row } = await getRegistration(id, actorId, session, true); const hackathon = await findHackathon(row.hackathon_id, session); submissionWritable(hackathon, now);
    const submission = toApp(await HackathonSubmission.findOne({ hackathon_team_id: id }).session(session).lean());
    if (!submission || submission.status === "submitted") throw errors.conflict(submission ? "This Team entry is already submitted" : "Save a ready submission before final submission");
    const project = await Project.findById(row.project_id).session(session).lean();
    const memberCount = await TeamMembership.countDocuments({ team_id: row.team_id, status: "active" }).session(session);
    const built = buildReadiness(hackathon, submission, toApp(project), !eligibility(hackathon, memberCount), { checklist: submission.checklist }); readiness = built.readiness;
    if (!readiness.ready) throw errors.validation(`Submission is missing required items: ${readiness.missing.join(", ")}`);
    final = toApp(await HackathonSubmission.findOneAndUpdate({ _id: submission.id, status: mongoose.trusted({ $ne: "submitted" }), revision }, { $set: { status: "submitted", checklist: built.checklist, submitted_by: actorId, submitted_at: now }, $inc: { revision: 1 } }, { session, returnDocument: "after", runValidators: true }).lean());
    if (!final) throw errors.conflict("Submission changed; refresh before final submission");
    await HackathonActivity.create([{ _id: randomUUID(), hackathon_id: row.hackathon_id, hackathon_team_id: id, team_id: row.team_id, project_id: row.project_id, actor_id: actorId, type: "submission_submitted" }], { session });
    const members = await TeamMembership.find({ team_id: row.team_id, status: "active" }).select("user_id").session(session).lean();
    if (members.length) await Notification.insertMany(members.map((member) => ({ _id: randomUUID(), recipient_id: member.user_id, actor_id: actorId, type: "hackathon_submission_submitted", content: { title: "Hackathon entry submitted", message: `${hackathon.name} entry was submitted.` }, entity_type: "hackathon_submission", entity_id: final.id, status: "unread", priority: "high", event_key: `hackathon-submitted:${final.id}:${member.user_id}` })), { session });
  });
  return submissionDto(final, readiness);
};

module.exports = {
  archiveHackathon, createHackathon, discoverTeammates, findHackathon, getHackathon, getMyTeam, getSubmission,
  linkProject, listHackathons, registerTeam, saveParticipation, saveSubmission, submitFinal, unlinkProject,
  updateHackathon, withdrawParticipation, withdrawTeam,
  _private: { buildReadiness, catalogInput, eligibility, httpsUrl, normalizeRequirements, registrationWritable, submissionWritable },
};
