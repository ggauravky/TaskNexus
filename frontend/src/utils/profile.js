export const PROFILE_INPUT_FIELDS = [
  "username", "headline", "bio", "avatarUrl", "location", "timezone",
  "availability", "collaborationCommitment", "githubUrl", "linkedinUrl",
  "portfolioUrl", "interests", "preferredRoles", "visibility",
  "onboardingCompleted",
];

export const toEditableProfile = (bundle) => ({
  ...Object.fromEntries(
    PROFILE_INPUT_FIELDS
      .filter((field) => bundle.profile[field] !== undefined)
      .map((field) => [field, bundle.profile[field]]),
  ),
  firstName: bundle.account.firstName,
  lastName: bundle.account.lastName,
});
