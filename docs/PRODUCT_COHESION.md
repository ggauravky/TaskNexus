# TaskNexus Product Cohesion

## Phase A: Unified Marketplace Task Workspace

Phase A establishes `/tasks/:taskId` as the canonical execution surface for marketplace `tasks`. Team/project `project_tasks` remain a separate domain inside project workspaces.

### Workspace contract

`GET /api/tasks/:id/workspace` is authenticated and limited to the task client, assigned freelancer, and platform administrator. Marketplace discovery does not grant workspace access. The response contains an explicit task DTO, participant-safe identities, progress, a non-sensitive active-submission summary, rating state, permissions, and `available_actions` derived from the existing lifecycle rules.

The optional `section=delivery` query loads full serialized submission history. This keeps initial workspace data compact while preserving one intentional read surface.

### Authorization

The backend remains authoritative. The workspace endpoint rejects unrelated clients, unrelated freelancers, and unassigned marketplace viewers. Existing comment, attachment, activity, and subtask reads now enforce the same participant boundary. Each mutation continues to enforce its existing controller/service authorization independently.

### Frontend composition

The protected page uses URL-backed tabs:

- Overview: task facts, people, current state, progress, and recorded lifecycle timestamps
- Work: server-backed progress and existing marketplace subtasks/milestones
- Delivery: existing submission, revision, approval, and rating workflows
- Discussion: existing comments, mentions, and private attachments
- Activity: existing persisted task activity only

Work, Delivery, Discussion, and Activity data load only when the corresponding tab is opened. The collaboration component issues only the endpoint required by its active workspace section.

### Lifecycle actions

The UI never infers mutations from status labels. It renders controls only when the workspace response permits them. Current actions include starting work, updating progress, submitting, returning an assignment, resubmitting a requested revision, approving/requesting revision, and rating completed work.

### Dashboard integration

Assigned client and freelancer task actions deep-link to the workspace, including `?tab=delivery` and `?tab=work` where useful. Available unassigned tasks retain the legacy freelancer preview/accept modal because strict workspace access begins only after assignment. Both legacy task-detail modal implementations remain in the repository until full parity is confirmed.

### Realtime and correctness

API reads and mutations are the correctness path. Existing task SSE events trigger a targeted workspace refresh for the current task. Freelancer revision resubmission now publishes the resulting delivered status so the client view can reconcile without reloading the application.

## Phase B: Notification Center

Phase B keeps the existing `notifications` collection and creation call sites. It adds a cohesion layer around the existing domain rather than introducing another event model, queue, or delivery service.

### Safe navigation contract

Every serialized notification now includes `target_path`, derived by one backend resolver from the notification type and trusted entity/task identifiers. Marketplace lifecycle notifications use `related_task_id` to target the Phase A workspace and select Work, Delivery, or Discussion only when the persisted event supports it.

Producer-supplied `content.actionUrl` is untrusted. It is accepted only when it is a well-formed internal path on the explicit route allow-list and is consistent with the notification family. External origins, protocol-relative paths, JavaScript URLs, backslashes, control characters, malformed identifiers, and cross-domain routes resolve to `/notifications`. Unknown notification types also resolve to `/notifications`.

The audited producer matrix is maintained in `docs/notification-event-matrix.md`.

### Ownership and persistence

`GET /api/notifications` remains authenticated, recipient-filtered, and paginated. The AppShell requests only the latest eight rows; `/notifications` requests fixed pages of 20 rows and supports URL-backed `all` and `unread` filters.

Mark-one and delete operations now include `recipient_id` in the atomic Mongo query instead of authorizing in a separate read and then mutating by ID. Cross-user identifiers retain the safe not-found response. Mark-all updates only the authenticated recipient's unread rows. Mutation responses use the same explicit notification serializer as list responses.

### AppShell provider and realtime

Every authenticated `AppShellFrame`, including authenticated users visiting public TeamShell routes, receives exactly one `NotificationProvider`. It owns the bounded recent list, unread count, API refresh, optimistic mark-one/mark-all state with rollback, focus refresh, and reconnect refresh.

`notification.created` publishes the canonical serialized DTO and a bounded unread increment. The client treats that SSE event only as a debounced refresh signal; unread state is never calculated from the bounded visible list. Provider refreshes use a latest-request guard, and read mutations invalidate older reads before performing a post-mutation authoritative refresh. SSE remains an enhancement: initial load, focus/reconnect refresh, history, and every mutation use the API as the correctness path. Transactional domain services that currently persist notifications directly remain visible through API refresh even when they do not publish a post-commit SSE event.

### Bell, recent panel, and history

