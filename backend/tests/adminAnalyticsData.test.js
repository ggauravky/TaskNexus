const mockModels = {
  Payment: { aggregate: jest.fn() },
  Review: { aggregate: jest.fn() },
  Task: { aggregate: jest.fn() },
  User: { aggregate: jest.fn() },
};

jest.mock("../src/models", () => mockModels);

const adminAnalyticsData = require("../src/data/adminAnalyticsData");

describe("bounded admin analytics", () => {
  beforeEach(() => jest.clearAllMocks());

  test("builds the dashboard from aggregates and limits recent tasks", async () => {
    mockModels.User.aggregate.mockResolvedValue([
      { _id: "client", count: 4 }, { _id: "freelancer", count: 6 }, { _id: "admin", count: 1 },
    ]);
    mockModels.Task.aggregate.mockResolvedValue([{
      total: [{ value: 8 }],
      byStatus: [{ _id: "completed", count: 3 }, { _id: "active", count: 5 }],
      recent: [{ _id: "task-1", status: "active" }],
    }]);
    mockModels.Payment.aggregate.mockResolvedValue([{ _id: null, value: 42 }]);

    await expect(adminAnalyticsData.getDashboardSummary()).resolves.toEqual({
      users: { total: 11, clients: 4, freelancers: 6 },
      tasks: {
        total: 8,
        byStatus: [{ status: "completed", count: 3 }, { status: "active", count: 5 }],
      },
      platformRevenue: 42,
      recentTasks: [{ id: "task-1", status: "active" }],
    });
    expect(mockModels.Task.aggregate.mock.calls[0][0][0].$facet.recent).toContainEqual({ $limit: 10 });
  });

  test("normalizes empty aggregate results", async () => {
    mockModels.Task.aggregate.mockResolvedValue([{}]);
    mockModels.User.aggregate.mockResolvedValue([{}]);
    mockModels.Payment.aggregate.mockResolvedValue([{}]);
    mockModels.Review.aggregate.mockResolvedValue([]);

    await expect(adminAnalyticsData.getStatistics(new Date("2030-01-01"))).resolves.toMatchObject({
      totalRevenue: 0,
      activeUsers: 0,
      totalUsers: 0,
      totalTasks: 0,
      completionRate: 0,
      averageCompletionTime: 0,
      satisfactionRate: 0,
      paymentStats: { completed: 0, completedCount: 0, pending: 0, pendingCount: 0 },
    });
  });
});
