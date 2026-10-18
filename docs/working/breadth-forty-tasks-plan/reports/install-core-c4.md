# install-core-c4 (t707): Get started creates a domain-less project

## Outcome

Done, with one caveat. The defect is real. The fix is in `app/get-started`. The fail-before and pass-after runs were both seen. After a statement-packing cleanup of `page.test.tsx`, the tests could not be run again: another worker's Core source edit made the web test config's stale-build guard refuse to start, and this brief forbids builds.

## Cause (confirmed from the code)

- `apps/web/src/app/page.tsx:21`: Home links to `/get-started` with no domain.
- `apps/web/src/app/get-started/page.tsx` (before the fix) rendered `GetStartedClient` without resolving a domain. `GetStartedClient.tsx` `onStart` only forwards `domainId` when the URL already has one, so the start buttons push `/programs/automation-studio?start=<option>`.
- `app/programs/automation-studio/page.tsx` has no `domainId`, so it renders the global Studio. `AutomationStudioSession` gets `domainId` from `useAutomationBrowserEntry` (the URL), and `features/programs/program-api.ts:126-131` only appends `?domainId=` when the URL has one.
- `app/api/programs/[programId]/[endpoint]/route.ts` `authenticate` sets `scope: programDomainScope(request.url)`. That scope's `domainId` is undefined here.
- `packages/fluxiq/src/programs/automation-studio/api/handlers/projects.ts:72` then creates the project with `domainId: request.scope.domainId ?? null`, so the project has a null domain. That is the point where the domain is dropped. The paired client is later refused at `route.ts:128` (`pairedClientProjectDomainRefusal`).
- The Home > domain > Studio path works because `app/domains/[domainId]/programs/[programId]/page.tsx` redirects with `?domainId=`.

## How the runtime knows its domain

`createFluxIQWebInstance` (`apps/web/src/lib/fluxiq.ts:171-180`) sets `fluxiq.activeDomainId` when a domain is named explicitly or when exactly one domain is registered. `fluxiq.domains.summaries()` lists every registered domain. No domain id is hard-coded anywhere.

## What changed and why

- New `apps/web/src/app/get-started/resolve-setup-domain.ts` exports `resolveSetupDomain` (a pure function) and the `SetupDomain` type. It applies these rules in order:
  - A requested `domainId` that is installed is kept.
  - Otherwise the runtime's active domain is used, if it is registered.
  - Otherwise the only installed domain is used. These two cases redirect.
  - With several domains installed and none active, the person is asked to choose.
  - With no domains installed, setup stays global, as before.
  - An unknown requested id is ignored.
- New `apps/web/src/app/get-started/SetupDomainChoice.tsx` is the chooser. It shows one link per domain, each pointing to `/get-started?domainId=<id>`.
- Changed `apps/web/src/app/get-started/page.tsx`. It now reads `searchParams` and resolves the setup domain. It redirects to `/get-started?domainId=<id>` when the domain is carried, renders the chooser when the person must choose, and otherwise renders the existing client.
  - The domain goes in the URL because `GetStartedClient`, `useProgramApi` (its snapshots) and the Secret Keys link all read it from there.
  - From there, the existing `onStart` forwards it to Studio, and project creation is scoped to it.
- I left Home `page.tsx` unchanged. Its link is now correct because `/get-started` resolves the domain itself, and putting the rule only there avoids a second copy of it.
- Tests:
  - New `get-started/tests/resolve-setup-domain.test.ts` has 7 cases.
  - `get-started/tests/page.test.tsx` was rewritten. It mocks `lib/fluxiq`, keeps the two existing cases, and adds three: redirect to the active domain, keep an installed requested domain, and chooser when several are installed.

## Commands run and observed results

All runs were from the Core root (`C:/Users/osrs_/FluxStuff/fxwork/t707/!FluxIQ`).

1. `pnpm.cmd --filter @fluxiq/web exec vitest run src/app/get-started/tests/page.test.tsx src/app/get-started/tests/resolve-setup-domain.test.ts`. This ran with the helper and chooser present and the old `page.tsx`.
   - Result: 2 failed, 10 passed.
   - "sends a domain-less setup request to the runtime's installed domain" failed with `promise resolved "{ …(10) }" instead of rejecting`.
   - "asks the person to choose a domain…" failed with `expected Symbol(react.suspense) to be [Function SetupDomainChoice]`.
   - An earlier run, before the helper existed, failed both suites on missing modules.
2. The same command over `src/app/get-started/tests`, after the `page.tsx` fix.
   - Result: Test Files 3 passed (3), Tests 23 passed (23).
   - That covers resolve-setup-domain 7, page 5, and GetStartedClient 11 (unchanged).
3. `node scripts/structure-audit.mjs` first flagged statement packing in my `page.test.tsx`. I split it to one statement per line.
   - The rerun flags only `features/automation-studio/onboarding/tests/useOnboardingReadings.test.tsx` (45 packed lines against a baseline of 44). That file is not mine and is on my must-not-touch list; another worker has it modified.
4. The same vitest command after the split: refused at config load with "Core's library build is 15 minute(s) behind its source. Stale: packages/fluxiq/src/client-gateway/service/pairings.ts". Another worker edited that file. Building was outside my brief, so I did not rebuild.

## Not verified

- The final reformatted `page.test.tsx` has not been run. Its assertions are the same as in run 2, which passed; only line layout changed. Re-run it after the lead rebuilds Core: `pnpm --filter @fluxiq/contracts --filter fluxiq build`, then the vitest command above.
- No typecheck, browser check or live pairing check was done, as the brief instructed.
- `SetupDomainChoice` has no rendered-markup test. Only its selection by the page is tested.

## Open questions or contradictions found

- The global Automation Studio program, reached from Home's program list as `/programs/automation-studio` with no domain, still lets a person create a domain-less project, and a paired browser will refuse it. That path is outside my owned files (`app/programs/automation-studio/page.tsx`, `ProgramLauncher`). It may need the same resolution, either a redirect to the installed domain or a chooser. This is a decision for the lead.
- The structure-audit failure in `useOnboardingReadings.test.tsx` belongs to the worker that owns that file.
