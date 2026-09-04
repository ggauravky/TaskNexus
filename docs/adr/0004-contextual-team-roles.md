# ADR 0004: Contextual team roles instead of global account roles

Status: accepted

## Context

TaskNexus already has global marketplace roles: `client`, `freelancer`, and `admin`. A user may own one collaboration team, administer another, participate in a third, and have no access to a fourth. Reusing the global role would couple unrelated marketplace permissions to team authorization and make private-team IDOR difficult to prevent.

## Decision

Represent team authorization with a first-class `team_memberships` collection. Each active relationship has exactly one contextual role: `owner`, `admin`, or `member`. Controllers never trust a requested role or `users.role`; focused authorization helpers load the active membership for the target team.

Use separate collections for invitations and join requests so pending access is not overloaded onto membership state. Use transactions for creation, acceptance/approval, removal/leave transitions, and ownership transfer. Use a partial unique owner index plus service invariants to keep one active owner.

## Consequences

- One account can hold different permissions in different teams.
- Global administrators do not bypass team privacy.
- Phase 4 can build project authorization on an explicit team boundary.
- Every sensitive endpoint performs a team-scoped read, adding a small indexed lookup.
- Ownership cannot be changed by generic updates and owners cannot simply leave.

## Deferred work

Projects, project roles, team chat, recommendations, hard deletion, email invitations, and denormalized member counters are not part of this decision.
