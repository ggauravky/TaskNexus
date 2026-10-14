# TaskNexus V2 Product Cohesion Design

**Date:** 2026-10-14  
**Status:** Approved design, pending implementation plan  
**Branch:** `codex/unified-work-hub`  
**Baseline:** `d8cfe5ac10d53ee604d2e207bd1754355e1892e9`

## 1. Purpose

This phase connects existing TaskNexus capabilities into one coherent product journey:

`CONNECT -> BUILD -> DO REAL WORK -> PROVE IT -> SHOW IT -> FIND THE NEXT OPPORTUNITY`

It delivers five changes, in this order:

1. Unified Marketplace Task Workspace
2. Notification Center
3. Global Search and Command Palette
4. Role-aware Onboarding
5. Profile -> Proof -> Opportunity integration

The work is a cohesion layer over established domains. It does not introduce AI matching, scoring, messaging, billing, scraping, infrastructure changes, or a new persistence model.

## 2. Design Principles

- Keep the client, freelancer, and admin dashboards as overview and attention surfaces.
- Put marketplace task execution on one canonical page.
- Reuse existing services, authorization, serializers, storage, and SSE infrastructure.
- Add only narrow read orchestration where existing endpoints would otherwise produce fragmented UX.
- Keep all authorization and privacy decisions authoritative on the backend.
- Derive onboarding state from real domain data; do not persist a parallel checklist state.
- Present proof as factual relationships, never as opaque scoring or ranking.
- Load bounded data and defer secondary tab data until needed.
- Preserve the canonical dark design system and existing shared components.
- Keep realtime behavior an enhancement; API reads and mutations remain the correctness path.

## 3. Non-goals

This design explicitly excludes:

- Merging marketplace `tasks` with project `project_tasks`
- AI matching, applicant ranking, match percentages, or reputation scores
- Resume parsing, job scraping, auto-apply, chat, social feeds, or payments
- New database providers, cloud services, deployment, or environment changes
- Reworking the completed role portal dashboards
- A new notification domain, search index, event bus, or onboarding collection
- Making private evidence, applications, applicants, tasks, teams, or projects searchable

## 4. Existing Capability Map

### 4.1 Marketplace tasks

The existing marketplace task domain already supplies task retrieval, lifecycle mutations, progress, submissions, revision and approval behavior, comments, mentions, attachments, activity, and subtasks. The main gap is a canonical participant-only workspace and cohesive presentation.

Relevant entry points include:

- `backend/src/routes/task.routes.js`
- matching task controllers, services, data access, serializers, and tests
- `frontend/src/components/common/TaskCollaborationPanel.jsx`
- client and freelancer dashboard task components

Current general task reads permit some discovery behavior for unassigned freelancers. That is appropriate for finding work but is too broad for the workspace. The workspace therefore needs a separate strict participant-oriented read contract.

### 4.2 Notifications

The existing notification domain already supplies paginated listing, unread counts, mark-one-read, mark-all-read, deletion, preferences, creation call sites, and an SSE `notification.created` event. Notification records already carry actor, recipient, type, message content, task/entity references, priority, status, timestamps, and metadata.

The missing cohesion pieces are:

- one safe deep-link resolver
- AppShell unread state and recent notifications
- a protected paginated notifications page
- focused SSE reconciliation

### 4.3 Searchable domains

Existing domain services already implement bounded and permission-aware retrieval for teams, projects, people, hackathons, opportunities, organizations, and marketplace tasks. The search endpoint will orchestrate those capabilities rather than query collections directly or duplicate their authorization logic.

### 4.4 Profiles, proof, and applications

Professional profiles already contain canonical skills, education, availability, and factual completeness. Public profiles and people discovery already expose privacy-safe proof summaries. Projects and contribution evidence already retain participation and verification semantics. Opportunity eligibility is deterministic. Native applications already snapshot selected profile, project, and evidence data so later edits do not mutate an application.

The missing connection is a factual, privacy-safe skill-to-proof view presented where candidates make opportunity decisions.

## 5. Domain Boundaries

### 5.1 Marketplace Task

Marketplace `tasks` represent commercial client/freelancer work. The new `/tasks/:taskId` route applies only to this domain.

### 5.2 ProjectTask

