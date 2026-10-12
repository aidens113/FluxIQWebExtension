# R4: refused submits and refused decisions (investigation)

Worker report. Investigation only: no source edited.

## Outcome

Done. Both refusals trace to the pipeline, not the model.

1. `evidence_completion_parameters_unresolved` (`web.handle.not_a_control`, then `web.handle.unknown`). By the
   time the model writes the script, the pipeline has removed from its evidence every printing of the popup controls
   it pressed during exploration. For each popup the only handles left are its **text lines marked `gone`**. The model
   copied those, which is what the refusal then rejects. The refusal tells it to "copy the handle the view prints for
   the control itself", but no view the model can see prints one. The rule is right. The evidence and the feedback are
   at fault. Also, **neither resubmit was unchanged.** The model changed the refused handles each time. Both
   refusals still got digest `c140a77e`, because the refusal key ignores handles.
2. `llm_output.invalid_evidence_decision`. In all 9 occurrences across all 81 logged runs (2,728 decisions) the model
   wrote `decision.kind: "callId"` on an otherwise well-formed tool call. The harness rejects any `kind` it does not
   know. The feedback gives the code and the accepted shapes but never says which field was wrong. The shape is
   unambiguous and Core already repairs other wrapper slips, so it should read this decision as a `tool_call`.

Together the two cost 5 wasted decisions in R4a (about $0.0062) and 3 in R4b (about $0.0050), and similar amounts in
every earlier paid run.

## What changed and why

Nothing in source. This report is the only file written.

## Item 1: `flow_bootstrap.evidence_completion_parameters_unresolved`

### Evidence

R4a (`run-mv4dcf2j-cb68009a`) exploration pressed the popup controls, and each press succeeded and changed the page:

| step | callId | handle pressed | its line in the view at the time |
| --- | --- | --- | --- |
| 0010 | close-flash-deal | `t1048` | `t1048 clickable "Close"` (view 0008) |
| 0012 | reject-consent | `t1040` | `t1040 clickable "Reject non-essential"` |
| 0014 | dismiss-notify | `t1088` | `t1088 clickable "Not now"` |

Submits and refusals:
- 0030 wrote `t1049`, `t1034`, `t1086`. These are the popups' text: `"⚡ Flash Deal"`, the cookie paragraph and
  `"Never miss a price drop"`. All three were refused `web.handle.not_a_control`.
- 0032: `find_on_page "Close"` returned 0 matches, because the popup was gone.
- 0034 wrote `t1051`, `t1035`, `t1087`. These are the *other* gone text lines of the same popups (`"09:58"`, `"We value
  your privacy"`, the notification body). All three were refused `not_a_control` again.
- 0036: the same find was refused `llm_evidence_loop.already_answered`.
- 0038: the model dropped all three popup steps, and the submit was accepted.

R4b (`run-mv4dgmki-2b13db91`) follows the same pattern:
- It pressed `t488` "No thanks", `t1040` "Reject non-essential" and `t1081` "Not now".
- 0026 wrote the popup headings `t479` "Welcome back, Mara!", `t1034` and `t1079`. All three were refused
  `not_a_control`.
- 0028 wrote `t484` and `t1036` (never printed, so refused `web.handle.unknown`) and `t1081`. `t1081` was correct and
  was accepted.
- 0030 dropped the two remaining steps, and the submit was accepted.

**The decisive fact:** none of the pressed handles (`t488`, `t1040`, `t1048`, `t1081`, `t1088`) appears anywhere in
the requests that produced the submits (`grep` over `0029/0033/0037-decide/request.txt` in R4a and
`0025-decide/request.txt` in R4b). The only popup handles in those requests are the `gone` lines. For example, R4b
0025 line 280: `- t479 "Welcome back, Mara!" gone`, beside `control: No thanks` with no handle. The model copied the
only handles the evidence gave it for each popup. On its second try in R4a it copied the next `gone` line down.

