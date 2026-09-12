# ADR 0009: Deterministic Career Eligibility Before AI Job Matching

## Status

Accepted for Phase 8.

## Context

Early-career candidates need to understand why a role appears compatible. An opaque AI rank, resume score, or application probability would make incomplete profile data look authoritative, complicate privacy review, and obscure employer-published constraints.

## Decision

TaskNexus first models explicit employer eligibility rules and compares them with structured, candidate-owned education, location, and skill facts. Every check returns a named result and reason. Missing facts produce `unknown`; skill/location differences produce a reviewable `gap`; only explicit formal mismatches produce `not_eligible`. The product does not calculate a score or order discovery by inferred suitability.

## Consequences

The result is auditable, testable, cache-friendly, and conservative. Candidates can correct the underlying profile fact and understand the change. The model has limited semantic flexibility: degree and field matching are normalized exact comparisons, CGPA is unknown, and experience is never inferred from Projects or GitHub.

Future AI assistance may summarize or explain evidence only after Organization ownership, consent, evaluation, bias testing, and candidate controls exist. It must not silently replace these deterministic facts or employer authority.