`project_tasks` remain team/project collaboration records. They continue to live within the project workspace and must not be routed through marketplace lifecycle, submission, review, or rating rules.

### 5.3 Terminology rule

Code, route names, tests, and UI copy must distinguish `Marketplace Task` from `ProjectTask` whenever ambiguity is possible.

## 6. Architecture Decision

### 6.1 Chosen approach: thin orchestration

The implementation will reuse domain services and add only two intentional read surfaces:

1. `GET /api/tasks/:taskId/workspace`
2. `GET /api/search?q=<query>`

The workspace endpoint returns only primary task context and permissions. Comments, attachments, activity, and subtasks remain on existing APIs and load when their tabs require them. The search endpoint coordinates existing permission-aware services and returns bounded, grouped navigation results.

### 6.2 Rejected: frontend-only aggregation

Composing every view exclusively in the browser would create avoidable request waterfalls, duplicate authorization interpretation, inconsistent loading states, and more opportunities for stale state.

### 6.3 Rejected: new read-model subsystem

A separate BFF, denormalized search store, or event-driven read model would exceed the problem's needs and introduce operational complexity without improving the requested workflow.

## 7. Phase A: Unified Marketplace Task Workspace

### 7.1 Route and page composition

Add the protected frontend route:

`/tasks/:taskId`

`TaskWorkspacePage` owns route state, primary task loading, mutation reconciliation, and role-aware action selection. It composes focused sections:

- `TaskOverview`
- `TaskWork`
- `TaskDelivery`
- `TaskDiscussion`
- `TaskActivity`

The page header contains the task title, lifecycle status, participant context, due date, and at most one valid primary action. The five sections render as accessible tabs on larger screens and a horizontally scrollable tab list or compact equivalent on narrow screens.

### 7.2 URL state

The selected tab is represented by `?tab=overview|work|delivery|discussion|activity`. Invalid values fall back to `overview` without breaking the page. Deep links from notifications may target a meaningful tab, for example `?tab=delivery` or `?tab=discussion`.

Transient form contents and dialog state do not belong in the URL.

### 7.3 Workspace read contract

`GET /api/tasks/:taskId/workspace` returns a canonical serialized object similar to:

```json
{
  "task": {},
  "participants": {
    "client": {},
    "freelancer": null
  },
  "progress": {},
  "current_submission": null,
  "submission_summary": {},
  "permissions": {
    "can_update_progress": false,
    "can_submit": false,
    "can_review": false,
    "can_request_revision": false,
    "can_rate": false,
    "can_collaborate": false
  },
  "available_actions": []
}
```

Exact fields must follow existing serializers and transition contracts. The endpoint must not emit raw Mongoose documents, private account fields, storage internals, or fields merely because they exist in the database.

`available_actions` is derived from existing backend lifecycle rules, not display labels. The frontend renders only actions supported by this authoritative response and still handles mutation rejection safely.

### 7.4 Workspace authorization

The workspace read is allowed only for:

- the task's client
- the assigned freelancer
- platform administrators where current policy allows administrative task inspection

An unassigned freelancer who can discover a task cannot open its workspace. Unrelated clients and freelancers receive the existing safe not-found/forbidden behavior without resource detail leakage.

Every child endpoint used by the page retains its own server-side authorization. Frontend route protection and a successful workspace read are never treated as authorization for subsequent mutations.

Required IDOR tests cover the task client, assigned freelancer, unrelated client, unrelated freelancer, and administrator.

### 7.5 Data-loading strategy

Initial page load fetches the workspace contract only. Secondary tab data loads on first activation and may be cached for the page lifetime:

- Work: subtasks when needed
- Delivery: submission detail/history when not fully covered by the workspace summary
- Discussion: comments and attachment metadata
- Activity: bounded activity page

Mutations invalidate only relevant task data. A task lifecycle mutation refreshes the workspace contract and the active affected tab. SSE events may trigger the same targeted refresh but are never required for correctness.

### 7.6 Overview

The Overview tab presents title, description, category/type, skills, experience level, budget, deadline, participants, creation date, progress, and current lifecycle state without repeating delivery or activity detail.

The lifecycle presentation is the page's distinctive visual element: a restrained, readable progression that marks only real recorded/current states. It must not invent historic events.

### 7.7 Role-aware primary action

