# PHASE E — IMPLEMENTATION PLAN

## Profile -> Proof -> Opportunity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect canonical professional skills to permitted Project contribution proof, show that factual overlap to the signed-in candidate on Opportunity detail, and preserve deliberate, immutable native-application sharing without exposing private Projects, evidence, profiles, applications, or applicants.

**Architecture:** Add one backend-owned `professionalProofService` that applies surface-specific visibility policies over existing `UserSkill`, `ProjectParticipant`, `Project`, `Team`, `ProjectShowcase`, and `ContributionEvidence` records. Extend three existing read contracts additively: public profile proof connections, authenticated Opportunity `relevant_proof`, and native-application eligible Project/evidence choices. Keep application submission and immutable snapshot creation in `nativeApplicationService`; add no collection, generic proof endpoint, score, ranking, fuzzy matching, or new infrastructure.

**Tech Stack:** Node.js, Express, Mongoose/MongoDB, Jest/Supertest, React 18, React Router, Axios, Node test runner, existing dark UI primitives, existing Project/evidence/showcase/Opportunity/native-application services, and existing non-production integration/browser fixtures.

**Spec:** `docs/superpowers/specs/2026-10-14-product-cohesion-design.md`, section 11 (Phase E), with the shared design, security, accessibility, responsive, error, testing, and operational rules in sections 2-6 and 12-19.

## Global Constraints

- Implement only Phase E. Do not begin another product phase or redesign dashboards, AppShell, Unified Task Workspace, Notification Center, Global Search, or onboarding.
- Use canonical `Skill._id` references only. Never match skill names, aliases, showcase free-text `featured_skills`, biographies, evidence titles, or descriptions.
- A factual skill connection requires the same canonical ID in the user's `UserSkill` assignments and the Project's `skill_ids`, plus a permitted active participation and public-safe contribution record for that user and Project.
- Preserve `internal_verified`, `external_verified`, and `unverified` exactly as stored. `public_safe` is a separate visibility fact and never upgrades verification.
- Do not calculate percentages, scores, rankings, endorsements, eligibility changes, inferred expertise, or candidate ordering.
- Keep marketplace `tasks` and collaborative `project_tasks` separate. Phase E reads only Project-domain proof and does not convert marketplace work into Project evidence.
- Do not add a proof collection, denormalized read model, search index, AI, embeddings, vector database, cloud service, or infrastructure dependency.
- The backend derives all visibility and navigation fields. The browser never submits a candidate/user ID and never decides whether a Project or evidence item is public.
- Retain the current profile-completeness calculation and onboarding derivation unchanged.
- Retain the existing deterministic Opportunity eligibility result and checks unchanged; `relevant_proof` is a separate factual read model.
- Retain the current native-application limits: five Projects, twelve evidence items, explicit consent, and a server-built immutable snapshot.
- All returned links are allowlisted internal paths or existing safe HTTPS evidence sources. Never expose storage keys, attachment metadata, raw evidence metadata, source keys, task contents, or private URLs.
- Do not commit, push, deploy, change production environment variables, or modify Render, Vercel, or Atlas configuration.

## Verified Baseline and Git Preservation

- Requested checkpoint: branch `codex/unified-work-hub`, HEAD `67e8a57`, with Phase D changes described as uncommitted.
- Actual inspected branch: `codex/unified-work-hub`.
- Actual local HEAD: `3eb0021443f023b2bcb03d0fef571177f02ee043` (`Add role-aware dashboard onboarding`).
- Actual `origin/codex/unified-work-hub`: `3eb0021443f023b2bcb03d0fef571177f02ee043`.
- Recent history: `3eb0021` -> `67e8a57` -> `439d28f` -> `27f7e04` -> `1046a2a`.
- The working tree was clean before this plan file was created: no staged, modified, or untracked Phase D files; `git diff --stat` and `git diff --check` were empty.
- Therefore `67e8a57` is no longer HEAD and the Phase D implementation exists in the already-present `3eb0021` commit. This planning turn does not amend, reset, discard, commit, push, or otherwise alter that history.
- Phase E implementation must start from the actual `3eb0021` tree and preserve all Phase A-D behavior. Before coding, rerun `git status --short --branch`, `git rev-parse HEAD`, and `git diff --check`; if the tree differs, stop and reconcile the delta before applying this plan.

## Existing Capability Audit

| Area | Existing capability | Phase E use |
| --- | --- | --- |
| Professional profile | `profileService.getPublicProfile` returns a dedicated public DTO with canonical skills, education, completeness-adjacent facts, evidence counts, and published Project cards | Preserve every existing field and completeness rule; add bounded `proof_connections` to the public DTO only |
| Canonical skills | `UserSkill` references `Skill._id`; `Project.skill_ids` stores up to 12 canonical IDs; Opportunities store up to 16 required and 16 preferred IDs | Intersect IDs exactly; ignore text fields and `ProjectShowcase.featured_skills` |
| Public profile Projects | `showcaseService.listPublicProfileProjects` requires a public profile, profile opt-in, evidence, completed public Project, active public Team, and published showcase | Consolidate this strict chain into the shared proof service and preserve the existing `projects` array shape for compatibility |
| Phase D proof existence | `showcaseService.hasPublicProfileProof` performs a bounded strict-public existence aggregation | Keep the exported function and result; delegate or share predicates so Phase D and Phase E cannot drift |
| Project authorization | Effective-public visibility is the intersection of active public Team and public Project; private Team ancestry overrides stored Project visibility | Apply this rule in every Phase E Project query, including native-application eligible Projects |
| Contributions | `ContributionEvidence` stores independent verification and lifecycle state, `public_safe`, Project/user provenance, and indexed timelines | Return only active `public_safe=true` evidence through Phase E connections; serialize an allowlist and preserve the stored verification label |
| Public showcase | `GET /api/showcase/:teamSlug/:projectSlug` already uses a separate public DTO and shows public-profile contributors alphabetically with factual counts | Reuse showcase paths and current public contributor privacy; do not create a second showcase or expose internal Project/task data |
| Opportunity detail | `GET /api/opportunities/:slug` is optionally authenticated; authenticated output already adds only the caller's eligibility, saved state, and native-application state | Add only the caller's `relevant_proof`; anonymous output and employer eligibility logic remain unchanged |
| Eligibility | `opportunityEligibilityService` loads the caller's profile, education, and canonical skills and produces deterministic checks without a score | Reuse the loaded canonical skill facts, but keep proof computation in a separate service and field |
| Native application choices | `GET /api/native-applications/eligible-projects` returns up to 25 active-participant, completed public Projects with a public-safe evidence count | Harden effective-public Team checks and add bounded skills/evidence choices so the candidate can select exact supporting evidence |
| Snapshot submission | `nativeApplicationService.submit` accepts bounded selected Project/evidence IDs, derives identity from auth, rebuilds allowed data server-side in a transaction, and stores `submitted_profile_snapshot` | Preserve this contract and exact historical snapshot semantics; the new UI sends explicit evidence IDs rather than relying on fallback selection |
| Application navigation | `/applications` already links cards to Opportunity and Organization pages and shows the stored snapshot in an accessible dialog | Add the same safe links to detail context where absent; never resolve live private proof into a submitted snapshot |
| Recruiter access | Organization owner/admin/recruiter access is contextual and `applicantDetailDto` returns only the consented snapshot | Do not add relevant proof to recruiter DTOs or applicant lists; keep cross-Organization concealment and stage RBAC unchanged |

