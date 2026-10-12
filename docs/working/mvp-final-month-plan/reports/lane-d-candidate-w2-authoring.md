# Lane D candidate, W2: why the candidate could not confirm only the qualifying rows (read-only)

Run `run-mv0fuual-f9e6f089` (t275, slot 4). Paths: R = Core `runtime/`, C = Core `contracts/src`, D = extension
`domain/src`, RUN = the run folder. Step numbers are RUN `steps/NNNN-*`.

## Outcome

Done. All four questions answered from the step folders and the code; one scratch probe (outside the repository)
confirmed the three script shapes assemble the way the code says they do.

**Verdict:** the capability the candidate needed already exists and the script can carry it:
`extractList.where: [{"field": "mutual", "atLeast": 5}]` on the listing step. Round 4's legacy run used exactly this and
kept the right four rows. The candidate never wrote it because the candidate-only loop format tells it to filter with
`recordOutput.process`, which runs at the end of the run. The extraction grammar also tells it to leave `where` out and
"narrow later". After the judge's "add a condition" advice the model reached for `builtin.data.filter-list`, which a
script cannot wire and which cannot compare "23 mutual friends" as a number anyway.

## What changed and why

Nothing in source. I wrote only this report and a scratch probe under my scratchpad
(`.../scratchpad/w2probe/w2-probe.test.ts`, outside both repositories).

### Q1. Narrowing the rows a repeat goes over

**(a) Yes: `recordOutput.process` runs only at the run's end, never on the rows a `repeat over` walks.**
- `C/record-sets/process/process-rows.ts:1-8`: process applies `where`, then dedupe, sort, limit and columns, over the
  rows the dataset collected in the run.
- Its only callers:
  - the run-end stage `processRunDatasets` (Core `storage/project/run-dataset-store.ts:253`, `answerOf` :479-492);
  - the build test (`R/result-verification/build-test/stores.ts:192`).
- The loop takes its rows from the listing node's `records` data port (D `output-nodes/definitions.ts:33`).
  `emitRepeatOver` wires `source.<rows port> -> for-each.items` (`R/flow-bootstrap/authoring/draft-routing.ts:463-466`).
  So the for-each sees every row the page read, whatever `process` says.
- Rev 1's `matches "(?:^|\D)([5-9]|[1-9][0-9]+) mutual friend"` was on the after-read's `recordOutput.process`. It
  pruned the stored table (Amara, Lin, Freya; it lost Jonas) and never touched which rows the repeat pressed. Both trials
  accepted all eight.

**(b) `builtin.data.filter-list` cannot do this job from a script, for three separate reasons.**
- Definition (Core `nodes/data/filter-list.ts`):
  - input port `items` (array, `required: true`, :9);
  - output `items` (:10);
  - parameters `path`, `operator`, `value`, `onInvalid` (:12-39);
  - `operator` options are exists, equals, not-equals, greater-than, less-than and contains (:19-26). There is no
    `matches` and no at-least.
- `defineBuiltinNode` prepends a control input `in` (Core `nodes/shared/definition.ts:23-28`), so the inputs are
  `[in, items]`.
- **How a script binds `$step.<label>.<output>`.** `scriptBinding` (`R/flow-bootstrap/authoring/assemble.ts:565-601`,
  `STEP_FORM` :542) turns it into `{"$state":{"path":"$node.<key>.<output>"}}`. It is only ever called on a parameter
  line (:471), after the key has matched a declared parameter. A key that names no parameter is refused
  `bootstrap.unknown_parameter` (:466). An input port is not a parameter.
- **Why rev 7 got `required_input_unconnected nodes.s9.inputs.items`.**
  - The fall-through edge from the listing goes from its first unclaimed output (`success`) into the next step's first
    free non-data input (`targetPort`, assemble.ts:703-713, used at :674-680). For filter-list that is `in`.
  - Nothing reaches `items`: a script branch line carries no target port (`R/flow-bootstrap/authoring/parse.ts:178`).
    Only routing code sets one (`draft-routing.ts:741-742`).
  - Plan validation then refuses the unconnected required port (`R/flow-bootstrap/plan/validation.ts:343`).
  - The probe confirmed the rev 7 shape assembles with edges `s2:success->s3:in` and none into `s3:items`.
