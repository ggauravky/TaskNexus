# Phase D Role-Aware Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add compact, role-aware onboarding to the existing client and freelancer dashboards, with every step and completion state derived from authoritative profile, marketplace-task, review, and public-safe proof facts rather than stored checklist state.

**Architecture:** Add a pure onboarding domain derivation layer plus a thin service that gathers only the authenticated user's existing facts. Extend the existing client and freelancer dashboard responses with an explicit `onboarding` DTO; do not add a route, collection, progress counter, or user-controlled completion mutation. One shared dashboard component renders only applicable steps and disappears when the backend summary is complete. Existing profile, task, review, project, evidence, and showcase workflows remain the actions that change completion.

**Tech Stack:** Node.js, Express, Mongoose/MongoDB, Jest/Supertest, React 18, React Router, Axios, Node test runner, existing Tailwind/CSS primitives, and existing TaskNexus dashboard/profile/task services.

**Spec:** `docs/superpowers/specs/2026-10-14-product-cohesion-design.md`, section 10 (Phase D), with the shared security, accessibility, responsive, error, and operational rules in sections 12-19.

## Global Constraints

- Implement only Phase D. Do not begin Profile -> Proof -> Opportunity integration, skill-to-proof presentation, relevant-opportunity proof, or any other Phase E work.
- Do not add an onboarding collection, persisted checklist, mutable progress percentage, completion timestamp, or client-writable completion endpoint.
- The legacy `user_profiles.onboarding_completed` field may remain for compatibility with the existing guided profile wizard, but Phase D must neither read it nor write it when deriving dashboard onboarding.
- Extend the existing `GET /api/client/dashboard` and `GET /api/freelancer/dashboard` aggregates. Do not add a generic onboarding endpoint or mega-endpoint.
- Derive every item from the authenticated user's authoritative records. Do not accept a user ID, role, completion flag, applicability flag, task ID, or action target from the browser.
- Keep marketplace `tasks` separate from project `project_tasks`. Marketplace onboarding facts may use only `tasks`; public-safe proof may use existing Project/participant/evidence/showcase facts without merging the domains.
- Treat canonical professional availability (`user_profiles.availability`: `open|limited|unavailable`) as distinct from legacy marketplace availability (`users.freelancer_profile.availability`: `available|part_time|busy`). Only canonical professional availability completes the onboarding item.
- Reuse the canonical professional profile, skill catalog, task workspace, project/showcase, dashboard commands, shared primitives, safe API error helper, and dark visual system.
- Add one compact section to each overview; do not redesign dashboards, add a new dashboard, add an AppShell control, or alter Phase A-C surfaces beyond required links/refetch integration.
- All action targets are backend-generated, internal, allow-listed paths and are checked again by the frontend before navigation.
- Do not deploy, push, modify Render/Vercel/Atlas, change cloud configuration, expose secrets, or create a commit without explicit authorization.

## Verified Baseline and Planning Checkpoint

- Branch: `codex/unified-work-hub`.
- HEAD: `439d28f` (`Harden Phase C search QA and cancellation`).
- `origin/codex/unified-work-hub` also points to `439d28f`.
- Working tree was clean before this plan file was created.
- Phase C technical completion is the accepted baseline. This planning task does not rerun or mutate the application baseline.

## Existing Capability Audit

