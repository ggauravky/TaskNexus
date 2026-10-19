/* global document, window */
require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();

const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const childProcess = require("node:child_process");
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

const marker = "phase-d-browser";
const widths = [320, 375, 390, 430, 768, 1024, 1440];
const password = `Tn-QA-${randomBytes(18).toString("base64url")}9aA!`;
const emails = Object.freeze({
  client: `${marker}-client@example.invalid`,
  freelancer: `${marker}-freelancer@example.invalid`,
  admin: `${marker}-admin@example.invalid`,
});
const taskCode = "TSK-PHASE-D-BROWSER";
const skillSlug = "phase-d-browser-skill";
let backendServer;
let frontendProcess;

const trustedIn = (values) => mongoose.trusted({ $in: values });

const cleanup = async () => {
  const users = await models.User.find({ email: trustedIn(Object.values(emails)) }).select("_id").lean();
  const userIds = users.map((row) => String(row._id));
  const tasks = await models.Task.find({ task_id: taskCode }).select("_id").lean();
  const taskIds = tasks.map((row) => String(row._id));
  const skills = await models.Skill.find({ slug: skillSlug }).select("_id").lean();
  const skillIds = skills.map((row) => String(row._id));
  await Promise.all([
    models.Notification.deleteMany({ recipient_id: trustedIn(userIds) }),
    models.AuditLog.deleteMany({ user_id: trustedIn(userIds) }),
    models.Review.deleteMany({ task_id: trustedIn(taskIds) }),
    models.Submission.deleteMany({ task_id: trustedIn(taskIds) }),
    models.Payment.deleteMany({ task_id: trustedIn(taskIds) }),
    models.UserSkill.deleteMany({ $or: mongoose.trusted([{ user_id: trustedIn(userIds) }, { skill_id: trustedIn(skillIds) }]) }),
    models.Task.deleteMany({ _id: trustedIn(taskIds) }),
  ]);
  await Promise.all([
    models.Skill.deleteMany({ _id: trustedIn(skillIds) }),
    models.UserProfile.deleteMany({ _id: trustedIn(userIds) }),
    models.User.deleteMany({ _id: trustedIn(userIds) }),
  ]);
};

const createUser = async (role) => {
  const id = randomUUID();
  await models.User.create({
    _id: id,
    email: emails[role],
    password: await bcrypt.hash(password, 6),
    role,
    profile: { firstName: "Phase D", lastName: role },
    status: "active",
  });
  await models.UserProfile.create({
    _id: id,
    ...(role === "freelancer" ? { username: `${marker}-freelancer`, availability: "unavailable" } : {}),
    visibility: "private",
  });
  return id;
};

const setup = async () => {
  await cleanup();
  return {
    client: await createUser("client"),
    freelancer: await createUser("freelancer"),
    admin: await createUser("admin"),
    task: randomUUID(),
    skill: randomUUID(),
  };
};

const playwright = () => {
  const globalRoot = process.platform === "win32"
    ? path.join(process.env.APPDATA, "npm", "node_modules")
    : childProcess.execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
  return require(path.join(globalRoot, "@playwright", "cli", "node_modules", "playwright"));
};

