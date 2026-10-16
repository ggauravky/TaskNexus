# Phase C Global Search and Command Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an authenticated, privacy-safe global search endpoint and accessible AppShell command palette that searches seven existing domains, exposes role-appropriate navigation, and never returns more than five results per domain.

**Architecture:** Add one thin `GET /api/search` orchestration surface. It calls new bounded search methods inside the existing domain services, so visibility rules stay with their owning domains; those methods issue projected, indexed, database-limited queries and never load a collection for in-process filtering. The existing authenticated AppShell hosts a reusable dialog-based palette with static role actions plus debounced, cancellable API search.

**Tech Stack:** Node.js, Express, express-validator, Mongoose/MongoDB, Jest/Supertest, React 18, React Router, Axios, Node test runner, existing Tailwind/CSS primitives, and the existing `Dialog` component.

**Spec:** `docs/superpowers/specs/2026-10-14-product-cohesion-design.md`

## Global Constraints

- Implement only Phase C. Do not begin role-aware onboarding, Profile/Proof integration, or any Phase D/E work.
- Preserve marketplace `tasks` and project `project_tasks` as separate domains. Global search returns only marketplace tasks under the `tasks` group and labels their type `marketplace_task`.
- Require authentication for search and enforce all visibility decisions on the backend.
- Return at most five results for each of `teams`, `projects`, `people`, `hackathons`, `opportunities`, `organizations`, and `tasks`; callers cannot override the limit.
- Do not expose private teams/projects, hidden/private profiles, private evidence, native applications, applicants, or unauthorized marketplace tasks.
- Search results and quick actions may navigate only to explicit internal route shapes already owned by TaskNexus.
- Reuse existing domain services, authorization policies, serializers, rate limiting, AppShell, `Dialog`, API client, error formatter, and request-generation guard.
- Use MongoDB's existing indexes and database-side filters/projections/limits. Do not add a search collection, MongoDB text/Atlas Search index, Elasticsearch, vector database, AI search, or another service.
- Preserve the canonical dark design system and verify 320, 375, 390, 430, 768, 1024, and 1440 pixel widths.
- Do not deploy, push, modify Render/Vercel/Atlas, change environment configuration, expose secrets, or create a commit without explicit user authorization.

## Verified Baseline and Checkpoint

- Branch: `codex/unified-work-hub`.
- Clean checkpoint: `1046a2a` (`Add notification center and workspace safeguards`). It contains the Phase A, database-safety, and Phase B work and has no uncommitted files before this plan is added.
- The local branch and `origin/codex/unified-work-hub` already pointed to `1046a2a` before planning; this plan does not perform a push or other remote mutation.
- Fresh verification on 2026-10-16: backend Jest 40 suites / 292 tests, frontend Node tests 20/20, backend lint, frontend lint, Vite production build/config verification, Mongo integration, and API integration all pass.
- The API integration verifier must target the configured local server port: `http://localhost:10000/api` in the current development environment.

## Existing Search Capability Audit

| Domain | Existing API/service | Current visibility behavior | Phase C reuse/adaptation |
| --- | --- | --- | --- |
| Teams | `GET /api/teams`, `teamService.listTeams`, `teamData.listTeams` | Discovery returns public active teams; `scope=mine` may return private memberships | Add a five-row global-search method restricted to active public teams; private member teams remain outside global search |
| Projects | `GET /api/projects`, `GET /api/teams/:teamId/projects`, `projectService`, `projectData` | My-project and team-scoped reads may expose authorized team-only projects; effective public requires public team + public project | Add a bounded cross-team method restricted to effective-public projects and returning no participant/evidence data |
| People | `GET /api/people`, `discoveryService.discoverPeople` | Authenticated, public + discoverable profiles, active accounts, self/block exclusions; current discovery ranks a bounded candidate set in memory | Add a lightweight five-row method in `discoveryService` using the same privacy/block helpers but no evidence/project expansion or candidate materialization |
| Hackathons | `GET /api/hackathons`, `hackathonService.listHackathons` | Public/non-archived for normal users; administrators may explicitly view private records | Add a projected search method using the same role/visibility policy and no participation expansion |
| Opportunities | `GET /api/opportunities`, `opportunityService.listOpportunities` | Published/open/unexpired catalog results; candidate state decoration is separate | Add a projected search method using `openFilter`; never load candidate/native application state |
| Organizations | `GET /api/organizations`, `opportunityService.listOrganizations` | Active public organization summaries | Add a projected five-row search method with no membership/applicant data |
| Marketplace tasks | `GET /api/tasks`, client/freelancer task lists, `taskService`, `taskData.listTasks` | Role-filtered; some freelancer reads intentionally include unassigned discovery tasks | Add a strict search-context method: client owns task, freelancer is assigned, administrator may inspect; unassigned discovery stays in the freelancer dashboard |

