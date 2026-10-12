# Round-six D full build debug
Status: Complete
Owner: live-d-round6 worker


## Final result and complete audit
Status of live qualification: Failed. The one authorized creation ended with lab.chat_build_failed / flow_bootstrap.evidence_iteration_limit. No Flow was promoted, no saved hash exists, and runtime/oracle/replay were not reached. No second creation or unchanged relaunch occurred. No balance failure occurred.

88 saved steps were inspected, including every JSON artifact, eight submissions, five trials and ten judge requests/responses. Whole test: 49 provider calls, $0.068919444; Core build: 48 calls (38 decisions plus 10 judges), $0.068828268; initial chat: one call, $0.000091176. The $0.25 cash ceiling was not exhausted. Build duration 365172 ms; started 2026-10-12T04:44:26.930Z, finished 04:54:51.082Z. Production compilation took 101 seconds and completed successfully. The failure is the shared build iteration ceiling, not a startup, compilation or balance failure.

All four published actual identity receipts in test-runs/instances/t275-slot-4/run-mv4rpi98-ff21c9e4/snapshots/ match the expected frozen pair; supervisor independently verified them. No source changes, overrides, profile resets, commits or pushes were made.

### Candidate and trial evidence
Submissions: revisions 1,4,5,6,7,8 accepted; revision 2 refused by flow_script.way_out_accepts / bootstrap.instructed_act_only_optional; revision 3 refused by web.handle.not_a_control. Revision 6 was revised before a trial. Trial revisions 1,4,5,7,8 received no,no,unsure,no,no. Trial stored record totals were 11,11,6,3,3; grouped record sets were (8,3),(8,3),(3,3),(0,3),(0,3), not distinct output-cohort cardinalities.

The exact independent original oracle requires four records. All eight submitted scripts retained a text matches predicate and omitted numeric-bound operators; their first eligible read repeatedly kept three of eight observed rows and excluded five, including a relevant compound-quantity witness. Subsequent revisions changed output framing: an overbroad after-read, duplicate before/after sets, then final conditions rejecting all rows. This is source/evidence-backed authoring error; no completed runtime result exists to qualify independently.

The corrected generic numeric-tool prose was actually present in outbound decision requests 0029 and 0087: numeric bounds for quantities and recognized combined-count totals. Therefore missing delivery of that wording is unsupported. The author continued choosing regex. All ten judge requests retained the original instruction and compound witness. Nine judge answers were no; step 0053 alone answered yes, while the paired judge answered no and the trial stayed unsure. The generic prose did not establish deterministic semantic accuracy. Missing original data is unsupported. Final decision 0087 still offered submit and trial tools, but the model chose another structure inspection (0088), after which the shared limit stopped the build. Extra cash or calls alone does not prove eventual success.

### UI, action and adaptation limits
All 21 UI moments have scenario and actual panel pictures; zero skips/collection failures. Overlay sampling classified 14 changed, one flickering, six stable. The flickering sample is moment 2 with two presence/visibility toggles and one page load; this is captured observation, not an established cause of build failure. Ending panel pixels were inspected and show build-limit failure with retained draft, five trials and final trial rejection. Ending panel: test-runs/instances/t275-slot-4/run-mv4rpi98-ff21c9e4.ui-review.local/21-failure-panel.png. No page data is copied into authored reports.

Trial resets prevent treating actions repeated across trials as duplicate acts within one completed execution. No completed replay exists to prove one-act-per-eligible-row behavior or durable pacing/adaptation. The build made progress after an address-not-shown action rejection and duplicate-evidence refusal, but no durable rate-limit/pacing handling or persisted adaptation was demonstrated. Judge approval alone would not establish qualification.

Complete 88-step safe ledger: docs/working/language-driven-flow-loop-plan/debugs/run-mv4rpi98-ff21c9e4.md. Local raw requests/results, captured data and images are retained in ignored run evidence. Next action is supervisor review and a changed-source bounded brief if warranted; no unchanged rerun.

## Every saved step

