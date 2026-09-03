const profileData = require("../data/profileData");
const userData = require("../data/userData");
const { errors } = require("../utils/appError");
const {
  INTERESTS,
  COLLABORATION_ROLES,
  normalizeUsername,
  normalizeProfileInput,
  normalizeSkillAssignments,
  normalizeEducationInput,
  calculateCompleteness,
} = require("../domain/professionalProfile");

const AVAILABILITY_TO_LEGACY = {
  open: "available",
  limited: "part_time",
  unavailable: "busy",
};

const skillDto = (row) => ({
  id: row.skill?.id || row.skill_id,
  slug: row.skill?.slug || null,
  name: row.skill?.name || null,
  category: row.skill?.category || null,
  proficiency: row.proficiency,
  isPrimary: Boolean(row.is_primary),
});

const educationDto = (row) => ({
  id: row.id,
  institution: row.institution,
  degreeCourse: row.degree_course,
  fieldOfStudy: row.field_of_study || null,
  startYear: row.start_year,
  endYear: row.end_year || null,
  currentlyStudying: Boolean(row.currently_studying),
  description: row.description || null,
  position: row.position || 0,
});

const profileDto = (row) => ({
  username: row?.username || null,
  headline: row?.headline || null,
  bio: row?.bio || null,
  avatarUrl: row?.avatar_url || null,
  location: row?.location || null,
  timezone: row?.timezone || null,
  availability: row?.availability || "unavailable",
  collaborationCommitment: row?.collaboration_commitment || "exploring",
  githubUrl: row?.github_url || null,
  linkedinUrl: row?.linkedin_url || null,
  portfolioUrl: row?.portfolio_url || null,
  interests: row?.interests || [],
  preferredRoles: row?.preferred_roles || [],
  visibility: row?.visibility || "private",
  onboardingCompleted: Boolean(row?.onboarding_completed),
  updatedAt: row?.updated_at || null,
});

