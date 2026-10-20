/* global document, window */
require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();

const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const childProcess = require("node:child_process");
const path = require("node:path");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

const FRONTEND_ORIGIN = "http://127.0.0.1:5175";
process.env.APP_ORIGIN = FRONTEND_ORIGIN;
process.env.ALLOWED_ORIGINS = FRONTEND_ORIGIN;
process.env.EMAIL_ENABLED = "false";

const app = require("../src/app");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const marker = "phase-e-browser";
const widths = [320, 375, 390, 430, 768, 1024, 1440];
const password = `Tn-PhaseE-QA-${randomBytes(18).toString("base64url")}9aA!`;
const emails = Object.freeze({
  candidate: `${marker}-candidate@example.invalid`,
  other: `${marker}-other@example.invalid`,
});
const slugs = Object.freeze({
  skill: `${marker}-skill`, team: `${marker}-team`, project: `${marker}-project`,
  organization: `${marker}-organization`, opportunity: `${marker}-opportunity`,
});
let backendServer;
let frontendProcess;

const trustedIn = (values) => mongoose.trusted({ $in: values });

const fixtureRows = async () => {
  const users = await models.User.find({ email: trustedIn(Object.values(emails)) }).select("_id").lean();
  const teams = await models.Team.find({ slug: slugs.team }).select("_id").lean();
  const projects = await models.Project.find({ slug: slugs.project }).select("_id").lean();
  const organizations = await models.Organization.find({ slug: slugs.organization }).select("_id").lean();
  const opportunities = await models.Opportunity.find({ slug: slugs.opportunity }).select("_id").lean();
  const skills = await models.Skill.find({ slug: slugs.skill }).select("_id").lean();
  const applications = await models.NativeApplication.find({ opportunity_id: trustedIn(opportunities.map((row) => row._id)) }).select("_id").lean();
  return {
    users: users.map((row) => String(row._id)), teams: teams.map((row) => String(row._id)),
    projects: projects.map((row) => String(row._id)), organizations: organizations.map((row) => String(row._id)),
    opportunities: opportunities.map((row) => String(row._id)), skills: skills.map((row) => String(row._id)),
    applications: applications.map((row) => String(row._id)),
  };
};

const cleanup = async () => {
  const rows = await fixtureRows();
  await Promise.all([
    models.ApplicationActivity.deleteMany({ application_id: trustedIn(rows.applications) }),
    models.Notification.deleteMany({ $or: mongoose.trusted([
      { recipient_id: trustedIn(rows.users) }, { actor_id: trustedIn(rows.users) },
      { entity_id: trustedIn([...rows.applications, ...rows.projects, ...rows.opportunities]) },
    ]) }),
    models.AuditLog.deleteMany({ $or: mongoose.trusted([
      { user_id: trustedIn(rows.users) }, { resource_id: trustedIn([...rows.organizations, ...rows.applications]) },
    ]) }),
  ]);
  await Promise.all([
    models.NativeApplication.deleteMany({ _id: trustedIn(rows.applications) }),
    models.OpportunityCandidateState.deleteMany({ opportunity_id: trustedIn(rows.opportunities) }),
    models.OrganizationMembership.deleteMany({ organization_id: trustedIn(rows.organizations) }),
    models.ProjectShowcase.deleteMany({ project_id: trustedIn(rows.projects) }),
    models.ContributionEvidence.deleteMany({ project_id: trustedIn(rows.projects) }),
    models.ProjectParticipant.deleteMany({ project_id: trustedIn(rows.projects) }),
    models.TeamMembership.deleteMany({ team_id: trustedIn(rows.teams) }),
    models.UserSkill.deleteMany({ user_id: trustedIn(rows.users) }),
  ]);
  await Promise.all([
    models.Opportunity.deleteMany({ _id: trustedIn(rows.opportunities) }),
    models.Organization.deleteMany({ _id: trustedIn(rows.organizations) }),
    models.Project.deleteMany({ _id: trustedIn(rows.projects) }),
    models.Team.deleteMany({ _id: trustedIn(rows.teams) }),
    models.Skill.deleteMany({ _id: trustedIn(rows.skills) }),
    models.UserProfile.deleteMany({ _id: trustedIn(rows.users) }),
    models.User.deleteMany({ _id: trustedIn(rows.users) }),
  ]);
};

