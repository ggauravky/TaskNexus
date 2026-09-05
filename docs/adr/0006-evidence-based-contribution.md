# ADR 0006: Evidence-based contribution, not contribution scoring

- Status: accepted
- Date: 2026-09-06

## Context

TaskNexus needs durable attribution for Team Project work and a credible public portfolio surface. A numerical contribution score would hide assumptions, reward easy-to-count activity, invite competition between collaborators, and make corrections difficult. Internal Project data also cannot be safely exposed by reusing workspace serializers.

## Decision

Store contribution evidence as append-oriented records with explicit provenance, timestamps, verification, and lifecycle state. Internal authorized actions create `internal_verified` facts transactionally. User claims begin `unverified`; narrowly scoped GitHub checks may promote eligible claims to `external_verified`. Reopen and correction workflows revoke or supersede records instead of deleting history.

Keep repository links and showcases in independent Project collections. Use exact GitHub URL parsing and fixed read-only provider requests. Publish through a separate revisioned action and construct a dedicated public DTO from the strict public Team/Project/showcase/evidence/profile intersection. Public profile integration remains an explicit participant opt-in.

Do not calculate a contribution score, rank participants, infer identity from email, or order people by evidence counts.

## Consequences

- A contribution assertion can be inspected and corrected without losing its history.
- Multi-assignee completion gives each assignee an equal factual record.
- Provider outages or rate limits affect verification only; they do not destroy claims.
- Public privacy is enforced by construction rather than by opportunistic field deletion.
- Queries require dedicated compound indexes and public serializers.
- Future providers must implement the same parsing, attribution, metadata-bounding, and lifecycle guarantees.