## Endpoint Contract

`GET /api/search?q=<query>`

- Authentication: required for client, freelancer, and administrator roles.
- Validation: `q` must be a string, trimmed/collapsed, minimum 2 and maximum 80 characters.
- Special characters are escaped before any regular expression is built. Arrays, objects, blank text, one-character input, and overlong input return the canonical `400` envelope.
- There is no client-controlled `limit`, pagination, role, visibility, or include-private parameter.
- `discoveryLimiter` protects the route; existing account/API limits continue to apply.
- Groups are always present in stable order and contain zero to five explicit DTOs.

```json
{
  "success": true,
  "data": {
    "query": "react",
    "groups": {
      "teams": [
        {
          "id": "uuid",
          "type": "team",
          "title": "React Builders",
          "subtitle": "Public product team",
          "status": "active",
          "target_path": "/teams/react-builders"
        }
      ],
      "projects": [],
      "people": [],
      "hackathons": [],
      "opportunities": [],
      "organizations": [],
      "tasks": []
    }
  }
}
```

Only `id`, `type`, `title`, optional `subtitle`, optional `status`, and `target_path` are allowed in result rows. No database totals are calculated because the palette displays only the returned bounded rows.

Allowed target shapes are:

- `/teams/:slug`
- `/teams/:teamSlug/projects/:projectSlug`
- `/u/:username`
- `/hackathons/:slug`
- `/opportunities/:slug`
- `/organizations/:slug`
- `/tasks/:uuid`

Malformed database identifiers/slugs cause that row to be omitted, never passed through as an arbitrary path.

## Authorization and Privacy Matrix

| Domain | Client/Freelancer | Administrator | Explicit exclusions |
| --- | --- | --- | --- |
| Teams | Active public teams only | Active public teams only | All private teams, archived teams, membership roster/role data |
| Projects | Effective public project on active public team only | Effective public project on active public team only | All team-only/private projects, private-team projects, archived project/team, participants, evidence, repositories |
| People | Active account with public, discoverable profile; exclude self and either-direction blocks | Same discovery privacy contract | Email, phone, private profile fields, hidden profiles, private evidence/projects |
| Hackathons | Public and non-archived | Public plus existing explicitly authorized private catalog records | Participant messages, submissions, registrations, private event for ordinary users |
| Opportunities | Published/open/unexpired visible opportunities | Same catalog results; management remains in admin routes | Candidate state, native applications, applicants, private organization data |
| Organizations | Active public organizations | Active public organizations | Memberships, invitations, applicants, native applications |
| Marketplace tasks | Client-owned or freelancer-assigned task only | Existing administrator inspection scope | Unrelated tasks, unassigned discovery tasks, submissions/comments/attachments, all `project_tasks` |

## Frontend Component Structure

- `AppShellFrameContent`: owns palette open/closed state, renders the compact trigger for authenticated users, and installs the global `Ctrl/Cmd+K` listener.
- `SearchTrigger`: responsive AppShell button with visible shortcut hint on wider screens and `aria-keyshortcuts="Control+K Meta+K"`.
- `CommandPalette`: composes existing `Dialog`, owns the labeled combobox input, async status, active option, live result announcement, and close/navigate behavior.
- `SearchResultGroup`: renders one labeled listbox group and domain-specific icon/status presentation without owning navigation.
- `useGlobalSearch`: implements the 250 ms debounce, below-minimum suppression, one `AbortController` per request, latest-request guard, retry nonce, and canonical safe error text.
- `commandPalette` utilities: fixed group order, role action registry, dashboard command parsing, safe target allow-list, result flattening, and keyboard index transitions.

Role-specific quick actions use only these internal targets:

