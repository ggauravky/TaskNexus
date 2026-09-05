# ADR 0005: Team authorization versus Project authorization

- Status: accepted
- Date: 2026-09-05

## Context

Projects belong to Teams, while Project roles describe responsibility inside only one Project. Treating Project participation as an independent access grant would allow stale Project records to bypass Team removal and would blur contextual Team authority with global marketplace roles.

## Decision

Active Team membership is the root permission boundary. Project participation is a narrower context layered beneath it. Team owners/admins manage Projects through their Team role. Other members require an active `ProjectParticipant` record as `lead` or `contributor` for workspace access. Global marketplace administrators receive no implicit override.

Project authorization resolves the Project, parent Team, active Team membership, and active Project participation together. Team membership termination deactivates Project participation and unassigns open work transactionally. Direct private-resource access is concealed when the root boundary is absent.

## Consequences

- Project participation can never restore permission after Team membership ends.
- Team owners/admins retain consistent authority over Team-owned Projects.
- A Team member may be a lead in one Project and a contributor or non-participant in another.
- Authorization requires contextual reads, served by compound indexes and a focused authorization service.
- Historical completed-task attribution is retained while future mutation and assignment are revoked.
