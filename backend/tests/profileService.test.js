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
jest.mock("../src/services/professionalProofService", () => ({
  getPublicProfileProofBundle: jest.fn().mockResolvedValue({ projects: [], connections: [] }),
}));
jest.mock("../src/services/discoveryService", () => ({
  publicContext: jest.fn().mockResolvedValue({ evidence: new Map(), projectCounts: new Map() }),
}));

const profileData = require("../src/data/profileData");
const userData = require("../src/data/userData");
const professionalProofService = require("../src/services/professionalProofService");
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
    professionalProofService.getPublicProfileProofBundle.mockResolvedValue({ projects: [], connections: [] });
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

  test("adds canonical proof connections while preserving the legacy Projects array", async () => {
    const projects = [{
      name: "Accessible work hub",
      slug: "accessible-work-hub",
      team: { name: "Studio", slug: "studio" },
      headline: "Proof",
      summary: "Published summary",
      hero_image_url: null,
      url: "/showcase/studio/accessible-work-hub",
    }];
    const proofConnections = [{
      skill: { id: "skill-react", slug: "react", name: "React" },
      projects: [{
        id: "project-1",
        name: "Accessible work hub",
        completed_at: new Date("2026-10-01T00:00:00.000Z"),
        team: { name: "Studio", slug: "studio" },
        target_path: "/showcase/studio/accessible-work-hub",
        evidence_summary: { total: 1, internal_verified: 0, external_verified: 1, unverified: 0 },
        evidence: [],
      }],
    }];
    profileData.findProfileByUsername.mockResolvedValue(profile);
    userData.findUserById.mockResolvedValue(user);
    professionalProofService.getPublicProfileProofBundle.mockResolvedValue({ projects, connections: proofConnections });

    const result = await profileService.getPublicProfile("aria-nair");

    expect(result.projects).toEqual(projects);
    expect(result.proof_connections).toEqual(proofConnections);
    expect(result.proof_connections[0].skill).toEqual({ id: "skill-react", slug: "react", name: "React" });
    expect(JSON.stringify(result.proof_connections)).not.toMatch(/metadata|source_key|attachment|task_id|score|rank/i);
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

  test("skill replacement delegates the transactional canonical and legacy sync", async () => {
    const skillId = "00000000-0000-4000-8000-000000000050";
    profileData.listUserSkills.mockResolvedValue([{ skill_id: skillId, proficiency: "advanced", is_primary: true, skill: { id: skillId, name: "React", slug: "react", category: "frontend" } }]);
    userData.updateUser.mockResolvedValue(user);
    const result = await profileService.replaceSkills(user, [{ skillId, proficiency: "advanced", isPrimary: true }]);
    expect(profileData.replaceUserSkills).toHaveBeenCalledWith(user.id, expect.any(Array));
    expect(userData.updateUser).not.toHaveBeenCalled();
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