The primary action is selected from backend-approved actions and existing transitions. Examples include start work, update progress, submit, review delivery, and rate. If no valid transition exists, no synthetic call to action is shown.

All mutations:

- use the existing contract and validation
- disable controls while pending
- prevent double submission
- show canonical safe API errors
- refresh canonical state after success

### 7.8 Work

The Work tab shows server-backed percentage, stage, last update, and note. Clients receive a read-only view. Assigned freelancers receive edit controls only when the lifecycle permits them.

Existing marketplace subtasks appear with title, completion, weight, due date, and useful description. Their mutations retain existing write checks. ProjectTask behavior is not introduced here.

### 7.9 Delivery and revision loop

The Delivery tab is the canonical submission/review surface. It presents the current submission, bounded history when supported, deliverables, submission note, timestamps, review state, and revision feedback.

Freelancers submit or resubmit using only existing supported fields and deliverable types. HTTPS URL and other existing validation errors display inline. Clients can approve after confirmation or request revision with required feedback.

Earlier submission context is preserved according to current backend semantics. After submit, revision, resubmit, or approval, the page refetches workspace and delivery state.

### 7.10 Discussion and attachments

The Discussion tab reuses the existing collaboration system and refactors its visual composition to match the dark workspace. It does not create a second comment model.

Comments show actual author, role/context, timestamp, body, mentions, and attachment metadata. Attachments remain private to authorized task participants. Download continues through the authenticated backend stream; raw storage keys or GridFS internals are never exposed.

Upload UX includes pending, validation, success, and failure states. Existing size and type policies remain authoritative.

### 7.11 Activity

The Activity tab displays only persisted audit entries in chronological timeline form. Potentially unbounded activity uses existing pagination or a bounded continuation contract. No events are inferred from the current status.

### 7.12 Dashboard integration

Client and freelancer dashboard task actions navigate to `/tasks/:taskId`, optionally with a contextual tab. Existing large task-detail modals are removed or reduced to narrowly useful quick actions once the workspace covers their behavior. There will be one maintained task-detail experience.

## 8. Phase B: Notification Center

### 8.1 Notification event audit

Before UI wiring, implementation will document a matrix of existing creation call sites:

`event -> recipient -> notification type -> entity/task reference -> target path -> UI support`

The audit includes task assignment and lifecycle events, team and organization invitations, collaboration requests, application stage changes, and existing hackathon events. Missing links may be added only where an existing real event already creates a notification or clearly should under current product semantics.

### 8.2 Safe target mapping

One backend mapping function derives `target_path` from trusted notification type and identifiers. Existing validated `content.actionUrl` values may be normalized through the same allow-list logic.

Allowed targets are internal application paths only. The mapper rejects external origins, protocol-relative URLs, JavaScript URLs, malformed IDs, and routes inconsistent with the notification entity. Unknown notifications safely target `/notifications`.

Controllers do not hardcode divergent links. Serialized notifications expose `target_path` as the canonical navigation field.

### 8.3 AppShell integration

An authenticated notification provider owns:

- unread count
- a bounded recent list
- initial API refresh
- mark-one and mark-all reconciliation
- `notification.created` SSE handling
- fallback refresh after reconnect or focus where appropriate

AppShell adds one accessible bell. Its badge displays `1` through `99`, then `99+`; its accessible name communicates unread state in text, not color alone.

### 8.4 Recent panel

The bell opens an accessible popover or drawer with focus management, Escape handling, focus restoration, recent notification rows, unread styling, open/mark-read actions, and a link to `/notifications`.

Opening a notification marks it read through the backend, reconciles the badge, and then navigates to its safe target. Failed mutations preserve a recoverable row state and show a contextual message.

### 8.5 Notifications page

Add protected route `/notifications`. It provides URL-backed `all` and `unread` filters and paginated history. Mark-one and mark-all operations are persisted and race-safe. The page never requests an unbounded history.

### 8.6 Realtime behavior

On `notification.created`, the provider increments/reconciles unread state and prepends the serialized item only when it belongs in the current recent view. It does not reload the application or refetch unrelated domains. If SSE is unavailable, normal API reads preserve full functionality.

### 8.7 Preferences

Only existing persisted preferences that can be honored by current creation/delivery paths are exposed. The UI must not promise a preference that the backend ignores. This phase does not build a new notification rules engine.

