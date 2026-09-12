# ADR 0007: Deterministic discovery before AI matching

- Status: accepted
- Date: 2026-09-06

## Context

TaskNexus has structured profiles, canonical skills and roles, Team/Project relationships, contribution evidence, and published showcases. It needs teammate discovery, but an embedding or LLM ranking would introduce opaque behavior before privacy, eligibility, and outcome data are proven trustworthy. A synthetic compatibility percentage could be mistaken for a quality or hiring judgment.

## Decision

Phase 6 uses authenticated, opt-in MongoDB discovery with explicit allowlisted filters. Multi-skill semantics are visible, ordering factors are deterministic, and each result can state the exact skills/roles/interests it matched. Public-work context is expressed as factual counts and published Project previews. Team openings reuse the same vocabulary, and opening interest reuses collaboration requests.

No embeddings, vector database, LLM recommendation, inferred skill, personality matching, talent score, popularity rank, or AI-written explanation is introduced.

## Consequences

Users can understand and reproduce search results, audit their profile inputs, and control whether they are discoverable/contactable. Privacy and anti-spam boundaries can be tested independently of model behavior. MongoDB indexes and a bounded candidate set are sufficient at current scale.

The current in-process tie-breaking step is deliberately bounded and may need a database-native search pipeline or cursor pagination at larger scale. A later AI layer may rerank only after consent, evaluation data, explanations, and bias/safety criteria exist; it must not replace eligibility and privacy gates.
