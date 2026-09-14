# `m-runner-flake-diagnosis` — final-bench startup/fetch flakes

## Outcome

**Diagnosis complete, with one causal result and one bounded fault tree.** B's
W05 failure is an extension-readiness timeout after the fixture, Core, and
Chromium had started. A's W25 `fetch failed` occurred inside `startTopology`,
before that function returned, but the current failure path deletes the
run-owned topology directory and preserves neither the failed request's stage
nor its nested socket code. The exact HTTP operation therefore cannot be
recovered honestly from the accepted bundle.

The observations do **not** have evidence of a shared immediate cause. They
occurred about 2 hours 44 minutes apart, in different campaigns and at
different lifecycle boundaries. Concurrent A/B load or the known host fault
remains a possible common environmental contributor, but free memory did not
fall below 9,798 MiB and neither observation reproduced in its other repeats.

## Evidence examined

- A campaign `bench-mu0zusso-f044675b`, W25 primary Flow repeat 1,
  `bench-mu0zusso-f044675b-c121-a1`: failed from
  `2026-09-14T11:36:02.377Z` to `11:36:56.963Z`, with zero steps, zero
  actions, no `fluxiqExecution`, no process-exit entries, and the closed
  aggregate cause `fetch failed`. W25 primary passed in repeats 0 and 2
  (`l-final-durable-a.md`, Aggregate and Bounded diagnostics).
- B campaign `bench-mu0zuaod-8a35e3d7`, W05 primary recording repeat 0,
  `bench-mu0zuaod-8a35e3d7-c9-a1`: failed from
  `2026-09-14T08:51:55.873Z` to `08:52:45.565Z`, with zero steps and zero
  actions. Both captured process logs contain a readiness line and no
  error/fatal line. The manifest's browser version stayed at the pre-readiness
  fallback `chromium`. Its exact extension SHA-256 equals the successful next
  W05 Flow run's SHA-256; that next run reports Chrome `134.0.6998.35`.
  W05 primary recording passed in repeats 1 and 2
  (`l-final-durable-b.md`, Bounded result summary).
- Process exit code 1 in B is not evidence that either server died first:
  successful neighbouring isolated runs also record code 1 after the normal
  Windows process-tree cleanup.
- No raw event, page, request payload, credential, or fixture secret was read.

## B W05: service-worker readiness

The causal boundary is narrow:

1. `startTopology` starts the scenario lab, waits for its authenticated health
   response, starts Core, waits for Core HTTP and gateway TCP, authenticates,
   creates the disposable project, and returns only after all of that
   (`packages/test-runner/src/coordinator.ts:92-143`). B retained both process
   logs, and both were ready without an error line.
2. `launchBrowser` then successfully returned a persistent Chromium context
   (`packages/test-runner/src/run-scenario.ts:194`, `:525-527`).
3. Before any scenario page or step, `extensionControlPage` looked once in
   `context.serviceWorkers()` and otherwise waited exactly 10 seconds for one
   `serviceworker` event (`run-scenario.ts:204`, `:529`). The recorded error is
   precisely that Playwright wait's timeout, and the fallback browser version
   proves execution never passed line 204 to the CDP version read at line 205.

The artifact itself is ruled out as a deterministic build defect by the
identical hash succeeding immediately afterwards and in 187 other B runs.
The fixture server is also ruled out as the direct cause: its health gate had
already passed. What remains is a cold MV3 registration/start delay, or a
one-off Chromium failure to register the unpacked extension, under concurrent
host load. The runner has neither a longer bounded readiness policy nor safe
diagnostics that distinguish those two cases. The extension E2E fixture uses
the same one-check/10-second wait (`apps/extension/e2e/fixtures/extension-context.ts:147-149`),
so it does not supply a stronger production-ready contract.

## A W25: `fetch failed`

The strongest supported fault tree is:

1. The bundle is initialized before `startTopology`, and `topology` is assigned
   only when `await startTopology(...)` returns
   (`packages/test-runner/src/run-scenario.ts:86-90`, `:138-144`). A has an
   accepted bundle but no topology process exits or copied logs, so the throw
   occurred inside that await, not after topology startup.
2. Scenario and Core HTTP readiness use `waitForHttp`, which catches individual
   fetch errors and ultimately throws the labelled `Timed out waiting for ...`
   `RunnerFailure`, not bare `fetch failed`
   (`packages/test-runner/src/http-control.ts:4-21`). The gateway-initializing
   unauthenticated fetch is explicitly swallowed (`coordinator.ts:116-120`).
3. The remaining fetch boundaries before return are the authenticated control
   operations: login, disposable project creation, and project selection
   (`coordinator.ts:124-135`; `http-control.ts:65-74`, `:80-86`, `:116-141`).
   Each uses `boundedFetch`, but a non-abort transport rejection is rethrown
   unchanged (`http-control.ts:154-168`). Node exposes such failures as outer
   `TypeError: fetch failed`, with the useful socket code commonly nested in
   `cause`.
4. `classifyRunnerFailure` reads only `error.code`, not a nested cause
   (`packages/test-runner/src/failure.ts:57-68`), so the outer TypeError becomes
   `unknown`. Then `startTopology` cleans the processes and deletes the exact
   allocation containing their logs before rethrowing
   (`coordinator.ts:145-149`). Because `topology` was never assigned,
   `runScenario` cannot copy those logs at its normal line 450.