### 8.8 Security

Existing ownership filters remain mandatory for listing, reading, updating, and deleting notifications. Tests cover cross-user ID access, pagination ownership, safe deep links, and realtime event shape.

## 9. Phase C: Global Search and Command Palette

### 9.1 Interaction model

Authenticated users open the palette through the AppShell trigger or `Ctrl+K` / `Cmd+K`. The dialog supports keyboard navigation, focus trapping, Escape to close, focus restoration, labeled search input, visible loading/empty/error states, and an announced result count where practical.

Sections are:

- role-aware quick actions
- useful navigation
- grouped search results

### 9.2 Quick actions

Actions use existing route permissions:

- Client: create task, open tasks, review deliveries
- Freelancer: my work, find work, update profile
- Shared: teams, projects, people, hackathons, opportunities, applications, profile
- Admin: admin dashboard, tasks, users, analytics where those routes already exist

Unavailable or unauthorized routes are not displayed.

### 9.3 Search API

Add `GET /api/search?q=<query>`. Requirements:

- authentication required
- trimmed minimum query length of 2
- conservative maximum query length
- escaped/normalized input suitable for each existing service
- maximum 5 results per group
- stable grouped response
- no raw Mongoose documents

Response shape:

```json
{
  "query": "react",
  "groups": {
    "teams": [],
    "projects": [],
    "people": [],
    "hackathons": [],
    "opportunities": [],
    "organizations": [],
    "tasks": []
  }
}
```

Each result contains only navigation fields such as `id`, `type`, `title`, optional safe subtitle/status, and internal `target_path`.

### 9.4 Permission composition

The search service delegates to existing domain services and their current visibility rules:

- Teams: discoverable/public or user's own authorized teams
- Projects: authorized participant/public results according to existing project policy
- People: existing discovery privacy, block, visibility, and discoverability policy
- Hackathons: publicly visible records or explicit authorized views
- Opportunities: published/open visible opportunities
- Organizations: active public organizations
- Marketplace tasks: only tasks the current user is authorized to view under the intended search context

It must never include private evidence, private profiles, native applications, organization applicants, hidden teams/projects, or arbitrary task records.

### 9.5 Query performance

The service makes bounded database queries using indexed fields where available. It must not load entire collections and filter them in process. New high-growth query shapes receive explain-plan inspection during implementation. If an existing service cannot provide a bounded query safely, that group is omitted until a bounded domain method is added.

### 9.6 Frontend request behavior

The palette debounces search, issues no search below the minimum length, cancels superseded requests with `AbortController`, ignores stale responses, and renders at most the bounded API results. Selecting a result closes the palette and navigates to its internal target.

## 10. Phase D: Role-aware Onboarding

### 10.1 State model

No onboarding checklist collection or mutable progress counter is added. A shared derivation function calculates checklist items from current user and domain facts. Every item includes an identifier, label, completion boolean, and real route/action.

The checklist is shown on the existing client or freelancer dashboard, not as a new dashboard. It disappears when all applicable items are complete and reappears if a prerequisite genuinely becomes incomplete.

### 10.2 Client checklist

Client steps are derived from stable facts such as:

- core identity/profile fields complete
- at least one marketplace task created
- at least one task progressed into active tracking where applicable
- at least one delivered task reviewed/rated where applicable

Items that depend on a later workflow stage are phrased as next actions, not falsely marked incomplete before they are applicable. The exact derivation uses existing task aggregates rather than a new state flag.

### 10.3 Freelancer checklist

Freelancer steps are derived from:

- professional profile fundamentals complete
- at least one canonical skill
- professional availability configured
- at least one accepted/assigned marketplace task when applicable
- completed work and public-safe proof when applicable

Professional profile availability remains distinct from any legacy marketplace task availability flag. The implementation must not silently conflate them.

### 10.4 Administrator behavior

Administrators do not receive the role onboarding checklist.

### 10.5 Data delivery

Prefer deriving from already-loaded profile/dashboard summaries. If a missing aggregate would create repeated large client queries, extend an existing dashboard/profile summary narrowly. Do not add a generic mega-endpoint.

Tests cover new users, partially complete users, real completion transitions, non-applicable steps, and prevention of false completion.

## 11. Phase E: Profile -> Proof -> Opportunity

