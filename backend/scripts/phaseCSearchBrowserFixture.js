/* global document, window */
require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();

const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const { randomBytes, randomUUID } = require("node:crypto");
const path = require("node:path");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const FRONTEND_ORIGIN = "http://127.0.0.1:5174";
process.env.APP_ORIGIN = FRONTEND_ORIGIN;
process.env.ALLOWED_ORIGINS = FRONTEND_ORIGIN;
process.env.EMAIL_ENABLED = "false";

const app = require("../src/app");
const { connectDatabase, disconnectDatabase, databaseName } = require("../src/config/database");
const models = require("../src/models");

const marker = "phase-c-browser";
const query = "Phase C Browser";
const widths = [320, 375, 390, 430, 768, 1024, 1440];
const password = `Tn-QA-${randomBytes(18).toString("base64url")}9aA!`;
const accountEmails = Object.freeze({
  client: `${marker}-client@example.invalid`,
  freelancer: `${marker}-freelancer@example.invalid`,
  admin: `${marker}-admin@example.invalid`,
  privatePerson: `${marker}-private-person@example.invalid`,
  outsider: `${marker}-outsider@example.invalid`,
  ...Object.fromEntries(Array.from({ length: 6 }, (_, index) => [
    `person${index + 1}`,
    `${marker}-person-${index + 1}@example.invalid`,
  ])),
});
const teamSlugs = Array.from({ length: 6 }, (_, index) => `${marker}-team-${index + 1}`);
const projectSlugs = Array.from({ length: 6 }, (_, index) => `${marker}-project-${index + 1}`);
const hackathonSlugs = Array.from({ length: 6 }, (_, index) => `${marker}-hackathon-${index + 1}`);
const organizationSlugs = Array.from({ length: 6 }, (_, index) => `${marker}-organization-${index + 1}`);
const opportunitySlugs = Array.from({ length: 6 }, (_, index) => `${marker}-opportunity-${index + 1}`);
const privateTeamSlug = `${marker}-private-team`;
const privateProjectSlug = `${marker}-private-project`;
const privateHackathonSlug = `${marker}-private-hackathon`;
const inactiveOrganizationSlug = `${marker}-inactive-organization`;
const closedOpportunitySlug = `${marker}-closed-opportunity`;
const taskIdPrefix = "TSK-PHASE-C-BROWSER-";
const trustedIn = (values) => mongoose.trusted({ $in: values });

let backendServer;
let frontendProcess;

const cleanup = async () => {
  const users = await models.User.find({ email: trustedIn(Object.values(accountEmails)) }).select("_id").lean();
  const userIds = users.map((row) => String(row._id));
  const teams = await models.Team.find({
    slug: trustedIn([...teamSlugs, privateTeamSlug]),
  }).select("_id").lean();
  const teamIds = teams.map((row) => String(row._id));
  const projects = await models.Project.find({
    slug: trustedIn([...projectSlugs, privateProjectSlug]),
  }).select("_id").lean();
  const projectIds = projects.map((row) => String(row._id));
  const organizations = await models.Organization.find({
    slug: trustedIn([...organizationSlugs, inactiveOrganizationSlug]),
  }).select("_id").lean();
  const organizationIds = organizations.map((row) => String(row._id));
  const opportunities = await models.Opportunity.find({
    slug: trustedIn([...opportunitySlugs, closedOpportunitySlug]),
  }).select("_id").lean();
  const opportunityIds = opportunities.map((row) => String(row._id));
  const tasks = await models.Task.find({
    task_id: mongoose.trusted({ $regex: `^${taskIdPrefix}` }),
  }).select("_id").lean();
  const taskIds = tasks.map((row) => String(row._id));

  await Promise.all([
    models.Notification.deleteMany({
      $or: mongoose.trusted([
        { recipient_id: trustedIn(userIds) },
        { actor_id: trustedIn(userIds) },
        { related_task_id: trustedIn(taskIds) },
      ]),
    }),
    models.AuditLog.deleteMany({
      $or: mongoose.trusted([
        { user_id: trustedIn(userIds) },
        { resource_id: trustedIn([...teamIds, ...projectIds, ...organizationIds, ...opportunityIds, ...taskIds]) },
      ]),
    }),
    models.TeamMembership.deleteMany({ team_id: trustedIn(teamIds) }),
    models.ProjectParticipant.deleteMany({ project_id: trustedIn(projectIds) }),
    models.ProjectTask.deleteMany({ project_id: trustedIn(projectIds) }),
    models.Task.deleteMany({ _id: trustedIn(taskIds) }),
    models.Hackathon.deleteMany({ slug: trustedIn([...hackathonSlugs, privateHackathonSlug]) }),
    models.Opportunity.deleteMany({ _id: trustedIn(opportunityIds) }),
  ]);
  await models.Project.deleteMany({ _id: trustedIn(projectIds) });
  await models.Team.deleteMany({ _id: trustedIn(teamIds) });
  await models.Organization.deleteMany({ _id: trustedIn(organizationIds) });
  await Promise.all([
    models.UserBlock.deleteMany({
      $or: mongoose.trusted([
        { blocker_id: trustedIn(userIds) },
        { blocked_user_id: trustedIn(userIds) },
      ]),
    }),
    models.UserProfile.deleteMany({ _id: trustedIn(userIds) }),
    models.User.deleteMany({ _id: trustedIn(userIds) }),
  ]);
};