const createUser = async (label) => {
  const id = randomUUID();
  await models.User.create({
    _id: id, email: emails[label], password: await bcrypt.hash(password, 6), role: "freelancer",
    profile: { firstName: "Phase E", lastName: label }, status: "active",
  });
  await models.UserProfile.create({
    _id: id, username: `${marker}-${label}`, headline: `${label} proof professional`,
    visibility: "public", availability: "open", discoverable: true,
  });
  return id;
};

const setup = async () => {
  await cleanup();
  const ids = {
    candidate: await createUser("candidate"), other: await createUser("other"),
    skill: randomUUID(), team: randomUUID(), project: randomUUID(), showcase: randomUUID(),
    organization: randomUUID(), opportunity: randomUUID(), evidence: [randomUUID(), randomUUID()],
  };
  await models.Skill.create({ _id: ids.skill, slug: slugs.skill, name: "Phase E Systems", normalized_name: "phase e systems", category: "quality", is_active: true });
  await models.UserSkill.create({ _id: randomUUID(), user_id: ids.candidate, skill_id: ids.skill, proficiency: "advanced", is_primary: true });
  await models.Team.create({ _id: ids.team, name: "Phase E Browser Team", slug: slugs.team, created_by: ids.candidate, owner_id: ids.candidate, visibility: "public", join_policy: "invite_only", status: "active" });
  await models.TeamMembership.create({ _id: randomUUID(), team_id: ids.team, user_id: ids.candidate, role: "owner", status: "active" });
  await models.Project.create({ _id: ids.project, team_id: ids.team, name: "Canonical browser Project", slug: slugs.project, tagline: "Browser-safe factual proof", status: "completed", visibility: "public", skill_ids: [ids.skill], created_by: ids.candidate, completed_at: new Date() });
  await models.ProjectParticipant.create({ _id: randomUUID(), team_id: ids.team, project_id: ids.project, user_id: ids.candidate, role: "lead", status: "active", show_on_profile: true });
  await models.ProjectShowcase.create({ _id: ids.showcase, team_id: ids.team, project_id: ids.project, status: "published", headline: "Canonical browser proof", summary: "Factual proof without ranking.", created_by: ids.candidate, updated_by: ids.candidate, published_at: new Date() });
  await models.ContributionEvidence.insertMany([
    { _id: ids.evidence[0], team_id: ids.team, project_id: ids.project, user_id: ids.candidate, created_by: ids.candidate, evidence_type: "project_participation", verification_level: "internal_verified", status: "active", origin: "system", title: "TaskNexus participation", source_key: `${marker}:internal`, occurred_at: new Date("2026-10-02T00:00:00.000Z"), public_safe: true },
    { _id: ids.evidence[1], team_id: ids.team, project_id: ids.project, user_id: ids.candidate, created_by: ids.candidate, evidence_type: "github_pull_request", verification_level: "external_verified", status: "active", origin: "user", title: "Browser fixture pull request", source_key: `${marker}:external`, source_url: "https://github.com/octocat/Hello-World/pull/1347", occurred_at: new Date("2026-10-01T00:00:00.000Z"), public_safe: true },
  ]);
  await models.Organization.create({ _id: ids.organization, name: "Phase E Browser Organization", slug: slugs.organization, organization_type: "startup", status: "active", management_mode: "platform_managed", created_by: ids.candidate });
  await models.Opportunity.create({
    _id: ids.opportunity, organization_id: ids.organization, type: "internship", title: "Phase E Browser Opportunity",
    slug: slugs.opportunity, summary: "Inspect factual Project overlap.", description: "A disposable browser acceptance role.",
    responsibilities: ["Review inspectable proof"], requirements: ["Phase E Systems"], work_mode: "remote",
    application_mode: "tasknexus", required_skill_ids: [ids.skill], status: "published", source_type: "organization_owned",
    source_published_at: new Date(), last_verified_at: new Date(), published_at: new Date(), created_by: ids.candidate,
  });
  return ids;
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
    try { if ((await fetch(url)).ok) return; } catch { /* Vite is still starting. */ }
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
  frontendProcess = childProcess.spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", "5175", "--strictPort"], {
    cwd: path.resolve(__dirname, "../../frontend"),
    env: { ...process.env, VITE_API_URL: `${backendOrigin}/api`, VITE_SITE_URL: FRONTEND_ORIGIN },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  let startupError = "";
  frontendProcess.stderr.on("data", (chunk) => { startupError += chunk.toString(); });
  try { await waitForUrl(FRONTEND_ORIGIN); }
  catch (error) { throw new Error(`${error.message}${startupError ? `: ${startupError.trim()}` : ""}`); }
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

const trackProblems = (page) => {
  const consoleProblems = [];
  const networkProblems = [];
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) consoleProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleProblems.push(`pageerror: ${error.message}`));
  page.on("response", (response) => {
    const url = new URL(response.url());
    const expectedAuthProbe = response.status() === 401 && ["/api/auth/me", "/api/auth/refresh"].some((pathname) => url.pathname.endsWith(pathname));
    if (response.status() >= 400 && !expectedAuthProbe) networkProblems.push(`${response.status()} ${url.pathname}`);
  });
  return { consoleProblems, networkProblems };
};