### Cause (file:line)

- **The view that printed the control is replaced.** Core `runtime/llm/context-window.ts:73-86`
  (`automationStudioLlmEvidenceContextWindow`) replaces every earlier view's keys with `supersededBy`. The page line
  `t488 clickable "No thanks"` existed only in the view before the press, so it disappears.
- **The step's own outcome names the control by words only.** Downstream
  `domain/src/runtime/llm-evidence/node-run/run.ts:461` sets `control: control.name`, which is words, with no handle.
  `node-run/outcome.ts:49-50` declares `control?: string` as "the words the model was shown".
- **What changed lists only text.** `node-run/press-effect/page-changes.ts:64` (`entryOf`) reports went/appeared only
  for text lines, so the pressed control, which also went, is never listed. The removed text keeps its handles.
- **No input in the history.** The evidence entry carries no call `input`, and `core.evidence_history` rows carry no
  input. Nothing the model reads at submit time holds the handle it pressed.
- **The refusal itself.** The domain refuses at `domain/.../plan-resolution/resolve-plan-node.ts:765`
  (`press && resolution.notAControl`). `target-packets.ts:317-319` (`pressedBefore`) lifts the refusal only for a
  handle exploration itself pressed, so text the press *removed* stays refused.
- **The advice.** Core `runtime/flow-bootstrap/candidate/submission-refusal.ts:93` says "Copy the handle the view
  prints for the control itself". `:79-82` (`unknown`) says to "look at that page (go there, then capture it)". Neither
  names the handle the build pressed. Neither mentions `core.recall_result`, which was offered (R4b 0025 request line
  179) and would return the replaced view.
- **Same digest for different scripts.** `submission-refusal.ts:123-129` (`refusalCode`) keys a refusal on
  `code@line` only. R4a's second submit changed every refused handle and still got `c140a77e`, so it counted as the same
  refusal a second time in a row. One more would have ended the build, although the model was correcting each time.

### Proposed general fix

1. **Make the evidence carry the handle (root cause).** `WebNodeOutcome` gets the handle of the control a node acted
   on, beside its words: for example `control: No thanks` plus `acted: t488`, or `control: t488 "No thanks"`. The
   handle is the model's own input token, so no locator or fingerprint reaches the model (t426/t431/t432 hold).
   - Files: `node-run/outcome.ts`, `node-run/run.ts` (lines 448-465 and the written-step path at :362/:369), and
     `node-run/written-step.ts`.
   - Check that Core's draft reader accepts the field. It reads strictly (run.ts:495-497 comment). A separate key is
     safer than changing the `control` string, which chat wording reads.
   - Tests: `node-run/tests/run.test.ts`. A press whose view is later replaced still shows its handle in the outcome.
     The outcome survives `context-window` superseding (Core `runtime/llm/tests/` context-window test).
2. **Safety net in resolution: never refuse what the build caused.** When a press answered a layer (the existing
   `press-effect/answered-layer.ts` `webAnsweredLayer`, run.ts:443), record the handles of that layer's members against
   the control that answered it.
   - Where: `target-packets.ts`. Extend `pressed(scope, handle)` to `pressed(scope, handle, answeredLayerMembers?)`.
   - Then, in `resolve-plan-node.ts:765`, a candidate press on a `notAControl` handle that was a member of exactly one
     answered layer resolves to that layer's answering control.
   - That substitution is reported through the existing assumption channel (`WebPlanNodeOutcome.assumed`, the header at
     resolve-plan-node.ts:257-270), so the accepted answer says, for example, "line 5 names t479, text of the layer
     t488 'No thanks' closed; read as t488".
   - Bounded to layers so that a press which only rewrote page content (a tab, a filter) never redirects text.
   - Tests: `plan-resolution/tests/press-control.test.ts` and `pressed-with-effect.test.ts`. Text in a dismissed layer
     resolves to its closer. Text the closer did not remove is still refused. Two layers claiming one handle are
     refused.
