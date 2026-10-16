process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "task-workspace-access-secret";
process.env.JWT_REFRESH_SECRET = "task-workspace-refresh-secret";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";

const request = require("supertest");
const taskData = require("../src/data/taskData");
const userData = require("../src/data/userData");
const submissionData = require("../src/data/submissionData");
const reviewData = require("../src/data/reviewData");
const taskWorkspaceService = require("../src/services/taskWorkspaceService");
const { generateTokens } = require("../src/config/jwt");
const app = require("../src/app");

jest.mock("../src/data/taskData", () => ({
  findTaskById: jest.fn(),
  updateTask: jest.fn(),
}));
jest.mock("../src/data/userData", () => ({ findUserById: jest.fn() }));
jest.mock("../src/data/submissionData", () => ({
  findSubmissions: jest.fn(),
  listRecentSubmissions: jest.fn(),
  getRevisionCount: jest.fn(),
}));
jest.mock("../src/data/reviewData", () => ({ findReviews: jest.fn() }));
jest.mock("../src/data/auditLogData", () => ({ log: jest.fn().mockResolvedValue(null) }));
jest.mock("../src/services/notificationService", () => ({
  create: jest.fn().mockResolvedValue(null),
}));

const task = (overrides = {}) => ({
  id: "00000000-0000-4000-8000-000000000101",
  task_id: "TSK-101",
  client_id: "00000000-0000-4000-8000-000000000201",
  freelancer_id: "00000000-0000-4000-8000-000000000202",
  status: "in_progress",
  task_details: {
    title: "Build the TaskNexus workspace",
    description: "Create the canonical marketplace task workspace.",
    budget: 1200,
    deadline: "2030-01-01T00:00:00.000Z",
  },
  metrics: { progress: 35, stage: "in_progress", progressNote: "API complete" },
  workflow: {},
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-10T00:00:00.000Z",
  ...overrides,
});

const users = {
  client: {
    id: "00000000-0000-4000-8000-000000000201",
    role: "client",
    status: "active",
    email: "private-client@example.com",
    profile: { firstName: "Cora", lastName: "Client", avatar: "https://example.com/cora.png" },
  },
  freelancer: {
    id: "00000000-0000-4000-8000-000000000202",
    role: "freelancer",
    status: "active",
    email: "private-freelancer@example.com",
    profile: { firstName: "Finn", lastName: "Freelancer" },
  },
  unrelatedClient: { id: "00000000-0000-4000-8000-000000000203", role: "client", status: "active" },
  unrelatedFreelancer: { id: "00000000-0000-4000-8000-000000000204", role: "freelancer", status: "active" },
  admin: { id: "00000000-0000-4000-8000-000000000205", role: "admin", status: "active" },
};

