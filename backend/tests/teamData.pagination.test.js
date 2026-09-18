const mockModels = {
  Skill: {},
  Team: {},
  TeamActivity: {},
  TeamInvitation: {},
  TeamJoinRequest: {},
  TeamMembership: { aggregate: jest.fn() },
  User: {},
  UserProfile: {},
  UserSkill: {},
};

jest.mock("../src/models", () => mockModels);

const teamData = require("../src/data/teamData");

describe("team data pagination", () => {
  beforeEach(() => jest.clearAllMocks());

  test("paginates only active joined teams and counts the filtered result", async () => {
    mockModels.TeamMembership.aggregate.mockResolvedValue([{
      items: [{
        _id: "membership-1",
        team_id: "team-1",
        user_id: "user-1",
        role: "member",
        team: { _id: "team-1", name: "Active Team", status: "active" },
      }],
      total: [{ value: 12 }],
    }]);

    await expect(teamData.listTeams({
      userId: "user-1", scope: "mine", page: 2, limit: 5,
    })).resolves.toEqual({
      items: [{
        team: { id: "team-1", name: "Active Team", status: "active" },
        membership: {
          id: "membership-1", team_id: "team-1", user_id: "user-1", role: "member",
        },
      }],
      total: 12,
      page: 2,
      limit: 5,
    });

    const pipeline = mockModels.TeamMembership.aggregate.mock.calls[0][0];
    expect(pipeline).toContainEqual({ $match: { "team.status": "active" } });
    expect(pipeline).toContainEqual({ $sort: { updated_at: -1, _id: 1 } });
    expect(pipeline.at(-1).$facet.items).toEqual([{ $skip: 5 }, { $limit: 5 }]);
  });

  test("returns an empty page when no active joined team remains", async () => {
    mockModels.TeamMembership.aggregate.mockResolvedValue([]);

    await expect(teamData.listTeams({
      userId: "user-1", scope: "mine", page: 1, limit: 10,
    })).resolves.toEqual({ items: [], total: 0, page: 1, limit: 10 });
  });
});
