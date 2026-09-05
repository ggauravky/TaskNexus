# Contribution evidence and public showcase

Phase 5 records inspectable work facts without turning them into scores. Every evidence record carries a Project, attributed user, source, origin, verification level, lifecycle state, occurrence time, and bounded context.

## Truth model

Verification and lifecycle answer different questions:

- `internal_verified`: TaskNexus created the fact from an authorized internal transition.
- `external_verified`: TaskNexus checked the claimed public GitHub resource and attribution.
- `unverified`: a user supplied a claim that TaskNexus has not independently confirmed.
- `active`: the evidence currently describes the Project history.
- `revoked`: a later transition invalidated the active assertion while preserving its audit history.
- `superseded`: a newer record replaces the presentation of an older record without deleting it.

No evidence type has a weight. API summaries and participant cards show factual counts only and are never used to order, rank, recommend, reward, or penalize people.

## Internal source map

| Source action | Evidence | Attribution | Verification | Lifecycle behavior |
| --- | --- | --- | --- | --- |
| Project created | `project_participation` and initial `project_role` | creator/lead | `internal_verified` | durable |
| Participant added/reactivated | `project_participation` | participant | `internal_verified` | durable |
| Participant role changed | `project_role` | participant | `internal_verified` | a new role event is appended |
| Project Task moved to `done` | `project_task_completion` | every assignee at completion | `internal_verified` | one immutable event per assignee and completion revision |
| Completed Project Task reopened | matching active `project_task_completion` | original assignees | unchanged | changed to `revoked`; never deleted |

Task completion evidence is written in the same MongoDB transaction as the status transition and Project activity. Multi-assignee work creates equal factual records with the generic public label “Completed project work”; it never assigns a primary contributor or apportions credit. A completion snapshot stored on the Project remains bounded for durable attribution.

## User evidence

An active Project participant may attach a GitHub commit, GitHub pull request, or bounded HTTPS external link for themself. The backend ignores claimant IDs from the request and uses the authenticated user. New claims start `unverified`. Only that claimant can request GitHub verification or revoke the record. System-origin evidence cannot be changed through claimant endpoints.

Duplicate source keys are unique within a Project. Concurrent attempts to attach the same commit or pull request therefore produce exactly one record.

## GitHub boundary

The provider supports only exact public `https://github.com` URL forms:

- profile: `https://github.com/{owner}`
- repository: `https://github.com/{owner}/{repository}`
- commit: `https://github.com/{owner}/{repository}/commit/{sha}`
- pull request: `https://github.com/{owner}/{repository}/pull/{number}`

Credentials, ports, fragments, queries, other hosts, ambiguous/nested paths, and private repositories are rejected. The server constructs fixed read-only `api.github.com` URLs from parsed owner/repository/ref components. An optional backend-only `GITHUB_TOKEN` may be used. Response metadata is size-bounded; patch bodies and email addresses never participate in attribution.

A GitHub claim can become `external_verified` only when:

1. its repository is already linked to the Project;
2. the linked repository is public and resolves through the provider;
3. the claimed commit or pull request exists in that repository; and
4. the TaskNexus user's public profile contains a GitHub profile URL matching the provider login returned for the author.

Unavailable providers, missing resources, private resources, mismatched authors, and rate limits produce explicit verification errors and never silently upgrade evidence.

## Authorization

Active Team membership is the root authorization boundary for every private contribution operation. Project participation can narrow access but cannot restore access after Team membership ends. Project/Team management permissions control repository links and showcase publication. A global account administrator has no implicit Team or Project override.

## Showcase publication

`project_showcases` is a separate, one-per-Project revisioned publication record. Draft editing and publish/unpublish are explicit actions. Publishing requires:

- an active public Team;
- a public Project in `completed` state;
- a current revision;
- complete headline, summary, problem, solution, and outcome copy; and
- at most 12 active featured evidence records from that Project.

Publish/unpublish uses compare-and-set revisions, so concurrent publication attempts cannot both win. A successful publish writes Project activity and durable participant notifications in the same transaction.

## Public data intersection

The public endpoint is not a redacted internal Project response. It constructs a dedicated DTO from the intersection of:

```text
public active Team
∩ public completed Project
∩ published showcase
∩ active selected evidence
∩ public participant profiles
```

Allowed output is limited to safe Team/Project presentation, showcase narrative/media, generic internal evidence labels, selected GitHub evidence source URLs, public participant summaries with factual counts, verified repository links, and SEO metadata.

It excludes internal task titles and descriptions, Project activity, source keys, raw metadata, drafts, revoked/superseded evidence, private profiles, credentials, email addresses, and arbitrary internal identifiers. Participants are rendered alphabetically rather than by evidence count.

## Profile opt-in

`ProjectParticipant.show_on_profile` defaults to false. A user may opt their own active participation in or out. A Project card appears on that user's public profile only when the profile is public, the opt-in is true, the user has active evidence, and the Team/Project/showcase all satisfy the public publication intersection. Removing any one condition removes the card from the public response.
