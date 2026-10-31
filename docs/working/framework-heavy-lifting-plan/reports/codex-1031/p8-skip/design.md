# t825 typed skipped-act consumer

Outcome: Done (read-only design; no runtime reproduction or source edits).
Core source inspected: `C:/Users/osrs_/FluxStuff/fxwork/t825/!FluxIQ`.
Only this MAIN downstream report was written. Setup completion does not release implementation.

## Recommendation

Use the existing canonical `resolveActionEffect` callback to classify an optional absent step's missed act. Keep `notDone` informational and nonfatal. Retain the old word classifier only for absent legacy contracts. Also close the identified unsettled-target routing possibility through one shared eligibility guard, after first reproducing it in an actual graph.

No new effect registry, browser-word parser, model-supplied effect field, skip wire field or permission prompt is needed.

## What current notDone means

- `state-routing/decision.ts` calls `automationStudioSkippedStepDoesAct(node)` before its declared optional skip. That helper currently reads the saved control words, then the label, through the instructed-act vocabulary. “No thanks” can hide a generic committing click; an alarming label can make a read look lasting.
- `state-routing/routed-attempt.ts` turns a declared skip into `status: succeeded`, `route: skipped`, `skipped.reason: target_absent`, with optional `skipped.notDone: true`. It removes the target failure/fault/message. `notDone` does not turn the skip into a fault or consume recovery budget.
- `step-loop/state-route.ts` follows the optional edge. `graph-run.ts` continues without the normal failed-attempt ladder when this returns `next`. `step-loop/success-check.ts` still decides any declared frame success check; without one, a frame can finish succeeded with a notDone annotation.
- Trial feedback explicitly says the step was skipped and what it does was not done; whether the instruction required it remains a judge/task question. Run detail, recent-actions and context-packet projection retain the boolean.
- Every skipped attempt is excluded from landed acts and rows acted on, irrespective of notDone. The act ledger reports skipped/absent. A succeeded skip is execution progress, not proof the requested act was performed.

Therefore a **typed commit dismissal must remain nonfatal but truthful**: an absent generic click labelled “No thanks” or “Close” gets notDone, unless positive evidence already shows its recorded effect. Do not add a hidden dismissal-word exception or fail every such optional step. Existing no-contract dismissal behavior remains the compatibility fallback below.

## Exact typed seam and compatibility

Add an optional second argument, retaining the existing helper name:

```ts
automationStudioSkippedStepDoesAct(
  node: Pick<AutomationStudioFlowNode, "label" | "parameterValues" | "metadata">,
  actionEffect?: AutomationStudioResolvedActionEffect
): boolean
```

Those node fields are optional today, so existing one-argument callers remain valid. The second argument is trusted resolved client data, read with `readAutomationStudioResolvedActionEffect`; it is never read from node/model metadata.

Classification order:

1. Strictly read any supplied floor first. A malformed/contradictory floor throws; it must not degrade into absent legacy data.
2. Known commit or known permission consequences mean the act was not performed, independently of label, model observe/idempotent/repeatSafe claims, or an empty model consequence list.
3. Explicit authored risk raises remain conservative: positive declared consequence strings, destructive/external/approval flags, and the legacy explicit mutate marker. Reuse the existing declared-consequence key. These may raise a state/observe result; benign words and model safe claims cannot erase them.
4. Otherwise, a known state/observe floor returns false without consulting words. `repeatSafe` does not make a commit disappear and is not needed to classify a skipped state setter.
5. Only an absent contract uses the current control-before-label vocabulary fallback. Keep its current tests unchanged.

The compatibility tradeoff is explicit: old clients retain their annotation behavior, including imperfect vocabulary and a false result for unknown/empty legacy words. That result is **not proof of harmlessness**, executability, idempotency or a performed act. Removing the fallback or treating every unknown old step as a commit would be an additional unapproved semantic change.

In `decideAutomationStudioStateRoute`, resolve only after a declared absent path was found:

```ts
const actionEffect = input.options.resolveActionEffect?.(
  input.node,
  input.node.parameterValues ?? {}
);
```

