# t955: paired cap back to four, `secrets.manage` on the three key writes; first-sign-in hook timeout

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t955/!FluxIQ`, branch
`task/t955-paired-cap-key-writes`. Nothing committed. The extension worktree is unchanged apart from
this report.

## Outcome

Done. One acceptance command, Core `vitest related`, could not finish on this machine (it runs out of
memory building the module graph). I ran the same import-graph selection another way, and all 15
files pass; details below.

1. `secrets.manage` is out of the generic paired cap. `pairedClientActor` is back to the four
   permissions it had before t928. Only the program route's actor for `save-model-key`,
   `replace-model-key` and `remove-model-key` adds `secrets.manage`, and only when the approver's role
   holds it. IAM still decides those writes.
2. first-sign-in: the cause is **not** `FluxIQ.close()` or `settled()`. Measured: `settled` took 0 ms
   and `close()` finished in a few ms. What hangs is the test's own `rm` of its root. The host-owned
   IAM audit SQLite store (`.fluxiq/platform/iam-audit.sqlite`) is still open, so Windows cannot
   delete it. t928 is the trigger, through its `resolveInstanceId`, not through `close()`. The fix is
   in the test: it now closes what its routes composed, in the same order as the production shutdown.

## What changed and why

### 1. Paired cap (Core)

- `packages/fluxiq/src/server/program-route/paired-client-actor.ts` (new). The actor module moved
  out of `program-route.ts`. The move was needed because the audit failed it at 811 lines (limit
  800), and the actor is a separate responsibility from the allowlist, narrowing and projection. It
  holds:
  - `PAIRED_CLIENT_PERMISSIONS`: four again (`programs.read`, `programs.write`, `runtime.control`,
    `flows.write`).
  - `PAIRED_CLIENT_ENDPOINT_PERMISSIONS`: `secret-keys` -> the three model-key writes ->
    `["secrets.manage"]`.
  - `pairedClientActor`: the generic actor, same signature as before.
  - `pairedClientEndpointActor(session, directory, programId, endpoint)`: the generic actor plus that
    endpoint's own permissions, each kept only if the role holds it. Ids are read trimmed and
    lower-cased, like the allowlist.
  - `PairedClientSession`: the session type, same shape as the old private `PairedSession`.
- `program-route.ts`: the actor code removed; it imports `PairedClientSession` for
  `pairedClientDomainScope`. The header comment now says four permissions plus the per-endpoint map.
- `handle-program-request.ts`: `authenticatePairedClient` uses
  `pairedClientEndpointActor(..., programId, endpoint)`. Both the first authentication and the
  guarded refresh go through it, with the same endpoint.
- `program-route/index.ts`: the barrel exports `./paired-client-actor.ts`, so `fluxiq/server` still
  exports `pairedClientActor` (used by `apps/web` connect and app-route-iam).
- `apps/web/src/lib/app-route-iam/paired-client-route-actor.ts`: comment only. The
  `APP_ROUTE_PAIRED_CLIENT_PERMISSIONS` narrowing and its contracts test are kept as they were.
- Tests:
  - `server/program-route/tests/paired-client-actor.test.ts` (new; the actor cases moved from
    `program-route.test.ts`, following the tests-beside-subject rule).
    - The generic actor is exactly four.
    - The three writes get `secrets.manage` for an admin, also with mixed-case or padded ids.
    - A viewer gets nothing added, and a disabled person gets null.
    - Every other `PAIRED_CLIENT_ENDPOINTS` entry gets exactly the generic actor.
    - `create-key`, `reveal-key`, and the same endpoint names under other programs never carry
      `secrets.manage`.
  - `paired-model-key-writes.test.ts` gains one case through the real route, with a spy on
    `api.call`: `snapshot` by the same admin token carries no `secrets.manage`; each of the three
    writes carries exactly the snapshot's permissions plus `secrets.manage`. The existing
    member-refused case still covers an approver who lacks it.
  - `program-route.test.ts`: the actor cases removed (moved, not dropped).
  - `two-step-writes.test.ts`: header comment only.

### 2. first-sign-in hook timeout (apps/web test)

The evidence, in order:

1. Reproduced on this tree before any fix. All 4 cases passed, then "Hook timed out in 10000ms" (the
   `afterAll`).
2. A probe wrapped each `close()` step with timings: detach 2 ms, backgroundTasks 1 ms,
   clientGateway 0 ms, automationStudio 1 ms, secretKeys 1 ms, **settled 0 ms**, and the close
   finished. The hook still timed out with a 120 s limit, so the time goes after `close()`.
3. A second probe timed the `rm` and listed the root every 5 s. The `rm` never returned within
   120 s. The only entries left were `.fluxiq/platform/iam-audit.sqlite`, `-wal` and `-shm`.
4. A temporary stack trace in `platformAudit` (reverted) showed the opener: the last case's
   `GET /api/keys` -> `manageKeys` -> key-session `eligible` -> `getPlatformServices()` ->
   `composePlatformServices` -> `IamAuditStore.open`.

That store, like the key-session and browser-trust stores, is host-owned. It is closed only by
`closePlatformServices`, which production's `closeFluxIQWebRuntime` calls after the workspaces close
(`apps/web/src/lib/fluxiq.ts`). The test mocks `lib/fluxiq` and only called `fluxiq.close()`.

Why it started with t928: before t928, `keySessionConfig()` threw on the local profile without
`FLUXIQ_INSTANCE_ID`, so this request never composed the platform services. The test only asserts
`not 401`. t928's `resolveInstanceId` derives a local instance id, so the request now composes them.
t948 does not touch this path.

Fix (`apps/web/src/app/api/auth/tests/first-sign-in.test.ts`): `afterAll` now runs
`fluxiq.close()` and then, in `finally`, `closePlatformServices(fluxiq)`, the same order as
production. The hook timeout is unchanged.

Production `close()` does not hang: it was measured finishing, and the production shutdown closes
the audit store. So I added no hang test. No other `apps/web` test creates a real `FluxIQ` under a
mocked `lib/fluxiq` (grep), so no other test leaks the same way.

## Commands run and observed results

Heavy commands ran through `heavy-slot.mjs`.

| Command | Result |
| --- | --- |
| Setup: `pnpm install --frozen-lockfile`, then the build-cache build | install exit 0, build exit 0 |
| first-sign-in, before the fix | 4 passed, then `FAIL ... Hook timed out in 10000ms.`, exit 1 |
| first-sign-in, after the fix | `Test Files 1 passed (1)`, `Tests 4 passed (4)`, exit 0 |
| `cd packages/fluxiq && npx vitest run src/server/program-route src/programs/secret-keys src/programs/_shared src/framework/tests` (gated) | `Test Files 98 passed (98)`, `Tests 817 passed (817)`, exit 0. Includes `paired-client-actor.test.ts`, `paired-model-key-writes.test.ts` (6) and `two-step-writes.test.ts`. |
| `npx vitest run program-route.test.ts paired-client-actor.test.ts` (after the split) | 68 + 3 passed |
| `cd apps/web && npx vitest run src/app/api/auth src/server/connect src/lib/app-route-iam src/app/api/tests` (gated, after rebuilding the dist) | `Test Files 1 failed, 13 passed (14)`, `Tests 4 failed, 151 passed (155)`. The only failures are the 4 t946 checkout tests listed below. `first-sign-in` and `key-principal-authority` (unchanged) pass. |
| `npx vitest related --run src/lib/app-route-iam/paired-client-route-actor.ts` (web) | `Test Files 1 failed, 108 passed (109)`, `Tests 4 failed, 1072 passed (1076)`. Same 4 t946 tests only. |
| `pnpm --filter fluxiq check` | exit 0 |
| `pnpm --filter @fluxiq/web check` | exit 0 |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (555 warning(s), 911 baselined).` The first run failed `program-route.ts: 811 lines`, which led to the split. |
| Lead's request: `existing-workspace-composition.test.ts`, five runs in a row, gated, after the rebuild | 5 of 5 passed, see below |
| Core `vitest related --run` on program-route.ts, paired-client-actor.ts, handle-program-request.ts and index.ts (gated) | Did not finish. Twice it aborted with exit 134, `FATAL ERROR: ... JavaScript heap out of memory`, in the vitest main process (about 2 GB default heap, after about 620 s), before any test ran. A third run with a 4 GB main heap (`node --max-old-space-size=4096`, the same heap as the package's own `build` and `check`) was still building the module graph after 19 minutes at 3.46 GB with no workers started, so I stopped it. |
| Instead: the same selection by import graph. A static scan (`t955-related.mjs`, scratchpad) does a reverse-import BFS from those 4 files over every relative import under `packages/fluxiq/src`; there are no self-imports of `fluxiq/server`. It found 15 test files, run with `npx vitest run <the 15>` (gated). | `Test Files 15 passed (15)`, `Tests 198 passed (198)`, exit 0. The 5 outside the folder run: `across-projects-iam`, `managed-request`, `trace-artifact-upload`, `fluxnode-mount`, `start-headless-server`. |

The 4 `app-route-iam-parity` failures, all in
`src/app/api/tests/app-route-iam-parity.test.ts > app route IAM parity on the local profile`:

- has a call and today's expectation for every route in the IAM table, and nothing else
- GET /api/platform/v1/commerce/checkout allows and refuses as today
- POST /api/platform/v1/commerce/checkout allows and refuses as today
- decides a self-hosted registry exactly as a local one

Times for "opens a cold persisted tenant through the actual existing-only factory after restart"
(limit 5000 ms):

| Run | Test time | File duration |
| --- | --- | --- |
| 1 | 727 ms | 104.65 s |
| 2 | 646 ms | 78.37 s |
| 3 | 733 ms | 79.35 s |
| 4 | 646 ms | 88.61 s |
| 5 | 482 ms | 86.78 s |

## Not verified

- I could not reproduce the lead's intermittent 5000 ms timeout of the composition test on t946's
  tree; this tree passed 5 of 5, under 750 ms each. I did not instrument that test's close path, so
  its cause is not established. It uses the real `closeFluxIQWebRuntime`, which does call
  `closePlatformServices`, so the leak found here does not apply to it as written.
- Core `vitest related` itself never produced a result. The substitute list comes from a regex scan
  of static imports. It would miss a test that reaches these files only through a dynamic import
  with a computed path, or through a package specifier.
- I ran no browser or extension checks. Only Core changed.
- I did not run Core's whole vitest suite (daily-sweep rule).

## Open questions or contradictions found

- The duplicate cap in `key-access/authority.ts` is resolved in round 2 below.
- `fs.promises.rm` with `maxRetries: 5` never returned while the SQLite files were held open on
  Windows; I expected it to reject. This is why a leaked store shows up as a hook timeout rather
  than an error.

## Round 2 (lead): one source for the four-permission cap

The lead asked for the duplicate cap in `programs/_shared/key-access/authority.ts` to share a single
source with `pairedClientActor`.

- Where it lives, by dependency direction: no file under `packages/fluxiq/src/programs` imports
  `server/**` (grep, excluding tests, finds none), while `server/**` already imports `programs/**`.
  The audit's rule only bars `api-contracts`, `client-gateway`, `core`, `domains`, `flows`,
  `framework`, `io`, `runtime` and `ui` from importing a program, so `server` may import one. The
  constant therefore lives at `programs/_shared/paired-client/permissions.ts`, with its barrel
  `index.ts`, typed `readonly Permission[]` and frozen.
- `server/program-route/paired-client-actor.ts` imports it and no longer declares it.
  `programs/_shared/key-access/authority.ts` imports it and its local copy is deleted.
  `programs/_shared/tests/iam-registry-fixtures.ts` (`PAIRED_PERMISSIONS`, which said it mirrored the
  cap) now re-exports it.
- New `packages/fluxiq/src/tests/paired-client-permissions.test.ts`. It lives in `src/tests`, the
  nearest folder holding both subjects.
  - Behaviour: with an administrator holding every permission, the program route's
    `pairedClientActor` and the key-access authority's trusted-client actor (captured from its
    `api.authorize` call) both keep exactly the shared set, on the `paired-client` channel.
  - Audit: a scan of every non-test `.ts` under `src` finds no other array literal holding exactly
    these four permissions in any order. Checked negatively: a temporary file holding them in another
    order made the scan fail and name the file; the file was then removed.
