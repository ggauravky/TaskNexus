const { paginationMeta } = require("../src/utils/apiResponse");
const { parseListQuery } = require("../src/utils/queryOptions");
const { serializeNotification, serializeTask, serializeUser } = require("../src/serializers");
const collaborationService = require("../src/services/collaborationService");

jest.mock("../src/data/collaborationData", () => ({}));

describe("API boundary contracts", () => {
  test("pagination is bounded and sorting is allowlisted", () => {
    expect(parseListQuery({ page: "0", limit: "999", sortBy: "password", sortOrder: "asc" }, {
      allowedSorts: ["created_at", "email"],
      defaultSort: "created_at",
    })).toEqual(expect.objectContaining({
      page: 1,
      limit: 100,
      sortBy: "created_at",
      sortOrder: "asc",
    }));
    expect(paginationMeta({ page: 2, limit: 10, total: 25 })).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });
  });

  test("user DTO excludes credential fields", () => {
    const result = serializeUser({
      id: "user-1",
      email: "safe@example.com",
      role: "client",
      status: "active",
      password: "hash",
      refresh_token: "secret",
      password_reset_token: "secret",
    });
    expect(result).not.toHaveProperty("password");
    expect(result).not.toHaveProperty("refresh_token");
    expect(result).not.toHaveProperty("password_reset_token");
  });

  test("task DTO exposes canonical relationship identifiers", () => {
    const result = serializeTask({
      id: "task-1",
      task_id: "TSK-1",
      client_id: "client-1",
      freelancer_id: null,
      status: "under_review",
    });
    expect(result).toMatchObject({ id: "task-1", client_id: "client-1" });
    expect(result).not.toHaveProperty("_id");
    expect(result).not.toHaveProperty("clientId");
  });

  test("notification DTO exposes only the canonical safe navigation target", () => {
    const result = serializeNotification({
      id: "notification-1",
      recipient_id: "user-1",
      type: "task_progress",
      related_task_id: "00000000-0000-4000-8000-000000000101",
      content: {
        title: "Progress updated",
        actionUrl: "https://evil.example/steal",
      },
      status: "unread",
      priority: "medium",
    });

    expect(result.target_path).toBe("/tasks/00000000-0000-4000-8000-000000000101?tab=work");
    expect(result).not.toHaveProperty("targetPath");
  });

  test("task access rejects a client who does not own the task", () => {
    expect(() => collaborationService.ensureTaskAccess(
      { id: "task-1", client_id: "owner", freelancer_id: null },
      { id: "other", role: "client" },
    )).toThrow("Not authorized");
  });

  test("task access rejects a freelancer assigned elsewhere", () => {
    expect(() => collaborationService.ensureTaskAccess(
      { id: "task-1", client_id: "client", freelancer_id: "assigned" },
      { id: "other", role: "freelancer" },
    )).toThrow("Not authorized");
  });

  test("task collaboration access rejects an unassigned marketplace viewer", () => {
    expect(() => collaborationService.ensureTaskAccess(
      { id: "task-1", client_id: "client", freelancer_id: null },
      { id: "viewer", role: "freelancer" },
    )).toThrow("Not authorized");
  });
});