- Client: Create task `/client/dashboard?action=create-task`, My tasks `/client/dashboard?view=tasks`, Review deliveries `/client/dashboard?view=deliveries`.
- Freelancer: My work `/freelancer/dashboard?view=work`, Find work `/freelancer/dashboard?view=available`, Update profile `/profile`.
- Administrator: `/admin/dashboard`, `/admin/tasks`, `/admin/users`, `/admin/analytics`.
- Shared navigation: `/teams`, `/projects`, `/people`, `/hackathons`, `/opportunities`, `/applications`, `/notifications`, `/profile` where the route is authorized for the signed-in role.

The client/freelancer dashboards will accept only the allow-listed `view` values above. The client consumes `action=create-task`, opens the existing modal once, then removes the action parameter with a replace navigation. Invalid dashboard commands fall back to the current overview and never execute an action.

## Review Focus

- A private/team-only team or project matching the exact query must remain absent for every role, including members and administrators, because global search is intentionally public-only for these domains.
- A freelancer must not receive an unassigned or another freelancer's marketplace task; `project_tasks` must never enter the marketplace task group.
- A blocked/private/undiscoverable profile and all private evidence/application/applicant fields must remain absent even when the query exactly matches private data.
- Rapid `ab -> abc -> abcd` typing, abort races, and late responses must leave only the newest query rendered and announced.
- Keyboard focus must remain in the modal while Arrow/Home/End move the active option, Enter navigates once, Escape closes, and focus returns to the opener at every supported width.

---

### Task 1: Freeze Search Contracts and Capability Audit

**Files:**
- Create: `docs/search-capability-audit.md`
- Modify: `backend/src/serializers/index.js`
- Test: `backend/tests/searchContracts.test.js`

**Interfaces:**
- Consumes: the seven existing domain DTOs and route identifiers listed in the audit above.
- Produces: `SEARCH_GROUPS`, `SEARCH_RESULT_LIMIT = 5`, `normalizeSearchQuery(value)`, and `serializeSearchResult({ id, type, title, subtitle, status, targetPath })`.

- [ ] **Step 1: Write the failing serializer/query tests**

Assert two-to-80-character normalized input, rejection of structured/blank/overlong input, removal of extra entity fields, exact common DTO keys, safe path construction for all seven domains, omission of malformed targets, stable group order, and the explicit `marketplace_task` type.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/searchContracts.test.js`

Expected: FAIL because the Phase C constants and serializer do not exist.

- [ ] **Step 3: Implement the pure normalization and serialization contract**

Keep target builders explicit per domain. Do not accept a caller-provided arbitrary URL and do not serialize raw domain records.

- [ ] **Step 4: Document the existing API/service/privacy audit**

Record each existing route, its reusable service/data function, current limit/index behavior, visibility policy, and why Phase C needs either direct reuse or a new bounded domain method. Record that `discoverPeople` is not reused wholesale because its rich discovery expansion is unnecessary for five lightweight rows.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/searchContracts.test.js`

Expected: PASS.

- [ ] **Step 6: Review the diff; do not commit without authorization**

### Task 2: Bounded Domain Search Methods

**Files:**
- Modify: `backend/src/data/teamData.js`
- Modify: `backend/src/services/teamService.js`
- Modify: `backend/src/data/projectData.js`
- Modify: `backend/src/services/projectService.js`
- Modify: `backend/src/services/discoveryService.js`
- Modify: `backend/src/services/hackathonService.js`
- Modify: `backend/src/services/opportunityService.js`
- Modify: `backend/src/data/taskData.js`
- Modify: `backend/src/services/taskService.js`
- Test: `backend/tests/searchService.test.js`

**Interfaces:**
- Consumes: `viewer: { id: string, role: "client" | "freelancer" | "admin" }`, normalized `query: string`, and fixed `limit: 5`.
- Produces: `searchTeams`, `searchProjects`, `searchPeople`, `searchHackathons`, `searchOpportunities`, `searchOrganizations`, and `searchMarketplaceTasks`, each returning zero-to-five privacy-safe domain summaries.

- [ ] **Step 1: Write failing role/privacy tests with representative public and private records**

Cover public/private Teams, effective-public/team-only/private-team Projects, active public/blocked/private People, public/private Hackathons, open/closed Opportunities, active/inactive Organizations, and own/assigned/unassigned/unrelated Marketplace Tasks for client, freelancer, and administrator identities.

