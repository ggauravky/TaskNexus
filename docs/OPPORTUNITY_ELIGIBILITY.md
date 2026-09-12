# Deterministic Opportunity eligibility

Eligibility is a transparent comparison between employer-published rules and the signed-in candidate’s structured TaskNexus profile. It is guidance, not an acceptance decision. The employer always has final authority.

## Evaluated facts

- Degree name against the explicit accepted-degree list.
- Field of study against the explicit accepted-field list.
- Graduation year against the published minimum/maximum.
- Published fresher and professional-experience requirements.
- Minimum CGPA when published, noting that TaskNexus currently has no CGPA profile field.
- Candidate profile location against allowed countries or structured Opportunity locations.
- Required and preferred skill IDs against canonical profile skill IDs.

The service loads profile, education, and skills once per candidate page and evaluates every returned Opportunity in memory. It does not perform one database request per card.

## Result semantics

- `eligible`: all available formal rules pass and there are no recorded gaps.
- `possibly_eligible`: formal rules pass, but a location or skill gap needs review.
- `not_eligible`: a known structured fact fails an explicit formal degree, field, or graduation rule.
- `unknown`: a required formal comparison cannot be made from structured profile data.

Individual checks use `pass`, `gap`, `fail`, or `unknown` and include a plain-language reason. Missing skills are gaps, not automatic formal disqualification. No percentage, score, probability, opaque rank, or “best match” label is computed.

## Deliberate non-inferences

TaskNexus does not infer professional experience from Projects, GitHub activity, contributions, free text, or profile age. It does not parse resumes, predict employer decisions, or interpret work authorization. Published work-authorization text is shown as employer context only. A CGPA rule remains unknown until TaskNexus has an explicit structured candidate fact.

## Candidate privacy

Eligibility is calculated only in an authenticated candidate context and is never included in anonymous DTOs. One candidate cannot supply or retrieve another user ID. Organizations and administrators receive catalog DTOs, not candidate eligibility, saved state, stages, or notes.

The UI disclaimer is: “Eligibility is based on structured information available in the Opportunity and your TaskNexus profile. Final eligibility is determined by the employer.”
