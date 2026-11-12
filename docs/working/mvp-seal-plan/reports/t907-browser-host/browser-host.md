# t907 browser-host (EXT packages/browser-host)

## Outcome
Done, except the headed Chromium test, which is written and marked not run.

## What changed and why
- New `packages/browser-host` (design section B): `launchHost`, `launchHosts`, `createBrowserHostLauncher`, `launcher.ts` (default and named `createFluxIQHostLauncher(env)`, reads `FLUXIQ_BROWSER_EXTENSION_PATH`), profile (fresh mkdtemp, named `<dataDir>/browser-hosts/<name>/<hostId>`), enrol (control page, `fluxiq.connect` with ticket as in-memory evaluate arg, status polling, retry 4 attempts with new ticket, `enrolment.*` final), protocol-logging guard, reaper (detached, IPC, Windows `Get-CimInstance`/`taskkill /T /F`, POSIX `ps`/signals), `clean-environment.ts` (drops credential-named env vars by pattern, so no provider key names are restated).
- `find-profile-processes.ts` is the single `--user-data-dir` matcher; `find-browser-process.ts` in browser-host builds on it. test-runner's `find-browser-process.ts` now re-exports from `@fluxiq-web-extension/browser-host/reaper`.
- Structure audit rule: `packages/browser-host` must not import `packages/test-runner`.
- Docs: new "The Browser Host Package" section in `docs/architecture/repository-layout.md`.
- Deviations: (1) `packages/test-runner/package.json` gained the `workspace:*` dependency on browser-host, needed for the re-export to resolve (outside the owned list). (2) Reaper client files live in `reaper/reaper/{client,main,message}.ts` (structure-audit prefix rule). (3) `register`/`forget` return promises resolved when the message is written, and launch awaits registration before starting Chromium. (4) Named profiles are not passed through test-runner's `forgetCachedServiceWorkers` (product code cannot import it); a named profile reused across extension builds may run a cached worker. (5) `createReaperClient` is a factory; the engine uses `sharedReaper()`.

## Commands and results
- `pnpm install --offline` (via heavy-slot): Done in 5.2s, exit 0.
- `tsc -p tsconfig.json --noEmit` in packages/browser-host: exit 0 (Core's managed-hosts types were present).
- `node --test "dist/**/*.test.js"` in packages/browser-host: tests 15, pass 14, fail 0, skipped 1. Covers profile creation/removal and named location, protocol-logging guard, launchHosts closing the others on failure and parallelism, find-profile-processes quoting forms, and the real reaper test (dummy node processes holding `--user-data-dir`, link cut with `disconnect()`; the held process exited, the fresh dir was removed, the named dir kept, an unregistered bystander untouched).
- test-runner `find-browser-process.test.js`: tests 6, pass 6.
- `node scripts/structure-audit.mjs` in EXT: "passed (247 warning(s), 552 baselined)".

## Not verified
- Headed Chromium test (`src/tests/enrol-headed.test.ts`, fake dependency-free WebSocket gateway): SKIPPED. `apps/extension/dist/chrome` does not exist in this tree, so the "enrolmentTicket" condition is unmet. The test answers the hello with `server.error enrolment.unknown`, asserts one hello carrying the ticket, one ticket taken, and no command line holding it.
- No real browser launch, headless mode (`channel: "chromium"`), POSIX paths, Windows reaper against a real Chromium, or `closed` after a browser crash were exercised.
- Reaper test cuts the IPC link with `disconnect()` rather than killing a parent process.
- `packages/test-runner` full typecheck has pre-existing `@fluxiq-web-extension/domain/node` errors in this tree (domain dist not built); none concern browser-host. test-runner's build does not yet build browser-host first; the Lab build order needs browser-host added.
- Extension side (`fluxiq.connect` `enrolment`, status `lastError` carrying the `enrolment.*` code) is assumed from the design.
