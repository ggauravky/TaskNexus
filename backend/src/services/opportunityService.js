const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const { Organization, Opportunity, OpportunityCandidateState, Skill } = require("../models");
const { raw: domain } = require("../contracts/domain");
const { escapeRegex } = require("../data/mongoDataUtils");
const { toApp, toApps } = require("../models/helpers");
const { errors } = require("../utils/appError");
const { paginationMeta } = require("../utils/apiResponse");
const { parseListQuery } = require("../utils/queryOptions");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const { evaluateOpportunity, loadCandidateContext } = require("./opportunityEligibilityService");
const { candidateStateDto, organizationPublicDto, opportunityCandidateDto } = require("../serializers/opportunitySerializers");

const trustedIn = (values) => mongoose.trusted({ $in: values });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const plainText = (value, max, field, required = false) => {
  const clean = String(value ?? "").trim();
  if (required && !clean) throw errors.validation(`${field} is required`);
  if (clean.length > max || /[<>]/.test(clean)) throw errors.validation(`${field} must be plain text and at most ${max} characters`);
  return clean || null;
};

const httpsUrl = (value, field, required = false) => {
  const clean = String(value ?? "").trim();
  if (!clean) {
    if (required) throw errors.validation(`${field} is required`);
    return null;
  }
  try {
    const url = new URL(clean);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe");
    return url.toString();
  } catch (_error) { throw errors.validation(`${field} must be a valid HTTPS URL`); }
};

const enumValue = (value, values, field, required = false) => {
  if (value == null || value === "") {
    if (required) throw errors.validation(`${field} is required`);
    return null;
  }
  if (!values.includes(value)) throw errors.validation(`Unsupported ${field}`);
  return value;
};

const dateValue = (value, field) => {
  if (value == null || value === "") return null;
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw errors.validation(`${field} must be a valid timestamp`);
  return result;
};

const numberValue = (value, field, { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}) => {
  if (value == null || value === "") return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max || (integer && !Number.isInteger(result))) throw errors.validation(`${field} is invalid`);
  return result;
};

const uniqueList = (value, max, field, transform = (item) => String(item).trim()) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw errors.validation(`${field} must be an array`);
  const result = [...new Set(value.map(transform).filter(Boolean))];
  if (result.length > max) throw errors.validation(`${field} may contain at most ${max} items`);
  return result;
};

const locationValue = (value, field = "Location") => {
  if (!value) return null;
  const result = {
    country: plainText(value.country, 100, `${field} country`), state: plainText(value.state, 100, `${field} state`),
    city: plainText(value.city, 100, `${field} city`), display: plainText(value.display, 180, `${field} display`),
  };
  if (!Object.values(result).some(Boolean)) throw errors.validation(`${field} must include structured location information`);
  return result;
};

const locationList = (value, max = 10) => uniqueList(value, max, "Locations", (item) => JSON.stringify(locationValue(item)))
  .map((item) => JSON.parse(item));

const verifySkills = async (ids, session = null) => {
  if (ids.some((id) => !UUID.test(id))) throw errors.validation("One or more skill IDs are invalid");
  if (!ids.length) return ids;
  const count = await Skill.countDocuments({ _id: trustedIn(ids), is_active: true }).session(session);
  if (count !== ids.length) throw errors.validation("One or more skills are unknown");
  return ids;
};

const organizationInput = (input, { partial = false } = {}) => {
  const result = {}; const set = (inputKey, key, value) => { if (!partial || input[inputKey] !== undefined) result[key] = value; };
  set("name", "name", plainText(input.name, 160, "Organization name", !partial));
  if (!partial || input.slug !== undefined) {
    const slug = String(input.slug || "").trim().toLowerCase();
    if (!SLUG.test(slug)) throw errors.validation("Organization slug must be lowercase and URL-safe");
    result.slug = slug;
  }
  set("organizationType", "organization_type", enumValue(input.organizationType, domain.organizationTypes, "organization type", !partial));
  set("tagline", "tagline", plainText(input.tagline, 180, "Tagline")); set("description", "description", plainText(input.description, 6000, "Description"));
  set("logoUrl", "logo_url", httpsUrl(input.logoUrl, "Logo URL")); set("websiteUrl", "website_url", httpsUrl(input.websiteUrl, "Website URL"));
  set("industry", "industry", plainText(input.industry, 120, "Industry")); set("companySize", "company_size", plainText(input.companySize, 80, "Company size"));
  if (!partial || input.headquarters !== undefined) result.headquarters = locationValue(input.headquarters, "Headquarters");
  if (!partial || input.locations !== undefined) result.locations = locationList(input.locations);
  return result;
};

