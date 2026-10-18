# install-core-home-domain (t707, round 3)

## Outcome

Done.

## What changed and why

The cause, confirmed from the code: Studio clients read the domain only from the page URL's `?domainId=` (`features/programs/program-api.ts:127`, `lib/program-route.ts:12`). The create-project handler stamps `request.scope.domainId ?? null`. Home's launcher links the global catalog route `/programs/automation-studio` with no `domainId`. The Studio page (`app/programs/automation-studio/page.tsx`) only checked a requested domain and otherwise rendered a global Studio, so creating a project from there produced `domainId: null`. The domain-scoped route `/domains/[domainId]/programs/[programId]` just redirects to the same Studio page with `?domainId=`.

So every Studio entry goes through that one page, and the fix lives there and nowhere else. Home, the launcher and the handler are unchanged.

- `apps/web/src/app/programs/automation-studio/page.tsx`: resolves the domain with `resolveSetupDomain` (imported where it is, from `app/get-started/resolve-setup-domain.ts`; I did not move or edit it), using `fluxiq.activeDomainId` and `fluxiq.domains.summaries()`:
  - a requested installed domain is kept;
  - otherwise the active domain, then the only installed domain, is carried by a redirect that keeps every other query parameter (project, flow, view);
  - if several domains are installed and none is active, the page renders a choice;
  - if no domain is installed, Studio stays global.
  - A requested domain that is not installed is replaced the same way.
- `apps/web/src/app/programs/automation-studio/StudioDomainChoice.tsx` (new): the choice page. Each installed domain links to Studio in that domain and keeps the rest of the link. It uses existing class names only; no CSS was added.
- `apps/web/src/app/programs/automation-studio/studio-href.ts` (new): builds the Studio link. It puts `domainId` first and keeps the other parameters, repeated ones included. The redirect and the choice links share it.
- Tests: `tests/page.test.tsx` (mock extended with `activeDomainId` and `domains.summaries`; 5 new cases), plus new `tests/StudioDomainChoice.test.tsx` and `tests/studio-href.test.ts`.

## Commands run and observed results

Run from the Core root `C:/Users/osrs_/FluxStuff/fxwork/t707/!FluxIQ`:

- Before the fix: `pnpm.cmd --filter @fluxiq/web exec vitest run src/app/programs/automation-studio/tests`. The first run failed to load the missing `../StudioDomainChoice`. With the component added and the page not yet changed, the result was `Tests 4 failed | 5 passed (9)`. The failures were:
  - only-domain carry: "promise resolved instead of rejecting";
  - active-domain carry: the same;
  - uninstalled-domain replacement: the same;
  - choose: "expected ProgramWorkspace to be StudioDomainChoice".
- After the fix, the same command printed `Tests 10 passed (10)` across the 3 files.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (397 warning(s), 1154 baselined).` None of the warnings is in `app/programs/automation-studio`.

## Not verified

- No browser, server or typecheck was run (the brief does not allow them). The redirect has not been checked live with a real installed domain and paired extension.
- I did not run the tests for Home, the launcher or the domain-scoped route because those files are unchanged.
- `packages/fluxiq` is unchanged, so no fluxiq build was needed.

## Open questions or contradictions found

- The Studio page now imports `app/get-started/resolve-setup-domain.ts` and its `SetupDomain` type across routes. The rules are shared, so the lead should move the resolver, under a neutral name such as `resolveWorkspaceDomain`, to a shared place like `apps/web/src/lib/`. Then both `get-started/page.tsx` and `programs/automation-studio/page.tsx` can import it from there. I was not allowed to edit `get-started/**`.
- The server handler still accepts a domain-less create when a domain is installed. Callers outside the web UI, such as direct API calls, are not covered by this fix. Rejecting them on the server would need the handler to know which domains are installed, which it does not today.
- The working tree also has changes I did not make, from another worker: `apps/web/src/app/get-started/tests/page.test.tsx` (modified) and `apps/web/src/app/get-started/tests/layout.test.ts` (untracked).
