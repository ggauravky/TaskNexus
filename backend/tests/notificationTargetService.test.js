const {
  normalizeInternalNotificationPath,
  resolveNotificationTarget,
} = require("../src/services/notificationTargetService");

const TASK_ID = "00000000-0000-4000-8000-000000000101";

describe("notification safe target mapping", () => {
  test.each([
    ["task_submitted", "/tasks/00000000-0000-4000-8000-000000000101?tab=delivery"],
    ["revision_requested", "/tasks/00000000-0000-4000-8000-000000000101?tab=delivery"],
    ["task_progress", "/tasks/00000000-0000-4000-8000-000000000101?tab=work"],
    ["task_started", "/tasks/00000000-0000-4000-8000-000000000101"],
  ])("maps %s through the trusted marketplace task id", (type, expected) => {
    expect(resolveNotificationTarget({ type, related_task_id: TASK_ID, content: {} })).toBe(expected);
  });

  test("routes task comment mentions to discussion", () => {
    expect(resolveNotificationTarget({
      type: "task_submitted",
      related_task_id: TASK_ID,
      content: { commentId: "00000000-0000-4000-8000-000000000202" },
    })).toBe(`/tasks/${TASK_ID}?tab=discussion`);
  });

  test.each([
    [{ type: "team_invitation", entity_type: "team", entity_id: TASK_ID, content: { actionUrl: "/teams" } }, "/teams"],
    [{ type: "collaboration_request_received", entity_type: "collaboration_request", entity_id: TASK_ID, content: { actionUrl: "/teams/example" } }, "/collaboration"],
    [{ type: "native_application_submitted", entity_type: "native_application", entity_id: TASK_ID, content: { actionUrl: "/applications" } }, "/applications"],
    [{ type: "organization_invitation", entity_type: "organization", entity_id: TASK_ID, content: { actionUrl: "/organizations/acme/workspace" } }, "/organization-invitations"],
    [{ type: "project_task_assigned", entity_type: "project", entity_id: TASK_ID, content: { actionUrl: "/teams/alpha/projects/launch" } }, "/teams/alpha/projects/launch"],
  ])("maps domain notification to a consistent internal target", (notification, expected) => {
    expect(resolveNotificationTarget(notification)).toBe(expected);
  });

  test.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "javascript:alert(1)",
    "/teams\\evil",
    "/teams/alpha\n/settings",
    "/tasks/not-a-uuid",
    "/tasks/00000000-0000-4000-8000-000000000101?tab=admin",
  ])("rejects unsafe or malformed internal target %s", (value) => {
    expect(normalizeInternalNotificationPath(value)).toBeNull();
  });

  test("rejects a safe route that is inconsistent with the notification domain", () => {
    expect(resolveNotificationTarget({
      type: "team_invitation",
      entity_type: "team",
      entity_id: TASK_ID,
      content: { actionUrl: `/tasks/${TASK_ID}` },
    })).toBe("/teams");
  });

  test("unknown notification types always fall back safely", () => {
    expect(resolveNotificationTarget({
      type: "future_unknown_event",
      related_task_id: TASK_ID,
      content: { actionUrl: "/applications" },
    })).toBe("/notifications");
  });
});

