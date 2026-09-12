# TaskNexus API contracts

Phase 1 establishes `shared/contracts/domain.json` as the executable source of
truth for roles, statuses, task types, priorities, notification types, and task
state transitions. Backend and frontend constants are generated from it.

## Identifiers and fields

- Resource identifiers use `id`.
- Relationship identifiers use stable snake_case names such as `client_id`,
  `freelancer_id`, `task_id`, and `recipient_id`.
- `_id`, `taskId`, and other database-adapter aliases are not part of the public
  API contract.
- DTO serializers explicitly whitelist response fields. User credentials,
  refresh tokens, and reset tokens are never serialized.

## Response envelopes

Single resources use:

```json
{ "success": true, "data": { "id": "..." } }
```

Paginated collections use a named resource and pagination metadata:

```json
{
  "success": true,
  "data": { "tasks": [] },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0,
      "hasNext": false,
      "hasPrevious": false
    }
  }
}
```

Errors use one stable envelope and include the request ID returned in the
`x-request-id` response header:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Task is no longer available for acceptance",
    "request_id": "...",
    "details": {}
  }
}
```

Canonical codes introduced in Phase 1 are `AUTH_REQUIRED`, `FORBIDDEN`,
`VALIDATION_FAILED`, `NOT_FOUND`, `CONFLICT`, and
`INVALID_STATE_TRANSITION`. Legacy codes remain temporarily supported while
older controllers are migrated.

Team-specific codes include `TEAM_NOT_FOUND`, `TEAM_SLUG_TAKEN`, `TEAM_ACCESS_DENIED`, `ALREADY_TEAM_MEMBER`, `NOT_TEAM_MEMBER`, `TEAM_INVITATION_EXISTS`, `TEAM_INVITATION_NOT_FOUND`, `JOIN_REQUEST_EXISTS`, `JOIN_REQUEST_NOT_FOUND`, `INVALID_TEAM_ROLE`, and `OWNER_TRANSFER_REQUIRED`.

## Teams

```text
GET    /api/teams
POST   /api/teams
GET    /api/teams/:slug
PATCH  /api/teams/:id
POST   /api/teams/:id/archive
GET    /api/teams/:id/members
POST   /api/teams/:id/join
POST   /api/teams/:id/leave
PATCH  /api/teams/:id/members/:userId/role
DELETE /api/teams/:id/members/:userId
POST   /api/teams/:id/transfer-ownership
GET    /api/teams/:id/activity
```

Invitations use `/api/teams/:id/invitations`, `/api/team-invitations`, and explicit `accept`/`decline` actions. Join requests use `/api/teams/:id/join-requests`, `/api/team-join-requests`, and explicit `accept`/`reject` actions. Invite search is bounded at `/api/teams/:id/invite-candidates` and returns only safe summaries for public profiles.

Team summaries expose `id`, `slug`, name/presentation fields, visibility, join policy, calculated member count, public owner summary, and viewer relationship. Team detail adds bounded description, safe member preview, and server-derived permissions. Raw membership, user, and profile documents are never returned.

## Projects

```text
GET    /api/projects
GET    /api/teams/:teamId/projects
POST   /api/teams/:teamId/projects
GET    /api/projects/by-slug/:teamSlug/:projectSlug
GET    /api/projects/:id
PATCH  /api/projects/:id
POST   /api/projects/:id/status
POST   /api/projects/:id/complete
POST   /api/projects/:id/archive
GET    /api/projects/:id/participants
GET    /api/projects/:id/participant-candidates
POST   /api/projects/:id/participants
PATCH  /api/projects/:id/participants/:userId/role
DELETE /api/projects/:id/participants/:userId
GET    /api/projects/:id/tasks
POST   /api/projects/:id/tasks
GET    /api/project-tasks/:id
PATCH  /api/project-tasks/:id
POST   /api/project-tasks/:id/status
POST   /api/project-tasks/:id/assignees
DELETE /api/project-tasks/:id/assignees/:userId
GET    /api/projects/:id/milestones
POST   /api/projects/:id/milestones
PATCH  /api/project-milestones/:id
DELETE /api/project-milestones/:id
GET    /api/projects/:id/activity
```

Project summary/detail DTOs expose the parent Team summary, effective visibility, safe Profile V2 participant summaries, bounded progress summaries, and server-derived `viewer_permissions`. Workspace task, milestone, and activity routes require active Team membership plus the appropriate Project context. Direct private-resource IDOR is concealed as `PROJECT_NOT_FOUND`.

Project Task writes use an integer `revision` for compare-and-set updates. Assignment accepts only active Project participants whose parent Team membership is still active. Status, role, completion, and archival changes use dedicated action endpoints rather than generic field spreading.

## Contributions and showcases

```text
GET    /api/contributions/me
GET    /api/projects/:projectId/contributions
GET    /api/projects/:projectId/contributions/:userId
POST   /api/projects/:projectId/evidence
DELETE /api/contribution-evidence/:id
POST   /api/contribution-evidence/:id/verify
PATCH  /api/projects/:projectId/profile-visibility
GET    /api/projects/:projectId/repositories
POST   /api/projects/:projectId/repositories
DELETE /api/projects/:projectId/repositories/:repositoryId
POST   /api/projects/:projectId/repositories/:repositoryId/verify
GET    /api/projects/:projectId/showcase
PUT    /api/projects/:projectId/showcase
POST   /api/projects/:projectId/showcase/publish
POST   /api/projects/:projectId/showcase/unpublish
GET    /api/showcase/:teamSlug/:projectSlug
```

Contribution lists expose bounded evidence DTOs with type, verification, lifecycle, provenance, occurrence/verification/revocation timestamps, safe source context, Project context, and public Profile summaries. Summaries count evidence by type and verification only; they do not calculate scores or rankings.

Only the authenticated claimant may add, verify, or revoke their user-origin evidence. The server derives `user_id` from the access token. GitHub claims require a linked canonical repository and begin `unverified`; verification is a separately rate-limited backend action. System evidence is immutable.

Repository management and showcase publication require server-derived management permissions. Showcase writes use `revision` compare-and-set. Publication requires a public Team, public completed Project, complete narrative, and valid active featured evidence.

The public showcase endpoint has a distinct allowlisted DTO: safe Team/Project summaries, published narrative/media, selected safe evidence, public participant profiles with factual counts, verified public repositories, and SEO fields. It never returns internal task titles/descriptions, activity, claimant metadata, source keys, hidden profiles, drafts, or revoked evidence.

## People discovery, openings, and collaboration

All bulk discovery routes require authentication.

```text
GET    /api/people
GET    /api/team-openings
GET    /api/teams/:teamId/openings
POST   /api/teams/:teamId/openings
PATCH  /api/team-openings/:id
POST   /api/team-openings/:id/close
GET    /api/team-openings/:id/candidates
POST   /api/team-openings/:id/interest

