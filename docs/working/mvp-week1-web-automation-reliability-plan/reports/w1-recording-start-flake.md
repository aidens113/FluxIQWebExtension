# w1-recording-start-flake

Worker report. Task: find why the recording lane intermittently fails with
"The extension recording did not start", and make the start deterministic
without simply lengthening the poll.

## Outcome

**Done.** The race is named, proven by controlled experiment, and fixed at its
cause in the runner. Eight consecutive isolated runs across `iframe-checkout`
and `basic-form` passed (`pass=8 fail=0`), and
`pnpm lab bench --corpus smoke --repeat 2 --target isolated` is green
(4 runs, 4 passed, 0 skipped). One known identical exposure in the `clone`
lane is left unchanged and flagged under "Not verified" — I cannot exercise
that lane here.

## Root cause

The failure is a **10-second freshness race on Core's Automation Studio
context**, not a slow start. Naming each link:

1. Core registers a recording-context provider at
   `F:\!FluxIQ\apps\web\src\lib\fluxiq.ts:113`
   (`setClientRecordingContextProvider`). Every `client.start_recording` is
   resolved through it.
2. That provider calls `resolveClientRecordingProject`
   (`F:\!FluxIQ\apps\web\src\lib\automation-studio-context.ts:35-52`) with its
   default `freshnessMs = 10_000`. It returns
   `{ ok: false, code: "recording.project_required" }` when the approving
   operator's context is absent **or when `now - context.updatedAt >= 10_000`**.
3. The runner stamps that context exactly once, at topology startup:
   `packages/test-runner/src/coordinator.ts:131`,
   `await control.selectProject(projectId)` (no `clientId`, so it lands under
   the `operatorUserId:*` key). Nothing restamps it afterwards.
4. Everything between that stamp and the start must therefore fit in 10 s:
   Playwright browser launch, extension load, `pairExtension` +
   `approve-pairing`, `activateScenarioTab`, `proveCoreActionRoundTrip` (two
   Core actions, on scenarios that have a CSS-target `type` step),
   `listRecordings`, and the extension's own `projects.resolve` snapshot call.
   On a loaded machine it does not, and Core rejects the start.
5. On that rejection the extension's `handleRecordingProjectRequired`
   (`apps/extension/src/background/connection.ts:579-596`) sets
   `recordingState = "idle"`, sets `recordingBlock`, and calls
   `clearPendingRecordingStart()` — **cancelling the 750 ms
   `RECORDING_START_ACCEPT_TIMEOUT_MS` timer** that otherwise begins the
   recording locally even when Core never answers.

Step 5 is why lengthening the poll can never work: the extension latches `idle`
permanently, so a longer wait observes the same idle state forever. It is also
the reason the earlier 15 s timeout was the observed symptom — the extension
self-starts within 750 ms whenever the start is merely *slow*, so a 15 s
timeout already proved the start had been **refused**, not delayed.

The rejection is specifically the freshness check and not a project mismatch:
the extension had resolved and sent a `projectId` (`hasProjectId: true`,
activity `recording:Project context linked`), and a mismatched project yields
`recording.project_context_mismatch`, not `recording.project_required`.

## What changed and why

One file: `packages/test-runner/src/run-scenario.ts` (the isolated recording
lane). No extension, domain, or Core change — the defect is the runner's, which
treated a fire-and-forget message as a started recording.

