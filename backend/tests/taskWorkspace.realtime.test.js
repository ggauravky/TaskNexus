const mockSubmissionData = {
  resubmitReviewedWork: jest.fn(),
};
const mockNotificationService = { publishCreated: jest.fn() };
const mockRealtimeHub = { publish: jest.fn(), publishToRole: jest.fn(), publishToUser: jest.fn() };

jest.mock("../src/data/taskData", () => ({}));
jest.mock("../src/data/submissionData", () => mockSubmissionData);
jest.mock("../src/data/paymentData", () => ({}));
jest.mock("../src/data/reviewData", () => ({}));
jest.mock("../src/data/userData", () => ({}));
jest.mock("../src/data/auditLogData", () => ({}));
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
    mockSubmissionData.resubmitReviewedWork.mockResolvedValue({
      task: { id: "task-1", client_id: "client-1", freelancer_id: "freelancer-1", status: "delivered" },
      submission: { id: "submission-2" },
      notification: { id: "notification-1" },
    });
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
    expect(mockNotificationService.publishCreated).toHaveBeenCalledWith({ id: "notification-1" });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { id: "submission-2" } }));
    expect(mockRealtimeHub.publish).toHaveBeenCalledWith({
      users: ["client-1", "freelancer-1"],
      event: "task.status_changed",
      payload: { taskId: "task-1", status: "delivered" },
    });
  });
});
