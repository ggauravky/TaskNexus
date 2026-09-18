# Privacy operations

This is an operational product-behavior runbook, not a claim of compliance with
any law or certification. A trained operator and independent reviewer must be
named before launch. The public request address must be verified in the deployed
site; do not publish an unowned placeholder mailbox.

## Data inventory

| Category | Examples | Primary stores / visibility |
| --- | --- | --- |
| Account identity | email, password hash, role, status, last login, refresh-token digest | `users`; backend/admin only |
| Profile/contact | name, phone if supplied, username, bio, avatar, location, links | `users`, `user_profiles`; visibility rules apply |
| Education and skills | education rows, canonical skill assignments | `user_education`, `user_skills`; profile visibility applies |
| Collaboration | Teams, memberships, invitations, join/collaboration requests, blocks | Team/discovery collections; contextual authorization |
| Projects and work | Projects, participants, tasks, comments, attachments, milestones, activity | Project/task collections and private GridFS bucket |
| Contribution/GitHub evidence | contribution records, repository links, provider verification metadata | evidence/repository collections; public-safe projection only |
| Hackathons | participation, Teams, submissions, activity | hackathon collections; event/team authorization |
| Opportunities | saves, external tracking and eligibility state | opportunity/candidate collections; candidate-owned |
| Native applications | cover note, immutable profile/project/evidence snapshot, stage, recruiter notes, activity | native application collections; candidate and organization-scoped views |
| Organization data | memberships, invitations, candidates, recruiting activity | organization collections; organization-scoped authorization |
| Operations | notifications, audit/activity, request/error logs, IP/user-agent in audit events | database and host logs; operator access only |

Never include password hashes, token digests, reset tokens, raw provider secrets,
private recruiter notes belonging to another party, or unrelated users' records
in a subject export.

## Access request

1. Record request ID, received time, requested scope and response deadline in the
   restricted privacy queue. Do not put identity evidence in a public ticket.
2. Verify control of the account using the normal authenticated account plus a
   second agreed proof. Never ask for a password, JWT or refresh cookie.
3. Query records by the canonical user ID, including the categories above.
   Distinguish subject-provided data, shared collaborative history and data that
   belongs to an organization or another candidate.
4. Redact secrets and third-party private fields. Export machine-readable JSON
   in an encrypted archive and deliver through an approved expiring channel.
5. Have a second operator review scope and redaction. Record hashes, delivery
   time and deletion time for the temporary export, not its contents.

This is deliberately a manual launch process; there is no automated export API.

## Correction request

Use normal authenticated profile editing where possible. For fields without a
self-service editor, an operator verifies identity, records before/after field
names without copying sensitive values into the ticket, performs the smallest
update, and records an audit event. Historical application snapshots remain the
snapshot that was submitted; correct the live profile and annotate a recruiting
case only when required rather than silently rewriting evidence.

## Deactivation or deletion request

1. Verify identity and check active organization ownership, open applications,
   financial/dispute records and legal/incident holds.
2. An administrator changes account status to `suspended` or `blocked`. The
   implementation clears the persisted refresh-token digest; access middleware
   and refresh reject inactive accounts.
3. Public profile and People discovery stop returning the account. Public-facing
   collaboration summaries render an inactive/private identity as
   `TaskNexus member` without username, avatar, headline, skills or user ID.
4. Remove personal phone, biography, avatar, external profile URLs and other
   unnecessary identifiers after the retention review. If email must be removed,
   replace it with a unique non-deliverable internal alias while preserving the
   stable user ID and uniqueness constraints. Replace the password hash with a
   random unusable hash and keep status non-active.
5. Preserve Team/Project contribution, application and audit history when needed
   for shared integrity, disputes, security or business records. Retained rows
   keep stable internal attribution but must not recreate a public profile.
6. Close or transfer sole-owned organizations/Teams before removal. Document
   every retained category and its reason. A second operator verifies the result.

There is no automatic cascading account deletion because it would destroy shared
project, contribution, recruiting and audit integrity.

## Native application lifecycle

- Candidate: can see their own application and submitted snapshot.
- Authorized members of the owning organization: can see applications for that
  organization. Cross-organization and cross-candidate access is denied.
- Candidate external-opportunity notes are not visible to organization recruiters.
- Withdrawal preserves the submitted snapshot and activity as a terminal
  historical record; it does not expose recruiter-only notes to the candidate.
- Opportunity closure prevents new applications but does not erase existing
  recruiting records.
- Account deactivation blocks access and removes live public identity. Retained
  application snapshots require an approved retention period; when that period
  expires, remove unnecessary cover-note/profile identifiers while keeping the
  minimum stage/audit facts needed for integrity.

The product does not currently enforce a timed retention job. The privacy owner
must define the production retention schedule before launch and run a monthly
review until automation is deliberately added.

## Privacy incident

1. Treat suspected unauthorized access or disclosure as P0; stop further access,
   preserve logs and do not delete evidence.
2. Rotate exposed credentials, revoke sessions where applicable, and isolate the
   affected service or storage namespace.
3. Determine subjects, fields, time window and access path from sanitized logs and
   audit records. Do not copy raw application snapshots into chat/email.
4. Escalate to the named incident owner and qualified legal/privacy advisor for
   notification obligations. Record decisions and timestamps factually.
5. Remediate, verify denial paths, restore service, and complete a post-incident
   review with actions and owners.

## Launch evidence

Before marking privacy operations `PASS`, record the named operator/reviewer,
verified request address, retention decision and one synthetic access/deactivation
dry run. None of those external ownership/contact items is evidenced yet.