| Area | Current implementation | Phase D decision |
| --- | --- | --- |
| Client dashboard | `GET /api/client/dashboard` loads the authenticated client's marketplace tasks and payments, then returns task/financial summaries and bounded recent/attention rows | Reuse the already-loaded task rows and append one serialized `onboarding` summary; add only the authenticated profile/review facts not already present |
| Freelancer dashboard | `GET /api/freelancer/dashboard` loads assigned marketplace tasks, payments, reviews, performance, and current work | Reuse the already-loaded task rows and append one serialized `onboarding` summary; add only canonical profile/skill/public-proof facts |
| Canonical professional profile | `GET/PUT /api/profile` uses `User`, `UserProfile`, `UserSkill`, and `UserEducation`; `calculateCompleteness` returns ten factual checks | Reuse the same underlying facts. Refactor named completeness checks so onboarding and profile completeness cannot drift, while preserving the existing percentage/missing response exactly |
| Guided profile setup | `/profile/onboarding` is a four-step professional wizard and persists the legacy `onboarding_completed` flag | Keep it as the freelancer professional setup experience, but do not treat its flag as Phase D completion. New clients go to their dashboard checklist instead of being forced through the professional wizard |
| Legacy role profile pages | `/client/profile` and `/freelancer/profile` redirect to `/profile`; the older `ClientProfile.jsx` and `FreelancerProfile.jsx` implementations are not current route targets | Do not revive or redesign the legacy pages. Checklist profile actions target the canonical `/profile` or retained freelancer wizard |
| Canonical skills | `UserSkill` plus `Skill`, written by `PUT /api/profile/skills`, with a maximum of 30 skills and an indexed `user_id` lookup | Require at least one canonical `UserSkill`; never count the legacy free-text `freelancer_profile.skills` array |
| Availability | Canonical professional availability lives on `UserProfile`; a separate freelancer dashboard selector writes legacy marketplace availability | Count only canonical availability. Clarify the existing selector's accessible label as marketplace-task availability; do not silently map one field to the other |
| Marketplace tasks | `Task` records retain current status plus workflow timestamps such as `assignedAt`, `startedAt`, `deliveredAt`, and `completedAt`; dashboards already load the authenticated role's tasks | Derive first assignment, start/tracking, delivery, and completion from these rows and timestamps. Do not query or count `ProjectTask` |
| Client reviews/ratings | `Review` has a unique `{ task_id, reviewer_id, review_type }` index; client ratings use `review_type=client_to_platform` | Add a bounded existence check for a rating on one of the authenticated client's completed task IDs; never load another client's reviews |
| Public-safe proof | `listPublicProfileProjects` already defines the strict public chain: public profile, `show_on_profile` participant, active evidence, completed public Project, active public Team, published showcase | Reuse that definition through a new bounded boolean helper. Phase D returns only `true|false`; it does not return proof details or implement Phase E connections |
| Frontend dashboard freshness | Both dashboards reload on mount/manual refresh and reconcile relevant task SSE events; client task creation and dashboard task mutations already refresh their aggregates | The embedded onboarding summary updates through the same correctness paths. Returning from profile/project actions remounts/reloads the dashboard; relevant task events trigger the existing targeted dashboard refresh |

## Completion Model

### State semantics

Each stable checklist item has:

```json
{
  "id": "profile_fundamentals",
  "label": "Complete your professional profile",
  "description": "Add the core details collaborators need.",
  "applicable": true,
  "complete": false,
  "action": {
    "label": "Update profile",
    "target_path": "/profile"
  }
}
```

- `complete` is always a backend-derived boolean.
- `applicable=false` means the prerequisite stage has not occurred. It is not counted as incomplete and is not rendered as a blocked or false-negative task.
- `completed_count` and `total_count` count applicable items only.
- `is_complete` is true when every currently applicable item is complete. The UI renders nothing when `is_complete=true`.
- A later real event may make another item applicable. The next dashboard refresh then makes the compact checklist reappear with that actionable step.
- If a reversible prerequisite becomes incomplete (for example, all skills are removed or canonical availability becomes `unavailable`), its item becomes incomplete again and the checklist reappears.
- Items use a stable role-specific order; the frontend does not recalculate completion, applicability, or progress.

### Named professional-profile facts

Refactor the existing profile completeness calculation to expose named checks without changing its public result:

- `name`: trimmed `User.profile.firstName` and `User.profile.lastName` are both non-empty.
- `username`: `UserProfile.username` is non-empty.
- `headline`: `UserProfile.headline` is non-empty.
- `bio`: `UserProfile.bio` has at least 80 characters, matching current completeness.
- `location_and_timezone`: both canonical fields are non-empty.
- `availability`: canonical value is `open` or `limited`.
- `professional_link`, `interests_and_roles`, `skills`, and `education`: retain the existing completeness rules unchanged.

`calculateCompleteness` continues returning the current `{ percentage, completed, total, missing }` contract. Phase D consumes named facts instead of copying the conditions.

## Exact Client Rules