- **Why rev 8 got `unknown_parameter items`.** `items: $step.requests.records` names the input port as if it were a
  parameter, so assemble.ts:466 refuses it. The probe reproduced
  `bootstrap.unknown_parameter plan.subflows.0.nodes.2.parameters.items`.
- **Can `repeat over:` name a filter step?** Yes, structurally. `scriptSpan` accepts any earlier labelled step whose node
  has an array output (`listPort`, draft-routing.ts:692-698, used at :350). Filter-list's `items` output qualifies, and
  rev 7 assembled `s3:items -> s5:items`. The loop shape was never the problem; the unwired input was.
- **Even when wired, the filter could not express the condition.** `compareBasic` greater-than uses
  `numberValue(left)` = `Number("23 mutual friends")`, which is NaN, which falls back to 0 (definition.ts:97-100, :161).
  So `greater-than 4` drops every row. `contains "mutual friend"` (revs 7 and 8) keeps every row that has any text.

**(c) Yes: the listing takes a read-time row condition, `extractList.where`, and a candidate script can set it.**
- The parameter grammar: `where?: [{field: "colKey", is: "absent"}, {field: "yourKey", atLeast: 4, lessThan: 50}]`
  (D `output-nodes/extract-list/catalog-text.ts:233`).
- `where` stays on the page request, unlike dedupe and sort (D `output-nodes/extract-list/one-page-read.ts:9`). The node
  therefore emits only the kept rows on `records`, and those are what the for-each walks.
- A script line `extractList.where: [...]` is a dotted key. It is parsed as JSON (`authoringNestedValue`) and set inside
  `extractList` (assemble.ts:483-486).
- The probe confirmed the line assembles with no error. It gave `extractList: {..., where: [{field: "mutual",
  atLeast: 5}]}` and edge `s2:records -> s4:items`.
- Round 4 ran this parameter shape live: `run-muxky54f-fadb9d03` step 0021/0022, handle + fields + `where atLeast 5`.
  Validation said "4 records from 1 page, 4 items left out by where": Amara, Jonas, Lin and Freya were kept; Tom, Priya,
  Diego and Marta were rejected.
- **What the guidance tells the model.** It sees `where` twice, in the detect tool description (D
  `runtime/llm-evidence/tools.ts:392`) and in the parameter description (catalog-text.ts:233-234). Both say to leave it
  out: "where is optional: omit it, keep every item, narrow later" and "leave it out ... narrow excess later".
- Neither the candidate format nor any line says that the rows a repeat acts on must be narrowed by the listing's
  `where`. The only line that does say "list the items with a where that keeps only the ones to act on" is the
  exploration system prompt (D `runtime/llm-evidence/system-instructions/instructions.ts:53`). It is generic and
  contradicted by (e).

**(d) Yes: "Aisha Khan and 4 other mutual friends" reads as 5.**
- `NAMED_AND_OTHERS` gives N + 1 (`C/record-sets/process/read-number.ts:15`, :28-32), and the parity table pins it
  (`value-reading-cases.ts:40`).
- `atLeast` is `value >= bound` (`condition-holds.ts:34`) on that number (:80-83).
- The domain's read-time condition has the same semantics (condition-holds.ts:1-3). Round 4 kept Jonas live.
- Rev 1's regex was what dropped Jonas, not the count reader.

**(e) No: no example or guidance line shows how to keep only some rows for a repeat. One line points the other way.**
- `R/flow-bootstrap/plan/flow-script-format.ts:267`: "Rows a Flow reads are collected over the whole run; what is done
  with them at the end -- keep some, drop repeats, sort, limit -- is `recordOutput.process` on the reading step". The
  model read "keep some" as the place to filter.
