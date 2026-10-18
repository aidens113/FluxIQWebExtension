# install-core-gs-style (t707, round 3) — worker report

## Outcome

Done. `/get-started` now has its own route stylesheet, loaded the same way the Studio route loads its stylesheet. The page is framed like Home: topbar showing the signed-in user, directory container, heading. `SetupDomainChoice` uses the same frame.

## Cause (confirmed from code)

1. The onboarding classes (`automation-onboarding`, `-steps`, `-step`, `-state`, `-action`, `-message`, `-start`) had **no CSS anywhere** in `apps/web/src`. No stylesheet, on any route, defined them.
2. The only two styled classes the view used were Studio-only:
   - `automation-runs-workspace`, from `features/automation-studio/styles/runtime/03-runs-workspace.css`;
   - `automation-runtime-message`, from `runtime/02-detail.css`.

   Both files are imported only by `app/programs/automation-studio/automation-studio.css`, and that file is loaded only by `app/programs/automation-studio/layout.tsx`.
3. `app/get-started/page.tsx` returned the client view bare: no `directory-page`, no `GlobalTopbar`, no `directory-container`.

The existing contract in `features/automation-studio/styles/tests/styles-architecture.test.ts` sets three rules:
- No app-level stylesheet may contain `.automation-` selectors.
- No app-level stylesheet other than the Studio manifest may import Studio feature styles.
- Every Studio feature stylesheet must be imported by the Studio manifest.

So pulling Studio CSS into `/get-started` was ruled out. So was adding Studio-prefixed rules there. I verified this: my first version used `.automation-onboarding*` rules in the route CSS, and that architecture test failed with "keeps Automation Studio selectors out of every app-level stylesheet".

## What changed and why (Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t707/!FluxIQ`)

- `apps/web/src/app/get-started/layout.tsx` (new): imports `./get-started.css`. This is the route-CSS mechanism the Studio route uses.
- `apps/web/src/app/get-started/get-started.css` (new): import-only manifest, `@import "./styles/01-onboarding.css";`.
- `apps/web/src/app/get-started/styles/01-onboarding.css` (new): rules for the onboarding checklist and the setup-page body and domain list. These are new rules for markup that was never styled, not copies. They use global tokens.
- `apps/web/src/app/get-started/GetStartedFrame.tsx` (new): the shared frame, `main.directory-page` > `GlobalTopbar user` > `.directory-container` > `header.directory-heading` (kicker "Get started", `h1.page-title`, copy) > `.get-started-body`.
- `apps/web/src/app/get-started/page.tsx`: keeps `auth`. The onboarding is `<GetStartedFrame title="Set up FluxIQ" ...><Suspense><GetStartedClient/></Suspense></GetStartedFrame>`. The choose path passes `user` to `SetupDomainChoice`.
- `apps/web/src/app/get-started/SetupDomainChoice.tsx`: now renders inside `GetStartedFrame` (takes `user`).
- `apps/web/src/features/automation-studio/onboarding/OnboardingView.tsx`:
  - Classes renamed from `automation-onboarding*` to `onboarding*`, so they are no longer Studio selectors.
  - Dropped `automation-runs-workspace`.
  - The step problem uses the global `inline-notice error` (plus `onboarding-problem`) instead of the Studio-only `automation-runtime-message`.
  - The header is now `onboarding-header` and its label reads "Setup checklist", because the page heading now carries the "Get started" kicker.
- Tests:
  - `apps/web/src/app/get-started/tests/page.test.tsx`: frame composition, rendered chrome with the user's topbar for both onboarding and domain choice.
  - `apps/web/src/app/get-started/tests/layout.test.ts` (new):
    - the layout imports the manifest;
    - the manifest is import-only;
    - OnboardingView uses no `automation-*` class;
    - every `onboarding*` / `get-started-*` class in OnboardingView, GetStartedFrame and SetupDomainChoice is defined in the route stylesheet.

## Commands run and observed results

Run from the Core root.

- Fail-first: `pnpm.cmd --filter @fluxiq/web exec vitest run src/app/get-started` printed `Test Files 2 failed | 2 passed (4)`, `Tests 3 failed | 18 passed (21)`.
  - page.test: "Failed to load url ../GetStartedFrame".
  - layout.test: ENOENT for `layout.tsx` and `get-started.css`.
- After the fix: `pnpm.cmd --filter @fluxiq/web exec vitest run src/app/get-started src/features/automation-studio/onboarding src/features/automation-studio/styles/tests` printed `Test Files 12 passed (12)`, `Tests 115 passed (115)`.
  - This includes `styles-architecture.test.ts` and `style-retirement.test.ts`, which hold the CSS-manifest contracts.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (397 warning(s), 1154 baselined).`
  - An earlier run flagged `regexp-template-escapes` in my layout test; I fixed it with `String.raw`.

## Not verified

- No visual check: no browser or server was allowed. That the page now looks styled is inferred from CSS presence, not seen.
- No typecheck or build. `ComponentProps<typeof GlobalTopbar>["user"]` versus the type of `auth.user` is assumed compatible because Home passes `auth.user` to `GlobalTopbar` the same way.
- Did not run the `features/programs/tests` CSS-manifest contract tests, which concern only the Studio manifest, which I did not change.

## Open questions or contradictions found

- The onboarding view lives in `features/automation-studio/onboarding` but is styled from `app/get-started/styles`. This matches the existing pattern of `app/styles/global-programs/*` styling feature program views. The Studio styles architecture forbids the other placements unless unowned files change: a new `features/automation-studio/styles/onboarding` domain would need `expectedDomains` and the Studio manifest edited. Either way, `/get-started` cannot import Studio feature CSS.
- `git status` in the Core worktree also shows modified or new files under `apps/web/src/app/programs/automation-studio/` (`page.tsx`, `StudioDomainChoice.tsx`, `studio-href.ts` and tests). Those are not mine; they were already there from earlier rounds.
