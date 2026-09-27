# t328 — Run 3 debug review

## Verdict

**NO-GO pending narrow documentation corrections.** The run-3 debug preserves Stage 1 exactly, handles overlapping accounting correctly, respects the important later-stage `NO EVIDENCE` boundaries, and contains no raw/sensitive artifact content. It nevertheless includes several post-run details that are not supported by the authorized comparison set (t325 and t326), and its cause disposition has not been reconciled to t326's completed source audit.

This is a documentation-evidence NO-GO, not a challenge to the accepted run measurement. The core classification remains supported: integrity-valid/redaction-verified failure at Stage 2, before proposal, after 26 build decisions, ending `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`.

## Audit results

| Gate | Result | Finding |
| --- | --- | --- |
| Stage-1 no-hindsight preservation | **PASS** | The complete `## Stage 1 — the instruction and the expected chain` block is line-for-line identical to the block frozen in t262: 19 lines in each, including the instruction, oracle, hypotheses, authority/accounting invariants, pass threshold, and consecutive-pass rule. |
| Run identity and highest stage | **PASS** | Run id, failed verdict, Stage 2/build stop, no proposal, null review/shape/authored nodes, and absence of runtime/later stages agree with t325/t326. |
| Core loop totals | **PASS with wording correction** | 26 decisions, 21 tool calls, 37 bounded steps, and 98,063 evidence bytes agree with t325. Call the 37 records “bounded evidence-loop steps,” matching the published artifact field, rather than asserting a distinct “sanitized decision/tool rows” type. |
| Provider accounting | **PASS** | The debug explicitly treats observed/build/evaluation call totals as overlapping corroboration, not additive buckets: 26 calls; 362,468 input + 5,999 output = 368,467 total tokens; USD 0.057534336; 25 itemized and one unrecorded. It does not invent repair/verification usage. Repeating the same representation in Header and Stage 2 is clearly labelled and not double-counted. |
| Closed terminal failure | **PASS except HTTP status** | Failure code, stage, issue code, and corrected t217 classification agree with t325/t326. Neither authorized report publishes HTTP status `400`. |
| Detailed step counts/codes | **FAIL** | T326 supports ten reruns, two amendments, one unchanged draft, one invalid decision, two cannot-answer endings, and late `node_not_runnable_here`. T325 supports successful actions/inspection, repeating-structure detection, and closed refusals only as categories. Neither report supports the debug's split of 6 successful browser actions, 10 inspections, 1 structure detection, and 4 rejected tools, nor the three additional exact refusal codes and claimed recovery from each. |
| Proposal/Flow boundary | **FAIL (one sentence)** | “No proposal survived,” null shape/nodes, and all Stage-1 capabilities unmeasured are supported. “A blank Flow identity existed” is not stated by t325 or t326 and crosses the authorized evidence boundary. |
| Runtime/oracle/repair/replay boundaries | **PASS** | The debug correctly distinguishes absent runtime/replay from an observed zero, does not treat the pre-run 13-record oracle as a measured output, records null extraction/verification/recovery, and does not infer terminal grant revocation. |
| Cause and disposition | **FAIL (stale)** | Cause 1 still says the exact leaf owner requires a source comparison audit and assigns `t326 / t327`; t326 already completed that audit. Cause 2 still asks whether the sequence establishes a repeatable product defect; t326 already classifies unreliable build convergence as a confirmed product-level deficiency while finding no new deterministic Core implementation defect. |
| Privacy and secret handling | **PASS** | The file contains the pre-frozen scenario instruction and bounded sanitized facts only. It contains no prompt/response text, page text/rows, selectors, parameters, credentials, tokens, cookies, authorization material, hashes, raw errors/logs, browser state, or opaque page handles. The run id and closed codes are permitted bounded identifiers. |

## Exact corrections required

Line numbers refer to the reviewed version of `docs/working/language-driven-flow-loop-plan/debugs/run-mujd550n-e8fbe7aa.md`.

1. **Lines 44–46 — bounded-step wording and unsupported HTTP status.**
   - Replace `37 sanitized decision/tool rows` with `37 bounded evidence-loop steps`.
   - Remove `and HTTP 400` from the terminal-classification sentence. T325/t326 support the code, stage, issue, invocation, and no-timeout-recovery fields, but not that status number.

2. **Lines 52–55 — unsupported tool-outcome split.**
   - Remove the four numeric rows `Successful browser actions | 6`, `Successful page inspections | 10`, `Repeating structure detected | 1`, and `Rejected tool actions | 4`, or supply a separate authorized sanitized report that publishes those exact counts.
   - The safe replacement is prose: `The bounded trace records successful browser actions and inspections, repeating-structure detection, and closed action refusals; t325/t326 do not publish a numeric split among those tool outcomes.`
   - The five draft/decision rows below them may remain: their 10/2/1/1/2 counts are supported by t326's accepted sanitized facts.

3. **Lines 62–64 — unsupported refusal codes and recovery sequence.**
   - Remove `start_location_not_reached`, `target_not_a_handle`, and `blocked_by_dialog`, plus the claim that the loop recovered from those three. Neither t325 nor t326 publishes those details.
   - Retain the supported ending as: `The bounded evidence records closed action refusals. The published terminal progression ends with a draft rerun, an invalid-input refusal (node_not_runnable_here), and a final unusable decision carrying bootstrap.cannot_answer_instruction.`

4. **Line 80 — unsupported blank identity.**
   - Replace `A blank Flow identity existed, but no proposal survived provider-output validation and no authored node list exists.` with `No proposal survived provider-output validation, and no authored node list exists.`

5. **Cause row 1, line 111 — reconcile the completed t326 audit.**
   - Change `final usable classification` to `terminal classification`.
   - Replace the ownership/disposition text with: `FluxIQ Core evidence-loop / Flow-bootstrap boundary; t326 found the terminal-classification path correct and no new deterministic leaf-code defect.`
   - Replace the disposition with: `Preserve the truthful classification. Treat build convergence reliability as the product deficiency; do not raise the call ceiling or weaken answerability.`
   - Attribute this conclusion to `t326`; do not describe its source comparison as pending.

6. **Cause row 2, line 112 — adopt t326's disposition.**
   - Replace the pending “change behavior only if” wording with: `Add a scripted sanitized Core integration fixture for the mixed rerun/unchanged/unrunnable/repeated-answerability exhaustion sequence. Evaluate a separate draft-convergence signal or earlier answerability checkpoint as product-policy work; do not infer duplicate reruns or change stop policy from this trace alone.`

## Claims that should remain unchanged

- Stage 1 in full.
- The run id, timestamps, provider/model, scenario/profile, and unchanged 26-call command description.
- The non-overlapping accounting explanation and exact aggregate numbers.
- Stage 2 as the highest reached stage and the exact terminal failure code/stage/issue.
- No proposal, runtime, dataset, judgement, repair, replay, or measured revocation.
- The `NO EVIDENCE` statements for raw provider/page content, rerun semantic identity, authored shape, oracle comparison, later stages, and terminal lifecycle.
- Integrity-valid/redaction-verified failed-product classification and consecutive-pass streak of 0.

## Scope performed

Read t262, t325 (`t325-run3-independent-evidence-audit.md`), t326, and the completed run-3 debug only. I did not open `test-runs`, raw artifacts, provider/page content, or shared indexes; did not run tests or live commands; and did not edit the debug or any shared document. This report is the only change.
