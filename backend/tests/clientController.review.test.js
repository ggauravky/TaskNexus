let mockPersistedSubmission;

const mockSubmissionData = {
  reviewSubmissionAtomically: jest.fn(),
};
const mockNotificationService = { publishCreated: jest.fn() };
const mockAuditLogData = { log: jest.fn(async () => undefined) };
const mockRealtimeHub = { publish: jest.fn(), publishToUser: jest.fn() };

jest.mock("../src/data/taskData", () => ({}));
jest.mock("../src/data/reviewData", () => ({}));
jest.mock("../src/data/submissionData", () => mockSubmissionData);
jest.mock("../src/data/paymentData", () => ({}));
jest.mock("../src/data/auditLogData", () => mockAuditLogData);
jest.mock("../src/data/userData", () => ({}));
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock("../src/services/notificationService", () => mockNotificationService);
jest.mock("../src/services/realtimeHub", () => mockRealtimeHub);

const clientController = require("../src/controllers/clientController");

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("client submission review", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistedSubmission = {
      id: "44444444-4444-4444-8444-444444444444",
      freelancer_id: "33333333-3333-4333-8333-333333333333",
      is_active: true,
      client_review: { status: "pending", reviewedAt: null, feedback: "" },
    };
  });

  test("requesting a revision keeps the submission active for freelancer resubmission", async () => {
    const task = {
      id: "11111111-1111-4111-8111-111111111111",
      client_id: "22222222-2222-4222-8222-222222222222",
      freelancer_id: mockPersistedSubmission.freelancer_id,
      status: "client_revision",
      task_details: { title: "Delivery task" },
    };
    const submission = {
      ...mockPersistedSubmission,
      client_review: { status: "revision_requested", feedback: "Please add the QA summary." },
    };
    const notification = { recipient_id: submission.freelancer_id, type: "revision_requested" };
    mockSubmissionData.reviewSubmissionAtomically.mockResolvedValue({ task, submission, notification });
    const req = {
      params: { id: mockPersistedSubmission.id },
      user: { id: "22222222-2222-4222-8222-222222222222" },
      body: { action: "request_revision", feedback: "Please add the QA summary." },
      ip: "127.0.0.1",
    };
    const res = response();
    const next = jest.fn();

    await clientController.reviewSubmission(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: { ...submission, task },
    }));
    expect(mockNotificationService.publishCreated).toHaveBeenCalledWith(notification);
    expect(mockSubmissionData.reviewSubmissionAtomically).toHaveBeenCalledWith({
      submissionId: submission.id, clientId: task.client_id, action: "request_revision",
      feedback: "Please add the QA summary.", ip: "127.0.0.1",
    });
  });
});