## Missing Integration Gaps

1. Public profile skill cards and published Project cards are separate; no canonical skill-to-Project relationship is serialized.
2. Existing public Project helpers have overlapping predicates. The newer Phase D existence helper checks `status=active` and `public_safe=true`, while the older public-profile Project list does not apply both conditions consistently.
3. Opportunity detail exposes deterministic eligibility but no factual connection from a required skill to the candidate's permitted completed Project evidence.
4. The eligible-Projects API returns counts only, so the current application dialog lets a candidate choose Projects but cannot deliberately choose individual supporting evidence. The backend already accepts exact evidence IDs.
5. Native-application Project eligibility checks `Project.visibility=public` but not the parent Team's effective visibility; a public Project under a private Team must not be offered.
6. The application detail dialog shows immutable snapshot facts but its Opportunity/Organization navigation is less direct than the list cards.
7. Existing Phase 5/8/9 integration suites do not cover the three-way canonical skill intersection, private-Team ancestry, Phase E response boundaries, or proof query explain plans.

## Architecture Decision

### Chosen: shared proof service plus additive existing DTOs

Create `backend/src/services/professionalProofService.js` as the only place that combines participation, effective Project visibility, canonical skills, showcase publication, and public-safe evidence for Phase E. It exposes surface-specific functions rather than one permissive query with browser-controlled flags:

```js
listPublicProfileConnections(userId, options?)
listOpportunityRelevantProof(userId, opportunity, options?)
listApplicationEligibleProof(userId, options?)
loadSelectedApplicationProof(userId, projectIds, evidenceIds, session?)
hasPublicProfileProof(userId)
```

Each public function owns fixed policy. Internal helpers may share projected batch queries, but callers cannot weaken `public_safe`, participation, Team/Project visibility, completion, profile opt-in, or showcase requirements.

Extend existing responses instead of adding routes:

- `GET /api/public/profiles/:username` adds `proof_connections` and preserves `projects`.
- `GET /api/opportunities/:slug` adds `relevant_proof` only when authenticated.
- `GET /api/native-applications/eligible-projects` adds bounded canonical `skills`, `evidence`, and backend-derived navigation to each already-eligible item.

### Rejected: generic `/api/proof` aggregator

A generic endpoint would need caller-controlled surface modes, duplicate ownership checks, and a broad DTO. The current profile, Opportunity, and application endpoints already know the actor and intended privacy context.

### Rejected: frontend aggregation

Fetching profile Projects, Project detail, contributions, and showcases in the browser would create N+1 requests, expose policy interpretation to the client, and still fail for candidate-only proof when the browser lacks private service access.

### Rejected: persisted or scored proof graph

Canonical IDs and existing Project/evidence records are sufficient. A denormalized graph or score would add synchronization, migration, ranking, and privacy risk without being required.

## Backend Contracts

### Public professional profile

Existing fields remain byte-for-byte compatible. Add:

```json
{
  "proof_connections": [
    {
      "skill": { "id": "uuid", "slug": "react", "name": "React" },
      "projects": [
        {
          "id": "uuid",
          "name": "Accessible work hub",
          "completed_at": "2026-10-01T00:00:00.000Z",
          "team": { "name": "Studio", "slug": "studio" },
          "target_path": "/showcase/studio/accessible-work-hub",
          "evidence_summary": {
            "total": 2,
            "internal_verified": 0,
            "external_verified": 1,
            "unverified": 1
          },
          "evidence": [
            {
              "id": "uuid",
              "type": "github_pull_request",
              "verification": "external_verified",
              "title": "Improve accessible task tabs",
              "source_url": "https://github.com/example/repo/pull/12",
              "occurred_at": "2026-09-30T00:00:00.000Z"
            }
          ]
        }
      ]
    }
  ]
}
```

Rules:

- Profile is active and public.
- `UserSkill.skill_id === Project.skill_ids[n]`; both must reference an active canonical Skill.
- Participant is the profile owner, active, and `show_on_profile=true`.
- Parent Team is active/public; Project is completed/public; showcase is published.
- Evidence belongs to the same user and Project, is active, and `public_safe=true`.
- Return at most 20 connected skills, 3 Projects per skill, 12 unique Projects overall, and 3 evidence previews per Project. Preserve exact counts for the bounded eligible set through one grouped aggregation.
- Inspect at most the 100 most recently updated qualifying participations per surface before applying the smaller response caps. This is a deterministic safety ceiling, not a quality ranking.
- Sort skills in existing profile order, Projects by `completed_at desc, id asc`, and evidence by `occurred_at desc, id asc`. Evidence count never changes ordering.
- The existing `projects` array remains available and is derived from the same strict Project set to prevent compatibility breakage.