const compensationValue = (value) => value ? ({
  min_amount: numberValue(value.minAmount, "Minimum compensation"), max_amount: numberValue(value.maxAmount, "Maximum compensation"),
  currency: plainText(value.currency, 3, "Compensation currency")?.toUpperCase() || null,
  period: enumValue(value.period, domain.compensationPeriods, "compensation period"),
}) : null;

const eligibilityValue = (value = {}) => ({
  eligible_degrees: uniqueList(value.eligibleDegrees, 20, "Eligible degrees", (item) => plainText(item, 120, "Eligible degree")),
  eligible_fields: uniqueList(value.eligibleFields, 20, "Eligible fields", (item) => plainText(item, 120, "Eligible field")),
  graduation_year_min: numberValue(value.graduationYearMin, "Minimum graduation year", { min: 1950, max: 2200, integer: true }),
  graduation_year_max: numberValue(value.graduationYearMax, "Maximum graduation year", { min: 1950, max: 2200, integer: true }),
  experience_min_months: numberValue(value.experienceMinMonths, "Minimum experience", { max: 600, integer: true }),
  experience_max_months: numberValue(value.experienceMaxMonths, "Maximum experience", { max: 600, integer: true }),
  minimum_cgpa: numberValue(value.minimumCgpa, "Minimum CGPA", { max: 10 }),
  allowed_countries: uniqueList(value.allowedCountries, 30, "Allowed countries", (item) => plainText(item, 100, "Allowed country")),
  work_authorization_notes: plainText(value.workAuthorizationNotes, 1000, "Work authorization notes"),
  final_year_allowed: Boolean(value.finalYearAllowed), freshers_allowed: Boolean(value.freshersAllowed),
  custom_notes: plainText(value.customNotes, 2000, "Eligibility notes"),
});

const opportunityInput = async (input, { partial = false, session = null } = {}) => {
  const result = {}; const set = (inputKey, key, value) => { if (!partial || input[inputKey] !== undefined) result[key] = value; };
  set("organizationId", "organization_id", plainText(input.organizationId, 80, "Organization ID", !partial));
  set("type", "type", enumValue(input.type, domain.opportunityTypes, "opportunity type", !partial));
  set("title", "title", plainText(input.title, 180, "Title", !partial));
  if (!partial || input.slug !== undefined) { const slug = String(input.slug || "").trim().toLowerCase(); if (!SLUG.test(slug)) throw errors.validation("Opportunity slug must be lowercase and URL-safe"); result.slug = slug; }
  set("summary", "summary", plainText(input.summary, 320, "Summary")); set("description", "description", plainText(input.description, 8000, "Description"));
  if (!partial || input.responsibilities !== undefined) result.responsibilities = uniqueList(input.responsibilities, 20, "Responsibilities", (item) => plainText(item, 500, "Responsibility"));
  if (!partial || input.requirements !== undefined) result.requirements = uniqueList(input.requirements, 20, "Requirements", (item) => plainText(item, 500, "Requirement"));
  set("workMode", "work_mode", enumValue(input.workMode, domain.workModes, "work mode", !partial));
  if (!partial || input.locations !== undefined) result.locations = locationList(input.locations);
  set("employmentType", "employment_type", enumValue(input.employmentType, domain.employmentTypes, "employment type") || "full_time");
  set("duration", "duration", plainText(input.duration, 120, "Duration"));
  if (!partial || input.compensation !== undefined) result.compensation = compensationValue(input.compensation);
  set("applicationUrl", "application_url", httpsUrl(input.applicationUrl, "Application URL", !partial));
  for (const [inputKey, key, label] of [["applicationDeadline", "application_deadline", "Application deadline"], ["startDate", "start_date", "Start date"], ["sourcePublishedAt", "source_published_at", "Source publication time"], ["expiresAt", "expires_at", "Expiry time"]]) set(inputKey, key, dateValue(input[inputKey], label));
  if (!partial || input.requiredSkillIds !== undefined) result.required_skill_ids = await verifySkills(uniqueList(input.requiredSkillIds, 16, "Required skills"), session);
  if (!partial || input.preferredSkillIds !== undefined) result.preferred_skill_ids = await verifySkills(uniqueList(input.preferredSkillIds, 16, "Preferred skills"), session);
  if (!partial || input.eligibility !== undefined) result.eligibility = eligibilityValue(input.eligibility);
  set("sourceType", "source_type", enumValue(input.sourceType, domain.opportunitySourceTypes, "source type", !partial));
  set("sourceUrl", "source_url", httpsUrl(input.sourceUrl, "Source URL"));
  return result;
};

