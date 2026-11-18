# t893 continuation failure diagnosis

2026-11-12. Read-only diagnosis of `run-mwdzlni1-09cd2450`, using its existing synthetic run metadata, decoded decision/judge requests, and the relevant scripted-model and shared Core source. No source edits, tests, browser launches, paid calls, or git mutations.

## Finding

The immediate stop was a fixture-script refusal: the `notes-back` script provides three `loop_verification` replies for the entire series, and the third attempt needed reply four. The underlying repeat failure was already visible before that refusal: both saved Flow replays returned zero result rows. Attempt 2 recovered the correct table by exploring Messaging, but its result-producing read remained an unadded draft step. Its saved executable Flow gained the Messaging navigation click without the read that produced the answer.

This is not evidence that the save code discarded a kept producer. The explicit draft contract distinguishes a call that was taken as evidence from a step the model added to its Flow. The missing seam is reconciliation between the selected final result's actual producer and the authored executable Flow before saving. Increasing the script's allowed judge calls would expose more repetitions of the same incomplete Flow, not repair that seam.

## What completed

Both completed attempts used Flow `flow.0facafdc-f2b9-441c-89a5-2759cf9ffa84` and saved it as `partly_works` / `unproven`. There was no reseed between them.

| Attempt | Path and runtime | Calls | Oracle/result evidence | Saved continuation |
| --- | --- | --- | --- | --- |
| 1 | `explore`, 14,620 ms; 14 live steps | Script/report: 14 = 1 interpretation + 12 decisions + 1 judge. Core attempt spend: 13, excluding the preceding chat interpretation. | `achieved`; answer score `right`; records, final state, change and shown result all `held`; 3 stored and 3 shown rows; no repeated/missing/unasked acts. | First attempt: no predecessor. Saved proposed-step digest `d30044e298aaa975a4249f1c7575d213e9c69fa5f609bdcbf80082067c6f5c6d`. |
| 2 | `run_flow_then_explore`, 7,702 ms; 8 live steps | Script/report and Core spend: 6 = 0 interpretations + 4 decisions + 2 judges. The saved Flow itself made no model calls; the judge and later exploration did. | `achieved`; answer score `right`; the same four checks `held`; 3 stored and 3 shown rows; no repeated/missing/unasked acts. | `startedFrom.route = use`; predecessor attempt ID and digest exactly match attempt 1. Lab proof `1 -> 2` is `held`, with no refusal. Saved proposed-step digest changed to `1dbb9a129a1015ee4e213a0aab229d3d119bef41ac7cb6f11338dbc5657832e9`. |

The report's legacy `oracleVerdict` column is null for both; their concrete answer scorer above is the available oracle evidence. Neither completed attempt proves a deterministic replay or a proven whole Flow. The provider/spend are scripted stand-ins; the report's dollar figures are synthetic counters, not billed provider spend.

Attempt 3 did not complete or receive an answer score, so no complete runtime or persisted `2 -> 3` continuation proof is available in this partial report. Its record says 16 logged steps and zero interpretation calls. The call log contains one refused judge (ordinal 4) and one answered decision (ordinal 17) during it. Attempt 4 never began. The only completed later attempt was attempt 2; the required three later deterministic attempts remain unaccepted.

## Why attempt 2 explored

The first exploration accepted the three matching invitations and obtained the requested table with `read-accepted` (step folder `0027-tool-core.run_node`). Its next decision's draft view (`model/evidence_tool_decision-012.request.json`) shows that read as draft step 10, disposition `taken`, while the invitation read and repeat act are `kept`.

The repeat ran on the site as left. Its saved invitation read had no invitations left to answer; the engine reached the Flow's end but its result summary contained zero rows. Step `0041-note` records `flow_not_proven`. Judge 2 (`0042-judge`, decoded `loop_verification-002`) saw zero rows and rejected the missing table. That is an honest result check, not the earlier Close/Accept act-identity defect recurring.

The four subsequent decisions opened Messaging, detected its conversation structure, read the three matching conversation notes, and completed. Judge 3 saw three rows and passed. The final decision's draft view (`evidence_tool_decision-016`) shows the new Messaging click as step 12 / `kept`, but `back-read` as step 14 / `taken`. Consequently, changing the saved digest proves the Flow changed; it does not prove the successful recovery read became executable.

## Why attempt 3 asked another judge

Its engine replay includes the saved Messaging click (`0063-flow-web.output.dom-click`) after the original invitation sequence, but no executable Messaging read. Decoded `loop_verification-004.request.json` again has zero total records and no record sets. Step `0064-note` again names `flow_not_proven`.

That extra check is required by the current replay contract. `completion/replay-stands.ts:50` refuses acceptance on the record when the exact saved Flow has no judged whole run. `attempt/remember.ts:63` only sets whole-run proof from an actual saved-Flow run judged yes and sent out. Attempt 1 was exploration; attempt 2's initial whole replay was judged no. A successful later exploratory read therefore cannot make the saved Flow proven. Even with proof, the empty/nonempty result shape mismatch would still prevent accepting this replay on its record.

