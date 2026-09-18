const mockModels = {
  Project: {},
  ProjectActivity: {},
  ProjectMilestone: {},
  ProjectParticipant: { aggregate: jest.fn() },
  ProjectTask: {},
  Skill: {},
  Team: {},
};

jest.mock("../src/models", () => mockModels);

const projectData = require("../src/data/projectData");

describe("project data pagination", () => {
  beforeEach(() => jest.clearAllMocks());

  test("paginates joined projects without materializing every participation", async () => {
    mockModels.ProjectParticipant.aggregate.mockResolvedValue([{
      items: [{ _id: "project-1", name: "Bounded" }],
      total: [{ value: 12500 }],
    }]);

    const result = await projectData.listMine("user-1", {
      page: 3,
      limit: 20,
      role: "contributor",
      status: "active",
      search: "node.*",
    });

    expect(result).toEqual({
      items: [{ id: "project-1", name: "Bounded" }],
      total: 12500,
      page: 3,
      limit: 20,
    });
    expect(mockModels.ProjectParticipant.aggregate).toHaveBeenCalledTimes(1);
    const pipeline = mockModels.ProjectParticipant.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: { user_id: "user-1", status: "active", role: "contributor" },
    });
    expect(pipeline).toContainEqual(expect.objectContaining({ $lookup: expect.any(Object) }));
    expect(pipeline).toContainEqual({
      $sort: { "project.updated_at": -1, "project._id": 1 },
    });
    expect(pipeline.at(-1).$facet.items).toEqual([
      { $skip: 40 },
      { $limit: 20 },
      { $replaceWith: "$project" },
    ]);
    const searchMatch = pipeline.find((stage) => stage.$match?.$or);
    expect(searchMatch.$match.$or[0]["project.name"].source).toBe("node\\.\\*");
  });

  test("returns an empty page when the aggregation has no row", async () => {
    mockModels.ProjectParticipant.aggregate.mockResolvedValue([]);

    await expect(projectData.listMine("user-1", {
      page: 1, limit: 20, role: null, status: null, search: "",
    })).resolves.toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });
});
