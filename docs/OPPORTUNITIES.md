# Opportunity platform foundation

Phase 8 adds a controlled catalog for internships and entry-level jobs. It does not add recruiter accounts, employer application handling, automated ingestion, resume tooling, or AI matching.

## Organization model

`organizations` represents a public catalog identity and is intentionally separate from collaborative `teams`. It stores a unique slug, type, public description, safe HTTPS links, structured locations, verification state, lifecycle state, creator, and revision. Verification is an administrator assertion about the catalog record; it is not an endorsement.

## Opportunity lifecycle and provenance

`opportunities` uses `draft → published → closed → archived`, with direct archive also allowed for a draft or published record. Publication, close, archive, and edits use compare-and-set revisions. Only published, unexpired, pre-deadline records appear in discovery. Candidate history can retain a closed record; archived records are removed from candidate surfaces.

Every record stores a source type (`official`, `admin_curated`, or `external`), optional safe HTTPS source URL, source publication time, last verification time, and TaskNexus publication time. Source facts remain visible in detail DTOs.

## Discovery

`GET /api/opportunities` provides bounded pagination, escaped search, and explicit filters for type, skill IDs, work mode, location, Organization, graduation-year compatibility, freshers, and compensation disclosure. Sorting is labeled `Newest`, `Deadline soon`, or `Recently verified`; no match score exists. Organization, skill, candidate profile, education, and state reads are batched per page.

## Application modes

Every Opportunity has an explicit `application_mode`:

- `external` keeps the Phase 8 boundary: TaskNexus opens a safe HTTPS Organization URL and the candidate privately tracks their own progress.
- `tasknexus` is limited to published, open, `organization_owned` Opportunities and creates a distinct employer-visible native application.

Organization members can manage only their own Organization-owned records through contextual owner, admin, or recruiter authority. Platform-admin catalog records never become recruiter-editable implicitly.

## Save and external application tracking

`opportunity_candidate_states` combines the candidate’s one relationship to an Opportunity: saved flag, self-reported application stage, application time, private notes, external apply URL snapshot, provenance, and revision. A unique `(user_id, opportunity_id)` index prevents duplicates. Identity always comes from the access token.

For external-mode Opportunities, TaskNexus opens the Organization’s HTTPS application URL and lets the candidate record `interested`, `applied`, `assessment`, `interview`, `offer`, `rejected`, or `withdrawn`. These stages are candidate-reported, never employer-confirmed. Existing history survives catalog close and remains editable; a closed role refuses new saves or application records.

## TaskNexus-native applications

Native applications live in `native_applications`; they do not reuse `opportunity_candidate_states`. Submission requires explicit consent and stores a bounded snapshot of the candidate data shared at that moment, with up to five eligible public evidence-backed Projects and public-safe evidence. Email, phone, private Projects, saved Opportunities, external notes, blocks, and security data are excluded.

The employer-managed stages are `submitted`, `reviewing`, `shortlisted`, `assessment`, `interview`, `offer`, `rejected`, and `withdrawn`. Canonical transition rules and compare-and-set revisions reject stale or invalid stage mutations. Candidates can withdraw an active application; terminal applications do not reopen in Phase 9.

## Privacy and administration

Anonymous users see public catalog DTOs only. Authenticated candidates see only their own eligibility and state. No endpoint accepts a candidate user ID, and no Organization endpoint exposes saves, applications, notes, or eligibility. Administrator-only endpoints create/update/verify Organizations and create/update/publish/close/archive Opportunities. Inputs are allowlisted and DTOs never expose raw documents.
