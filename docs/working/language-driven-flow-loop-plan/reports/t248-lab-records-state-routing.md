# t248 — the Lab records state routing (worker report, t248-worker)

Tree: `fxwork/t248/!FluxIQWebExtension`, branch `task/t248-lab-records-state-routing`. Nothing committed.
Core sibling `fxwork/t248/!FluxIQ`: **untouched** (`git status --short` is empty). Per the supervisor's
amendment, Core is read-only for this brief. That amendment replaced brief item 2.

## Outcome

Done for the amended brief. Items:

- (1) The Lab parses `state_routed` and carries it into `persisted-flow-run`, `steps/` and the run summary.
- (2) The store-remembered row is in.
- (3) The existing/clone path counts a skip as skipped.

## What changed and why

The previous worker left some of this uncommitted. I reviewed that work and kept it.

**Previous worker's changes, kept:**

- `apps/scenario-lab/src/scenarios/bigbox-retail/live-tasks.ts`: the row
  `bigbox-retail-pickup-cart-store-remembered-after-creation` (`variantId: "store-remembered"`,
  `variantArmedAfterBuild: true`, form, `PICKUP_CART`, playback-goal). It matches the W4 report character for
  character. `tests/store-remembered.test.ts` gained a test that the row is the base row, armed only for
  playback.
- `docs/architecture/testing-facility.md`: the bigbox-retail table line, worded as W4 gives it. The previous
  worker also added the `NNNN-run-*` folders to the layout and a "playback joins the build's steps" paragraph.
- `flow-lane/skipped-attempt.ts`: `skippedAttemptOf` accepts both of Core's closed shapes:
  - `target_absent {code}`;
  - `state_routed {code, toNodeId, direction}`.

  The key set must be exact, the code must have Core's dotted form, `toNodeId` must pass `attemptNodeId`, and
  `direction` must be `forward` or `backward`.
- `flow-lane/persisted-flow-run.ts`: the outcome gets `stateRouted: {forward, backward}` when the run routed at
  least once.
- `lab-runs/write-playback-steps.ts`: a routed step is written as `status: "skipped"` with summary
  `skipped (state_routed, <code>): routed to <node> (<direction>), …`. Its `meta.json` and `result.json`
  carry the mark with `toNodeId` and `direction`, and the failure is kept only as `observed`. The writer's
  return now has `skipped` and `stateRouted` counts.
- `run-scenario.ts` already spreads `action.skipped` into `playbackSkips`, so `toNodeId` and `direction` reach
  the writer with no change there.

**Added by me:**

- **A skip route counts without a valid mark** (t243 W1 open question 3).
  - New `onSkipRoute(attempt)` in `skipped-attempt.ts`: true for `route: "skipped" | "state_routed"` when Core's
    status is `succeeded`.
  - `persisted-flow-run.ts` `flowAction` uses it, so an attempt whose mark is rejected reads `skipped`, never
    `succeeded`. It loses the mark's detail but keeps the skip.
- **Existing/clone path (item 3).**
  - `existing-fluxiq-control.ts`: `ExistingRunAction` gains `route?: "skipped" | "state_routed"` (only those two
    values are kept) and `skipped?: PersistedFlowActionSkip`. `skipped` is parsed by the same
    `skippedAttemptOf`, so a mark with page text is dropped. The new helper is `runActionSkip`.
  - `run-manifest/action-timings.ts`: `flowActionTimings` writes `skipped` for a `succeeded` attempt that has
    either one.
  - Edited byte-safely: the file contains literal control bytes inside a regex.
- **Barrel and line limit.**
  - `flow-lane/index.ts` now exports `skipped-attempt.js`, which `existing-fluxiq-control.ts` imports through the
    barrel.
  - The new helpers `stateRoutedOf` and `PersistedStateRouted` live in `skipped-attempt.ts`.
  - Reason: `persisted-flow-run.ts` was 798 lines on HEAD and went to 813 with the previous worker's edits,
    which failed the structure audit's 800-line limit. It is now exactly 800.