### Authenticated Opportunity detail

Anonymous output is unchanged and omits `relevant_proof`. Authenticated output adds:

```json
{
  "relevant_proof": {
    "required_skills": [
      {
        "skill": { "id": "uuid", "slug": "react", "name": "React" },
        "projects": [
          {
            "id": "uuid",
            "name": "Accessible work hub",
            "team": { "name": "Studio", "slug": "studio" },
            "target_path": "/showcase/studio/accessible-work-hub",
            "evidence_summary": {
              "total": 1,
              "internal_verified": 0,
              "external_verified": 1,
              "unverified": 0
            },
            "evidence": []
          }
        ]
      }
    ],
    "project_count": 1,
    "evidence_count": 1,
    "disclaimer": "Factual overlap from your TaskNexus profile and permitted Project proof. This is not a score or eligibility decision."
  }
}
```

Rules:

- Identity is always the authenticated caller. There is no candidate ID query/body parameter.
- A connected skill must exist in all three places: Opportunity `required_skill_ids`, caller `UserSkill.skill_id`, and eligible Project `skill_ids`.
- Preferred skills do not enter Phase E `relevant_proof`; deterministic eligibility continues to present required/preferred checks separately.
- Candidate-only proof requires active participation, active public parent Team, completed public Project, and active public-safe evidence owned by the caller.
- `show_on_profile` and public profile visibility are not required for this caller-only view; those settings govern public profile publication, not private self-review. Nothing from this field is sent to an Organization.
- Use the published showcase path when one exists. Otherwise use the permitted internal Project path `/teams/:teamSlug/projects/:projectSlug`.
- Return at most 3 Projects per required skill, 12 unique Projects total, and evidence counts plus at most 2 evidence previews per Project. Return the stable empty object shape when there is no overlap.
- Do not alter `eligibility`, `viewer_state`, `viewer_native_application`, publication state, or Organization management output.

### Native-application eligible proof

`GET /api/native-applications/eligible-projects` remains authenticated and identity-derived. Each of at most 25 Project items adds:

```json
{
  "id": "uuid",
  "name": "Accessible work hub",
  "participant_role": "contributor",
  "completed_at": "2026-10-01T00:00:00.000Z",
  "team": { "name": "Studio", "slug": "studio" },
  "skills": [{ "id": "uuid", "slug": "react", "name": "React" }],
  "target_path": "/teams/studio/projects/accessible-work-hub",
  "evidence_count": 2,
  "evidence": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "type": "github_pull_request",
      "verification": "external_verified",
      "title": "Improve accessible task tabs",
      "source_url": "https://github.com/example/repo/pull/12",
      "occurred_at": "2026-09-30T00:00:00.000Z"
    }
  ]
}
```

Rules:

- Active caller participation, active public Team, completed public Project, and at least one active caller-owned `public_safe` evidence item are mandatory.
- Evidence arrays are capped at 5 per Project; the application selection UI remains capped at 12 total.
- The response excludes summaries, raw metadata, source keys, attachments, task IDs/titles, other participants, and private repository details.
- `POST /api/opportunities/:id/applications` retains `selectedProjectIds`, `selectedEvidenceIds`, consent, and all existing limits. The server re-queries eligibility in the submission transaction and snapshots exactly the accepted choices.
- Backward compatibility remains: a legacy caller that selects Projects but omits evidence IDs may retain the current bounded public-safe fallback. The Phase E UI always presents and submits explicit evidence choices, so it never relies on automatic selection.
- Later profile, Project, Team, showcase, evidence, or skill edits never mutate an existing `submitted_profile_snapshot`.

## Authorization and Privacy Matrix

| Surface | Caller | Allowed | Concealed/rejected |
| --- | --- | --- | --- |
| Public profile | Anonymous or authenticated viewer | Active public profile; strict opted-in published Project/showcase proof; public-safe evidence projection | Private profile, inactive account, opt-out, private/inactive Team, private/incomplete Project, draft/unpublished showcase, revoked/non-public-safe evidence |
| Public showcase | Any viewer | Existing dedicated public DTO and public-profile contributors under existing explicit visibility rules | Draft/private Team/Project/showcase, private profiles, internal task/activity/storage data |
| Opportunity detail | Anonymous | Existing published public Opportunity DTO | `relevant_proof`, caller state, applications, applicants |
| Opportunity detail | Authenticated user | Existing caller eligibility/state plus only that caller's relevant proof | Any other user's proof, applications, applicant data, private Projects/evidence |
| Eligible application proof | Authenticated candidate | Caller-owned eligible Project/evidence choices only | Caller-supplied user ID, stale participant, private Team/effective-private Project, non-public-safe or other-user evidence |
| Native submission/detail | Candidate | Submit choices and read only own immutable snapshot | Other candidate application ID, live post-submission proof changes, private fields |
| Applicant list/detail | Active Organization owner/admin/recruiter | Existing consented immutable snapshot for that Organization | Live relevant proof, candidate private profile, saves/notes, other Organization applications |
| Platform admin | Existing documented powers only | Existing catalog administration | No implicit Team/Project proof or Organization applicant override |

IDOR responses retain current safe 403/404 behavior. No Phase E endpoint accepts or trusts a candidate identity, profile visibility result, Project visibility result, evidence ownership result, verification state, or target path from the browser.

## Frontend Component Structure

### `SkillProofConnections`

- Render beneath the existing public-profile skills without changing the profile layout hierarchy.
- Group by canonical skill, use factual copy such as “Used in 2 published Projects,” and show Project/showcase links plus explicit verification badges.
- Never use “match,” “best,” “top,” “expert,” “endorsed,” percentages, or rank ordering.
- Empty `proof_connections` does not create a large empty panel; existing skill and Project sections remain intact.

### `RelevantProofSection`

- Render on authenticated Opportunity detail after Skills and before source/provenance.
- Show loading as part of the existing Opportunity request, a compact empty state when no required skill has proof, and safe API failure through the page's canonical error handling.
- State plainly that the section is visible only to the signed-in user, is factual, and does not affect eligibility.
- Links use only backend-provided internal `target_path` values validated by the proof-specific `safeProofTarget` allowlist before rendering.