### 11.1 Professional profile

The profile retains its factual completeness calculation and canonical skills. The UI adds concise proof connections for each skill when public-safe participating projects or evidence support that skill.

Connections are factual labels and links, for example:

- skill used in a completed public project
- public-safe evidence attached to that project
- open project/showcase

No percentage, quality judgment, endorsement inference, or verification upgrade is generated.

### 11.2 Skill-to-project connection

Connections use canonical skill identifiers, not fuzzy text matching. A project is eligible only when the current visibility rules allow it and the user is a valid participant. Completed public projects are preferred for proof presentation; private projects are not exposed through public surfaces.

### 11.3 Project-to-evidence connection

Evidence retains existing `internal_verified`, `external_verified`, and `unverified` lifecycle semantics. Only evidence already classified as public-safe may appear in public/profile/opportunity proof connections. Storage details and private attachments remain protected.

### 11.4 Opportunity relevant proof

On an opportunity detail page viewed by a candidate, `relevant_proof` is derived from exact overlap between the opportunity's required canonical skill IDs and the candidate's permitted completed project/proof data.

The presentation states only verifiable relationships, such as:

- required skill
- candidate project using that skill
- available public-safe evidence count or link

It does not compute a match score, rank candidates, expose proof to employers before the existing application/visibility rules allow it, or change eligibility logic.

### 11.5 Native application snapshot

The native application flow continues to let candidates deliberately select permitted projects/evidence. The submitted application retains its immutable snapshot. Later profile, project, or evidence edits do not silently rewrite submitted material.

### 11.6 Navigation cohesion

Profile project links can open the project/showcase where authorized. Public showcases may expose public contributors under current privacy rules. Candidate applications link back to their opportunity and organization. These links are concise and avoid circular duplicate navigation.

## 12. Shared Frontend Design

### 12.1 AppShell

There remains one AppShell. It gains only:

- a compact command/search trigger
- an accessible notification bell

Desktop navigation is not expanded with permanent links for every new surface.

### 12.2 Visual system

New UI uses the established palette:

- background `#010102`
- surface `#0f1011`
- secondary `#141516` / `#18191a`
- border `#23252a` / `#34343a`
- text `#f7f8f8`
- muted `#8a8f98`
- accent `#5e6ad2` / `#828fff`

No white/slate dashboard regression, gradient hero treatment, giant cards, or excessive shadows are introduced.

### 12.3 Shared components

The implementation reuses AppShell, PageHeader, Dialog, StatusBadge, WorkspacePrimitives, marketplace utilities, EmptyState, and the canonical API error helper. New components remain domain-focused and do not duplicate existing primitives.

### 12.4 Accessibility

Changed surfaces require:

- one meaningful page `h1`
- semantic landmarks
- keyboard-operable tabs and palette results
- dialogs with focus trap, Escape close, and focus restoration
- labeled inputs and controls
- notification state communicated beyond color
- practical live announcements for form and async errors
- touch-safe controls and no horizontal page overflow

### 12.5 Responsive behavior

Task workspace, notifications, command palette, onboarding checklists, professional profile, and opportunity detail are verified at 320, 375, 390, 430, 768, 1024, and 1440 pixels. Tab navigation may scroll internally, but the page must not overflow horizontally.

## 13. Error, Mutation, and Freshness Rules

- All user-visible failures pass through the canonical safe API error helper.
- Raw Mongo errors, Axios objects, stack messages, `undefined`, and `[object Object]` are never rendered.
- Every mutation disables its initiating control while pending.
- Duplicate requests are prevented through pending state and existing idempotency/lifecycle guards.
- Successful task mutations refresh the workspace and only affected tab/attention summaries.
- Successful notification mutations reconcile unread count and visible rows.
- Realtime events trigger targeted reconciliation, not global reloads.
- Network or SSE failure leaves a usable retry path.

## 14. Backend Contracts and Security

### 14.1 Serialization

New responses use explicit serializers. They expose only fields required for the current role and view. IDs and target paths are normalized consistently with existing API contracts.

### 14.2 Authorization

Authorization is enforced in services/controllers before serialization. Tests explicitly cover horizontal access attempts for workspace, notifications, search, proof connections, and attachments.

### 14.3 Pagination and limits

