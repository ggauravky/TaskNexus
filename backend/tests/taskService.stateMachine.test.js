jest.mock("../src/data/taskData", () => ({
  findTaskById: jest.fn(),
  updateTaskIfStatus: jest.fn(),
}));

const taskData = require("../src/data/taskData");
const taskService = require("../src/services/taskService");

describe("task state machine", () => {
  beforeEach(() => jest.clearAllMocks());

  test("applies a valid state transition with compare-and-set", async () => {
    taskData.findTaskById.mockResolvedValue({ id: "task-1", status: "assigned", workflow: {} });
    taskData.updateTaskIfStatus.mockResolvedValue({ id: "task-1", status: "in_progress" });

    await expect(taskService.transitionTo("task-1", "in_progress")).resolves.toMatchObject({
      status: "in_progress",
    });
    expect(taskData.updateTaskIfStatus).toHaveBeenCalledWith(
      "task-1",
      "assigned",
      expect.objectContaining({ status: "in_progress" }),
    );
  });

  test("returns a stable 409 error for an invalid transition", async () => {
    taskData.findTaskById.mockResolvedValue({ id: "task-1", status: "completed", workflow: {} });
    await expect(taskService.transitionTo("task-1", "in_progress")).rejects.toMatchObject({
      code: "INVALID_STATE_TRANSITION",
      statusCode: 409,
    });
  });

  test("detects a concurrent state change", async () => {
    taskData.findTaskById.mockResolvedValue({ id: "task-1", status: "assigned", workflow: {} });
    taskData.updateTaskIfStatus.mockResolvedValue(null);
    await expect(taskService.transitionTo("task-1", "in_progress")).rejects.toMatchObject({
      code: "CONFLICT",
      statusCode: 409,
    });
  });
});
