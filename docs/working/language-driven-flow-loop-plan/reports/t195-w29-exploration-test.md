# t195-w29: deepseek-bootstrap-exploration.test.ts meets the judge and the answerability note

## Outcome

Done. `R/tests/deepseek-bootstrap-exploration.test.ts` passes 11/11 against Core `fxwork/t195/!FluxIQ` (dev `4e8106c1` plus the lead's uncommitted fixes). The package typecheck is clean. Only that file changed.

R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## What changed and why

### Stub endpoint (`endpoint()`, `create()`)

- `endpoint` now answers `loop_verification` like a judge.
  - It replies with the diagnosis envelope `{kind:"diagnosis", summary, diagnosis:{answersRequest, expected?, observed?, changed?}}`.
  - Each judge call is billed at its own figures, `JUDGE_BILLED` = 400 in / 40 out, so the accounting can tell judge calls from decisions (1,200 / 150).
  - Judge calls are counted apart from decisions: they never touch `sentIterations`, `observations`, or the decision `call` counter that `reply` receives.
- Each judge call is recorded in `Creation.judgeRequests`:
  - `call`;
  - `notes`, from `context.resultSummary.buildTest.notes`;
  - `stepCount`, from `buildTest.steps.length`.
- `create()` takes `judge?: (judgeCall) => JudgeReply`. The default is `yes`.
- `endpoint` now takes a single options object.
- `DecisionObservation` gains `resumed`: the `core.resumed` entry a later round's decisions are shown (`llm/evidence-loop/resume.ts`).
- `repeatedBuildReply(call, convergesAt?)` replaces the old `convergesAtEleven` boolean.
- New constant `JUDGE_NO`: the judge's honest `no`, with `expected`, `observed` and `changed` (`changed` is read as `advice`).

### Cases

1. **"asks again after a malformed decision ..."**
   - `revealed` is 4: 3 decisions plus 1 judge call (`yes`, so it is asked once).
   - `judgeRequests` has length 1.
   - The audit has `providerCallCount: 3`, `additionalProviderCallCount: 1`, `totalProviderCallCount: 4`, `decisionCount: 3`, `toolCallCount: 1`.
2. **"asks again after a provider decision reaches its deadline"**: the same counts (`revealed` 4, and the same audit counts).
3. **"records a build's token totals past one request's ceiling ..."**
   - This case was not among the four failing ones. It passed before only because the judge's call threw, and a failed judge spends nothing (`judge.ts` `NOTHING_SPENT`).
   - With a judge that answers, its one call is in the build's totals, by design (phases.ts:249 `addAccounting(spent, judgeAccounting(...))`).
   - It now expects 50,400 / 10,040 / 60,440. There is a comment saying why.
4. **"26-decision"**, renamed "accepts the measured run's unanswerable completion, judges it with the answerability note, and ends on the call budget after the judge's no".
   - `run-mulryg6h-ff241a12` is kept as history in a comment above the case.
   - It asserts:
     - The completion at decision 10 is accepted and judged, not refused. No observation carries `core.completion_check` feedback, no step has resultCode `bootstrap.cannot_answer_instruction`, and the failure's `issueCodes` does not contain it.
     - Every judge request carries `notes: [{code: "bootstrap.cannot_answer_instruction", columns: ["name","price"], ...}]`.
     - The judge's `no` (asked twice) sends the build into a second round. All 16 of its decisions are shown `core.resumed` with `stopped: "judged_wrong"` and `judgement.judge` = `{verdict:"no", expected, observed, advice, findings: []}`.
     - The second round's offered kinds: local 1 is `[tool_call]`; 2-13 are `[complete, amend_draft, tool_call]`; 14-15 are `[complete, amend_draft]`; 16 is `[complete]`.
     - The draft grows from 0 steps, one step per decision.
     - Its last completion (decision 26) is judged `no` again, and the build ends `flow_bootstrap.evidence_budget_exhausted` with `ending {kind: budget_exhausted, bound: calls, tried {rounds: 2, decisions: 26, tested: replayed_clean}}`.
     - The message begins "The build stopped at its limit of 26 model calls ..." and contains "judged not to do what you asked".
     - Accounting is 32,800 / 4,060 / 36,860 (26 decisions plus 4 judge calls). `revealed` is 30.
     - There is no `exhausted` record.
     - Trace rows 8, 9 (with `nodeId: demo.look`), 10, 24 (`not_offered`) and 26 are as recorded. Decisions 10 and 26 carry `answerability {recordsRequested: true, recordProducerPresent: false, recordStorePresent: false}` with no issue code.
5. **"converges ..."**, renamed "converges through the judge's no when the corrected plan retains the record-producing node".
   - The judge says no, no to the first Flow and yes to the corrected one.
   - Sent iterations are `[1..10, 1, 2]`. The second round's first decision is offered only a look (nothing is drafted yet), so the corrected completion comes at its second decision, the build's 12th.
   - There are 3 judge calls. Call 1 carries the note; call 3 (the corrected Flow) carries `notes: []`.
   - Observation 11 is shown the judge's verdict in `resumed`.
   - The result is `proposed` with accounting 15,600 / 1,920 / 17,520. The audit has `providerCallCount: 12`, `decisionCount: 12`, `additionalProviderCallCount: 3`, `totalProviderCallCount: 15`.
   - The stored plan contains `web.output.dom-extract_list`. The trace holds `complete` at 10 and at 12. Nothing was refused for answerability.

## Commands run and observed results

- Baseline: `npx vitest run src/programs/automation-studio/runtime/tests/deepseek-bootstrap-exploration.test.ts` (in `packages/fluxiq`) gave **4 failed | 7 passed (11)**. These are the brief's four: `revealed` 6 instead of 3 (twice), and `sentIterations` `[1..10]` instead of 26 or 11.
- After the stub change alone, there were 5 failures: the four above, plus token totals (judge spend now counted). Temporary `console.log` probes, since removed, showed the real flow; the expectations above are taken from those observations.
- Final run of the same vitest command: **Test Files 1 passed (1); Tests 11 passed (11)**, Duration 27.15s.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w29 tsc" npx tsc --noEmit -p .` (in `packages/fluxiq`) printed `[heavy] t195-w29 tsc holds b1`, no diagnostics, exit 0.
- `git status --short`: only the brief's file is modified by me. The five other modified files were the lead's before I started.

## Not verified

- No other test file was run (the brief forbids full suites). Lab, browser and real model were not used.
- I did not establish why the judge's request has an empty `buildTest.steps` (`stepCount` 0) for these Flows. I record the count but assert nothing on it. See the open questions.
- The final vitest run was run once after the last edit. Flakiness was not measured.

## Open questions or contradictions found

1. **The brief expects a repair round; in this fixture it is an explore-again round.** The brief says the judge's `no` "sends it to a repair round carrying the judge's observed/advice".
   - What actually happens: the next round's `core.resumed` is `code: llm_evidence_loop.explore_again` with `draftSteps: 0` and `judgement.stepsInFlow: 0`. It does carry `judgement.judge {verdict: no, expected, observed, advice}`, but the instruction is `EXPLORE_AGAIN_INSTRUCTION` (`llm/evidence-loop/resume.ts` `instructionFor`, `nothingInFlow`), which never mentions `judgement.judge`.
   - Cause: this fixture's drafted steps are `demo.look` rows, which are not a Flow's kind (`disposition: look`), and the Flow is the completion's hand-written `plan`. `automationStudioFlowBootstrapJudgeFinished` is given `ending.loop.steps` (the draft, phases.ts:253), so `stepsInFlow` is 0, and phases.ts:304-312 explores again instead of repairing. That is the documented "Nothing in the Flow" path, so I treated it as design rather than a defect and asserted it as it is.
   - Two consequences the lead may want to judge:
     - (a) A judged-wrong Flow with no drafted steps can never reach "not doable": `previous` is reset at phases.ts:311, so it ends only on a budget.
     - (b) The person-facing ending says "The Flow (0 steps) ran from its start" although the proposed plan had navigate, type and end nodes.
   - A seeded `llm_evidence_loop.repair` round would need drafted steps that are proposable registry nodes. That needs a fixture change beyond this file's look binding, which I did not make.
2. **The judge sees no steps.** `buildTest.steps` arrived empty in every judge request here, for the same reason as item 1. The judge then judges only from the notes and flowShape. It is consistent with item 1 but worth confirming it is intended for plan-only completions.
3. **The token-totals case also changed.** "records a build's token totals past one request's ceiling" was not one of the four named cases, but it passed on dev only because the judge's call failed. I updated it to include the judge's 400/40, which is outside the brief's list of four cases but inside its owned file.
