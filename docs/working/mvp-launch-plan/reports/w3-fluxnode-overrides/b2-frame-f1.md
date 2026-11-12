# B2 (t899, W3): F1 root fix, a run's `retries` governs every attempt path

## Outcome

Partial. Everything in the brief is done and tested inside the owned paths. One reader of the
run allowance is outside them: `engine/automation/defensive/ledger.ts:109` still reports the
fixed 300 s as `trace.defence.waitBudgetMs`. The exact change is under Open questions. Absorbing
is not affected, because `automationStudioRunMayStillAbsorb` already reads the scaled value. Only
the reported budget figure is wrong.

## What changed and why (Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t899/!FluxIQ`, pkg = `packages/fluxiq/src`)

- `pkg/engine/automation/retry-policy.ts`: added `automationStudioRunNodeRetryPolicy()`, the
  one frame-aware helper. It returns `maxAttempts = max(4, floor(frame.nodeAttempts))`, so it is
  never fewer than the default and is not held to the 25-attempt declaration bound. Its backoff is
  `frame.retryWaits.backoffMs` (finite and >= 0) when given. With no frame, or a frame that asks
  for nothing, it returns the very `AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY` object.
  `automationStudioNodeRetryPolicy` uses it as the final fallback and as the floor, after
  declarations as before. The `maxRetriesPerAction` cap is `max(floor, …)`, so it is never below
  the run's floor. A Call Subflow container still gets 1. A declaration that names attempts but
  no waits now takes the run's waits (the default when there is no frame).
- `pkg/engine/automation/outside-graph/retries.ts`: `policy = automationStudioRunNodeRetryPolicy()`
  (was the constant). `failedAttempt` now takes `policy.maxAttempts` for the repress trace (was
  the constant).
- `pkg/engine/automation/defensive/retry-wait.ts`: added `automationStudioNodeRetryWaitAllowanceMs()`
  and `automationStudioRunRetryWaitAllowanceMs()`. Each returns the frame's
  `retryWaits.perNodeMs` / `perRunMs` when given; otherwise it returns `60_000*(attempts-1)/3` or
  `300_000*(attempts-1)/3` when the frame's attempts are above 4, and the constants otherwise.
  `automationStudioBoundedRetryWaitMs` and `automationStudioRunMayStillAbsorb` read these. The
  per-wait 30 s bound is unchanged. The constants are unchanged, and they are what applies when
  there is no frame.
  - retry-wait cannot import `retry-policy.ts`, because that would make an import cycle
    (retry-policy imports `defensive/`). So the "sized for 3 retries" figure is a local constant,
    and a test holds it equal to `DEFAULT.maxAttempts - 1` (default+3 attempts doubles both
    allowances).
- `pkg/runtime/run-overrides/**`: the source is unchanged; the exported names and signatures are
  as given. Added `tests/store.test.ts`.