### `ApplicationProofPicker`

- Extract the current Project checklist from the application dialog into a focused component.
- Show Project, participant role, canonical skills, and up to five evidence choices per Project.
- Selecting a Project reveals its evidence. Selecting evidence is explicit; deselecting a Project removes its evidence IDs.
- Disable additional Projects at 5 and additional evidence at 12. If a Project is selected, require at least one of its displayed evidence items before enabling submission. Applying with no Project remains valid.
- Announce selection errors with `aria-live`, use fieldset/legend semantics, maintain 44px touch targets, and preserve Dialog focus trap/Escape/focus restoration.
- Submission sends only `coverNote`, `selectedProjectIds`, `selectedEvidenceIds`, and `consent`.

### Applications navigation

- Preserve the current applications page and tabs.
- In the native-application detail dialog, add compact safe links to the snapshot's Opportunity and Organization when the existing DTO provides them.
- Do not turn snapshot Project names into live Project links because the immutable snapshot does not store a public route and later visibility may change.

### Loading, error, and empty states

- Public profile and Opportunity proof load with their existing primary page requests; no secondary request or content flash is added.
- Keep the existing privacy-preserving not-found state for a real `404`, but distinguish network/server failure as a recoverable error with canonical safe copy and a retry action. Do not turn every failure into “not found.”
- An eligible page with no connections renders a compact factual empty state and retains all existing profile/Opportunity content.
- Eligible-Project loading keeps the existing pending button state. A failure leaves the dialog closed, shows the canonical safe API error, and permits retry. An empty response explicitly says that applying without Project proof remains allowed.

## File Map

### Create

- `backend/src/services/professionalProofService.js` — surface-specific proof policies and bounded projected queries.
- `backend/src/serializers/proofSerializers.js` — allowlisted proof/evidence/Project DTOs and factual count helpers.
- `backend/tests/proofConnections.domain.test.js` — pure serializer/grouping, bounds, ordering, and no-score tests.
- `backend/tests/professionalProofService.test.js` — service policy, exact-ID intersection, and dependency/query-shape tests.
- `backend/scripts/verifyPhaseEIntegration.js` — disposable non-production API/Mongo/privacy/immutability/query-plan verification.
- `backend/scripts/phaseEProofBrowserFixture.js` — marker-owned browser dataset and safe cleanup.
- `frontend/src/components/proof/SkillProofConnections.jsx` — public-profile factual connections.
- `frontend/src/components/proof/RelevantProofSection.jsx` — candidate-only Opportunity proof.
- `frontend/src/components/opportunities/ApplicationProofPicker.jsx` — deliberate Project/evidence selection.
- `frontend/src/utils/proof.js` — pure selection limits, verification labels, and safe internal target validation.
- `frontend/tests/proofPresentation.test.js` — pure selection and copy/shape tests.
- `frontend/tests/proofWiring.test.js` — profile/Opportunity/application accessibility and API wiring checks.

### Modify

- `backend/src/models/index.js` — add proof-query compound indexes only; no schema/collection fields.
- `backend/src/services/showcaseService.js` — delegate public-profile Project/proof existence policy to the shared service while preserving exports and public-showcase behavior.
- `backend/src/services/profileService.js` — append `proof_connections` without changing public profile or completeness fields.
- `backend/src/services/opportunityService.js` — load caller-only relevant proof on detail and pass it to the serializer.
- `backend/src/services/nativeApplicationService.js` — reuse shared effective-public Project/evidence validation and return bounded selectable evidence.
- `backend/src/serializers/opportunitySerializers.js` — append authenticated `relevant_proof`; keep anonymous DTO unchanged.
- `backend/src/serializers/organizationSerializers.js` — no new live proof; change only if needed to preserve explicit Opportunity/Organization navigation fields already loaded.
- `backend/tests/profileService.test.js` — additive profile contract and private-profile non-leakage.
- `backend/tests/opportunities.domain.test.js` — authenticated/anonymous relevant-proof serialization and unchanged eligibility.
- `backend/tests/organizations.domain.test.js` — exact evidence snapshot, allowlist, and immutable DTO regressions.
- `backend/tests/contributions.domain.test.js` — proof index declarations and verification-state preservation.
- `backend/scripts/verifyMongoDatabase.js` — validate new indexes and explain-plan shapes.
- `backend/scripts/verifyMongoIntegration.js` — retain Phase D coverage and add strict public-proof predicate regression where shared behavior changes.
- `backend/scripts/verifyMongoApi.js` — public profile/Opportunity response privacy and marketplace/Project separation regression.
- `backend/scripts/verifyPhase5Integration.js` — public profile Project compatibility and strict public-safe proof checks.
- `backend/scripts/verifyOrganizationIntegration.js` — active public Team requirement, explicit evidence selection, immutable snapshot, and cross-Organization IDOR.
- `backend/package.json` — add `verify:phase-e`, `qa:phase-e-browser`, and cleanup scripts.
- `frontend/src/pages/PublicProfile.jsx` — render `SkillProofConnections` while retaining the existing public page.
- `frontend/src/pages/OpportunityDetailPage.jsx` — render `RelevantProofSection` and use `ApplicationProofPicker` inside the existing dialog.
- `frontend/src/pages/ApplicationsPage.jsx` — add safe Opportunity/Organization detail links only.
- `docs/API_CONTRACTS.md` — document additive DTO fields and unchanged route/ownership boundaries.
- `docs/PRODUCT_COHESION.md` — mark Phase E implemented only after every gate passes and record the final architecture.
- `docs/CONTRIBUTION_EVIDENCE.md` and `docs/NATIVE_APPLICATIONS.md` — document exact Phase E visibility and explicit-selection behavior without rewriting existing truth models.

### Not expected to change