const isOpen = (row, now = new Date()) => row.status === "published" && (!row.application_deadline || new Date(row.application_deadline) > now) && (!row.expires_at || new Date(row.expires_at) > now);
const openFilter = (now = new Date()) => ({ status: "published", $and: mongoose.trusted([{ $or: [{ application_deadline: null }, { application_deadline: mongoose.trusted({ $gt: now }) }] }, { $or: [{ expires_at: null }, { expires_at: mongoose.trusted({ $gt: now }) }] }]) });

const loadDecoration = async (opportunities, actorId = null, { detail = false } = {}) => {
  const ids = opportunities.map((row) => row.id); const orgIds = [...new Set(opportunities.map((row) => row.organization_id))];
  const skillIds = [...new Set(opportunities.flatMap((row) => [...(row.required_skill_ids || []), ...(row.preferred_skill_ids || [])]))];
  const [organizations, skills, states, candidate] = await Promise.all([
    Organization.find({ _id: trustedIn(orgIds) }).lean(), Skill.find({ _id: trustedIn(skillIds), is_active: true }).select("_id slug name category").lean(),
    actorId ? OpportunityCandidateState.find({ user_id: actorId, opportunity_id: trustedIn(ids) }).lean() : [], actorId ? loadCandidateContext(actorId) : null,
  ]);
  const orgMap = new Map(toApps(organizations).map((row) => [row.id, row])); const stateMap = new Map(toApps(states).map((row) => [row.opportunity_id, row]));
  const skillMap = new Map(toApps(skills).map((row) => [row.id, { id: row.id, slug: row.slug, name: row.name, category: row.category }]));
  return opportunities.map((row) => {
    const context = { detail, includeCandidate: Boolean(actorId), organization: orgMap.get(row.organization_id), requiredSkills: (row.required_skill_ids || []).map((id) => skillMap.get(id)).filter(Boolean), preferredSkills: (row.preferred_skill_ids || []).map((id) => skillMap.get(id)).filter(Boolean), state: stateMap.get(row.id) || null, isOpen: isOpen(row) };
    context.eligibility = candidate ? evaluateOpportunity(row, candidate, skillMap) : null;
    return opportunityCandidateDto(row, context);
  });
};

