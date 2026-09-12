# TaskNexus V2 UI unification audit

This matrix was completed before implementation. `/teams` is the visual source of truth: dark neutral surfaces, compact density, hairline borders, restrained indigo accents, 8px controls, 12px cards, and a centered `max-w-7xl` workspace axis.

| Route | Audience | Previous shell | Content width | Migration decision |
| --- | --- | --- | --- | --- |
| `/` | Public | Dark marketing navigation | `max-w-7xl` | Keep structure; align tokens, navigation, and current product copy |
| `/login` | Public | Light decorative auth shell | `max-w-6xl` | Convert to dark product auth surface |
| `/register` | Public | Light decorative auth shell | `max-w-6xl` | Convert to dark product auth surface |
| `/admin/login` | Admin | Light decorative auth shell | `max-w-6xl` | Convert to dark restricted-access surface |
| `/services` | Public | Light public site shell | `max-w-7xl` | Convert shared public shell and cards |
| `/blog` | Public | Light public site shell | `max-w-7xl` | Convert shared public shell and article cards |
| `/support-jar` | Public | Light public site shell | `max-w-7xl` | Convert shared public shell and contribution panels |
| `/u/:username` | Public | Dark profile shell | Narrow content | Keep semantic width; inherit canonical tokens |
| `/teams/:slug` | Public/auth | Teams shell | `max-w-7xl` | Use canonical application shell |
| `/teams/:teamSlug/projects/:projectSlug` | Public/auth | Teams shell | `max-w-7xl` | Use canonical application shell |
| `/showcase/:teamSlug/:projectSlug` | Public | Dark showcase shell | Project-specific | Keep showcase hierarchy; align tokens |
| `/hackathons` | Public/auth | Teams shell | `max-w-7xl` | Use canonical application shell |
| `/hackathons/:slug` | Public/auth | Teams shell | `max-w-7xl` | Use canonical application shell |
| `/opportunities` | Public/auth | Teams shell | `max-w-7xl` | Use canonical application shell |
| `/opportunities/:slug` | Public/auth | Teams shell | `max-w-6xl` | Keep reading width; use canonical shell |
| `/organizations/:slug` | Public/auth | Teams shell | `max-w-7xl` | Use canonical application shell |
| `/client/dashboard` | Client | Independent light dashboard/nav | `max-w-7xl` | Remove duplicate nav; dark compatibility migration |
| `/client/profile` | Client | Redirect | N/A | Preserve redirect to `/profile` |
| `/freelancer/dashboard` | Freelancer | Independent light dashboard/nav | `max-w-7xl` | Remove duplicate nav; dark compatibility migration |
| `/freelancer/profile` | Freelancer | Redirect | N/A | Preserve redirect to `/profile` |
| `/profile` | Authenticated | Independent dark profile nav | `max-w-7xl` | Remove duplicate nav; keep save/public actions as toolbar |
| `/profile/onboarding` | Client/freelancer | Independent dark setup nav | `max-w-5xl` | Keep focused stepper width; inherit canonical shell |
| `/teams` | Authenticated | Teams source shell | `max-w-7xl` | Source of truth; adopt shared page primitives |
| `/teams/:slug/settings` | Authenticated | Teams shell | `max-w-4xl` | Keep form width; use canonical shell |
| `/projects` | Authenticated | Teams shell | `max-w-7xl` | Use canonical shell |
| `/contributions` | Authenticated | Teams shell | `max-w-7xl` | Use canonical shell |
| `/people` | Authenticated | Teams shell | `max-w-7xl` | Use canonical shell |
| `/collaboration` | Authenticated | Teams shell | `max-w-5xl` | Keep reading width; use canonical shell |
| `/applications` | Authenticated | Teams shell | `max-w-7xl` | Use canonical shell |
| `/teams/:teamSlug/projects/:projectSlug/settings` | Authenticated | Teams shell | `max-w-4xl` | Keep form width; use canonical shell |
| `/teams/:teamSlug/projects/:projectSlug/showcase` | Authenticated | Teams shell | `max-w-5xl` | Keep editor width; use canonical shell |
| `/admin/dashboard` | Admin | Independent light admin nav | `max-w-7xl` | Remove duplicate nav; dark compatibility migration |
| `/admin/tasks` | Admin | Independent light admin header | `max-w-7xl` | Keep page actions; inherit canonical shell |
| `/admin/users` | Admin | Independent light admin header | `max-w-7xl` | Keep page actions; inherit canonical shell |
| `/admin/analytics` | Admin | Independent light admin header | `max-w-7xl` | Keep page actions; inherit canonical shell |
| `*` | Public | Light decorative error page | Narrow content | Convert to dark public error surface |

## Duplicate layout findings

- `TeamShell` is repeated across the Phase 3-8 pages while `ProtectedRoute` already owns an authenticated wrapper.
- Client, freelancer, admin, profile, and onboarding pages each ship an additional local header or navigation.
- Login, registration, and admin login share a reusable auth class system but that system uses the superseded light/gradient direction.
- Services, blog, and support share `PublicSiteLayout`, which uses the superseded light direction.
- Legacy dashboards use compatible class patterns, so a scoped dark compatibility layer can preserve complex interaction logic while their duplicate navigation is reduced to page-specific actions.

## Implementation constraints

- No route, role guard, API call, permissions check, form handler, modal flow, or data contract changes.
- No Phase 9 features.
- No fabricated metrics; dashboard values remain API-derived or task-derived.
- Responsive shell checkpoints: 320, 375, 390, 430, 768, 1024, and 1440+ pixels.
