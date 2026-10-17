import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("authenticated AppShell owns one trigger, one palette, and a Ctrl/Cmd+K lifecycle", async () => {
  const appShell = await source("../src/components/layout/AppShell.jsx");
  assert.match(appShell, /import SearchTrigger from "\.\.\/search\/SearchTrigger"/);
  assert.match(appShell, /import CommandPalette from "\.\.\/search\/CommandPalette"/);
  assert.match(appShell, /isAuthenticated \? <SearchTrigger/);
  assert.match(appShell, /isAuthenticated && paletteOpen \? \(/);
  assert.match(appShell, /event\.(ctrlKey|metaKey)/);
  assert.match(appShell, /event\.key\.toLowerCase\(\) === "k"/);
  assert.match(appShell, /document\.addEventListener\("keydown", openPalette\)/);
  assert.match(appShell, /document\.removeEventListener\("keydown", openPalette\)/);
  assert.match(appShell, /paletteTriggerRef\.current\?\.focus\(\)/);
  assert.match(appShell, /<SearchTrigger ref=\{paletteTriggerRef\}/);
});

test("search trigger and palette expose the required keyboard and listbox semantics", async () => {
  const [trigger, palette, group] = await Promise.all([
    source("../src/components/search/SearchTrigger.jsx"),
    source("../src/components/search/CommandPalette.jsx"),
    source("../src/components/search/SearchResultGroup.jsx"),
  ]);
  assert.match(trigger, /aria-keyshortcuts="Control\+K Meta\+K"/);
  assert.match(trigger, /aria-label="Search TaskNexus"/);
  assert.match(trigger, /navigator\.platform/);
  assert.match(palette, /<Dialog/);
  assert.match(palette, /role="combobox"/);
  assert.match(palette, /aria-controls="command-palette-listbox"/);
  assert.match(palette, /aria-activedescendant=/);
  assert.match(palette, /aria-live="polite"/);
  assert.match(palette, /nextPaletteIndex/);
  assert.match(palette, /useGlobalSearch/);
  assert.match(palette, /const actions = useMemo\(/);
  assert.match(palette, /autoFocus/);
  assert.match(group, /role="group"/);
  assert.match(group, /role="option"/);
});

test("dashboard quick actions are parsed from allowlisted URL state", async () => {
  const [client, freelancer] = await Promise.all([
    source("../src/pages/ClientDashboard.jsx"),
    source("../src/pages/FreelancerDashboard.jsx"),
  ]);
  assert.match(client, /parseDashboardCommand/);
  assert.match(client, /action === "create-task"/);
  assert.match(client, /replace: true/);
  assert.match(freelancer, /parseDashboardCommand/);
  assert.match(freelancer, /setView\(command\.view\)/);
});
