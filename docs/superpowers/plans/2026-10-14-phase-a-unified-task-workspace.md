# Phase A Unified Marketplace Task Workspace Implementation Plan

> **Execution scope:** Phase A only. Do not implement notifications, global search, onboarding, or proof integration.

**Goal:** Make `/tasks/:taskId` the strict participant-only, canonical marketplace task work surface while preserving every existing marketplace workflow contract.

**Architecture:** Add a narrow workspace read service/controller/route whose serialized permissions and `available_actions` are authoritative. Build a lazy-tabbed React page over that contract and existing task collaboration, progress, submission, review, and rating APIs. Change dashboard navigation to deep-link into the workspace while retaining both legacy task modals until browser parity is proven.

**Stack:** Express, Mongoose data adapters, Jest/Supertest, React 18, React Router, Axios, Tailwind CSS, Vite.

---

## Task 1: Lock the workspace authorization and action contract with tests

**Files:**

- Create: `backend/tests/taskWorkspace.test.js`
- Create: `backend/src/services/taskWorkspaceService.js`
- Modify: `backend/src/controllers/taskController.js`
- Modify: `backend/src/routes/task.routes.js`
- Modify only if needed: `backend/src/serializers/index.js`

1. Add failing tests for task client, assigned freelancer, unrelated client, unrelated freelancer, unassigned freelancer, and administrator access.
2. Add failing table tests for lifecycle/role-derived permissions and `available_actions`.
3. Run only `taskWorkspace.test.js` and confirm the expected missing-service/route failures.
4. Implement strict participant authorization with UUID-safe task retrieval.
5. Compose an explicit workspace serializer from existing task, participant, submission, and rating data.
6. Add `GET /api/tasks/:id/workspace` before the generic `/:id` route.
7. Rerun the focused tests until green.

## Task 2: Add frontend route and workspace orchestration

**Files:**

- Create: `frontend/src/pages/TaskWorkspacePage.jsx`
- Create: `frontend/src/components/tasks/TaskWorkspaceHeader.jsx`
- Create: `frontend/src/components/tasks/TaskWorkspaceTabs.jsx`
- Create: `frontend/src/components/tasks/TaskOverview.jsx`
- Modify: `frontend/src/App.jsx`
- Reuse: `frontend/src/services/api.js`
- Reuse: canonical marketplace/domain utilities and shared design primitives

1. Add protected lazy route `/tasks/:taskId`.
2. Load only `/tasks/:id/workspace` initially.
3. Treat backend `permissions` and `available_actions` as authoritative.
4. Synchronize the accessible tab selection with `?tab=` and fall back safely to Overview.
5. Implement compact dark header, lifecycle context, overview fields, loading, 403/404, and safe retry states.
6. Run frontend lint.

## Task 3: Implement lazy Work tab over existing progress/subtask contracts

**Files:**

- Create: `frontend/src/components/tasks/TaskWork.jsx`
- Reuse/adjust: marketplace status and error utilities
- Modify only if contract parity requires it: task/freelancer controllers or serializers
- Extend: `backend/tests/taskWorkspace.test.js` and existing task controller tests

1. Add focused backend tests for any exposed progress/action parity gaps.
2. Lazy-fetch subtasks on first Work activation.
3. Show server-backed progress, stage, note, and last update.
4. Keep client progress read-only and freelancer editing gated by backend permissions.
5. Preserve existing subtask create/update/delete payloads and write authorization.
6. Disable all pending mutations and refresh workspace plus subtasks after success.
7. Run focused backend tests and frontend lint.

## Task 4: Implement lazy Delivery tab and full revision/approval/rating parity

**Files:**

- Create: `frontend/src/components/tasks/TaskDelivery.jsx`
- Reuse: existing submit, freelancer revision, client review, and rating endpoints
- Extend: `backend/tests/taskWorkspace.test.js` and relevant submission/task tests

1. Verify existing deliverable types, HTTPS URL validation, submission history, revision feedback, review payload, and rating payload.
2. Add failing backend tests for any workspace contract data or action gating needed by these flows.
3. Lazy-load delivery detail/history only on first activation.
4. Implement submit/resubmit, approve confirmation, required revision feedback, and rating where authoritative actions permit.
5. Preserve history and refresh workspace/delivery after each mutation.
6. Prevent double submissions and render canonical safe API errors.
7. Run focused tests and lint.

## Task 5: Reframe existing collaboration and activity as lazy tabs

**Files:**

- Modify: `frontend/src/components/common/TaskCollaborationPanel.jsx`
- Create: `frontend/src/components/tasks/TaskDiscussion.jsx`
- Create: `frontend/src/components/tasks/TaskActivity.jsx`
- Extend relevant backend authorization tests if gaps are discovered

1. Make `TaskCollaborationPanel` support focused dark workspace presentation without breaking modal consumers.
2. Lazy-load comments/attachments only when Discussion activates.
3. Preserve authenticated attachment upload/download and mention contracts.
4. Lazy-load actual persisted activity only when Activity activates; do not synthesize events.
5. Preserve pagination/bounds exposed by existing APIs.
6. Verify unrelated users cannot read comments, attachments, subtasks, or activity.

## Task 6: Deep-link client and freelancer dashboards

**Files:**

- Modify: `frontend/src/pages/ClientDashboard.jsx`
- Modify: `frontend/src/pages/FreelancerDashboard.jsx`
- Keep: both existing `TaskDetailsModal.jsx` files

1. Replace normal Open/View/Continue/Review navigation with `/tasks/:taskId` and contextual delivery/revision tabs.
2. Keep available-task preview/accept interactions and both legacy modals until browser parity is documented.
3. Remove no modal code during Phase A unless exact feature parity is proven by acceptance QA.
4. Run frontend lint and production build.

## Task 7: Focused and regression verification

1. Run focused workspace/task/submission Jest suites.
2. Run complete backend Jest if focused tests pass.
3. Run marketplace-relevant Mongo and API integration scripts against the configured safe staging/test target.
4. Run backend lint and frontend lint.
5. Run frontend production build including `verifyProductionConfig.mjs`.
6. Inspect `git diff --check`, relevant full diff, and changed-file diagnostics.

## Task 8: Browser acceptance and Phase A report

1. Start the local backend/frontend with existing safe environment configuration.
2. Verify client and freelancer workspace golden paths and strict IDOR responses.
3. Verify 320, 375, 390, 430, 768, 1024, and 1440 widths.
4. Confirm no uncaught console errors, React warnings, CSP/CORS failures, unexpected 404s, infinite requests, or eager secondary-tab fetches.
5. Record modal parity status honestly; do not remove modals unless all behaviors are demonstrated.
6. Return the requested Phase A report and stop before Phase B.

## Safety Constraints

- Marketplace `tasks` and `project_tasks` remain separate.
- No deployment, push, cloud mutation, secrets, or production email.
- No commit without explicit user authorization.
- No Phase B-E implementation.
