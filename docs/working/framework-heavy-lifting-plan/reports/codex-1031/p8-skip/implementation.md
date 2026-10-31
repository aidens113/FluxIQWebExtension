# t825 skipped-act implementation

Status: Done; source frozen after named tests. Worker owns only the implementation brief's paths in `C:/Users/osrs_/FluxStuff/fxwork/t825/!FluxIQ`; lead owns independent verification and integration.

## Reproduced red

`pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/tests/safe-state-routing-run.test.ts --maxWorkers=2 --minWorkers=1` -> exit 1; 4 tests, 2 existing passed, 2 new failed.

Both new actual graph cases register canonical native commit/observe definitions and first prove the exact failure record is accepted: `{ category: "target_not_found", code: "example.target.missing", retryable: true, stage: "target_resolution", effect: "ambiguous" }`. Host effect settlement would answer unknown. Both dispatched the commit once, dispatched the onward node once, called effect settlement zero times, reached `[apply, onward, end]`, and had no `run.outcome_uncertain`. The optional case rewrote the failed act as `target_absent`; the nonoptional case rewrote it as a forward `state_routed` attempt. The two original safety cases remained passing. This is a dispatched, parser-valid graph bypass, not a parser/import/fixture failure.

Cause: category-only missing-target admission reaches automatic optional/state routing before failed-attempt settlement. The bounded shared guard will make the existing graph call fall through to that settlement; no graph ordering rewrite is planned.

## Ownership

The existing common owner `executor/tests/safe-state-routing-run.test.ts` is extended because that test directory already has 25 files. Lead approved raised-risk extraction at `executor/defensive/explicit-lasting-risk.ts`, the existing defensive barrel export, and unchanged delegation from `node-side-effect.ts`.

## Result and exact seam

The two reproduced bypasses now stop after one native committing call, with zero onward calls and one effect check. An unknown check produces `run.outcome_uncertain`, retains the original failed record, and never creates a successful skip or automatic state route. No graph-run ordering change was needed: its existing CouldNotRun admission now rejects unsettled evidence and falls through to the existing failed-attempt settlement.

Existing `automationStudioSkippedStepDoesAct` now accepts this additive signature:

```ts
automationStudioSkippedStepDoesAct(
  node: Pick<AutomationStudioFlowNode, "label" | "parameterValues" | "metadata">,
  actionEffect?: AutomationStudioResolvedActionEffect
): boolean
```

The node fields remain optional. A supplied floor is strictly read, including null/false/malformed values that must throw rather than become legacy fallback. Known commit/known consequence classes mean notDone regardless of benign dismissal words, model observe/idempotent/safe claims or empty declarations. Explicit authored lasting risk raises a known state/observe floor. Otherwise known state/observe ignores alarming words. An undefined contract retains the exact old control-before-label behavior, including metadata-bearing callers; the new risk predicate does not change that legacy fallback.

`decideAutomationStudioStateRoute` calls the canonical callback with the current node and the identical current raw parameterValues object (or `{}` when absent). It does not consume the node-ID cached floor. Same-ID true→false and false→true orders, default false, and unresolved bindings with false fallbacks are covered. Unresolved remains conservatively committing even if the run inputs could resolve false; this bounded trace annotation neither dispatches an act nor makes an optional skip fatal.

New internal helpers:

- `automationStudioNodeExplicitLastingRisk(node)` extracts the existing safe-state veto unchanged; the existing NodeRepeatIsSafe delegates to it. It reads declared nonempty consequence strings, destructive/external/approval flags and explicit legacy mutate markers. Model metadata.actionEffect is never authority.
- `automationStudioTargetFailureProvesUnacted(attempt)` is the one shared automatic-routing eligibility predicate. CouldNotRun, AbsentStepSkip, direct state-route decision and the step-loop state-route entry all use it. Strong ambiguous/after-action/landed/unknown/held/skipped/terminal child-uncertain evidence cannot become optional success, a matching route or an On Retry handler admission. A later positive not_landed supersedes the original ambiguous failure/fault; terminal child uncertainty and already-held/skipped attempts remain ineligible. Genuine pre-target absence/synthetic notShown remains admissible.

Positive recorded own-effect handling is unchanged: only literal true passes the host witness, then existing unbound-output and progress guards apply. True routes as effect_holds without notDone; missing/false/malformed/throwing witnesses keep notDone for a known commit. A contradictory ambiguous attempt cannot use even a positive route witness before effect settlement.

`notDone` remains trace-only and nonfatal. The actual native unacted optional commit test succeeds after one call with skipped/notDone, no fault and no recovery decision. Positive landed continues after one native call; positive not_landed permits the second call to succeed. The framed handler tests hold unknown at one call and allow not_landed → handler → retry. Original legacy and downstream trace/projection assertions are unchanged.

## Exact changed paths

All Core paths below are relative to private Core `packages/fluxiq/src/programs/automation-studio/runtime/`:

- `executor/step-skip/act-not-done.ts`
- `executor/step-skip/absent-step.ts`
- `executor/state-routing/decision.ts`
- `executor/state-routing/could-not-run.ts`
- `executor/step-loop/state-route.ts`
- `executor/defensive/explicit-lasting-risk.ts` (new)
- `executor/defensive/index.ts`
- `executor/defensive/node-side-effect.ts`
- `executor/target-evidence/unacted.ts` (new; relocated after lead depth audit)
- `executor/target-evidence/index.ts` (new; relocated after lead depth audit)
- `executor/step-skip/tests/act-not-done-effect.test.ts` (new)
- `executor/state-routing/tests/typed-skip.test.ts` (new)
- `executor/target-evidence/tests/unacted.test.ts` (new; relocated with its owner)
- `executor/step-loop/tests/state-route.test.ts`
- `executor/tests/safe-state-routing-run.test.ts`

