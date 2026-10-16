import test from "node:test";
import assert from "node:assert/strict";

import {
  deliveryRefreshKey,
  isWorkspaceActionAvailable,
  resolveCollaborationPermissions,
  shouldClearWorkspaceForStatus,
} from "../src/utils/taskWorkspacePermissions.js";

const task = {
  client_id: "client-1",
  freelancer_id: "freelancer-1",
};

test("workspace permissions override participant-derived collaboration controls", () => {
  const permissions = resolveCollaborationPermissions({
    task,
    user: { id: "client-1", role: "client" },
    authoritative: {
      can_collaborate: false,
      can_manage_subtasks: false,
    },
  });

  assert.deepEqual(permissions, {
    canCollaborate: false,
    canManageSubtasks: false,
  });
});

test("legacy modal consumers retain participant-derived collaboration controls", () => {
  const permissions = resolveCollaborationPermissions({
    task,
    user: { id: "freelancer-1", role: "freelancer" },
  });

  assert.deepEqual(permissions, {
    canCollaborate: true,
    canManageSubtasks: true,
  });
});

test("workspace actions require both the permission and available action", () => {
  const workspace = {
    permissions: { can_review: true, can_request_revision: false },
    available_actions: ["approve_delivery"],
  };

  assert.equal(isWorkspaceActionAvailable(workspace, "approve_delivery", "can_review"), true);
  assert.equal(isWorkspaceActionAvailable(workspace, "request_revision", "can_request_revision"), false);
});

test("delivery refresh key changes when authoritative submission state changes", () => {
  const initial = deliveryRefreshKey({
    current_submission: { id: "submission-1", updated_at: "2026-10-10T10:00:00.000Z", review_status: "revision_requested" },
  });
  const revised = deliveryRefreshKey({
    current_submission: { id: "submission-1", updated_at: "2026-10-10T11:00:00.000Z", review_status: "pending" },
  });

  assert.notEqual(initial, revised);
});

test("forbidden and missing refreshes revoke the cached workspace", () => {
  assert.equal(shouldClearWorkspaceForStatus(403), true);
  assert.equal(shouldClearWorkspaceForStatus(404), true);
  assert.equal(shouldClearWorkspaceForStatus(500), false);
});
