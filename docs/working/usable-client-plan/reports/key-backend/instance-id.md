# t928 instance-id report

## Outcome
Done (one caveat: the type fix to my own new test was not re-run through tsc, see Not verified).

## Cause (confirmed by reading code and tests)
`server/key-sessions/config.ts` required `FLUXIQ_INSTANCE_ID` in every profile. Discovery required it only in the service profile. `scripts/run-fluxiq-web.mjs` runs the local profile and leaves the variable unset, so `keySessionConfig` threw and `/api/keys` answered 503, while discovery answered fine. The old config test asserted `keySessionConfig({})` throws, which pinned the bug.

## What changed
- New `apps/web/src/server/key-sessions/instance-id/` (`resolve.ts`, `index.ts`): `resolveInstanceId(env, settings)`. An explicit `FLUXIQ_INSTANCE_ID` wins. Only the local profile may go without one; its id is `local-` plus the first 16 hex of sha256 of the configured public origin, so it is stable across restarts and never read from a request. Service and self-hosted return undefined.
- `config.ts` and `api/discovery/build-discovery-document.ts` both call it, so they agree. The service profile still refuses without the variable. Self-hosted discovery still omits the id.
- Tests: config.test.ts (service refuses; local derives, same across calls; explicit wins), discovery tests (local advertises derived id; self-hosted omits), new `instance-id/tests/resolve.test.ts` (explicit, restart stability, per-origin, no invention for service/self-hosted, discovery and key sessions agree).
- Deleted the previous worker's temporary `apps/web/vitest.t928tmp.config.ts`.

## Commands run
- `heavy-slot ... npx vitest run src/server/key-sessions src/app/api/keys src/app/api/discovery` -> 9 files, 56 tests passed.
- `pnpm --filter @fluxiq/web check` -> 2 errors:
  - `src/lib/workspaces/tests/tenant-eviction.test.ts(90,105)` TS2353 `authorizationPassword` not in `CreateSecretKeyInput`. Outside my paths (consequence of the packages/ secret-keys change by another task); not fixed.
  - `resolve.test.ts(27)` TS18046 `built.document` unknown. Mine; fixed afterwards with a cast.
- `node scripts/structure-audit.mjs` -> 1 violation, `packages/fluxiq/src/client-gateway/service/model-access/delivery.ts` deep import. Outside my paths. No violation in apps/web key-sessions, api/keys or api/discovery; the two earlier apps/web imports are not flagged now (discovery imports the `instance-id` barrel).

## Not verified
tsc after the cast fix; the live panel under run-fluxiq-web.mjs (supervisor's job).

## Open
Derived id depends on the public origin, so changing the local port changes the identity. Acceptable for local; set `FLUXIQ_INSTANCE_ID` to pin it.
