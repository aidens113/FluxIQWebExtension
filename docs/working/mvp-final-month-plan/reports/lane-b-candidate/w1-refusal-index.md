# W1 report: lane B candidate refusal root cause (run-mv0fu9pb-57454dc4, step 0058)

## Outcome

Done. The lead's hypothesis holds, and the reproduction found a second cause. Plan nodes 10 and 17 are script steps 8 ("search for the paper towels", line 32) and 14 ("search for the dinner napkins", line 58). Both are `web.dom-type` with `submit: true` and no `consequences:` line. The node indices are higher than the step positions because every `optional: yes` step assembles into two nodes. The model could not have avoided the refusal: the candidate format text it was given says "A step that types, chooses, waits or reads never needs it." The refusal named only plan node indices, so the model could not find the steps. It guessed the wrong ones, resent the same script, and the repeat guard ended the build.

A provider-free reproduction through the built Core and domain `dist` produces the live refusal exactly, issue for issue and path for path.

## What changed and why

Nothing in either repository. I created these files only:
- `scratchpad/w1/refusal-index.mjs`: the reproduction.
- `scratchpad/w1/probe-exports.mjs`: an export probe.

Full scratchpad path: `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/cbe27898-5d09-40ef-80b5-ee091413766a/scratchpad/w1/`.

### 1. Which steps nodes 10 and 17 are, and why

**How steps become nodes.** Optional steps are expanded before nodes are built. In `assemble.ts`, `assembleAutomationStudioFlowScriptPlan` runs `optionalScriptSteps` first (lines 99-105). For each `optional: yes` step, `optionalScriptSteps` emits the step itself plus a synthetic `builtin.control.merge` join step with `line: 0` (lines 342-344).

**How a node gets its index.** `buildSubflow` then gives each emitted step the path `plan.subflows.<i>.nodes.${nodes.length}` and the key `s<index+1>` (assemble.ts lines 393-401). So the script's 17 steps become 22 nodes: the four optional steps (script steps 2, 3, 4 and 13) each add a Merge.

**Where the path reaches the model.** Core asks the domain about each node in `plan-parameter-resolution.ts`. A domain refusal is recorded at the node's plan path (lines 121-137):

```ts
const path = `plan.subflows.${subflowIndex}.nodes.${nodeIndex}.parameters`
```

`bootstrap-completion.ts:338` wraps that refusal as `flow_bootstrap.evidence_completion_parameters_unresolved`.

**Reproduction output** (`node refusal-index.mjs`), node by node:

| Node | Key | Node type | Script step |
| --- | --- | --- | --- |
| 0 | s1 | browser-navigate | step 1 |
| 1, 3, 5 | s2, s4, s6 | dom-click | optional steps 2, 3, 4 |
| 2, 4, 6 | s3, s5, s7 | merge | joins after those optional steps |
| 7 to 9 | s8 to s10 | dom-click | steps 5, 6, 7 |
| **10** | **s11** | **dom-type, submit=true, consequences undefined** | **step 8, line 32, "search for the paper towels" (REFUSED)** |
| 11 | s12 | dom-click | step 9 |
| 12 | s13 | dom-check | step 10 |
| 13 | s14 | dom-type, submit=false | step 11, the quantity field (not refused) |
| 14 | s15 | dom-click | step 12 |
| 15 | s16 | dom-click | step 13 (optional) |
| 16 | s17 | merge | join after step 13 |
| **17** | **s18** | **dom-type, submit=true, consequences undefined** | **step 14, line 58, "search for the dinner napkins" (REFUSED)** |
| 18 to 20 | s19 to s21 | dom-click | steps 15, 16, 17 (step 17 optional) |
| 21 | s22 | merge | join after step 17 |

### 2. The rule, and what the model was told

**The rule.** It is the downstream domain's, not Core's. `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts:109-112`:

```ts
export function webPlanStepMustDeclare(nodeDefinitionId: string, parameters?: JsonObject): boolean {
  return COMMITTING_NODE_IDS.has(nodeDefinitionId)
    || (nodeDefinitionId === webAutomationOutputNodeId("web.dom.type") && parameters?.submit === true);
}
```

`webPlanStepPermission` returns `undeclared` when nothing was declared and the step must declare (line 129). `resolve-plan-node.ts:443` turns that into the two codes `web.step.consequences_undeclared` and `web.step.expected.consequences_classes_or_none`.

**Why the quantity step passed.** The quantity `dom-type` has no `submit`, so `mustDeclare` is false. Only a type that also sends the form counts as committing, because sending a form is a press.

**The format text says the opposite.** Core `flow-bootstrap/plan/flow-script-format.ts:141` reached the model verbatim (0057 `request.txt` line 1967):

> A step that presses something says what pressing it would lastingly do: `consequences: <classes>`, from move_money, delete, send_or_publish, modify_existing, create_new, comma separated; `consequences: none` when it only reveals, opens, expands, filters, sorts, ticks, dismisses or navigates. Every press needs the line, and it says what that one press would cause, not what the Flow is for: the press that applies a filter is none, the press that publishes is send_or_publish. **A step that types, chooses, waits or reads never needs it.**

