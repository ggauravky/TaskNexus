# ADR 0008: Hackathons Reuse Teams, Projects and Discovery Instead of Creating Parallel Collaboration Domains

- Status: accepted
- Date: 2026-09-07

## Context

TaskNexus already has contextual Team membership/RBAC, Team Openings, deterministic privacy-safe People Discovery, person-to-person collaboration requests, Team-owned Projects, Project participants/tasks/milestones, contribution evidence, repositories, and public showcases. Hackathon collaboration needs event discovery, participation, Team registration, a primary Project, and a final entry. Recreating Hackathon-specific membership, Project, Task, or discovery systems would duplicate authority and state machines and allow the copies to drift.

## Decision

Hackathon mode is a thin orchestration layer:

- `Hackathon` stores the curated event catalog, lifecycle, dates, constraints, and requirements.
- `HackathonParticipant` stores event opt-in and visibility.
- `HackathonTeam` relates an existing Team and optional existing Project to an event.
- `HackathonSubmission` stores only the event entry and deterministic readiness snapshot.
- `HackathonActivity` records meaningful event transitions.

Team membership and permissions continue to come only from active `TeamMembership` records. Work happens only in existing Projects and Project Tasks. Teammate search calls the existing People Discovery service after intersecting event opt-in. Recruiting intent and missing-role advertisements reuse Collaboration Requests and Team Openings with validated optional Hackathon context.

## Consequences

The product has one source of truth for membership, authorization, Project work, evidence, and privacy. Existing improvements to discovery, blocking, Team RBAC, Project IDOR protection, evidence, and showcases automatically benefit Hackathon users. The event layer remains small enough to verify with explicit transactions, unique indexes, deadlines, and revisions.

The tradeoff is that Hackathon-specific rosters cannot diverge from current Team membership, and organizers cannot judge or score entries inside TaskNexus. Eligibility can change after registration, so reads and submission recompute active-member counts and expose warnings. Organizer/judge infrastructure would require a separate future decision rather than being smuggled into participant collaboration.
