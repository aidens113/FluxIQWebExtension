# Lane D r3 W1: a rate limit absorbed in a passing trial becomes a guarded step in the Flow (design, read-only)

Core root: `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime` (written `core:` below).
Downstream root: `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension` (written `dom:` for `domain/src`, `ext:` for `apps/extension/src`).

## Outcome

Done. This was a read-only design task. I edited no source, ran no build, ran no Lab and ran no tests. G1 and G2 both hold as stated, with one correction that affects the design:

**Correction (C0).** The shape the format teaches today for a slow-down does nothing at runtime. The step after the press is `optional: yes` and closes the notice, then a wait runs with `only after:`. But the run gets past the notice inside the press step's own retry: the extension closes the notice and presses again. So by the time the optional step runs, there is no notice to close, the step is skipped, and the wait never runs. A guarded branch that actually fires has to be an `on retry for <press>` handler, because Core dispatches retry handlers before the backoff wait, while the notice is still on screen. The recommendation below uses that shape.

## What changed and why

Only this report. Findings, then the answers to the three questions.

### G1, confirmed

- On a `yes` verdict, `standingInstruction` (`core:flow-bootstrap/candidate/trial-gate.ts:262-265`) returns `INSTRUCTIONS.yes` ("Complete now ...", :75). `completion()` returns `{ ok: true }` for any yes (:171). The gate never looks at what the passing trial absorbed.
- The feedback does carry the slow-down, but only as prose. Per step it has `absorbed[]` with `askedWaitMs`, `waitedMs`, `paceMs`, `pass` and `row` (`core:service/candidate-trial/absorbed.ts:36-68`). The run as a whole has `paces[]` (`feedback.ts:112-134`). There is no structured flag the gate could act on.
- Promotion keeps only the learned pace. `withLearnedPaces` raises `paceMs` on the matching plan nodes (`promotion.ts:70`, `:91-117`). No guarded step is added and the model is never asked for one.
- The loop guidance (`core:flow-bootstrap/plan/flow-script-format.ts:337`, example `:376-402`) and the state guidance (`:441`) tell the model to adapt after a slow-down. But the passing trial answers "Complete now", so the model never gets a turn to do it.

### C0: why the taught optional-after-the-press shape is inert (inference, high confidence)

- Lane D evidence (`docs/working/mvp-final-month-plan/reports/lane-d-candidate.md:152-158`):
  1. Core attempt 1 of the press was refused (`web.action.rate_limited`, wait hint 5500 ms).
  2. Core waited, then made attempt 2. Inside that dispatch the extension "absorbed blocking_dialog, closing 1 dialog" and pressed again, which succeeded.
  3. The notice was gone when the press step finished.
- So an `optional: yes` close step written after the press finds nothing. It skips on `target_not_found` (`core:executor/step-skip/absent-step.ts:39-41`), and its `only after:` wait is skipped with it.
- What does fire with the notice up: Core runs `on retry` handlers **before** the backoff wait (`core:executor/step-loop/on-retry.ts:8-14`; call site `failed-attempt.ts:144-160`: handler at :145, wait at :159). The notice stays up 12-14 s and the backoff is 5.5 s, so a retry handler's `when:` sees it.
- `on retry for <step>` already exists in the grammar (`script-statements/handler-blocks.ts:1-31`). `then: carry on` resumes the press, which is "returns to the loop".

### G2, confirmed: the model cannot name the notice's controls by handle today