- Express route/controller files, unless implementation proves an existing serializer cannot receive the additive data without a minimal wiring edit.
- Professional profile completeness/onboarding domain files.
- Marketplace task models, services, workspace, dashboards, or modals.
- Opportunity eligibility rules or Organization role contracts.
- Native application collection/schema fields or submitted snapshot shape.
- AppShell, notifications, search, cloud/infrastructure files, or environment files.

## Query and Index Design

Add named compound indexes because the new high-growth shapes include `public_safe` and profile opt-in:

```js
projectParticipant.schema.index(
  { user_id: 1, status: 1, show_on_profile: 1, updated_at: -1 },
  { name: "user_active_profile_projects" },
);
contributionEvidence.schema.index(
  { user_id: 1, status: 1, public_safe: 1, project_id: 1, occurred_at: -1 },
  { name: "user_public_proof_by_project" },
);
```

Query sequence:

1. Load the user's canonical skill assignments with projection and existing `(user_id, skill_id)` index.
2. Load a bounded participant candidate set by authenticated user; public profile mode also fixes `status=active` and `show_on_profile=true`.
3. Load Projects by bounded `_id in`, fixed status/visibility, and intersect `skill_ids` in memory only across this bounded Project set; never scan all Projects.
4. Load parent Teams by bounded `_id in` and require active/public.
5. Load published showcases by bounded Project IDs only when a surface needs a public showcase path or public profile publication.
6. Load caller-owned active public-safe evidence through `user_public_proof_by_project`, with projection and a bounded Project ID set.
7. Load canonical Skill presentation rows by bounded IDs.
8. Assemble and cap DTOs after the bounded queries; do not query once per skill or Project.

Explain-plan acceptance requires `IXSCAN` in the winning plan for UserSkill, ProjectParticipant, Project, Team, ProjectShowcase, and ContributionEvidence shapes. Controlled distractor records must demonstrate that `totalDocsExamined` follows the authenticated user's bounded candidate set rather than global collection size. A `COLLSCAN`, unbounded `$lookup`, or arbitrary regex fails the performance gate; do not hide it with an in-memory limit.

## Step-by-Step TDD Implementation

### Task 1: Freeze proof DTOs and factual semantics

**Files:**
- Create: `backend/src/serializers/proofSerializers.js`
- Create: `backend/tests/proofConnections.domain.test.js`
- Modify: `backend/tests/contributions.domain.test.js`

**Interfaces:**
- Produces `proofEvidenceDto(row)`, `proofProjectDto(project, context)`, `proofConnectionDto(skill, projects)`, and `relevantProofDto(connections)`.
- DTOs accept already-authorized rows only; they do not perform authorization.

- [ ] Write failing tests asserting exact allowlisted keys, preserved verification strings, internal GitHub/source URL rules, deterministic count keys, safe internal target paths, no score/rank/endorsement fields, and omission of metadata/source keys/attachments/task data.
- [ ] Run `npm --prefix backend test -- --runTestsByPath tests/proofConnections.domain.test.js tests/contributions.domain.test.js`; confirm failures are missing Phase E serializers/assertions rather than environment failures.
- [ ] Implement the minimal serializers and constants for the fixed caps and disclaimer.
- [ ] Rerun the focused tests and require all to pass.
- [ ] Review the diff and run `git diff --check`; do not commit.

### Task 2: Build the shared bounded proof service and indexes

**Files:**
- Create: `backend/src/services/professionalProofService.js`
- Create: `backend/tests/professionalProofService.test.js`
- Modify: `backend/src/models/index.js`
- Modify: `backend/tests/contributions.domain.test.js`

**Interfaces:**
- Produces the five service functions defined in Architecture Decision.
- Consumes only authenticated/validated IDs, an existing Opportunity object, fixed server-side caps, and an optional Mongoose session for snapshot validation.

- [ ] Write failing service tests for exact three-way skill-ID overlap, active participation, effective-public Team/Project ancestry, profile opt-in/published-showcase policy, candidate-self policy, public-safe evidence, revoked evidence, wrong-user evidence, deterministic ordering, empty results, and all caps.
- [ ] Add failing index declaration tests for `user_active_profile_projects` and `user_public_proof_by_project`.
- [ ] Run `npm --prefix backend test -- --runTestsByPath tests/professionalProofService.test.js tests/contributions.domain.test.js`; verify expected failures.
- [ ] Implement batched projected queries, fixed policies, and the two named indexes. Use `mongoose.trusted({ $in: ... })` consistently and short-circuit empty ID sets.
- [ ] Rerun both suites and require all to pass.
- [ ] Inspect every query for a server-side limit/projection or bounded `_id` set; run `git diff --check`; do not commit.

### Task 3: Integrate strict proof with the public professional profile

**Files:**
- Modify: `backend/src/services/showcaseService.js`
- Modify: `backend/src/services/profileService.js`
- Modify: `backend/tests/profileService.test.js`
- Modify: `backend/scripts/verifyPhase5Integration.js`

**Interfaces:**
- `getPublicProfile(username)` preserves all existing fields and adds `proof_connections`.
- `listPublicProfileProjects(userId)` and `hasPublicProfileProof(userId)` remain exported with their current result types.

- [ ] Add failing tests for additive `proof_connections`, unchanged `projects`, public/private 404 equivalence, exact canonical IDs, opt-out removal, active participant, public-safe evidence, public Team/completed Project/published showcase, and no private fields.
- [ ] Run `npm --prefix backend test -- --runTestsByPath tests/profileService.test.js tests/professionalProofService.test.js`; verify failures.
- [ ] Wire the strict service into profile/showcase functions without changing completeness, Phase D onboarding, or the existing public profile route.
- [ ] Rerun the focused tests and the Phase D onboarding service tests.
- [ ] Run the Phase 5 integration verifier against an explicitly confirmed non-production database and require the legacy Project-card assertions plus new proof assertions to pass.
- [ ] Review the response diff for compatibility; do not commit.

### Task 4: Add candidate-only relevant proof to Opportunity detail

**Files:**
- Modify: `backend/src/services/opportunityService.js`
- Modify: `backend/src/serializers/opportunitySerializers.js`
- Modify: `backend/tests/opportunities.domain.test.js`
- Modify: `backend/scripts/verifyOpportunityIntegration.js`

