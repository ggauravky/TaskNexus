# Architecture boundaries

## Request flow

```text
Browser → Express validation/auth → domain service → Mongo data adapter → Mongoose → MongoDB
        ← serializer/DTO ← canonical response envelope
```

The backend is authoritative for authorization and state transitions. Shared frontend constants support presentation but never grant access. Mongoose documents do not cross the API boundary; serializers expose canonical string `id` values and whitelisted fields.

## Identity and authorization

Current `client`, `freelancer`, and `admin` roles are global product roles. Future Team/Project permissions must be contextual membership permissions rather than extensions of these global roles.

## Event meanings

- A domain event describes a business fact.
- A realtime event is an ephemeral SSE refresh hint.
- A notification is a durable recipient-facing record.
- An audit entry records accountability and operational history.

These concepts may originate from one action but are not interchangeable.

## Pagination

Current list endpoints use bounded page/offset pagination with allowlisted sort fields. Composite MongoDB indexes serve task, notification, profile, and administration query patterns. Cursor pagination remains a later option for genuinely high-write feeds.
