jest.mock("../src/data/profileData", () => ({
  findProfileByUserId: jest.fn(),
  listUserSkills: jest.fn(),
}));
jest.mock("../src/services/showcaseService", () => ({
  hasPublicProfileProof: jest.fn(),
}));

const profileData = require("../src/data/profileData");
const showcaseService = require("../src/services/showcaseService");
const onboardingService = require("../src/services/onboardingService");
const { serializeOnboarding } = require("../src/serializers");

const USER_ID = "00000000-0000-4000-8000-000000000401";
const TASK_ID = "00000000-0000-4000-8000-000000000402";

const user = (role, overrides = {}) => ({
  id: USER_ID,
  role,
  profile: { firstName: "Mira", lastName: "Sen" },
  freelancer_profile: { skills: ["Legacy only"], availability: "available" },
  ...overrides,
});

const canonicalProfile = (overrides = {}) => ({
  user_id: USER_ID,
  username: "mira-sen",
  headline: "Product engineer",
  bio: "x".repeat(80),
  location: "Bengaluru",
  timezone: "Asia/Kolkata",
  availability: "unavailable",
  onboarding_completed: true,
  ...overrides,
});

describe("Phase D onboarding service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    profileData.findProfileByUserId.mockResolvedValue(canonicalProfile());
    profileData.listUserSkills.mockResolvedValue([]);
    showcaseService.hasPublicProfileProof.mockResolvedValue(false);
  });

  test("client summary uses authenticated profile and owned task facts without rating state", async () => {
    const result = await onboardingService.getClientOnboarding({
      user: user("client"),
      tasks: [{ id: TASK_ID, status: "completed", workflow: { assignedAt: "a", startedAt: "b", completedAt: "c" } }],
    });

    expect(result).toMatchObject({
      role: "client",
      is_complete: true,
      completed_count: 4,
      total_count: 4,
    });
    expect(profileData.findProfileByUserId).toHaveBeenCalledWith(USER_ID);
    expect(profileData.listUserSkills).not.toHaveBeenCalled();
    expect(showcaseService.hasPublicProfileProof).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("onboarding_completed");
    expect(JSON.stringify(result)).not.toContain("email");
  });

  test("freelancer summary ignores legacy skills and unavailable does not block required completion", async () => {
    profileData.listUserSkills.mockResolvedValue([{ skill_id: "canonical" }]);
    const result = await onboardingService.getFreelancerOnboarding({
      user: user("freelancer"),
      tasks: [{ id: TASK_ID, status: "completed", freelancer_id: USER_ID, workflow: { assignedAt: "a", completedAt: "b" } }],
    });

    expect(result).toMatchObject({ role: "freelancer", is_complete: true, completed_count: 4, total_count: 4 });
    expect(result.items.some((item) => item.id === "professional_availability")).toBe(false);
    expect(result.optional_items).toEqual([]);
    expect(showcaseService.hasPublicProfileProof).not.toHaveBeenCalled();
  });

  test("partial freelancer gets optional proof state without proof affecting required counts", async () => {
    profileData.findProfileByUserId.mockResolvedValue(canonicalProfile({ headline: null }));
    profileData.listUserSkills.mockResolvedValue([{ skill_id: "canonical" }]);
    showcaseService.hasPublicProfileProof.mockResolvedValue(true);

    const result = await onboardingService.getFreelancerOnboarding({
      user: user("freelancer"),
      tasks: [{ id: TASK_ID, status: "completed", freelancer_id: USER_ID, workflow: { assignedAt: "a", completedAt: "b" } }],
    });

    expect(showcaseService.hasPublicProfileProof).toHaveBeenCalledWith(USER_ID);
    expect(result).toMatchObject({ is_complete: false, completed_count: 3, total_count: 4 });
    expect(result.optional_items.find((item) => item.id === "publish_public_safe_proof")).toMatchObject({
      optional: true,
      complete: true,
    });
  });

  test("unsupported roles receive no onboarding summary or profile queries", async () => {
    await expect(onboardingService.getOnboarding({ user: user("admin"), tasks: [] })).resolves.toBeNull();
    expect(profileData.findProfileByUserId).not.toHaveBeenCalled();
  });
});

describe("Phase D onboarding serializer", () => {
  test("serializes explicit snake-case fields and approved internal actions", () => {
    expect(serializeOnboarding({
      role: "client",
      isComplete: false,
      completedCount: 0,
      totalCount: 1,
      items: [{
        id: "identity",
        label: "Identity",
        description: "Complete identity",
        applicable: true,
        complete: false,
        action: { label: "Open", targetPath: "/profile" },
      }],
      optionalItems: [],
      privateFact: "must-not-leak",
    })).toEqual({
      role: "client",
      is_complete: false,
      completed_count: 0,
      total_count: 1,
      items: [{
        id: "identity",
        label: "Identity",
        description: "Complete identity",
        applicable: true,
        complete: false,
        action: { label: "Open", target_path: "/profile" },
      }],
      optional_items: [],
    });
  });

  test.each([
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "/tasks/not-a-uuid?tab=work",
    "/tasks/00000000-0000-4000-8000-000000000402?tab=activity",
  ])("drops unsafe onboarding target %s", (targetPath) => {
    const result = serializeOnboarding({
      role: "freelancer",
      isComplete: false,
      completedCount: 0,
      totalCount: 1,
      items: [{ id: "x", label: "X", description: "X", applicable: true, complete: false, action: { label: "Go", targetPath } }],
      optionalItems: [],
    });
    expect(result.items[0].action).toBeNull();
  });
});
