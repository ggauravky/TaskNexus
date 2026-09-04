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

## Pagination query

Collection endpoints accept `page`, `limit`, `sortBy`, `sortOrder`, and
`search`. Limits are clamped to 100 and sort fields are endpoint allowlists.
Task search is performed by the database against the task title.

## Idempotency

Task work submission accepts an `Idempotency-Key` request header. If omitted,
the server request ID is used. MongoDB stores the key under a unique partial
index and returns the existing submission for a replay.
