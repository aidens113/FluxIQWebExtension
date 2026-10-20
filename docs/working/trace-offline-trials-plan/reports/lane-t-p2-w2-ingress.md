# Report: lane-t-p2-w2-ingress (t736, Core ingress outside the socket)

## Outcome
Done. All five parts of the brief are in place in the Core worktree `fxwork/t736/!FluxIQ` (branch
`task/t736-trace-capture`). Nothing was committed. Every check the brief names passes. One of them, the
apps/web route tests, could not run under apps/web's own vitest config: that config refuses to run while
Core's dist is older than its source, and the brief forbids rebuilding dist. They were run with a scratch
copy of the config that leaves out only that guard (details below).

## What changed and why
AS = `packages/fluxiq/src/programs/automation-studio`.

- **Run control into the targeted episode (D1).** The handlers below each look up
  `AutomationStudioGatewayTraceInstallation.current()`. When it is absent, or when no episode matches,
  they do nothing. Each control event is recorded *before* the request takes effect, with type
  `run_control`.
  - `AS/api/handlers/runtime-execution.ts`: cancel run. The episode is found with `registry.byRunId(runId)`
    and must belong to the same `projectId`. Payload: `{action:"cancel", projectId, runId, reason}`.
  - `AS/api/handlers/run-control.ts`: pause and resume, found the same way. Payloads:
    `{action:"pause", holder, reason, projectId, runId}` and
    `{action:"resume", afterManualAction, note, projectId, runId}`. The `holder` expression is computed
    once and reused in the existing pause call, so behaviour is unchanged.
  - `AS/api/handlers/llm-generation.ts`: cancel flow bootstrap. The event goes to the outermost open episode
    of `[projectId, flowId]` (`registry.byFlow(...)[0]`). Payload: `{action:"cancel_build", projectId, flowId}`.
  - No file was added under `api/handlers/`. These three files import from the `gateway-trace` barrel, and
    the import-cycle rule passes for them.
- **Ask answers.** `AS/runtime/parking/conversation-port.ts`: the wait loop moved unchanged into an inner
  `waitForAnswer`. `awaitAnswer` now records `control.ask_answer` `{askId, answered, answer}` into the
  ambient episode, which is exactly what the episode goes on with. When the wait ended unanswered, it records
  `answer: null, answered: false`. A wait that throws records nothing and still throws. This file imports
  `../gateway-trace/installation.ts` directly, not the barrel. Through the barrel, the structure audit failed
  with an import cycle: W1's new `gateway-trace/run-bind.ts` -> `activity` -> `activity/ask/resolution.ts`
  -> `parking`. `installation.ts` imports only a type.
- **Screenshot PUT.** `AS/runtime/service/object-documents.ts` `writeProjectObjectAsset`:
  - It now hashes the content and checks `expectedSha256` *before* `putBytes`. This fixes the existing
    defect where a mismatched upload was stored first and refused afterwards. The error text is unchanged, so
    the route still maps it to 409.
  - It has a new optional input,
    `traceIntake?: { sessionId; gateway: Pick<ClientGatewayService, "receiveTraceArtifact"> }`. After a
    successful write, it calls `gateway.receiveTraceArtifact(sessionId, {sha256 (stored), mediaType (stored),
    bytes (a copy)})`. `AS/runtime/service.ts` already passes the input through unchanged, so it was not
    touched.
  - The state-assets route
    (`apps/web/src/app/api/programs/automation-studio/state-assets/[projectId]/[sha256]/route.ts`) now passes
    the paired client's `clientSession.sessionId` with `gateway: fluxiq.programs.clientGateway`, on the
    bearer path only. An upload made with a signed-in cookie carries no intake.
- **New route** `apps/web/src/app/api/client-gateway/trace-artifacts/[sha256]/route.ts` (PUT):
  - Authentication: a bearer token is required (401 without one). `authorizeToken` checks it (401 when
    unknown), then `pairedClientDomainScope` (403 on a domain mismatch). This matches how the state-assets
    route authenticates a paired client, except that there is no project to check.
  - It accepts only a lower-case 64-hex digest (400 otherwise).
  - Media types come from an explicit allowlist (415 otherwise): text/html, text/css,
    image/png|jpeg|webp|gif|avif|svg+xml|bmp|x-icon|vnd.microsoft.icon, and
    font/woff|woff2|ttf|otf|sfnt|collection. Parameters such as charset are stripped and the type is
    lower-cased.
  - Size limit is 20 MB, checked against both the header and the body (413). An empty body gets 400.
  - It calls `receiveTraceArtifact(clientSession.sessionId, …)`. A digest refusal gets 409. Success gets 200
    `{ok:true,payload:{sha256,traces}}`, and `traces: 0` counts as success.
  - Nothing is logged.