| Item ID | Applicable when | Complete when | Real action |
| --- | --- | --- | --- |
| `client_identity` | Always | `name && username` from canonical profile facts | `Update profile` -> `/profile` |
| `create_marketplace_task` | Always | The authenticated client has created at least one marketplace `Task`, including a later-cancelled task | `Create task` -> `/client/dashboard?action=create-task` |
| `track_first_task` | At least one owned task has been assigned, based on `workflow.assignedAt`, a current `freelancer_id`, or a current post-assignment status | At least one owned task has started, based on `workflow.startedAt` or a current status at/after `in_progress` | `Open task workspace` -> the most recently updated relevant `/tasks/:id?tab=work` |
| `review_and_rate_delivery` | At least one owned task is currently `delivered`, or at least one owned task is `completed` without a client rating | At least one owned completed task has a `client_to_platform` Review by the authenticated client | For delivered work, `Review delivery` -> newest `/tasks/:id?tab=delivery`; otherwise `Rate completed work` -> newest unrated completed task's Delivery tab |

Client progression is deliberately stage-aware. A new client sees identity and create-task actions. Assignment makes tracking applicable; delivery/completion makes review/rating applicable. A waiting downstream stage is not shown as an incomplete obligation the client cannot yet perform.

## Exact Freelancer Rules

| Item ID | Applicable when | Complete when | Real action |
| --- | --- | --- | --- |
| `profile_fundamentals` | Always | `name && username && headline && bio && location_and_timezone` from canonical profile facts | `Complete profile` -> `/profile` |
| `canonical_skill` | Always | At least one canonical `UserSkill` exists | `Add skills` -> `/profile` |
| `professional_availability` | Always | `UserProfile.availability` is `open` or `limited` | `Set availability` -> `/profile` |
| `first_marketplace_assignment` | Always | At least one marketplace task has `workflow.assignedAt`, a current matching `freelancer_id`, or a current post-assignment status | `Find work` -> `/freelancer/dashboard?view=available` |
| `complete_marketplace_work` | A first marketplace assignment exists | At least one assigned marketplace task has `workflow.completedAt` or current status `completed` | Prefer newest active `/tasks/:id?tab=work`; otherwise `My work` -> `/freelancer/dashboard?view=work` |
| `publish_public_safe_proof` | Completed marketplace work exists | The existing strict public-profile project chain has at least one result | `Build project proof` -> `/projects` |

The proof item is only a boolean readiness milestone over existing public-safe Project/evidence/showcase records. It must not expose evidence, connect skills to proof, score the freelancer, recommend opportunities, or snapshot application data; those remain Phase E concerns.

## Dashboard API Contract

No new route is added. Both role dashboard responses gain an additive field:

```json
{
  "success": true,
  "data": {
    "...existingDashboardFields": "unchanged",
    "onboarding": {
      "role": "freelancer",
      "is_complete": false,
      "completed_count": 3,
      "total_count": 5,
      "items": []
    }
  }
}
```

Contract rules:

- `role` is derived from the authenticated route/user and is only `client` or `freelancer`.
- Items are returned in stable defined order, including currently non-applicable items so API/domain tests can verify transitions. The frontend renders only `applicable=true` items.
- `action.target_path` is selected from constants or validated task UUIDs; it never comes from stored free text or request input.
- The DTO contains no email, phone, raw profile object, task description, payment data beyond existing dashboard fields, evidence metadata, applicant data, storage identifiers, or foreign user IDs.
- Admin dashboards remain unchanged and receive no onboarding field.
- Existing dashboard fields and envelopes remain backward compatible.

## Authorization and Privacy

- Existing `authenticate + requireClient` and `authenticate + requireFreelancer` middleware remain the first boundary.
- The controller passes `req.user` and only task rows already filtered by `client_id=req.user.id` or `freelancer_id=req.user.id` into the onboarding service.
- Review existence includes both the authenticated `reviewer_id` and a task ID from that client's completed owned-task set.
- Canonical profile and skill reads use only `req.user.id`.
- Public-safe proof checks use only the authenticated freelancer ID and the existing strict visibility chain; they return a boolean, never proof rows.
- Request query/body values such as `userId`, `role`, `complete`, and `taskId` are ignored because the dashboard routes define no such input contract.
- Cross-role calls retain the current `403`; missing/invalid authentication retains the current `401`.
- Tests must demonstrate that a client cannot retrieve freelancer onboarding, a freelancer cannot retrieve client onboarding, and neither can influence another account's facts.

## Query and Performance Design