- [ ] **Step 2: Add query-shape tests before implementation**

Assert each method applies a database-side authorization predicate, explicit projection, deterministic sort, `.lean()`, and `.limit(5)` (or aggregation `$limit: 5`). Assert there is no unbounded `.find()` result subsequently filtered in JavaScript and no `countDocuments` call.

- [ ] **Step 3: Run the focused tests and verify RED**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/searchService.test.js`

Expected: FAIL because the bounded domain methods do not exist.

- [ ] **Step 4: Implement team, project, and people search under existing visibility policy**

Restrict global Team results to active public records. Project aggregation must require an active public parent Team and a public, non-archived Project before limiting; membership does not widen global-search visibility. People search reuses block exclusions and display-name logic but returns no evidence, project, contact, or availability internals.

- [ ] **Step 5: Implement hackathon, opportunity, organization, and marketplace task search**

Reuse the existing hackathon visibility rule and opportunity `openFilter`. Marketplace task filters are exactly `client_id = viewer.id`, `freelancer_id = viewer.id`, or administrator inspection scope; do not reuse the freelancer available-task query.

- [ ] **Step 6: Keep every query indexed and bounded**

Anchor authorization with existing compound indexes (`visibility/status`, `team_id/status`, `discoverable/visibility`, `status/published_at`, `client_id/status`, `freelancer_id/status`) before escaped text predicates. Fetch only fields needed by the search serializer. If an explain plan cannot use an existing authorization/catalog index, stop and report it rather than adding a new search index or shipping an unbounded scan.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/searchContracts.test.js tests/searchService.test.js`

Expected: PASS with every group capped at five.

- [ ] **Step 8: Review the diff; do not commit without authorization**

### Task 3: Authenticated Search Orchestration Endpoint

**Files:**
- Create: `backend/src/services/searchService.js`
- Create: `backend/src/controllers/searchController.js`
- Create: `backend/src/routes/search.routes.js`
- Modify: `backend/src/app.js`
- Test: `backend/tests/search.api.test.js`
- Test: `backend/tests/apiContracts.test.js`

**Interfaces:**
- Consumes: `searchService.search({ query: string, viewer: { id: string, role: string } })`.
- Produces: the exact `GET /api/search?q=<query>` response contract, with all seven group keys and fixed five-row caps.

- [ ] **Step 1: Write failing API tests**

Assert unauthenticated `401`; missing, one-character, structured, and over-80-character queries return canonical `400`; valid client/freelancer/admin requests pass only authenticated identity/role to the service; `limit=100` cannot expand results; and service errors use the canonical safe envelope.

- [ ] **Step 2: Write failing orchestration tests**

Mock all seven domain methods and assert they execute concurrently, receive the same normalized query/viewer, always produce stable group keys, serialize explicit DTOs, cap defensive output to five, and never import/read `NativeApplication`, applicants, evidence, or `ProjectTask`.

- [ ] **Step 3: Run endpoint tests and verify RED**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/search.api.test.js tests/apiContracts.test.js`

Expected: FAIL because the route/controller/orchestrator are absent.

- [ ] **Step 4: Implement and mount the route**

Order middleware as `authenticate -> discoveryLimiter -> q validation -> validate -> controller`. Mount it under `/api` without changing existing domain routes.

- [ ] **Step 5: Implement thin concurrent orchestration**

Use `Promise.all` across the seven bounded domain calls. The orchestrator may format groups but must not reimplement domain authorization or query Mongo models directly.

- [ ] **Step 6: Run endpoint tests and verify GREEN**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/searchContracts.test.js tests/searchService.test.js tests/search.api.test.js tests/apiContracts.test.js`

Expected: PASS.

- [ ] **Step 7: Review the diff; do not commit without authorization**

### Task 4: Mongo/API Privacy and Performance Verification

**Files:**
- Modify: `backend/scripts/verifyMongoIntegration.js`
- Modify: `backend/scripts/verifyMongoApi.js`

**Interfaces:**
- Consumes: the production-shaped Mongo queries and `/api/search` contract from Tasks 2-3.
- Produces: reproducible integration evidence for indexes, five-row bounds, role separation, and cleanup-safe test data.

