import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("shared checklist has accessible progress, ordered steps, and safe action links", async () => {
  const component = await source("../src/components/onboarding/RoleOnboardingChecklist.jsx");
  assert.match(component, /<section[^>]+aria-labelledby=/);
  assert.match(component, /<h2/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /<ol/);
  assert.match(component, /item\.complete \? "Complete" : "Not complete"/);
  assert.match(component, /minHeight: 44/);
  assert.match(component, /if \(!view\) return null/);
  assert.match(component, /<Link\s+to=\{item\.action\.targetPath\}/);
});

test("client and freelancer dashboards render one checklist only in overview from aggregate data", async () => {
  const [client, freelancer] = await Promise.all([
    source("../src/pages/ClientDashboard.jsx"),
    source("../src/pages/FreelancerDashboard.jsx"),
  ]);
  for (const dashboard of [client, freelancer]) {
    assert.match(dashboard, /import RoleOnboardingChecklist/);
    assert.match(dashboard, /view === "overview"/);
    assert.match(dashboard, /<RoleOnboardingChecklist onboarding=\{dashboard\?\.onboarding\}/);
    assert.doesNotMatch(dashboard, /api\.get\("\/onboarding/);
  }
});

test("registration and professional setup use role-aware destinations", async () => {
  const [register, profileSetup] = await Promise.all([
    source("../src/pages/Register.jsx"),
    source("../src/pages/ProfileOnboarding.jsx"),
  ]);
  assert.match(register, /formData\.role === "client" \? "\/client\/dashboard" : "\/profile\/onboarding"/);
  assert.match(profileSetup, /user(?:\.|\?\.)role === "client"/);
  assert.match(profileSetup, /navigate\("\/client\/dashboard", \{ replace: true \}\)/);
  assert.match(profileSetup, /navigate\("\/freelancer\/dashboard"\)/);
});

test("freelancer selector clearly distinguishes marketplace availability", async () => {
  const freelancer = await source("../src/pages/FreelancerDashboard.jsx");
  assert.match(freelancer, /Marketplace task availability/);
});