- The rows example (:284-301) is titled "acting on each row a listing kept". Its listing is "list the requests from
  colleagues" (:289), but it writes no `where` at all (`extractList: extraction.2`, `extractList.minItems: 0`). The
  narrowing exists only in the step's prose.
- The pages example (:270-283) shows filtering only as `recordOutput.process.where`.
- `flow-script-format.ts:143` ("narrow it first with the steps that set the target's own controls") means the site's own
  filters, not a read condition.

### Q2. Churn

**0027/0028 and 0031/0032, `repeat_refused (changed_nothing)`: the refusal was right.**
- 0027 (`read-requests-3`) and 0031 (`read-requests-3` again) were byte-identical to 0025's `read-requests-2` (handle
  extraction.3, fields name/mutual, minItems 0). They were sent on the same page, with no step between that changed it.
- 0026 had already returned all eight rows whole, and the 0027 request still carried them. The guard named
  `sameAsCall: read-requests-2`. Nothing ran and only the decision was paid.
- `refusedInARow` stayed at 1 both times because the malformed reply at 0029 broke the run.
- Cause: the model kept re-reading instead of submitting. Its summaries were all "read ... before building the Flow". The
  guard did its job.
- Side observation: 0023's flat `extractList.fields` keys (`extractList.fields.name` written as a run_node parameter) were
  ignored. The read returned the detector's default columns: its validation expected 7 hashed columns. The nested form
  at 0025 worked.

**0029, `llm.provider_malformed_response`: the call was charged.**
- Raw content (729 chars) was `{"kind":"evidence_tool_decision","summary":"...","decision":{"kind":"callId":"read-requests-3",...`.
  The model dropped `"tool_call","` after `"kind":`, so the JSON does not parse.
- It was the same read again, with a `recordOutput` added inside parameters.
- HTTP 200, finish `stop`, usage billed: 20,544 in / 230 out, `costUsd 0.000999312` (0029 meta.json). Feedback at 0030:
  `reply_unreadable`, 1 of 6.

**0043/0044, `parameters_unresolved` on `extraction.2`.**
- Rev 3 changed the after-read's handle to `extraction.2`, which no capture printed.
- The detects this build ran printed extraction.1 (0016), extraction.3 (0020) and extraction.5 (0046). `.2` and `.4` were
  never shown, so the model wrote the handle from memory.
- The refusal was right: `web.handle.unknown_field` and `unknown_field:extractList.fields.0`.
- Minor wording defect: its `next` used the target-handle text, "does not name one control in any view"
  (`R/flow-bootstrap/candidate/submission-refusal.ts:82-88`), for an extraction handle.
- The model recovered by detecting again (0045/0046 gave extraction.5). The identical second detect at 0047 was refused
  `already_answered` (0048).

**0053-0058, three resubmits refused `already_answered`: the refusals were right.**
- The inputs of 0053, 0055 and 0057 are identical to rev 5's (0051) input, flow byte for byte (checked by JSON
  equality). Only the callId differed, `submit-6` against `submit-5`.
- The model believed it was sending "revision 6" (0053 summary).
- Its request showed `submit-5` → `ok, revision 5, digest ef735da2…, next: Test this revision with core.test_candidate`,
  and the decision history listed submit-5 `ok` at iteration 24.
- What it was told: "It was answered at iteration 24 and no action has run since ... This is the 2nd/3rd/4th time ... it
  will get this same answer until an action runs" (`timesAsked` 2-4, `stepsWithoutProgress` 1-3 of 8).
- It then tested rev 5 at 0059. Cost: three decisions, about $0.0039.

**How the build ended after 0068: the third same-reason refusal rule, which counted three different defects as one.**
- Revs 6, 7 and 8 (0064/0066/0068) each fixed the previous issue and met a new one:
  1. `invalid_parameter_value operator`;
  2. `required_input_unconnected nodes.s9.inputs.items`;
  3. `unknown_parameter items`.