- Notifications are paginated.
- Search results are bounded per group.
- Activity is paginated or bounded with continuation.
- Submission history is bounded when it can grow.
- Recent notification panels request only a small fixed page.

### 14.4 Privacy

No new endpoint exposes:

- private profile fields
- private or non-public-safe evidence
- private team/project membership details
- unauthorized marketplace tasks
- native applications or organization applicants
- raw storage identifiers

## 15. Implementation Sequence and Gates

Work proceeds strictly phase by phase.

### 15.1 Phase A gate

Implement and verify workspace endpoint authorization, route composition, role-aware lifecycle controls, progress, subtasks, delivery/revision/approval, discussion/attachments, activity, deep links, and dashboard integration. Remove superseded modal duplication only after parity is demonstrated.

### 15.2 Phase B gate

Complete notification event matrix, safe target mapper, AppShell provider/bell/panel, notifications page, persistence, security, and focused SSE behavior.

### 15.3 Phase C gate

Complete bounded search service, group serializers, privacy tests, command palette accessibility, role actions, cancellation/debounce, and query performance review.

### 15.4 Phase D gate

Complete derived client/freelancer checklists and tests without adding stored checklist state.

### 15.5 Phase E gate

Complete factual profile/project/evidence connections, candidate relevant proof, privacy tests, and immutable application snapshot regression tests.

No later phase begins until the preceding phase's targeted verification passes.

## 16. Test Strategy

### 16.1 Test-driven implementation

For each behavior, add or update a focused failing test first, confirm the intended failure, implement the smallest correct change, and rerun the focused suite before broader checks.

### 16.2 Backend coverage

Required coverage includes:

- workspace allowed and denied identities
- workspace role-specific permissions/actions
- progress, subtask, comment, attachment, submission, revision, approval, activity, and rating regressions
- notification ownership, pagination, counts, read mutations, target mapping, and SSE shape
- search validation, special characters, limits, role visibility, and private-resource exclusion
- onboarding derivation helpers/summary data
- exact skill overlap and proof visibility
- immutable application snapshots

### 16.3 Frontend coverage

Where the repository's current test stack supports it, cover:

- URL tab selection and fallback
- role-aware controls and pending states
- command palette keyboard behavior
- notification reconciliation
- derived onboarding rendering
- factual proof presentation without scores

### 16.4 Full regression

After all phases, run the repository's actual scripts for:

- frontend lint
- backend lint
- full Jest
- Vite production build
- production configuration verifier
- Mongo integration
- API integration
- teams, projects, contribution evidence, discovery, hackathons, opportunities, organizations, marketplace workflows, storage, production controls, launch controls, and secret scanning

Exact suite and test counts are captured from the final run rather than copied from the baseline.

## 17. Browser Acceptance

Run the requested golden flows for client task completion, freelancer work and revision, notifications, command search, onboarding, and proof-to-opportunity navigation.

For changed pages, verify all required widths and confirm:

- zero uncaught console errors
- zero unresolved React warnings
- zero CSP violations
- zero CORS failures
- zero unexpected 404s
- zero infinite request loops
- private resources absent from unauthorized search/navigation
- reasonable initial workspace request count and lazy secondary loading

Browser QA must use real supported local/test data and must not send production email or mutate cloud infrastructure.

## 18. Documentation Deliverable

Implementation will create or update `docs/PRODUCT_COHESION.md` as the focused final architecture document. It will describe the implemented Task Workspace, notification flow, search permissions, onboarding derivation, and proof-to-opportunity connection. This design document remains the pre-implementation decision record.

## 19. Git and Operational Safety

- Work remains on `codex/unified-work-hub`.
- No automatic push or deployment.
- No Render, Vercel, Atlas, DNS, production environment, or production email changes.
- No commit is created without explicit user authorization.
- Before final reporting, inspect `git status`, `git diff --stat`, full relevant diff, and `git diff --check`.

## 20. Acceptance Definition

The phase is complete only when all five feature groups meet their requested behavior and security criteria, focused and full verification pass or any genuine blocker is reported, browser acceptance is recorded, and the exact 50-section Product Cohesion Report is returned.

The final report must state `YES` only for outcomes demonstrated by code inspection and fresh verification. Any unverified or incomplete acceptance item remains `NO` with a concise severity classification.