const waitForUrl = async (url, timeoutMs = 30000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite may be listening before its first transform completes.
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
  frontendProcess = childProcess.spawn(
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

const login = async (page, role) => {
  await page.goto(`${FRONTEND_ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Work email").fill(emails[role]);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL(new RegExp(`/${role}/dashboard`)),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
};

const trackProblems = (page) => {
  const consoleProblems = [];
  const networkProblems = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    const expectedAuthProbe = response.status() === 401
      && ["/api/auth/me", "/api/auth/refresh"].some((pathname) => url.pathname.endsWith(pathname));
    if (response.status() >= 400 && !expectedAuthProbe) networkProblems.push(`${response.status()} ${url.pathname}`);
  });
  return { consoleProblems, networkProblems };
};

const checklist = (page) => page.locator("section[aria-labelledby$='-onboarding-heading']");

const assertResponsiveChecklist = async (page, role) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await checklist(page).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${role} ${width}px overflowed horizontally`);
    for (const link of await checklist(page).getByRole("link").all()) {
      const href = await link.getAttribute("href");
      assert.match(href, /^\/(?:profile|projects|client\/dashboard|freelancer\/dashboard|tasks\/)/, `${role} ${width}px exposed an unsafe action`);
      const box = await link.boundingBox();
      assert.ok(box && box.height >= 44, `${role} ${width}px action is not touch-safe`);
    }
  }
};

const reloadDashboard = async (page) => {
  const refreshButton = page.getByRole("button", { name: "Refresh", exact: true });
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => candidate.textContent.trim() === "Refresh");
    return Boolean(button && !button.disabled);
  });
  const matchesDashboard = (candidate) => (
    candidate.request().method() === "GET"
    && /\/api\/(?:client|freelancer)\/dashboard$/.test(new URL(candidate.url()).pathname)
  );
  let response = null;
  for (let attempt = 0; attempt < 3 && !response; attempt += 1) {
    const pending = page.waitForResponse(matchesDashboard, { timeout: 5000 }).catch(() => null);
    await refreshButton.evaluate((button) => button.click());
    response = await pending;
  }
  assert.ok(response && response.status() < 400, "dashboard refresh failed");
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => candidate.textContent.trim() === "Refresh");
    return Boolean(button && !button.disabled);
  });
};

const verifyClient = async (browser, ids) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, "client");
  const problems = trackProblems(page);
  await page.getByRole("heading", { name: "Set up your client workflow" }).waitFor();
  await assertResponsiveChecklist(page, "client");

  await models.UserProfile.updateOne({ _id: ids.client }, { $set: { username: `${marker}-client` } });
  await models.Task.create({
    _id: ids.task,
    task_id: taskCode,
    client_id: ids.client,
    task_details: { title: "Phase D browser delivery", description: "Disposable Phase D browser QA work" },
    status: "submitted",
  });
  await reloadDashboard(page);
  await checklist(page).waitFor({ state: "detached" });

  await models.Task.updateOne({ _id: ids.task }, { $set: { freelancer_id: ids.freelancer, status: "assigned", "workflow.assignedAt": new Date() } });
  await reloadDashboard(page);
  await page.getByText("Track your first assigned task").waitFor();
  assert.match(await page.getByRole("link", { name: /Open task workspace/ }).getAttribute("href"), new RegExp(`^/tasks/${ids.task}\\?tab=work$`));

  await models.Task.updateOne({ _id: ids.task }, { $set: { status: "in_progress", "workflow.startedAt": new Date() } });
  await reloadDashboard(page);
  await checklist(page).waitFor({ state: "detached" });

  await models.Task.updateOne({ _id: ids.task }, { $set: { status: "delivered", "workflow.submittedAt": new Date() } });
  await reloadDashboard(page);
  await page.getByText("Review your first delivery").waitFor();

  await models.Task.updateOne({ _id: ids.task }, { $set: { status: "completed", "workflow.completedAt": new Date() } });
  await reloadDashboard(page);
  await checklist(page).waitFor({ state: "detached" });
  assert.equal(await models.Review.countDocuments({ task_id: ids.task }), 0, "client onboarding incorrectly required a rating");

  await models.UserProfile.updateOne({ _id: ids.client }, { $unset: { username: "" } });
  await reloadDashboard(page);
  await page.getByText("Complete your identity").waitFor();
  await models.UserProfile.updateOne({ _id: ids.client }, { $set: { username: `${marker}-client` } });
  await reloadDashboard(page);
  await checklist(page).waitFor({ state: "detached" });

  assert.deepEqual(problems.consoleProblems, [], `client console problems: ${problems.consoleProblems.join(" | ")}`);
  assert.deepEqual(problems.networkProblems, [], `client network problems: ${problems.networkProblems.join(" | ")}`);
  await context.close();
};

