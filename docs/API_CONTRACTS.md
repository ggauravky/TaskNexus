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

## Pagination query

Collection endpoints accept `page`, `limit`, `sortBy`, `sortOrder`, and
`search`. Limits are clamped to 100 and sort fields are endpoint allowlists.
Task search is performed by the database against the task title.

## Idempotency

Task work submission accepts an `Idempotency-Key` request header. If omitted,
the server request ID is used. MongoDB stores the key under a unique partial
index and returns the existing submission for a replay.
