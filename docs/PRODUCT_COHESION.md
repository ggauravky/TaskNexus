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

## Later phases

Notification Center, Global Search/Command Palette, role-aware onboarding, and Profile-to-Proof-to-Opportunity integration are intentionally not implemented in Phase A.
