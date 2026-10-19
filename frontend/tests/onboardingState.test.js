import test from "node:test";
import assert from "node:assert/strict";
import { onboardingView, safeOnboardingTarget } from "../src/utils/onboarding.js";

const item = (id, overrides = {}) => ({
  id,
  label: id,
  description: `${id} description`,
  applicable: true,
  complete: false,
  action: { label: "Continue", target_path: "/profile" },
  ...overrides,
});

test("keeps authoritative counts and stable order while filtering non-applicable items", () => {
  const result = onboardingView({
    role: "client",
    is_complete: false,
    completed_count: 1,
    total_count: 2,
    items: [item("identity", { complete: true }), item("future", { applicable: false }), item("task")],
    optional_items: [],
  });

  assert.deepEqual(result.items.map(({ id }) => id), ["identity", "task"]);
  assert.equal(result.completedCount, 1);
  assert.equal(result.totalCount, 2);
});

test("returns no checklist for complete, missing, or unsupported summaries", () => {
  assert.equal(onboardingView(null), null);
  assert.equal(onboardingView({ role: "admin", is_complete: false }), null);
  assert.equal(onboardingView({ role: "client", is_complete: true }), null);
});

test("allows only exact onboarding routes and UUID task workspace tabs", () => {
  const uuid = "123e4567-e89b-42d3-a456-426614174000";
  for (const target of [
    "/profile",
    "/projects",
    "/client/dashboard?action=create-task",
    "/client/dashboard?view=tasks",
    "/client/dashboard?view=deliveries",
    "/freelancer/dashboard?view=available",
    "/freelancer/dashboard?view=work",
    `/tasks/${uuid}?tab=work`,
    `/tasks/${uuid}?tab=delivery`,
  ]) assert.equal(safeOnboardingTarget(target), target);

  for (const target of [
    "https://example.com",
    "//example.com",
    "/%2f%2fevil.example",
    "/profile/../admin",
    `/tasks/${uuid}?tab=discussion`,
    "/tasks/not-a-uuid?tab=work",
  ]) assert.equal(safeOnboardingTarget(target), null);
});

test("drops malformed actions without recalculating backend completion", () => {
  const result = onboardingView({
    role: "freelancer",
    is_complete: false,
    completed_count: 3,
    total_count: 4,
    items: [item("profile", { action: { label: "Bad", target_path: "javascript:alert(1)" } })],
    optional_items: [item("proof", { optional: true, action: { label: "Proof", target_path: "/projects" } })],
  });
  assert.equal(result.completedCount, 3);
  assert.equal(result.items[0].action, null);
  assert.equal(result.optionalItems[0].action.targetPath, "/projects");
});