**Interfaces:**
- `loadDecoration` passes `relevantProof` only for authenticated detail responses.
- `opportunityCandidateDto` adds `relevant_proof` only inside the existing authenticated candidate block.

- [ ] Write failing tests that anonymous DTOs omit the field, authenticated DTOs expose only the caller's exact required-skill proof, empty overlap is stable, preferred skills do not leak into the section, eligibility is unchanged, and no score/rank/applicant data appears.
- [ ] Run `npm --prefix backend test -- --runTestsByPath tests/opportunities.domain.test.js tests/professionalProofService.test.js`; verify failures.
- [ ] Load relevant proof in parallel with current Organization/skill/state/application/candidate decoration only for detail requests; do not add work to Opportunity list/search responses.
- [ ] Rerun focused suites and `npm --prefix backend run verify:opportunities` against the verified non-production database.
- [ ] Confirm public/anonymous response snapshots are unchanged except that authenticated detail is additive; do not commit.

### Task 5: Harden native application proof selection and preserve snapshots

**Files:**
- Modify: `backend/src/services/nativeApplicationService.js`
- Modify: `backend/tests/organizations.domain.test.js`
- Modify: `backend/scripts/verifyOrganizationIntegration.js`

**Interfaces:**
- `listEligibleProjects(candidateId)` preserves the route and base fields and adds bounded skills/evidence/team/target data.
- `loadEligibleProjectData(candidateId, projectIds, evidenceIds, session)` continues returning the existing immutable snapshot `projects` and `evidence` shapes.

- [ ] Write failing tests for private parent Team exclusion, inactive participant exclusion, other-user/non-public-safe/revoked evidence rejection, exact selected evidence, current caps, no candidate-ID override, and snapshot immutability after source records change.
- [ ] Extend the Organization integration fixture with a public Team eligible Project, a public Project under a private Team, a revoked evidence row, another user's evidence, and two candidate-selected public-safe evidence items.
- [ ] Run `npm --prefix backend test -- --runTestsByPath tests/organizations.domain.test.js tests/professionalProofService.test.js`; verify failures.
- [ ] Delegate eligible listing and selected-proof validation to the shared service while preserving transaction boundaries, consent, duplicate submission fencing, revision behavior, and legacy public-safe fallback.
- [ ] Rerun focused tests and `npm --prefix backend run verify:organizations`; require cross-Organization IDOR, exact snapshot, race, privacy, and index checks to pass.
- [ ] Query the stored application after modifying/deleting visibility on source records and assert the submitted snapshot is byte-stable; do not commit.

### Task 6: Render public-profile and Opportunity proof accessibly

**Files:**
- Create: `frontend/src/components/proof/SkillProofConnections.jsx`
- Create: `frontend/src/components/proof/RelevantProofSection.jsx`
- Create: `frontend/src/utils/proof.js`
- Create: `frontend/tests/proofPresentation.test.js`
- Create: `frontend/tests/proofWiring.test.js`
- Modify: `frontend/src/pages/PublicProfile.jsx`
- Modify: `frontend/src/pages/OpportunityDetailPage.jsx`

**Interfaces:**
- `SkillProofConnections({ connections })` accepts the public profile DTO.
- `RelevantProofSection({ proof })` accepts the authenticated Opportunity DTO.
- `safeProofTarget(path)` accepts only the documented internal Project/showcase route families.

- [ ] Write failing Node tests for factual copy, verification labels, empty states, internal-path rejection, one semantic heading per section, link names, no score/rank language, and profile/Opportunity component wiring.
- [ ] Run `node --test frontend/tests/proofPresentation.test.js frontend/tests/proofWiring.test.js`; verify failures.
- [ ] Implement the two compact components with existing dark tokens, responsive grids, accessible headings/lists, focus-visible links, and no page-level overflow.
- [ ] Wire public profile and Opportunity detail without moving or redesigning existing sections. Anonymous Opportunity rendering must tolerate an absent field; real `404` and recoverable request failure must render distinct safe states with retry only for the latter.
- [ ] Rerun the focused frontend tests and `npm --prefix frontend run lint`.
- [ ] Inspect 320px layout in the browser before proceeding; do not commit.

### Task 7: Add deliberate Project/evidence selection and navigation cohesion

**Files:**
- Create: `frontend/src/components/opportunities/ApplicationProofPicker.jsx`
- Modify: `frontend/src/utils/proof.js`
- Modify: `frontend/tests/proofPresentation.test.js`
- Modify: `frontend/tests/proofWiring.test.js`
- Modify: `frontend/src/pages/OpportunityDetailPage.jsx`
- Modify: `frontend/src/pages/ApplicationsPage.jsx`

**Interfaces:**
- `ApplicationProofPicker({ projects, selectedProjectIds, selectedEvidenceIds, onChange, disabled })` emits both bounded arrays.
- Pure helpers `toggleProofProject` and `toggleProofEvidence` enforce 5/12 limits and clear evidence when a Project is removed.

- [ ] Add failing tests for zero-Project application, explicit evidence selection, per-Project requirement, deselection cleanup, 5/12 caps, inaccessible/private fields absent, consent, fieldset semantics, live validation, and safe Opportunity/Organization links.
- [ ] Run `node --test frontend/tests/proofPresentation.test.js frontend/tests/proofWiring.test.js`; verify failures.
- [ ] Extract the picker, extend `applicationForm` with `selectedEvidenceIds`, disable submission only for invalid selected-Project evidence state or missing consent, and preserve pending/error handling.
- [ ] Add compact application-detail Opportunity/Organization links using existing DTO fields; never derive or guess snapshot Project links.
- [ ] Rerun focused tests, all frontend tests, and frontend lint.
- [ ] Manually verify keyboard-only selection, Escape/focus restoration, and touch targets; do not commit.

### Task 8: Add Phase E integration, query plans, browser fixture, and docs