- **Tests** (new files only; no existing test was edited):
  - `AS/api/handlers/tests/trace/tests/run-control.test.ts`: 5 tests. It is nested because
    `api/handlers/tests/` was at its 25-file limit; the precedent is `tests/chat-turn/tests/`.
  - `AS/runtime/parking/tests/conversation-port-trace.test.ts`: 4 tests.
  - `AS/runtime/service/tests/object-documents-trace.test.ts`: 4 tests, among them T11 end to end. That test
    uses a real `ClientGatewayService` with tracing on through the episodes, a paired client, an episode that
    claims the session by sending `captureSnapshot`, the real legacy `AutomationStudioObjectStore`, and the
    real SQLite trace store (`SqliteTraceFixture`). It checks that after `deleteRecordingObjects` prunes the
    screenshot it still reads back from the trace after a reopen and the trace is complete. With the trace's
    content object file removed, completeness is not `complete` and includes `missing_artifact`.
  - `apps/web/.../trace-artifacts/[sha256]/tests/route.test.ts`: 11 tests, including one that checks the
    route directory matches `CLIENT_GATEWAY_TRACE_ARTIFACT_PATH`.
  - `apps/web/.../state-assets/[projectId]/[sha256]/tests/route-trace.test.ts`: 2 tests.

## Commands run and observed results
- Baseline, before any edit, from packages/fluxiq:
  `pnpm exec vitest run src/programs/automation-studio/api src/programs/automation-studio/runtime/parking src/programs/automation-studio/runtime/service/tests`
  -> `Test Files 1 failed | 34 passed (35)`, `Tests 1 failed | 230 passed | 1 skipped`. The failure was
  `cancel-runtime-session.test.ts` "stops a queued run end to end", which timed out at 15000ms and was
  followed by EBUSY on unlink. Run alone, that file printed `Tests 6 passed`, so the failure depends on load.
- Final, same command -> `Test Files 38 passed (38)`, `Tests 244 passed | 1 skipped (245)`.
- `pnpm exec tsc --noEmit` (packages/fluxiq) -> `exit=0`. An earlier run failed only in W1's in-progress
  files (`gateway-trace/tests/episode-wiring.test.ts`, `gateway-tap-episodes.test.ts`); it was clean on
  rerun.
- `pnpm exec tsc --noEmit` (apps/web, which resolves `fluxiq` to src through tsconfig.base paths) -> `tsc exit=0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (420 warning(s), 1152 baselined).` with
  `exit=0`.
- `pnpm --filter @fluxiq/web exec vitest run src/app/api/client-gateway/trace-artifacts …` -> refused by
  the config: `apps/web tests: Core's library build is 66 minute(s) behind its source. Stale:
  …packages\fluxiq\src\programs\_shared\runtime.ts is newer than anything in dist`. dist was already stale
  from another worker's file before mine.
- Rerun from apps/web with the scratch config
  `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/w2-ingress-web-vitest.config.mjs`.
  It is apps/web's own config minus `refuseStaleCoreBuild()`:
  `pnpm exec vitest run --config <that> src/app/api/client-gateway/trace-artifacts src/app/api/programs/automation-studio/state-assets`
  -> `Test Files 3 passed (3)`, `Tests 17 passed (17)`. The existing `state-assets/.../route.test.ts` (4)
  still passes. These tests mock `lib/fluxiq`. Only the trace-artifacts test loads dist, through
  `fluxiq/client-gateway`, and only for the path constant, which dist already exports via contracts.

## Not verified
- The apps/web route tests under apps/web's own config, which needs Core rebuilt (supervisor:
  `pnpm --filter @fluxiq/contracts --filter fluxiq build`).
- Next.js production build, or live browser behaviour of either route. No real extension upload was made.
- Parked-and-resumed runs (`parking/parked-run.ts`) for the ask answer, which P2a also flagged.
  Only the in-place `awaitAnswer` path records.
- What the extension sends as `content-type` for trace artifacts. The route stores the base type without
  parameters.

## Open questions or contradictions found
1. The brief says apps/web's route tests pass with `pnpm --filter @fluxiq/web exec vitest run`. That
   command cannot run without a Core dist rebuild, and the brief forbids one. The supervisor should rebuild
   and rerun it.
2. `writeProjectObjectAsset` ignores the intake's answer. Its only refusal, `digest_mismatch`, cannot happen
   because the digest passed is the one the store computed from those same bytes. If the intake throws, the
   upload fails after the write. The gateway's tap is designed not to throw.
3. W1's `gateway-trace/run-bind.ts` puts the `gateway-trace` barrel in a cycle with `parking`. Any runtime
   module under `parking`, or reachable from `activity`, must import `gateway-trace/installation.ts`
   directly. The audit enforces this.
4. The state-assets screenshot is recorded through the gateway tap, on the `artifact` stream with
   `resourceKey` set to the sha256, as the brief directs. It is not recorded as a `control.artifact_intake`
   event with `resourceKey = contentRef` as P2a sketched, so the `artifact_intake` control type stays unused.
