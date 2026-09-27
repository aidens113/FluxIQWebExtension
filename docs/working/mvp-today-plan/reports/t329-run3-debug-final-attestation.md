# t329 — Run 3 debug final attestation

## Verdict

**NO-GO pending one wording correction.** The corrected debug now passes no-hindsight preservation, privacy, accounting, and every substantive evidence correction from t328. One phrase still overstates the published terminal ordering.

After replacing `repeated draft reruns` with `a draft rerun` in the terminal-progression sentence, the document is **GO** against t262/t325/t326 without another artifact read.

## Final gates

| Gate | Result | Attestation |
| --- | --- | --- |
| Evidence support | **NO-GO: one phrase** | Run identity, Stage 2 stop, 26 decisions, 21 tool calls, 37 bounded steps, 98,063 evidence bytes, terminal code/stage/issue, 10/2/1/1/2 draft/decision counts, null later stages, and t326 disposition are supported. The sentence at current lines 60–62 says the terminal progression ended with `repeated draft reruns`; t325 supports **a draft rerun**, then `node_not_runnable_here`, then the final unusable decision. Ten reruns are supported across the build, not as the exact terminal sequence. |
| No-hindsight preservation | **GO** | The complete 19-line Stage-1 block remains line-for-line identical to t262, including instruction, expected chain, oracle, hypotheses, authority/accounting invariants, pass threshold, and consecutive-pass rule. |
| Privacy | **GO** | No raw prompt/response, page content or rows, selector, parameter, credential, token, cookie, authorization material, hash, raw error/log, browser state, or opaque page handle appears. The pre-frozen scenario instruction, run id, bounded counts, and closed codes are permitted. |
| Accounting | **GO** | Build/observed/evaluation are correctly described as overlapping corroboration, not summed buckets: 26 calls; 362,468 input + 5,999 output = 368,467 total tokens; USD 0.057534336; 25 itemized and one unrecorded. No repair/verification accounting is invented. |
| `NO EVIDENCE` boundaries | **GO** | No proposal, authored shape, runtime, measured dataset, oracle comparison, judgement, repair, replay, or terminal revocation is inferred. Replay calls are correctly “not applicable,” not a measured zero, and the pre-run 13-record oracle is not presented as an observed count. |
| Root-cause disposition | **GO** | The causes now preserve the truthful classification, identify convergence reliability as the product deficiency, avoid claiming a deterministic Core leaf defect or duplicate reruns, and carry t326's proposed scripted integration fixture/product-policy follow-up. |

## Exact remaining correction

In `docs/working/language-driven-flow-loop-plan/debugs/run-mujd550n-e8fbe7aa.md`, change:

> `The published terminal progression ends with repeated draft reruns, an invalid-input refusal ...`

to:

> `The published terminal progression ends with a draft rerun, an invalid-input refusal ...`

This preserves the separately supported statement that ten reruns occurred across the full build while keeping the terminal ordering exactly within t325's published evidence.

## Scope

Read the corrected run-3 debug and reports t325, t326, and t328; mechanically rechecked the Stage-1 block against t262. I did not open `test-runs`, artifacts, provider/page content, or shared indexes; did not run tests or live commands; and did not edit the debug or any shared document. This report is the only change.