describe("marketplace task workspace", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    taskData.findTaskById.mockResolvedValue(task());
    userData.findUserById.mockImplementation(async (id) => (
      [users.client, users.freelancer].find((user) => user.id === id) || null
    ));
    submissionData.findSubmissions.mockResolvedValue([]);
    submissionData.listRecentSubmissions.mockResolvedValue([]);
    submissionData.getRevisionCount.mockResolvedValue(0);
    reviewData.findReviews.mockResolvedValue([]);
    taskData.updateTask.mockResolvedValue(task());
  });

  test.each([
    ["task client", users.client],
    ["assigned freelancer", users.freelancer],
    ["administrator", users.admin],
  ])("allows the %s", async (_label, actor) => {
    const workspace = await taskWorkspaceService.getWorkspace(task().id, actor);
    expect(workspace.task).toMatchObject({ id: task().id, status: "in_progress" });
    expect(workspace.viewer).toEqual({ role: actor.role, relationship: actor.role === "admin" ? "admin" : actor.role });
  });

  test("allowlists lifecycle and progress fields without embedded collaboration storage metadata", async () => {
    taskData.findTaskById.mockResolvedValue(task({
      workflow: {
        assignedAt: "2026-10-02T00:00:00.000Z",
        startedAt: "2026-10-03T00:00:00.000Z",
        deliveredAt: null,
        collaboration: {
          comments: [{
            body: "legacy comment",
            attachments: [{ storageKey: "private/key", storageProvider: "disk" }],
          }],
          activity: [{ message: "legacy activity" }],
        },
      },
      metrics: {
        progress: 35,
        stage: "in_progress",
        progressNote: "API complete",
        progressUpdatedAt: "2026-10-10T00:00:00.000Z",
        subtasks: [{ id: "legacy-subtask", title: "Do not inline" }],
        milestoneProgress: 35,
      },
    }));

    const workspace = await taskWorkspaceService.getWorkspace(task().id, users.client);

    expect(workspace.task.workflow).toEqual({
      assignedAt: "2026-10-02T00:00:00.000Z",
      startedAt: "2026-10-03T00:00:00.000Z",
      deliveredAt: null,
    });
    expect(workspace.task.metrics).toEqual({
      progress: 35,
      stage: "in_progress",
      progressNote: "API complete",
      progressUpdatedAt: "2026-10-10T00:00:00.000Z",
      milestoneProgress: 35,
    });
    expect(JSON.stringify(workspace)).not.toContain("storageKey");
    expect(JSON.stringify(workspace)).not.toContain("legacy-subtask");
    expect(JSON.stringify(workspace)).not.toContain("legacy comment");
  });

  test.each([
    ["unrelated client", users.unrelatedClient],
    ["unrelated freelancer", users.unrelatedFreelancer],
  ])("denies an %s", async (_label, actor) => {
    await expect(taskWorkspaceService.getWorkspace(task().id, actor)).rejects.toMatchObject({
      statusCode: 403,
      message: "Not authorized to access this task workspace",
    });
  });

  test("denies an unassigned freelancer even when the task is marketplace-visible", async () => {
    taskData.findTaskById.mockResolvedValue(task({ status: "under_review", freelancer_id: null }));
    await expect(taskWorkspaceService.getWorkspace(task().id, users.unrelatedFreelancer)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test("returns a not-found error without leaking workspace details", async () => {
    taskData.findTaskById.mockResolvedValue(null);
    await expect(taskWorkspaceService.getWorkspace(task().id, users.client)).rejects.toMatchObject({
      statusCode: 404,
      message: "Task not found",
    });
  });

  test.each([
    ["freelancer can start assigned work", users.freelancer, { status: "assigned" }, ["start_work", "return_task"]],
    ["freelancer can progress and submit active work", users.freelancer, { status: "in_progress" }, ["update_progress", "submit_work", "return_task"]],
    ["client can review a pending delivery", users.client, { status: "delivered" }, ["approve_delivery", "request_revision"]],
    ["administrator receives no marketplace lifecycle mutations", users.admin, { status: "delivered" }, []],
  ])("derives authoritative actions: %s", async (_label, actor, taskOverrides, expectedActions) => {
    taskData.findTaskById.mockResolvedValue(task(taskOverrides));
    if (taskOverrides.status === "delivered") {
      submissionData.findSubmissions.mockResolvedValue([{
        id: "00000000-0000-4000-8000-000000000301",
        task_id: task().id,
        freelancer_id: users.freelancer.id,
        is_active: true,
        version: 1,
        client_review: { status: "pending" },
        content: { deliverables: [{ type: "link", url: "https://example.com/work" }] },
      }]);
    }

    const workspace = await taskWorkspaceService.getWorkspace(task().id, actor);
    expect(workspace.available_actions).toEqual(expectedActions);
  });

  test("allows a freelancer to resubmit only when an active revision was requested", async () => {
    taskData.findTaskById.mockResolvedValue(task({ status: "client_revision" }));
    submissionData.findSubmissions.mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000301",
      task_id: task().id,
      freelancer_id: users.freelancer.id,
      is_active: true,
      version: 1,
      client_review: { status: "revision_requested", feedback: "Please add tests" },
      content: { deliverables: [] },
    }]);

    const workspace = await taskWorkspaceService.getWorkspace(task().id, users.freelancer);
    expect(workspace.available_actions).toEqual(["resubmit_work"]);
    expect(workspace.current_submission).toEqual(expect.objectContaining({
      id: "00000000-0000-4000-8000-000000000301",
      review_status: "revision_requested",
    }));
    expect(workspace.current_submission).not.toHaveProperty("content");
  });

  test("withholds revision actions when the task revision limit is exhausted", async () => {
    taskData.findTaskById.mockResolvedValue(task({
      status: "delivered",
      task_details: { ...task().task_details, revisionLimit: 1 },
    }));
    submissionData.findSubmissions.mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000301",
      task_id: task().id,
      freelancer_id: users.freelancer.id,
      is_active: true,
      version: 1,
      client_review: { status: "pending" },
      content: { deliverables: [{ type: "link", url: "https://example.com/work" }] },
    }]);
    submissionData.getRevisionCount.mockResolvedValue(1);

    const workspace = await taskWorkspaceService.getWorkspace(task().id, users.client);

    expect(workspace.available_actions).toEqual(["approve_delivery"]);
    expect(workspace.permissions.can_review).toBe(true);
    expect(workspace.permissions.can_request_revision).toBe(false);
  });

  test("allows the client to rate a completed task only before a review exists", async () => {
    taskData.findTaskById.mockResolvedValue(task({ status: "completed" }));
    const unrated = await taskWorkspaceService.getWorkspace(task().id, users.client);
    expect(unrated.available_actions).toEqual(["rate_freelancer"]);

    reviewData.findReviews.mockResolvedValue([{ id: "review-1", review_type: "client_to_platform" }]);
    const rated = await taskWorkspaceService.getWorkspace(task().id, users.client);
    expect(rated.available_actions).toEqual([]);
    expect(rated.rating.has_rated).toBe(true);
  });

  test("returns only participant-safe identity fields", async () => {
    const workspace = await taskWorkspaceService.getWorkspace(task().id, users.client);
    expect(workspace.participants.client).toEqual({
      id: users.client.id,
      role: "client",
      name: "Cora Client",
      avatar_url: "https://example.com/cora.png",
    });
    expect(workspace.participants.client).not.toHaveProperty("email");
    expect(workspace.participants.freelancer).not.toHaveProperty("email");
  });

  test("loads full delivery data only when the delivery section is requested", async () => {
    submissionData.findSubmissions.mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000301",
      task_id: task().id,
      freelancer_id: users.freelancer.id,
      submission_type: "initial",
      content: { deliverables: [{ type: "link", url: "https://example.com/work" }] },
      client_review: { status: "pending" },
      version: 1,
      is_active: true,
    }]);
    submissionData.listRecentSubmissions.mockResolvedValue([{
      id: "00000000-0000-4000-8000-000000000301",
      task_id: task().id,
      freelancer_id: users.freelancer.id,
      submission_type: "initial",
      content: { deliverables: [{ type: "link", url: "https://example.com/work" }] },
      client_review: { status: "pending" },
      version: 1,
      is_active: true,
    }]);

    const base = await taskWorkspaceService.getWorkspace(task().id, users.client);
    expect(base).not.toHaveProperty("delivery");

    const withDelivery = await taskWorkspaceService.getWorkspace(task().id, users.client, { section: "delivery" });
    expect(submissionData.listRecentSubmissions).toHaveBeenCalledWith(task().id, 25);
    expect(withDelivery.delivery.submissions).toEqual([
      expect.objectContaining({ content: expect.objectContaining({ deliverables: expect.any(Array) }) }),
    ]);
  });
});