Thus a transient loopback transport failure during one of those three control
operations is the best-supported cause class. The evidence cannot distinguish
connection reset/refusal from another undici transport cause, and it cannot
name login versus create-project versus select-project. Scenario W25 itself is
not causal: no browser, scenario step, or Flow action was reached, and its two
other repeats passed.

## Do the failures share a cause?

Not at the software boundary. B is a post-topology Chromium/MV3 readiness
failure. A is a pre-return Core HTTP control transport failure. They share only
the broad circumstance of two concurrent full benches on this host. That may
increase scheduling and I/O latency, but B's fixed 10-second wait can turn mere
delay into failure while A's bare fetch rejection indicates a transport error,
not merely a slow successful response. Treat them as two hardening items unless
a stress reproduction correlates them with the same host event.

## Smallest safe fixes, partitioned by file

### Extension readiness

- `packages/test-runner/src/run-lifecycle/extension-readiness.ts` (new): own a
  bounded cold-worker readiness function. Check observation zero, wait under a
  named 30-second deadline, accept only a `chrome-extension:` worker, and throw
  `RunnerFailure("extension.worker", ...)` with only timeout, observed worker
  count, and browser-connected booleans. Do not include worker URLs.
- `packages/test-runner/src/run-lifecycle/tests/extension-readiness.test.ts`
  (new): deterministic fake-clock/context tests for existing worker, late event,
  unrelated worker refusal, timeout category/details, and timer/listener cleanup.
- `packages/test-runner/src/run-lifecycle/index.ts`: export the function.
- `packages/test-runner/src/run-scenario.ts`: replace the inline line-529 wait;
  keep side-panel creation after a validated worker supplies the extension ID.
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`: pin the
  lifecycle call before scenario page creation, if source-level ownership tests
  remain the repository convention.

This is intentionally a longer bounded readiness gate, not an automatic whole-
run retry. Retrying the entire recording cell could hide a genuine extension
installation defect and would create a second evaluation policy.

### Startup HTTP diagnosis, then targeted recovery

- `packages/test-runner/src/http-control.ts`: make `boundedFetch` wrap a raw
  transport rejection in a fixed, secret-safe `RunnerFailure` that retains the
  caller's category and an allowlisted stage label plus nested transport code.
  Never persist the URL, body, response text, or raw error message. Add an
  operation identifier argument so login, create-project, and select-project
  are distinguishable. Do not blindly retry project creation: a request whose
  response was lost may already have mutated Core.
- `packages/test-runner/src/tests/http-control-auth.test.ts`: inject nested
  `ECONNRESET`/`ECONNREFUSED` fetch failures at each operation and assert exact
  closed diagnostics and absence of credentials/body values. Cover abort and
  timeout precedence unchanged.
- `packages/test-runner/src/failure.ts` and
  `packages/test-runner/src/tests/failure.test.ts`: as defense in depth, walk a
  bounded `cause` chain for the existing allowlisted socket codes so an undici
  outer TypeError is not `unknown`. This improves category only; it must not be
  used as a substitute for the operation-stage diagnostic.
- `packages/test-runner/src/coordinator.ts`: after the diagnostic identifies the
  operation, add recovery only where idempotence is explicit. Login and project
  selection may receive one bounded transport retry. Project creation needs
  reconciliation by deterministic run-owned project identity before retry, or
  no retry. Preserve a safe startup-failure summary before deleting the run
  allocation.
- `packages/test-runner/src/tests/coordinator-isolated.test.ts` (new, or the
  nearest isolated-topology test directory permitted by the structure audit):
  inject failure at each control stage and prove cleanup, fixed stage reporting,
  no duplicate create, and bounded retry/reconciliation.

The first two HTTP bullets are the minimum justified change now. Recovery
policy beyond them should be selected from a reproduced stage, because the
current artifact erased that distinction.

## Mutation and reproduction plan

1. **Worker deadline mutation:** make the readiness helper ignore a worker
   delivered after 10 seconds but before 30; its late-worker unit test must fail.
   Restore and run the focused lifecycle tests plus the complete test-runner
   suite.
2. **Worker identity mutation:** accept the first service worker regardless of
   protocol; the unrelated-worker test must fail. Restore it.
3. **Transport-cause mutation:** revert bounded nested-cause classification;
   the injected undici-shaped `{ cause: { code: "ECONNRESET" } }` test must
   report `unknown`. Restore it.
4. **Secret-safe stage mutation:** remove the fixed operation identifier or pass
   through the raw request/error; exact-diagnostic and sentinel-absence tests
   must fail. Restore it.
5. **Live narrow stress:** with clean pinned repositories and distinct instance
   labels/run roots, run W05 primary recording and W25 primary Flow alternately
   10 times per worker, with two workers concurrent and the established memory
   guard. Require 20/20 per cell, zero worker-readiness timeouts, zero raw fetch
   errors, and every injected/observed transport failure to carry a closed stage
   and category. Then repeat each cell three times alone; this distinguishes a
   concurrency amplifier from a generally weak lifecycle boundary.

## Verified / not verified

Verified by bounded inspection: both final aggregates and their exact failing
run manifests/evaluations; adjacent successful run metadata; B's process-log
readiness/error counts; identical failing/succeeding extension hashes; and the
source lifecycle and classification paths cited above. No test or Lab command
was run because this brief is read-only and the diagnosis required no generated
artifact.

Not verified: A's exact HTTP operation or nested socket code; whether B's worker
would have appeared after 10 seconds; a causal correlation with CPU, disk, or
the known host fault; and the proposed fixes or stress reproduction. Those are
precisely the observations the added safe diagnostics and narrow live matrix
must supply.
