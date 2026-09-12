# Hackathon collaboration mode

Phase 7 adds participant collaboration around an administrator-curated Hackathon catalog. It connects existing TaskNexus profiles, deterministic People Discovery, collaboration requests, Teams, Team Openings, Projects, Project Tasks, contribution evidence, repositories, and showcases. It does not create organizer, judging, scoring, prize, payment, attendance, or AI systems.

## Lifecycle

Hackathon status is stored as `upcoming`, `registration_open`, `active`, `submission_closed`, `completed`, or `archived`. Platform admins create, update, and archive catalog records. Dates are stored as UTC `Date` values and displayed with an explicit user timezone. Status supports editorial/catalog behavior; server-side date checks independently enforce registration and submission cutoffs.

Public list/detail routes expose only public, non-archived catalog data. Search and filters are allowlisted and bounded. Private events remain available only to platform administrators.

## Participation and privacy

An authenticated user creates one `HackathonParticipant` per event. They can select `interested` or `participating`, preferred roles/skills, commitment, a bounded message, `looking_for_team`, and `visible_on_hackathon`.

Looking-for-Team discovery requires all of the following:

- active, non-withdrawn event participation;
- `looking_for_team=true` and `visible_on_hackathon=true`;
- a public, discoverable Profile with open or limited availability;
- no applicable block relationship;
- satisfaction of the existing Phase 6 deterministic filters.

The result uses the privacy-safe Person DTO and adds only bounded event context. Private profiles and non-opted-in participants never enter the result set. Withdrawing participation disables Looking for Team but does not erase history.

## Team registration

`HackathonTeam` relates one existing Team to one Hackathon. It is not a membership roster. Only an active Team owner/admin can register or withdraw the Team. Registration validates the stored event state, the server UTC registration deadline, and the current count of active `TeamMembership` records against optional minimum/maximum sizes.

Member changes after registration do not copy or rewrite a Hackathon roster. Reads recompute eligibility and persist a warning so the workspace can show drift before submission. A partial or duplicate registration is prevented by a unique `(hackathon_id, team_id)` index and transactional creation.

## Teammate discovery, openings, and requests

The Find Teammates panel calls the Phase 6 discovery service with an allowlist of eligible event participant IDs. Person-to-person interest uses the existing `CollaborationRequest` state machine with validated `hackathon_id` context. Acceptance still records professional intent only; it never grants Team or Project access.

An owner/admin can publish a normal `TeamOpening` with `hackathon_id` and `hackathon_team_id`. The service confirms that the opening belongs to the registered Team and that the actor has Team authority. Generic Team Openings continue to work unchanged.

## Project linking

An owner/admin links one existing Project owned by the registered Team. The API rejects cross-Team Project IDs and uses the `HackathonTeam.revision` value as a compare-and-set fence. Linking/unlinking runs in a transaction with submission/activity changes. A submitted entry cannot be unlinked.

The linked Project remains the canonical workspace for participants, tasks, milestones, repository links, evidence, and showcase publication. No `HackathonProject` or `HackathonTask` exists.

## Submission

After a Project is linked, the Team receives one `HackathonSubmission`. Draft fields are bounded HTTPS URLs plus a requirement checklist. Readiness is deterministic and recomputed from catalog requirements, Project title/description, required links, Team-size eligibility, and explicit confirmations. See [Hackathon submissions](HACKATHON_SUBMISSIONS.md).

Only Team owners/admins may save or final-submit. Every write requires the current revision. Final submission requires an explicit confirmation, is deadline-checked in the transaction, and is immutable.

## Transactions and deadlines

Transactions cover participation plus activity, Team registration plus activity/notification, Team withdrawal, Project link/unlink, draft save plus activity, and final submission plus activity/member notifications. Transaction-dependent writes are sequential within the session.

Registration and submission services compare `new Date()` against stored UTC deadlines immediately before the guarded write. Browser clocks, URL parameters, and lifecycle labels cannot bypass the cutoff. Atlas unique indexes and revision predicates resolve duplicate joins/registrations, Project-link races, update-versus-submit races, and double-submit races with one durable winner.

## Scope exclusions

Phase 7 deliberately excludes organizer onboarding, organization accounts, judges/juries, evaluation sheets, leaderboards, certificates, prizes, sponsors, payments, event check-in, jobs, internships, recruiting/ATS, chat, and AI matching or scoring.
