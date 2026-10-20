const mongoose = require("mongoose");
const { randomUUID } = require("crypto");
const {
  ApplicationActivity, NativeApplication, Notification, Opportunity, Organization,
  OrganizationMembership, Skill, User, UserEducation, UserProfile, UserSkill,
} = require("../models");
const { raw: domain } = require("../contracts/domain");
const { toApp, toApps } = require("../models/helpers");
const { errors } = require("../utils/appError");
const { paginationMeta } = require("../utils/apiResponse");
const { parseListQuery } = require("../utils/queryOptions");
const { isDuplicateKey, withTransaction } = require("../utils/transactions");
const authz = require("./organizationAuthorization");
const professionalProofService = require("./professionalProofService");
const { applicantDetailDto, applicantSummaryDto, candidateApplicationDto } = require("../serializers/organizationSerializers");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const trustedIn = (values) => mongoose.trusted({ $in: values });
const WITHDRAWABLE_STAGES = new Set(["submitted", "reviewing", "shortlisted", "assessment", "interview"]);

const plainText = (value, max, label) => {
  const result = String(value || "").trim();
  if (result.length > max || /[<>]/.test(result)) throw errors.validation(`${label} must be plain text and at most ${max} characters`);
  return result || null;
};
const idList = (value, max, label) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw errors.validation(`${label} must be an array`);
  const items = [...new Set(value.map(String))];
  if (items.length > max || items.some((id) => !UUID.test(id))) throw errors.validation(`${label} contains invalid or excessive IDs`);
  return items;
};
const revisionValue = (value) => {
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 0) throw errors.validation("Revision is required");
  return revision;
};
const isOpen = (opportunity, now = new Date()) => opportunity.status === "published"
  && (!opportunity.application_deadline || new Date(opportunity.application_deadline) > now)
  && (!opportunity.expires_at || new Date(opportunity.expires_at) > now);

const createActivity = (session, data) => ApplicationActivity.create([{
  _id: randomUUID(), created_at: new Date(), metadata: {}, ...data,
}], { session });
const createNotification = (session, data) => Notification.create([{
  _id: randomUUID(), entity_type: "native_application", status: "unread", priority: "medium", ...data,
}], { session });

const loadEligibleProjectData = (candidateId, projectIds, evidenceIds, session = null) => professionalProofService.loadSelectedApplicationProof(
  candidateId, projectIds, evidenceIds, session,
);

const buildSnapshot = async (candidateId, projectIds, evidenceIds, session = null) => {
  const [user, profile, education, assignments, selected] = await Promise.all([
    User.findOne({ _id: candidateId, status: "active" }).session(session).select("_id profile").lean(),
    UserProfile.findById(candidateId).session(session).select("username headline avatar_url").lean(),
    UserEducation.find({ user_id: candidateId }).session(session).select("institution degree_course field_of_study end_year currently_studying position").sort({ position: 1, start_year: -1 }).limit(5).lean(),
    UserSkill.find({ user_id: candidateId }).session(session).select("skill_id proficiency is_primary").sort({ is_primary: -1, created_at: 1 }).limit(20).lean(),
    loadEligibleProjectData(candidateId, projectIds, evidenceIds, session),
  ]);
  if (!user) throw errors.notFound("Candidate account not found");
  const skills = await Skill.find({ _id: trustedIn(assignments.map((row) => row.skill_id)), is_active: true }).session(session).select("_id name slug").lean();
  const skillMap = new Map(skills.map((row) => [String(row._id), row]));
  const legacy = user.profile || {};
  const displayName = [legacy.firstName || legacy.first_name, legacy.lastName || legacy.last_name].filter(Boolean).join(" ") || profile?.username || "TaskNexus candidate";
  return {
    display_name: displayName.slice(0, 160), username: profile?.username || null,
    headline: profile?.headline || null, avatar_url: profile?.avatar_url || null,
    education: education.map((row) => ({ institution: row.institution, degree_course: row.degree_course, field_of_study: row.field_of_study || null, end_year: row.end_year || null, currently_studying: Boolean(row.currently_studying) })),
    skills: assignments.map((row) => { const skill = skillMap.get(row.skill_id); return skill ? { id: String(skill._id), name: skill.name, slug: skill.slug, proficiency: row.proficiency || null } : null; }).filter(Boolean),
    projects: selected.projects, evidence: selected.evidence,
  };
};

const listEligibleProjects = (candidateId) => professionalProofService.listApplicationEligibleProof(candidateId);

