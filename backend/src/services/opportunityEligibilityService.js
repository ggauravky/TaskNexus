const { UserEducation, UserProfile, UserSkill } = require("../models");
const { toApp, toApps } = require("../models/helpers");

const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const listText = (values = []) => values.filter(Boolean).join(", ");
const check = (key, result, reason, metadata = {}) => ({ key, result, reason, ...metadata });

const loadCandidateContext = async (userId) => {
  if (!userId) return null;
  const [profileRow, educationRows, skillRows] = await Promise.all([
    UserProfile.findById(userId).lean(),
    UserEducation.find({ user_id: userId }).sort({ position: 1, start_year: -1 }).lean(),
    UserSkill.find({ user_id: userId }).select("skill_id proficiency is_primary").lean(),
  ]);
  const profile = toApp(profileRow);
  return {
    profile,
    education: toApps(educationRows),
    skillIds: new Set(toApps(skillRows).map((row) => row.skill_id)),
  };
};

const degreeCheck = (rules, context) => {
  const accepted = rules.eligible_degrees || [];
  if (!accepted.length) return check("degree", "pass", "No specific degree restriction was published.");
  if (!context.education.length) return check("degree", "unknown", "No structured education is available on your profile.");
  const acceptedNormalized = new Set(accepted.map(normalize));
  const matched = context.education.find((item) => acceptedNormalized.has(normalize(item.degree_course)));
  if (matched) return check("degree", "pass", `${matched.degree_course} is in the published accepted-degree list.`);
  return check("degree", "fail", `Your listed degree is not in the explicit accepted list: ${listText(accepted)}.`);
};

const fieldCheck = (rules, context) => {
  const accepted = rules.eligible_fields || [];
  if (!accepted.length) return check("field_of_study", "pass", "No specific field-of-study restriction was published.");
  const fields = context.education.map((item) => item.field_of_study).filter(Boolean);
  if (!fields.length) return check("field_of_study", "unknown", "Your profile does not include a structured field of study.");
  const acceptedNormalized = new Set(accepted.map(normalize));
  const matched = fields.find((value) => acceptedNormalized.has(normalize(value)));
  if (matched) return check("field_of_study", "pass", `${matched} is in the published accepted-field list.`);
  return check("field_of_study", "fail", `Your listed field is not in the explicit accepted list: ${listText(accepted)}.`);
};

const graduationCheck = (rules, context) => {
  const min = rules.graduation_year_min; const max = rules.graduation_year_max;
  if (min == null && max == null) return check("graduation_year", "pass", "No graduation-year restriction was published.");
  const years = context.education.map((item) => item.end_year).filter(Number.isInteger);
  if (!years.length) return check("graduation_year", "unknown", "Your expected or completed graduation year is not available in structured education.");
  const accepted = years.find((year) => (min == null || year >= min) && (max == null || year <= max));
  const range = min != null && max != null ? `${min}–${max}` : min != null ? `${min} or later` : `${max} or earlier`;
  if (accepted) return check("graduation_year", "pass", `${accepted} is within the published ${range} range.`);
  return check("graduation_year", "fail", `Your listed graduation year is outside the published ${range} range.`);
};

const experienceCheck = (rules) => {
  const min = rules.experience_min_months;
  if (rules.freshers_allowed || min == null || min === 0) return check("experience", "pass", rules.freshers_allowed ? "The Opportunity explicitly allows freshers." : "No minimum professional experience was published.");
  return check("experience", "unknown", `The Opportunity asks for ${min} months of professional experience; TaskNexus does not infer this from Projects or GitHub activity.`);
};

const cgpaCheck = (rules) => rules.minimum_cgpa == null
  ? check("minimum_cgpa", "pass", "No minimum CGPA was published.")
  : check("minimum_cgpa", "unknown", `A minimum CGPA of ${rules.minimum_cgpa} is published, but CGPA is not stored in your TaskNexus profile.`);

const locationCheck = (opportunity, rules, context) => {
  const allowed = rules.allowed_countries || [];
  if (opportunity.work_mode === "remote" && !allowed.length) return check("location", "pass", "The Opportunity is remote with no published country restriction.");
  const candidateLocation = normalize(context.profile?.location);
  if (!candidateLocation) return check("location", "unknown", "Your profile does not include a location for comparison.");
  const expected = allowed.length ? allowed : (opportunity.locations || []).flatMap((item) => [item.country, item.state, item.city, item.display]).filter(Boolean);
  if (!expected.length) return check("location", "unknown", "The Opportunity does not provide enough structured location detail for comparison.");
  const matched = expected.find((value) => candidateLocation.includes(normalize(value)) || normalize(value).includes(candidateLocation));
  return matched
    ? check("location", "pass", `${context.profile.location} is compatible with the published location information.`)
    : check("location", "gap", `Your profile location does not clearly match: ${listText(expected)}.`);
};

const skillChecks = (opportunity, context, skillMap) => {
  const build = (skillId, kind) => {
    const skill = skillMap.get(skillId); const label = skill?.name || "A listed skill"; const present = context.skillIds.has(skillId);
    return check(`${kind}_skill:${skillId}`, present ? "pass" : "gap", present ? `${label} is listed on your profile.` : `${label} is not listed on your profile.`, { kind, skill: { id: skillId, name: label } });
  };
  return [
    ...(opportunity.required_skill_ids || []).map((id) => build(id, "required")),
    ...(opportunity.preferred_skill_ids || []).map((id) => build(id, "preferred")),
  ];
};

const evaluateOpportunity = (opportunity, context, skillMap = new Map()) => {
  if (!context) return null;
  const rules = opportunity.eligibility || {};
  const checks = [degreeCheck(rules, context), fieldCheck(rules, context), graduationCheck(rules, context), experienceCheck(rules), cgpaCheck(rules), locationCheck(opportunity, rules, context), ...skillChecks(opportunity, context, skillMap)];
  const formal = checks.filter((item) => !item.key.startsWith("required_skill:") && !item.key.startsWith("preferred_skill:"));
  const result = formal.some((item) => item.result === "fail") ? "not_eligible"
    : formal.some((item) => item.result === "unknown") ? "unknown"
      : checks.some((item) => item.result === "gap") ? "possibly_eligible" : "eligible";
  return {
    result,
    checks,
    required_skills: checks.filter((item) => item.kind === "required"),
    preferred_skills: checks.filter((item) => item.kind === "preferred"),
    disclaimer: "Eligibility is based on structured Opportunity and TaskNexus profile data. Final eligibility is determined by the employer.",
  };
};

module.exports = { evaluateOpportunity, loadCandidateContext, _private: { degreeCheck, graduationCheck, locationCheck, normalize } };
