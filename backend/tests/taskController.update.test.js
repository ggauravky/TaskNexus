const mockTaskData = {
  findTaskById: jest.fn(),
  updateTask: jest.fn(),
};
const mockAuditLogData = { log: jest.fn() };
const mockRealtimeHub = { publish: jest.fn(), publishToRole: jest.fn(), publishToUser: jest.fn() };

jest.mock("../src/data/taskData", () => mockTaskData);
jest.mock("../src/data/submissionData", () => ({}));
jest.mock("../src/data/auditLogData", () => mockAuditLogData);
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock("../src/services/notificationService", () => ({}));
jest.mock("../src/services/taskService", () => ({}));
jest.mock("../src/services/realtimeHub", () => mockRealtimeHub);
jest.mock("../src/services/collaborationService", () => ({}));
jest.mock("../src/services/storage/storageProvider", () => ({}));

const taskController = require("../src/controllers/taskController");

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("task update controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTaskData.findTaskById.mockResolvedValue({
      id: "task-1",
      client_id: "client-1",
      freelancer_id: null,
      status: "submitted",
      task_details: {
        title: "Original title",
        type: "web_development",
        description: "Original description for testing",
        budget: 100,
      },
    });
    mockTaskData.updateTask.mockImplementation(async (_id, updates) => ({
      id: "task-1", status: "submitted", ...updates,
    }));
  });

  test("maps category to the canonical type field and records the real audit diff", async () => {
    const req = {
      params: { id: "task-1" },
      user: { id: "client-1" },
      body: { category: "data_analysis", budget: "250", deadline: "2035-01-01T00:00:00.000Z" },
      ip: "127.0.0.1",
    };
    const res = response();
    const next = jest.fn();

    await taskController.updateTask(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockTaskData.updateTask).toHaveBeenCalledWith("task-1", {
      task_details: expect.objectContaining({
        type: "data_analysis",
        budget: 250,
        deadline: new Date("2035-01-01T00:00:00.000Z"),
      }),
    });
    expect(mockAuditLogData.log).toHaveBeenCalledWith(expect.objectContaining({
      changes: {
        category: "data_analysis",
        budget: 250,
        deadline: new Date("2035-01-01T00:00:00.000Z"),
      },
    }));
  });

  test("rejects a body without editable fields", async () => {
    const req = {
      params: { id: "task-1" }, user: { id: "client-1" }, body: { status: "completed" }, ip: "127.0.0.1",
    };
    const res = response();

    await taskController.updateTask(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockTaskData.updateTask).not.toHaveBeenCalled();
    expect(mockAuditLogData.log).not.toHaveBeenCalled();
  });
});