- [ ] **Step 1: Extend the safe Mongo fixture with exact-match public/private collisions**

Create same-query public/private teams/projects/profiles/hackathons, open/closed opportunities, active/inactive organizations, client-owned/freelancer-assigned/unassigned/unrelated marketplace tasks, and one similarly named `ProjectTask`. Use the existing safe database guard and guarantee cleanup in `finally`.

- [ ] **Step 2: Add API privacy/IDOR assertions**

Verify client, freelancer, and admin grouped results; exact private-name searches; blocked profiles; no native application/applicant/evidence fields; no unassigned freelancer task; no `ProjectTask`; valid internal targets; stable empty groups; special-character input; and maximum five rows despite at least six matching records.

- [ ] **Step 3: Add query-plan/performance assertions**

Inspect the high-growth Team, Project, UserProfile, Opportunity, and Task queries with `explain("executionStats")`. Require an index-backed authorization/catalog stage and database `$limit`/`limit(5)`; fail on a collection-wide materialization path. Warm the endpoint, run 20 representative searches, record median/p95, and require p95 at or below 2000 ms in the development fixture.

- [ ] **Step 4: Run Mongo integration**

Run: `rtk npm --prefix backend run verify:mongodb-integration`

Expected: PASS against a database name accepted by `stagingSafety`, with fixture cleanup confirmed.

- [ ] **Step 5: Run API integration against the configured local server**

Run the local API, then run: `rtk npm --prefix backend run verify:api-integration -- http://localhost:10000/api`

Expected: PASS including Phase C search privacy, bounds, targets, and role isolation. Stop the local server afterward.

- [ ] **Step 6: Review the diff; do not commit without authorization**

### Task 5: Palette State, Safe Navigation, and Request Coordination

**Files:**
- Create: `frontend/src/utils/commandPalette.js`
- Create: `frontend/src/hooks/useGlobalSearch.js`
- Test: `frontend/tests/commandPalette.test.js`
- Test: `frontend/tests/globalSearchWiring.test.js`

**Interfaces:**
- Consumes: authenticated `user.role`, query text, the Phase C grouped response, existing `createLatestRequestGuard`, and Axios `api`.
- Produces: `quickActionsFor(role)`, `flattenPaletteOptions(actions, groups)`, `nextPaletteIndex(current, key, count)`, `safeCommandTarget(value)`, `parseDashboardCommand(searchParams, role)`, and `useGlobalSearch(query)`.

- [ ] **Step 1: Write failing pure state/navigation tests**

Cover fixed group order, five-row defensive rendering, client/freelancer/admin action sets, invalid-role omission, explicit route allow-list rejection of external/protocol-relative/JavaScript/backslash/control-character targets, empty option lists, wraparound ArrowUp/ArrowDown, Home/End, and Enter selecting exactly the active option.

- [ ] **Step 2: Write failing request-race contract tests**

Use deferred promises to prove the 250 ms threshold, no request below two trimmed characters, aborted request suppression, stale response rejection for `ab -> abc -> abcd`, current-query error ownership, retry, and state reset after close.

- [ ] **Step 3: Run frontend tests and verify RED**

Run: `rtk node --test frontend/tests/commandPalette.test.js frontend/tests/globalSearchWiring.test.js`

Expected: FAIL because the utilities/hook do not exist.

- [ ] **Step 4: Implement the pure option and target helpers**

Keep quick actions static and role allow-listed. Validate API-provided paths again before navigation; unsafe rows are omitted rather than opened.

- [ ] **Step 5: Implement the search hook**

Start one `AbortController` after the 250 ms debounce, pass `signal` to Axios, combine abort with `createLatestRequestGuard`, ignore cancellation errors, expose loading/error/retry state, and never retain results for a different query.

- [ ] **Step 6: Run frontend tests and verify GREEN**

Run: `rtk node --test frontend/tests/commandPalette.test.js frontend/tests/globalSearchWiring.test.js frontend/tests/latestRequestGuard.test.js`

Expected: PASS.

- [ ] **Step 7: Review the diff; do not commit without authorization**

### Task 6: Accessible Command Palette, AppShell Trigger, and Role Actions

