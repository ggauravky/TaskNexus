# People Discovery

TaskNexus People Discovery is a deterministic, authenticated directory for collaboration. It uses structured profile data and factual public work. It does not use embeddings, an LLM, popularity, or a developer-quality score.

## Eligibility and privacy

A profile appears in `/people` only when all of these are true:

- the account is active;
- profile visibility is `public`;
- `discoverable` is explicitly `true`;
- availability is `open` or `limited`;
- neither the viewer nor profile owner has blocked the other.

`discoverable` defaults to `false`, including for existing public profiles. Changing visibility to private or availability to unavailable turns discovery off. A public individual profile can remain directly viewable while absent from bulk discovery.

`DiscoveryProfileDTO` is assembled independently of `/me`. It can include an ID, username, display name, avatar, headline, public location, availability, commitment, roles, interests, bounded skills, factual public evidence counts, and up to two published Project previews. It excludes email, phone, account role/status, session data, education, private Teams/Projects, internal activity, private evidence, and unpublished showcases.

## Filters

- `search`: escaped, case-insensitive, and limited to 80 characters across display name, username, headline, canonical skill name/alias, role, and interest.
- `skills`: up to eight canonical skill IDs or slugs.
- `skillMode`: `all` by default or explicitly `any`.
- `roles` and `interests`: canonical allowlisted values. Multiple values use ALL semantics.
- `availability`: only `open` and `limited` are accepted.
- `hasPublishedProjects` and `hasExternalEvidence`: factual boolean gates.

Malformed or unknown structured filters fail closed. Search never reads arbitrary query objects into MongoDB.

## Ordering and match context

The candidate set is capped at 250 for the current scale. Results sort predictably by:

1. exact/prefix text relevance when searching;
2. number of requested skills matched;
3. open before limited availability;
4. public profile update time;
5. username as the final stable tie-breaker.

Cards return the exact matched skills, roles, interests, and availability. There is no opaque percentage.

## Evidence summaries

Counts come only from evidence connected to completed public Projects with a published showcase and the user’s Project profile opt-in. Internally verified completed-task facts and externally verified public-safe GitHub facts are counted separately. Drafts, revoked evidence, unpublished/private Projects, and hidden profile Projects do not contribute.

## Abuse and performance

Bulk discovery and opening candidate search have a dedicated browsing rate limit in addition to the global API limit. Candidate scans, page size, skill count, and text length are bounded. Composite indexes cover discoverability/visibility/availability/update time, roles, interests, user-skill lookups, public work, and block relationships.