**Files:**
- Create: `backend/scripts/verifyPhaseEIntegration.js`
- Create: `backend/scripts/phaseEProofBrowserFixture.js`
- Modify: `backend/package.json`
- Modify: `backend/scripts/verifyMongoDatabase.js`
- Modify: `backend/scripts/verifyMongoIntegration.js`
- Modify: `backend/scripts/verifyMongoApi.js`
- Modify: `docs/API_CONTRACTS.md`
- Modify: `docs/PRODUCT_COHESION.md`
- Modify: `docs/CONTRIBUTION_EVIDENCE.md`
- Modify: `docs/NATIVE_APPLICATIONS.md`

**Interfaces:**
- `npm --prefix backend run verify:phase-e` creates only marker-owned fixtures in an explicitly verified non-production database, runs API/Mongo/privacy/query checks, and cleans them in `finally`.
- Browser fixture supports `qa` and `cleanup` modes and never prints passwords, JWTs, connection strings, or secrets.

- [ ] Write the integration verifier first with disposable cryptographically generated credentials, unique IDs/slugs, marker-scoped cleanup, and assertions for all rows in the test matrix below.
- [ ] Run it before implementation wiring is complete and confirm it fails on missing Phase E fields/policies, not database safety.
- [ ] Add query-plan checks for every Phase E query shape, requiring `IXSCAN`, bounded examined documents, and no global-size-dependent scan.
- [ ] Add the browser fixture and package scripts; cleanup may delete only records whose IDs/marker were created by that run.
- [ ] Update docs only after behavior is implemented. Preserve historical phase docs and state that marketplace tasks remain separate from ProjectTasks.
- [ ] Run the focused Phase E verifier, Mongo/API regressions, full test/lint/build/security gates, and browser acceptance.
- [ ] Run final `git status`, `git diff --stat`, relevant full `git diff`, and `git diff --check`; confirm no env, secrets, generated screenshots, temp files, infrastructure, commits, pushes, or deployments.

## Test Matrix

| Concern | Required assertions | Primary gate |
| --- | --- | --- |
| Canonical connection | UserSkill, Opportunity required skill, and Project skill use the exact same ID; same-name/different-ID never connects | Domain/service Jest + Phase E integration |
| Public profile | Public active profile + active opt-in participant + active public Team + completed public Project + published showcase + caller-owned active public-safe evidence appears | Profile Jest + Phase 5/Phase E integration |
| Profile privacy | Any private profile, opt-out, inactive participant, private Team, private/incomplete Project, unpublished showcase, revoked/non-public-safe evidence removes the connection without leaking why | Profile/service Jest + API IDOR |
| Verification truth | `internal_verified`, `external_verified`, and `unverified` remain distinct; no public-safe flag becomes an endorsement or verification upgrade | Serializer Jest + browser copy |
| Opportunity candidate | Authenticated caller sees only own exact required-skill proof; anonymous sees no field; no score or eligibility mutation | Opportunity Jest/API integration |
| Candidate isolation | Candidate A cannot request Candidate B proof through query/body/path changes; recruiter sees only self context on public Opportunity, not applicants | API IDOR integration |
| Application choices | UI sends exactly selected Projects/evidence; server rejects wrong-user/private/non-public-safe IDs; no Project selection remains valid | Frontend tests + Organization integration |
| Effective visibility | Project marked public beneath a private/inactive Team is absent from profile, relevant proof, and application choices | Service + Mongo/API integration |
| Snapshot immutability | After submit, edits/revocation/visibility/profile changes do not change candidate or recruiter application detail snapshot | Organization/Phase E integration |
| Organization RBAC | Owner/admin/recruiter for Organization A can read A snapshot; outsider and Organization B cannot; platform admin gains no implicit Project proof access | Organization integration |
| Bounded output | 20 skills, 12 unique profile/relevant Projects, 3 Projects per skill, 2-3 evidence previews, 25 application Projects, 5 evidence choices per Project, 5/12 submitted caps | Unit + integration |
| Query performance | All fixed-ID/equality shapes use indexes and projected bounded queries; distractors do not cause global scans | `executionStats` integration |
| Navigation | Only `/showcase/:teamSlug/:projectSlug`, `/teams/:teamSlug/projects/:projectSlug`, `/opportunities/:slug`, and `/organizations/:slug` are rendered as internal Phase E targets | Serializer/frontend tests |
| Accessibility | Semantic sections/lists/fieldset, named links/controls, live errors, keyboard operation, focus trap/restoration, 44px controls, no color-only meaning | Frontend tests + browser QA |
| Marketplace separation | No Phase E query/import/DTO reads `Task` or `project_tasks`; existing marketplace workspace regression remains green | Diff review + API integration |

## Full Verification Gate

Use only an explicitly verified non-production database accepted by the existing fail-closed safety guard. Never echo environment values or secrets.

1. Focused backend:
   - `npm --prefix backend test -- --runTestsByPath tests/proofConnections.domain.test.js tests/professionalProofService.test.js tests/profileService.test.js tests/opportunities.domain.test.js tests/organizations.domain.test.js tests/contributions.domain.test.js`
2. Focused frontend:
   - `node --test frontend/tests/proofPresentation.test.js frontend/tests/proofWiring.test.js`
3. Full backend Jest:
   - `npm --prefix backend test`
4. Full frontend tests:
   - `node --test frontend/tests/*.test.js`
5. Mongo/API and domain integration:
   - `npm --prefix backend run verify:database`
   - `npm --prefix backend run verify:mongodb-integration`
   - `npm --prefix backend run verify:api-integration`
   - `npm --prefix backend run verify:phase5`
   - `npm --prefix backend run verify:opportunities`
   - `npm --prefix backend run verify:organizations`
   - `npm --prefix backend run verify:phase-e`
6. Privacy/IDOR: require the Phase E verifier to exercise public/anonymous, candidate A, candidate B, unrelated client/freelancer, Organization A recruiter, Organization B recruiter, outsider, and platform admin.
7. Lint:
   - `npm --prefix backend run lint`
   - `npm --prefix frontend run lint`
8. Production build/config:
   - `npm --prefix frontend run build`
   - `npm --prefix backend run verify:production`
   - `node frontend/scripts/verifyProductionConfig.mjs`