const createUser = async (label, role, { visibility = "private", discoverable = false } = {}) => {
  const id = randomUUID();
  await models.User.create({
    _id: id,
    email: accountEmails[label],
    password: await bcrypt.hash(password, 6),
    role,
    profile: { firstName: "Phase C", lastName: label },
    status: "active",
  });
  await models.UserProfile.create({
    _id: id,
    username: `${marker}-${label}`,
    headline: `${query} ${visibility === "public" ? "public" : "private"} ${label}`,
    visibility,
    discoverable,
    availability: discoverable ? "open" : "unavailable",
  });
  return id;
};

const setup = async () => {
  await cleanup();
  const ids = {
    client: await createUser("client", "client"),
    freelancer: await createUser("freelancer", "freelancer"),
    admin: await createUser("admin", "admin"),
    privatePerson: await createUser("privatePerson", "freelancer", { visibility: "private", discoverable: true }),
    outsider: await createUser("outsider", "freelancer"),
  };
  for (let index = 1; index <= 6; index += 1) {
    ids[`person${index}`] = await createUser(`person${index}`, "freelancer", {
      visibility: "public",
      discoverable: true,
    });
  }

  const teamIds = Array.from({ length: 6 }, () => randomUUID());
  const privateTeamId = randomUUID();
  await models.Team.insertMany([
    ...teamIds.map((id, index) => ({
      _id: id,
      name: `${query} Team ${index + 1}`,
      slug: teamSlugs[index],
      created_by: ids.client,
      owner_id: ids.client,
      visibility: "public",
      status: "active",
    })),
    {
      _id: privateTeamId,
      name: `${query} Private Team`,
      slug: privateTeamSlug,
      created_by: ids.client,
      owner_id: ids.client,
      visibility: "private",
      status: "active",
    },
  ]);

  const projectIds = Array.from({ length: 6 }, () => randomUUID());
  const privateProjectId = randomUUID();
  await models.Project.insertMany([
    ...projectIds.map((id, index) => ({
      _id: id,
      team_id: teamIds[index],
      name: `${query} Project ${index + 1}`,
      slug: projectSlugs[index],
      created_by: ids.client,
      visibility: "public",
      status: "active",
    })),
    {
      _id: privateProjectId,
      team_id: privateTeamId,
      name: `${query} Private Project`,
      slug: privateProjectSlug,
      created_by: ids.client,
      visibility: "public",
      status: "active",
    },
  ]);

  const now = Date.now();
  await models.Hackathon.insertMany([
    ...hackathonSlugs.map((slug, index) => ({
      _id: randomUUID(),
      name: `${query} Hackathon ${index + 1}`,
      slug,
      organizer_name: "TaskNexus QA",
      mode: "online",
      event_start: new Date(now + 86400000),
      event_end: new Date(now + 172800000),
      status: "upcoming",
      visibility: "public",
      created_by: ids.admin,
    })),
    {
      _id: randomUUID(),
      name: `${query} Private Hackathon`,
      slug: privateHackathonSlug,
      organizer_name: "TaskNexus QA",
      mode: "online",
      event_start: new Date(now + 86400000),
      event_end: new Date(now + 172800000),
      status: "upcoming",
      visibility: "private",
      created_by: ids.admin,
    },
  ]);

  const organizationIds = Array.from({ length: 6 }, () => randomUUID());
  const inactiveOrganizationId = randomUUID();
  await models.Organization.insertMany([
    ...organizationIds.map((id, index) => ({
      _id: id,
      name: `${query} Organization ${index + 1}`,
      slug: organizationSlugs[index],
      organization_type: "startup",
      status: "active",
      created_by: ids.admin,
    })),
    {
      _id: inactiveOrganizationId,
      name: `${query} Inactive Organization`,
      slug: inactiveOrganizationSlug,
      organization_type: "startup",
      status: "archived",
      created_by: ids.admin,
    },
  ]);
  await models.Opportunity.insertMany([
    ...organizationIds.map((organizationId, index) => ({
      _id: randomUUID(),
      organization_id: organizationId,
      type: "internship",
      title: `${query} Opportunity ${index + 1}`,
      slug: opportunitySlugs[index],
      work_mode: "remote",
      application_mode: "external",
      application_url: "https://example.com/apply",
      status: "published",
      source_type: "official",
      published_at: new Date(),
      created_by: ids.admin,
    })),
    {
      _id: randomUUID(),
      organization_id: inactiveOrganizationId,
      type: "internship",
      title: `${query} Closed Opportunity`,
      slug: closedOpportunitySlug,
      work_mode: "remote",
      application_mode: "external",
      application_url: "https://example.com/closed",
      status: "closed",
      source_type: "official",
      published_at: new Date(),
      created_by: ids.admin,
    },
  ]);

  const taskIds = Array.from({ length: 8 }, () => randomUUID());
  await models.Task.insertMany([
    ...taskIds.slice(0, 6).map((id, index) => ({
      _id: id,
      task_id: `${taskIdPrefix}${index + 1}`,
      client_id: ids.client,
      freelancer_id: index === 0 ? ids.freelancer : null,
      task_details: { title: `${query} Marketplace Task ${index + 1}`, description: "Disposable browser QA task" },
      status: index === 0 ? "in_progress" : "submitted",
    })),
    {
      _id: taskIds[6],
      task_id: `${taskIdPrefix}UNRELATED`,
      client_id: ids.privatePerson,
      freelancer_id: ids.outsider,
      task_details: { title: `${query} Unrelated Marketplace Task` },
      status: "in_progress",
    },
  ]);
  await models.ProjectTask.create({
    _id: taskIds[7],
    team_id: teamIds[0],
    project_id: projectIds[0],
    title: `${query} ProjectTask Must Stay Separate`,
    status: "todo",
    priority: "medium",
    created_by: ids.client,
  });

  return ids;
};

