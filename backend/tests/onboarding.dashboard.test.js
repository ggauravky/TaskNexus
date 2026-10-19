jest.mock("../src/data/taskData", () => ({ findTasks: jest.fn() }));
jest.mock("../src/data/paymentData", () => ({ findPayments: jest.fn() }));
jest.mock("../src/data/reviewData", () => ({ findReviews: jest.fn() }));
jest.mock("../src/data/submissionData", () => ({ findSubmissions: jest.fn() }));
jest.mock("../src/services/performanceService", () => ({
  calculatePerformanceMetrics: jest.fn(),
}));
jest.mock("../src/services/onboardingService", () => ({
  getClientOnboarding: jest.fn(),
  getFreelancerOnboarding: jest.fn(),
}));

const taskData = require("../src/data/taskData");
const paymentData = require("../src/data/paymentData");
const reviewData = require("../src/data/reviewData");
const submissionData = require("../src/data/submissionData");
const performanceService = require("../src/services/performanceService");
const onboardingService = require("../src/services/onboardingService");
const clientController = require("../src/controllers/clientController");
const freelancerController = require("../src/controllers/freelancerController");

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe("dashboard onboarding aggregate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    taskData.findTasks.mockResolvedValue([]);
    paymentData.findPayments.mockResolvedValue([]);
    reviewData.findReviews.mockResolvedValue([]);
    submissionData.findSubmissions.mockResolvedValue([]);
    performanceService.calculatePerformanceMetrics.mockResolvedValue({
      performanceScore: 0,
      onTimeDeliveryRate: 0,
    });
  });

  test("client dashboard derives onboarding from the authenticated user and owned tasks", async () => {
    const user = { id: "client-1", role: "client" };
    const onboarding = { role: "client", is_complete: false, items: [] };
    const tasks = [{ id: "task-1", client_id: user.id, status: "open" }];
    taskData.findTasks.mockResolvedValue(tasks);
    onboardingService.getClientOnboarding.mockResolvedValue(onboarding);
    const res = response();
    const next = jest.fn();

    await clientController.getDashboard({ user }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(onboardingService.getClientOnboarding).toHaveBeenCalledWith({ user, tasks });
    expect(res.json.mock.calls[0][0].data.onboarding).toBe(onboarding);
  });

  test("freelancer dashboard derives onboarding from the authenticated user and assigned tasks", async () => {
    const user = { id: "freelancer-1", role: "freelancer" };
    const onboarding = { role: "freelancer", is_complete: false, items: [] };
    const tasks = [{ id: "task-1", freelancer_id: user.id, status: "assigned" }];
    taskData.findTasks.mockResolvedValue(tasks);
    onboardingService.getFreelancerOnboarding.mockResolvedValue(onboarding);
    const res = response();
    const next = jest.fn();

    await freelancerController.getDashboard({ user }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(onboardingService.getFreelancerOnboarding).toHaveBeenCalledWith({ user, tasks });
    expect(res.json.mock.calls[0][0].data.onboarding).toBe(onboarding);
  });
});
