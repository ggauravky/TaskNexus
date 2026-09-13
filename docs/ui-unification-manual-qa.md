# TaskNexus V2 UI unification manual QA

## Acceptance result

- Human manual browser QA: **PASS**
- UI unification rendered-browser QA: **PASS**
- Browser console: **PASS**
- Browser Network inspection: **PASS**
- No page-level horizontal overflow: **PASS**
- Visual consistency with `/teams`: **PASS**
- Tester: user
- Recorded: 2026-09-13

The user completed the rendered-browser acceptance pass. The detailed checklist below records the accepted scope and remains reusable for future regressions. This result is manual, not an automated browser claim.

## Viewport matrix

Repeat the route-family checks at each width. Test both portrait and landscape where the device supports it.

- [ ] 320px
- [ ] 375px
- [ ] 390px
- [ ] 430px
- [ ] 768px
- [ ] 1024px
- [ ] 1440px or wider

At every width confirm:

- [ ] No horizontal page overflow, clipped text, overlapping controls, or hidden primary actions.
- [ ] Page gutters, header axis, section axis, cards, and form controls remain aligned.
- [ ] Text stays readable at browser zoom levels from 80% through 200%.
- [ ] Focus rings are visible and content is usable with keyboard-only navigation.
- [ ] Reduced-motion preference does not hide content or block interaction.

## Shared shell and navigation

- [ ] Authenticated pages display one TaskNexus shell and no duplicated page-level navigation.
- [ ] Public pages display the coherent public header and footer.
- [ ] Desktop primary navigation exposes Workspace, Teams, Projects, People, Hackathons, and Opportunities.
- [ ] Desktop secondary navigation exposes Contributions, Requests, and Applications; admin accounts also receive Tasks, Users, and Analytics.
- [ ] The mobile menu opens, traps keyboard focus, closes with Escape, closes after route changes, and restores a usable focus position.
- [ ] Active navigation state is visually distinct and is not communicated by color alone.
- [ ] Profile and sign-out actions work for authenticated users; sign-in and create-account actions work for visitors.

## Public and authentication routes

Visit each route directly and through navigation where a link exists.

- [ ] `/`
- [ ] `/login`
- [ ] `/register`
- [ ] `/admin/login`
- [ ] `/services`
- [ ] `/blog`
- [ ] `/support-jar`
- [ ] `/u/:username`
- [ ] A nonexistent path for the 404 state

Confirm dark neutral surfaces, restrained indigo accents, no decorative gradients or glow, consistent 8px controls and 12px cards, correct validation feedback, readable error states, and no stale copy claiming shipped V2 functionality is unavailable.

## Marketplace and public product routes

- [ ] `/teams/:slug`
- [ ] `/teams/:teamSlug/projects/:projectSlug`
- [ ] `/showcase/:teamSlug/:projectSlug`
- [ ] `/hackathons`
- [ ] `/hackathons/:slug`
- [ ] `/opportunities`
- [ ] `/opportunities/:slug`
- [ ] `/organizations/:slug`

Confirm loading, empty, populated, forbidden, closed, and not-found states where they can be reached. Exercise search, filters, pagination, save/apply/participation actions, links, and dialogs without changing authorization expectations.

## Authenticated member routes

Run these checks with client and freelancer accounts as applicable.

- [ ] `/client/dashboard`
- [ ] `/freelancer/dashboard`
- [ ] `/profile`
- [ ] `/profile/onboarding`
- [ ] `/teams`
- [ ] `/teams/:slug/settings`
- [ ] `/projects`
- [ ] `/contributions`
- [ ] `/people`
- [ ] `/collaboration`
- [ ] `/applications`
- [ ] `/teams/:teamSlug/projects/:projectSlug/settings`
- [ ] `/teams/:teamSlug/projects/:projectSlug/showcase`

Confirm the route guards and role boundaries are unchanged. Exercise dashboard refresh and availability controls, profile save/public view, onboarding steps, team and project create/edit flows, contribution evidence, people search, collaboration decisions, applications, settings, showcase editing, tabs, filters, tables, pagination, toasts, dialogs, and destructive-action confirmations.

Confirm `/client/profile` and `/freelancer/profile` still redirect to `/profile`.

## Administrator routes

- [ ] `/admin/dashboard`
- [ ] `/admin/tasks`
- [ ] `/admin/users`
- [ ] `/admin/analytics`

Confirm the admin shell is not duplicated, all controls stay within their existing permissions, tables remain usable on narrow screens, data remains API-derived, and refresh/actions/dialogs produce clear feedback.

## Visual consistency review

Compare the migrated pages directly with `/teams`.

- [ ] Freelancer dashboard
- [ ] Client dashboard
- [ ] Admin dashboard
- [ ] Projects
- [ ] People
- [ ] Contributions and requests
- [ ] Hackathons
- [ ] Opportunities and applications
- [ ] Profiles

Confirm the same background and surface hierarchy, hairline borders, typography rhythm, content axis, control height, radii, button language, card density, empty states, dialog treatment, and restrained accent usage. Record any page-specific exception and why its content requires it.

## Browser console and network

For one complete happy-path flow in every route family:

- [ ] Clear the browser console, reload, and confirm no uncaught exceptions, React warnings, hydration warnings, failed dynamic imports, or accessibility errors introduced by the migration.
- [ ] Keep the Network panel open and confirm no unexpected 4xx/5xx responses, blocked requests, CORS errors, request loops, or duplicate mutation requests.
- [ ] Confirm authenticated requests include the expected session behavior and unauthorized routes still reject access.
- [ ] Confirm the local backend root `/health` responds with HTTP 200 and `{\"status\":\"ok\"}`.
- [ ] Test slow network and offline transitions for usable loading/error/retry feedback.

## Acceptance record

Record browser name/version, operating system, tester, date, role/account type, viewport, route, result, console result, network result, and a screenshot or short reproduction for every failure. A browser-visible item is not accepted until its checkbox is completed on the actual rendered application.