This MAIN downstream `p8-skip/implementation.md` is the worker report. No downstream source, version/exports, shared memory, architecture, native executor, permission, failure-parser or source re-find scheduling file was edited by this worker. The two original common graph test cases and all original assertions were retained; executor/tests stays at 25 files. No baseline was changed.

## Green validation

Commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t825/!FluxIQ`. Vitest resolved to source; max2 workers, no provider/browser calls.

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/tests/safe-state-routing-run.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/act-not-done-effect.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/act-not-done.test.ts src/programs/automation-studio/runtime/executor/defensive/target-evidence/tests/unacted.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/typed-skip.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/could-not-run.test.ts src/programs/automation-studio/runtime/executor/step-loop/tests/state-route.test.ts --maxWorkers=2 --minWorkers=1
```

Observed exit0: 8 files, 58/58 tests passed, 29.17s. Counts per named file in command order: 8,12,15,4,6,5,3,5. The common graph file includes both original cases, the two formerly failing parser-valid graph cases, unacted optional truth, positive landed/not_landed, and a separate parser-rejection case. The latter proves target_not_found at verification is rejected as a record: a native call still occurred, but the invalid record is not admitted as target absence, no onward action occurs, and the trusted commit remains uncertain. It is not claimed as a category-routing bypass.

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/step-skip/tests/absent-step.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/optional-failed-route.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/guarded-group-run.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/decision.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/routed-attempt.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/announcement.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/safe-routing.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/skipped-values.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/progress-guard.test.ts src/programs/automation-studio/runtime/executor/tests/state-routing-run.test.ts src/programs/automation-studio/runtime/executor/target-reacquire/tests/stale-failure.test.ts src/programs/automation-studio/runtime/route-state/signatures/tests/signatures.test.ts src/programs/automation-studio/runtime/service/summaries/tests/skipped.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/feedback.test.ts src/programs/automation-studio/runtime/service/candidate-trial/tests/landed-acts.test.ts src/programs/automation-studio/runtime/result-verification/tests/result-summary.test.ts src/programs/automation-studio/runtime/llm/harness/tests/context-packet.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/assess.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act.test.ts src/programs/automation-studio/runtime/composite-execution/tests/child-uncertainty.test.ts --maxWorkers=2 --minWorkers=1
```

Observed exit0: 20 files, 243/243 tests passed, 49.41s. This covers optional groups/loops, generic routing and its output/progress guards, stale-target timing, strict effect witnesses, skip summaries, trial feedback, landed-act exclusion, result rows, context packet projection, existing fault policy, and actual nested child uncertainty. Total green: 28 distinct files, 301/301 tests.

## Limits and freeze

No types, builds, full suites, provider/API, browser, panel, agents or git actions run. The focused audit authorized during the correction pass is recorded below. Lead owns compiled acceptance, architecture updates, version bump and integration. Malformed floor strict rejection is proven at the helper and direct routing boundary; no new live/native malformed-callback integration case was added. Current-pass specialization for a raw unresolved synthetic skip is deliberately not claimed; raw conservative trace annotation is the accepted bounded choice.

Source frozen after the two passing green commands; lead notified that independent checks/builds may start. No required source work remains in this brief.

## Lead-review corrections and final freeze

Lead independently passed 18 files/200 tests, then reported three structural issues and two fixture type errors. The tree remained frozen during its active checks; corrections began only after release. No runtime semantics changed:

- The risk consumer now imports through `defensive/index.ts`, replacing the cross-directory leaf import. Read-only TypeScript-AST traversal found no runtime return path from that barrel to act-not-done among 134 reachable source modules; the actual import-cycle audit below also passes.
- The new target-evidence subtree moved from `executor/defensive/target-evidence` to `executor/target-evidence`, removing the extra source-depth segment. Its barrel, implementation and closest tests moved together; four consumer imports and the moved contracts-relative imports were updated. The exact changed-path list above is current; the earlier green command records the historical pre-relocation test path.
- Removed nonexistent `flowId` from the childTrace fixture. The legacy metadata fixture now declares the actual metadata object as `NonNullable<AutomationStudioFlowNode["metadata"]>` and reuses that object, so an optional metadata field is not passed as a possibly undefined JSON value. No cast was added.

Post-correction commands:

```text
pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/runtime/executor/tests/safe-state-routing-run.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/act-not-done-effect.test.ts src/programs/automation-studio/runtime/executor/step-skip/tests/act-not-done.test.ts src/programs/automation-studio/runtime/executor/target-evidence/tests/unacted.test.ts src/programs/automation-studio/runtime/executor/defensive/tests/lasting-act-client-floor.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/typed-skip.test.ts src/programs/automation-studio/runtime/executor/state-routing/tests/could-not-run.test.ts src/programs/automation-studio/runtime/executor/step-loop/tests/state-route.test.ts --maxWorkers=2 --minWorkers=1
node scripts/structure-audit.mjs --rule imports --rule import-cycles --rule naming
```

Observed: Vitest exit0, 8 files/58 tests passed in 30.47s. Focused audit exit0: `structure-audit: passed (0 warning(s), 365 baselined).` No baseline/depth budget was changed. The two fixture type corrections still require the lead's typecheck; this worker did not run it.

Final source freeze sent after those checks. Lead may resume independent checks/builds. This report was the only edit after that freeze.