const setFreelancerFoundation = async (ids) => {
  await models.UserProfile.updateOne({ _id: ids.freelancer }, { $set: {
    headline: "Phase D professional",
    bio: "Professional onboarding browser biography with enough detail to satisfy the canonical profile contract.",
    location: "QA City",
    timezone: "UTC",
    availability: "unavailable",
  } });
  await models.Skill.create({ _id: ids.skill, slug: skillSlug, name: "Phase D Browser Skill", normalized_name: "phase d browser skill", category: "other" });
  await models.UserSkill.create({
    _id: `${ids.freelancer}:${ids.skill}`,
    user_id: ids.freelancer,
    skill_id: ids.skill,
    proficiency: "advanced",
    is_primary: true,
  });
};

const verifyFreelancer = async (browser, ids) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, "freelancer");
  const problems = trackProblems(page);
  await page.getByRole("heading", { name: "Build your freelancer foundation" }).waitFor();
  await page.getByText("Share public project proof").waitFor();
  await page.getByText(/not currently advertising availability/i).waitFor();
  await page.getByLabel("Marketplace task availability").waitFor();
  await assertResponsiveChecklist(page, "freelancer");

  await setFreelancerFoundation(ids);
  await reloadDashboard(page);
  await checklist(page).waitFor({ state: "detached" });

  await models.UserSkill.deleteMany({ user_id: ids.freelancer });
  await reloadDashboard(page);
  await page.getByText("Add a canonical skill").waitFor();
  await models.UserSkill.create({ _id: `${ids.freelancer}:${ids.skill}`, user_id: ids.freelancer, skill_id: ids.skill });
  await reloadDashboard(page);
  await checklist(page).waitFor({ state: "detached" });

  await models.UserProfile.updateOne({ _id: ids.freelancer }, { $unset: { headline: "" } });
  await reloadDashboard(page);
  await page.getByText("Share public project proof").waitFor();
  await models.UserProfile.updateOne({ _id: ids.freelancer }, { $set: { headline: "Phase D professional" } });
  await reloadDashboard(page);
  await checklist(page).waitFor({ state: "detached" });

  assert.deepEqual(problems.consoleProblems, [], `freelancer console problems: ${problems.consoleProblems.join(" | ")}`);
  assert.deepEqual(problems.networkProblems, [], `freelancer network problems: ${problems.networkProblems.join(" | ")}`);
  await context.close();
};

const verifyAdminExcluded = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await login(page, "admin");
  const problems = trackProblems(page);
  assert.equal(await checklist(page).count(), 0, "admin dashboard rendered role onboarding");
  assert.deepEqual(problems.consoleProblems, []);
  assert.deepEqual(problems.networkProblems, []);
  await context.close();
};

const runQa = async () => {
  process.stdout.write("Phase D browser QA: preparing disposable fixtures.\n");
  const ids = await setup();
  await startServers();
  const { chromium } = playwright();
  const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  try {
    await verifyClient(browser, ids);
    process.stdout.write(`Phase D browser QA: client checks passed at ${widths.join(", ")} px.\n`);
    await verifyFreelancer(browser, ids);
    process.stdout.write(`Phase D browser QA: freelancer checks passed at ${widths.join(", ")} px.\n`);
    await verifyAdminExcluded(browser);
  } finally {
    await browser.close();
  }
  process.stdout.write("Phase D browser QA passed: progressive applicability, reversible prerequisites, privacy, accessibility, and clean console/network.\n");
};

const run = async () => {
  await connectDatabase();
  process.stdout.write(`Phase D browser QA: connected to guarded database ${databaseName()}.\n`);
  try {
    const mode = process.argv[2];
    if (mode === "cleanup") {
      await cleanup();
      process.stdout.write(`Phase D browser fixtures cleaned from ${databaseName()}.\n`);
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
  process.stderr.write(`Phase D browser QA failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
