# Phase B Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved TaskNexus V2 notification center with safe internal deep links, authoritative persisted read state, focused realtime reconciliation, an accessible AppShell bell/panel, and a protected paginated history page.

**Architecture:** Preserve the existing `notifications` collection, routes, preferences, and creation call sites. Add one pure backend target resolver used by the serializer, make ownership-sensitive mutations atomic and serialized, publish the same DTO over SSE that HTTP returns, then place a reducer-backed notification provider around the authenticated shell so the recent panel and full page share one source of UI state.

**Tech Stack:** Node.js, Express, Mongoose, Jest/Supertest, React 18, React Router, Axios, server-sent events, Node test runner, Tailwind/CSS.

**Spec:** `docs/superpowers/specs/2026-10-14-product-cohesion-design.md`

## Global Constraints

- Implement only Phase B. Do not begin Search, Onboarding, or Profile/Proof integration.
- Reuse the existing notification persistence model, domain services, ownership filters, preferences, and SSE infrastructure.
- All navigation targets must be internal allow-listed paths; unknown or inconsistent notifications resolve to `/notifications`.
- Notification history remains paginated and the recent panel requests a small fixed page.
- Realtime is an enhancement; API reads and mutations remain the correctness path.
- Expose only existing preferences that current creation/delivery paths actually honor; do not add a rules engine.
- All user-visible failures use the canonical safe API error helper and retain a retry path.
- Preserve the canonical dark design system and responsive behavior at 320, 375, 390, 430, 768, 1024, and 1440 pixels.
- Do not deploy, push, modify Render/Vercel/Atlas, rename/create databases, or change production infrastructure.
- Do not create a commit without explicit user authorization.

## Review Focus

- A hostile `content.actionUrl` such as `https://evil.example`, `//evil.example`, `javascript:...`, a backslash path, or an entity-inconsistent route must resolve to `/notifications`.
- Duplicate/out-of-order `notification.created` events and API refreshes must not duplicate rows or inflate unread count.
- Read mutations racing with SSE or page refresh must converge on server state and never produce a negative unread count.
- A failed open/mark-read action must preserve a usable row, announce a contextual error, and not navigate prematurely.
- Focus must enter the recent panel, remain trapped while open, close on Escape/outside action, and return to the bell across desktop and narrow layouts.

---

### Task 1: Notification Event Audit and Safe Target Resolver

**Files:**
- Create: `docs/notification-event-matrix.md`
- Create: `backend/src/services/notificationTargetService.js`
- Modify: `backend/src/serializers/index.js`
- Test: `backend/tests/notificationTargetService.test.js`
- Test: `backend/tests/apiContracts.test.js`

**Interfaces:**
- Consumes: existing notification fields `type`, `entity_type`, `entity_id`, `related_task_id`, `content.actionUrl`, `content.commentId`, and `metadata`.
- Produces: `normalizeInternalNotificationPath(value: unknown): string | null`, `resolveNotificationTarget(notification: object): string`, and serialized `target_path: string`.

- [ ] **Step 1: Document the event matrix and current UI support**

Record every existing creation call site as `event -> recipient -> type -> entity/task reference -> resolved target -> UI support`, covering marketplace task lifecycle, team/organization invitations, collaboration requests, application changes, project events, and hackathon events. Note missing entity context without inventing new events.

- [ ] **Step 2: Write failing resolver and serializer tests**

Add tests proving task delivery/revision notifications route to `/tasks/:id?tab=delivery`, task comment mentions route to `?tab=discussion`, task progress routes to `?tab=work`, invitations/applications/collaboration route to their existing internal pages, valid allow-listed `content.actionUrl` values normalize, and unknown types fall back to `/notifications`. Assert rejection of external origins, protocol-relative paths, JavaScript URLs, malformed identifiers, backslashes, control characters, and a task notification whose action URL points to another domain.

- [ ] **Step 3: Run the tests and verify RED**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/notificationTargetService.test.js tests/apiContracts.test.js`

Expected: FAIL because the target resolver and `target_path` do not exist.

- [ ] **Step 4: Implement the pure allow-listed resolver and serializer field**

Use explicit type groups and existing route shapes. Prefer trusted `related_task_id` for marketplace task targets; accept existing action URLs only after normalization and route allow-list validation. Never expose the original unsafe URL as `target_path`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/notificationTargetService.test.js tests/apiContracts.test.js`

Expected: PASS with all target and DTO cases green.

- [ ] **Step 6: Record the verified task; do not commit without explicit authorization**

### Task 2: Ownership-Safe Notification API and Realtime DTO

**Files:**
- Modify: `backend/src/data/notificationData.js`
- Modify: `backend/src/controllers/notificationController.js`
- Modify: `backend/src/services/notificationService.js`
- Test: `backend/tests/notificationController.test.js`
- Test: `backend/tests/notificationRealtime.test.js`

