const query = (result) => ({
  select() { return this; },
  session() { return this; },
  lean: jest.fn().mockResolvedValue(result),
});

const mockModels = {
  Skill: { find: jest.fn() },
  Team: {},
  TeamActivity: {},
  TeamInvitation: {},
  TeamJoinRequest: {},
  TeamMembership: {},
  User: { find: jest.fn() },
  UserProfile: { find: jest.fn() },
  UserSkill: { find: jest.fn() },
};

jest.mock("../src/models", () => mockModels);

const teamData = require("../src/data/teamData");

describe("public profile summaries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockModels.User.find.mockReturnValue(query([]));
    mockModels.UserProfile.find.mockReturnValue(query([{
      _id: "user-inactive",
      username: "former-member",
      visibility: "public",
      avatar_url: "https://example.invalid/avatar.png",
      headline: "Former member",
      preferred_roles: ["developer"],
    }]));
    mockModels.UserSkill.find.mockReturnValue(query([]));
    mockModels.Skill.find.mockReturnValue(query([]));
  });

  test("does not expose identity when the active-user filter removes an account", async () => {
    const summaries = await teamData.profileSummaries(["user-inactive"], { publicOnly: true });
    const summary = summaries.get("user-inactive");

    expect(mockModels.User.find).toHaveBeenCalledWith(expect.objectContaining({ status: "active" }));
    expect(summary).toMatchObject({
      id: null,
      display_name: "TaskNexus member",
      username: null,
      avatar_url: null,
      headline: null,
      primary_skills: [],
      preferred_roles: [],
    });
  });
});