- Reuse the task arrays already loaded for each dashboard. Phase D must not add another marketplace-task query or load `project_tasks`.
- Use the authenticated `req.user` already loaded by auth middleware; do not refetch the `User` record.
- Fetch `UserProfile` and canonical `UserSkill` facts concurrently. `UserSkill` is capped by the existing model limit; a boolean/`exists` method is preferred when implementation can preserve existing profile-service behavior.
- Add `reviewData.hasClientRating({ reviewerId, taskIds })` using `Review.exists`/`findOne` with projection and the existing `{ task_id, reviewer_id, review_type }` index.
- Add `showcaseService.hasPublicProfileProof(userId)` as a short-circuit sequence of indexed existence queries or a bounded aggregation ending in `$limit: 1`. It must preserve every existing public-safe condition and never materialize all profile projects.
- Verify the new rating and proof query shapes with real non-production MongoDB `explain("executionStats")`. Required findings are an index-backed plan, bounded returned documents, and no unbounded collection scan. If this cannot be demonstrated, report the performance blocker; do not weaken the rule or silently omit a condition.
- The existing dashboard controllers currently materialize all of the authenticated user's marketplace tasks/payments. Phase D reuses that existing behavior and does not expand its scope; any broader dashboard pagination redesign remains outside this phase.

## Frontend Component Structure

```text
frontend/src/
  components/onboarding/
    RoleOnboardingChecklist.jsx   # compact, role-neutral rendering only
  utils/
    onboarding.js                 # render filtering and strict internal target allow-list
  pages/
    ClientDashboard.jsx           # overview integration only
    FreelancerDashboard.jsx       # overview integration + clarified legacy availability label
    Register.jsx                  # role-aware post-registration destination
    ProfileOnboarding.jsx         # retained professional freelancer wizard destination
```

`RoleOnboardingChecklist` behavior:

- Return `null` for a missing summary, unsupported role, or `is_complete=true`.
- Render one compact `<section>` under the overview metrics, using the existing dark surface/border/spacing system and no new hero/header.
- Render applicable items in an ordered list; completed rows use icon plus text (not color alone), incomplete rows expose one touch-safe link.
- Announce `completed_count of total_count` in visible text and expose a labelled native/progress semantic without creating a second percentage truth.
- Preserve the existing dashboard `h1`; the component uses an `h2` and a labelled region.
- Reject any target outside the exact onboarding allow-list: `/profile`, `/projects`, the approved dashboard query shapes, and `/tasks/:uuid?tab=work|delivery`.
- Use existing link/navigation behavior; no modal, focus trap, dismissal state, local storage, or client-side completion toggle is added.

Role-aware entry behavior:

- After registration, clients navigate to `/client/dashboard` and see the compact checklist rather than being forced through the professional freelancer wizard.
- Freelancers retain `/profile/onboarding` as the guided professional setup. Finishing it returns them to `/freelancer/dashboard`; the dashboard's backend-derived checklist remains authoritative and may still show task/proof steps.
- Direct client access to `/profile/onboarding` redirects safely to `/client/dashboard`; administrators remain excluded by route policy.
- `/profile` remains the single canonical editor for both client identity and freelancer professional facts. The unrouted legacy role-profile pages are not modified.

## Loading, Error, and Freshness Behavior

- Because onboarding is part of each dashboard aggregate, the existing initial dashboard loading state covers it; do not add a second request waterfall or skeleton.
- A failed authoritative derivation fails the dashboard request through the canonical safe API error path. The existing full dashboard retry remains available; never fabricate a completed or empty checklist on backend failure.
- For rolling compatibility, a missing `onboarding` field renders no checklist rather than an incorrect one; tests still require the new backend to return it for valid client/freelancer requests.
- Client task creation already calls `loadOverview`; preserve that path so `create_marketplace_task` completes immediately.
- Existing task SSE handlers refresh the aggregate after task status/progress events. Ensure assignment, start, delivery, completion, and review/rating success paths cause an aggregate refresh either through existing events or the existing return-to-dashboard/mutation refresh path.
- Profile/skills/availability/project actions navigate to existing pages. Returning to the dashboard remounts and reloads the authoritative aggregate; no stale local completion is retained.
- Buttons/links use the canonical safe error helper only where a request is performed; the checklist itself has no mutation.

## Task 1: Freeze the Pure Completion Contract

**Files:**

- Create: `backend/src/domain/onboarding.js`
- Modify: `backend/src/domain/professionalProfile.js`
- Create: `backend/tests/onboarding.domain.test.js`
- Modify: `backend/tests/professionalProfile.domain.test.js`

- [ ] **Step 1: Write failing named-profile-fact tests**

  Cover whitespace-only fields, the 80-character bio boundary, canonical availability, canonical skill presence, and preservation of the existing ten-part completeness result.

