# t234: model reply sizes for FluxIQ build decisions

## Outcome

Done. Measurement only; no source file edited.

## What changed and why

Wrote and ran `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/58ff9269-d8d6-4822-86c8-adf096a6a8a7/scratchpad/t234-reply-sizes.js` (input: `files.txt`, the snapshot list from `find`; output: `t234-tables.md` in the same folder).

Sources and how each is read:
- Lab step records `lab-runs/2026-10-01/run-*/steps/*/meta.json` (4 runs, 88 calls): taskKind, usage.outputTokens, finishReason; decision kind from `decision.json` `response.decision.kind`; max_tokens and messages from `request.json`. These are the only records with finish reasons and request bytes.
- Snapshots (3627 files, 1222 distinct run ids, in fxwork/*/test-runs, !FluxIQWebExtension/test-runs and evidence): per-decision usage is in `build.evidenceLoop.steps[].usage` (live-llm.json, flow-lane.json) and `flows[].adaptations[].evidenceLoop.steps[]` plus `flows[].runs[].recovery.resultReauthor.attempts[].evidenceLoop.steps[]` (decision-trace.json). Decision kind comes from `toolId`: `core.decision_amend_draft` -> amend_draft, `core.decision_complete` -> complete, `core.decision_unusable` -> error, any other tool -> tool_call. Recovery calls: `flows[].runs[].recovery.llmGate.providerCalls[]` (taskKind, stage, reported tokens). Judge: `live-llm.json verification.interventions[]`. `observed.observedCalls[]` has taskKind null everywhere and was not used.
- De-duplication: lab runs take priority (all 4 also appear as snapshots, those snapshot rows are skipped); evidence-loop steps keyed by adaptationId+iteration+toolId+timestamp (collapses staging/final copies and the three snapshot files); recovery calls by requestId; verification by requestId. 6601 rows after dedupe.

## Tables

### By task kind

| group | n | median | p90 | p99 | max | finish=length (max_tokens) |
|---|---|---|---|---|---|---|
| panel_command | 4 | 94 | 107 | 107 | 107 | 0 |
| evidence_tool_decision | 6119 | 101 | 177 | 469 | 593 | 0 |
| runtime_diagnosis/gather | 36 | 440 | 640 | 688 | 688 | 0 |
| evidence_tool_decision/gather | 99 | 89 | 309 | 530 | 530 | 0 |
| runtime_diagnosis/plan | 12 | 413 | 533 | 595 | 595 | 0 |
| result_verification | 38 | 468 | 656 | 737 | 737 | 0 |
| repair:runtime_diagnosis | 48 | 429 | 595 | 688 | 688 | 0 |
| repair:evidence_tool_decision | 99 | 89 | 309 | 530 | 530 | 0 |
| runtime_patch/implement | 17 | 265 | 422 | 530 | 530 | 0 |
| repair:runtime_patch | 17 | 265 | 422 | 530 | 530 | 0 |
| repair:? | 18 | 493 | 703 | 737 | 737 | 0 |

Largest 5, panel_command:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 107 | run-muqbzu32-8691a65e | 0001-chat | lab-runs | {"do": "flow.createHere", "with": {"instruction": "Find every pair of wireless earbuds in the sto... |
| 94 | run-muqbzqtu-4e6299f9 | 0001-chat | lab-runs | {"do": "flow.createHere", "with": {"instruction": "Switch my pickup store to Millbrook Crossing S... |
| 94 | run-muqclqt5-b04525e8 | 0001-chat | lab-runs | {"do": "flow.createHere", "with": {"instruction": "Switch my pickup store to Millbrook Crossing S... |
| 86 | run-muqc07fh-eeffbc86 | 0001-chat | lab-runs | {"do": "flow.createHere", "with": {"instruction": "On Farbazaar, put three of the Voltbay USB-C h... |

Largest 5, evidence_tool_decision:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 593 | run-munw7ffn-fe1cecd2 | build it 11 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 592 | run-munnhi5q-4867dabe | build it 15 | decision-trace.json | core.run_node web.output.dom-extract_list web.inspect.succeeded |
| 586 | run-munw7ffn-fe1cecd2 | build it 27 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 583 | run-muntc23v-7fcc4110 | build it 21 | flow-lane.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 583 | run-munw7ffn-fe1cecd2 | build it 22 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |

Largest 5, runtime_diagnosis/gather:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 688 | run-muo00owc-84c87cbc | recovery#1 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.gather |
| 674 | run-muo0ks69-b23d295e | recovery#1 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.gather |
| 650 | run-muq4oaof-464f5bce | recovery#1 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.gather |
| 640 | run-munysgq5-ca565f1b | recovery#1 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.gather |
| 591 | run-muny76m9-bab4e6ba | recovery#1 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.gather |

Largest 5, evidence_tool_decision/gather:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 530 | run-munojusu-26a9ad62 | recovery#6 | decision-trace.json | automation-studio.evidence-tool-decision.v1+stage.gather |
| 441 | run-munyt4jo-dc4e704a | recovery#7 | decision-trace.json | automation-studio.evidence-tool-decision.v1+stage.gather |
| 390 | run-munvhy0t-f5657a08 | recovery#8 | decision-trace.json | automation-studio.evidence-tool-decision.v1+stage.gather |
| 359 | run-muny76m9-bab4e6ba | recovery#6 | decision-trace.json | automation-studio.evidence-tool-decision.v1+stage.gather |
| 353 | run-munzdnld-ff8f14c8 | recovery#3 | decision-trace.json | automation-studio.evidence-tool-decision.v1+stage.gather |

Largest 5, runtime_diagnosis/plan:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 595 | run-munojusu-26a9ad62 | recovery#7 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.plan |
| 533 | run-munzdnld-ff8f14c8 | recovery#4 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.plan |
| 498 | run-munutuvf-6a1c548a | recovery#5 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.plan |
| 481 | run-munu4b4y-4e15662e | recovery#12 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.plan |
| 461 | run-munzpdlu-4a6d83c3 | recovery#8 | decision-trace.json | automation-studio.runtime-diagnosis.v1+stage.plan |

Largest 5, result_verification:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 737 | run-muq66ff9-cb3767a1 | verification check 2 | live-llm.json | llm.loop_verification.455818df-0e5f-420d-8711-2d34f4dd6f51 |
| 703 | run-muq66ff9-cb3767a1 | verification check 2 | live-llm.json | llm.loop_verification.e12f065f-7421-4346-95c9-f95611eb43f1 |
| 680 | run-muq66ff9-cb3767a1 | verification check 1 | live-llm.json | llm.loop_verification.68bf58e0-58ec-4c7c-8930-778ae6c82a2e |
| 656 | run-muq4oaof-464f5bce | verification check 1 | live-llm.json | llm.loop_verification.1db79de5-1fa3-4062-b869-db6182d050c1 |
| 593 | run-muq66ff9-cb3767a1 | verification check 1 | live-llm.json | llm.loop_verification.29981c44-6d12-42ac-aed1-913312163563 |

Largest 5, repair:runtime_diagnosis:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 688 | run-muo00owc-84c87cbc | repair | live-llm.json | automation-studio.runtime-diagnosis.v1+stage.gather |
| 674 | run-muo0ks69-b23d295e | repair | live-llm.json | automation-studio.runtime-diagnosis.v1+stage.gather |
| 650 | run-muq4oaof-464f5bce | repair | live-llm.json | automation-studio.runtime-diagnosis.v1+stage.gather |
| 640 | run-munysgq5-ca565f1b | repair | live-llm.json | automation-studio.runtime-diagnosis.v1+stage.gather |
| 595 | run-munojusu-26a9ad62 | repair | live-llm.json | automation-studio.runtime-diagnosis.v1+stage.plan |

Largest 5, repair:evidence_tool_decision:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 530 | run-munojusu-26a9ad62 | repair | live-llm.json | automation-studio.evidence-tool-decision.v1+stage.gather |
| 441 | run-munyt4jo-dc4e704a | repair | live-llm.json | automation-studio.evidence-tool-decision.v1+stage.gather |
| 390 | run-munvhy0t-f5657a08 | repair | live-llm.json | automation-studio.evidence-tool-decision.v1+stage.gather |
| 359 | run-muny76m9-bab4e6ba | repair | live-llm.json | automation-studio.evidence-tool-decision.v1+stage.gather |
| 353 | run-munzdnld-ff8f14c8 | repair | live-llm.json | automation-studio.evidence-tool-decision.v1+stage.gather |

Largest 5, runtime_patch/implement:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 530 | run-muq4oaof-464f5bce | recovery#2 | decision-trace.json | automation-studio.runtime-patch.v1+stage.implement |
| 422 | run-munvhy0t-f5657a08 | recovery#9 | decision-trace.json | automation-studio.runtime-patch.v1+stage.implement |
| 333 | run-munysgq5-ca565f1b | recovery#6 | decision-trace.json | automation-studio.runtime-patch.v1+stage.implement |
| 309 | run-munymcpf-93148576 | recovery#2 | decision-trace.json | automation-studio.runtime-patch.v1+stage.implement |
| 299 | run-munnyvbr-11c28a0f | recovery#2 | decision-trace.json | automation-studio.runtime-patch.v1+stage.implement |

Largest 5, repair:runtime_patch:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 530 | run-muq4oaof-464f5bce | repair | live-llm.json | automation-studio.runtime-patch.v1+stage.implement |
| 422 | run-munvhy0t-f5657a08 | repair | live-llm.json | automation-studio.runtime-patch.v1+stage.implement |
| 333 | run-munysgq5-ca565f1b | repair | live-llm.json | automation-studio.runtime-patch.v1+stage.implement |
| 309 | run-munymcpf-93148576 | repair | live-llm.json | automation-studio.runtime-patch.v1+stage.implement |
| 299 | run-munnyvbr-11c28a0f | repair | live-llm.json | automation-studio.runtime-patch.v1+stage.implement |

Largest 5, repair:?:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 737 | run-muq66ff9-cb3767a1 | repair | live-llm.json | automation-studio.loop-verification.v1 |
| 703 | run-muq66ff9-cb3767a1 | repair | live-llm.json | automation-studio.loop-verification.v1 |
| 680 | run-muq66ff9-cb3767a1 | repair | live-llm.json | automation-studio.loop-verification.v1 |
| 593 | run-muq66ff9-cb3767a1 | repair | live-llm.json | automation-studio.loop-verification.v1 |
| 569 | run-muq310ht-ab80eed0 | repair | live-llm.json | automation-studio.loop-verification.v1 |

### evidence_tool_decision by decision kind

| group | n | median | p90 | p99 | max | finish=length (max_tokens) |
|---|---|---|---|---|---|---|
| all | 6119 | 101 | 177 | 469 | 593 | 0 |
| tool_call | 4076 | 98 | 130 | 261 | 592 | 0 |
| complete | 61 | 153 | 208 | 268 | 268 | 0 |
| amend_draft | 1303 | 92 | 364 | 575 | 593 | 0 |
| error(no decision) | 1 | 400 | 400 | 400 | 400 | 0 |
| error | 678 | 141 | 198 | 259 | 580 | 0 |

Largest 5, all:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 593 | run-munw7ffn-fe1cecd2 | build it 11 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 592 | run-munnhi5q-4867dabe | build it 15 | decision-trace.json | core.run_node web.output.dom-extract_list web.inspect.succeeded |
| 586 | run-munw7ffn-fe1cecd2 | build it 27 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 583 | run-muntc23v-7fcc4110 | build it 21 | flow-lane.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 583 | run-munw7ffn-fe1cecd2 | build it 22 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |

Largest 5, tool_call:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 592 | run-munnhi5q-4867dabe | build it 15 | decision-trace.json | core.run_node web.output.dom-extract_list web.inspect.succeeded |
| 579 | run-munw7ffn-fe1cecd2 | build it 6 | decision-trace.json | core.run_node web.output.dom-extract_list web.inspect.succeeded |
| 577 | run-munw7ffn-fe1cecd2 | build it 34 | decision-trace.json | core.run_node web.output.dom-extract_list web.inspect.succeeded |
| 576 | run-muntc23v-7fcc4110 | build it 10 | flow-lane.json | core.run_node web.output.dom-extract_list web.inspect.succeeded |
| 564 | run-munw7ffn-fe1cecd2 | build it 33 | decision-trace.json | core.run_node web.output.dom-extract_list web.inspect.succeeded |

Largest 5, complete:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 268 | run-munzrj6r-6f754710 | build it 38 | decision-trace.json | core.decision_complete   |
| 226 | run-munysgq5-ca565f1b | build it 44 | decision-trace.json | core.decision_complete   |
| 217 | run-munyt4jo-dc4e704a | build it 49 | decision-trace.json | core.decision_complete   |
| 212 | run-munwk8ta-7e41caf7 | build it 26 | decision-trace.json | core.decision_complete   |
| 211 | run-muo2gyob-a3877079 | build it 42 | decision-trace.json | core.decision_complete   |

Largest 5, amend_draft:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 593 | run-munw7ffn-fe1cecd2 | build it 11 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 586 | run-munw7ffn-fe1cecd2 | build it 27 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 583 | run-muntc23v-7fcc4110 | build it 21 | flow-lane.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 583 | run-munw7ffn-fe1cecd2 | build it 22 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |
| 582 | run-munv53gt-a0e6f545 | build it 6 | decision-trace.json | core.decision_amend_draft  llm_evidence_loop.draft_rerun |

Largest 5, error(no decision):

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 400 | run-muqbzu32-8691a65e | 0023-decide | lab-runs | error llm.provider_malformed_response |

Largest 5, error:

| out | run | step/iteration | source | summary |
|---|---|---|---|---|
| 580 | run-muq66ff9-cb3767a1 | build it 20 | decision-trace.json | core.decision_unusable  llm.provider_malformed_response |
| 578 | run-muq66ff9-cb3767a1 | build it 22 | decision-trace.json | core.decision_unusable  llm.provider_malformed_response |
| 446 | run-muq66ff9-cb3767a1 | build it 29 | decision-trace.json | core.decision_unusable  llm.provider_malformed_response |
| 378 | run-muq310ht-ab80eed0 | build it 37 | decision-trace.json | core.decision_unusable  llm.provider_malformed_response |
| 357 | run-muq310ht-ab80eed0 | build it 28 | decision-trace.json | core.decision_unusable  llm.provider_malformed_response |

### Finish reasons / validation

- panel_command -> stop: 4
- evidence_tool_decision -> stop: 84
- repair:runtime_patch -> invalid: 7
- runtime_patch/implement -> invalid:llm_output.unexpected_field,llm_output.unsupported_runtime_patch,llm_output.invalid_risk: 1
- result_verification -> invalid: 2
- repair:? -> invalid: 5
- runtime_patch/implement -> invalid:llm_output.unexpected_field,llm_output.unsupported_runtime_patch: 2
- runtime_patch/implement -> invalid:llm_output.invalid_risk: 1

max_tokens in lab request.json: panel_command: 600; evidence_tool_decision: 8000

UTF-8 message bytes per reported input token (lab-runs, n=88): min 3.275, median 4.087, max 4.587

Corpus: 3627 snapshot files; 1222 distinct snapshot run ids; lab runs 4 (2026-10-01: 4); overlap lab/snapshot 4; rows after dedupe 6601; parse errors 4
- C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqbzqtu-4e6299f9/steps/index.md: ENOENT: no such file or directory, open 'C:\Users\osrs_\FluxStuff\lab-runs\2026-10-01\run-muqbzqtu-4e6299f9\steps\index.md\meta.json'
- C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqbzu32-8691a65e/steps/index.md: ENOENT: no such file or directory, open 'C:\Users\osrs_\FluxStuff\lab-runs\2026-10-01\run-muqbzu32-8691a65e\steps\index.md\meta.json'
- C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqc07fh-eeffbc86/steps/index.md: ENOENT: no such file or directory, open 'C:\Users\osrs_\FluxStuff\lab-runs\2026-10-01\run-muqc07fh-eeffbc86\steps\index.md\meta.json'
- C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqclqt5-b04525e8/steps/index.md: ENOENT: no such file or directory, open 'C:\Users\osrs_\FluxStuff\lab-runs\2026-10-01\run-muqclqt5-b04525e8\steps\index.md\meta.json'

## Commands run and observed results

- `find ... -path '*snapshots/*' (live-llm|decision-trace|flow-lane).json > files.txt` -> 3627 files.
- `node t234-reply-sizes.js files.txt t234-tables.md` -> rc 0, tables above. Only parse "errors" are the 4 `steps/index.md` entries (not step directories; harmless).

## Not verified

- Finish reason is recorded only in the 4 lab runs (88 calls, all `stop`). For the 6000+ snapshot decisions no finish reason exists, so truncation there is inferred only: no reply came near the 8000 max_tokens (max 593; lab request.json max_tokens is 8000 for evidence_tool_decision, 600 for panel_command). Older snapshots' max_tokens were not recorded per call; live-llm.json declares maxOutputTokens 8000.
- Byte/token ratio comes from the 88 lab calls only (snapshots carry no request bytes).
- Snapshot run dates were not tabulated; lab runs are all 2026-10-01.

## Open questions or contradictions found

- The `repair:*` rows (live-llm.json `repair.observed.observedCalls`, requestId null) are the same calls as the `runtime_*`/`evidence_tool_decision/gather` recovery rows from decision-trace.json (identical n and top values); they double count and should be ignored. `repair:?` (taskKind null, promptVersion loop-verification) duplicates `result_verification`.
- `runtime_patch` calls that failed validation are charged as reserved 8000 output tokens in `charged`; the script used `reported` only, so those are excluded where unreported.
- The largest tool_call replies (~590) are `dom-extract_list` calls; amend_draft p99 575 and error replies up to 580 are `llm.provider_malformed_response` in run-muq66ff9.