Pass it to the helper, then retain the existing declaredAct/effectHolds branch. Test `undefined` explicitly, not truthiness, so malformed null/false callback values cannot become legacy fallback. Lookup/read exceptions propagate to the existing failed graph boundary: no successful skip and no action dispatch.

### Current-pass provenance

Use the canonical conservative raw lookup for this bounded consumer. Do **not** read the node-ID-only `runState.actionEffects` map: state routing also runs for pre-dispatch synthetic notShown attempts, before that logical pass has replaced a previous loop pass's cached floor.

Raw literal false and genuinely absent false-schema defaults specialize honestly. A raw unresolved binding, including one with a false fallback, remains commit. Do not drop or partially rebuild its slots. For a synthetic skip there is no executed pass whose resolved binding can be borrowed; conservative notDone is a trace-only statement that the step was not executed, not a failure or a claim a lasting act happened. If a bound value could in fact resolve false, this may add a cautious annotation; it cannot fabricate completion. Proven current-pass specialization would require a separate provenance-carrying input, which this unit does not need.

Test same-ID true→false and false→true literal parameter orders, plus unresolved bindings after both prior classes. The canonical raw arguments—not the prior map entry—must determine every decision.

## Positive own-effect evidence

Keep the existing `declaredAct` logic. For a committing optional step with a recorded effect and valid success destination, observe once and call the host's existing `routeEffectHolds`. Its implementation accepts only literal true; absent hooks, throws, false, unknown or malformed answers do not prove the effect.

Literal true still goes through the unbound-output and progress guards and returns `routed/effect_holds`, without notDone. It remains a skipped/state-satisfied step, not a newly performed act. No recorded effect, unavailable observation, negative/unproven witness or refused effect route retains declared/notDone. Do not substitute a matching pre-state, label, expected wording or an empty consequence list for that positive witness.

## Source-traced unsettled-target routing concern

This concern is **not yet reproduced**. The parser distinction matters:

- `target_not_found` at execution/confirmation/verification is rejected by `packages/contracts/src/failure/parse-record.ts`; such an input alone does not demonstrate a real graph bypass.
- The parser does accept `{category: target_not_found, stage: target_resolution, effect: ambiguous, retryable: true, code: example.target.missing}`. Existing stale-failure logic explicitly refuses ambiguous effects, but absent-step/CouldNotRun currently test category alone.
- The direct `decideStateRoute` call before dispatch receives synthetic notShown evidence and is legitimately unacted.
- The actual post-dispatch path in `graph-run.ts:485` also calls `automationStudioStepStateRoute` for CouldNotRun **before** `automationStudioStepFailedAttempt` at line 495. For an optional node, `StepRetryBeforeRouting` immediately returns when `AbsentStepSkip` matches, and the declared skip is then selected. This appears capable of bypassing the committing fault's effect check.
- For a nonoptional node the same state-route wrapper can reach other recorded pre-state matches before the failed-attempt policy. This must be verified separately; do not infer that every record survives parsing or that every On Retry path bypasses settlement.

### First authorized red checks

1. Actual canonical native commit returns the valid record above. Give its node a benign label, hostile observe/idempotent metadata, an optional edge to a counted onward step, and `actLanded: unknown`. Expected safety: one invocation, no onward invocation, effect settlement consulted, outer `run.outcome_uncertain`, no successful skipped attempt. Current source predicts an onward skip; record the actual result before changing control flow.
2. Same valid record on a nonoptional commit, with another node whose recorded pre-state the host matches and a counted forward/backward route. The uncertain act must settle before any different route/handler invocation.
3. Repeat with the invalid after-action-stage target_not_found record and separately with directly supplied attempts carrying verification/landed/unknown/stateHeld/fault.actUncertain. Distinguish parser rejection from direct-helper hardening; do not report rejected records as dispatched bypasses.

## Bounded implementation ownership

After lead authorization, in this order:

