# t893 result producer reconciliation design

2026-11-12. Read-only design following `codex-t893-continuation-diagnosis.md`. Context: current source in t905's paired Core, `C:/Users/osrs_/FluxStuff/fxwork/t905/!FluxIQ`. That checkout has an active writer; this report neither changes it nor treats its unrun tests as passing evidence.

## Decision

Integrate the accepted t905 result protocol before inventing another Core mechanism. The generic mechanism requested by the diagnosis already exists in that source: a read outside the authored Flow is a look; the author explicitly takes its actual call into the Flow; the result ledger then uses that kept read, and the save guard verifies the assembled executable producer. No new ledger, automatic read retention, output injection or weaker correspondence is needed.

The bounded next implementation is a fixture-author protocol correction in t893's professional-network scripted author and its existing adjacent test: explicitly `take` the read it intends as the final result, and recognize Messaging when a saved navigation already left the page there. Keep the existing task, scenario, oracle, judge replies and call allowance unchanged. This is a test author's use of the public authoring protocol, not production knowledge of professional-network.

No additional missing Core product seam was established by the inspected source. The old t893 run predates t905's ledger wiring. Its answer came from an unkept read; current t905 does not promote that read behind the author's back. Its existing code provides the authoring feedback and the repair operation. Whether the corrected saved producer really replays on the changed site still needs direct validation after integration.

## Existing contracts to reuse

Paths in this section are relative to t905 Core under `packages/fluxiq/src/`.

| Boundary | Existing input and output | Consequence for this work |
| --- | --- | --- |
| `framework/automation-service/service/answer-first/attempt/call-chain.ts`, `result-feed/feed.ts` | `called(call, answer, storedRows)` receives the actual call ID, input, domain answer and rows the sink successfully stored. `expect({kind: "add", ...})` or `expect({kind: "rerun", step})` determines draft intent; absent intent records a `look`. | Storage is not authoring. Reuse the real call identity; never infer a producer from matching row values or from the latest arbitrary read. |
| `result/types.ts`, `result/ledger.ts` | Events are `page`, `step`, `look`, `take`, `dropped`, `paging`. A look carries `source`, its conditions/fields/list identity and actual kept rows. `take` names that source and a real draft step reference. | This already supplies producer provenance. Do not add another selected-result dataset map. |
| `result/output-step.ts`, `result-feed/feed.ts` | `outputStep()` selects the last non-intermediate authored read, with folded reads accounted for. `rows()` and `evidence()` derive the answer and judge evidence from it. | A look can leave an earlier nonempty output standing. Completion need not be empty to tell the author that its intended later read was not added. |
| `runtime/flow-authoring/draft/amendment/{types,schema,apply}.ts` | External decision: `{"kind":"amend_draft","amendments":[{"change":"take","call":"<actual-read-call-id>"}]}`. `takenAs` locates the unreplaced draft step that actually ran that call and applies the existing `add` path. | The executable step is retained, including its recorded `ranWith`; this is not a ledger-only copy of rows. Existing add checks and opener retention apply. No new browser action or repeat of the read is needed. |
| `result-feed/feed.ts`, `attempt/decide.ts` | `draft(run.steps)` observes the now-kept step, records `take` for its look and keeps its current version. The next decision receives the ledger's fixed `core.result` slot. `decide.ts` refreshes this before each decision. | The author can take once, see the changed draft/result and complete. Do not create a second post-completion compiler or a model call after achievement. |
| `completion/check.ts`, `attempt/run-attempt.ts` | `emptyResult: () => result.emptyRefusal()` returns `answer_first.result_empty` before a judge when rows are requested, the authored result is empty and looks hold rows. | Existing feedback keeps an incomplete authored result repairable inside the live round. A correct adopted result can then be judged normally. |
| `attempt/draft-save.ts`, `result/output-saved.ts` | `SaveDraft` assembles from authored steps; `OutputSaved(output, savedReads)` checks ledger -> written input and recorded resolution -> assembled read. t905's active source-identity writer owns strengthening exact executable identity. | Preserve both correspondence checks. The final save guard remains; do not bypass it because rows looked right. |

`result-feed/tests/service.test.ts` already contains a service-level case named “a completion on looks alone is refused naming take, and taking the look makes its rows the result.” It sends a read without add, completion, `take`, then completion, and asserts the resulting rows. This is inspected test intent, not a fresh test result. The save-check tests also describe missing producer and changed authored/executable versions. Neither assertion alone proves the later real-engine replay.

## Generic feedback and the scripted author's response

t905 attaches a `resultNote` string to a read's evidence answer. The ordinary form is:

```text
a look: the result is unchanged (step <n>, <count> rows).
```

When the authored result is empty, the same line additionally names `amend_draft`, `change "take"` and that read's actual call ID. Completion feedback uses code `answer_first.result_empty` and names the row-holding looks plus the same operation. The fixed `core.result` evidence entry carries `value.result`, a header string; the ordinary `core.flow_draft` view independently shows each read's disposition (`taken` or `kept`). None of this licenses adopting all looks.

For each final-result branch, the script already knows which actual call it deliberately made: `read-accepted` or `back-read`. After that call succeeds, inspect the draft's corresponding latest read step. While it remains `taken`, return the explicit `take` amendment for that call. After the next draft shows it `kept`, complete. Do not reread the page to make the amendment, replace its input, pass `add=true` to every read, or take working/probe reads. A dropped or exploratory step must not be silently restored; that state is a diagnosis rather than a successful take.

