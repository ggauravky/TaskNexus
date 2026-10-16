process.env.NODE_ENV = "test";

const mockFind = jest.fn();
const mockSort = jest.fn();
const mockLimit = jest.fn();
const mockLean = jest.fn();

jest.mock("../src/models", () => ({
  Submission: { find: mockFind },
  Task: {},
}));

jest.mock("../src/data/mongoDataUtils", () => ({
  buildFilter: (filters) => filters,
  runMongo: (operation) => operation(),
  toApp: (value) => value,
  toApps: (values) => values,
}));

const submissionData = require("../src/data/submissionData");

describe("workspace submission history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLean.mockResolvedValue([{ id: "submission-2" }, { id: "submission-1" }]);
    mockLimit.mockReturnValue({ lean: mockLean });
    mockSort.mockReturnValue({ limit: mockLimit });
    mockFind.mockReturnValue({ sort: mockSort });
  });

  test("loads only the newest 25 submissions for the delivery workspace", async () => {
    const submissions = await submissionData.listRecentSubmissions?.("task-1", 25);

    expect(mockFind).toHaveBeenCalledWith({ task_id: "task-1" });
    expect(mockSort).toHaveBeenCalledWith({ version: -1, created_at: -1, _id: -1 });
    expect(mockLimit).toHaveBeenCalledWith(25);
    expect(submissions).toEqual([{ id: "submission-2" }, { id: "submission-1" }]);
  });
});
