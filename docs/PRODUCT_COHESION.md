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

## Later phases

Global Search/Command Palette, role-aware onboarding, and Profile-to-Proof-to-Opportunity integration remain intentionally unimplemented after Phase B.