1. **The refused attempt's page view uses throw-away handle numbers.** `failureDiagnostics` in `dom:runtime/adapter.ts:413-437` builds it with `sanitizeWebLlmSnapshot` (:451-458). That numbers elements by position (`dom:runtime/llm-evidence/sanitize.ts:266-269`), not through the Flow-wide numbering (`stable-handles.ts:149-201`, only called from `tools.ts:313`). The adapter has no project or Flow scope (`adapter.ts:79-147`). So `t177` in that view is a per-page index, and the same number may already name a different control in the Flow's own numbering.
2. **That view never reaches the model.** It rides on `metadata.failureEvidence` of the runtime result (`adapter.ts:130`). Core's attempt trace drops `result.metadata` (`core:executor/attempt-trace.ts:23-37`), and nothing under `executor/` or `service/candidate-trial/` reads `failureEvidence`; the only readers are in `llm/harness`. The trial feedback carries codes, `happened`, the screened expected/actual and closed words only (`feedback.ts:99-110`, `absorbed.ts:58-67`). The Lab's step files are where round 1's `DIALOG t177 ... rate_limit` line was seen.
3. **Its handles are never marked as shown.** `printed` is filled only when a domain evidence tool answers (`dom:runtime/llm-evidence/tools.ts:475-477`). `core.test_candidate` is Core's tool, so its answer never passes there. A candidate naming any handle that evidence never printed is refused `not_shown` (`plan-resolution/target-packets.ts:315-324`), which surfaces as `web.handle.unknown`.
4. **The packet store never sees the trial.** It is private to the tools closure (`tools.ts:290-295`), and the adapter's failure snapshot never enters it. So submission cannot resolve a trial-page handle to a selector and identity, or run the fingerprint check at save time (`plan-resolution/identity-guard.ts`).
5. **The in-run repair path is a separate path.** R4b's patch onto a renamed control went through a failure-evidence recapture kept by page key (`tools.ts:620-637`, `retainFailure`). `validateWebRuntimeTargetOverrideEvidence` then built a full fingerprint and applied the shortfall guard (`dom:runtime/llm-evidence/target/override.ts:82-142`). That path only re-points one failed node's existing target (`edit_action_target`), takes a fresh capture, and does not run at candidate submission. It shows that a positional failure packet can yield a sound fingerprint, but it cannot add a new node to a candidate.
6. **The `when:` side already works without a handle.** A `dialog <kind> "<name>"` fact needs no handle (`core:flow-bootstrap/script-statements/fact-condition.ts:88-96`). The domain reads it as "any dialog whose name contains `<name>`", because the role cannot narrow a layer kind (`dom:runtime/facts/query.ts:90-101`). Two gaps: the name is required, but the model is never shown the notice's name; and `DIALOG_KIND` (`fact-condition.ts:51`, `^[a-z][a-z-]{0,39}$`) rejects `rate_limit`, which contains an underscore.

### Q1. Where a passing trial should answer "adapt, then test again"

The service finds the slow-downs and the gate decides what to tell the model.

- **Detection (service).** Add a new `core:service/candidate-trial/slow-downs.ts`. It reads the trace and graph and returns each loop-pass step whose `absorbed` included a slow-down: the asked wait from `failed.fault?.hintedWaitMs` / `retry.retry?.hintedWaitMs` / `automationStudioRetryHintMs`, exactly as `absorbed.ts:45` derives it, and `pass` defined. Each entry is one per node:
  `{ subflowKey, nodeKey, step, label?, control?, askedWaitMs, passes: number[], layer?: "rate_limit" }`.
  - The plan keys come from `metadata.bootstrapSymbolicKey`, as `learned-paces.ts:14-22` reads them.
  - `layer` comes from the retry attempt's `clearedLayers[].kind` (`core:executor/contracts.ts:555`, `node-execution/cleared-layers.ts`). It is a closed word, so it gives the model the kind to write.
  - `feedback.ts` adds this as `slowDowns` on every verdict. It contains no page text.
- **Is the step already guarded? (gate, against the candidate plan).** The gate already has `latest()` (`trial-gate.ts:116`). A slow-down entry counts as guarded when `latest().buildPlan.plan.subflows[*].nodes` holds a `builtin.control.handler` node (`AUTOMATION_STUDIO_FLOW_BOOTSTRAP_STATE_NODE_IDS.handler`, `plan/contracts.ts:20-24`) that meets both conditions:
  - its `parameters.event` is `retry` or `before`;
  - its `parameters.scope` covers the step: `{kind:"nodes"}` whose `nodeIds` include `nodeKey`, `{kind:"subflow"}` in the same subflow, or `{kind:"automation"}` (lowering at `handler-blocks.ts:148-157`).

  Not verified: that the plan's `nodeIds` are plan node keys. A test beside the guard must confirm it, by building a script and reading the plan.

  An optional step after the press does not count as guarded (C0).
- **What the model is told.** The verdict stays `yes`, so promotion and `standing()` are unchanged. The answer gains `adapt: { slowDowns: [...unguarded] }`, `instruction: ADAPT_INSTRUCTION`, `resultCode: "candidate.trial_yes_adapt"` and `resultReason: "retry_allowed"`. Suggested wording for `ADAPT_INSTRUCTION`: "The trial passed, but the site asked the run to slow down at step N on passes ... and the run only got past it by waiting. Before completing, adapt the Flow: an `on retry for <that step>` handler that closes the notice through its way out, waits at least the asked wait and carries on, plus `repeat pace:` of at least that wait. Submit the whole candidate, then test the new revision."
- **Completion hold.** Add `completion(receipt)` for that revision and digest: it refuses `candidate.trial_adapt_required` with the same instruction, **once**. A second completion of the held revision is accepted.
- **Cap: once per build.** The gate is constructed once per authoring loop (`authoring-loop.ts:33`), so a gate field `adaptAsked` makes this once per build. After it is set, every later yes answers "Complete now" as today, whether or not it is guarded. There are at most two extra turns, and it cannot loop.
- **Fallback if the build ends without completing.** The held revision's standing is still yes. If it is still the latest revision when the loop ends, `promoteAutomationStudioCandidateTrial` proposes it with the learned paces (`promotion.ts:53-82`).
- **Open risk.** If the model submits an adapted revision that then fails, the earlier yes is lost, because promotion uses only the latest candidate. See open questions.
- **Tests that pin today's text.** No test pins `INSTRUCTIONS.yes` verbatim (grep for "Complete now" finds only `trial-gate.ts`). `candidate/tests/trial-gate.test.ts` pins the other instructions (:82, :115, :126, :160, :188-257). It needs new cases. `authoring-loop.test.ts` yes→complete flows carry no `slowDowns`, so they should be unaffected; re-run them.

