# t174-w60: why playback does not skip an absent sometimes-present step

Brief t174-w60 (lane A lead t174-lead-1002). Investigation only; no source file edited.
Trees read: Core `fxwork/t174/!FluxIQ` at `eed0cc34`, downstream `fxwork/t174/!FluxIQWebExtension` at `3963eabe`.
`R/` = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

Done. There are two gaps, plus a third that would be needed for the full rule.

1. **Core executor.** Playback never observes a step's presence before running it, and never treats an absent
   sometimes-present step as a skip. A failed optional press goes through the full recovery ladder (`retry_node` x2,
   with the chat's "Recovery started") before it follows its `failed -> merge` edge.
2. **Build path.** A dismissal is made optional only when the model says `optional`, or when the dry run finds it
   `unreproducible` and proves nothing later needed it. A dismissal the site remembers comes back `remembered`, which
   passes, so it is deliberately left unmarked (`R/flow-draft/site-memory.ts:33-38`). The comment there says why: the
   web host records nothing at press time about the target's layer.
3. **Not present at all: routing by expected state.** No node carries a recorded pre-state from a build, and nothing
   in the executor compares one with the page to choose a node. This is a larger follow-up and is described last.

Run 38's "Core resolved neither target" is a misreading. `unresolved_no_candidates` is what Core reports for every
web press in a Flow run. The resolver could not have pressed an unrelated control: it presses only an element whose
words, name, label, id or test id equal the recorded ones.

## What changed and why

Nothing changed in source. This report is the only file written.

### Cause chain (file:line)

**a. How a Flow run executes a dom-click node.**

- `R/executor/graph-run.ts:420-476`, the step loop. For each node it:
  - reads the retry policy (`:451`);
  - reads `recordedState` (`:452`);
  - calls `automationStudioAwaitNodeReadiness` (`:456`);
  - executes the node (`:461-469`).
- The readiness gate (`R/executor/ladder-run.ts:166-197`) evaluates only `node.parameterValues.readyState` or
  `node.metadata.readyState` (`R/executor/recorded-state.ts:83-86`). Its result is "a mark, not a failure"
  (`graph-run.ts:453-455`), and an unsatisfied gate still runs the node. **Nothing on the build path writes
  `readyState`.** In Core `src`, only `ladder-run.ts` and `recorded-state.ts` reference it, and both only read it.
  Downstream writes none, and a written step cannot carry it: `bootstrap.unknown_parameter`, at
  `R/flow-bootstrap/authoring/normalise.ts:90` and `assemble.ts:323`.
- So for every node a build makes, page state is **not** observed before the step. The only before-action capture is
  `captureHostState(... "before_action")` (`R/executor/node-execution.ts:144`). That is a snapshot ref for the trace,
  and no decision reads it.
- `expectedState` (`R/executor/expected-transition.ts:9`, `transition-comparison.ts:118-123`) is the post-state the
  node should produce. It feeds only the `skip_satisfied_node` rung after a failure. Builds do not write it either.
- `recordedState` (`recorded-state.ts:41-58`) is read only from recording-derived metadata (`stateLink`,
  `stateSnapshotId`). It is stamped on the attempt and never compared with the page.
- Route state (`R/route-state/router-state.ts:71-79`) is observed only when a run is routed to a subflow at its start
  (`R/service.ts:2671`). `build-routing.ts` shows observed situations to the building model. Nothing in the executor
  reads route state per node.
- On a failed attempt (`graph-run.ts:572`) the run does the following, in order:
  1. `chooseAutomationStudioEdge(..., "failed")` finds the optional step's `failed -> join` edge (`:573`).
  2. It emits **"Recovery started"** unconditionally (`:581`).
  3. It runs `runAutomationStudioRecoveryLadder` (`:582-603`).
- In `R/executor/recovery-ladder.ts`, `retry_node` has priority 4 (`:47`, offered at `:179-187`) and
  `deterministic_path` (the authored failed route) has priority 5 (`:50`, `:82-90`). So while attempts remain, retry
  always wins over the optional's own failed edge. `retryable` comes from the fault assessment
  (`ladder-run.ts:116`). The web host reports `web.target.not_found` as
  `{category: "target_not_found", retryable: true}` (downstream `domain/src/runtime/failure/codes.ts:219`).
- With the default policy of 3 attempts (`R/executor/retry-policy.ts:29-32`) the absent dismissal is dispatched 3
  times. The host spends up to `RECOVERY_BUDGET_MS = 5_000` inside each dispatch looking for the target
  (`apps/extension/src/content/action-runtime/recovery/budget.ts:82`). That is the ~4 s per attempt and ~24 s per run
  in muq66ff9. After that the ladder selects `deterministic_path` (`ladder-run.ts:81`, `graph-run.ts:634-672`).
- The existing test **pins this behaviour**: `R/executor/tests/optional-failed-route.test.ts:58-66` expects
  `["retry_node","retry_node","deterministic_path"]`.

**b. How "optional" is represented and set.**

- On the draft step, `routing: {kind: "optional"}` (`R/flow-draft/routing.ts:124-126`, `step.ts:179`). The model sets
  it with an `optional` amendment (`R/flow-draft/amendment.ts:302`). Core sets it only in the dry-run gate's
  `madeOptional` (`R/llm/node-tools/dry-run-gate.ts:211-230`).
- `madeOptional` uses `automationStudioFlowDraftSometimesPresentStepIds` (`R/flow-draft/sometimes-present.ts:47-74`).
  That requires the outcome `unreproducible` with no `mode` (`:66`), and it runs only when a replay was refused
  (`dry-run-gate.ts:188`).
- A dismissal the site remembers is answered `core.replay.remembered`. It passes and is never made optional
  (`R/flow-draft/site-memory.ts:26-38`): "It is not made `optional` here... no host records it yet... A host that
  recorded the target's layer at press time would let this mark such a step optional itself".
- On the graph, optional is not a flag on the node. It is a shape. `R/flow-bootstrap/authoring/draft-routing.ts:113-126`
  writes `step.failed -> join(merge)` and the step's success falls through into the same Merge. Run muqiho5c edges e1
  and e2 have this shape.
- Plan nodes carry no metadata from the draft step. `AutomationStudioFlowBootstrapNode` (`R/flow-bootstrap/plan/contracts.ts:11-27`)
  has no metadata field, and materialization writes only provenance (`R/flow-bootstrap/adaptation.ts:207-220`). So
  `clearsInterference`, read by `ladder-run.ts:149-151` for the `clear_interference` rung, is never set on a
  build-made node either.
- What the build knows but does not keep:
  - The domain's press handler holds the page before (`current`) and after (`after`), with each element's layer marks:
    `isDialog`, `inDialog`, `covers`, `kind`, `frontLayer` (`domain/src/runtime/llm-evidence/layer-marks.ts:10-27`).
    It also holds the press's target handle (`node-run/run.ts:272`, `:281`).
  - It does not say whether that handle lay in a dialog or front layer, or whether that layer was gone afterwards.
  - The draft statement it returns has exactly `actionId, input, ranWith, effect, proposes, replay, control`
    (`node-run/run.ts:445-461`). Core refuses any other key (`R/llm/evidence-loop-decision.ts:199`,
    `draft.unknown_key`).

**c. Downstream target resolution in playback.**

- **`unresolved_no_candidates` is the normal status.** It is Core's status for every web press in a Flow run.
  `prepareElementTargetAction` and `resolveElementTarget` (`R/io-policy.ts:206-250`) return it whenever the target
  carries no `candidates`, and no downstream code supplies any. Core delegates resolution to the host. It does not mean
  the target was missing (s5 "Confirm" in run 38 was the same).
- **What the host does** (`apps/extension/src/content/action-runtime/resolve-target.ts:250-374`):
  - **Exact strategies first** (selector, coordinates, visual-target, fingerprint). A single exact match is accepted
    only if `vetoExactMatch` corroborates it (`identity/veto.ts:223-235`). Corroboration means at least one of
    `visibleText`, `accessibleName`, `label`, `id` or `testId` agrees at >= 0.92 similarity
    (`identity/corroboration.ts:46,53`). Run 38's s2 "selector 0.703" is such a match.
  - **Scored candidates when every exact strategy missed** (`identity/score.ts:173-210`). The winner needs:
    - a score at or above the floor of 0.35 (`:152`);
    - a margin of 0.2 over the runner-up (`:161`);
    - the same exact corroboration.

    Run 38's s4 (36 candidates, 0.737 against 0.126) is such a match.
- **Could an absent popup's close button match another control?** Only an element whose words, name, label, id or
  test id equal the recorded control's. A truly unrelated control cannot be pressed.
- **The residual risk is generic dismissal words.** A recorded "Not now", "Close" or "OK" with no id or test id could
  corroborate against a different control carrying the same words in another dialog, or in the page itself. Run 38's
  "Close chat" and "Decline optional cookies" are specific enough that the presses almost certainly hit the real
  popups. There is still no screenshot evidence, as the run 38 debug says.
- Nothing in the resolver requires a dismissal's target to be inside a layer.

### Fix for case (1): an optional step whose target is absent (Core `R/executor`)

Smallest correct change, all in Core `R/executor`:

**New module `R/executor/absent-step.ts`**, function `automationStudioAbsentStepSkip(flow, node, attempt)`. It returns
the edge to follow, or `undefined`. It answers only when both of these hold:

- **The node is sometimes-present.** That is either:
  - the optional shape `draft-routing.ts` writes: a `failed` edge into a `builtin.control.merge` that the node's
    `success` edge also reaches; or
  - `node.metadata.sometimesPresent === true`, for case (2) below.
- **The host observed the target absent.** That is `attempt.status === "failed"` and
  `attempt.failure?.category === "target_not_found"`. This is the host's own look at the page, after its in-dispatch
  wait. Not `target_ambiguous`, and not an action that ran and failed.

**`graph-run.ts`, the `attempt.status === "failed"` branch (`:572`).** Before the fault assessment, the "Recovery
started" emission (`:581`) and the ladder (`:582`), call the skip check. If it answers:

- Stamp the attempt as skipped:
  - `status: "succeeded"` and `route: "skipped"`. Core already maps a node result of `skipped` to a succeeded attempt
    (`attempt-trace.ts:17`).
  - A new `skipped: { reason: "target_absent"; code }` field on `AutomationStudioNodeAttemptTrace`
    (`contracts.ts:153-...`).
  - Move `failure` off the attempt, so nothing downstream counts it as a failure.
- Emit a "skipped, not shown" step activity, not "Recovery started".
- Move to the skip edge's target, as `:669-672` does, and `continue`. There is no ladder, no `recordDefendedFault`
  and no budget spent.

**The pre-observation half, three lines at `graph-run.ts:456-460`.** When the node is sometimes-present and has a
`readyState`, and `readiness.satisfied === false`, take the same skip without dispatching. Today no build writes
`readyState`, so this activates only once case (2), or the follow-up, writes a presence condition. The host evaluator
already supports `{kind: "exists" | "absent", selector}` (`domain/src/runtime/expectation/conditions.ts:168-171`).

**New behaviour.** An absent optional dismissal costs one dispatch (the host's own wait of up to 5 s) and no Core
retries. It is not a failure in the trace, the chat or the Lab, and the run goes straight to the join. A present popup
is pressed as before. A non-optional node with an absent target, or an optional node failing any other way, goes
through the ladder as before.

**Tests beside it: `R/executor/tests/optional-failed-route.test.ts`.**

The existing rows pin the old behaviour:

- `:58` "retries the press, then follows its failed route" becomes the failing-first row. The new expectation:
  - the attempts are `["search","check","join","read"]`;
  - the check attempt has no `recoveryDecision`, has `skipped.reason === "target_absent"`, has status not `failed`,
    and carries no `failure`;
  - the dispatcher was called once for `soft-check`.
- `:78` "no budget at all when the subflow budget is zero" must now succeed: a skip is not a recovery and is not
  budgeted.
- `:126-140`, the attempt numbering rows, shrink to 4 attempts.

New rows to add:

- A straight-line node with no Merge diamond and an absent target still goes `retry_node` twice and then stops.
- An optional node failing with `action_failed` still takes the ladder and then the failed edge.
- No "Recovery started" activity for the skip. Capture activity the way `cleared-wait-activity.test.ts` does.
- A `readyState`-carrying optional node whose readiness is unsatisfied is skipped with zero dispatches.

Also run `ladder-run.test.ts`, `recovery-ladder.test.ts` and `graph-run.test.ts` unchanged as regression checks.

### Fix for case (2): a dismissal step the model did not mark (downstream, then Core `R/flow-draft` and the parse seam)

**Downstream: record at press time that the press answered a layer.**

- New module `domain/src/runtime/llm-evidence/node-run/answered-layer.ts`, function
  `webAnsweredLayer(before, after, handle): boolean`. It is true when both of these hold:
  - In `before`, the target handle is an element with `inDialog`, or lies inside a layer. A layer here is an element
    with `isDialog`, a `kind`, or `frontLayer`. Use the same predicate as `covered-target.ts:45-48`, and the
    inside-the-box test of `closersOf` (`:58-75`).
  - In `after`, that layer's handle is gone or no longer marked a layer.
- In `node-run/run.ts:445-461`, add `interruption: true` to the draft statement when it holds, and add the field to
  `WebNodeDraftStatement`.
- Tests in `domain/src/runtime/llm-evidence/node-run/tests/`, a new `answered-layer.test.ts`. Failing first:
  - a press on "Decline optional cookies" inside `DIALOG ... consent`, with no dialog after, gives `true`;
  - a main-page "Confirm" with no layer gives absent;
  - a press inside a consent dialog that stays open (for example "Manage options") gives absent;
  - a press inside a `COVERING` front layer (a chat popup's "Close chat") that is gone after gives `true`.
- Add one row to `run.test.ts`, or to `covered-press.test.ts`, asserting that the statement carries `interruption`.

**Core parse seam: accept and carry the flag.**

- `R/llm/evidence-loop-decision.ts:199`: add `"interruption"` to the exact keys, accepting `true` only.
- `R/llm/evidence-loop/tool-execution.ts`, the `draft` type: add `interruption?: true`.
- `R/llm/evidence-loop/call-record.ts:44-59`: carry it.
- `R/flow-draft/step.ts`: add `interruption?: true`, documented as "the caller says this step answered something that
  stood in front of the page and was gone after it".
- Tests: a parse row in `R/llm/tests/evidence-loop-tool-failure.test.ts`, which already holds the `draft.unknown_key`
  rows, plus a carry row in `R/llm/evidence-loop/tests/authored-draft.test.ts`.

**Core `R/flow-draft`: make interruption steps optional.**

- In `R/flow-draft/sometimes-present.ts`, add `automationStudioFlowDraftInterruptionStepIds(steps)`. It covers a
  proposed step with `interruption === true`, no `acts` and no `routing`, the same exclusions as `:67`.
- Mark those steps `routing: {kind: "optional"}` in two places:
  - in `R/llm/node-tools/dry-run-gate.ts`, before the replay verdict is judged (`:140` and `:219`, the `conditional`
    set), so a remembered or absent dismissal never blocks;
  - in `R/llm/harness-options/bootstrap-completion.ts`, before `assembleAutomationStudioFlowDraftPlan` (`:417`), so
    `draft-routing.ts` wires the diamond and case (1) skips it in playback.
- Rewrite the comment at `site-memory.ts:33-38`, because what it waits for now exists.
- Tests: rows in `R/flow-draft/tests/sometimes-present.test.ts`:
  - an interruption step with no acts gives an id;
  - one with an act claim gives none (also `step_is_optional`);
  - one already routed gives none.

  Add a row in `R/llm/node-tools/tests/dry-run-gate.test.ts`: a draft whose dismissal comes back `remembered` and
  carries `interruption` ends with that step `optional`. Add one in
  `R/flow-bootstrap/authoring/tests/assemble-draft.test.ts` asserting the `failed -> join` edge.

**Downstream playback hardening (optional, closes the run 38 doubt).**

- Carry the layer requirement into the Flow, so that in playback a dismissal's target resolves only to an element
  inside a dialog or front layer. A generic "Not now" can then never match a page control.
- This needs a target-context field written into `ranWith` by `node-run/run.ts`, and a gate in `resolve-target.ts`,
  `gatedPool`/`passesGate` (`:507`, `:543`).
- With case (1), a dismissal whose layer is absent then resolves nothing, is reported `target_not_found` and is
  skipped.
- Tests: `apps/extension/src/content/action-runtime/tests/` for the resolver.

### Where each fix lives

- **Core `R/executor`:** the case (1) skip (`absent-step.ts`, `graph-run.ts:456-460` and `:572`), the trace field
  (`contracts.ts`), and the tests in `optional-failed-route.test.ts`.
- **Core `R/flow-draft` and `R/llm` (seam and gate):** case (2)'s optional marking: `sometimes-present.ts`, `step.ts`,
  the `evidence-loop-decision.ts:199` key, `call-record.ts`, the `dry-run-gate.ts` and `bootstrap-completion.ts` call
  sites. `R/flow-bootstrap/authoring/draft-routing.ts` needs no change; it already wires `optional`.
- **Core `R/route-state`:** nothing for these two cases. It is only used for routing at run start.
- **Downstream:** `node-run/answered-layer.ts`, the `node-run/run.ts` draft statement, and the optional
  layer-scoped resolution in `resolve-target.ts`.

### Lane B's ladder, not step routing

- **Double waiting.** `retry_node` fires on a `target_not_found` that the host has already waited out inside its
  dispatch (`recovery/attempt.ts`, budget 5 s). That doubles the waiting for every absent target, optional or not.
  Whether `retry_node` should be offered after a host-absorbed absence is ladder policy (`recovery-ladder.ts:179-187`,
  `ladder-run.ts:116`).
- **The interference rung never fires.** `clear_interference` (`ladder-run.ts:149-151`) needs `clearsInterference`
  metadata, which no build writes. The `interruption` flag from case (2) is the natural source, but plan nodes carry no
  metadata (`plan/contracts.ts:11-27`, `adaptation.ts:207-220`), so wiring it means a plan-node field. It is ladder
  wiring.
- **Host-side dismissal.** The host itself already closes covering dialogs when a target is missing
  (`recovery/attempt.ts:139`, `interference/clear.ts`). That is the host's own absorber, which interacts with the
  ladder.
- **Chat cards.** The "Recovery started", "Trying the step again" and "The quick fixes didn't help" cards
  (muq66ff9 #18) come from `graph-run.ts:581` and the ladder choice activity (`:605`). Case (1) removes them for
  skips. Their wording for real recoveries is lane B and UI work.

### Follow-up, not the smallest fix: routing by expected state

- The second half of the user's rule needs two things that are absent today:
  - a recorded pre-state on each build-made node;
  - an executor step that, on a readiness miss for a non-optional node, looks along the success path for the first
    later node whose pre-state holds and jumps to it, passing over sometimes-present nodes, before the ladder runs.
- The rule is "when a step's expected state does not match the page, route to the node whose expected state does".
- The domain can write the pre-state from `current` at press time, for example `exists` on the resolved target
  selector, or the dialog and blockedBy names. It needs either a declared `readyState` parameter on web nodes or a
  plan-node metadata channel.
- It belongs in Core `R/executor` as a new `state-routing.ts` called at `graph-run.ts:456`, with its own design brief.

## Commands run and observed results

Read-only `cat`, `sed`, `grep`, `ls` and `wc` over the two t174 trees and the run debugs:

- `fxwork/t195/.../debugs/run-muqilf9s-c3211328.md`, Stages 2-4 and C9;
- `debugs/run-muq66ff9-cb3767a1.md`, `:155-215` and `:435-456`;
- `debugs/run-muqiho5c-e830ce01.md`, `:30` and `:46`.

Observed:

- `grep` for `clearsInterference|readyState` over Core `packages/*/src` (excluding tests and dist) returned only
  `executor/ladder-run.ts` and `executor/recorded-state.ts`.
- Downstream, `readyState` hits are `document.readyState` only.
- No downstream code sets target `candidates`.
- No test, build or Lab was run, because the brief asks for investigation only.

## Not verified

- Whether s2 and s4 in run 38 pressed the real popups. There is no playback screenshot. The conclusion that the
  resolver requires an exact words, name or id match is from code, not from that run's DOM.
- The exact per-attempt duration split in muq66ff9 (host wait against Core backoff). It is taken from the debug's
  figures.
- That `answered-layer`'s "layer gone after" holds for a popup that animates out after the after-capture. It needs a
  fixture check.
- The proposed tests were not written or run.

## Open questions or contradictions found

- **Run 38's C9 wording.** "Core resolved neither target (`unresolved_no_candidates`)" reads as a failure, but it is
  Core's universal status for web presses. The debug should say the host resolved both with corroborated matches.
- **The existing test encodes the old rule.** `optional-failed-route.test.ts:58-66` and `:78-84` encode the
  behaviour the user's binding rule forbids. The fix must change them deliberately, not "fix" the code back to them.
- **A conflict with `site-memory.ts:33-38`.** That comment chose not to mark remembered steps optional for lack of
  layer evidence. Case (2) supplies that evidence. A step the model or the act check says does an instructed act must
  still never be made optional (`step_is_optional`).
- **Attempt status for a skip.** This report proposes `succeeded` plus `skipped`, following the existing node-result
  mapping. If the supervisor prefers a distinct attempt status, `AutomationStudioGraphRunStatus` is shared with run
  status (`contracts.ts:17`), so it would need a separate attempt-status type and Lab and test-runner updates
  (`packages/test-runner/src/flow-lane/persisted-flow-run.ts`).