3. **The feedback names the way out.** Where the safety net cannot decide (zero or several candidates), the
   `not_a_control` and `unknown` issues carry the controls this build pressed in the same layer or on the same page,
   by handle and words. Core's advice at `submission-refusal.ts:79-93` adds: "if no current view prints it, the view
   that did is returned by core.recall_result <callId>; the control this build pressed there was tN".
   - Files: the domain issue payload, `plan/issue-feedback.ts` (the issue `handles` field) and `submission-refusal.ts`.
   - Tests: `flow-bootstrap/candidate/tests/submission-refusal.test.ts`.
4. **Count a correction as progress.** Include the refused handles in the `refusalCode` key (`code@line#handles`), so a
   resubmit that changed the refused handles is not "the same refusal". A byte-identical resubmit still keys the same.
   This touches the user's run-of-refusals rule (2026-10-06), so the supervisor should confirm that "refused for the
   same reason" means the same issue on the same value. Test: `submission-refusal.test.ts` (`refused_in_a_row`).

No scenario text is involved. Guidance words stay generic ("the control this build pressed", "the layer it closed").

## Item 2: `llm_output.invalid_evidence_decision`

### Evidence

- R4b step 0017 (iteration 8) raw provider content:
  `"decision":{"kind":"callId","callId":"select-7in1","toolId":"core.run_node","input":{...dom-check t951...}}`.
- R4a step 0021 (iteration 10) wrote the same `kind:"callId"` with `callId:"set-spain"`.
- In both runs the next decision (R4b 0019, R4a 0023) re-sent the identical call, which then ran. Each refusal cost
  exactly one decision, about $0.0017.

Scan of every `*-answer-unusable` step under `~/FluxStuff/lab-runs/` (81 runs, 2,728 decide calls):
- `llm_output.invalid_evidence_decision` occurred 9 times in 7 runs. **All 9 are `kind:"callId"`.**
- 3 also carried `callId` (R4a, R4b, `run-mv0fu9pb` 0048).
- 6 carried only `kind`, `toolId` and `input`, so the model wrote the key name `callId` as the kind's value and left
  out the id: `run-mv0pa79q` 0006, `run-mv2nlh9l` 0012 and 0040, `run-mv2pgqkj` 0050 and 0084, `run-mv35459z` 0012.
- Every one named an offered tool (`core.run_node` or `web.find_on_page`) with a valid input object. All used
  deepseek-flash.

### Cause (file:line)

- Core `runtime/llm/harness/provider-result.ts:209-238` (`validateUnknownEvidenceToolDecision`) accepts only
  `tool_call`, `complete` and `amend_draft`. Anything else falls through to :238, "Evidence decision kind is
  unsupported.", path `response.decision.kind`.
- The normalizer that runs first, `runtime/llm/evidence-loop-decision.ts:388` (`DECISION_KINDS`) and `:424-431`
  (`automationStudioLlmEvidenceNormalizedDecisionResponse`, called from `deepseek/response-envelope.ts:89`), already
  fills in the wrapper's `kind` and `summary` because "the field carries no information". It never looks at the inner
  decision's `kind`.
- Feedback: `runtime/llm/unusable-decision.ts:220-235` returns issue codes and accepted shapes only.
  - `fieldIssues` exists only for a misplaced `write` (:180-182, :210).
  - `ISSUE_INSTRUCTIONS` (:100-116) has no entry for this code.
  - So the model is never told that `decision.kind` was the field at fault, or what it wrote.

### Should the shape be read as a tool call?

Yes. `toolId` (string) and `input` (object), with no `result` and no `amendments`, can only be a `tool_call`:
`complete` requires `result`, and `amend_draft` requires `amendments`. Relabelling relaxes nothing about what the
decision may be. It still goes through `automationStudioLlmEvidenceParseDecision` (evidence-loop-decision.ts:447),
the per-tool input schema and every loop guard. This is the same reasoning the normalizer's header already gives for
the wrapper.