**Files:**
- Create: `frontend/src/components/search/SearchTrigger.jsx`
- Create: `frontend/src/components/search/SearchResultGroup.jsx`
- Create: `frontend/src/components/search/CommandPalette.jsx`
- Modify: `frontend/src/components/layout/AppShell.jsx`
- Modify: `frontend/src/pages/ClientDashboard.jsx`
- Modify: `frontend/src/pages/FreelancerDashboard.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/tests/commandPaletteWiring.test.js`

**Interfaces:**
- Consumes: Task 5 utilities/hook, existing `Dialog`, `useAuth`, `useNavigate`, and the existing dashboard/modal/view state.
- Produces: an authenticated AppShell trigger and one modal palette instance per shell.

- [ ] **Step 1: Write failing wiring/accessibility contract tests**

Assert one authenticated trigger, one dialog instance, `aria-keyshortcuts`, labeled combobox/listbox relationship, `aria-activedescendant`, live result/error announcement, global Ctrl/Cmd+K handling, no trigger/API use for signed-out shells, and allow-listed dashboard command parsing.

- [ ] **Step 2: Run the wiring test and verify RED**

Run: `rtk node --test frontend/tests/commandPaletteWiring.test.js`

Expected: FAIL because the components are absent.

- [ ] **Step 3: Build the compact AppShell trigger and shortcut lifecycle**

Handle `Ctrl+K` and `Cmd+K` with `preventDefault`, no duplicate listeners under StrictMode, and no opening for unauthenticated users. The desktop trigger shows “Search” plus the platform shortcut; narrow layouts retain a touch-safe icon/button and accessible label.

- [ ] **Step 4: Build the palette with existing `Dialog`**

Autofocus the input; keep DOM focus there while active-option state handles ArrowUp/ArrowDown/Home/End; Enter closes and navigates once; Escape/outside close delegates to `Dialog`; unmount restores focus. Render quick actions before two characters, skeleton/loading, retryable canonical error, no-results state, grouped rows, and an `aria-live` result count.

- [ ] **Step 5: Add URL-backed dashboard quick actions**

Client accepts `view=tasks|deliveries` and one-shot `action=create-task`; freelancer accepts `view=work|available`. Invalid values fall back to overview. Remove the consumed client action with replace semantics so refresh/back does not reopen the modal.

- [ ] **Step 6: Apply canonical responsive styling**

Use the existing dark tokens and spacing. Cap dialog height inside `100dvh`, keep the input/header visible while results scroll, maintain 44 px touch targets, and prevent page-level horizontal overflow at 320 px.

- [ ] **Step 7: Run all frontend tests and lint**

Run: `rtk node --test frontend/tests/*.test.js`

Run: `rtk npm --prefix frontend run lint`

Expected: PASS.

- [ ] **Step 8: Review the diff; do not commit without authorization**

### Task 7: Documentation, Regression Gates, and Browser Acceptance

**Files:**
- Modify: `docs/PRODUCT_COHESION.md`
- Create: `backend/scripts/phaseCSearchBrowserFixture.js`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: the completed Phase C endpoint and palette.
- Produces: a guarded/recoverable browser fixture, implementation documentation, and final acceptance evidence.

- [ ] **Step 1: Document the implemented search trust boundary**

Record the endpoint, common DTO, fixed group caps, role matrix, Marketplace Task versus ProjectTask separation, target allow-list, AppShell/keyboard behavior, cancellation/stale-response policy, and the absence of a new index/service.

- [ ] **Step 2: Add a guarded browser fixture and cleanup command**

Create only disposable development records under unique markers, print transient client/freelancer/admin credentials, include exact public/private collisions and six-result cap data, and delete all fixture records in cleanup mode. Use `stagingSafety`; never target production or send production email.

- [ ] **Step 3: Run focused Phase C suites**

Run the backend search contract/service/API tests and all frontend palette tests. Expected: all pass with exact counts captured from the run.

- [ ] **Step 4: Run full regression gates**

Run: backend full Jest, frontend full Node tests, backend lint, frontend lint, production Vite build/config verifier, Mongo integration, and API integration. Then run the existing Teams, Projects, discovery, hackathon, opportunity, organization, and marketplace workflow integrations relevant to the seven search groups.

- [ ] **Step 5: Perform browser acceptance at every required width**