- All three carry `refusal: flow_bootstrap.evidence_completion_plan_invalid`.
- `refusalCode` takes `feedback.refusal` first (`submission-refusal.ts:61-64`), so all three count as the kind
  `call:flow_bootstrap.evidence_completion_plan_invalid`. The kind is counted via `authoring-loop.ts:57` and
  `R/llm/decision-handlers/refusal-run.ts:79-80`.
- At the second refusal the model was warned (0067 request: `refused_in_a_row`, inARow 2).
- At the third, `refusal-run.ts:45-50` ends the loop (`MAX_SAME_REFUSALS_IN_A_ROW = 3`,
  `R/llm/evidence-progress/refusal-run.ts:19`), with issue codes `flow_bootstrap.evidence_repeat_without_progress` and
  `llm_evidence_loop.repeat_refused` (RUN/events.ndjson seq 25).
- The warning promised "the Flow is then tested and judged as it stands", but no step follows 0068. The candidate build
  just failed.
- Chat ending text (events.ndjson seq 25, `chat.said`): "\"Create an automation here\" stopped because the build failed:
  it kept trying without getting any further, so it was stopped. I kept the latest version of the Flow's steps that I
  wrote as a draft, but nothing was put into the Flow. A version of it was test-run from the start twice, and the last
  test run was judged not to do what you asked. The Flow \"Go through my friend requests and confirm everyone I have at
  least five...\" keeps your instruction, so you can build it again."
- "Kept trying without getting any further" is inaccurate: each refusal was a different, corrected defect.

### Q3. The "close the chat if it shows" step pressed the gazebo message

- **The binding was faithful; the model copied the wrong handle.** In view 14 (0014's result, the requests page with the
  chat open) the dialog lines are:
  - `t856 button "Minimise chat"`
  - `t857 button "Close chat"`
  - `t859 "Morning! Are you still doing ..."`
  - `t860 "I can bring the gazebo if you need it"` (plain text, no control kind)
  - `t862 field "Message"`
- During exploration the model pressed `t857` (0017 → 0018 `control: "Close chat"`). 0018's result then listed
  `changed: [..., 't860 "I can bring the gazebo if you need it" gone']`, with t860 as the last named handle.
- Every script from rev 1 on wrote `target: t860`. The likeliest source is that `changed` line: t860 is the last handle
  0018 printed about the chat. This is inferred, not proven.
- **Submission binding.** Candidate submissions resolve handles with `handleReach: "view_history"` (D
  `runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:80-90`). `resolveTarget` (:689-700) asks
  `targets.resolve(...)`, which falls back to the per-Flow view history (`plan-resolution/target-packets.ts:186-200`,
  `view-history.ts` `find`). That returns the identity the views agree t860 names, the gazebo text, and reports
  `shownIn`.
- `handleViews` said so plainly: rev 1 `{node: main.s6, handle: t860, view: 14}`; revs 2-5 view 20. View 20 is a later
  capture that carried the same chat again, probably trial 1's page; not verified.
- Both trials therefore pressed the text bubble (trial feedback step 6 `control: "I can bring the gazebo if you need it"`,
  `succeeded`). The chat stayed open, and the judges never flagged it.
- **Missing guard.** Nothing refuses a press whose target is a non-control text line. The view printed no kind for t860,
  and resolution accepted it as a click target.

### Q4. What to change, smallest first, so a candidate confirms only the qualifying rows

1. **Core `R/flow-bootstrap/plan/flow-script-format.ts`, `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT`.**
   - Rewrite :267 to say: the rows a `repeat over` acts on are the rows its listing kept; to act on only some, put the
     condition on the listing, `extractList.where: [{"field": ..., "atLeast": ...}]`; `recordOutput.process` only shapes
     the saved answer at run end and never changes which rows a repeat visits.
   - Give the rows example's listing (:289-292) a `where` line, for example
     `extractList.where: [{"field": "team", "contains": "colleague"}]`.
   - Extend `plan/tests/loop-format.test.ts:72-85` to assert that `where` lands in the listing node's `extractList`. The
     probe shows it does.
   - Candidate-only text, so the legacy schema is unchanged (the test at :47-52 guards that).