### Q2. Options for the dismissal (the guarded branch's press)

**(a) Show the refused attempt's dialog controls, with resolvable handles, in the trial feedback.** Sound only after five changes across both repos:
1. The adapter gets a Flow scope and restamps the failure snapshot through the Flow-wide numbering. Otherwise `t177` can collide.
2. The packet store is shared out of the tools closure so the trial view enters the view history.
3. Core's trace carries `failureEvidence`.
4. The feedback prints the layer's control lines, which is new page text in trial feedback.
5. A domain hook marks those handles as printed when Core shows them.

The saved element would get a full fingerprint and the existing identity guard. But a transient notice's "OK" may be refused as `web.handle.unidentifiable`. It is also more fragile: the button must be in the one refused attempt's snapshot, and handle numbers must line up between the trial and the submission. Large and risky.

**(b) A handle-free step that presses the way out of a layer of a named kind.** This reuses the guarded clearing the extension already ran live in this trial:
- the challenge guard, the anchored allow-list and the consequential-word check (`ext:content/action-runtime/interference/clear.ts:14-38`);
- `press-guard/` and `pressableWayOut`;
- `layerKind` (`layer-kind.ts:44-50`).

The new extension piece is small: from `overlaysOverPage()`, take the first layer whose `layerKind` equals the asked kind (optionally whose bounded text contains a name), press its `pressableWayOut`, and report `clearedLayers`. When no such layer is there, answer `target_not_found` so an optional step skips.

How it fits the rules:
- **Full fingerprint on every saved element:** nothing is saved. The node carries no element, like `navigate` or `wait`, and the press is the same unauthored-control defence the runtime already applies to every node.
- **Names elements by handle only:** the model names a closed layer kind, not an element, and handle-free `dialog` facts are already in the grammar.
- **No per-site rules:** the kinds are the extension's generic classifiers.
- **Guidance never mirrors a scenario:** the example stays on the mail service and moves to the handler shape.

Cost: one new wire action, with the usual protocol fan-out.

**(c) Other.** I considered two:
- (c1) A `web.dom.click` variant whose target is "the way out of dialog X". It needs the same extension and domain work as (b), plus special cases in click resolution, the press guard and the fingerprint save guard. It mixes responsibilities into click. Rejected.
- (c2) A handler body with only a wait, leaving the extension's in-dispatch clearing to dismiss the notice. That is zero new action, but the saved Flow would not show the dismissal, so it falls short of the user rule. Rejected, though it is a usable first step if (b) slips.

### Q3. Recommendation: (b), a `web.dom.dismiss_layer` action inside an `on retry` handler, plus the G1 gate change

The script the model should write (format example, mail service, no scenario):

```
step archive: archive the message
  node: web.dom.click
  target: t21
  consequences: modify_existing
  repeat over: messages
  repeat pace: 6 s
on retry for archive: the mail service asks the run to slow down
  when: dialog rate-limit
  step: close the slow-down notice
    node: web.dom.dismiss_layer
    layer: rate_limit
    consequences: none
  step: wait as long as the service asked
    node: builtin.timing.wait
    duration: 6
    unit: seconds
  then: carry on
end
```

Not verified: that `for <label>` scope works on a step inside a `repeat over` span. The `on before everywhere` loop example at `flow-script-format.ts:467-488` suggests handlers coexist with spans. The W-B example-build test proves it or exposes it.

**Work partitioned by file** (Core-paired task; Core edits need the boundary alert first):

