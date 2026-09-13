# Phase 9 manual browser acceptance

Acceptance result: **PASS — completed September 13, 2026** against the real Vite + Express + MongoDB Atlas staging stack with disposable owner, admin, recruiter, candidate, and outsider accounts. Destructive ownership/archive cases, duplicate submissions, stale revisions, terminal-state invariants, and cross-Organization IDOR were additionally exercised by the green Atlas integration verifier.

## Organization owner flow

- Platform admin grants management to one owner; a second grant is rejected.
- Owner opens the public Organization page and follows **Manage Organization**.
- Overview, Opportunities, Applicants, Members, and Settings tabs are keyboard reachable and correctly named.
- Owner invites an admin and recruiter; duplicate/self invitation is rejected.
- Invitee opens `/organization-invitations`, declines one invitation, accepts another, and reaches the workspace.
- Owner changes a recruiter to admin, removes a recruiter, and transfers ownership.
- Old owner becomes admin; exactly one owner is displayed.

## Recruiter and Opportunity flow

- Recruiter can open the assigned workspace but an outsider receives an access error.
- Recruiter cannot invite members, edit Organization settings, transfer ownership, or access another Organization.
- Recruiter creates a TaskNexus-native draft, edits it, publishes it, closes it, and archives another draft.
- External/admin-curated Opportunity is not editable from the Organization workspace.

## Candidate flow

- Native detail shows only **Apply with TaskNexus**; external detail shows only the external apply action and private tracking.
- Application dialog traps focus, closes with Escape, restores focus, labels every field, and explains shared/excluded data.
- Candidate selects no more than five eligible evidence-backed public Projects and submits a plain-text cover note.
- Duplicate submission is rejected and the native application appears under **TaskNexus Applications**.
- External tracking remains under **External Applications**, including private notes.
- Candidate withdraws an active application; terminal applications cannot reopen.

## Recruiter applicant flow

- Applicant list filters by Opportunity and stage without leaking another Organization.
- Applicant detail shows snapshot name/headline, education, skills, selected Projects/evidence, cover note, stage, and activity.
- Email, phone, private Projects, saved Opportunities, external notes, blocks, and account/security data are absent.
- Allowed stage transition succeeds; stale concurrent action receives a conflict.

## Responsive and accessibility matrix

Run every primary workspace/applicant/application page at:

| Width | Result |
| ---: | --- |
| 320px | PASS |
| 375px | PASS |
| 390px | PASS |
| 430px | PASS |
| 768px | PASS |
| 1024px | PASS |
| 1440px | PASS |

Confirm one meaningful H1, main/nav landmarks, named tabs, visible focus, keyboard stage controls, dialog focus trap/Escape/restoration, text stage labels, no page-level horizontal overflow, no console errors, and no failed API requests.

Runtime result: **PASS**. Thirty-five exact-width page/dialog checks reported no overflow or containment failures. Authenticated console inspection reported no application errors or warnings; deliberate outsider requests returned only expected `FORBIDDEN`/`NOT_FOUND` responses without private data.
