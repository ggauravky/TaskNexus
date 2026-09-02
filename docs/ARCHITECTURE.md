# Architecture boundaries after Phase 1

## Identity and authorization

Current `client`, `freelancer`, and `admin` roles are legacy global product and
system roles. They remain necessary for the current commercial-task workflow,
but they are not a model for future collaboration authorization.

Future Team/Project permissions should be contextual membership permissions
attached to a user, team, or project. Phase 1 does not add those tables or
permissions. The shared contract and serializer layers keep that future change
from leaking database representation directly into UI code.

## Event meanings

- A domain event describes a business fact such as task assignment.
- A realtime event is an ephemeral SSE hint that lets an authorized UI refresh.
- A persisted notification is a durable recipient-facing item with read state.
- An audit event records accountability and operational history.

One fact may produce more than one of these, but they are not interchangeable.
Realtime delivery must not be treated as durable notification storage.

## Pagination

Phase 1 uses offset/page pagination for current administration, task, and
notification lists. It is simple, deterministic for the current scale, and
backed by allowlisted ordering plus composite indexes. Cursor pagination can be
considered later only for feeds whose write volume makes offsets unstable.

## Request flow

```text
Browser → Express validation/auth → domain service → data adapter/RPC
        ← serializer/DTO ← canonical response envelope ← PostgreSQL
```

The backend is authoritative for authorization and state transitions. Shared
frontend constants support presentation but never grant access.
