# C round-six bounded build audit
Status: Complete
Owner: B-debug worker
Created: 2026-10-11
Scope: Read-only run-mv4rny8v-dde7ddf8; supervisor owns live-C and per-run debug.

## Result and provenance
The one headed original creation failed before promotion/runtime/oracle/replay. Sealed flow-lane build failure lists flow_bootstrap.evidence_iteration_limit. 49 observed calls = initial chat1 plus Core build48 (36 evidence decisions +12 trial judges). Costs: initial chat $0.00018354 + build $0.09080352 = $0.09098706. The $0.25 cash ceiling was not exhausted. Final statically accepted revision16 was actually tested and judged no by both judges. More cash/calls alone is not demonstrated to fix this.

Frozen Core190d7bda/downstream921f0296; actual Core, host, server and extension receipts are all verified true and supervisor independently reviewed them. Original task415characters/SHA256 d4f7835b8fc63ee857b5c15bd6a01f1f08fe3df19446153ad0f443045fd087ef retained in every actual judge request. Original independent oracle is unchanged: ordered13records/52fields across five pages. This expected count is audit evidence, never model guidance. No new browser/provider/source/shared-document/profile/commit/push actions occurred.

## Supported causes
Sixteen submissions reached actual validation. Nine were refused: revision1 has misplaced next-page handle; revisions2,5,6,8,10,12,13,15 contain recordOutput.process:{unique:[...]} and fail record_output.process_unknown_key. Six additional unchanged resubmissions were refused without revalidation (0034,0044,0056,0068,0078,0080). The valid revisions3,4,7,9,11,14,16 omit process; revision4 was revised before testing. Unsupported unique is an authored key, not a supported processor that malfunctioned.

A real generic contract drift contributes unhelpful repair feedback. Core packages/contracts/src/record-sets/parse-output.ts accepts top-level process; process/parse-processing.ts supports dedupe,where,sort,limit,columns,minRows, with dedupe:{by:[fieldIds]}. Core packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/record-output-contract.ts KEYS/text/condensedText omit process entirely and tell the model only six old top-level keys are accepted. Actual static feedback repeats that incomplete shape for process_unknown_key instead of the owning processing shape. The script-format flow-script-format.ts does advertise recordOutput.process, so removing all process usage is an inconsistent fallback. This does not make unique valid, but it withholds the supported alternative when the author repeatedly asks for deduplication.

Separate semantic defects remain after unsupported processing is removed. Early extraction uses absence on an item-text column, excluding eligible records; removing that absence changes the recorded result from11 to13. Later text exclusion regexes reject eligible records whose full labels also mention excluded accessory terms; a further relaxation admits a nonqualifying accessory. Numeric conditions are supported atLeast/lessThan throughout; this is not the D compound-number/regex defect. Final trial records14, judges both no. A count of13 in an earlier trial is not exact record/field/order proof.

All displayed trial steps succeeded (14 each for first five trials,16 for final); rejection is goal judgment, not a nonexistent failed action. First five trials read one page/18observed items; final reads two pages/36items,15kept before accumulated deduplication gives14stored. Every read reports stop ended and truncated false. Independent full five-page coverage is therefore unproven, and these read counters must not be mistaken for the exact oracle.

## Evidence and judgment fidelity
Every judge request preserves original instruction; sampleRows contains all stored rows (11,11,13,8,11,14), four unwithheld columns, no missing cells, no record-set truncation, and read-level condition rejection witnesses. Overall summary.withheld is true; that flag includes screened views/changes and does not mean stored rows were truncated. This audit has not attributed every screened value to its owner and does not claim perfect raw-view coverage.

Core checked-row feedback explicitly identifies rows excluded only by a condition on trials2/4. It also refutes judge claims that a row is missing when that row is actually in the result on trials3/6. Those are genuine model evidence misreadings supported by the supplied records. For all available next decisions after trials2/3/4, exact checked strings survive the decoded evidenceLoop context. No stale revision/digest substitution or dropped checked-feedback is supported. There is no next decision after final trial because the shared48calls are spent. Despite receiving correction, later authored predicates still make broad text exclusions and the final judges still reason incorrectly about at least one included row. Checked-row feedback is an existing deterministic factual correction, not a full semantic cohort proof.

## Bounded owner proposals, no implementation
1. Correct Core flow-bootstrap/plan/record-output-contract.ts and its owning tests/record-output-contract.test.ts to derive current top-level process and nested processing vocabulary from the contracts owner, then route process_* refusal guidance to the actual allowed nested shape. Neutral fail-first probe: valid process.dedupe.by is parser-accepted and advertised consistently by full/condensed catalog and refusal contract; process.unique remains refused with precise supported nested keys. This is a contract-accuracy fix, not scenario advice or a claim that the original run would pass.
2. Investigate Core result-verification/request-rows/checked-rows.ts, result-verification/verdict.ts and owning tests/checked-rows.test.ts / judge-accounts-for-rows.test.ts for the contradiction path: supplied stored row, judge calls it omitted, Core correction retained in next request. Preserve neutral factual correction and required excluded witnesses. Do not infer eligibility from text alone or turn a disproved missing-row assertion into a deterministic yes. Current evidence establishes model misuse of retained correction, not loss at these owners; changes require a separate written brief and a fail-first defect beyond this run.
3. Treat terminal build-call exhaustion separately from semantic capability. Core llm/evidence-loop/exhaustion.ts and llm/loop-budget.ts own the shared bound; no limit increase proposed without evidence. Navigation/read stop ended despite less-than-oracle page coverage remains a bounded downstream paging-owner follow-up, not a proven parser failure from this report alone.