- [ ] **Step 2: Write failing client derivation tests**

  Cover a new client, complete identity only, first task creation, assigned-but-not-started, started work, delivered work, completed-unrated work, rated work, cancelled history, deterministic newest-task targeting, and non-applicable downstream steps.

- [ ] **Step 3: Write failing freelancer derivation tests**

  Cover missing fundamentals, legacy-only skills, canonical skills, legacy versus canonical availability, first assignment, active work, completed work, public-proof false/true, and regression from complete to incomplete after a reversible fact is removed.

- [ ] **Step 4: Run RED**

  Run `npm --prefix backend test -- onboarding.domain.test.js professionalProfile.domain.test.js` and confirm failures are caused by the absent named-fact/onboarding contract.

- [ ] **Step 5: Implement the smallest pure functions**

  Export named profile checks without changing `calculateCompleteness`, define stable item IDs/order, compute applicability/counts/completion, and build targets only from constants or validated UUIDs.

- [ ] **Step 6: Run GREEN and review the domain diff**

  Rerun the same focused tests and confirm all exact transition cases pass. Do not commit.

## Task 2: Add Bounded Fact Orchestration

**Files:**

- Create: `backend/src/services/onboardingService.js`
- Modify: `backend/src/data/reviewData.js`
- Modify: `backend/src/services/showcaseService.js`
- Modify: `backend/src/serializers/index.js`
- Create: `backend/tests/onboardingService.test.js`

- [ ] **Step 1: Write failing orchestration tests**

  Mock profile, skill, review, and showcase dependencies. Assert authenticated IDs are the only IDs passed; client and freelancer dependencies are role-specific; reviews are limited to owned completed tasks; proof returns only a boolean; and downstream calls are skipped when their prerequisite is not applicable.

- [ ] **Step 2: Write failing explicit-serializer tests**

  Assert stable snake_case fields, stable item order, internal target validation, exact counts, and rejection/omission of malformed target paths or unexpected private fields.

- [ ] **Step 3: Run RED**

  Run `npm --prefix backend test -- onboardingService.test.js onboarding.domain.test.js`.

- [ ] **Step 4: Implement bounded rating existence**

  Add `hasClientRating` using the indexed authenticated reviewer/task/type predicate and return a boolean. Empty task-ID input must return false without a Mongo query.

- [ ] **Step 5: Implement bounded public-safe proof existence**

  Reuse every condition from `listPublicProfileProjects`, short-circuit each stage, and stop after the first qualifying result. Do not return project/evidence/showcase data.

- [ ] **Step 6: Implement the role orchestration service and serializer**

  Use canonical profile/skill facts, already-loaded marketplace tasks, and prerequisite-aware calls. Unsupported/admin roles return no checklist rather than being coerced into another role.

- [ ] **Step 7: Run GREEN and regression**

  Run `npm --prefix backend test -- onboardingService.test.js onboarding.domain.test.js profileService.test.js contributions.domain.test.js projects.domain.test.js` and review the diff. Do not commit.

## Task 3: Extend Existing Dashboard APIs

**Files:**

- Modify: `backend/src/controllers/clientController.js`
- Modify: `backend/src/controllers/freelancerController.js`
- Create: `backend/tests/onboarding.api.test.js`
- Modify if shared mocks require it: relevant existing dashboard/controller tests

- [ ] **Step 1: Write failing API contract and RBAC tests**

  Assert authentication, client-only/freelancer-only routes, additive `data.onboarding`, unchanged existing dashboard fields, admin exclusion, ignored caller-supplied identity hints, and no private/profile/proof payload leakage.

- [ ] **Step 2: Write failing transition response tests**

  Mock new, partial, task-assigned, task-delivered, completed, rated, and proof-complete facts and assert exact applicability/count changes in the returned DTO.

- [ ] **Step 3: Run RED**

  Run `npm --prefix backend test -- onboarding.api.test.js clientController.review.test.js`.

- [ ] **Step 4: Integrate service calls without duplicate task reads**

  Pass `req.user` plus each controller's existing `allTasks` to the onboarding service. Fetch independent dashboard and onboarding dependencies concurrently where safe; preserve existing envelopes and error handling.

- [ ] **Step 5: Run GREEN and role regression**

  Rerun the focused API tests plus `taskWorkspace.test.js`, `profile.api.test.js`, and `auth.security.test.js`. Confirm no route or middleware expansion. Do not commit.

