# t177: Lab observability

Lane lead report. Trees: downstream `C:\Users\osrs_\FluxStuff\fxwork\t177\!FluxIQWebExtension`, Core `C:\Users\osrs_\FluxStuff\fxwork\t177\!FluxIQ`, both on `task/t177-lab-observability`, uncommitted.
No live runs and no provider calls. Workers: W1 (item 6, Core side) and W2 (item 4); their reports are `t177-w1-provider-throw.md` and `t177-w2-recovery-state.md` in this folder. I re-verified both myself; see Validation.

## Outcome

Partial: items 1, 2, 3, 4 and 6 are done, and item 5 is done except the start-step restoration.

| Item | Status | What closes it |
| --- | --- | --- |
| 1. Amendment refusals dropped; provider-failures copy cut at 8,000 | Done | `publishable-step-value.ts` validates `amendmentsRefused` (records) and `amendmentRefusals` (flat codes; the node part runs past the old 128-char limit) as named fields, all-or-nothing, against Core's closed reasons and bounds. `PROVIDER_FAILURE_BODY_MAX_CHARS` 8,000 -> 65,536 (local tier only). |
| 2. Re-author calls and iterations not recorded | Done, via the new decision trace | Core already persists them: `runDetail.metadata.resultReauthor.attempts[]` holds `durationMs`, `accounting` and, for a failed build, `evidenceLoop.steps` with per-call `usage`; a successful build keeps them on its adaptation. The Lab never read them. The trace (item 3) copies both. `live-llm/observed-usage.ts` still prints `perCallRecords: "not recorded"` (that file is outside my ownership); read the trace instead. |
| 3. Clone runs delete Core's store, so no decision content survives | Done | New `run-scenario/decision-trace/`. `readDecisionTrace` is called in `run-scenario.ts` cleanup before `topology.close()`, while Core still answers and before the redaction attestation. It writes `snapshots/decision-trace.json`: for up to 8 Flows it copies each Flow's newest 12 runs' `llmGate`, `recoveryTrace`, `recoveryState`, `resultReauthor` and `runtimePatchAttempts`, plus up to 12 adaptations' `accounting` and `evidenceLoop`. Bounds are 10 s per read and 45 s in total; failed reads are named by code in `unread[]`. It runs for every non-`existing` mode. |
| 4. Fixed 300 s recovery wait | Done (W2) | Core writes `runDetail.metadata.recoveryState` = `running`, then `ended` or `threw` (code `recovery.threw`), around both `runRuntimeSession` recovery calls. The Lab's `terminal-run-wait.ts` extends its wait while the state is `running`, up to `TERMINAL_DETAIL_MAX_WAIT_MS` (the grant lease, 600 s) from the first terminal read. It stops at once on `threw`, or on `ended` with no record, returning `recoveryState` = `recovery.threw` / `recovery.ended_without_record` / `recovery.still_running`. With no marker, the old rule still applies. W2 also found why run 1 ended `unsettled: "recovery"` with nothing written: a throwing annotation left no record (`endAutomationStudioRuntimeSessionAfterThrow` skips an already-failed session). |
| 5. `incompleteDraft` and start-step restoration not shown | `incompleteDraft` done; restoration blocked | The Lab's refused build (`flow-lane/creation/build-proposal.ts`) now carries `evidenceLoop.incompleteDraft {revision, steps}` into `snapshots/flow-lane.json`. The panel's failure message adds "kept ... a draft of N steps (revision R)" from those two counts only. **Start-step restoration is not published by Core at all:** `automationStudioFlowBootstrapDraftWithStartStep` returns `restored {position, id?}`, and `llm/harness-options/bootstrap-completion.ts:203` keeps only `.steps`. Publishing it needs a field threaded through `flow-bootstrap/**` (the diagnostic and the adaptation), which my brief excludes. It belongs to whoever owns flow-bootstrap (t174/t175). |
| 6. `provider_transport_unknown` has no underlying error | Done | Core (W1): an untyped throw is read by the new `llm/throw-account/` and screened by the new `llm/harness/throw-screen.ts` (the existing credential/locator screens). It is published as `payload.diagnostic.providerThrow {errorClass?, errorCode?, causeClass?, causeCode?, message? (screened, <=240), withheld?}`, only beside `provider_transport_unknown`, and round-trips through `diagnostic-parse.ts`. Lab: `provider-failures.local.json` gains `provider.thrown` (every string redacted again with the run's secrets and the key). The bundle's refused build gains `failure.providerThrow` with the class and codes only, never the message. |

## Core files touched (under `packages/fluxiq/src/programs/automation-studio/runtime/` unless stated)

- Item 6 diagnostic fields: `flow-bootstrap/generation-failure/{diagnostic.ts,diagnostic-parse.ts,harness-failure.ts}` (new optional `providerThrow` only), `llm/provider-contract.ts`, `llm/harness/run.ts`, `llm/index.ts`, and new `llm/throw-account/**` and `llm/harness/throw-screen.ts`, with tests.
  - `flow-bootstrap/**` is excluded in general; I read the brief's "bounded diagnostic fields for item 6" as allowing this one field. **Integration risk** with lanes editing generation-failure.
  - W1 departed from its brief: the normalizer carries an *unscreened* read, and `run.ts` screens it. Screening inside the normalizer caused an import cycle. I checked that every other consumer of the normalized failure (`provider-retry/call.ts`, `failure-disposition.ts`) reads only `code`, `status` and `retryable` by name, so the unscreened text reaches nothing persisted.
- Item 4 (not in the brief's Core list; needed because Core had no in-flight state to wait on): `service.ts` (the two `runRuntimeSession` call sites, +7/-7) and new `service/runtime-session/recovery-state.ts` (+ barrel and test).
- Item 5 panel: `apps/web/src/features/automation-studio/authoring/BlankFlowAuthoringPanel.tsx` and its test.
- Core `packages/fluxiq/dist` was rebuilt in the worktree (`pnpm build`), because the Lab types against it.

## Downstream files touched

- Owned: `existing-fluxiq-control/publishable-step-value.ts`, `provider-failure/provider-failure-record.ts`, `run-scenario.ts` (one guarded call before `topology.close()`, plus an import), `run-scenario/index.ts`, and new `run-scenario/decision-trace/{index,publishable-tree,read-decision-trace}.ts`, all with tests.
- **In lane t176's `flow-lane/**`**, minimal and self-contained:
  - `flow-lane/terminal-run-wait.ts` (W2, +39/-3; the brief named it);
  - `flow-lane/creation/build-proposal.ts`: optional `evidenceLoop.incompleteDraft`, optional `failure.providerThrow`, and the `THROW_CODE` / `providerThrowCodes` helper;
  - their tests.
  Expect merge overlap with t176.
- Not touched: `bench/**`, `ui-e2e/**` (now t179's), `live-llm/**`.

## Redaction

- The decision trace passes every value through `publishableTree`:
  - it applies the decision-row shape rule recursively (codes, counts and flags only), and step rows go through `publishableStepFields`;
  - members whose names say they hold content (label, value, url, message, reason, summary, token, key, and so on) are dropped whatever their shape;
  - it is bounded in depth (6), width (48) and length (32, or 129 step rows).
- Errors are recorded as category codes, never messages.
- The trace is written into staging before `attestRunRedaction`, so the attestation scans it.
- The provider-throw message exists only in Core's screened diagnostic and the local sidecar, never in the bundle.

## Validation (observed)

- Downstream `pnpm --filter`-equivalent `pnpm check` in `packages/test-runner`: exit 0, against the rebuilt Core dist.
- `pnpm build` then `node --test --test-concurrency=2` over the tests of every directory whose output shape I touched: `flow-lane/creation`, `terminal-run-wait`, `persisted-flow-run`, `harness-recovery`, `existing-fluxiq-control`, `provider-failure`, `run-scenario`, `decision-trace`, `live-llm`, `tests/existing-fluxiq-control`, `run-evaluation`. Result: `# tests 361 # pass 361 # fail 0`.
- The source-order tests for `run-scenario.ts` (`launch-containment`, `runner-wiring`, `single-run-evaluation`, `coordinator-existing`, `scenario-assertions`): 47 of 47 passed.
- Downstream `node scripts/structure-audit.mjs`: `passed (114 warning(s), 120 baselined)`. My first draft failed `failure-as-empty`; I fixed it with an explicit settled result per read.
- Core `vitest run --maxWorkers=2` over `llm/throw-account/tests`, `harness/tests/{throw-screen,run}.test.ts`, `flow-bootstrap/generation-failure/tests` and `service/runtime-session/tests`: 12 files, 396 of 396 passed.
- Core `tsc --noEmit -p packages/fluxiq`: exit 0.
- Core `node scripts/structure-audit.mjs`: `passed (194 warning(s), 355 baselined)`, with "1 baseline entries can be lowered". That entry is not from our files, and the baseline was not updated.
- `apps/web`: `vitest run blank-flow-authoring.test.tsx` gave 26 of 26; `tsc --noEmit` exit 0.
- Core service suites that save run details (`modes`, `durable-patches`, `runs`, `repair-context`, `run-detail-preservation`): 35 of 36 passed on the first run. `modes.test.ts` then passed 4 of 4 when run alone.
  - The first-run failure was a 15.18 s run against the file's 15 s `testTimeout`, while W1 was also testing.
  - With HEAD's `service.ts` a *different* test in the same file timed out at 15.08 s, so the suite is load-sensitive at its ceiling before this change.
  - The `running` save may add about 1 s to "resolves stable and continuous adaptive modes" (11.8 s at HEAD, 13.1 s with the marker).

## Not verified

- No live run.
  - The decision trace has not been observed against a real Core. Its HTTP reads were exercised only with fakes.
  - A throwing recovery writing `threw`, and a real `ECONNRESET` reaching `providerThrow`, are covered by unit tests only.
- The Lab's `persisted-flow-run.ts` does not yet pass the terminal wait's new `recoveryState` into its own record. The same code reaches the bundle through the decision trace, which copies Core's `metadata.recoveryState`.
- `live-llm/observed-usage.ts` still reports `perCallRecords: "not recorded"` for a re-author. The per-call usage is in the decision trace, but that label was not changed because `live-llm/**` is not mine.
- Repo-wide `pnpm test` was not run, per the brief.