1. Add the two red graph cases above in new `executor/step-skip/tests/act-not-done-effect-run.test.ts`, using typed generic fixtures and no browser/provider. Add direct classifier cases in `step-skip/tests/act-not-done-effect.test.ts`.
2. Update `step-skip/act-not-done.ts` and `state-routing/decision.ts` with the typed seam and unchanged legacy fallback/positive witness. Update their existing comments; no new model-facing vocabulary.
3. If the valid-record graph case confirms the concern, add one focused pure shared guard at `executor/defensive/target-evidence/{unacted,index}.ts`, with owning tests. Suggested name: `automationStudioTargetFailureProvesUnacted(attempt)`; its small attempt input includes status/failure plus optional fault, effectCheck, stateHeld, skipped, transitionComparison and childTrace. Use existing typed unacted/stale-evidence rules, not words.
4. Route all automatic absence eligibility through that same guard: `state-routing/could-not-run.ts`, `step-skip/absent-step.ts`, and the directly callable decision boundary. Guard `step-loop/state-route.ts` before it can run On Retry if direct callers can otherwise bypass eligibility. Do not write separate ad hoc ambiguity tests in each caller or introduce a second failure taxonomy.
5. Preserve positive unacted/pre-target missing evidence and synthetic notShown; a positive settled not_landed is unacted. Explicit ambiguous, after-action verification/confirmation, landed/unknown, held/skipped/uncertain and terminal child uncertainty cannot become a declared optional success or a generic state route before effect settlement. A parent's check never overrides terminal child uncertainty. Keep strict positive own-effect-holds behavior for legitimately unacted missing targets. Leave general failure/effect settlement and the source re-find attempt schedule intact.
6. Do not broaden graph-run ordering on source inspection alone. Its existing CouldNotRun call should inherit the shared eligibility rule. If the red graph cases show existing ordering already protects the actual path, retain only demonstrated direct-boundary hardening and compatibility tests.

The added guard is a shared eligibility predicate, not another registry or a blanket change to what legacy labels mean. Its exact precedence must preserve existing stale/unacted cases: terminal child uncertainty and settled/ambiguous evidence cannot be erased by weaker category text; the strict positive not_landed proof remains distinct. No change to failure-record parsing is proposed.

## Named acceptance

- `step-skip/tests/act-not-done-effect.test.ts`: commit under benign/dismissal words; state/observe under alarming words; explicit risk raises; hostile safe claims; malformed floor; literal and unresolved conditional values; old one-argument expectations unchanged.
- `step-skip/tests/act-not-done-effect-run.test.ts`: actual optional commit notDone remains nonfatal on positively unacted absence; optional dismissal truth; positive effect-holds no notDone; two valid-record ambiguity reproductions; no onward/alternate dispatch while uncertain; same-ID raw-value ordering.
- `state-routing/tests/decision.test.ts`, `routed-attempt.test.ts`, `announcement.test.ts`, `could-not-run.test.ts`; `step-skip/tests/absent-step.test.ts`, `optional-failed-route.test.ts`: existing optional edges, status/trace shape, no recovery for eligible absence, no broader matching before unsettled effect.
- `route-state/signatures` owning tests: retain literal-true-only evidence; `target-reacquire/tests/stale-failure.test.ts`: preserve positive unacted/settlement distinctions and re-find timing.
- `service/summaries/tests/skipped.test.ts`, `service/candidate-trial/tests/{feedback,landed-acts}.test.ts`, `result-verification/tests/result-summary.test.ts`, `llm/harness/tests/context-packet.test.ts`: notDone survives projection; skipped steps create no landed act/acted row; optional truth does not become automatic task failure.

A narrow Core typecheck and structure audit are lead integration gates. No version/export change, downstream implementation, full suite or live run is needed for this consumer. Update `docs/architecture/automation-studio/client-action-effects.md` after substantial implementation, under lead ownership.

Validation: read-only `rg`/`Get-Content` source inspection only. No tests, checks, builds, git, source edits, API, browser or panel actions. Runtime bypass, malformed-floor graph behavior and final guard precedence remain unverified until the authorized red/green phase.
