# t174-w6: extension start says where it failed and how loaded the machine was

## Outcome

Done. Scope was Lab tooling in `packages/test-runner` only. I made no Lab, browser or Playwright run.

After the user's correction (2026-09-30) the lead removed `machine-load.ts`, its test and its use in `run-scenario.ts`. Cause not established. The machine-load explanation is withdrawn (user, 2026-09-30); root-causing as a product or Lab defect under t174-w7.

## What changed and why

- **New `src/run-lifecycle/machine-load.ts`, exported from the run-lifecycle barrel.** `sampleMachineLoad(windowMs, sources?)` returns `{ cpuBusyPercent, freeMemoryMb, totalMemoryMb, windowMs }`.
  - It takes two `os.cpus()` samples `windowMs` apart and reads `os.freemem()`/`os.totalmem()` once.
  - `cpus`, `freemem`, `totalmem` and `sleep` can be injected for tests.
  - When there are no cores, or no time passed between the samples, `cpuBusyPercent` is `null`.
  - An earlier draft wrapped the `os` reads in try/catch returning `[]`/0. The structure audit's `failure-as-empty` rule rejected that, so the wrappers are gone. Node's `os` reads do not throw.
- **`src/run-scenario/extension-control-page.ts`:**
  - `openExtensionControlPage(context, url, options)` now also retries once, in a fresh tab, when the error is `net::ERR_ABORTED` or "frame was detached" (reason `navigation_aborted`). Before that retry it pauses: 1000 ms by default, injectable through `retryDelayMs`/`sleep`. The crash retry (`renderer_crash`) is kept and does not pause.
  - It returns `{ page, attempts, retried }`.
  - When the last attempt fails, or an error that is never retried occurs (`navigation_failed`), it throws `RunnerFailure("extension.worker", ...)` with details `{ extensionStage: "control-page", attempts, retried, reason, waitedMs }`.
  - The browser's text stays on the message and `cause` only, never in the details.
  - The third argument changed from a positional `maxAttempts` to an options object. There were no other callers.
- **New `extensionControlPage(context, options?)`.** This is the helper moved out of `run-scenario.ts:680`. It times `awaitExtensionWorker` (`workerMs`) and the page open (`openMs`).
  - A control-page failure's details gain `workerMs` and `openMs`.
  - A worker-timeout `RunnerFailure` is re-raised with `extensionStage: "worker"` and `workerMs` added to its existing closed details.
  - I kept the name `extensionControlPage` rather than `openExtensionControl`. The call site `extensionControlPage(context)` is pinned by `guarded-browser/tests/launch-containment.test.ts`, which is outside my ownership, so keeping the name left that test untouched.
- **New `extensionStartFailureDetails(error)`.** It is the closed extractor for both stages and validates every field.
- **`src/run-scenario/index.ts`:** the barrel export line now includes the new exports.
- **`src/run-scenario.ts`: 703 → 702 lines, and every change was made in place.**
  - `awaitExtensionWorker` was dropped from the run-lifecycle import and `sampleMachineLoad` added.
  - `openExtensionControlPage` was swapped for `extensionControlPage, extensionStartFailureDetails` in the run-scenario import.
  - The local helper line was deleted.
  - `extensionStartDetails` is declared on the existing `const flowReported = ...` line. It could not go on the `pairingWaitDetails` line, because `runner-wiring.test.ts` pins that line's exact text.
  - The failure event now carries `...(extensionStartDetails ? { failureDetails: extensionStartDetails } : {})` and `machine: await sampleMachineLoad(500)`.
- **`src/run-lifecycle/pair-extension.ts`:** only the first `connect()` is timed. The pre-approval timeout details gain `firstConnectAnswered: boolean` and `firstConnectMs: number | null`.
- **`src/run-lifecycle/pairing-status-wait.ts`:** `pairingStatusWaitFailureDetails` passes the two fields through only for pre-approval, and only when they are well-formed and agree: answered with a finite ms ≥ 0, or not answered with `null`. Otherwise it drops them and keeps the rest.
- **Tests:**
  - New `run-lifecycle/tests/machine-load.test.ts`.
  - Rewritten `run-scenario/tests/extension-control-page.test.ts` covers: the abort and detached retry with the default and custom delay, the second-failure details, a failure that is not retried, the worker/open timings, the worker stage, and the extractor rejecting malformed shapes.
  - `pair-extension.test.ts` gained two cases: a connect that never answers, and one that answers late with an empty status.
  - `pairing-status-wait.test.ts` gained the pass-through case.
- **`run-evaluation/tests/runner-wiring.test.ts` (outside the files the brief named).** Its test "validates the worker before opening any page" checked that `run-scenario.ts` imports `awaitExtensionWorker` and calls it before `context.newPage()`. Moving the helper, which step 3 asks for, made that impossible. I pointed it at `extension-control-page.ts` instead: it asserts that the spine calls `extensionControlPage(context)`, and that inside it `awaitWorker(context)` comes before `openExtensionControlPage(context`. It is the source-wiring test of `run-scenario.ts`, so I treated it as one of that file's tests.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w6" pnpm --filter @fluxiq-web-extension/test-runner build` was run twice and exited 0 both times ("[heavy] t174 w6 holds b2").
  - The first build ran before the audit fix, so I rebuilt.
  - After the second build, `dist/run-lifecycle/machine-load.js` has 0 occurrences of the removed `read(cpus)`.
- `node --test dist/<file>.test.js` in TR:
  - `run-lifecycle/tests/machine-load`: tests 3, pass 3, fail 0
  - `run-lifecycle/tests/pair-extension`: tests 17, pass 17, fail 0
  - `run-lifecycle/tests/pairing-status-wait`: tests 8, pass 8, fail 0
  - `run-scenario/tests/extension-control-page`: tests 8, pass 8, fail 0
  - `guarded-browser/tests/launch-containment`: tests 3, pass 3, fail 0
  - `run-lifecycle/tests/extension-readiness`: tests 5, pass 5, fail 0
  - `run-evaluation/tests/runner-wiring`: tests 20, pass 19, fail 1. The failure is **not mine**: test 11 ("the redaction attestation scans once Core has stopped...") pins `runRedactionScopes({ ... workspaceWrittenSince: target.mode === "persistent-isolated" ? Date.parse(startedAt) : undefined })`. `run-scenario.ts:609` now reads `workspaceWrittenSince: writtenSince, extensionStorage`, a line my diff does not touch (see `git diff`). It fails the same way without my changes.
- `node scripts/structure-audit.mjs` in DS: the first run failed with `failure-as-empty` on `machine-load.ts:52`. After the fix it printed `structure-audit: passed (120 warning(s), 120 baselined).`

## Not verified

- Live behaviour. No Lab or browser run was made, as the brief required.
- The real Playwright `net::ERR_ABORTED` text is matched by regex against the message quoted from run 12. I have not seen it thrown live.
- I did not run the whole TR suite (`pnpm test`) or `pnpm check`. Only the files above were run.

## Open questions or contradictions found

- `runner-wiring.test.ts` test 11 is already stale against `run-scenario.ts:609`, where the `writtenSince`/`extensionStorage` change landed without updating the pin. The owner of that change should update the pinned string.
- A worker-stage `extension.worker` failure is now published through `extensionStartFailureDetails`. Before this change its details (`timeoutMs`, `observedWorkerCount`, `browserConnected`) were not published at all. This goes one step past the brief, which asked only for the control-page details to be published. All fields are closed integers or booleans.
- `machine` is added to every failure event's `details`. If any evidence-event schema validates `details` keys strictly, check it. The builds and the tests I ran raised no such error.
