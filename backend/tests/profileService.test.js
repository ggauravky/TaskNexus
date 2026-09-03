jest.mock("../src/data/profileData", () => ({
  findProfileByUserId: jest.fn(),
  findProfileByUsername: jest.fn(),
  isUsernameTaken: jest.fn(),
  upsertProfile: jest.fn(),
  listEducation: jest.fn(),
  createEducation: jest.fn(),
  updateEducation: jest.fn(),
  deleteEducation: jest.fn(),
  listUserSkills: jest.fn(),
  replaceUserSkills: jest.fn(),
  searchSkills: jest.fn(),
}));
jest.mock("../src/data/userData", () => ({
  findUserById: jest.fn(),
  updateUser: jest.fn(),
}));

const profileData = require("../src/data/profileData");
const userData = require("../src/data/userData");
const profileService = require("../src/services/profileService");

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "private@example.com",
  phone: "+91 90000 00000",
  role: "freelancer",
  status: "active",
  profile: { firstName: "Aria", lastName: "Nair", phone: "+91 90000 00000" },
  freelancer_profile: { skills: ["React.js"] },
};
const profile = {
  user_id: user.id,
  username: "aria-nair",
  headline: "Frontend systems engineer",
  bio: "Builds durable interfaces.",
  visibility: "public",
  interests: ["accessibility"],
  preferred_roles: ["builder"],
};

describe("Phase 2 profile service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    profileData.listUserSkills.mockResolvedValue([]);
    profileData.listEducation.mockResolvedValue([]);
  });

  test("public serializer never exposes private account or marketplace fields", async () => {
    profileData.findProfileByUsername.mockResolvedValue(profile);
    userData.findUserById.mockResolvedValue({ ...user, password: "hash", refresh_token: "secret", freelancer_profile: { hourlyRate: 90 } });
    const result = await profileService.getPublicProfile("ARIA-NAIR");
    expect(result.name.display).toBe("Aria Nair");
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("phone");
    expect(result).not.toHaveProperty("role");
    expect(result).not.toHaveProperty("status");
    expect(JSON.stringify(result)).not.toContain("hourlyRate");
  });

  test("private profiles return not found without leaking existence", async () => {
    profileData.findProfileByUsername.mockResolvedValue({ ...profile, visibility: "private" });
    await expect(profileService.getPublicProfile("aria-nair")).rejects.toMatchObject({ statusCode: 404 });
    expect(userData.findUserById).not.toHaveBeenCalled();
  });

  test("duplicate usernames are rejected before update", async () => {
    profileData.isUsernameTaken.mockResolvedValue(true);
    await expect(profileService.updateOwnProfile(user, { username: "aria-nair" })).rejects.toMatchObject({ statusCode: 409 });
    expect(profileData.upsertProfile).not.toHaveBeenCalled();
  });

  test("education update and delete enforce ownership through user-scoped data calls", async () => {
    profileData.updateEducation.mockResolvedValue(null);
    profileData.deleteEducation.mockResolvedValue(null);
    const educationId = "00000000-0000-4000-8000-000000000099";
    await expect(profileService.updateEducation(user.id, educationId, {
      institution: "Institute", degreeCourse: "Course", startYear: 2022,
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(profileData.updateEducation).toHaveBeenCalledWith(user.id, educationId, expect.any(Object));
    await expect(profileService.deleteEducation(user.id, educationId)).rejects.toMatchObject({ statusCode: 404 });
    expect(profileData.deleteEducation).toHaveBeenCalledWith(user.id, educationId);
  });

  test("skill replacement uses the authenticated user and syncs canonical names to legacy JSON", async () => {
    const skillId = "00000000-0000-4000-8000-000000000050";
    profileData.listUserSkills.mockResolvedValue([{ skill_id: skillId, proficiency: "advanced", is_primary: true, skill: { id: skillId, name: "React", slug: "react", category: "frontend" } }]);
    userData.updateUser.mockResolvedValue(user);
    const result = await profileService.replaceSkills(user, [{ skillId, proficiency: "advanced", isPrimary: true }]);
    expect(profileData.replaceUserSkills).toHaveBeenCalledWith(user.id, expect.any(Array));
    expect(userData.updateUser).toHaveBeenCalledWith(user.id, expect.objectContaining({ freelancer_profile: expect.objectContaining({ skills: ["React"] }) }));
    expect(result[0]).toMatchObject({ name: "React", isPrimary: true });
  });

  test("onboarding requires a username and persists completion", async () => {
    profileData.isUsernameTaken.mockResolvedValue(false);
    profileData.upsertProfile.mockResolvedValue({ ...profile, onboarding_completed: true });
    profileData.findProfileByUserId.mockResolvedValue({ ...profile, onboarding_completed: true });
    userData.updateUser.mockResolvedValue(user);
    await profileService.updateOwnProfile(user, { username: "aria-nair", onboardingCompleted: true }, { onboarding: true });
    expect(profileData.upsertProfile).toHaveBeenCalledWith(user.id, expect.objectContaining({ username: "aria-nair", onboarding_completed: true }));
  });

  test("skill search is bounded", async () => {
    profileData.searchSkills.mockResolvedValue([]);
    await profileService.searchSkills({ q: "react.js", limit: "999" });
    expect(profileData.searchSkills).toHaveBeenCalledWith(expect.objectContaining({ query: "react.js", limit: 30 }));
  });
});
