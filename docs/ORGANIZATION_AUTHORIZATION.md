# Organization authorization

Organization authority is contextual. TaskNexus does not define a global recruiter role, does not reuse Team membership, and does not infer authority from an email domain. A platform administrator must explicitly grant initial management to one active user.

| Action | Owner | Admin | Recruiter | Non-member |
| --- | ---: | ---: | ---: | ---: |
| View workspace | Yes | Yes | Yes | No |
| Edit Organization | Yes | Yes | No | No |
| Invite recruiter | Yes | Yes | No | No |
| Invite admin | Yes | No | No | No |
| Remove recruiter | Yes | Yes | No | No |
| Change admin/recruiter role | Yes | No | No | No |
| Create/edit Organization-owned Opportunity | Yes | Yes | Yes | No |
| Publish/close/archive Organization-owned Opportunity | Yes | Yes | Yes | No |
| View native applicants | Yes | Yes | Yes | No |
| Change application stage | Yes | Yes | Yes | No |
| Transfer ownership | Yes | No | No | No |
| Archive Organization management | Yes | No | No | No |

Recruiters may edit any Organization-owned Opportunity in their Organization during Phase 9. They cannot edit external/admin-curated listings, manage members, promote themselves, transfer ownership, or access another Organization.

Exactly one active owner is preserved through a partial unique MongoDB index, the Organization `owner_id`, and transactional ownership transfer. The old owner becomes an admin. Archiving management returns the catalog record to `platform_managed`, removes active contextual memberships, and cancels pending invitations without deleting public catalog or application history.

Organization authority changes use the existing `audit_logs` collection; no fifth Phase 9 activity collection is needed.