## Task 4: Build the Shared Compact Checklist

**Files:**

- Create: `frontend/src/utils/onboarding.js`
- Create: `frontend/src/components/onboarding/RoleOnboardingChecklist.jsx`
- Create: `frontend/tests/onboardingState.test.js`
- Create: `frontend/tests/onboardingWiring.test.js`

- [ ] **Step 1: Write failing pure frontend tests**

  Cover complete/missing/unsupported summaries, applicable-item filtering, server count preservation, stable render order, approved exact paths, approved task-tab paths, and rejection of external/protocol-relative/malformed/encoded targets.

- [ ] **Step 2: Write failing component wiring/accessibility assertions**

  Verify an `h2`, labelled section, ordered list, textual completion state, touch-safe action links, non-color completed state, and `null` rendering for `is_complete=true`.

- [ ] **Step 3: Run RED**

  Run `node --test frontend/tests/onboardingState.test.js frontend/tests/onboardingWiring.test.js`.

- [ ] **Step 4: Implement the utility and component**

  Treat backend completion as authoritative, validate targets defensively, use existing dark primitives/tokens, and keep the component role-neutral and mutation-free.

- [ ] **Step 5: Run GREEN and lint the new surface**

  Rerun the two Node tests, then `npm --prefix frontend run lint`. Do not commit.

## Task 5: Wire Role-Aware Entry and Dashboard Freshness

**Files:**

- Modify: `frontend/src/pages/ClientDashboard.jsx`
- Modify: `frontend/src/pages/FreelancerDashboard.jsx`
- Modify: `frontend/src/pages/Register.jsx`
- Modify: `frontend/src/pages/ProfileOnboarding.jsx`
- Modify: `frontend/tests/onboardingWiring.test.js`
- Modify only if required for a reusable route decision: `frontend/src/utils/commandPalette.js` and its existing tests

- [ ] **Step 1: Add failing dashboard-placement and refresh tests**

  Assert the checklist appears only in each `overview`, receives only `dashboard.onboarding`, does not add a request, and remains covered by existing overview refresh/task-event paths.

- [ ] **Step 2: Add failing role-entry tests**

  Assert new clients navigate to `/client/dashboard`, new freelancers to `/profile/onboarding`, wizard completion returns freelancers to `/freelancer/dashboard`, and client access to the wizard resolves to the client dashboard.

- [ ] **Step 3: Add the compact dashboard integration**

  Place the component directly below the existing overview metrics. Do not alter dashboard navigation, headers, tables, legacy task modals, notification/search controls, or non-overview views.

- [ ] **Step 4: Preserve automatic refresh behavior**

  Confirm task creation, task mutation/SSE events, and route remounts all replace the full dashboard summary. Add a narrowly scoped refresh trigger only if a proven same-mount stale path exists; do not introduce polling solely for onboarding.

- [ ] **Step 5: Clarify availability terminology**

  Change only the freelancer header selector's accessible label/copy to `Marketplace task availability`; do not map it to or count it as canonical professional availability.

- [ ] **Step 6: Run focused frontend tests and dashboard regressions**

  Run `node --test frontend/tests/onboardingState.test.js frontend/tests/onboardingWiring.test.js frontend/tests/commandPaletteWiring.test.js frontend/tests/taskWorkspacePermissions.test.js`, followed by frontend lint. Do not commit.

## Task 6: Prove Mongo and API Integration Safely

**Files:**

- Modify: `backend/scripts/verifyMongoIntegration.js`
- Modify: `backend/scripts/verifyMongoApi.js`
- Create: `backend/scripts/phaseDOnboardingBrowserFixture.js`
- Modify: `backend/package.json`
- Modify if a root convenience alias is warranted: `package.json`

- [ ] **Step 1: Add uniquely owned fixtures**

  Generate random IDs/marker-prefixed `.invalid` accounts for a new and progressed client/freelancer, canonical profiles/skills, marketplace tasks at required stages, one client rating, and one strict public-safe proof chain. Use securely generated disposable passwords without logging them.

- [ ] **Step 2: Preserve the database safety guard**

  Require the existing non-production environment/database validation and explicit confirmation flag. Never rename the database, create another database, modify Atlas, or broaden allowed production-like names.

- [ ] **Step 3: Make cleanup test-owned and idempotent**

  Delete only the generated fixture IDs/marker and include all dependent rows. Run cleanup before and in `finally`; never use broad role/email/domain deletes.