Keep it refused when `kind` is a known kind that contradicts the fields (for example `complete` with a `toolId`), or
when the decision is neither shape.

### Proposed general fix

1. In `automationStudioLlmEvidenceNormalizedDecisionResponse` (`evidence-loop-decision.ts:424`), or a small sibling
   helper in its own file per the structure rules, read a decision whose `kind` is absent or not in `DECISION_KINDS`
   as `tool_call`. Only when it has a string `toolId`, an object `input`, and neither `result` nor `amendments`.
   - Where `callId` is missing or invalid (6 of 9 cases), fill one deterministically, for example `call.<fnv8 of
     toolId+input>`. Identical calls collide, which the repeat guard already treats as one call.
   - Record a warning diagnostic (for example `llm_output.decision_kind_inferred`, severity warning) so the step log
     shows the repair.
   - Tests: `deepseek/tests/response-envelope.test.ts` and the evidence-loop-decision tests:
     - each of the observed shapes, with and without `callId`, is read as the tool call;
     - `complete` with `toolId`, and `amend_draft` with `input`, are still refused;
     - a decision with `toolId` but no `input` is still refused.
2. For anything still refused under this code, the feedback names the field: a `fieldIssues` entry
   `{code, path: "response.decision.kind", expected: "tool_call | complete | amend_draft"}`, through the same screened
   path used for `write` (`unusable-decision.ts:180`). Optionally add an `ISSUE_INSTRUCTIONS` line. Test:
   `runtime/llm/tests/unusable-decision.test.ts`.

## Commands run and observed results

- `ls` of both runs' `steps/` and `index.md`: matched the brief's step numbers. The R4a decision refusal is step
  0021/0022 at iteration 10.
- Python printouts of `call.json` and `result.json` for every submit, plus the popup lines of each exploration view:
  the tables and handles above.
- `grep` of the submit-decision `request.txt` files for the pressed handles: no matches in R4a 0029/0033/0037 or R4b
  0025.
- Scan script `scratchpad/scan_invalid_r4.py` over all `lab-runs`: `runs with this refusal: 7`;
  `6 kind='callId' keys=input,kind,toolId`; `3 kind='callId' keys=callId,input,kind,toolId`.
- Raw `response.json` for `run-mv0pa79q` 0005 and R4b 0017 confirms the provider literally sent `"kind":"callId"`.
- Source reads with Grep/Read at the lines cited.

## Not verified

- No tests were run, and none of the fixes was prototyped.
- I did not check that Core's strict draft-statement reader accepts a new outcome key. I inferred that `control` and
  `changed` survive superseding from the requests, not from a test.
- I did not read `logs/core.log` in the t418 bundles. The step logs were sufficient.
- I did not check whether a provider other than DeepSeek calls the normalizer.
- I did not confirm whether `answered-layer.ts` marked the three popup presses as interruptions in these runs.
  Proposal 1.2 depends on it.

## Open questions or contradictions found

- The brief says R4a "resent an unchanged draft". It did not. Submit 2 changed all three refused handles (`t1049` to
  `t1051`, `t1034` to `t1035`, `t1086` to `t1087`). The digest matched because it keys on `code@line` only
  (submission-refusal.ts:126).
- `c140a77e` is the same digest in both runs only because both refusals had the same codes on lines 5, 10 and 15.
- Proposal 1.4 changes what counts as "the same refusal" under the user's 2026-10-06 rule. It needs the supervisor's
  confirmation.
- Proposal 1.2 rewrites a target the model wrote (with the substitution reported). If silent repair of a model-written
  handle is unwanted, use 1.1 plus 1.3 alone.
- Both accepted Flows have no popup steps. Runtime interference clearing handled the popups in the trials, so the end
  result was correct.