const playwright = () => {
  const globalRoot = process.platform === "win32"
    ? path.join(process.env.APPDATA, "npm", "node_modules")
    : execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  return require(path.join(globalRoot, "@playwright", "cli", "node_modules", "playwright"));
};

const waitForUrl = async (url, timeoutMs = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process can be listening before the first Vite transform completes.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const startServers = async () => {
  backendServer = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    backendServer.once("listening", resolve);
    backendServer.once("error", reject);
  });
  const backendOrigin = `http://127.0.0.1:${backendServer.address().port}`;
  const viteEntry = path.resolve(__dirname, "../../frontend/node_modules/vite/bin/vite.js");
  frontendProcess = spawn(
    process.execPath,
    [viteEntry, "--host", "127.0.0.1", "--port", "5174", "--strictPort"],
    {
      cwd: path.resolve(__dirname, "../../frontend"),
      env: { ...process.env, VITE_API_URL: `${backendOrigin}/api`, VITE_SITE_URL: FRONTEND_ORIGIN },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let startupError = "";
  frontendProcess.stderr.on("data", (chunk) => { startupError += chunk.toString(); });
  frontendProcess.once("exit", (code) => {
    if (code && !startupError) startupError = `Vite exited with code ${code}`;
  });
  try {
    await waitForUrl(FRONTEND_ORIGIN);
  } catch (error) {
    throw new Error(`${error.message}${startupError ? `: ${startupError.trim()}` : ""}`);
  }
};

const stopServers = async () => {
  if (frontendProcess && frontendProcess.exitCode == null) {
    frontendProcess.kill();
    await new Promise((resolve) => {
      frontendProcess.once("exit", resolve);
      setTimeout(resolve, 3000).unref();
    });
  }
  if (backendServer) await new Promise((resolve) => backendServer.close(resolve));
};

const emptyGroups = () => ({
  teams: [], projects: [], people: [], hackathons: [], opportunities: [], organizations: [], tasks: [],
});

const payload = (searchQuery, groups = emptyGroups()) => ({
  success: true,
  data: { query: searchQuery, groups },
});

const login = async (page, role) => {
  await page.goto(`${FRONTEND_ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Work email").fill(accountEmails[role]);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL(new RegExp(`/${role}/dashboard`)),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await page.getByRole("button", { name: "Search TaskNexus" }).waitFor();
};

const openPalette = async (page) => {
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  const input = page.getByRole("combobox", { name: "Search TaskNexus" });
  await input.waitFor();
  await assert.doesNotReject(async () => assert.equal(await input.evaluate((element) => element === document.activeElement), true));
  return input;
};

const searchFromPalette = async (page, searchQuery) => {
  const input = page.getByRole("combobox", { name: "Search TaskNexus" });
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith("/api/search") && url.searchParams.get("q") === searchQuery;
  });
  await input.fill(searchQuery);
  const response = await responsePromise;
  assert.equal(response.status(), 200, `Search returned ${response.status()}`);
  const body = await response.json();
  await page.getByText(/search results?$/).waitFor();
  return body.data.groups;
};

const verifyResponsiveRole = async (browser, role) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleProblems = [];
  const networkProblems = [];
  await login(page, role);
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    const expectedAnonymousAuth = response.status() === 401
      && ["/api/auth/me", "/api/auth/refresh"].some((pathName) => url.pathname.endsWith(pathName));
    const intentionalError = response.status() === 500 && url.searchParams.get("q") === "phasec-error";
    if (response.status() >= 400 && !expectedAnonymousAuth && !intentionalError) {
      networkProblems.push(`${response.status()} ${url.pathname}${url.search}`);
    }
  });
  let commonGroups;
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    const trigger = page.getByRole("button", { name: "Search TaskNexus" });
    await trigger.waitFor();
    const box = await trigger.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, `${role} ${width}px trigger is not touch-safe`);
    const input = await openPalette(page);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${role} ${width}px overflows horizontally`);
    const responseGroups = await searchFromPalette(page, query);
    commonGroups ||= responseGroups;
    for (const [group, rows] of Object.entries(responseGroups)) {
      assert.ok(rows.length <= 5, `${role} ${width}px ${group} exceeded five rows`);
    }
    await input.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached" });
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true, `${role} ${width}px did not restore focus`);
  }

  assert.equal(commonGroups.teams.length, 5);
  assert.equal(commonGroups.projects.length, 5);
  assert.equal(commonGroups.people.length, 5);
  assert.equal(commonGroups.hackathons.length, 5);
  assert.equal(commonGroups.opportunities.length, 5);
  assert.equal(commonGroups.organizations.length, 5);
  if (role === "client" || role === "admin") assert.equal(commonGroups.tasks.length, 5);
  if (role === "freelancer") {
    assert.deepEqual(commonGroups.tasks.map((row) => row.title), [`${query} Marketplace Task 1`]);
  }
  assert.equal(Object.values(commonGroups).flat().some((row) => row.title.includes("ProjectTask")), false);
  if (role !== "admin") {
    assert.equal(Object.values(commonGroups).flat().some((row) => row.title.includes("Unrelated Marketplace")), false);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const input = await openPalette(page);
  const roleAction = { client: "Create task", freelancer: "My work", admin: "Admin dashboard" }[role];
  await page.getByRole("option", { name: new RegExp(`^${roleAction}`) }).waitFor();
  await input.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "option", `${role} focus trap did not wrap backward`);
  await page.keyboard.press("Tab");
  assert.equal(await input.evaluate((element) => element === document.activeElement), true, `${role} focus trap did not wrap forward`);
  await input.press("End");
  assert.match(await input.getAttribute("aria-activedescendant"), /^command-option-\d+$/);
  await input.press("Home");
  assert.equal(await input.getAttribute("aria-activedescendant"), "command-option-0");
  await page.mouse.click(2, 2);
  await page.getByRole("dialog").waitFor({ state: "detached" });

  for (const privateSearch of [`${query} Private Team`, `${query} Private Project`]) {
    await openPalette(page);
    const groups = await searchFromPalette(page, privateSearch);
    assert.equal(groups.teams.length, 0, `${role} received a private Team`);
    assert.equal(groups.projects.length, 0, `${role} received a private Project`);
    await page.keyboard.press("Escape");
  }

  assert.deepEqual(consoleProblems, [], `${role} console problems: ${consoleProblems.join(" | ")}`);
  assert.deepEqual(networkProblems, [], `${role} network problems: ${networkProblems.join(" | ")}`);
  await context.close();
};

