const normalizeLegacySkillName = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
};

const legacyAvailability = (value) => ({ available: "open", part_time: "limited" }[value] || "unavailable");

const httpsOrNull = (value) => {
  const normalized = String(value || "").trim();
  return /^https:\/\/[^\s]+$/i.test(normalized) ? normalized : null;
};

const profileFromLegacyUser = (user) => ({
  _id: user.id,
  headline: String(user.freelancer_profile?.title || "").trim() || null,
  bio: String(user.freelancer_profile?.bio || "").trim() || null,
  avatar_url: httpsOrNull(user.profile?.avatar),
  location: String(user.profile?.location || user.freelancer_profile?.location || "").trim() || null,
  availability: legacyAvailability(user.freelancer_profile?.availability),
  github_url: httpsOrNull(user.freelancer_profile?.github),
  linkedin_url: httpsOrNull(user.freelancer_profile?.linkedin),
  portfolio_url: httpsOrNull(user.freelancer_profile?.portfolio || user.freelancer_profile?.website),
});

module.exports = { httpsOrNull, legacyAvailability, normalizeLegacySkillName, profileFromLegacyUser };