The authenticated AppShell exposes one bell with a textual unread accessible name and a `1` through `99+` visual badge. Its recent panel traps focus while open, closes on Escape or outside interaction, restores focus to the bell, distinguishes unread rows with text and shape as well as color, and marks a row read before navigating to its backend-provided target. Failed mutations keep the row recoverable and expose a retry action.

The protected `/notifications` page provides bounded history, persisted mark-one/mark-all operations, server pagination, URL-backed filtering, safe loading/empty/error states, and the same canonical targets.

### Preferences boundary

The new UI does not expose notification preference controls because existing creation paths do not consistently honor the currently persisted preference fields. Phase B does not promise an ineffective preference and does not add a notification rules engine.

## Phase C: Global Search and Command Palette

Phase C adds one authenticated `GET /api/search?q=...` read surface and a shared AppShell command palette. The endpoint returns seven stable groups—Teams, Projects, People, Hackathons, Opportunities, Organizations, and marketplace Tasks—with at most five explicit DTOs per group. It reuses domain services and existing MongoDB collections; there is no new index, search service, vector store, or AI dependency.

### Search trust boundary

The backend applies authorization before serialization. Teams must be public and active. Projects must be public, non-archived, and belong to a public active Team. People must be active, public, discoverable, not the viewer, and outside both directions of a block relationship; profile evidence and private profile fields are never joined. Hackathons follow the existing public catalog policy, with the existing administrator catalog visibility retained. Opportunities must be published, open, and unexpired. Organizations must be active. Marketplace Tasks are limited to client ownership, freelancer assignment, or the existing administrator scope. `project_tasks`, applications, applicants, and evidence never enter global search.

Every result uses the common `{ id, type, title, subtitle, status, target_path }` contract. `target_path` is built on the backend and independently checked by the frontend against an explicit internal-route allow-list before navigation.

### Query and performance contract

Queries normalize whitespace, require 2–80 characters, escape regular-expression metacharacters, project only required fields, sort deterministically, and apply a database limit of five. The endpoint fans out concurrently to bounded domain adapters. Existing authorization/catalog indexes anchor the eligible set before case-insensitive matching; no collection is loaded into application memory. Because arbitrary substring matching is retained for product consistency, the matching portion is not a general text-index lookup and can examine records inside the already-authorized/indexed bucket.

### AppShell command palette

Authenticated AppShells expose one responsive, touch-safe trigger and support `Ctrl+K` and `Cmd+K`. The shared dialog provides autofocus, trapped/restored focus, Escape and outside-click close, Arrow/Home/End/Enter navigation, live announcements, loading/error/empty states, and role-specific quick actions. Search begins after a 250 ms debounce at two normalized characters. Query changes and close events abort the active request, while a generation guard prevents stale responses or stale errors from committing.

Client and freelancer quick actions pass only allow-listed URL state into their existing dashboards. Phase C does not redesign any dashboard, task workspace, notification surface, or legacy task modal.

## Phase D: Role-Aware Onboarding

Phase D adds a compact shared onboarding checklist to the existing client and freelancer dashboard overview responses and pages. Completion is derived on every dashboard refresh from authoritative `User`, `UserProfile`, canonical `UserSkill`, and marketplace `Task` facts. There is no onboarding collection, writable completion flag, new endpoint, or `ProjectTask` dependency. Administrators remain excluded.

Client onboarding covers identity, creation of a marketplace task, tracking the first assigned task, and review of the first delivered task. The review milestone completes when the real delivery approval transitions the task to `completed`; a freelancer rating remains optional and does not affect onboarding.

Freelancer onboarding covers professional profile fundamentals, at least one canonical skill, a first marketplace assignment, and a completed marketplace task. Canonical professional availability remains the `UserProfile.availability` preference. `open`, `limited`, and deliberately selected `unavailable` are all valid preferences and none is required for basic completion. The legacy marketplace task-availability selector remains a separate existing contract and is labelled accordingly.

### Progressive and privacy contract

Downstream items become applicable only when the real prerequisite exists, so a completed checklist may disappear and later reappear when an assignment or delivery introduces the next step. Reversible required facts, such as a canonical skill or identity field, restore the checklist when removed. The frontend never recalculates progress; it renders bounded serialized counts, stable ordered items, and backend-generated internal actions after an independent route allow-list check.

Public-safe project/showcase proof is an optional growth item after completed marketplace work and never affects required counts. Private work is never required to become public, and Phase D does not add Profile-to-Proof-to-Opportunity behavior.

## Later phases

Profile-to-Proof-to-Opportunity integration remains intentionally unimplemented after Phase D.