const verifyAsyncStates = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, "client");
  const requestCounts = new Map();
  await page.route("**/api/search?*", async (route) => {
    const searchQuery = new URL(route.request().url()).searchParams.get("q");
    requestCounts.set(searchQuery, (requestCounts.get(searchQuery) || 0) + 1);
    if (searchQuery === "phasec-error") {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "Controlled search failure" } }) });
      return;
    }
    if (searchQuery === "phasec-loading") {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload(searchQuery)) });
      return;
    }
    if (searchQuery === "phasec-slow") {
      await new Promise((resolve) => setTimeout(resolve, 650));
      try {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(payload(searchQuery, {
            ...emptyGroups(),
            teams: [{ id: randomUUID(), type: "team", title: "Stale result", subtitle: null, status: "active", target_path: `/teams/${teamSlugs[0]}` }],
          })),
        });
      } catch {
        // A cancelled request is the expected client behavior.
      }
      return;
    }
    if (searchQuery === "phasec-fast") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload(searchQuery, {
          ...emptyGroups(),
          teams: [{ id: randomUUID(), type: "team", title: "Newest result", subtitle: null, status: "active", target_path: `/teams/${teamSlugs[0]}` }],
        })),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload(searchQuery)) });
  });

  let input = await openPalette(page);
  await input.fill("phasec-loading");
  await page.locator(".animate-pulse").first().waitFor();
  await page.getByText("No results found").waitFor();
  await input.fill("phasec-error");
  await page.getByRole("alert").getByText("Search is temporarily unavailable. Try again.").waitFor();
  await page.getByRole("button", { name: "Try again" }).waitFor();
  const emptyResponse = page.waitForResponse((response) => (
    new URL(response.url()).searchParams.get("q") === "phasec-empty"
  ));
  await input.fill("phasec-empty");
  await emptyResponse;
  await page.getByText("No results found").waitFor();
  assert.equal(requestCounts.get("phasec-empty"), 1, "one debounced query issued duplicate requests");

  await input.fill("phasec-slow");
  await page.waitForTimeout(350);
  await input.fill("phasec-fast");
  await page.getByRole("option", { name: /^Newest result/ }).waitFor();
  await page.waitForTimeout(700);
  assert.equal(await page.getByText("Stale result").count(), 0, "a stale response replaced the newest result");
  assert.equal(await page.getByRole("alert").count(), 0, "an aborted request leaked an error state");
  await page.keyboard.press("Escape");
  await page.unroute("**/api/search?*");

  input = await openPalette(page);
  await searchFromPalette(page, `${query} Team 1`);
  await page.getByRole("option", { name: new RegExp(`^${query} Team 1`) }).click();
  await page.waitForURL(new RegExp(`/teams/${teamSlugs[0]}$`));
  assert.equal(new URL(page.url()).origin, FRONTEND_ORIGIN, "result navigation escaped the application origin");
  await context.close();
};