- New and extended tests:
  - `runtime/run-overrides/tests/store.test.ts` (7). Covers: no frame gives undefined; the frame
    holds across awaits and is gone after the run; two concurrent runs (7 vs 5, interleaved with
    `setImmediate`) each read their own; a nested frame replaces the outer whole; the frame is
    cloned and frozen; the Symbol.for registry holds an `AsyncLocalStorage`. Two module copies
    share the store: after `vi.resetModules()` and a dynamic `import("../index.ts")`, the
    function identity differs, a frame set through the original is read through the copy, and
    the reverse also holds.
  - `engine/automation/tests/retry-policy.test.ts` (11). Real `runAutomationStudioGraph` runs of
    an always-503 node:
    - with no frame: 4 calls and waits [250, 1000, 2000];
    - concurrent frames of 7 and 5: 7 and 5 calls;
    - a frame of 6 beats a node declaring 2 and a Flow declaring 3;
    - 10 attempts at 30 s: 180 s of total waiting (the scaled per-node allowance; the old 60 s
      would apply without the scaling);
    - `perNodeMs` 90 s: 90 s of waiting.

    Policy-level cases: no frame or an empty frame returns the default object; a frame of 2
    gives 4; a frame of 101 gives 101 (a document declaring 30 still gives 25); the cap is never
    below the frame; a container gets 1; the frame's waits apply unless declared.
  - `engine/automation/outside-graph/tests/run-overrides.test.ts` (5):
    - with no frame: 4 dispatches and waits [250, 1000, 2000];
    - concurrent frames of 7 and 5 give 7 and 5 dispatches;
    - a frame of 1 still gives 4;
    - the frame's backoff is used;
    - 10 attempts at 30 s give 10 dispatches and six 30 s waits (180 s).
  - `engine/automation/defensive/tests/retry-wait.test.ts`: a new describe (5 tests) for the
    allowances. Covers no frame, a frame at the default attempts, and a frame below it; scaling
    (default+3 doubles both, and 101 attempts); the frame's own figures; the bounded wait and
    `RunMayStillAbsorb` reading the scaled value; the per-wait bound kept.

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t899/!FluxIQ`.

- `pnpm --filter fluxiq exec vitest run src/runtime/run-overrides src/engine/automation/tests/retry-policy.test.ts src/engine/automation/outside-graph src/engine/automation/defensive`
  printed `Test Files 17 passed (17)`, `Tests 166 passed (166)`.
- `pnpm --filter fluxiq exec vitest run src/runtime/run-overrides src/engine/automation/tests src/framework/automation-service/executor/tests/retry-policy.test.ts src/framework/automation-service/executor/lifecycle/tests/budget-ledger.test.ts`
  printed `Test Files 26 passed (26)`, `Tests 285 passed (285)`. That covers the whole
  `engine/automation/tests` tree, including `defensive-policy.test.ts`, and the existing
  no-frame policy tests, all unchanged.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (529 warning(s), 969 baselined).`
  Grepping the output for run-overrides, retry-policy, retry-wait or outside-graph found nothing,
  and there were no cycle or browser-imports findings. An earlier run, before my edits, crashed
  with an ENOENT on `packages/sdk/src/client/overrides-input.ts`, a file a parallel worker was
  writing at the time; the later run did not.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t899-b2 -- pnpm --filter fluxiq exec node --max-old-space-size=6144 node_modules/typescript/bin/tsc --noEmit`
  waited for a slot, took slot-1, and exited 1 with 3 errors. None are in my files:
  - `service/fluxnode/caller-options.ts(51,17)` and `(51,69)`: TS2339, `humanness` is missing on
    `FluxNodeResolvedOptions` (expected).
  - `service/fluxnode/overrides-frame.ts(11,3)`: TS2375. Under `exactOptionalPropertyTypes`, the
    parallel worker's object passes `retryWaits.backoffMs: number[] | undefined` to
    `AutomationStudioRunOverrides`, where `backoffMs?: readonly number[]` does not accept
    `undefined`. This is in service/fluxnode/**, so I left it to its worker (see below).

## Not verified

- I did not edit or test the domain side (`domain/src/runtime/llm-evidence/node-run/retries/*`). It
  reaches `automationStudioDispatchWithNodeRetries` through Core's `dist`, which needs a rebuild
  before the domain picks this up. The two-module-copy test shows that a second copy shares the
  store, but a real panel-bundle plus `dist` run was not exercised.
- No live or browser run.
- I ran no whole-package suites, under the twice-a-day rule.

## Open questions or contradictions found

1. **Requested edit outside my paths** (needed so that "every reader gets the scaled value"
   holds). In `packages/fluxiq/src/engine/automation/defensive/ledger.ts`:
   - line 2: `import { AUTOMATION_STUDIO_MAX_RUN_RETRY_WAIT_MS } from "./retry-wait.ts";` becomes
     `import { automationStudioRunRetryWaitAllowanceMs } from "./retry-wait.ts";`
   - line 109: `waitBudgetMs: AUTOMATION_STUDIO_MAX_RUN_RETRY_WAIT_MS,` becomes
     `waitBudgetMs: automationStudioRunRetryWaitAllowanceMs(),`

   `summary()` is called only at `graph-run.ts:206`, inside the run's chain, so it reads the
   run's frame. With no frame it returns 300 000, so existing tests are unchanged.
2. **A type mismatch for whoever owns `service/fluxnode/overrides-frame.ts`.** It must omit
   absent fields (`...(x === undefined ? {} : { backoffMs: x })`) instead of passing `undefined`.
   The alternative is for the lead to widen `frame.ts` to `?: … | undefined`, but `frame.ts` is
   the stable interface, so I did not change it.
3. The new allowance functions and `automationStudioRunNodeRetryPolicy` are not added to
   `engine/automation/index.ts`, which I do not own. The allowance functions still reach the
   public `fluxiq/automation` surface through `defensive/index.ts`'s `export *`.
