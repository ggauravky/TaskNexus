process.env.NODE_ENV = "test";

const mockFind = jest.fn();
const mockSort = jest.fn();
const mockLimit = jest.fn();
const mockLean = jest.fn();

jest.mock("../src/models", () => ({
  TaskComment: {},
  TaskActivity: { find: mockFind },
  TaskMilestone: {},
}));

jest.mock("../src/data/mongoDataUtils", () => ({
  runMongo: (operation) => operation(),
  toApp: (value) => value,
}));

const collaborationData = require("../src/data/collaborationData");

describe("task activity data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLean.mockResolvedValue([
      {
        id: "activity-newer",
        task_id: "task-1",
        activity_type: "task_updated",
        message: "Newer event",
        created_at: "2026-10-14T12:00:00.000Z",
      },
      {
        id: "activity-older",
        task_id: "task-1",
        activity_type: "task_created",
        message: "Older event",
        created_at: "2026-10-14T10:00:00.000Z",
      },
    ]);
    mockLimit.mockReturnValue({ lean: mockLean });
    mockSort.mockReturnValue({ limit: mockLimit, lean: mockLean });
    mockFind.mockReturnValue({ sort: mockSort });
  });

  test("bounds persisted activity to the latest 200 entries and presents it chronologically", async () => {
    const activity = await collaborationData.listActivity("task-1");

    expect(mockFind).toHaveBeenCalledWith({ task_id: "task-1" });
    expect(mockSort).toHaveBeenCalledWith({ created_at: -1, _id: -1 });
    expect(mockLimit).toHaveBeenCalledWith(200);
    expect(activity.map((entry) => entry.id)).toEqual(["activity-older", "activity-newer"]);
  });
});