const submit = async (opportunityId, candidateId, input = {}) => {
  const projectIds = idList(input.selectedProjectIds, 5, "Selected Projects");
  const evidenceIds = idList(input.selectedEvidenceIds, 12, "Selected evidence");
  const coverNote = plainText(input.coverNote, 2000, "Cover note");
  if (input.consent !== true) throw errors.validation("Consent to share the displayed application snapshot is required");
  try {
    const applicationId = await withTransaction(async (session) => {
      const opportunity = await Opportunity.findById(opportunityId).session(session).lean();
      if (!opportunity || !isOpen(opportunity)) throw errors.conflict("This Opportunity is not open for applications");
      if (opportunity.source_type !== "organization_owned" || opportunity.application_mode !== "tasknexus") throw errors.validation("This Opportunity does not accept TaskNexus applications");
      const organization = await Organization.findOne({ _id: opportunity.organization_id, status: "active", management_mode: "organization_managed" }).session(session).select("_id name slug").lean();
      if (!organization) throw errors.conflict("The Organization is not accepting native applications");
      const fence = await Opportunity.updateOne({ _id: opportunityId, status: "published" }, { $inc: { candidate_write_revision: 1 } }, { session });
      if (fence.modifiedCount !== 1) throw errors.conflict("This Opportunity is no longer open");
      const snapshot = await buildSnapshot(candidateId, projectIds, evidenceIds, session);
      const now = new Date();
      const [application] = await NativeApplication.create([{
        _id: randomUUID(), opportunity_id: opportunityId, organization_id: opportunity.organization_id,
        candidate_id: candidateId, stage: "submitted", cover_note: coverNote,
        submitted_profile_snapshot: snapshot, selected_project_ids: projectIds,
        selected_evidence_ids: snapshot.evidence.map((item) => item.id), submitted_at: now, revision: 0,
      }], { session });
      await createActivity(session, { application_id: application._id, organization_id: opportunity.organization_id, actor_id: candidateId, type: "submitted", from_stage: null, to_stage: "submitted" });
      const recruiters = await OrganizationMembership.find({ organization_id: opportunity.organization_id, status: "active" }).session(session).select("user_id").lean();
      if (recruiters.length) await Notification.insertMany(recruiters.map((row) => ({
        _id: randomUUID(), recipient_id: row.user_id, actor_id: candidateId, type: "native_application_received", entity_type: "native_application", entity_id: application._id,
        status: "unread", priority: "medium", content: { title: "New TaskNexus application", message: `${snapshot.display_name} applied for ${opportunity.title}.`, actionUrl: `/organizations/${organization.slug}/workspace?tab=applicants` },
      })), { session });
      await createNotification(session, { recipient_id: candidateId, actor_id: null, type: "native_application_submitted", entity_id: application._id, content: { title: "Application submitted", message: `Your application for ${opportunity.title} was submitted.`, actionUrl: "/applications" } });
      return application._id;
    });
    return getCandidateDetail(applicationId, candidateId);
  } catch (error) {
    if (isDuplicateKey(error)) throw errors.conflict("You already applied to this Opportunity");
    throw error;
  }
};

