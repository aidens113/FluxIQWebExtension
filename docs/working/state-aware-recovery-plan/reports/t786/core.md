# t786-core: stale target re-acquire in FluxIQ Core

Worker report for brief t786-core. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t786/!FluxIQ`, branch
`task/t786-stale-target-reacquire`. No commits, no model calls, no Lab runs.

## Outcome

Partial. D1-D8 are implemented, the acceptance tests are written and pass, the typecheck is clean and
`pnpm docs:check` passes. One check fails, and the cause is outside the paths I own:
`pnpm structure:check` reports `executor/contracts.ts` at 805 lines against the 800-line limit. The file
was 798 lines at HEAD. The stable interface added the `reacquire` field and its import (+7 lines).
I did not edit that file. The rest of the audit is clean (see "Open questions").

## What changed and why

Paths are relative to `packages/fluxiq/src/programs/automation-studio/runtime/` unless they start at the repo root.

New, `executor/target-reacquire/`:
- `binding-path.ts`: `automationStudioReacquireStatePath(flow, value)` returns the run path a `$state` binding
  reads. It resolves `$node.<key>` through `automationStudioNodeOutputReferences`, the same resolver the
  executor uses.
- `lineage.ts`: `automationStudioTargetLineage(flow, node)` (D1). Rows come from an `item` edge from a For Each,
  or from a binding onto `item`/`<loop>.item`/`$node.<loopKey>.item` inside a loop body (the members come from
  `automationStudioActivityLoops`). When loops nest, the innermost wins (fewest members). The loop's items come
  from a wired `items` edge, or else from a `$state` binding in its `items` parameter. Outputs come from a
  `$node.<key>.<output>` binding or a direct `<nodeId>.<output>` run path; the first `element`/`target`
  parameter wins, otherwise the first binding.
- `read-only-source.ts`: `automationStudioReacquireSourceReadOnly(node)`. It requires `effect: "observe"` (in
  metadata or parameters), `!automationStudioNodeMutates` and no `declaredConsequences`.
- `before-attempt.ts`: `automationStudioReacquireBeforeAttempt(maxAttempts)` returns 4 when there are at least 4
  attempts, the last attempt when there are 2 or 3, and nothing otherwise.
- `stale-failure.ts`: `automationStudioStaleTargetFailure(attempt, { actCompleted? })` is the D2 predicate.
- `bound-value.ts`, `candidates.ts`, `source-place.ts`, `source-rerun.ts`, `host-answer.ts`, `gone-attempt.ts`:
  these hold the stale value, the candidates, `returnToSourcePlace`, the internal re-run, the defensive read of
  `reacquireTarget`, and the synthesized gone attempt (D3, D6).
- `step-reacquire.ts`: `automationStudioStepReacquire(ctx, node, retryPolicy)` is the graph-run seam that
  `step-loop/arrival.ts` calls (D2-D6, D8).
- `index.ts` barrel, plus `tests/` (`reacquire-fixtures.ts`, `lineage.test.ts`, `stale-failure.test.ts`,
  `step-reacquire.test.ts`).

Regenerated: `docs/reference/framework-reference.md`, `packages/fluxiq/docs/reference/framework-reference.md` (by `pnpm docs:reference`).

Edited:
- `executor/step-loop/loop-context.ts`: `arrival` gains the optional fields `reacquired?: true` and
  `overlay?: Record<string, JsonValue>`.
- `executor/step-loop/arrival.ts`: calls the re-acquire last, after the readiness gate and the abort check,
  and returns `reacquired` in `arrived`.
- `executor/graph-run.ts`: a gone attempt replaces the dispatch (no notShown, no pace start) and skips state
  routing, so On Retry cannot retry it. The `ctx.arrival.overlay` is laid over `values` for this node's
  dispatch, and `reacquire: record` is stamped on the attempt.
- `executor/step-loop/incident-repair.ts`: `mayAsk` refuses `executor.target.gone`.
- `executor/outside-graph/retries.ts`: implements the `reacquire` callback. It is asked once, after the wait and
  before attempt `automationStudioReacquireBeforeAttempt`, under the same predicate. `found` swaps the dispatch,
  `gone` returns the given result with `attempts` = dispatches made, and a throw counts as `unavailable`.
  `outcome.reacquire` is set whenever the callback was asked. New `outside-graph/tests/reacquire.test.ts`.
- `activity/step/reacquire.ts` (new): `emitAutomationStudioActivityStepReacquire({ nodeId, outcome, sourceLabel })`.
  It emits a recovery `reacquire` with `succeeded` on found and `failed` on gone, and nothing otherwise. The
  subjects are `Found the item from “<label>” again` and `The item from “<label>” is gone`, or "Found the item
  again" and "The item is gone" when there is no label. It is exported from `activity/step/index.ts` and
  `activity/index.ts`, and tested in `activity/step/tests/reacquire.test.ts`, which includes the
  `personFacingTextFaults` guard.
- Repo root `docs/architecture/automation-studio.md`: new paragraph "Stale target re-acquire" right after the
  retry-policy paragraph.

### Exported names a host or the domain calls
- Host implements (already in `host-runtime.ts`): `reacquireTarget`, `returnToSourcePlace`.
- From `executor/index.ts` (via `export * from "./target-reacquire/index.ts"`):
  - `automationStudioTargetLineage`
  - `automationStudioStaleTargetFailure`
  - `automationStudioReacquireBeforeAttempt`
  - `automationStudioReacquireSourceReadOnly`
  - `AUTOMATION_STUDIO_TARGET_GONE_CODE`
  - the contracts types
  - `automationStudioStepReacquire` with its type `AutomationStudioStepReacquired`: the graph-run seam, see the
    open questions.
- Outside a graph: `automationStudioDispatchWithNodeRetries({ ..., reacquire })` with
  `AutomationStudioNodeRetryReacquire<T>`. The callback receives `{ failure, attempt (the attempt about to run), signal }`.
- Activity: `emitAutomationStudioActivityStepReacquire`.

### Decisions I had to make
1. **Stale-code regex.** The design's `/_(stale|detached|renumbered)/` does not match its own example
   `web.handle.stale`. I used whole-segment matching instead:
   `/(?:^|[._:-])(?:stale|detached|renumbered)(?:$|[._:-])/`. It matches `web.handle.stale`,
   `web.handle.renumbered_by_reload` and `x.target_detached`, but not `staleness`.
2. **Missing `reacquireTarget`.** This records `unavailable`/`no_matcher` and the source is not re-run. A throw
   records `unmatched`/`host_failed` and a malformed answer `unmatched`/`malformed_answer`. This follows the
   record contract ("unavailable: no host matcher"), and the behaviour host-runtime.ts describes (retries as
   before) holds either way.
3. **"Definition whose effect is observe".** No definition-level effect exists in Core, so only node
   metadata/parameter `effect: "observe"` counts. Core built-ins with side-effect class `none` (For Each among
   them) are never re-run.
4. **The `output` overlay key** is the full binding path (`<S>.<output>[.<field>]`), not just `<S>.<output>`.
   The resolver's exact-key match then makes the binding read the found value, with or without a field. For
   `$node.s1.element` this is the same as the design's key.
5. **Row markers.** On found, the fresh row inherits the stale row's dataset marker if the run captured one
   (`runState.records.include`), so the saved trace never holds the fresh row raw. The re-run uses its own
   records summary and no `onRecordBatch`, so nothing reaches the dataset. Its `pageEnded` is copied back to
   the run state.
6. **Placement in arrival.** The re-acquire runs last in arrival, after On Before and readiness, so it happens
   "immediately before" the dispatch. A gone item skips state routing (On Retry there could otherwise retry it
   when `maxAttempts > 4`).
7. **Re-run attempt id.** The re-run uses `<source>.attempt.<next number>`. No traced attempt takes that id, and
   the attempt not pushed.

## Commands run and observed results
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  (packages/fluxiq) -> `tsc exit 0`.
- `npx vitest run src/programs/automation-studio/runtime/executor/target-reacquire` -> 3 files, 27 tests passed.
- `npx vitest run src/programs/automation-studio/runtime/executor/outside-graph src/programs/automation-studio/runtime/activity/step`
  -> 12 files, 62 tests passed.
- `pnpm test src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/activity`
  (packages/fluxiq) -> `parallel`: `Test Files 168 passed (168)`, `Tests 1416 passed (1416)`; `real-sql`: no
  matching files; `[vitest-groups] all groups passed: parallel, real-sql`, exit 0.
- `node scripts/structure-audit.mjs` (repo root, i.e. `pnpm structure:check`) -> 1 violation:
  `FAIL [file-lines] .../runtime/executor/contracts.ts: 805 lines exceeds the 800-line limit`. An earlier run
  also flagged barrel reaches, an `as never` and statement packing; all of those are fixed.
- `pnpm docs:reference` -> `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (4235 public declarations)`,
  up from 4220. The 15 additions include the new target-reacquire exports, `AutomationStudioNodeRetryReacquire` and
  `automationStudioStepReacquire`. Both generated reference files are modified in the tree.
- `pnpm docs:check` -> `structure-audit: passed (0 warning(s), 0 baselined).` and `Deterministic framework reference is current.`, exit 0.

## Not verified
- Live browser and Lab behaviour; the domain's `reacquireTarget` and `returnToSourcePlace` do not exist yet.
- Not done: D5's "the re-run's time counts against the node's waiting allowance". The defence ledger only adds
  wait through `record(entry)`, which would add a fault entry to the defence summary.
- No test runs a source re-run under `options.commandRun`, the production command ledger. A throw inside the
  re-run would stop the command run, exactly as a thrown attempt does.
- The full Core suite was not run (twice-a-day rule).

## Open questions or contradictions found
1. **`executor/contracts.ts` is over the line limit (805/800)** because of the stable interface's +7 lines. The
   supervisor needs to cut 5 lines, for example by collapsing the `reacquire` doc comment to one line and
   trimming one more line, or by moving a type out of the file.
2. **`executor/index.ts` re-exports the whole barrel with `export *`, so the graph-run seam
   `automationStudioStepReacquire` (which takes the internal `AutomationStudioStepLoopContext`) is public.**
   It has to be in the barrel because the imports rule forbids `step-loop/arrival.ts` reaching
   `target-reacquire/step-reacquire.ts` directly. `step-loop/` is at its 25-file limit, and a nested directory
   would break the 9-segment depth limit. If this export is unwanted, narrow the `export *` in
   `executor/index.ts`, which is not my path.
3. The design's D3.4 says a missing method counts as `unmatched`, but the record contract says `unavailable`.
   I followed the record contract (decision 2).