**Interfaces:**
- Consumes: `serializeNotification(notification)` and `resolveNotificationTarget` from Task 1.
- Produces: `updateNotificationForRecipient(id: string, recipientId: string, updates: object)`, `deleteNotificationForRecipient(id: string, recipientId: string)`, HTTP notification DTOs with `target_path`, and SSE `{ notification: NotificationDTO, unreadIncrement: 0 | 1 }`.

- [ ] **Step 1: Write failing ownership, pagination, mutation, and SSE tests**

Cover list filters being pinned to `req.user.id`, unread pagination/counts, cross-user mark/delete returning the existing safe 404, atomic recipient-filtered mark-one/delete operations, serialized mark-one responses, mark-all touching only unread rows owned by the caller, and `notification.created` carrying the serialized DTO/target path. Include a duplicate/read notification event shape with `unreadIncrement: 0`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/notificationController.test.js tests/notificationRealtime.test.js`

Expected: FAIL because mutations are ID-only after a separate read and SSE publishes raw notification data.

- [ ] **Step 3: Implement atomic ownership mutations and DTO responses**

Move ownership into the update/delete query, keep the current paginated list contract, serialize every returned notification, and preserve current status codes/messages. Keep `read_at` server-generated and prevent an already-read row from inflating reconciliation.

- [ ] **Step 4: Publish serialized focused SSE data**

`NotificationService.create` publishes only the canonical serialized notification plus the bounded unread increment. Do not introduce reloads or unrelated events.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/notificationController.test.js tests/notificationRealtime.test.js tests/notificationTargetService.test.js`

Expected: PASS.

- [ ] **Step 6: Record the verified task; do not commit without explicit authorization**

### Task 3: Frontend Notification State and API Provider

**Files:**
- Create: `frontend/src/utils/notificationState.js`
- Create: `frontend/src/context/NotificationContext.jsx`
- Modify: `frontend/src/components/layout/AppShell.jsx`
- Test: `frontend/tests/notificationState.test.js`

**Interfaces:**
- Consumes: `GET /notifications?page=1&limit=8`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, canonical notification DTOs, and `useRealtimeEvents` `notification.created` events.
- Produces: `notificationReducer(state, action)`, `NotificationProvider`, and `useNotifications()` exposing `notifications`, `unreadCount`, `loading`, `error`, `refreshRecent`, `markRead`, and `markAllRead`.

- [ ] **Step 1: Write failing reducer tests**

Assert bounded recent replacement, deduplicating prepend by notification ID, unread reconciliation from server refresh, no double increment for duplicate SSE, mark-one decrement exactly once, mark-all convergence to zero, no negative unread count, and failed optimistic operations restoring the prior row/count.

- [ ] **Step 2: Run the tests and verify RED**

Run: `rtk node --test frontend/tests/notificationState.test.js`

Expected: FAIL because the reducer module does not exist.

- [ ] **Step 3: Implement the pure reducer**

Keep at most eight recent rows, merge by ID, and make server refresh authoritative. Actions must be deterministic and independent of React.

- [ ] **Step 4: Run reducer tests and verify GREEN**

Run: `rtk node --test frontend/tests/notificationState.test.js`

Expected: PASS.

- [ ] **Step 5: Implement `NotificationProvider` and authenticated-shell wiring**

Fetch the recent page and unread count on mount, refresh on focus/reconnect, reconcile `notification.created`, persist read mutations, roll back recoverably on failure, and avoid creating more than one realtime stream for one shell. Use the canonical safe error formatter.

- [ ] **Step 6: Run reducer tests and frontend lint**

Run: `rtk node --test frontend/tests/notificationState.test.js && rtk npm --prefix frontend run lint`

Expected: PASS with zero warnings.

- [ ] **Step 7: Record the verified task; do not commit without explicit authorization**

### Task 4: Accessible AppShell Bell and Recent Panel

**Files:**
- Create: `frontend/src/components/notifications/NotificationBell.jsx`
- Create: `frontend/src/components/notifications/NotificationPanel.jsx`
- Create: `frontend/src/components/notifications/NotificationRow.jsx`
- Modify: `frontend/src/components/layout/AppShell.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/tests/notificationState.test.js`

**Interfaces:**
- Consumes: `useNotifications()` from Task 3 and DTO `target_path` from Task 1.
- Produces: an accessible bell with badge `1..99`/`99+` and a focus-managed recent panel that marks read before navigating.

- [ ] **Step 1: Add failing pure behavior tests**

Add helper assertions for badge formatting (`0`, `1`, `99`, `99+`), accessible unread label text, and open behavior that returns a navigation target only after a successful mark-read result.

- [ ] **Step 2: Run tests and verify RED**