Do not wait only for `result_empty`: the invitation read can already hold three rows while the intended accepted/Messaging read remains a look. Its generic “result is unchanged” note and the draft disposition expose precisely that difference. Selecting the later call is an explicit choice made by this scripted author, just as a real author would choose an output step. If a work read is marked intermediate, use the existing `recordOutput.purpose: "intermediate"` contract; never infer intermediate status merely because some later probe ran.

The separate routing correction is small: `afterAnAnswer` must recognize the actual Messaging page as a post-acceptance landing even when the new attempt has no `back-*` calls yet. `readNotesBack` then uses the current page, detects the conversations if needed, reads its intended result and takes that read. It must not navigate back to My Network solely because its per-attempt call history is empty. No Core or oracle code needs professional-network page names.

## How later runs become deterministic

Taking the actual producer means the saved candidate contains an executable read plus its required authored navigation. The next engine run queries the site again and emits new record batches for that saved read. The ledger receives those batches under the same authored step identity, derives the answer from their current rows and checks it normally. Saved preview rows and an earlier read's transient handle are not replay inputs or substitutes for current evidence.

Changed site state requires an honest authored path. After an accept action, a list of pending invitations may become empty; retaining that list does not make its old rows current. A recovery that finds the requested information in Messaging must keep the real Messaging producer and navigation as part of its Flow, preserving the existing act record's protection against accepting twice. Core cannot deduce an alternate durable source from row equality or a task's fixture name. The script has already found that source; its missing authoring operation is `take`.

Retention makes a model-free engine result possible; it does not itself make the Flow proven. The first whole run of the exact repaired candidate still needs its existing check. Only after a whole replay is accepted may unchanged later replays use the existing on-record rule at zero model calls. A new source, failed step, changed output shape or other real deviation continues through the ordinary judge/repair path. Do not set `provenWhole` from an exploratory answer or from a successful `take`.

Keep the script's existing three judge replies. The corrected author should remove repeated replay of the omitted producer, but this read-only design cannot promise the exact remaining judge count. If an otherwise honest four-attempt series still needs a fourth judge, report where and why; do not increase the allowance, suppress a check or call that series deterministic. A count of three cannot justify skipping the proof required for a new Flow. The next run must resolve that with evidence.

## Exact proposed ownership

After t905 is accepted and integrated, the next bounded implementation owns only these downstream files in the t893 checkout:

1. `packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts` — explicitly take the deliberately chosen successful final read before completion; recognize a fresh attempt already on Messaging.
2. `packages/test-runner/src/attempt-lane/scripted-model/scripts/tests/professional-network-accept-messaged-invitations.test.ts` — cover that authoring and landing-state behavior with synthetic evidence.

It must not edit `scripts/evidence.ts`, global scripted-model routing, the oracle, fixtures, task wording, result rows, judge allowance, Core's result ledger or t905's identity writer. No new Core product files are justified by this diagnosis. If narrow direct validation demonstrates a missing product seam after integration, report the failed boundary before broadening scope; a follow-up can then own that exact Core module and its adjacent test.

## Regression cases and acceptance

The focused script tests should expose these errors, without launching a browser:

- `read-accepted` has succeeded but the final read is `taken`: the next decision is `take` of that actual call, not completion or another `core.run_node`. Once kept, the next decision completes without repeating the amendment.
- The identical contract for `back-read`: taking the real result source must not cause another acceptance act, read, or navigation.
- An earlier kept work read has nonempty rows and the intended later read's note says “look/result unchanged”: the intended read is still taken explicitly. Do not require an empty-result refusal to notice it.
- A successful `take` leaves other probe/structure reads alone; a probe is never adopted merely because it returned more or newer rows.
- A new attempt begins on Messaging with no `back-*` history: it stays there and follows the normal conversation read path instead of opening My Network. Existing invitation landing behavior remains covered.
- Generic `answer_first.result_empty` / look feedback is answered by authoring the chosen read; wrong forms still refuse, the existing judge array remains length three, and the judge still rejects zero rows.

Then run the documented narrow checks for those two files/package and directly inspect their output. Finally, under the lead's normal Lab authorization, run the same professional-network task/form with four attempts and unchanged scenario/oracle. Record the candidate's real output read, each predecessor digest/Flow identity, current dataset evidence, answer score, path, model call kinds and time. Three synthetic unit assertions do not prove a saved candidate runs. No such checks or run were performed in this design task.

## Answer, purse and Stop semantics

The correction belongs in ordinary authoring before completion. A `take` adds no page act and consumes no browser call; if chosen by a model, that authoring decision is still counted on the existing purse. No extra calls may run after budget exhaustion or a person's Stop. Pending reads and look evidence remain recorded under existing persistence; neither condition creates a fabricated result or a new failure ending.

Already-achieved answers remain achieved. A final candidate save/assembly refusal must not erase the checked answer, restart the task, spend after completion or downgrade its result because the Flow is incomplete. Existing best-effort save and `partly_works`/unproven distinctions remain. Conversely, an unadopted look that is not the current ledger result is not promoted to an achieved answer by this design. Its author can take it within the ordinary task loop, subject to the existing budget and Stop behavior.

## Return contract

Outcome: Done
Changed: `docs/working/mvp-launch-plan/reports/codex-t893-producer-reconciliation-design.md`
Validation: Not run (read-only design). Inspected the existing diagnosis and bounded t905 call-chain, round, result ledger/feed, take amendment and save correspondence source/test declarations.
Not verified: No new product defect reproduced; no tests, builds, browser runs, saved-candidate replay, t905 acceptance, or exact post-correction judge count verified.
Report: `docs/working/mvp-launch-plan/reports/codex-t893-producer-reconciliation-design.md`
Notes: Reuse t905's existing take/ledger/save protocol. Next implementation is two downstream script/test files. Preserve scenario, oracle and current call allowance.
