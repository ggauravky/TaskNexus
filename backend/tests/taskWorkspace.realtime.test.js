const mockTaskData = { findTaskById: jest.fn() };
const mockSubmissionData = {
  findSubmissionById: jest.fn(),
  updateSubmission: jest.fn(),
};
const mockTaskService = { transitionTo: jest.fn() };
const mockNotificationService = { create: jest.fn() };
const mockRealtimeHub = { publish: jest.fn(), publishToRole: jest.fn(), publishToUser: jest.fn() };

jest.mock("../src/data/taskData", () => mockTaskData);
jest.mock("../src/data/submissionData", () => mockSubmissionData);
jest.mock("../src/data/paymentData", () => ({}));
jest.mock("../src/data/reviewData", () => ({}));
jest.mock("../src/data/userData", () => ({}));
jest.mock("../src/data/auditLogData", () => ({}));
jest.mock("../src/services/taskService", () => mockTaskService);
jest.mock("../src/services/notificationService", () => mockNotificationService);
jest.mock("../src/services/realtimeHub", () => mockRealtimeHub);
jest.mock("../src/services/performanceService", () => ({}));
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const freelancerController = require("../src/controllers/freelancerController");

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("task workspace realtime reconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmissionData.findSubmissionById.mockResolvedValue({
      id: "submission-1",
      task_id: "task-1",
      freelancer_id: "freelancer-1",
      content: { deliverables: [{ type: "link", url: "https://example.com/old" }] },
      client_review: { status: "revision_requested", feedback: "Update the tests" },
    });
    mockSubmissionData.updateSubmission.mockResolvedValue({ id: "submission-1" });
    mockTaskService.transitionTo.mockResolvedValue({ id: "task-1", status: "delivered" });
    mockTaskData.findTaskById.mockResolvedValue({
      id: "task-1",
      client_id: "client-1",
      freelancer_id: "freelancer-1",
      status: "delivered",
    });
    mockNotificationService.create.mockResolvedValue({ id: "notification-1" });
  });

  test("publishes the delivered state after a freelancer resubmits a revision", async () => {
    const req = {
      params: { id: "submission-1" },
      user: { id: "freelancer-1", role: "freelancer" },
      body: {
        deliverables: [{ type: "link", url: "https://example.com/revised" }],
        comments: "Revision ready",
      },
    };
    const res = response();
    const next = jest.fn();

    await freelancerController.updateSubmission(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockRealtimeHub.publish).toHaveBeenCalledWith({
      users: ["client-1", "freelancer-1"],
      event: "task.status_changed",
      payload: { taskId: "task-1", status: "delivered" },
    });
  });
});