Run: `rtk node --test frontend/tests/notificationState.test.js`

Expected: FAIL because the presentation helpers are missing.

- [ ] **Step 3: Implement the bell, panel, rows, and responsive styling**

Support click/outside close, Escape, focus entry/trap/restoration, unread styling beyond color, pending row state, retryable contextual failure, mark-all, and `/notifications` link. The bell remains visible in authenticated desktop and mobile headers without horizontal overflow.

- [ ] **Step 4: Run tests and lint**

Run: `rtk node --test frontend/tests/notificationState.test.js && rtk npm --prefix frontend run lint`

Expected: PASS.

- [ ] **Step 5: Record the verified task; do not commit without explicit authorization**

### Task 5: Protected Paginated Notifications Page

**Files:**
- Create: `frontend/src/pages/NotificationsPage.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/layout/AppShell.jsx`
- Modify: `frontend/src/index.css`
- Create: `frontend/src/utils/notificationFilters.js`
- Test: `frontend/tests/notificationFilters.test.js`

**Interfaces:**
- Consumes: `GET /notifications?page=<n>&limit=20&unreadOnly=<true|false>`, read mutations from Task 3, and URL query `filter=all|unread&page=<positive integer>`.
- Produces: protected `/notifications` route with URL-backed filters, bounded pagination, mark-one, mark-all, loading/empty/error states, and safe target navigation.

- [ ] **Step 1: Write failing URL/filter helper tests**

Cover invalid filter fallback to `all`, invalid/negative/oversized page fallback to `1`, stable query generation, and resetting page to `1` when the filter changes.

- [ ] **Step 2: Run tests and verify RED**

Run: `rtk node --test frontend/tests/notificationFilters.test.js`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement URL helpers and the protected page**

Use a fixed page size of 20, API pagination metadata, no unbounded request, backend `target_path`, server-authoritative refresh after mutation, and canonical safe errors. Add the route to private metadata and authenticated navigation.

- [ ] **Step 4: Run frontend tests and lint**

Run: `rtk node --test frontend/tests/notificationState.test.js frontend/tests/notificationFilters.test.js && rtk npm --prefix frontend run lint`

Expected: PASS.

- [ ] **Step 5: Record the verified task; do not commit without explicit authorization**

### Task 6: Phase B Documentation, Regression, and Browser Gate

**Files:**
- Modify: `docs/PRODUCT_COHESION.md`
- Modify: `docs/notification-event-matrix.md`
- Test: existing backend/frontend suites and browser QA records

**Interfaces:**
- Consumes: all Task 1-5 contracts.
- Produces: Phase B architecture documentation and fresh gate evidence.

- [ ] **Step 1: Update focused architecture documentation**

Document the notification target trust boundary, DTO shape, ownership rules, pagination limits, provider reconciliation, SSE fallback behavior, accessible panel/page, and any event-matrix gaps left intentionally on API refresh only.

- [ ] **Step 2: Run focused Phase B tests**

Run: `rtk npm --prefix backend test -- --runTestsByPath tests/notificationTargetService.test.js tests/notificationController.test.js tests/notificationRealtime.test.js tests/apiContracts.test.js`

Run: `rtk node --test frontend/tests/notificationState.test.js frontend/tests/notificationFilters.test.js`

Expected: PASS with exact counts captured.

- [ ] **Step 3: Run backend regression and lint**

Run: `rtk npm --prefix backend test`

Run: `rtk npm --prefix backend run lint`

Expected: PASS with zero failures/warnings.

- [ ] **Step 4: Run frontend lint and production build**

Run: `rtk npm --prefix frontend run lint`

Run: `rtk npm --prefix frontend run build`

Expected: PASS, including the production configuration verifier.

- [ ] **Step 5: Run relevant Mongo/API integration**

Against the already validated non-production database only, run the repository Mongo and API integration scripts and verify notification persistence/ownership alongside marketplace regressions. Do not bypass `stagingSafety`.

- [ ] **Step 6: Perform browser acceptance**

Verify authenticated client and freelancer notification flows at 320, 375, 390, 430, 768, 1024, and 1440: bell/badge, panel focus/Escape/restoration, recent open/mark-read, mark-all, `/notifications` all/unread filters and pagination, safe deep links, SSE update plus API fallback, no unauthorized rows, zero uncaught console errors/warnings, and no unexpected failed network requests.

- [ ] **Step 7: Inspect final changes and stop at the Phase B gate**

Run: `rtk git status --short`, `rtk git diff --stat`, full relevant `rtk git diff`, and `rtk git diff --check`. Confirm no environment, infrastructure, Atlas, Render, or Vercel files changed. Do not push/deploy or begin Phase C.

- [ ] **Step 8: Record the verified task; do not commit without explicit authorization**
