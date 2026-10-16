import test from "node:test";
import assert from "node:assert/strict";

import {
  formatNotificationBadge,
  INITIAL_NOTIFICATION_STATE,
  notificationBellLabel,
  notificationReducer,
  openNotificationTarget,
} from "../src/utils/notificationState.js";

const item = (id, status = "unread", overrides = {}) => ({
  id,
  type: "task_progress",
  status,
  content: { title: `Notification ${id}`, message: "Update" },
  target_path: "/notifications",
  created_at: `2026-10-15T10:00:0${id}.000Z`,
  ...overrides,
});

test("server refresh is authoritative and keeps only eight recent rows", () => {
  const notifications = Array.from({ length: 10 }, (_, index) => item(String(index)));
  const state = notificationReducer(INITIAL_NOTIFICATION_STATE, {
    type: "load_success",
    notifications,
    unreadCount: 14,
  });

  assert.equal(state.loading, false);
  assert.equal(state.unreadCount, 14);
  assert.deepEqual(state.notifications.map(({ id }) => id), ["0", "1", "2", "3", "4", "5", "6", "7"]);
});

test("an authoritative refresh reconciles unread state after mark-all", () => {
  const initial = notificationReducer(INITIAL_NOTIFICATION_STATE, {
    type: "load_success",
    notifications: [item("1"), item("2")],
    unreadCount: 2,
  });
  const pending = notificationReducer(initial, { type: "mark_all_optimistic" });
  const reconciled = notificationReducer(pending, {
    type: "load_success",
    notifications: [item("3"), item("1", "read"), item("2", "read")],
    unreadCount: 1,
  });

  assert.deepEqual(reconciled.notifications.map(({ id }) => id), ["3", "1", "2"]);
  assert.equal(reconciled.unreadCount, 1);
  assert.equal(reconciled.markAllPending, false);
});

test("mark-one optimistic state decrements once and never below zero", () => {
  const initial = {
    ...INITIAL_NOTIFICATION_STATE,
    notifications: [item("1"), item("2", "read")],
    unreadCount: 1,
  };
  const pending = notificationReducer(initial, { type: "mark_read_optimistic", id: "1" });
  const duplicate = notificationReducer(pending, { type: "mark_read_optimistic", id: "1" });
  const alreadyRead = notificationReducer(duplicate, { type: "mark_read_optimistic", id: "2" });

  assert.equal(alreadyRead.unreadCount, 0);
  assert.equal(alreadyRead.notifications.find(({ id }) => id === "1").status, "read");
  assert.deepEqual(alreadyRead.pendingIds, ["1"]);
});

test("failed mark-one restores the prior row and unread count", () => {
  const initial = {
    ...INITIAL_NOTIFICATION_STATE,
    notifications: [item("1")],
    unreadCount: 1,
  };
  const pending = notificationReducer(initial, { type: "mark_read_optimistic", id: "1" });
  const restored = notificationReducer(pending, {
    type: "mark_read_rollback",
    id: "1",
    error: "Notification could not be opened",
  });

  assert.equal(restored.unreadCount, 1);
  assert.equal(restored.notifications[0].status, "unread");
  assert.deepEqual(restored.pendingIds, []);
  assert.equal(restored.error, "Notification could not be opened");
});

test("mark-all converges to zero and rollback restores the server-backed state", () => {
  const initial = {
    ...INITIAL_NOTIFICATION_STATE,
    notifications: [item("1"), item("2", "read"), item("3")],
    unreadCount: 5,
  };
  const pending = notificationReducer(initial, { type: "mark_all_optimistic" });

  assert.equal(pending.unreadCount, 0);
  assert.equal(pending.notifications.every(({ status }) => status === "read"), true);
  assert.equal(pending.markAllPending, true);

  const restored = notificationReducer(pending, {
    type: "mark_all_rollback",
    error: "Notifications could not be updated",
  });
  assert.equal(restored.unreadCount, 5);
  assert.deepEqual(restored.notifications.map(({ status }) => status), ["unread", "read", "unread"]);
  assert.equal(restored.markAllPending, false);

  const committed = notificationReducer(pending, { type: "mark_all_commit" });
  assert.equal(committed.unreadCount, 0);
  assert.equal(committed.markAllPending, false);
});

test("badge and accessible label communicate bounded unread state", () => {
  assert.equal(formatNotificationBadge(0), "");
  assert.equal(formatNotificationBadge(1), "1");
  assert.equal(formatNotificationBadge(99), "99");
  assert.equal(formatNotificationBadge(100), "99+");
  assert.equal(notificationBellLabel(0), "Notifications, no unread items");
  assert.equal(notificationBellLabel(1), "Notifications, 1 unread item");
  assert.equal(notificationBellLabel(120), "Notifications, 120 unread items");
});

test("opening an unread notification yields a target only after persisted read succeeds", async () => {
  const notification = item("1", "unread", { target_path: "/applications" });
  const calls = [];
  const target = await openNotificationTarget(notification, async ({ id }) => {
    calls.push(id);
    return { ...notification, status: "read" };
  });

  assert.deepEqual(calls, ["1"]);
  assert.equal(target, "/applications");

  const failed = await openNotificationTarget(notification, async () => {
    throw new Error("network");
  });
  assert.equal(failed, null);
});