describe("marketplace task workspace API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    taskData.findTaskById.mockResolvedValue(task());
    userData.findUserById.mockImplementation(async (id) => (
      Object.values(users).find((user) => user.id === id) || null
    ));
    submissionData.findSubmissions.mockResolvedValue([]);
    submissionData.listRecentSubmissions.mockResolvedValue([]);
    submissionData.getRevisionCount.mockResolvedValue(0);
    reviewData.findReviews.mockResolvedValue([]);
    taskData.updateTask.mockResolvedValue(task());
  });

  const tokenFor = (actor) => generateTokens(actor.id, actor.role).accessToken;

  test("returns the canonical workspace envelope for a participant", async () => {
    const response = await request(app)
      .get(`/api/tasks/${task().id}/workspace`)
      .set("Authorization", `Bearer ${tokenFor(users.client)}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        task: { id: task().id },
        viewer: { relationship: "client" },
        permissions: expect.any(Object),
        available_actions: [],
      },
    });
  });

  test("enforces the strict workspace boundary through the API", async () => {
    const response = await request(app)
      .get(`/api/tasks/${task().id}/workspace`)
      .set("Authorization", `Bearer ${tokenFor(users.unrelatedClient)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ message: "Not authorized to access this task workspace" });
  });

  test.each([
    ["unrelated client", users.unrelatedClient, "comments", `/api/tasks/${task().id}/comments`],
    ["unrelated client", users.unrelatedClient, "activity", `/api/tasks/${task().id}/activity`],
    ["unrelated client", users.unrelatedClient, "subtasks", `/api/tasks/${task().id}/subtasks`],
    ["unrelated client", users.unrelatedClient, "attachments", `/api/tasks/${task().id}/attachments/private-file.txt`],
    ["unrelated freelancer", users.unrelatedFreelancer, "comments", `/api/tasks/${task().id}/comments`],
    ["unrelated freelancer", users.unrelatedFreelancer, "activity", `/api/tasks/${task().id}/activity`],
    ["unrelated freelancer", users.unrelatedFreelancer, "subtasks", `/api/tasks/${task().id}/subtasks`],
    ["unrelated freelancer", users.unrelatedFreelancer, "attachments", `/api/tasks/${task().id}/attachments/private-file.txt`],
  ])("denies an %s access to workspace %s", async (_actorLabel, actor, _resource, path) => {
    const response = await request(app)
      .get(path)
      .set("Authorization", `Bearer ${tokenFor(actor)}`);

    expect(response.status).toBe(403);
  });

  test("validates the optional lazy section", async () => {
    const response = await request(app)
      .get(`/api/tasks/${task().id}/workspace?section=everything`)
      .set("Authorization", `Bearer ${tokenFor(users.client)}`);

    expect(response.status).toBe(400);
  });

  test("rejects non-HTTPS initial submission deliverables before mutation", async () => {
    const response = await request(app)
      .post(`/api/tasks/${task().id}/submit`)
      .set("Authorization", `Bearer ${tokenFor(users.freelancer)}`)
      .send({ deliverables: [{ type: "link", url: "http://example.com/work" }] });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: "Deliverable URL must use HTTPS" }),
    ]));
  });

  test("rejects unsupported revision deliverable types before mutation", async () => {
    const submissionId = "00000000-0000-4000-8000-000000000301";
    const response = await request(app)
      .put(`/api/freelancer/submissions/${submissionId}`)
      .set("Authorization", `Bearer ${tokenFor(users.freelancer)}`)
      .send({ deliverables: [{ type: "archive", url: "https://example.com/work.zip" }] });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: "Invalid deliverable type" }),
    ]));
  });

  test("rejects progress updates when the task lifecycle does not permit them", async () => {
    taskData.findTaskById.mockResolvedValue(task({ status: "delivered" }));

    const response = await request(app)
      .put(`/api/freelancer/tasks/${task().id}/progress`)
      .set("Authorization", `Bearer ${tokenFor(users.freelancer)}`)
      .send({ progress: "80", stage: "ready_for_submission", note: "Already delivered" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      message: "Task must be in 'in_progress' status to update progress",
    });
    expect(taskData.updateTask).not.toHaveBeenCalled();
  });
});
