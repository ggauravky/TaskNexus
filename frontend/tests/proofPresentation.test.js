import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  evidenceTypeLabel,
  proofSelectionError,
  safeApplicationTarget,
  safeProofTarget,
  toggleProofEvidence,
  toggleProofProject,
  verificationLabel,
} from "../src/utils/proof.js";

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("proof navigation accepts only documented internal Project and showcase routes", () => {
  for (const target of [
    "/showcase/studio/accessible-work-hub",
    "/teams/studio/projects/accessible-work-hub",
  ]) assert.equal(safeProofTarget(target), target);

  for (const target of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "javascript:alert(1)",
    "/tasks/00000000-0000-4000-8000-000000000001",
    "/teams/studio/projects/work?admin=true",
    "/showcase/studio/../private",
    "/teams/studio/projects/work%2fprivate",
  ]) assert.equal(safeProofTarget(target), null);
});

test("proof labels preserve factual evidence and verification semantics", () => {
  assert.equal(verificationLabel("internal_verified"), "TaskNexus verified");
  assert.equal(verificationLabel("external_verified"), "Source verified");
  assert.equal(verificationLabel("unverified"), "Unverified claim");
  assert.equal(evidenceTypeLabel("github_pull_request"), "GitHub pull request");
  assert.equal(evidenceTypeLabel("project_task_completion"), "Completed project work");
});

test("application proof selection is explicit, bounded, and cleans up deselected evidence", () => {
  const projects = Array.from({ length: 6 }, (_, index) => ({
    id: `project-${index + 1}`,
    evidence: [{ id: `evidence-${index + 1}`, project_id: `project-${index + 1}` }],
  }));
  let state = { selectedProjectIds: [], selectedEvidenceIds: [] };
  for (const project of projects) state = toggleProofProject(state, project, true);
  assert.deepEqual(state.selectedProjectIds, ["project-1", "project-2", "project-3", "project-4", "project-5"]);
  assert.deepEqual(state.selectedEvidenceIds, [], "selecting a Project must not transmit evidence automatically");
  assert.match(proofSelectionError(projects, state), /one evidence item/i);

  state = toggleProofEvidence(state, projects[0].evidence[0], true);
  assert.deepEqual(state.selectedEvidenceIds, ["evidence-1"]);
  state = toggleProofProject(state, projects[0], false);
  assert.equal(state.selectedProjectIds.includes("project-1"), false);
  assert.equal(state.selectedEvidenceIds.includes("evidence-1"), false);

  const twelve = { selectedProjectIds: ["project-1"], selectedEvidenceIds: Array.from({ length: 12 }, (_, index) => `existing-${index}`) };
  assert.equal(toggleProofEvidence(twelve, projects[0].evidence[0], true).selectedEvidenceIds.length, 12);
});

test("zero-Project applications are valid and application navigation is allowlisted", () => {
  assert.equal(proofSelectionError([], { selectedProjectIds: [], selectedEvidenceIds: [] }), null);
  assert.equal(safeApplicationTarget("/opportunities/platform-intern"), "/opportunities/platform-intern");
  assert.equal(safeApplicationTarget("/organizations/open-labs"), "/organizations/open-labs");
  assert.equal(safeApplicationTarget("https://evil.example/opportunities/a"), null);
  assert.equal(safeApplicationTarget("/organizations/open-labs?admin=true"), null);
});

test("proof sections expose accessible headings, lists, empty states, and named links", async () => {
  const [connections, relevant] = await Promise.all([
    source("../src/components/proof/SkillProofConnections.jsx"),
    source("../src/components/proof/RelevantProofSection.jsx"),
  ]);
  for (const component of [connections, relevant]) {
    assert.match(component, /<section[^>]+aria-labelledby=/);
    assert.match(component, /<h2[^>]+id=/);
    assert.match(component, /<ul/);
    assert.match(component, /No factual Project proof/);
    assert.doesNotMatch(component, /match percentage|candidate rank|expertise score/i);
  }
  assert.match(connections, /View Project proof/);
  assert.match(connections, /Skills connected to published work/);
  assert.match(relevant, /Relevant proof from your Projects/);
});

test("application picker uses fieldset semantics, live validation, consent-safe facts, and touch targets", async () => {
  const picker = await source("../src/components/opportunities/ApplicationProofPicker.jsx");
  assert.match(picker, /<fieldset/);
  assert.match(picker, /<legend/);
  assert.match(picker, /aria-live="polite"/);
  assert.match(picker, /min-h-11/);
  assert.match(picker, /selectedEvidenceIds/);
  assert.match(picker, /Inspect source/);
  assert.doesNotMatch(picker, /metadata|source_key|attachment|task_id/i);
});