1. **The fix.** Restamp the context immediately before starting:
   `if (topology.projectId) await topology.control.selectProject(topology.projectId);`
   directly above the `fluxiq.startRecording` message. Acceptance now depends on
   this call rather than on how long startup happened to take, which is an
   observable signal (Core's own context record), not a sleep and not a retry.
   A bounded retry was considered and rejected as unnecessary: the remaining gap
   between the restamp and Core's evaluation is the extension's own
   `projects.resolve` snapshot call, observed at 0.3-0.8 s against a 10 s
   window.
2. **Diagnostics**, so this class of failure is never again invisible. The poll
   failure now captures the extension's own account into
   `snapshots/recording-start.json` and into the failure message, via
   `recordingStartDiagnostic` / `describeRecordingStartDiagnostic`. Both report
   **labels, codes and reasons only** — no tab URLs, no activity details, no
   recorded page data. The lane previously discarded the status that
   `fluxiq.startRecording` already returns, which is why the cause stayed hidden
   across three separate sightings.

The temporary probe used to force the race was removed; `grep -c` for it in the
file returns 0.

## Commands run and observed results

All Lab commands used `FLUXIQ_TEST_ENV_FILES=none`, one run at a time.
`.env.local` was not touched. No Core file was edited.

1. **Baseline, does not reproduce unattended.** Six sequential
   `pnpm lab run iframe-checkout --target isolated`:
   `SUMMARY scenario=iframe-checkout pass=6 fail=0`.
2. **Controlled reproduction (no fix).** One run with a deliberate 12 s pause
   inserted before the start, pushing the gap past Core's 10 s window:
   `run-mtxj6kj8-01d315e7` → `verdict: failed`, `recording.persistence`, on the
   first attempt. Its captured `snapshots/recording-start.json`:
   - `connectionState: "connected"`, `hasSessionId: true`, `hasProjectId: true`
   - activities `recording:Recording locked`, `recording:Starting recording`,
     `recording:Project context linked`
   - `recordingBlockCode: "recording.project_required"`,
     `lastError: "Open a FluxIQ project before recording."`
   Its Core HTTP signature — `snapshots=4 listRec=1` — is **identical** to the
   originally reported failure `run-mtxihk3k-b7583814` (`snapshots=4
   listRec=1`), where a passing run shows `snapshots=5 listRec=2`.
3. **Same experiment with the fix.** Identical 12 s pause:
   `run-mtxj9uci-b5b45cc3` → `verdict: passed`. This is what distinguishes a
   fix from a timing coincidence.
4. `pnpm --filter @fluxiq-web-extension/test-runner check` → exit 0.
5. `pnpm --filter @fluxiq-web-extension/test-runner test` → `# pass 357`,
   `# fail 0`.
6. `node scripts/structure-audit.mjs` → `structure-audit: passed (29
   warning(s), 19 baselined)`. No new finding, and **no "can be lowered" line**
   (grepped explicitly). `run-scenario.ts` appears only as the advisory
   400-line warning at 430 lines; it was already past that threshold at 421
   lines before this change, and that warning is not ratcheted.
7. **Eight consecutive runs**, four `iframe-checkout` and four `basic-form`,
   isolated, one at a time → `SUMMARY pass=8 fail=0 of 8`. Every run exited 0,
   alternating scenarios, 22:37:12–22:44:56Z, each ~55-60 s:
   runs 1/3/5/7 `iframe-checkout`, runs 2/4/6/8 `basic-form`. No
   `recording.persistence` failure and no `snapshots/recording-start.json`
   written in any of them.
8. `pnpm lab bench --corpus smoke --repeat 2 --target isolated` →
   `{"status":"passed","benchId":"bench-mtxjo1kt-f8a12eca","results":2,"runs":4,"passed":4,"skipped":0}`,
   process exit 0. Report at
   `test-runs/bench/bench-mtxjo1kt-f8a12eca/report.json`.

## Not verified

- **The `clone` lane still carries the identical defect** and I did not change
  it. `run-scenario.ts:190-191` lists recordings and starts a recording for
  `cloneState.destination.projectId` with no context restamp, while the only
  startup stamp was for a *different* project (`topology.projectId`) — so it is
  exposed to both staleness and, plausibly, `recording.project_context_mismatch`.
  I left it alone because it needs an existing/clone FluxIQ target that I
  cannot exercise here, and shipping an unvalidated change to a lane I cannot
  run seemed worse than flagging it. The `existing` lane is already safe: it
  calls `selectExistingContext` immediately before its start.
- I never reproduced the flake *unattended*; six runs alone all passed. The
  causal claim rests on the controlled experiment (fails deterministically
  without the fix, passes with it, same HTTP signature as the real failure),
  not on catching it in the wild.
- No manual browser validation beyond the Lab runs themselves.
- Core's `freshnessMs = 10_000` was read, not changed. Whether 10 s is the
  right window for real operators is a Core question I did not touch.

## Open questions or contradictions found

1. **The extension reports success for a start it refused.**
   `background/index.ts` answers `fluxiq.startRecording` with
   `{ ok: true, status }` even when `startRecording()` returned early because
   the gateway was not connected or the active tab was a browser/extension
   page. Those two branches are silent no-ops with no retry. The runner now
   surfaces the status, but the protocol still has no explicit
   accepted/declined result — worth adding.
2. **`coordinator.ts:131` stamps the context without a `clientId`**, so it
   lands under the wildcard key. A per-client stamp would be more precise now
   that the resolver prefers `operatorUserId:clientId`.
3. The extension's 750 ms local-start fallback exists so no user action is
   lost, yet `handleRecordingProjectRequired` cancels it. For a user pressing
   Record that is defensible (the recording genuinely cannot be attributed to a
   project), but it makes the failure permanent and silent rather than
   self-healing — which is what made this bug survive three sightings.