- **Docs.** `testing-facility.md`, same paragraph, now documents the skip-route rule and the existing/clone
  counting.

## Commands run and observed results

Each heavy command went through `heavy.sh`.

- **Failing first:** `pnpm run build` in test-runner, after the tests were added and before the implementation.
  - Result: 5 TS errors: `'route' does not exist in type 'ExistingRunAction'` in `action-timings.test.ts`
    (lines 52 and 53), and `'skipped'` / `'route'` missing in `existing-fluxiq-control.test.ts` (lines
    478–480). The build exited 2.
  - The persisted skip-route test was not observed failing at runtime; it never got that far because the build
    failed.
- `pnpm run build` (test-runner) -> built.
- `node --test` over the full flow-lane, lab-runs and run-manifest test folders, plus
  `dist/tests/existing-fluxiq-control.test.js` and `dist/tests/existing-flow-run.test.js`:
  - Result: `tests 289, pass 289, fail 0`.
  - An earlier run had one failure: `declared-uploads.test.js` "W17's upload step…", SyntaxError
    `Invalid or unexpected token` while loading the built Scenario Lab registry. Rebuilding scenario-lab fixed
    it (the build cache had logged "stamp unreadable"), and the test passed 4/4 after that.
- `pnpm run build` (scenario-lab) -> built. Then
  `node --test dist/scenarios/bigbox-retail/tests/*.test.js` -> `tests 35, pass 35, fail 0`. That includes the
  new test "the live catalog builds the pickup cart on the base site and plays it back with the store
  remembered".
- `pnpm --filter @fluxiq-web-extension/test-runner run check` -> exit 0.
- `pnpm --filter @fluxiq-web-extension/scenario-lab run check` -> exit 0.
- `node scripts/structure-audit.mjs` (downstream):
  - Before the trim: `FAIL [file-lines] packages/test-runner/src/flow-lane/persisted-flow-run.ts: 813 lines`.
  - After: `structure-audit: passed (157 warning(s), 118 baselined)`.
- No Core commands: Core was not changed.

## Not verified

- No live Lab run and no browser. Nothing has shown Core actually producing a `state_routed` attempt on
  `store-remembered`, or the full path into a real run folder (`get-flow-run-detail` -> `recordEvidence` ->
  `steps/`).
- The test-contracts package was not touched, so its tests were not run. No full suites were run.

## Open questions or contradictions found

1. **Core does not carry `stateRouting` into the run detail** (t243 open item 3). Core's run-detail conversion
   (`runtime/service/summaries/conversions.ts`) carries `skipped` whole, but drops the attempt's `stateRouting`
   record. That record holds `no_match`, `unobserved`, `no_pre_states`, `guard_stopped`, `effect_holds` or
   `routed`, plus counts.
   - Consequence: the Lab can show "routed to X (direction)" for a routed step, but cannot show "consulted state:
     no_match" for a step that then failed.
   - A minimal Core change would put the closed fields `{outcome, candidates, matched, toNodeId?, direction?,
     closeness?}` under `metadata.stateRouting` in that conversion. `reason` must be left out, because it is a
     host sentence that can quote the page.
   - I drafted this with a test and then reverted it when the amendment made Core read-only. A follow-up brief
     would also need a Lab parser for it.
2. **Demo lanes still read a skip as succeeded.** They gate on `actionAttempts.every(status === "succeeded")`
   (`demo-llm-adaptation-readiness.ts`, `demo-llm-exploration-adaptation.ts`, `demo-workspace/*`), and still see
   a skipped step as succeeded, which is the right reading for "every node ended well". Left unchanged; they do
   not count Lab steps.
3. **Watch for stale scenario-lab builds.** test-runner tests that load the Scenario Lab registry fail with a
   SyntaxError when the scenario-lab build is stale or partial. Rebuild scenario-lab before reading that failure
   as a defect.
