# TaskNexus-native applications

Native applications are employer-visible hiring records. They are intentionally separate from Phase 8 external application tracking, which remains candidate-owned and private.

Only a published, open, Organization-owned Opportunity with `application_mode=tasknexus` accepts a native submission. Candidate identity comes from authentication. Each Opportunity/candidate pair is unique.

## Consent snapshot

Before submission, the UI states exactly what is shared. The server builds the snapshot and never trusts client profile data. It includes display name, username, headline, avatar, bounded education and skills, and only selected completed public Projects backed by active `public_safe` contribution evidence. Email, phone, private Teams/Projects/evidence, saved Opportunities, external tracking notes, blocks, sessions, and security metadata are excluded.

The snapshot is historical: later profile edits do not silently change what the Organization reviewed. Cover notes are optional plain text capped at 2,000 characters. At most five Projects and twelve evidence items are shared.

## Lifecycle

```text
submitted -> reviewing | rejected
reviewing -> shortlisted | assessment | interview | rejected
shortlisted -> assessment | interview | offer | rejected
assessment -> interview | offer | rejected
interview -> offer | rejected
offer | rejected | withdrawn -> terminal
active stage -> withdrawn (candidate only)
```

There is no reopening or custom pipeline in Phase 9. Recruiter mutations and candidate withdrawal require the current revision. The transaction creates the updated application, an immutable activity fact, and notifications atomically. Competing stage writes and withdrawal-versus-stage races therefore have one winner.