- [ ] **Step 4: Add Mongo assertions and explain checks**

  Assert profile facts, canonical-skill truth, legacy/canonical availability separation, marketplace-task-only derivation, client-rating ownership, strict public-proof visibility, transition/reappearance, and index-backed bounded review/proof plans.

- [ ] **Step 5: Add API integration assertions**

  Call both role dashboards with disposable account tokens; assert exact onboarding states, cross-role `403`, unauthenticated `401`, ignored identity injection, automatic state changes after real profile/task/review/proof writes, and absence of sensitive fields.

- [ ] **Step 6: Run the integration gates**

  Run `npm run verify:mongodb-integration` and `npm run verify:api-integration` against the explicitly verified non-production integration database. Capture actual assertions/counts and cleanup result.

## Task 7: Full Verification, Browser Acceptance, and Documentation

**Files:**

- Modify: `docs/PRODUCT_COHESION.md`
- Create during QA only if the repository convention requires a durable record: `docs/phase-d-onboarding-browser-qa.md`

- [ ] **Step 1: Run focused Phase D tests**

  Run all new backend onboarding tests, named professional-profile tests, new frontend onboarding tests, and the directly affected profile/dashboard/task tests. Record exact suite/test counts.

- [ ] **Step 2: Run full regressions**

  Run full backend Jest, all frontend Node tests, backend lint, frontend lint, the Vite production build/config verifier, production verifier, Mongo integration, API integration, and secret scan. Do not substitute assumed counts for command output.

- [ ] **Step 3: Perform client browser acceptance**

  At 320, 375, 390, 430, 768, 1024, and 1440 pixels, verify new client -> compact dashboard checklist; identity action; real task creation; hidden state while downstream work is not applicable; reappearance at assignment/delivery; task-workspace deep links; review/rating completion; final disappearance; and reappearance after a reversible profile prerequisite is removed.

- [ ] **Step 4: Perform freelancer browser acceptance**

  At every required width, verify professional wizard entry; canonical profile/skill/availability completion; legacy marketplace availability does not falsely complete the canonical item; find/accept/start/complete task progression; public-safe project proof; final disappearance; and reappearance after canonical skill/availability removal.

- [ ] **Step 5: Verify accessibility and operational cleanliness**

  Keyboard through every checklist link; verify visible focus, semantic heading/list/progress text, 44px-equivalent touch targets where practical, screen-reader text beyond color, no horizontal page overflow, zero uncaught console errors/React warnings/CSP/CORS failures/unexpected 404s/infinite loops, and no production/cloud calls.

- [ ] **Step 6: Update implementation documentation**

  Replace the Phase D `unimplemented` note in `docs/PRODUCT_COHESION.md` only after all gates pass. Document exact derivation, canonical availability boundary, dashboard response addition, progressive applicability, and absence of stored checklist state.

- [ ] **Step 7: Inspect the final repository state**

  Run `git status`, `git diff --stat`, full relevant `git diff`, and `git diff --check`. Confirm no `.env`, credentials, generated artifacts, temporary screenshots, infrastructure changes, Phase E code, deployment, push, or unauthorized commit.

## Test Matrix

### Backend unit/API

- New client and freelancer receive the correct foundational items.
- Partial profiles use canonical named checks and exact bio boundary.
- Legacy `onboarding_completed=true` cannot complete or hide the dashboard checklist.
- Legacy free-text freelancer skills cannot satisfy the canonical skill item.
- Legacy marketplace availability cannot satisfy professional availability.
- Assignment/start/delivery/completion/rating transitions change only the intended items.
- Non-applicable downstream items do not inflate totals or show as incomplete.
- Reversible canonical prerequisites cause the checklist to reappear.
- Marketplace `tasks` are counted; `project_tasks` are never counted.
- Public proof is true only for the complete existing visibility/evidence/showcase chain.
- Client/freelancer cross-role access and caller-supplied identity hints cannot cross account boundaries.
- Serializer output is explicit, stable, and free of private fields.

### Frontend

- Complete summaries render nothing.
- Partial summaries render only applicable items in backend order.
- Unsafe targets are not rendered/navigated.
- Client and freelancer use the shared component without role-specific completion logic.
- Existing dashboard loading/retry states remain authoritative.
- New registration destinations are role-aware.
- Dashboard/task/profile navigation causes authoritative refresh rather than local checkbox updates.
- Accessibility semantics and focus styles are present.

