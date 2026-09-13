# ADR 0010: contextual Organization hiring and native applications

## Status

Accepted — 2026-09-13

## Decision

Keep global user roles unchanged. Represent employer authority through independent Organization memberships with owner/admin/recruiter roles. Initial ownership is platform-admin approved and exactly-one-owner is database- and transaction-enforced.

Keep candidate-owned external tracking unchanged. Add a separate native application aggregate for Organization-owned Opportunities, storing a bounded consent snapshot and immutable activity. Use explicit lifecycle transitions, revision CAS, MongoDB transactions, safe DTOs, and contextual Organization authorization.

## Consequences

One user can participate in Teams, Projects, and Organizations without identity conflicts. Organizations cannot inspect candidate-private Phase 8 state. Historical applications remain stable when profiles change. Phase 9 does not add AI ranking, resume parsing/scoring, scraping, custom pipelines, scheduling, messaging, billing, or seats.