2. **D `output-nodes/extract-list/catalog-text.ts:234` and the detect description in
   `runtime/llm-evidence/tools.ts:392`.** Qualify "omit it, keep every item, narrow later": rows a repeat presses must be
   narrowed here. Catalog-text is at its 700-character budget, so something must pay for the clause.
3. **Core `R/flow-bootstrap/candidate/submission-refusal.ts:61-64` `refusalCode`.** For
   `evidence_completion_plan_invalid` and `parameters_unresolved`, count the run under the issue codes, for example the
   first issue code or the sorted set, rather than the category. A corrected defect followed by a new one would then not
   end the build. Revs 6-8 would have continued.
   - The `refused_in_a_row` instruction in `R/llm/decision-handlers/refusal-run.ts:56-58` promises a test and judgement
     that candidate mode does not perform. Say what candidate mode actually does.
4. **Judge advice (Core `R/llm/diagnosis-instructions.ts`).** When the Flow acts on too many rows of a listing, advise
   the listing's `where`, not "a condition on for-each/click". Both 0037 and 0061 pointed at `s10/s11` (for-each and the
   click), which sent the model to filter-list.
5. **Optional, larger.** Either keep `builtin.data.filter-list` out of the web candidate's describable catalog, or teach
   the script to connect a node's input port, for example a `$step.<label>.<output>` on a declared input becoming an edge
   in assemble.ts around :459-471.
   - Even wired, its `greater-than` cannot read "23 mutual friends" (definition.ts:97-100). Removing or steering away is
     the cheaper option.
6. **Side defect (Q3), D `runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` `resolveTarget` (:689-700).** For a
   press node, refuse a target whose resolved identity has no interactive role or tag (a plain text line such as t860),
   naming the dialog's own controls. Smallest test: `plan-resolution/tests/view-history.test.ts` style, with a
   text-only handle.

## Commands run and observed results

- Read the step folders directly (`decision.json`, `response.txt`, `request.txt` grep, `result.json`, `meta.json`) for
  0014-0068, `events.ndjson` (tail), and round 4 steps 0021/0022.
- Python JSON equality of 0053/0055/0057 against 0051 input → `identical input to rev5: True` ×3; 0063 False.
- `npx vitest run .../plan/tests/loop-format.test.ts .../authoring/tests/candidate-loops.test.ts` (Core t275) →
  `2 passed (2)`, `20 passed (20)`.
- Scratch probe `npx vitest run --root <scratchpad>/w2probe` (imports Core source, builds the fixture registry the
  loop-format test uses) → `1 passed`. It showed:
  - rev 7 shape: `ok=true errors=[]`, edges include `s2:success->s3:in` and none into `s3:items`. The required-input
    refusal comes later, from plan validation;
  - rev 8 shape: `bootstrap.unknown_parameter plan.subflows.0.nodes.2.parameters.items`;
  - `extractList.where` shape: `ok=true errors=[]`, `extractList.where: [{"field":"mutual","atLeast":5}]`, and edge
    `s2:records->s4:items`.
  - The probe's extra `registry.register(filter-list)` threw (already registered); harmless.

## Not verified

- The probe used a literal `extractList` (`item`/`fields`), not a detected handle. The handle + fields + `where` form
  through D's resolver is inferred from round 4's live read and the grammar. It was not run in this tree.
- Not verified in a trial: that the for-each would then press only the four kept rows' Confirm (row-scoped control
  finding on a narrowed list).
- What capture view 20 was (the trial page, by inference).
- The exact reason the model chose t860 is inferred.
- `R/llm/diagnosis-instructions.ts` was not read in full.

## Open questions or contradictions found

- Contradictory guidance:
  - the exploration system prompt says "list the items with a where that keeps only the ones to act on";
  - the candidate loop format says filtering ("keep some") is `recordOutput.process`;
  - the extraction grammar and detect description say "omit it ... narrow later".
- `refused_in_a_row` promises a final test and judgement that the candidate path does not perform.
- The chat ending says the build "kept trying without getting any further", while revs 6-8 each fixed the previous
  defect.
