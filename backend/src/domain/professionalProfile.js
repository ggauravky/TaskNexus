const { errors } = require("../utils/appError");

const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{2,29}$/;
const RESERVED_USERNAMES = new Set([
  "admin", "api", "app", "auth", "blog", "dashboard", "help", "login",
  "logout", "me", "profile", "register", "root", "security", "settings",
  "support", "system", "tasknexus", "tasks", "team", "teams", "u", "users",
]);
const PROFILE_VISIBILITIES = new Set(["public", "private"]);
const AVAILABILITIES = new Set(["open", "limited", "unavailable"]);
const COMMITMENTS = new Set(["exploring", "few_hours", "part_time", "full_time"]);
const PROFICIENCIES = new Set(["beginner", "intermediate", "advanced"]);
const INTERESTS = new Set([
  "open_source", "startups", "ai_ml", "web_platform", "mobile", "data",
  "devops", "design_systems", "accessibility", "developer_tools",
  "climate_tech", "education", "data_science", "hackathons", "saas", "cloud",
  "cybersecurity",
]);
const COLLABORATION_ROLES = new Set([
  "builder", "designer", "product_lead", "project_lead", "reviewer",
  "mentor", "researcher", "data_specialist", "frontend_developer",
  "backend_developer", "full_stack_developer", "mobile_developer", "ml_engineer",
  "data_analyst", "ui_ux_designer", "devops_engineer", "qa_engineer", "product",
]);
const PROFILE_FIELDS = new Set([
  "firstName", "lastName", "username", "headline", "bio", "avatarUrl",
  "location", "timezone", "availability", "collaborationCommitment",
  "githubUrl", "linkedinUrl", "portfolioUrl", "interests", "preferredRoles",
  "visibility", "onboardingCompleted",
]);

const fail = (field, message) => {
  throw errors.validation(message, [{ field, message }]);
};

const cleanText = (value, field, max, { required = false } = {}) => {
  if (value === undefined) return undefined;
  if (value === null && !required) return null;
  if (typeof value !== "string") fail(field, `${field} must be a string`);
  const clean = value.trim();
  if (required && !clean) fail(field, `${field} is required`);
  if (!clean && !required) return null;
  if (clean.length > max) fail(field, `${field} must be ${max} characters or fewer`);
  return clean;
};

const normalizeUsername = (value, { required = false } = {}) => {
  const username = cleanText(value, "username", 30, { required });
  if (username === undefined || username === null) return username;
  const normalized = username.toLowerCase();
  if (RESERVED_USERNAMES.has(normalized)) fail("username", "This username is reserved");
  if (!USERNAME_PATTERN.test(normalized)) {
    fail("username", "Username must be 3-30 characters, start with a letter, and use only letters, numbers, underscores, or hyphens");
  }
  return normalized;
};