const runQa = async () => {
  process.stdout.write("Phase C browser QA: preparing disposable fixtures.\n");
  await setup();
  process.stdout.write("Phase C browser QA: fixtures ready; starting local application.\n");
  await startServers();
  const { chromium } = playwright();
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  });
  process.stdout.write("Phase C browser QA: Chromium ready.\n");
  try {
    for (const role of ["client", "freelancer", "admin"]) {
      await verifyResponsiveRole(browser, role);
      process.stdout.write(`Phase C browser QA: ${role} responsive and privacy checks passed.\n`);
    }
    await verifyAsyncStates(browser);
    process.stdout.write("Phase C browser QA: async-state and navigation checks passed.\n");
  } finally {
    await browser.close();
  }
  process.stdout.write(`Phase C browser QA passed for client, freelancer, and admin at ${widths.join(", ")} px.\n`);
};

const run = async () => {
  await connectDatabase();
  process.stdout.write(`Phase C browser QA: connected to guarded database ${databaseName()}.\n`);
  try {
    const mode = process.argv[2];
    if (mode === "cleanup") {
      await cleanup();
      process.stdout.write(`Phase C browser fixtures cleaned from ${databaseName()}.\n`);
      return;
    }
    if (mode !== "qa") throw new Error("Use qa or cleanup mode");
    await runQa();
  } finally {
    await stopServers();
    await cleanup();
    await disconnectDatabase();
  }
};

run().catch((error) => {
  process.stderr.write(`Phase C browser QA failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