For authenticated client, freelancer, and administrator sessions at 320, 375, 390, 430, 768, 1024, and 1440 verify trigger layout, Ctrl/Cmd+K, autofocus, focus trap/restoration, Arrow/Home/End/Enter, Escape/outside close, quick actions, two-character threshold, loading/error/empty states, grouped caps, internal navigation, and no horizontal overflow.

- [ ] **Step 6: Perform browser privacy and race acceptance**

Search exact private names and prove private/team-only Teams and Projects remain absent for members, administrators, and unrelated users; prove freelancer task isolation and ProjectTask absence; simulate slow/out-of-order requests and confirm only the newest results render; confirm aborted requests produce no user error.

- [ ] **Step 7: Verify console/network cleanliness and cleanup**

Require zero uncaught console errors, React warnings, CSP/CORS failures, unexpected 4xx/5xx responses, duplicate search calls after one debounce, or leaked aborted-request errors. Run fixture cleanup and stop local servers.

- [ ] **Step 8: Inspect final repository state**

Run `rtk git diff --check`, inspect the complete Phase C diff and `git status`, verify no infrastructure/environment/secret files changed, and do not commit, push, or deploy.

## Performance Design

- One frontend request fans out to seven concurrent domain calls; there is no frontend waterfall.
- Every group uses database authorization/catalog predicates, explicit projection, deterministic sorting, `.lean()`, and a database limit of five.
- Search performs no `countDocuments`, no pagination totals, no evidence/application joins, and no rich discovery decoration.
- Existing compound indexes bound high-growth scans before escaped text matching. Project visibility may use a bounded aggregation with indexed project match plus indexed Team `_id` lookup.
- Client debounce is exactly 250 ms. Closing the dialog or changing the query aborts the active request and invalidates its generation.
- The integration gate records explain plans and a warmed 20-request latency sample; p95 must not exceed 2000 ms in the development fixture.
- If an existing index cannot support a required domain safely, Phase C remains failed and reports that domain. The implementation must not silently add an index or fall back to collection-wide in-memory filtering.

## Rollback Considerations

- Backend rollback is additive: unmount `search.routes`, remove the orchestrator and bounded domain methods, and existing domain endpoints remain unchanged.
- Frontend rollback removes the AppShell trigger/palette and dashboard query parsing; all existing navigation remains available.
- There is no data migration, new collection, index, external service, or persisted palette state to unwind.
- Browser/integration fixture data is marker-scoped and cleanup-safe; rollback includes running its cleanup mode.
- If one domain fails privacy or performance review, do not ship a partial undocumented group set. Keep the gate failed, remove that adapter from the working diff if necessary, and return for design approval.

## Acceptance Criteria

- `Ctrl+K` and `Cmd+K` open exactly one authenticated palette; the AppShell trigger works at all required widths.
- Dialog focus, Escape, restoration, combobox/listbox semantics, keyboard navigation, live announcements, and touch targets pass browser acceptance.
- Quick actions are role-correct and every action/row resolves only to an allow-listed internal target.
- `GET /api/search` rejects invalid input, always returns seven stable groups, and never returns more than five rows per group.
- Client/freelancer/admin result sets satisfy the authorization matrix; private profiles/evidence, every private/team-only Team or Project, applications/applicants, unrelated tasks, and all ProjectTasks are absent.
- Queries are projected, database-bounded, index-backed on authorization/catalog predicates, and meet the documented development p95 gate.
- Debounce, cancellation, stale-response suppression, retry, loading, empty, and error behavior pass focused and browser tests.
- Focused tests, full regressions, lint, build, Mongo/API integration, browser widths, console, and network checks pass with exact evidence recorded.
- No Phase D/E code, infrastructure, deployment, push, unauthorized commit, new search index, or secret exposure occurs.

## Remaining Questions or Blockers

- No blocker prevents implementation under the approved design.
- Deliberate scope decision: unassigned marketplace tasks are not global search results because their canonical `/tasks/:id` workspace is participant-only. Freelancers reach the existing discovery flow through the “Find work” quick action.
- Deliberate scope decision: role quick actions add only narrow URL state to existing dashboards; they do not create new dashboards or replace legacy task modals.
- Operational note: `1046a2a` was already present on both the local and origin branch before this planning turn. Phase C implementation must not perform any further push or deployment.