### Integration

- Non-production Mongo fixtures demonstrate every role stage with test-owned cleanup.
- Real dashboard APIs return exact derived state and preserve old fields.
- Explain plans show indexed, bounded rating/proof queries.
- Full profile, marketplace task, review, project/contribution/showcase, Phase A-C, and security regressions remain green.

## Expected Files Changed

Expected additions:

- `backend/src/domain/onboarding.js`
- `backend/src/services/onboardingService.js`
- `backend/tests/onboarding.domain.test.js`
- `backend/tests/onboardingService.test.js`
- `backend/tests/onboarding.api.test.js`
- `backend/scripts/phaseDOnboardingBrowserFixture.js`
- `frontend/src/components/onboarding/RoleOnboardingChecklist.jsx`
- `frontend/src/utils/onboarding.js`
- `frontend/tests/onboardingState.test.js`
- `frontend/tests/onboardingWiring.test.js`
- Optional final QA record: `docs/phase-d-onboarding-browser-qa.md`

Expected modifications:

- `backend/src/domain/professionalProfile.js`
- `backend/src/data/reviewData.js`
- `backend/src/services/showcaseService.js`
- `backend/src/serializers/index.js`
- `backend/src/controllers/clientController.js`
- `backend/src/controllers/freelancerController.js`
- `backend/scripts/verifyMongoIntegration.js`
- `backend/scripts/verifyMongoApi.js`
- `backend/package.json`
- `frontend/src/pages/ClientDashboard.jsx`
- `frontend/src/pages/FreelancerDashboard.jsx`
- `frontend/src/pages/Register.jsx`
- `frontend/src/pages/ProfileOnboarding.jsx`
- `docs/PRODUCT_COHESION.md`
- Existing tests/package scripts only where the implementation requires their mocks or a safe QA command

Not expected to change: database models/collections, cloud/infrastructure files, AppShell, Notification Center, Global Search API/palette behavior, Task Workspace contracts, dashboard information architecture, legacy task-detail modals, or Phase E profile/opportunity surfaces.

## Rollback Considerations

- The API change is additive. Removing `data.onboarding` and the two dashboard component insertions restores the prior behavior without a data migration.
- No collection, persisted checklist, or schema migration exists to roll back.
- The pure derivation and serializers have no side effects.
- Existing profile wizard and `onboarding_completed` storage remain compatible; Phase D simply does not use the flag as truth.
- Review/proof helpers are read-only and can be removed independently if their explain-plan gate fails.
- If a browser-entry change regresses registration, revert only the role-aware destination logic; account creation remains unchanged.

## Phase D Acceptance Gate

Phase D passes only when all of the following are demonstrated with fresh evidence:

- Client and freelancer dashboard summaries are fully backend-derived, role-correct, and contain no stored checklist state.
- Every exact completion/applicability rule above passes new unit and API tests.
- No new endpoint, collection, mutable completion mutation, or Phase E proof/opportunity connection exists.
- Canonical professional profile, skill, and availability sources are used; legacy marketplace fields cannot falsely complete professional onboarding.
- Real profile/task/review/project actions update progress automatically through existing dashboard refresh paths.
- The checklist is compact, accessible, responsive, hidden when complete, and able to reappear when authoritative facts require it.
- Client/freelancer IDOR and role boundaries pass.
- Mongo/API integration, explain-plan checks, full tests, lint, production build/config verification, production verifier, and secret scan pass.
- Browser QA passes at 320, 375, 390, 430, 768, 1024, and 1440 pixels with clean console/network behavior.
- Final diff contains only Phase D implementation, tests, fixtures, and documentation; no commit, push, deployment, or cloud change occurs without separate authorization.

## Remaining Questions or Blockers

- No planning blocker remains.
- The existing dashboard aggregates materialize all role-owned marketplace tasks/payments. Phase D deliberately reuses those rows and adds no second scan; scaling that pre-existing aggregate is a separate concern.
- The public-safe proof boolean must pass its real Mongo explain-plan gate. If the existing indexes do not support the strict short-circuit query as expected, implementation must report that as a Phase D performance blocker rather than weakening privacy or adding an unapproved index/cloud change.
- The legacy `onboarding_completed` field and unrouted legacy role profile components remain technical debt, but removing them is not required for Phase D and would expand risk without improving the derived checklist contract.