The script then failed at its fourth judge: `professional-network-accept-messaged-invitations.ts:207` supplies only three entries, and `scripted-model/model-server.ts:90` refuses an ordinal with no reply. The judge error is therefore a local script refusal, not an external provider outage. Core carried on to a round, but the Lab ended the series as unscored after observing the refusal.

## Exact ownership and contract distinction

Downstream paths below are relative to t893; Core paths are relative to its shared sibling `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ`.

- `packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts:95` (`readBack`) and `:121` (`readNotesBack`) call `toolCall` for the final reads without its `add` argument or a `write` instruction. Their `recordOutput` requests dataset storage and schema; it does not author a Flow step.
- The same directory's `evidence.ts:46` defaults `add` to false, whereas `pressOf` at `:51` passes true. That explains precisely why navigation was kept and the answer read was not.
- Core `packages/fluxiq/src/runtime/llm/evidence-loop-decision.ts:507` normalizes an authored addition only from `add`, `act`, `place`, or a written call. `runtime/llm/evidence-loop.ts:180` appends an evidence step as `taken` and makes it `kept` only through the authoring mechanism. `runtime/flow-authoring/draft/step.ts:416` admits only `kept` proposable steps. Its documented contract deliberately forbids blindly adding every exploratory call.
- Core `framework/automation-service/service/answer-first/attempt/call-chain.ts:96` stores the live read's rows independently through `sink.fromCall`. `rows/row-sink.ts:218` selects the result dataset; its summary can stand without an authored producer.
- Core `attempt/round.ts:109` copies the live draft into `run.steps`; `:159` accepts/rejects result completion. This is the bounded producer-to-authoring seam while an authoring round can still repair its draft. The saved trace proves the final producer is known there but remains `taken`.
- Core `attempt/ending.ts:51` calls `SaveDraft`; `attempt/draft-save.ts:34` assembles from `run.steps` and saves a candidate best-effort. `attempt/remember.ts:30` hashes proposed steps and records the checked rows' shape separately. Memory may retain the full evidence transcript, including taken reads, but its executable candidate and proposed-step digest do not contain those reads. The defect is the missing correspondence, not loss of the transcript.

There is also a separate script routing assumption. `afterAnAnswer` at script line 146 recognizes a fresh post-acceptance page only as Received invitations / My Network, unless that attempt already has a `back-*` call. Attempt 3's saved navigation ends on Messaging and its new evidence has no such call. The script therefore goes through `clearAndArrive`, and decision 17 / `0067-decide` asks to open My Network instead of continuing the notes read. This assumption would affect recovery after a judge refusal even after the immediate three-reply limit was addressed. It does not explain why the producer was absent from the executable Flow.

## Bounded next fix and t905 overlap

Coordinate a Core follow-up with t905's current executable-source/save work; do not create a second source-authority implementation downstream. The lead reports that t905 validates producer correspondence only among retained authored steps and does not automatically retain reads. Its exact-source check cannot reconstruct a producer the authoring stage never kept.

The next unit should connect the selected result dataset to its actual successful call/draft-step provenance at the row-sink / call-chain boundary, carry that identity into completion, and reconcile it with the authored Flow while `attempt/round.ts` can still request a draft amendment. Where the producing step is not kept, repair that incomplete authored save or report the Flow as incomplete; do not silently claim a reusable result-producing candidate. Preserve the answer already obtained, the explicit authoring contract, and t905's ledger-to-authored plus resolved-to-assembled correspondence checks. The guard belongs before `SaveDraft`, with a final save-boundary check; `remember.ts` alone is too late to invent author intent or assemble an omitted producer.

Use a generic producer/draft reconciliation mechanism, not automatic retention of arbitrary probes, task-specific `add=true` changes, injected output rows, extra judge allowance, or weakened oracle criteria. Targeted future validation should cover a result read left `taken`, a genuinely exploratory/intermediate read remaining unkept, an authored alternative producer, and a recovery read with its required navigation. Only after the Core unit passes should the unchanged four-attempt t893 scenario be launched again and its script's Messaging routing be reconciled with the generic protocol. That future validation was not run here.

## Return contract

Outcome: Done
Changed: `docs/working/mvp-launch-plan/reports/codex-t893-continuation-diagnosis.md`
Validation: Not run (read-only brief). Inspected `attempt.json`, `attempt-report.txt`, `steps/index.md`, whitelisted model-call/judge/draft metadata, and the source paths above; observed two achieved/right attempts, one held continuation, two empty replays, and refusal of judge ordinal 4.
Not verified: No new execution, fixed behavior, completed attempt 3, attempt 4, deterministic acceptance, or t905 implementation validation; no page payloads or credentials are included in this report.
Report: `docs/working/mvp-launch-plan/reports/codex-t893-continuation-diagnosis.md`
Notes: No source or script changes. t905 owns overlapping source/save authority. Ready for the lead to assign the producer-to-authoring follow-up.
