# Collaboration Requests

A Collaboration Request is lightweight person-to-person professional intent. It is separate from Team invitations and join requests. Accepting one never creates a Team membership, Project participation, Project, chat room, or direct-message channel.

## States

```text
pending ──> accepted
        ├─> declined
        └─> cancelled
```

Only the recipient can accept or decline a pending request. Only the sender can cancel it. These operations condition on both identity and `pending` status so concurrent decisions have one state winner.

## Eligibility and context

The sender must have an authenticated active account and cannot target themselves. A general recipient must be active, public, discoverable, open/limited, and have no block relationship with the sender.

Optional context is allowlisted and validated:

- a Team can be referenced only by an active member of that Team;
- a Project can be referenced only by an active participant;
- Team-opening context is created only through the opening-interest endpoint;
- a Team opening must be open and belong to an active public Team.

Opening interest uses the Team owner as the request recipient and safely notifies active Team managers. Managers may then inspect deterministic candidates and issue the existing Team invitation. Interest does not create a separate application collection.

## Spam controls

- a partial unique index permits only one pending sender/recipient/context request;
- accepted context cannot be re-requested;
- declined/cancelled context has a 24-hour cooldown;
- a sender may have at most 20 pending outgoing requests;
- messages are optional plain text and limited to 500 characters;
- creation and opening-interest endpoints have a dedicated daily rate limit;
- bulk search has a separate browsing rate limit.

## Blocking

`user_blocks` stores one unique blocker/blocked-user pair. Blocking transactionally cancels pending requests in both directions and removes unread request notifications from the blocker’s inbox. Either direction suppresses actionable People Discovery for that viewer relationship and prevents new requests. The API uses the same neutral unavailable response whether a recipient is hidden, unavailable, missing, or blocking the sender. Users can list and remove only their own blocks.

## Notifications and privacy

Used notification types are `collaboration_request_received`, `collaboration_request_accepted`, `collaboration_request_declined`, and `team_opening_interest`. Metadata contains only safe entity IDs. Request inbox DTOs may show a minimal interaction identity but do not expose email, phone, account state/role, or private profile content. Person-to-person requests are never written to public Team activity.