const publicSerializer = ({ user, profile, skills, education }) => ({
  username: profile.username,
  name: {
    first: user.profile?.firstName || "",
    last: user.profile?.lastName || "",
    display: `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim(),
  },
  headline: profile.headline,
  bio: profile.bio,
  avatarUrl: profile.avatar_url,
  location: profile.location,
  timezone: profile.timezone,
  availability: profile.availability,
  collaborationCommitment: profile.collaboration_commitment,
  links: {
    github: profile.github_url,
    linkedin: profile.linkedin_url,
    portfolio: profile.portfolio_url,
  },
  interests: profile.interests || [],
  preferredRoles: profile.preferred_roles || [],
  skills: (skills || []).map(skillDto),
  education: (education || []).map(educationDto),
});

const getBundle = async (userId, providedUser = null) => {
  const [user, profile, skills, education] = await Promise.all([
    providedUser ? Promise.resolve(providedUser) : userData.findUserById(userId),
    profileData.findProfileByUserId(userId),
    profileData.listUserSkills(userId),
    profileData.listEducation(userId),
  ]);
  if (!user) throw errors.notFound("User not found");
  const ensuredProfile = profile || await profileData.upsertProfile(userId, {});
  return { user, profile: ensuredProfile, skills: skills || [], education: education || [] };
};

const serializeOwn = (bundle) => ({
  account: {
    id: bundle.user.id,
    email: bundle.user.email,
    role: bundle.user.role,
    firstName: bundle.user.profile?.firstName || "",
    lastName: bundle.user.profile?.lastName || "",
    phone: bundle.user.profile?.phone || "",
  },
  profile: profileDto(bundle.profile),
  skills: bundle.skills.map(skillDto),
  education: bundle.education.map(educationDto),
  completeness: calculateCompleteness(bundle),
  options: { interests: INTERESTS, preferredRoles: COLLABORATION_ROLES },
});

const mapProfileColumns = (values) => {
  const mapping = {
    username: "username", headline: "headline", bio: "bio", avatarUrl: "avatar_url",
    location: "location", timezone: "timezone", availability: "availability",
    collaborationCommitment: "collaboration_commitment", githubUrl: "github_url",
    linkedinUrl: "linkedin_url", portfolioUrl: "portfolio_url", interests: "interests",
    preferredRoles: "preferred_roles", visibility: "visibility",
    onboardingCompleted: "onboarding_completed",
  };
  return Object.fromEntries(Object.entries(values)
    .filter(([key]) => mapping[key])
    .map(([key, value]) => [mapping[key], value]));
};

const isUniqueViolation = (error) => {
  let current = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current.code === "23505") return true;
    current = current.cause;
  }
  return false;
};

const getOwnProfile = async (user) => serializeOwn(await getBundle(user.id, user));

const updateOwnProfile = async (user, input, { onboarding = false } = {}) => {
  const values = normalizeProfileInput(input, { requireUsername: onboarding });
  if (values.username && await profileData.isUsernameTaken(values.username, user.id)) {
    throw errors.conflict("Username is already in use", [{ field: "username", message: "Choose another username" }]);
  }
  if (values.onboardingCompleted && !values.username) {
    const existing = await profileData.findProfileByUserId(user.id);
    if (!existing?.username) throw errors.validation("A username is required to finish onboarding", [{ field: "username", message: "Choose a username" }]);
  }

  const legacyProfile = { ...(user.profile || {}) };
  if (values.firstName !== undefined) legacyProfile.firstName = values.firstName;
  if (values.lastName !== undefined) legacyProfile.lastName = values.lastName;
  if (values.location !== undefined) legacyProfile.location = values.location;
  if (values.avatarUrl !== undefined) legacyProfile.avatar = values.avatarUrl;

  try {
    await profileData.upsertProfile(user.id, mapProfileColumns(values));
  } catch (error) {
    if (isUniqueViolation(error)) throw errors.conflict("Username is already in use", [{ field: "username", message: "Choose another username" }]);
    throw error;
  }

  const userUpdates = { profile: legacyProfile };
  if (user.role === "freelancer") {
    const legacyFreelancer = { ...(user.freelancer_profile || {}) };
    if (values.headline !== undefined) legacyFreelancer.title = values.headline;
    if (values.bio !== undefined) legacyFreelancer.bio = values.bio;
    if (values.availability !== undefined) legacyFreelancer.availability = AVAILABILITY_TO_LEGACY[values.availability];
    if (values.portfolioUrl !== undefined) legacyFreelancer.portfolio = values.portfolioUrl;
    if (values.linkedinUrl !== undefined) legacyFreelancer.linkedin = values.linkedinUrl;
    if (values.githubUrl !== undefined) legacyFreelancer.github = values.githubUrl;
    userUpdates.freelancer_profile = legacyFreelancer;
  }
  const updatedUser = await userData.updateUser(user.id, userUpdates);
  return serializeOwn(await getBundle(user.id, updatedUser || { ...user, ...userUpdates }));
};

const getPublicProfile = async (usernameValue) => {
  const username = normalizeUsername(usernameValue, { required: true });
  const profile = await profileData.findProfileByUsername(username);
  if (!profile || profile.visibility !== "public") throw errors.notFound("Profile not found");
  const [user, skills, education] = await Promise.all([
    userData.findUserById(profile.user_id),
    profileData.listUserSkills(profile.user_id),
    profileData.listEducation(profile.user_id),
  ]);
  if (!user || user.status !== "active") throw errors.notFound("Profile not found");
  return publicSerializer({ user, profile, skills, education });
};

const checkUsername = async (value, userId) => {
  const username = normalizeUsername(value, { required: true });
  return { username, available: !(await profileData.isUsernameTaken(username, userId)) };
};

const createEducation = async (userId, input) => {
  const values = normalizeEducationInput(input);
  return educationDto(await profileData.createEducation(userId, {
    institution: values.institution,
    degree_course: values.degreeCourse,
    field_of_study: values.fieldOfStudy,
    start_year: values.startYear,
    end_year: values.endYear,
    currently_studying: values.currentlyStudying,
    description: values.description,
    position: values.position,
  }));
};

const updateEducation = async (userId, educationId, input) => {
  const values = normalizeEducationInput(input);
  const updated = await profileData.updateEducation(userId, educationId, {
    institution: values.institution,
    degree_course: values.degreeCourse,
    field_of_study: values.fieldOfStudy,
    start_year: values.startYear,
    end_year: values.endYear,
    currently_studying: values.currentlyStudying,
    description: values.description,
    position: values.position,
  });
  if (!updated) throw errors.notFound("Education entry not found");
  return educationDto(updated);
};

const deleteEducation = async (userId, educationId) => {
  const deleted = await profileData.deleteEducation(userId, educationId);
  if (!deleted) throw errors.notFound("Education entry not found");
  return { id: deleted.id };
};

const replaceSkills = async (user, input) => {
  const skills = normalizeSkillAssignments(input);
  await profileData.replaceUserSkills(user.id, skills);
  const rows = await profileData.listUserSkills(user.id);
  if (user.role === "freelancer") {
    const legacyFreelancer = { ...(user.freelancer_profile || {}), skills: rows.map((row) => row.skill?.name).filter(Boolean) };
    await userData.updateUser(user.id, { freelancer_profile: legacyFreelancer });
  }
  return rows.map(skillDto);
};

const searchSkills = ({ query, q, category, limit }) => {
  const requestedQuery = query ?? q;
  const cleanQuery = typeof requestedQuery === "string" ? requestedQuery.trim().slice(0, 80) : "";
  const cleanCategory = typeof category === "string" ? category.trim().slice(0, 40) : undefined;
  const boundedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 30);
  return profileData.searchSkills({ query: cleanQuery, category: cleanCategory, limit: boundedLimit });
};

module.exports = {
  profileDto,
  publicSerializer,
  skillDto,
  educationDto,
  getOwnProfile,
  updateOwnProfile,
  getPublicProfile,
  checkUsername,
  createEducation,
  updateEducation,
  deleteEducation,
  replaceSkills,
  searchSkills,
};