const listMine = async (candidateId, query = {}) => {
  const options = parseListQuery(query, { allowedSorts: ["submitted_at"], defaultSort: "submitted_at", defaultLimit: 20, maxLimit: 50 });
  const filter = { candidate_id: candidateId };
  if (query.stage) {
    if (!domain.nativeApplicationStages.includes(query.stage)) throw errors.validation("Unsupported application stage");
    filter.stage = query.stage;
  }
  const [rows, total] = await Promise.all([
    NativeApplication.find(filter).sort({ submitted_at: -1, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    NativeApplication.countDocuments(filter),
  ]);
  const items = toApps(rows);
  const [opportunities, organizations] = await Promise.all([
    Opportunity.find({ _id: trustedIn(items.map((row) => row.opportunity_id)) }).select("_id title slug type work_mode application_deadline status").lean(),
    Organization.find({ _id: trustedIn(items.map((row) => row.organization_id)) }).select("_id name slug logo_url").lean(),
  ]);
  const oppMap = new Map(opportunities.map((row) => [String(row._id), { id: String(row._id), title: row.title, slug: row.slug, type: row.type, work_mode: row.work_mode, application_deadline: row.application_deadline || null, status: row.status }]));
  const orgMap = new Map(organizations.map((row) => [String(row._id), { id: String(row._id), name: row.name, slug: row.slug, logo_url: row.logo_url || null }]));
  return { items: items.map((row) => candidateApplicationDto(row, { opportunity: oppMap.get(row.opportunity_id), organization: orgMap.get(row.organization_id) })), meta: paginationMeta({ ...options, total }) };
};

const getCandidateDetail = async (applicationId, candidateId) => {
  const application = toApp(await NativeApplication.findOne({ _id: applicationId, candidate_id: candidateId }).lean());
  if (!application) throw errors.notFound("Native application not found");
  const [opportunity, organization, activity] = await Promise.all([
    Opportunity.findById(application.opportunity_id).select("_id title slug type work_mode application_deadline status").lean(),
    Organization.findById(application.organization_id).select("_id name slug logo_url").lean(),
    ApplicationActivity.find({ application_id: application.id }).sort({ created_at: 1 }).lean(),
  ]);
  return candidateApplicationDto(application, { opportunity: opportunity ? { ...toApp(opportunity) } : null, organization: organization ? { ...toApp(organization) } : null, activity: toApps(activity), includeSnapshot: true });
};

const listForOrganization = async (organizationId, actorId, query = {}, opportunityId = null) => {
  await authz.requireMember(organizationId, actorId);
  const options = parseListQuery(query, { allowedSorts: ["submitted_at"], defaultSort: "submitted_at", defaultLimit: 20, maxLimit: 50 });
  const filter = { organization_id: organizationId, ...(opportunityId ? { opportunity_id: opportunityId } : {}) };
  if (query.stage) {
    if (!domain.nativeApplicationStages.includes(query.stage)) throw errors.validation("Unsupported application stage");
    filter.stage = query.stage;
  }
  const [rows, total] = await Promise.all([
    NativeApplication.find(filter).sort({ submitted_at: -1, _id: 1 }).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
    NativeApplication.countDocuments(filter),
  ]);
  return { items: toApps(rows).map(applicantSummaryDto), meta: paginationMeta({ ...options, total }) };
};

const getForOrganization = async (applicationId, actorId, organizationId = null) => {
  const application = toApp(await NativeApplication.findOne({ _id: applicationId, ...(organizationId ? { organization_id: organizationId } : {}) }).lean());
  if (!application) throw errors.notFound("Native application not found");
  await authz.requireMember(application.organization_id, actorId);
  const [opportunity, activity] = await Promise.all([
    Opportunity.findById(application.opportunity_id).select("_id title slug type status application_mode").lean(),
    ApplicationActivity.find({ application_id: applicationId }).sort({ created_at: 1 }).lean(),
  ]);
  return applicantDetailDto(application, { opportunity: opportunity ? toApp(opportunity) : null, activity: toApps(activity) });
};

const changeStage = async (applicationId, actorId, input) => withTransaction(async (session) => {
  const revision = revisionValue(input.revision);
  const nextStage = String(input.stage || "");
  if (!domain.nativeApplicationStages.includes(nextStage) || nextStage === "withdrawn") throw errors.validation("Unsupported recruiter stage transition");
  const current = toApp(await NativeApplication.findById(applicationId).session(session).lean());
  if (!current) throw errors.notFound("Native application not found");
  await authz.requireMember(current.organization_id, actorId, session);
  if (!(domain.nativeApplicationTransitions[current.stage] || []).includes(nextStage)) throw errors.invalidTransition(`Cannot change an application from ${current.stage} to ${nextStage}`);
  const row = toApp(await NativeApplication.findOneAndUpdate(
    { _id: applicationId, organization_id: current.organization_id, stage: current.stage, revision },
    { $set: { stage: nextStage }, $inc: { revision: 1 } },
    { session, returnDocument: "after", runValidators: true },
  ).lean());
  if (!row) throw errors.conflict("Application changed; refresh before updating its stage");
  await createActivity(session, { application_id: applicationId, organization_id: current.organization_id, actor_id: actorId, type: "stage_changed", from_stage: current.stage, to_stage: nextStage });
  const opportunity = await Opportunity.findById(current.opportunity_id).session(session).select("title").lean();
  await createNotification(session, { recipient_id: current.candidate_id, actor_id: actorId, type: "application_stage_changed", entity_id: applicationId, content: { title: "Application status updated", message: `Your application for ${opportunity?.title || "an Opportunity"} moved to ${nextStage}.`, actionUrl: "/applications" }, metadata: { from_stage: current.stage, to_stage: nextStage } });
  return applicantDetailDto(row);
});

const withdraw = async (applicationId, candidateId, input) => withTransaction(async (session) => {
  const revision = revisionValue(input.revision);
  const current = toApp(await NativeApplication.findOne({ _id: applicationId, candidate_id: candidateId }).session(session).lean());
  if (!current) throw errors.notFound("Native application not found");
  if (!WITHDRAWABLE_STAGES.has(current.stage)) throw errors.invalidTransition(`Cannot withdraw an application from ${current.stage}`);
  const row = toApp(await NativeApplication.findOneAndUpdate(
    { _id: applicationId, candidate_id: candidateId, stage: current.stage, revision },
    { $set: { stage: "withdrawn", withdrawn_at: new Date() }, $inc: { revision: 1 } },
    { session, returnDocument: "after", runValidators: true },
  ).lean());
  if (!row) throw errors.conflict("Application changed; refresh before withdrawing");
  await createActivity(session, { application_id: applicationId, organization_id: current.organization_id, actor_id: candidateId, type: "withdrawn", from_stage: current.stage, to_stage: "withdrawn" });
  const recruiters = await OrganizationMembership.find({ organization_id: current.organization_id, status: "active" }).session(session).select("user_id").lean();
  if (recruiters.length) await Notification.insertMany(recruiters.map((member) => ({
    _id: randomUUID(), recipient_id: member.user_id, actor_id: candidateId, type: "application_withdrawn", entity_type: "native_application", entity_id: applicationId,
    status: "unread", priority: "medium", content: { title: "Application withdrawn", message: `${current.submitted_profile_snapshot.display_name} withdrew an application.`, actionUrl: "/applications" },
  })), { session });
  return candidateApplicationDto(row);
});

module.exports = {
  changeStage, getCandidateDetail, getForOrganization, listEligibleProjects, listForOrganization, listMine, submit, withdraw,
  _private: { buildSnapshot, idList, isOpen, loadEligibleProjectData, WITHDRAWABLE_STAGES },
};