| Worker | Files (own) | Change | Tests to extend |
| --- | --- | --- | --- |
| W-A Core gate | `core:service/candidate-trial/slow-downs.ts` (new), `feedback.ts`, `service/candidate-trial/index.ts`; `core:flow-bootstrap/candidate/slow-down-guard.ts` (new), `trial-gate.ts`, `candidate/index.ts` | `slowDowns` in feedback; guarded detection; adapt answer, one-shot hold, `adaptAsked` cap | `service/candidate-trial/tests/feedback.test.ts`, new `tests/slow-downs.test.ts`; `candidate/tests/trial-gate.test.ts`, new `tests/slow-down-guard.test.ts`; re-run `authoring-loop.test.ts` |
| W-B Core format and fact | `core:flow-bootstrap/plan/flow-script-format.ts` (replace :337 and the :376-402 example with the handler shape; amend :441); `core:flow-bootstrap/script-statements/fact-condition.ts` (`dialog <layer-kind>` with the name optional when the kind is a layer kind; accept `rate-limit` and save `rate_limit`) | guidance matches C0 | `plan/tests/loop-format.test.ts:103-130` (pins the t378 text and example), `plan/tests/flow-script-format.test.ts` (examples block ~:322), `script-statements/tests/` fact cases, `tests/model-facing/tests/handle-only.test.ts` (must stay green) |
| W-C domain | `dom:actions/types.ts`, `schemas.ts`, `safety.ts`, `consequence-declaration.ts`; `dom:output-nodes/definitions.ts`, `payloads.ts`; `dom:runtime/llm-evidence/plan-resolution/step-permission.ts` and `resolve-plan-node.ts` (no target required for this node); `dom:runtime/facts/query.ts` (read the saved `target.role` as `dialogKind` when it is a layer kind; name optional) | new action contract; dialog-kind fact | `actions/tests`, `output-nodes/tests`, `plan-resolution/tests`, `runtime/facts/tests` beside each |
| W-D extension | `ext:shared/protocol.ts`; `ext:content/actions/execute.ts`; new `ext:content/action-runtime/interference/dismiss-layer.ts` and the barrel `index.ts`; `ext:panel/copy/step-copy.ts` | press the way out of the named-kind layer with every existing guard; report `clearedLayers`; `target_not_found` when absent | `content/action-runtime/interference/tests/` (new dismiss-layer cases: challenge untouched, accept refused, kind mismatch skipped) |
| Docs | `docs/architecture/` wire-protocol and action catalog entries | required by AGENTS.md for a wire change | n/a |

**Order.** W-C defines the action id and payload first. W-D, W-A and W-B can then run in parallel, since they touch no common file. W-B's example test needs the node in its registry fixture, and it can declare that in its own test fixture.

**Size.** About 22 files: roughly 350 source lines and 450 test lines.
- W-A: about 180 lines plus 220 test lines.
- W-B: about 60 plus 80.
- W-C: about 90 plus 100.
- W-D: about 70 plus 80.

## Commands run and observed results

Reading only:
- I used `cat`, `sed -n`, `grep -rn` and `ls` over the files cited above in both trees, and read `lane-d-candidate.md:140-166` from the working-doc reports.
- `grep -rn "failureEvidence"` over Core `src` matched only under `llm/deepseek` and `llm/harness`, so the executor and trial service do not read it.
- `grep -rln "Complete now"` matched only `trial-gate.ts`, so no test pins the yes text.
- I ran no tests, builds or Lab commands, as the brief required.

## Not verified

- That handler `scope.nodeIds` in the candidate plan are plan node keys, which the guard detection relies on.
- That `on retry for <label>` resolves on a step inside a `repeat over` span and keeps the span intact.
- That the trial feedback lists handler body steps, so the model can see its branch ran.
- That the rate-limit notice in lane D's fixture has a way out that `pressableWayOut` accepts. The live trial's "closing 1 dialog" suggests it does.
- C0 is inferred from the report and the executor code, not from a fresh trace.

## Open questions or contradictions found

1. **The taught slow-down shape is inert (C0).** The t378 guidance and example (`flow-script-format.ts:337`, `:376-402`; pinned by `loop-format.test.ts:103-130`) teach a shape that does nothing when the run absorbs the notice inside the press's retry, which is what happened live. Replacing it is part of W-B.
2. **A held yes can be lost.** Promotion only looks at the latest candidate's standing (`promotion.ts:53-57`). If the adapted revision fails and the build ends, the held revision's yes is lost. A follow-up could make promotion fall back to the newest revision judged yes, with the same digest checks. The supervisor should decide whether that belongs in this task.
3. **The fact grammar cannot name the rate-limit kind.** `DIALOG_KIND` rejects underscores, so the domain's `rate_limit` kind cannot be written today, and a `dialog` fact demands a name the model never sees. W-B and W-C add a name-less fact by layer kind; that is a contract change on both sides.
