const mockSession = {
  withTransaction: jest.fn(async (operation) => operation()),
  endSession: jest.fn(async () => undefined),
};

jest.mock("mongoose", () => ({
  ...jest.requireActual("mongoose"),
  startSession: jest.fn(async () => mockSession),
}));

const mockModels = {
  Task: {
    findOneAndUpdate: jest.fn(async () => ({
      _id: "11111111-1111-4111-8111-111111111111",
      freelancer_id: "22222222-2222-4222-8222-222222222222",
      status: "delivered",
    })),
    findById: jest.fn(),
  },
  Submission: {
    findOne: jest.fn((filter) => {
      if (filter.idempotency_key) return { lean: jest.fn(async () => null) };
      return {
        sort: jest.fn(() => ({
          session: jest.fn(() => ({ lean: jest.fn(async () => null) })),
        })),
      };
    }),
    updateMany: jest.fn(async () => ({ modifiedCount: 0 })),
    create: jest.fn(async ([submission]) => [{
      _id: "33333333-3333-4333-8333-333333333333",
      ...submission,
    }]),
  },
};

jest.mock("../src/models", () => mockModels);

const submissionData = require("../src/data/submissionData");

describe("atomic work submission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("a new submission starts in pending client review", async () => {
    const result = await submissionData.submitWorkAtomically({
      taskId: "11111111-1111-4111-8111-111111111111",
      freelancerId: "22222222-2222-4222-8222-222222222222",
      submissionType: "initial",
      content: {
        deliverables: ["https://example.invalid/delivery"],
        comments: "Ready for client review.",
      },
      idempotencyKey: "delivery-1",
    });

    expect(result.submission.client_review).toEqual({
      status: "pending",
      reviewedAt: null,
      feedback: "",
    });
  });
});
