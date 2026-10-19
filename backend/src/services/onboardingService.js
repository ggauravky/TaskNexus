const profileData = require("../data/profileData");
const { profileCompletionFacts } = require("../domain/professionalProfile");
const { deriveClientOnboarding, deriveFreelancerOnboarding } = require("../domain/onboarding");
const { serializeOnboarding } = require("../serializers");
const { hasPublicProfileProof } = require("./showcaseService");

const getClientOnboarding = async ({ user, tasks = [] }) => {
  const profile = await profileData.findProfileByUserId(user.id);
  const facts = profileCompletionFacts({ user, profile });
  return serializeOnboarding(deriveClientOnboarding({ profileFacts: facts, tasks }));
};

const getFreelancerOnboarding = async ({ user, tasks = [] }) => {
  const [profile, skills] = await Promise.all([
    profileData.findProfileByUserId(user.id),
    profileData.listUserSkills(user.id),
  ]);
  const profileFacts = profileCompletionFacts({ user, profile, skills: skills || [] });
  let derived = deriveFreelancerOnboarding({
    profileFacts,
    availability: profile?.availability,
    tasks,
    hasPublicProof: false,
  });
  const proofCanBeShown = !derived.isComplete
    && derived.optionalItems.some((item) => item.id === "publish_public_safe_proof");
  if (proofCanBeShown) {
    derived = deriveFreelancerOnboarding({
      profileFacts,
      availability: profile?.availability,
      tasks,
      hasPublicProof: await hasPublicProfileProof(user.id),
    });
  }
  return serializeOnboarding(derived);
};

const getOnboarding = async ({ user, tasks = [] }) => {
  if (user?.role === "client") return getClientOnboarding({ user, tasks });
  if (user?.role === "freelancer") return getFreelancerOnboarding({ user, tasks });
  return null;
};

module.exports = {
  getClientOnboarding,
  getFreelancerOnboarding,
  getOnboarding,
};