**No catalog or example says otherwise.** The `dom-type` catalog entry (0057 line 125) says only: "With submit set to true it then sends the field's form, as pressing Enter does: a search typed and sent in one step." It does not mention declaring consequences. I found no example in the format with `submit: true` and a `consequences:` line.

**Exploration declared it, the script dropped it.** Every exploration `run_node` call that typed with `submit: true` declared `"consequences": []` (steps 0018, 0028, 0034, 0040, 0042, 0046, 0054 and 0056, line 13 of each `call.json`). The model then followed the format text and left the line off in the script.

### 3. What the model was told in 0059 and 0061

`0059-decide/request.txt` lines 1452-1470, the same in 0061 at 1459-1469 and 1563-1573:

```
refusal: flow_bootstrap.evidence_completion_parameters_unresolved
issues:
  - code: web.step.consequences_undeclared
    path: plan.subflows.0.nodes.10.parameters
  - code: web.step.expected.consequences_classes_or_none
    path: plan.subflows.0.nodes.10.parameters
  - code: web.step.consequences_undeclared
    path: plan.subflows.0.nodes.17.parameters
  - code: web.step.expected.consequences_classes_or_none
    path: plan.subflows.0.nodes.17.parameters
previous: |  <the whole script>
```

After that come the generic instruction and the `next` text.

**Nothing names the step.** There is no step name, script line or step position. These codes are not in `AUTHORED_CODES` and are not handle codes, so `issue-feedback.ts:156-174` attaches no message, no `accepted` shape and no `handles`. Plan nodes assembled from a script carry no line or description (`assemble.ts:504-517`), so feedback has nothing to name them with. "Node 17" does not exist in a 17-step script under either 0- or 1-based counting.

**The model guessed the wrong steps.** In 0059 and 0061 it said it was "declaring consequences on the store-set and napkins add-to-cart presses". Those are script steps 7 and 16, which already declare `modify_existing`. It then resent the script unchanged. I checked with Python that 0060's script is identical to 0058's.

### 4. How the build ended

1. 0058 and 0060 ran and were refused `parameters_unresolved`.
2. 0062, 0064 and 0066 were refused before running as `llm_evidence_loop.repeat_refused`. The 0062 note reads `refusedInARow: 1, maxRefusedInARow: 3`, and `then.resultCode` is `parameters_unresolved`. These are handled by `llm/decision-handlers/refused-repeat.ts:34-39`.
3. At the third in a row, `automationStudioLlmEvidenceRepeatStop` (refused-repeat.ts:83-95) hits `AUTOMATION_STUDIO_LLM_EVIDENCE_MAX_REFUSED_REPEATS_IN_A_ROW = 3` (`repeat-guard/feedback.ts:20`) and calls `unusableDecisions.stalled` with `[llm_evidence_loop.repeat_refused]`.
4. `service/flow-bootstrap-commands/candidate-generation.ts:91` maps that through `automationStudioCandidateStallCode` (`service/candidate-failure/stall-code.ts:27-29`). The code is not a reply-shape code, so the result is `flow_bootstrap.evidence_repeat_without_progress`. That code appears in `snapshots/live-llm.json`.

**Should these refusals count?** The guard did the right thing mechanically: an identical script is refused identically every time, so letting it run again only spends decisions. Not counting it would just loop.

The defect is upstream. The refusal gave the model nothing it could act on, so every decision after 0058 was doomed. The repeat note (`then: {outcome, resultCode}`) also does not repeat where the problem was.

My recommendation: keep counting, and fix locatability (§5) so the refusal is actionable. Optionally, when a stall's last real refusal carried only plan-index paths with no step location, record that in the ending as a Core feedback defect, not as the model's failure to progress. I have not designed that part.

### 5. The fix

**Fix A: the false rule in the format (Core). This was the direct cause.**
- **File:** `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/flow-script-format.ts:141`.
- **Change:** replace "A step that types, chooses, waits or reads never needs it." with wording like: "A step that only types, chooses, waits or reads needs none; a step that types and then sends its form (`submit: true`) presses, and needs the line: a search is `consequences: none`."
- **Example:** add a format example with `submit: true` and `consequences: none`.
- **Domain wording too (optional):** add the same rule to the downstream `dom-type` node description in `domain/src/output-nodes/definitions.ts`, around the `submit` parameter (line 256 in `dist`).
- **Fail-first test:** in `flow-bootstrap/plan/tests/flow-script-format.test.ts`, assert that the format no longer contains "types, chooses, waits or reads never needs it". Also assert that it states the line is needed for `submit: true` and that some example step carries both `submit: true` and `consequences:`.

**Fix B: name the script step on every plan-path issue (Core). This is the structural fix.** It is the same class of defect as t356 C3, which named handles but still left the node index.