const safeUrl = (value, field) => {
  const clean = cleanText(value, field, 500);
  if (clean === undefined || clean === null) return clean;
  let parsed;
  try {
    parsed = new URL(clean);
  } catch (_error) {
    fail(field, `${field} must be a valid HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) {
    fail(field, `${field} must be a valid HTTPS URL`);
  }
  return parsed.toString();
};

const normalizeChoiceArray = (value, field, allowed, max) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail(field, `${field} must be an array`);
  const normalized = [...new Set(value.map((item) => String(item).trim().toLowerCase()))];
  if (normalized.length > max) fail(field, `${field} may contain at most ${max} items`);
  const invalid = normalized.find((item) => !allowed.has(item));
  if (invalid) fail(field, `${invalid} is not a supported ${field} value`);
  return normalized;
};

const normalizeTimezone = (value) => {
  const timezone = cleanText(value, "timezone", 80);
  if (timezone === undefined || timezone === null) return timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
  } catch (_error) {
    fail("timezone", "timezone must be a valid IANA timezone");
  }
  return timezone;
};

const choice = (value, field, allowed) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.has(value)) fail(field, `Invalid ${field}`);
  return value;
};

const normalizeProfileInput = (input, { requireUsername = false } = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("profile", "Profile payload must be an object");
  }
  const unknown = Object.keys(input).filter((key) => !PROFILE_FIELDS.has(key));
  if (unknown.length) fail(unknown[0], `Unsupported profile field: ${unknown[0]}`);

  const result = {
    firstName: cleanText(input.firstName, "firstName", 50),
    lastName: cleanText(input.lastName, "lastName", 50),
    username: normalizeUsername(input.username, { required: requireUsername }),
    headline: cleanText(input.headline, "headline", 120),
    bio: cleanText(input.bio, "bio", 2000),
    avatarUrl: safeUrl(input.avatarUrl, "avatarUrl"),
    location: cleanText(input.location, "location", 120),
    timezone: normalizeTimezone(input.timezone),
    availability: choice(input.availability, "availability", AVAILABILITIES),
    collaborationCommitment: choice(input.collaborationCommitment, "collaborationCommitment", COMMITMENTS),
    githubUrl: safeUrl(input.githubUrl, "githubUrl"),
    linkedinUrl: safeUrl(input.linkedinUrl, "linkedinUrl"),
    portfolioUrl: safeUrl(input.portfolioUrl, "portfolioUrl"),
    interests: normalizeChoiceArray(input.interests, "interests", INTERESTS, 12),
    preferredRoles: normalizeChoiceArray(input.preferredRoles, "preferredRoles", COLLABORATION_ROLES, 8),
    visibility: choice(input.visibility, "visibility", PROFILE_VISIBILITIES),
  };
  if (input.onboardingCompleted !== undefined) {
    if (typeof input.onboardingCompleted !== "boolean") fail("onboardingCompleted", "onboardingCompleted must be a boolean");
    result.onboardingCompleted = input.onboardingCompleted;
  }
  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined));
};

const normalizeSkillAssignments = (items) => {
  if (!Array.isArray(items)) fail("skills", "skills must be an array");
  if (items.length > 30) fail("skills", "A profile may contain at most 30 skills");
  const ids = new Set();
  let primaryCount = 0;
  return items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) fail(`skills.${index}`, "Each skill must be an object");
    const unknown = Object.keys(item).filter((key) => !["skillId", "proficiency", "isPrimary"].includes(key));
    if (unknown.length) fail(`skills.${index}.${unknown[0]}`, "Unsupported skill field");
    const skillId = String(item.skillId || "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(skillId)) {
      fail(`skills.${index}.skillId`, "skillId must be a UUID");
    }
    if (ids.has(skillId)) fail("skills", "Duplicate skills are not allowed");
    ids.add(skillId);
    const proficiency = item.proficiency || "intermediate";
    if (!PROFICIENCIES.has(proficiency)) fail(`skills.${index}.proficiency`, "Invalid skill proficiency");
    const isPrimary = Boolean(item.isPrimary);
    if (isPrimary) primaryCount += 1;
    return { skillId, proficiency, isPrimary };
  }).map((item) => {
    if (primaryCount > 5) fail("skills", "A profile may contain at most 5 primary skills");
    return item;
  });
};

const normalizeEducationInput = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("education", "Education payload must be an object");
  const allowed = new Set(["institution", "degreeCourse", "fieldOfStudy", "startYear", "endYear", "currentlyStudying", "description", "position"]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length) fail(unknown[0], `Unsupported education field: ${unknown[0]}`);
  const year = new Date().getUTCFullYear();
  const startYear = Number(input.startYear);
  const currentlyStudying = Boolean(input.currentlyStudying);
  const endYear = input.endYear === null || input.endYear === "" || input.endYear === undefined ? null : Number(input.endYear);
  if (!Number.isInteger(startYear) || startYear < 1900 || startYear > year + 10) fail("startYear", "startYear is invalid");
  if (endYear !== null && (!Number.isInteger(endYear) || endYear < startYear || endYear > year + 10)) fail("endYear", "endYear is invalid");
  if (currentlyStudying && endYear !== null) fail("endYear", "Current education cannot have an end year");
  const position = input.position === undefined ? 0 : Number(input.position);
  if (!Number.isInteger(position) || position < 0 || position > 1000) fail("position", "position is invalid");
  return {
    institution: cleanText(input.institution, "institution", 160, { required: true }),
    degreeCourse: cleanText(input.degreeCourse, "degreeCourse", 160, { required: true }),
    fieldOfStudy: cleanText(input.fieldOfStudy, "fieldOfStudy", 160),
    startYear,
    endYear: currentlyStudying ? null : endYear,
    currentlyStudying,
    description: cleanText(input.description, "description", 1000),
    position,
  };
};

const calculateCompleteness = ({ user, profile, skills = [], education = [] }) => {
  const checks = [
    ["name", Boolean(user?.profile?.firstName && user?.profile?.lastName)],
    ["username", Boolean(profile?.username)],
    ["headline", Boolean(profile?.headline)],
    ["bio", Boolean(profile?.bio && profile.bio.length >= 80)],
    ["location and timezone", Boolean(profile?.location && profile?.timezone)],
    ["availability", Boolean(profile?.availability && profile.availability !== "unavailable")],
    ["professional link", Boolean(profile?.github_url || profile?.linkedin_url || profile?.portfolio_url)],
    ["interests and roles", Boolean(profile?.interests?.length && profile?.preferred_roles?.length)],
    ["skills", skills.length > 0],
    ["education", education.length > 0],
  ];
  const completed = checks.filter(([, value]) => value).length;
  return {
    percentage: completed * 10,
    completed,
    total: checks.length,
    missing: checks.filter(([, value]) => !value).map(([label]) => label),
  };
};

module.exports = {
  INTERESTS: [...INTERESTS],
  COLLABORATION_ROLES: [...COLLABORATION_ROLES],
  RESERVED_USERNAMES,
  normalizeUsername,
  normalizeProfileInput,
  normalizeSkillAssignments,
  normalizeEducationInput,
  calculateCompleteness,
};