- Not changed: many test files hold the same four as role or actor fixtures. They are inputs to the
  tests, not the rule, and the scan skips `tests/`. `apps/web`'s `APP_ROUTE_PAIRED_CLIENT_PERMISSIONS`
  is a separate narrowing for app routes, kept as the brief asked.

Round 2 checks (gated):

| Command | Result |
| --- | --- |
| `cd packages/fluxiq && npx vitest run src/server/program-route src/programs/_shared src/programs/secret-keys src/tests/paired-client-permissions.test.ts` | `Test Files 92 passed (92)`, `Tests 776 passed (776)`, exit 0 |
| `node scripts/structure-audit.mjs` | First run: `FAIL [imports] .../paired-client/permissions.ts ... "../../identity-access/types.ts" ... Import from the directory (its index) instead.` Fixed to import from `../../identity-access/index.ts`, then: `structure-audit: passed (555 warning(s), 911 baselined).` |
| `pnpm --filter fluxiq check` (after that import fix) | exit 0 |
| `npx vitest run src/tests/paired-client-permissions.test.ts src/programs/_shared/key-access .../paired-client-actor.test.ts .../program-route.test.ts` (after the import fix) | `Test Files 6 passed (6)`, `Tests 88 passed (88)`, exit 0 |

The `apps/web` check was not re-run in round 2. The `pairedClientActor` signature and its exports are
unchanged, and `apps/web` reads the compiled dist, which has not been rebuilt since round 2.
