import test from "node:test";
import assert from "node:assert/strict";

import {
  SEARCH_GROUP_ORDER,
  flattenPaletteOptions,
  nextPaletteIndex,
  parseDashboardCommand,
  quickActionsFor,
  safeCommandTarget,
} from "../src/utils/commandPalette.js";

test("quick actions are role-specific and unknown roles get none", () => {
  assert.ok(quickActionsFor("client").some((item) => item.target === "/client/dashboard?action=create-task"));
  assert.ok(quickActionsFor("freelancer").some((item) => item.target === "/freelancer/dashboard?view=available"));
  assert.ok(quickActionsFor("admin").some((item) => item.target === "/admin/users"));
  assert.deepEqual(quickActionsFor("unknown"), []);
});

test("flattening preserves group order, caps each domain at five, and omits unsafe rows", () => {
  assert.deepEqual(SEARCH_GROUP_ORDER, ["teams", "projects", "people", "hackathons", "opportunities", "organizations", "tasks"]);
  const actions = [{ id: "action", title: "Profile", target: "/profile" }];
  const rows = Array.from({ length: 7 }, (_, index) => ({
    id: `team-${index}`, type: "team", title: `Team ${index}`, target_path: `/teams/team-${index}`,
  }));
  const options = flattenPaletteOptions(actions, {
    tasks: [{ id: "task", type: "marketplace_task", title: "Task", target_path: "/tasks/00000000-0000-4000-8000-000000000101" }],
    teams: [...rows, { id: "evil", title: "Evil", target_path: "https://evil.example" }],
  });
  assert.equal(options[0].kind, "action");
  assert.equal(options.filter((item) => item.group === "teams").length, 5);
  assert.equal(options.at(-1).group, "tasks");
  assert.equal(options.some((item) => item.id === "evil"), false);
});

test("safe targets allow only approved internal route shapes", () => {
  for (const target of [
    "/teams/react-builders",
    "/teams/react-builders/projects/task-nexus",
    "/u/ada_lovelace",
    "/hackathons/build-week",
    "/opportunities/react-engineer",
    "/organizations/open-labs",
    "/tasks/00000000-0000-4000-8000-000000000101",
    "/client/dashboard?action=create-task",
    "/freelancer/dashboard?view=work",
    "/admin/analytics",
    "/notifications",
  ]) assert.equal(safeCommandTarget(target), target);

  for (const target of [
    "https://evil.example", "//evil.example", "javascript:alert(1)", "/teams/a\\admin",
    "/teams/a%2fadmin", "/tasks/not-a-uuid", "/client/dashboard?view=admin", "/unknown", "/profile\n/evil",
  ]) assert.equal(safeCommandTarget(target), null);
});

test("keyboard index movement wraps and handles empty lists", () => {
  assert.equal(nextPaletteIndex(-1, "ArrowDown", 3), 0);
  assert.equal(nextPaletteIndex(2, "ArrowDown", 3), 0);
  assert.equal(nextPaletteIndex(0, "ArrowUp", 3), 2);
  assert.equal(nextPaletteIndex(1, "Home", 3), 0);
  assert.equal(nextPaletteIndex(1, "End", 3), 2);
  assert.equal(nextPaletteIndex(1, "Enter", 3), 1);
  assert.equal(nextPaletteIndex(0, "ArrowDown", 0), -1);
});

test("dashboard commands accept only role allowlists", () => {
  assert.deepEqual(parseDashboardCommand(new URLSearchParams("view=tasks&action=create-task"), "client"), { view: "tasks", action: "create-task" });
  assert.deepEqual(parseDashboardCommand(new URLSearchParams("view=admin&action=delete-all"), "client"), { view: "overview", action: null });
  assert.deepEqual(parseDashboardCommand(new URLSearchParams("view=available"), "freelancer"), { view: "available", action: null });
  assert.deepEqual(parseDashboardCommand(new URLSearchParams("view=tasks"), "freelancer"), { view: "overview", action: null });
});