## UI and completeness
All86saved step directories and every call/result/decision/judge JSON were read; trial revision/digest pairs reconciled below. All25UI moments inspected through metadata:25scenario/25panel pictures, zero skips/failures, overlay12changed/11stable/2flickering. Supervisor already inspected ending failure-panel pixels; this worker does not claim additional complete pixel review. Local raw page evidence/screenshots remain ignored; none copied here. No Flow hash or completed run exists, so duplicate-act, durable pacing, adaptation and disabled-provider reuse are not qualified.

## Exact six trial identities

| Trial step | Revision | Digest | Stored rows | Verdict |
| --- | --- | --- | --- | --- |
| 0024 | 3 | 01739f5bf36d3cd58194ab601acc3ced83ab625b491e868b9f94c3b397f5cbdc | 11 | no |
| 0038 | 7 | ba57df137438a7619878c2e2e463b7565ba52b053cbf20e18321803203a58cae | 11 | no |
| 0048 | 9 | a06970ac0c17157a1c7f80281c833b5b7e76c510d26663fe4cf984dcb50c280c | 13 | no |
| 0060 | 11 | 6e8f3352bac4c4b8a449a1325f8b36712105e2a092e3a84ea6f8f2d491323e42 | 8 | no |
| 0072 | 14 | 3712b7fe0727ceb41a14a1d15796634391016e825ee78e0b8590b12373870e94 | 11 | no |
| 0084 | 16 | 1f430bf0993515a72ad8d74d3cb9a4f292e3630e720929ae72d8f2727af1b8ea | 14 | no |

## Every saved step inspected

| Step | Kind/tool | Recorded status/code |
| --- | --- | --- |
| 0001 | chat | ok |
| 0002 | tool-core.run_node | web.action.succeeded |
| 0003 | decide | ok |
| 0004 | tool-core.run_node | web.action.succeeded |
| 0005 | decide | ok |
| 0006 | tool-core.run_node | web.action.succeeded |
| 0007 | decide | ok |
| 0008 | tool-core.run_node | web.action.succeeded |
| 0009 | decide | ok |
| 0010 | tool-web.detect_repeating_structure | web.structure.detected |
| 0011 | decide | ok |
| 0012 | tool-web.detect_repeating_structure | web.structure.detected |
| 0013 | decide | ok |
| 0014 | answer-web.detect_repeating_structure | llm_evidence_loop.already_answered |
| 0015 | decide | ok |
| 0016 | answer-web.detect_repeating_structure | llm_evidence_loop.already_answered |
| 0017 | decide | ok |
| 0018 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_parameters_unresolved:c711e40c |
| 0019 | decide | ok |
| 0020 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_plan_invalid:cb8b8d67 |
| 0021 | decide | ok |
| 0022 | tool-core.submit_candidate | ok |
| 0023 | decide | ok |
| 0024 | tool-core.test_candidate | candidate.trial_no |
| 0025 | judge | ok |
| 0026 | judge | ok |
| 0027 | decide | ok |
| 0028 | tool-core.submit_candidate | ok |
| 0029 | decide | ok |
| 0030 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_plan_invalid:cb8b8d67 |
| 0031 | decide | ok |
| 0032 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_plan_invalid:cb8b8d67 |
| 0033 | decide | ok |
| 0034 | answer-core.submit_candidate | llm_evidence_loop.repeat_refused |
| 0035 | decide | ok |
| 0036 | tool-core.submit_candidate | ok |
| 0037 | decide | ok |
| 0038 | tool-core.test_candidate | candidate.trial_no |
| 0039 | judge | ok |
| 0040 | judge | ok |
| 0041 | decide | ok |
| 0042 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_plan_invalid:cb8b8d67 |
| 0043 | decide | ok |
| 0044 | answer-core.submit_candidate | llm_evidence_loop.repeat_refused |
| 0045 | decide | ok |
| 0046 | tool-core.submit_candidate | ok |
| 0047 | decide | ok |
| 0048 | tool-core.test_candidate | candidate.trial_no |
| 0049 | judge | ok |
| 0050 | judge | ok |
| 0051 | decide | ok |
| 0052 | tool-web.find_on_page | web.inspect.succeeded |
| 0053 | decide | ok |
| 0054 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_plan_invalid:cb8b8d67 |
| 0055 | decide | ok |
| 0056 | answer-core.submit_candidate | llm_evidence_loop.repeat_refused |
| 0057 | decide | ok |
| 0058 | tool-core.submit_candidate | ok |
| 0059 | decide | ok |
| 0060 | tool-core.test_candidate | candidate.trial_no |
| 0061 | judge | ok |
| 0062 | judge | ok |
| 0063 | decide | ok |
| 0064 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_plan_invalid:cb8b8d67 |
| 0065 | decide | ok |
| 0066 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_plan_invalid:cb8b8d67 |
| 0067 | decide | ok |
| 0068 | answer-core.submit_candidate | llm_evidence_loop.repeat_refused |
| 0069 | decide | ok |
| 0070 | tool-core.submit_candidate | ok |
| 0071 | decide | ok |
| 0072 | tool-core.test_candidate | candidate.trial_no |
| 0073 | judge | ok |
| 0074 | judge | ok |
| 0075 | decide | ok |
| 0076 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_plan_invalid:26fe78c6 |
| 0077 | decide | ok |
| 0078 | answer-core.submit_candidate | llm_evidence_loop.repeat_refused |
| 0079 | decide | ok |
| 0080 | answer-core.submit_candidate | llm_evidence_loop.repeat_refused |
| 0081 | decide | ok |
| 0082 | tool-core.submit_candidate | ok |
| 0083 | decide | ok |
| 0084 | tool-core.test_candidate | candidate.trial_no |
| 0085 | judge | ok |
| 0086 | judge | ok |