GET    /api/collaboration-requests
POST   /api/collaboration-requests
POST   /api/collaboration-requests/:id/accept
POST   /api/collaboration-requests/:id/decline
DELETE /api/collaboration-requests/:id

GET    /api/user-blocks
POST   /api/user-blocks
DELETE /api/user-blocks/:userId
```

`GET /api/people` accepts bounded `search`, comma-separated `skills`, `roles`, `interests`, `availability`, explicit `skillMode=all|any`, two factual-evidence booleans, and pagination. Its dedicated DTO excludes account/contact/session data, private education, private Teams/Projects/evidence, and draft showcases. Team openings expose canonical role and safe skill/Team summaries. Only contextual Team owners/admins may create, edit, close, or search candidates.

Request mutations are explicit actions. `recipientId` is allowlisted on create; sender/status/context ownership fields cannot be mass-assigned. The recipient alone accepts/declines and sender alone cancels. Opening interest creates a request referencing the opening. Accepted state records intent only.

## Hackathon collaboration

Public catalog reads are available without authentication; all personal/workspace actions require authentication. Catalog writes require the platform `admin` role, while Team-scoped writes require an active Team `owner` or `admin` membership.

```text
GET    /api/hackathons
GET    /api/hackathons/:slug
POST   /api/admin/hackathons
PATCH  /api/admin/hackathons/:id
POST   /api/admin/hackathons/:id/archive

POST   /api/hackathons/:id/participation
PATCH  /api/hackathons/:id/participation
DELETE /api/hackathons/:id/participation
GET    /api/hackathons/:id/people
POST   /api/hackathons/:id/teams
GET    /api/hackathons/:id/teams/me

POST   /api/hackathon-teams/:id/withdraw
POST   /api/hackathon-teams/:id/project
DELETE /api/hackathon-teams/:id/project
GET    /api/hackathon-teams/:id/submission
PUT    /api/hackathon-teams/:id/submission
POST   /api/hackathon-teams/:id/submission/submit
```

`GET /api/hackathons` supports bounded search, stored status, mode, theme, recommended skill, date, sort, pagination, and authenticated `my=true`. The detail DTO includes public catalog facts plus only the caller's own participation/Team context. Private or archived events are not exposed to ordinary public callers.

Participation identity comes from the access token. Event People discovery further intersects visible Looking-for-Team participants with the existing Phase 6 discoverability/privacy/availability/block rules. Collaboration requests and Team Openings accept validated optional Hackathon context but keep their original state machines.

Team registration accepts an existing `teamId`; it never accepts member/role data. Project linking accepts an existing same-Team `projectId` plus the current registration `revision`. Draft save accepts only HTTPS link/checklist fields and the current submission revision. Final submit requires `{ revision, confirm: true }`, recomputes readiness and deadline eligibility on the server, and makes the record immutable.

## Pagination query

Collection endpoints accept `page`, `limit`, `sortBy`, `sortOrder`, and
`search`. Limits are clamped to 100 and sort fields are endpoint allowlists.
Task search is performed by the database against the task title.

## Idempotency

Task work submission accepts an `Idempotency-Key` request header. If omitted,
the server request ID is used. MongoDB stores the key under a unique partial
index and returns the existing submission for a replay.

## Opportunity platform

Public reads: `GET /api/organizations`, `GET /api/organizations/:slug`, `GET /api/opportunities`, and `GET /api/opportunities/:slug`. Discovery accepts bounded pagination plus `search`, `type`, `skills`, `workMode`, `location`, `organization`, `graduationYear`, `freshersAllowed`, `compensationDisclosed`, and allowlisted `sortBy`.

Authenticated candidate reads/writes: `GET /api/opportunities/me/saved`, `POST|DELETE /api/opportunities/:id/save`, `GET /api/applications`, and `PUT|DELETE /api/opportunities/:id/application`. User identity is token-derived. Application PUT accepts an allowlisted status, optional private notes, and the current revision for updates.

Administrator catalog writes: `POST|PATCH /api/admin/organizations`, `POST /api/admin/organizations/:id/verify`, `POST|PATCH /api/admin/opportunities`, and publish/close/archive POST transitions. Update and transition DTOs require a revision. Public DTOs omit eligibility and candidate state; authenticated Opportunity DTOs add only the caller's eligibility and state.
