import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public profile preserves published Projects and adds skill proof connections", async () => {
  const page = await source("../src/pages/PublicProfile.jsx");
  assert.match(page, /import SkillProofConnections/);
  assert.match(page, /<SkillProofConnections connections=\{profile\.proof_connections \|\| \[\]\}/);
  assert.match(page, /profile\.projects \|\| \[\]/);
  assert.match(page, /state === "error"/);
  assert.match(page, />Retry</);
});

test("Opportunity detail renders candidate-only relevant proof without requiring it anonymously", async () => {
  const page = await source("../src/pages/OpportunityDetailPage.jsx");
  assert.match(page, /import RelevantProofSection/);
  assert.match(page, /item\.relevant_proof \? <RelevantProofSection proof=\{item\.relevant_proof\} \/> : null/);
  assert.match(page, /state === "error"/);
  assert.match(page, /onClick=\{load\}/);
});

test("native application form submits deliberate Project and evidence selections", async () => {
  const page = await source("../src/pages/OpportunityDetailPage.jsx");
  assert.match(page, /import ApplicationProofPicker/);
  assert.match(page, /selectedEvidenceIds: \[\]/);
  assert.match(page, /<ApplicationProofPicker/);
  assert.match(page, /selectionError/);
  assert.match(page, /!applicationForm\.consent \|\| Boolean\(selectionError\)/);
});

test("application details link only to backend-provided Opportunity and Organization slugs", async () => {
  const page = await source("../src/pages/ApplicationsPage.jsx");
  assert.match(page, /safeApplicationTarget/);
  assert.match(page, /detail\.opportunity\?\.slug/);
  assert.match(page, /detail\.organization\?\.slug/);
  assert.doesNotMatch(page, /shared_snapshot.*target_path/s);
});