1. In `authoring/assemble.ts` `buildSubflow`, record for each built node path the script step it came from: `{ line: step.line, step: step.description }`. A synthetic Merge maps to its optional step's line.
2. Return that map from `assembleAutomationStudioFlowScriptPlan`. Carry it on `AutomationStudioFlowBootstrapAcceptance` (`authoring/contracts.ts:178-180`, for example as `scriptSteps`).
3. In `llm/harness-options/bootstrap-completion.ts`, pass the map in `about()` / `RefusalSubject` (lines 266 and 524).
4. In `plan/issue-feedback.ts`, `automationStudioFlowBootstrapIssueFeedback` gets an optional `scriptSteps` input. Each issue whose path starts `plan.subflows.N.nodes.M` gets `step: "<step description>"` and `line: <n>`. These are the model's own words, so no secret risk.
5. Optionally make the domain's refusal positioned (for example `web.step.consequences_undeclared:submit`), so feedback also says why a type step must declare. Fix A covers most of that.

Fail-first tests:
- `flow-bootstrap/plan/tests/issue-feedback.test.ts`: an issue at `plan.subflows.0.nodes.2.parameters` with a step map gives an entry carrying `step` and `line`.
- `llm/harness-options/tests/bootstrap-completion.test.ts`: a script with one `optional: yes` step before a `dom-type` with `submit: true` and no `consequences:`. The binding refuses it as the domain does. Today the refusal feedback names `nodes.3` and no step. After the fix it names `step: "search ..."` and the script line. My scratch script is a ready template for this.

### UI card

"Not done: some steps point at things that weren't seen on the page; 4 things to fix"

**Where the wording comes from:**
- The reason text is in Core `runtime/activity/wording/completion-refusal.ts:9`: `parameters_unresolved: "some steps point at things that weren't seen on the page"`. It is chosen by the tail of the refusal code alone.
- The count is in `runtime/activity/candidate/submission-words.ts:35-39`: `diagnostics.issues.length` gives "4 things to fix".
- The "Not done:" prefix comes from the refused-call or card wording (`activity/decision-answer/refused-call.ts:60` style).

**It misdescribes this refusal in two ways:**
- Every handle resolved; nothing pointed at anything unseen. `parameters_unresolved` covers every domain refusal of a node's parameters, including this undeclared-consequences one, but the words describe only the handle case.
- "4 things" counts issue codes, two per node. Two steps need fixing.

**Suggested fix:** choose the words by issue code, with `web.step.consequences_undeclared` reading something like "two steps that send something don't say what sending does". Count distinct node paths, not codes. Fail-first tests go in `activity/wording/tests/completion-refusal.test.ts` and `activity/candidate/tests/submission-words.test.ts`, following the repo rule.

## Commands run and observed results

- `node probe-exports.mjs` in the scratchpad: all needed exports are `function`. The domain `step-permission.js` exports `webPlanStepMustDeclare` and `webPlanStepPermission`.
- `node refusal-index.mjs`, which feeds 0058's exact `call.json` script through `dist` `acceptAutomationStudioFlowBootstrapResult`, `parseAutomationStudioFlowBootstrapPlan`, `resolveAutomationStudioFlowBootstrapPlanParameters` and `automationStudioFlowBootstrapIssueFeedback`, with the domain's `webPlanStepPermission` as the rule. It printed:
  - `accept ok: true`, `script steps: 17; plan nodes: 22`, plan parse errors `[]`.
  - Resolution issues: `web.step.consequences_undeclared` and `web.step.expected.consequences_classes_or_none` at `nodes.10.parameters` and `nodes.17.parameters`.
  - Feedback JSON identical to the live `result.json` `issues`.
  - The node table in §1.
- Python check: 0060's `call.json` flow is identical to 0058's (`True`).
- No provider key, Lab run or network was used.

## Not verified

- **Handle resolution was stubbed.** The scratch binding treats every handle as resolved instead of running the domain's real `resolveWebPlanNode` with view-history stores. The live run had no handle issues, and the output matches it exactly, but the stub is still a stand-in for those stores.
- **Why 0060 ran.** The identical resubmission ran instead of being refused as a repeat, while 0062 onward were refused. Most likely the repeat guard's page or outcome keying, but I did not trace it.
- **How the model picked steps 7 and 16** from "nodes 10 and 17". Unknown; its response gives no reasoning.
- **Fix designs are untested.** No source was edited and no tests were run.

## Open questions or contradictions found

- **Core and the domain disagree on the rule.** Core's candidate format text (flow-script-format.ts:141) says typing never needs `consequences:`. The domain gate (step-permission.ts:109-112) requires it for `dom-type` with `submit: true`. Core's own comment in step-permission.ts:23-29 says text "not yet submitted" is not a consequence, which agrees with the domain. So the format text is the side that is wrong.
- **Same defect class as t356 C3.** That fix (`issue-feedback.ts:25-32`) added `handles` but kept node-index paths. Any domain refusal on a script with optional steps or repeats will be just as unlocatable until Fix B lands.