9. Security:
   - `npm --prefix backend run verify:secrets`
   - Review tracked/untracked names and diffs for `.env`, fixture credentials, tokens, dumps, screenshots, or debug logs.
10. Final repository review:
   - `git status --short --branch`
   - `git diff --stat`
   - relevant full `git diff`
   - `git diff --check`

Capture fresh suite/test counts and command exit status in the Phase E acceptance report; never copy prior phase counts.

## Browser Acceptance

Run the marker-owned Phase E fixture and test at `320`, `375`, `390`, `430`, `768`, `1024`, and `1440` CSS pixels.

Golden flows:

1. Open a public professional profile and verify each connected skill names only canonical eligible published Projects, links to the showcase, shows factual verification states, and contains no ranking language.
2. Toggle profile opt-in or an eligible fixture condition through the supported API, refresh, and verify the connection disappears without leaking the hidden Project; restore only the test-owned record.
3. Sign in as candidate A, open an Opportunity, and verify required-skill relevant proof, self-only explanation, empty/non-overlap behavior, and unchanged eligibility presentation.
4. Open the native application dialog, select one Project and exact evidence items, verify 5/12 bounds, deselection cleanup, consent, keyboard operation, validation, and submission pending/error states.
5. Submit and open `/applications`; verify Opportunity/Organization links and the exact immutable snapshot.
6. Change source profile/Project/evidence fixture data, reopen the application, and verify the snapshot is unchanged.
7. Sign in as candidate B and Organization B recruiter; verify candidate A proof/application is absent and direct application IDs fail safely.
8. Verify public showcase contributor/profile links still follow current privacy and explicit visibility behavior.

At every width require no horizontal page overflow, clipped dialogs, unreachable controls, layout overlap, or touch target below 44px. Across the run require zero uncaught console errors, React warnings, CSP/CORS failures, unexpected 4xx/5xx from supported flows, failed assets, duplicate/infinite requests, or secret-bearing network payloads. Clean up fixture-owned records in `finally`, even when QA fails.

## Performance Risks and Mitigations

- **Evidence growth:** A user can accumulate many records. Use the new user/status/public-safe/Project/time index, bounded Project IDs, projections, and server caps; never load all evidence and filter globally.
- **Participation growth:** A long-lived user may join many Projects. Bound candidate participations before Project/evidence expansion, use the exact profile-opt-in index for public profiles, and report truncation through deterministic caps rather than hidden extra queries.
- **Repeated Project per skill:** Group a bounded Project set in memory once. Do not query per skill and do not duplicate the same Project in counts.
- **Opportunity list regression:** Compute relevant proof only for one authenticated detail request, never for search/list cards.
- **Application picker payload:** Cap eligible Projects at 25 and evidence choices at 5 each; snapshot limits remain 5/12.
- **Index rollout:** `syncIndexes`/production index creation remains governed by existing operational workflows. Phase E changes code declarations and verification only; it does not modify Atlas or run production index operations.
- **Stale source state:** Submission revalidates inside the transaction. A stale browser selection receives the canonical safe error and refreshes eligible choices; it never snapshots now-private data.

## Acceptance Criteria

- Public professional profiles show concise canonical skill-to-Project connections only for the strict public/opt-in/showcase/public-safe intersection.
- Profile completeness, onboarding, existing Project cards, and public profile privacy behavior remain compatible.
- Signed-in Opportunity detail shows only the caller's exact required-skill Project proof, with no score, ranking, endorsement, eligibility change, or employer exposure.
- Native application UI supports deliberate exact Project and evidence selection; backend identity and visibility remain authoritative.
- Private/inactive Team ancestry, private/incomplete Projects, non-public-safe/revoked evidence, other-user evidence, private profiles, applications, and applicants never leak.
- Application snapshots remain immutable and bounded after all source changes.
- Public showcase contributor information remains within existing public-profile and explicit-visibility rules.
- Opportunity and Organization navigation is safe, internal, concise, and based on serialized canonical fields.
- Marketplace tasks and ProjectTasks remain separate with no cross-domain reads or writes.
- Focused/full tests, Mongo/API/domain integrations, query plans, lint, production build/config, secret scan, and all browser widths pass with fresh recorded results.
- No P0/P1 privacy, IDOR, correctness, performance, accessibility, console, or network issue remains.
- No commit, push, deployment, cloud change, production mutation, or secret exposure occurs.

## Rollback Considerations

- All API changes are additive. Older frontends ignore `proof_connections`, `relevant_proof`, and added eligible-Project fields.
- Removing the Phase E frontend components returns profile/Opportunity/application UI to current behavior without data migration.
- Removing proof-service calls restores existing DTOs; submitted application snapshots remain valid because their schema does not change.
- New indexes may safely remain if application code is rolled back; do not drop indexes automatically or alter Atlas during rollback.
- If explain plans fail, stop with Phase E gate FAIL. Do not replace indexed queries with collection loads or relax privacy predicates.
- Browser/integration fixtures use unique markers and cleanup only their own records. Failed cleanup is a reported blocker; never broaden deletion filters.
- `docs/PRODUCT_COHESION.md` must not claim Phase E completion until all gates pass; if work is rolled back, leave the accepted design and implementation plan as historical records and restore the product document to the last verified phase.

## Review Focus

- A public Project under a private Team must be absent everywhere Phase E uses proof.
- Same skill text with different canonical IDs must never connect.
- Revoked or `public_safe=false` evidence must never appear even when referenced by an otherwise public Project/showcase.
- A candidate must never see another candidate's proof or immutable application through injected IDs or Organization context.
- A submitted snapshot must remain byte-stable after every live profile/Project/evidence visibility change.

## Phase E Gate

Phase E passes only when the acceptance criteria and every verification category above have fresh evidence. Any unresolved P0/P1 issue, missing query-plan proof, incomplete IDOR matrix, failed required width, unclean console/network trace, or unverified immutable snapshot makes the gate fail. Stop after the Phase E acceptance report and do not begin another phase automatically.