const assertNoOverflow = async (page, label) => {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${label} overflowed horizontally`);
};

const login = async (page, label) => {
  await page.goto(`${FRONTEND_ORIGIN}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Work email").fill(emails[label]);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL(/\/freelancer\/dashboard/),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
};

const verifyPublicProfile = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const problems = trackProblems(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${FRONTEND_ORIGIN}/u/${marker}-candidate`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Skills connected to published work" }).waitFor();
    await page.getByText("Canonical browser Project", { exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "View Project proof" }).getAttribute("href"), `/showcase/${slugs.team}/${slugs.project}`);
    assert.equal((await page.locator("body").innerText()).toLowerCase().includes("candidate rank"), false);
    await assertNoOverflow(page, `public profile at ${width}px`);
  }
  assert.deepEqual(problems.consoleProblems, [], `public profile console problems: ${problems.consoleProblems.join(" | ")}`);
  assert.deepEqual(problems.networkProblems, [], `public profile network problems: ${problems.networkProblems.join(" | ")}`);
  await context.close();
};

const verifyCandidateFlow = async (browser, ids) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const problems = trackProblems(page);
  await login(page, "candidate");
  const opportunityUrl = `${FRONTEND_ORIGIN}/opportunities/${slugs.opportunity}`;
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(opportunityUrl, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Relevant proof from your Projects" }).waitFor();
    await page.getByText("Canonical browser Project", { exact: true }).waitFor();
    await assertNoOverflow(page, `Opportunity at ${width}px`);
    const apply = page.getByRole("button", { name: "Apply with TaskNexus" });
    await apply.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Apply with TaskNexus" });
    await dialog.waitFor();
    const box = await dialog.boundingBox();
    assert.ok(box && box.width <= width && box.height <= 900, `application dialog clipped at ${width}px`);
    await assertNoOverflow(page, `application dialog at ${width}px`);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(await apply.evaluate((node) => node === document.activeElement), true, `focus was not restored at ${width}px`);
  }

  await page.getByRole("button", { name: "Apply with TaskNexus" }).click();
  const projectChoice = page.getByRole("checkbox", { name: /Canonical browser Project/ });
  await projectChoice.check();
  await page.getByText(/Select at least one evidence item for each selected Project/).waitFor();
  const evidenceChoice = page.getByRole("checkbox", { name: /TaskNexus participation/ });
  await evidenceChoice.check();
  const consent = page.getByRole("checkbox", { name: /I consent to share/ });
  await consent.check();
  const submit = page.getByRole("button", { name: "Submit application" });
  assert.equal(await submit.isEnabled(), true);
  await projectChoice.uncheck();
  await page.getByText("0/5 Projects and 0/12 evidence items selected.").waitFor();
  await projectChoice.check();
  await page.getByRole("checkbox", { name: /TaskNexus participation/ }).check();
  const submittedResponse = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/opportunities\/.+\/applications$/.test(new URL(response.url()).pathname));
  await submit.click();
  assert.equal((await submittedResponse).status(), 201);
  await page.getByRole("dialog", { name: "Apply with TaskNexus" }).waitFor({ state: "detached" });

  const application = await models.NativeApplication.findOne({ opportunity_id: ids.opportunity, candidate_id: ids.candidate }).lean();
  assert.ok(application);
  const immutableSnapshot = JSON.stringify(application.submitted_profile_snapshot);
  await models.UserProfile.updateOne({ _id: ids.candidate }, { $set: { headline: "Changed after browser submission" } });
  await models.ContributionEvidence.updateMany({ project_id: ids.project }, { $set: { status: "revoked", revoked_at: new Date() } });
  await page.goto(`${FRONTEND_ORIGIN}/applications`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "View application" }).click();
  const details = page.getByRole("dialog", { name: "Phase E Browser Opportunity" });
  await details.waitFor();
  await details.getByText("Canonical browser Project", { exact: true }).waitFor();
  assert.equal(await details.getByRole("link", { name: "View Opportunity" }).getAttribute("href"), `/opportunities/${slugs.opportunity}`);
  assert.equal(await details.getByRole("link", { name: "View Organization" }).getAttribute("href"), `/organizations/${slugs.organization}`);
  const storedAfter = await models.NativeApplication.findById(application._id).lean();
  assert.equal(JSON.stringify(storedAfter.submitted_profile_snapshot), immutableSnapshot);

  assert.deepEqual(problems.consoleProblems, [], `candidate console problems: ${problems.consoleProblems.join(" | ")}`);
  assert.deepEqual(problems.networkProblems, [], `candidate network problems: ${problems.networkProblems.join(" | ")}`);
  await context.close();
};

const verifyOtherCandidateIsolation = async (browser) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  const problems = trackProblems(page);
  await login(page, "other");
  await page.goto(`${FRONTEND_ORIGIN}/opportunities/${slugs.opportunity}`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Relevant proof from your Projects" }).waitFor();
  await page.getByText("No factual Project proof overlaps the required skills yet.").waitFor();
  await page.goto(`${FRONTEND_ORIGIN}/applications`, { waitUntil: "networkidle" });
  await page.getByText("No TaskNexus applications yet").waitFor();
  assert.deepEqual(problems.consoleProblems, [], `isolation console problems: ${problems.consoleProblems.join(" | ")}`);
  assert.deepEqual(problems.networkProblems, [], `isolation network problems: ${problems.networkProblems.join(" | ")}`);
  await context.close();
};

const runQa = async () => {
  process.stdout.write("Phase E browser QA: preparing disposable fixtures.\n");
  const ids = await setup();
  await startServers();
  const { chromium } = playwright();
  const browser = await chromium.launch({ headless: true, ...(process.platform === "win32" ? { channel: "msedge" } : {}) });
  try {
    await verifyPublicProfile(browser);
    await verifyCandidateFlow(browser, ids);
    await verifyOtherCandidateIsolation(browser);
  } finally {
    await browser.close();
  }
  process.stdout.write(`Phase E browser QA passed at ${widths.join(", ")} px: proof, application selection, accessibility, immutable snapshot, isolation, and clean console/network.\n`);
};

const run = async () => {
  await connectDatabase();
  try {
    const mode = process.argv[2];
    if (mode === "cleanup") {
      await cleanup();
      process.stdout.write("Phase E browser fixtures cleaned from the guarded non-production database.\n");
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
  process.stderr.write(`Phase E browser QA failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