const listOrganizations = async (query = {}) => {
  const options = parseListQuery(query, { allowedSorts: ["name", "created_at"], defaultSort: "name", defaultLimit: 20, maxLimit: 50 }); const filter = { status: "active" };
  if (options.search) { const pattern = new RegExp(escapeRegex(options.search), "i"); filter.$or = mongoose.trusted([{ name: pattern }, { tagline: pattern }, { industry: pattern }]); }
  const [rows, total] = await Promise.all([Organization.find(filter).sort({ [options.sortBy]: options.sortOrder === "desc" ? -1 : 1, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(), Organization.countDocuments(filter)]);
  const items = toApps(rows); const counts = await Opportunity.aggregate([{ $match: { organization_id: trustedIn(items.map((row) => row.id)), ...openFilter() } }, { $group: { _id: "$organization_id", count: { $sum: 1 } } }]);
  const countMap = new Map(counts.map((row) => [row._id, row.count])); return { items: items.map((row) => organizationPublicDto(row, { activeOpportunityCount: countMap.get(row.id) || 0 })), meta: paginationMeta({ ...options, total }) };
};

const getOrganization = async (slug) => {
  const row = toApp(await Organization.findOne({ slug: String(slug).toLowerCase(), status: "active" }).lean()); if (!row) throw errors.notFound("Organization not found");
  const opportunities = toApps(await Opportunity.find({ organization_id: row.id, ...openFilter() }).sort({ published_at: -1, _id: 1 }).limit(50).lean());
  return { ...organizationPublicDto(row, { activeOpportunityCount: opportunities.length }), opportunities: await loadDecoration(opportunities) };
};

const createOrganization = async (actorId, input) => {
  const payload = { _id: randomUUID(), ...organizationInput(input), created_by: actorId };
  try { const [created] = await Organization.create([payload]); return { ...organizationPublicDto(toApp(created)), revision: created.revision }; }
  catch (error) { if (isDuplicateKey(error)) throw errors.conflict("Organization slug is already in use"); throw error; }
};

const updateOrganization = async (id, actorId, input) => {
  const revision = numberValue(input.revision, "Revision", { integer: true }); if (revision == null) throw errors.validation("Revision is required"); const updates = organizationInput(input, { partial: true });
  if (!Object.keys(updates).length) throw errors.validation("No editable Organization fields supplied");
  try {
    const row = toApp(await Organization.findOneAndUpdate({ _id: id, revision, status: mongoose.trusted({ $ne: "archived" }) }, { $set: updates, $inc: { revision: 1 } }, { returnDocument: "after", runValidators: true }).lean());
    if (!row) throw errors.conflict("Organization changed; refresh before editing"); return { ...organizationPublicDto(row), revision: row.revision };
  } catch (error) { if (isDuplicateKey(error)) throw errors.conflict("Organization slug is already in use"); throw error; }
};

const verifyOrganization = async (id, actorId, input) => {
  const revision = numberValue(input.revision, "Revision", { integer: true }); if (revision == null) throw errors.validation("Revision is required"); const verified = input.verified !== false;
  const row = toApp(await Organization.findOneAndUpdate({ _id: id, revision, status: "active" }, { $set: { verification_status: verified ? "verified" : "unverified", verified_at: verified ? new Date() : null, verified_by: verified ? actorId : null }, $inc: { revision: 1 } }, { returnDocument: "after" }).lean());
  if (!row) throw errors.conflict("Organization changed; refresh before verifying"); return { ...organizationPublicDto(row), revision: row.revision };
};

const createOpportunity = async (actorId, input) => {
  const payload = { _id: randomUUID(), ...(await opportunityInput(input)), created_by: actorId, status: "draft" };
  const org = await Organization.exists({ _id: payload.organization_id, status: "active" }); if (!org) throw errors.validation("Organization is not active");
  try { const [created] = await Opportunity.create([payload]); const row = toApp(created); const [result] = await loadDecoration([row], actorId, { detail: true }); return { ...result, revision: row.revision }; }
  catch (error) { if (isDuplicateKey(error)) throw errors.conflict("Opportunity slug is already in use"); throw error; }
};

const updateOpportunity = async (id, actorId, input) => {
  const revision = numberValue(input.revision, "Revision", { integer: true }); if (revision == null) throw errors.validation("Revision is required"); const current = toApp(await Opportunity.findById(id).lean());
  if (!current || current.status === "archived") throw errors.notFound("Opportunity not found"); const updates = await opportunityInput(input, { partial: true }); if (!Object.keys(updates).length) throw errors.validation("No editable Opportunity fields supplied");
  const candidate = new Opportunity({ ...current, _id: current.id, ...updates }); await candidate.validate();
  if (updates.organization_id && !(await Organization.exists({ _id: updates.organization_id, status: "active" }))) throw errors.validation("Organization is not active");
  try { const row = toApp(await Opportunity.findOneAndUpdate({ _id: id, revision, status: mongoose.trusted({ $ne: "archived" }) }, { $set: updates, $inc: { revision: 1 } }, { returnDocument: "after", runValidators: true }).lean()); if (!row) throw errors.conflict("Opportunity changed; refresh before editing"); const [result] = await loadDecoration([row], actorId, { detail: true }); return { ...result, revision: row.revision }; }
  catch (error) { if (isDuplicateKey(error)) throw errors.conflict("Opportunity slug is already in use"); throw error; }
};

const transitionOpportunity = async (id, actorId, input, status) => withTransaction(async (session) => {
  const revision = numberValue(input.revision, "Revision", { integer: true }); if (revision == null) throw errors.validation("Revision is required"); const now = new Date();
  const current = toApp(await Opportunity.findById(id).session(session).lean()); if (!current) throw errors.notFound("Opportunity not found");
  const allowed = { published: ["draft"], closed: ["published"], archived: ["draft", "published", "closed"] }[status]; if (!allowed.includes(current.status)) throw errors.invalidTransition(`Cannot change an Opportunity from ${current.status} to ${status}`);
  if (status === "published") { const org = await Organization.exists({ _id: current.organization_id, status: "active" }).session(session); if (!org) throw errors.conflict("The Organization is not active"); if (!isOpen({ ...current, status: "published" }, now)) throw errors.conflict("The Opportunity deadline or expiry has passed"); }
  const set = { status, ...(status === "published" ? { published_at: current.published_at || now, last_verified_at: now } : {}) };
  const row = toApp(await Opportunity.findOneAndUpdate({ _id: id, revision, status: current.status }, { $set: set, $inc: { revision: 1 } }, { session, returnDocument: "after", runValidators: true }).lean()); if (!row) throw errors.conflict("Opportunity changed; refresh before continuing");
  const [result] = await loadDecoration([row], actorId, { detail: true }); return { ...result, revision: row.revision };
});

const listOpportunities = async (query = {}, actorId = null) => {
  const options = parseListQuery(query, { allowedSorts: ["published_at", "application_deadline", "last_verified_at"], defaultSort: "published_at", defaultLimit: 18, maxLimit: 24 }); const filter = openFilter();
  if (query.type) filter.type = enumValue(query.type, domain.opportunityTypes, "opportunity type", true); if (query.workMode) filter.work_mode = enumValue(query.workMode, domain.workModes, "work mode", true);
  if (query.organization) { if (!UUID.test(query.organization)) throw errors.validation("Organization must be a UUID"); filter.organization_id = query.organization; }
  const skills = uniqueList(String(query.skills || "").split(","), 12, "Skills"); if (skills.length) { if (skills.some((id) => !UUID.test(id))) throw errors.validation("Skills must be UUIDs"); filter.required_skill_ids = mongoose.trusted({ $all: skills }); }
  if (query.location) { const pattern = new RegExp(escapeRegex(plainText(query.location, 100, "Location", true)), "i"); filter.$or = mongoose.trusted([{ "locations.country": pattern }, { "locations.state": pattern }, { "locations.city": pattern }, { "locations.display": pattern }]); }
  if (query.graduationYear) { const year = numberValue(query.graduationYear, "Graduation year", { min: 1950, max: 2200, integer: true }); filter.$and.push(mongoose.trusted({ $or: [{ "eligibility.graduation_year_min": null }, { "eligibility.graduation_year_min": mongoose.trusted({ $lte: year }) }] }), mongoose.trusted({ $or: [{ "eligibility.graduation_year_max": null }, { "eligibility.graduation_year_max": mongoose.trusted({ $gte: year }) }] })); }
  if (query.freshersAllowed === "true") filter["eligibility.freshers_allowed"] = true; if (query.compensationDisclosed === "true") filter["compensation.currency"] = mongoose.trusted({ $ne: null });
  if (options.search) { const pattern = new RegExp(escapeRegex(options.search), "i"); const [orgs, matchingSkills] = await Promise.all([Organization.find({ status: "active", name: pattern }).select("_id").limit(50).lean(), Skill.find({ is_active: true, name: pattern }).select("_id").limit(50).lean()]); const search = [{ title: pattern }, { summary: pattern }, { description: pattern }, { organization_id: trustedIn(orgs.map((row) => row._id)) }, { required_skill_ids: trustedIn(matchingSkills.map((row) => row._id)) }, { preferred_skill_ids: trustedIn(matchingSkills.map((row) => row._id)) }]; filter.$and.push(mongoose.trusted({ $or: search })); }
  const direction = options.sortBy === "application_deadline" ? 1 : -1; const [rows, total] = await Promise.all([Opportunity.find(filter).sort({ [options.sortBy]: direction, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(), Opportunity.countDocuments(filter)]);
  return { items: await loadDecoration(toApps(rows), actorId), meta: paginationMeta({ ...options, total }) };
};

const getOpportunity = async (slug, actorId = null, actorRole = null) => {
  const row = toApp(await Opportunity.findOne({ slug: String(slug).toLowerCase() }).lean()); if (!row || row.status === "archived") throw errors.notFound("Opportunity not found");
  let state = null; if (actorId) state = toApp(await OpportunityCandidateState.findOne({ user_id: actorId, opportunity_id: row.id }).lean());
  if (row.status !== "published" && actorRole !== "admin" && !state?.application_status && !state?.saved) throw errors.notFound("Opportunity not found");
  const [result] = await loadDecoration([row], actorId, { detail: true }); return actorRole === "admin" ? { ...result, revision: row.revision } : result;
};

const assertCandidateWritable = (row, existing, action) => { if (!isOpen(row) && !(action === "application" && existing?.application_status)) throw errors.conflict("This Opportunity is no longer open for new candidate actions"); };
const fenceCandidateCreate = async (row, session) => {
  const result = await Opportunity.updateOne({ _id: row.id, status: "published" }, { $inc: { candidate_write_revision: 1 } }, { session });
  if (!result.modifiedCount) throw errors.conflict("This Opportunity is no longer open for new candidate actions");
};

const saveOpportunity = async (id, actorId) => {
  const saved = await withTransaction(async (session) => { const row = toApp(await Opportunity.findById(id).session(session).lean()); if (!row) throw errors.notFound("Opportunity not found"); const existing = toApp(await OpportunityCandidateState.findOne({ opportunity_id: id, user_id: actorId }).session(session).lean()); assertCandidateWritable(row, existing, "save"); await fenceCandidateCreate(row, session);
    return toApp(await OpportunityCandidateState.findOneAndUpdate({ opportunity_id: id, user_id: actorId }, { $set: { saved: true }, $setOnInsert: { _id: randomUUID(), source: "user_tracked", revision: 0 } }, { session, upsert: true, returnDocument: "after", runValidators: true }).lean()); }); return candidateStateDto(saved);
};

const unsaveOpportunity = async (id, actorId) => withTransaction(async (session) => { const existing = toApp(await OpportunityCandidateState.findOne({ opportunity_id: id, user_id: actorId }).session(session).lean()); if (!existing?.saved) throw errors.notFound("Saved Opportunity not found"); if (existing.application_status) { const row = toApp(await OpportunityCandidateState.findOneAndUpdate({ _id: existing.id, saved: true }, { $set: { saved: false }, $inc: { revision: 1 } }, { session, returnDocument: "after" }).lean()); return candidateStateDto(row); } await OpportunityCandidateState.deleteOne({ _id: existing.id, saved: true }).session(session); return { opportunity_id: id, saved: false }; });

const saveApplication = async (id, actorId, input) => withTransaction(async (session) => {
  const row = toApp(await Opportunity.findById(id).session(session).lean()); if (!row) throw errors.notFound("Opportunity not found"); const existing = toApp(await OpportunityCandidateState.findOne({ opportunity_id: id, user_id: actorId }).session(session).lean()); assertCandidateWritable(row, existing, "application"); if (!existing?.application_status) await fenceCandidateCreate(row, session);
  const status = enumValue(input.status, domain.applicationStatuses, "application status", true); const notes = input.notes === undefined ? undefined : plainText(input.notes, 2000, "Application notes");
  if (!existing) { if (input.revision != null && Number(input.revision) !== 0) throw errors.conflict("Application state changed; refresh before editing"); const now = new Date(); try { const [created] = await OpportunityCandidateState.create([{ _id: randomUUID(), opportunity_id: id, user_id: actorId, saved: false, application_status: status, applied_at: status === "interested" ? null : now, notes: notes ?? null, external_application_url: row.application_url, source: "user_tracked", revision: 0 }], { session }); return candidateStateDto(toApp(created)); } catch (error) { if (isDuplicateKey(error)) throw errors.conflict("Application state changed; refresh before editing"); throw error; } }
  const revision = numberValue(input.revision, "Revision", { integer: true }); if (revision == null) throw errors.conflict("Application already exists; refresh before editing"); const set = { application_status: status, ...(notes !== undefined ? { notes } : {}), external_application_url: existing.external_application_url || row.application_url, ...(!existing.applied_at && status !== "interested" ? { applied_at: new Date() } : {}) };
  const updated = toApp(await OpportunityCandidateState.findOneAndUpdate({ _id: existing.id, user_id: actorId, revision }, { $set: set, $inc: { revision: 1 } }, { session, returnDocument: "after", runValidators: true }).lean()); if (!updated) throw errors.conflict("Application state changed; refresh before editing"); return candidateStateDto(updated);
});

const deleteApplication = async (id, actorId, input = {}) => withTransaction(async (session) => { const existing = toApp(await OpportunityCandidateState.findOne({ opportunity_id: id, user_id: actorId }).session(session).lean()); if (!existing?.application_status) throw errors.notFound("Application tracking record not found"); const revision = numberValue(input.revision, "Revision", { integer: true }); if (revision == null) throw errors.validation("Revision is required"); if (existing.saved) { const row = toApp(await OpportunityCandidateState.findOneAndUpdate({ _id: existing.id, user_id: actorId, revision }, { $set: { application_status: null, applied_at: null, notes: null, external_application_url: null }, $inc: { revision: 1 } }, { session, returnDocument: "after" }).lean()); if (!row) throw errors.conflict("Application state changed; refresh before editing"); return candidateStateDto(row); } const result = await OpportunityCandidateState.deleteOne({ _id: existing.id, user_id: actorId, revision }).session(session); if (!result.deletedCount) throw errors.conflict("Application state changed; refresh before editing"); return { opportunity_id: id, application_status: null }; });

const listCandidateStates = async (actorId, query = {}, savedOnly = false) => { const options = parseListQuery(query, { allowedSorts: ["updated_at"], defaultSort: "updated_at", defaultLimit: 20, maxLimit: 50 }); const filter = { user_id: actorId, ...(savedOnly ? { saved: true } : { application_status: mongoose.trusted({ $ne: null }) }) }; if (!savedOnly && query.status) filter.application_status = enumValue(query.status, domain.applicationStatuses, "application status", true); const [states, total] = await Promise.all([OpportunityCandidateState.find(filter).sort({ updated_at: -1, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(), OpportunityCandidateState.countDocuments(filter)]); const appStates = toApps(states); const opportunities = toApps(await Opportunity.find({ _id: trustedIn(appStates.map((row) => row.opportunity_id)), status: mongoose.trusted({ $ne: "archived" }) }).lean()); const decorated = await loadDecoration(opportunities, actorId); const opportunityMap = new Map(decorated.map((row) => [row.id, row])); return { items: appStates.map((state) => ({ ...candidateStateDto(state), opportunity: opportunityMap.get(state.opportunity_id) || null })).filter((row) => row.opportunity), meta: paginationMeta({ ...options, total }) }; };

module.exports = {
  createOpportunity, createOrganization, deleteApplication, getOpportunity, getOrganization, listApplications: (userId, query) => listCandidateStates(userId, query),
  listOpportunities, listOrganizations, listSaved: (userId, query) => listCandidateStates(userId, query, true), publishOpportunity: (id, actorId, input) => transitionOpportunity(id, actorId, input, "published"),
  closeOpportunity: (id, actorId, input) => transitionOpportunity(id, actorId, input, "closed"), archiveOpportunity: (id, actorId, input) => transitionOpportunity(id, actorId, input, "archived"),
  saveApplication, saveOpportunity, unsaveOpportunity, updateOpportunity, updateOrganization, verifyOrganization,
  _private: { eligibilityValue, httpsUrl, isOpen, locationValue, opportunityInput, organizationInput, plainText },
};