| Step | Kind/tool | Recorded status/code |
| --- | --- | --- |
| 0001 | chat | ok |
| 0002 | tool-core.run_node | web.action.succeeded |
| 0003 | decide | ok |
| 0004 | tool-core.run_node | web.action.succeeded |
| 0005 | decide | ok |
| 0006 | tool-core.run_node | web.action.rejected.address_not_shown |
| 0007 | decide | ok |
| 0008 | tool-core.run_node | web.action.succeeded |
| 0009 | decide | ok |
| 0010 | tool-core.run_node | web.action.succeeded |
| 0011 | decide | ok |
| 0012 | tool-core.run_node | web.action.succeeded |
| 0013 | decide | ok |
| 0014 | tool-web.detect_repeating_structure | web.structure.detected |
| 0015 | decide | ok |
| 0016 | tool-core.run_node | web.action.succeeded |
| 0017 | decide | ok |
| 0018 | tool-web.detect_repeating_structure | web.structure.detected |
| 0019 | decide | ok |
| 0020 | tool-core.run_node | web.inspect.succeeded |
| 0021 | decide | ok |
| 0022 | answer-core.run_node | llm_evidence_loop.repeat_refused |
| 0023 | decide | ok |
| 0024 | tool-web.find_on_page | web.inspect.succeeded |
| 0025 | decide | ok |
| 0026 | tool-core.run_node | web.inspect.succeeded |
| 0027 | decide | ok |
| 0028 | tool-core.run_node | core.run_node.written |
| 0029 | decide | ok |
| 0030 | tool-core.submit_candidate | ok |
| 0031 | decide | ok |
| 0032 | tool-core.test_candidate | candidate.trial_no |
| 0033 | judge | ok |
| 0034 | judge | ok |
| 0035 | decide | ok |
| 0036 | tool-core.submit_candidate | candidate.way_out_refused:685d9be6 |
| 0037 | decide | ok |
| 0038 | tool-core.submit_candidate | flow_bootstrap.evidence_completion_parameters_unresolved:056aa278 |
| 0039 | decide | ok |
| 0040 | tool-core.recall_result | core.recall.restored |
| 0041 | decide | ok |
| 0042 | tool-core.submit_candidate | ok |
| 0043 | decide | ok |
| 0044 | answer-unusable | candidate.trial_required |
| 0045 | decide | ok |
| 0046 | tool-core.test_candidate | candidate.trial_no |
| 0047 | judge | ok |
| 0048 | judge | ok |
| 0049 | decide | ok |
| 0050 | tool-core.submit_candidate | ok |
| 0051 | decide | ok |
| 0052 | tool-core.test_candidate | candidate.trial_unsure |
| 0053 | judge | ok |
| 0054 | judge | ok |
| 0055 | decide | ok |
| 0056 | tool-core.submit_candidate | ok |
| 0057 | decide | ok |
| 0058 | tool-web.find_on_page | web.inspect.succeeded |
| 0059 | decide | ok |
| 0060 | tool-core.submit_candidate | ok |
| 0061 | decide | ok |
| 0062 | tool-core.test_candidate | candidate.trial_no |
| 0063 | judge | ok |
| 0064 | judge | ok |
| 0065 | decide | ok |
| 0066 | tool-web.find_on_page | web.inspect.succeeded |
| 0067 | decide | ok |
| 0068 | tool-web.describe_element | web.inspect.succeeded |
| 0069 | decide | ok |
| 0070 | tool-web.describe_element | web.inspect.succeeded |
| 0071 | decide | ok |
| 0072 | tool-web.describe_element | web.inspect.succeeded |
| 0073 | decide | ok |
| 0074 | tool-web.describe_element | web.inspect.succeeded |
| 0075 | decide | ok |
| 0076 | tool-web.describe_element | web.inspect.succeeded |
| 0077 | decide | ok |
| 0078 | tool-web.describe_element | web.inspect.succeeded |
| 0079 | decide | ok |
| 0080 | tool-core.submit_candidate | ok |
| 0081 | decide | ok |
| 0082 | tool-core.test_candidate | candidate.trial_no |
| 0083 | judge | ok |
| 0084 | judge | ok |
| 0085 | decide | ok |
| 0086 | tool-web.describe_element | web.inspect.succeeded |
| 0087 | decide | ok |
| 0088 | tool-web.detect_repeating_structure | web.structure.detected |
