# Architecture boundaries

## Request flow

```text
Browser → Express validation/auth → domain service → Mongo data adapter → Mongoose → MongoDB
        ← serializer/DTO ← canonical response envelope
```

The backend is authoritative for authorization and state transitions. Shared frontend constants support presentation but never grant access. Mongoose documents do not cross the API boundary; serializers expose canonical string `id` values and whitelisted fields.

## Identity and authorization

`client`, `freelancer`, and `admin` remain global marketplace roles. Team permissions are derived only from an active `TeamMembership` and its contextual `owner`, `admin`, or `member` role. A global administrator receives no implicit access to a private team. Future Project permissions must follow the same contextual pattern rather than extending global account roles.

## Event meanings

- A domain event describes a business fact.
- A realtime event is an ephemeral SSE refresh hint.
- A notification is a durable recipient-facing record.
- An audit entry records accountability and operational history.

These concepts may originate from one action but are not interchangeable.

## Pagination

Current list endpoints use bounded page/offset pagination with allowlisted sort fields. Composite MongoDB indexes serve task, notification, profile, and administration query patterns. Cursor pagination remains a later option for genuinely high-write feeds.
