# t810 w4-provenance (P5b: located-only earlier advice, feedback provenance, Core standing-no)

## Outcome
Partial. All three items are implemented and tested. Two things are left for the lead:
- One test outside my ownership needs its fixture updated (`subflow-trial-earlier-advice.test.ts`, below).
- Three tests in `RV/tests/reask-route/tests/lone-yes-route.test.ts` fail, and I could not prove they are not mine (below).

## What changed and why
Paths are under `RT` = `packages/fluxiq/src/programs/automation-studio/runtime`; `RV` = `RT/result-verification`.

1. **Earlier advice is located-only.**
   - `RV/standing-no/types.ts` and `record-shape.ts`: the standing-no record gains optional `located` (the defects Core located: kind, row, column, value, step) and `source: "core"`. The record reader validates and keeps both.
   - New `RV/standing-no/earlier-advice-located.ts` (`automationStudioResultLocatedAdvice`): makes Core's sentence from located defects only (kept-not-asked, asked-missing, wrong-value, act-missing and act-wrong; `other` is skipped). It never carries a judge's prose.
   - `RV/standing-no/earlier-advice.ts`: no longer parses the advice text for node ids or condition numbers. It names the conditions of Core's record whose `leftOutAlone` holds a located `asked_missing` or `wrong_value` row, and compares them across revisions with the existing written-condition matching. `said` is Core's sentence.
   - `RT/flow-bootstrap/candidate/earlier-advice-memory.ts`: `remember` builds the advice from `standingNo.located` and no longer reads the feedback. A trial with no located defect keeps nothing. The seeding reader `trialOf` rebuilds the advice from `standingNo` and drops stored prose, so an earlier brief's prose cannot re-enter.
   - `RV/standing-no-record/record.ts`: a judge's no now fills `located` by running `automationStudioResultDefectsLocated` (imported, not edited) over its non-refuted calls' defects.
   - `RV/contracts/earlier-advice.ts`: shape unchanged, doc updated. `advice` is now Core's located sentence.
   - Readers are unchanged and compatible:
     - `RV/agreement/unsupported-no.ts` reads only `.followed` and `.revision`.
     - The subflow gate and `RT/service/subflow-trial/run.ts` pass the entries through.
   - Comment edits only in `trial-gate.ts` and `summary.ts`; in `trial-gate.ts`, `remember` is no longer passed `feedback`.
2. **Feedback provenance.** `RT/service/candidate-trial/feedback.ts` adds a `provenance` map (`judge_said` or `core_found`) to judged no, unsure and not_judged feedback. It lists only the fields present.
   - `judge_said`: `judge`, `unconfirmedReading`, `answeredReading`.
   - `core_found`: `findings`, `fix`, `checked`, `rowMark`, `why`, `doubtContradicted`, `changeAdvised`, `readings`.
   - A no Core made itself (`standingNo.source === "core"`) has `judge` marked `core_found`.
   - Yes and execution failures carry none. It is part of the feedback the builder sees.
3. **A Core refusal keeps a `standingNo` record.**
   - New `RV/standing-no-record/core-record.ts` (`automationStudioResultStandingNoCoreRecord`): the record built as a judge's is, with no standing calls, `source: "core"` and the facts' located defects (without `requestWords`).
   - `RV/computed-facts/computed-no.ts` now sets `standingNo` on the Core no.
   - The path to the gate: `build-test/judge.ts` already copies `outcome.standingNo`. `trial-gate.ts` already feeds `asked.standingNo` to its kept-conditions memory, and the new earlier-advice memory reads the same record. So `trial-gate.ts` needed only a comment change.

## Tests
New or updated, all listed here:
- New:
  - `RV/computed-facts/tests/computed-no-record.test.ts`
  - `RV/tests/computed-facts-route/tests/computed-no-standing.test.ts` (judge verdict carries the Core record)
  - `RV/standing-no-record/tests/located-defects-kept.test.ts`
  - `RT/service/candidate-trial/tests/provenance.test.ts`
- Rewritten for located-only: `RV/standing-no/tests/earlier-advice.test.ts`.
- Updated:
  - `RT/flow-bootstrap/candidate/tests/earlier-advice/tests/trial-gate-earlier-advice.test.ts` (adds a "no located defect means nothing carried" case and a Core-record case)
  - `RT/service/candidate-trial/tests/change-advised.test.ts` (key list gains `provenance`)

I did not run the new tests against the old code, so fail-first is not demonstrated. Several assert things that did not exist before (`standingNo.source`, `located`, `provenance`).

## Commands run and observed results
Every heavy command ran under `heavy-check.lock`, acquired by me and released by me.
- **Run 1** (`pnpm test` over `RV/standing-no`, `RV/standing-no-record`, `RV/computed-facts`, `RV/tests`, `RT/flow-bootstrap/candidate`, `RT/service/candidate-trial`):
  - `Test Files 2 failed | 126 passed (128)`, `Tests 4 failed | 1025 passed (1029)`.
  - One failure was mine (`change-advised.test.ts`, the new `provenance` key). I fixed it in run 2.
  - The other three are in `lone-yes-route.test.ts`. They fail on a shared tree where other workers are editing `agreement/`, `located-defects/` and `refuted-no/`, and the expected `unsure` / `refutation_unsupported` came back `answers` / `no_refuted_by_record`. My `record.ts` change runs after the verdict, only adds `standingNo`, and calls a pure function, so I believe they are not mine. I did not isolate them, so that is unproven.
- **Run 2** (`pnpm test` over `RT/flow-bootstrap/subflow-candidate`, `RT/service/subflow-trial`, `RT/service/candidate-trial`, `RV/standing-no-record`, `RV/standing-no`, `RV/computed-facts`, `RV/tests/computed-facts-route`):
  - `Test Files 1 failed | 92 passed (93)`, `Tests 3 failed | 559 passed (562)`.
  - All three failures are in `RT/flow-bootstrap/subflow-candidate/tests/earlier-advice/tests/subflow-trial-earlier-advice.test.ts`. That test is not mine; see "Open questions".
- `pnpm check` from `packages/fluxiq`: exit 0. The output was `build-cache reuse ... inputs and outputs match the stamp`, so it was reused from a stamp, not a fresh `tsc`. The stamp matching my current inputs implies a full `tsc` passed on this tree since my last edit.
- Lock contention cost hours of waiting; a 20s poll lost repeatedly, so the last run polled every 3s.

## Not verified
- Fail-first for each item (see Tests).
- The three `lone-yes-route.test.ts` failures not being mine (see Run 1).
- The exact `tsc` result for my files, since the check was a stamp reuse.
- `pnpm structure:check`, which I did not run. `feedback.ts` grew by about 25 lines and may touch a size budget.
- No live or browser behaviour, and no model calls.

## Open questions or contradictions found
1. **A test outside my ownership needs a fixture change.** `subflow-trial-earlier-advice.test.ts` has a `STANDING_NO` fixture without `located`, so it now gets no earlier advice. Its expected strings assume prose advice. Needed:
   - Add `leftOutAlone: ["Ferns on Hold"]` to condition 1 and `located: [{ kind: "asked_missing", row: "Ferns on Hold" }]` to the fixture.
   - Set `ADVICE` to `Core located these defects in its record of that trial: it lacks "Ferns on Hold", which the request asks for.`
   - Set the `said` text to `After the trial of revision 1 (judged no) ${ADVICE} Revision 2 changed condition 1 (...) of step <key>.s3, which alone left a row out there.`
   - The same pattern is in `RT/flow-bootstrap/candidate/tests/earlier-advice/tests/trial-gate-earlier-advice.test.ts`.
2. **Judge model text to put in place.**
   - `RT/llm/diagnosis-instructions.ts` (line ~148 comment) says `earlierAdvice` records "what an earlier judge advised". It should now say: "earlierAdvice lists only defects Core located in its own record of an earlier trial, and whether this revision changed what they trace to. It is context only, never an earlier judge's advice."
   - `recheckWords` in `agreement/unsupported-no.ts` already says "Earlier advice is context only" and reads `.followed` only. It is compatible and I did not touch it.
   - Builder-facing sentence for the `provenance` field, wherever the builder instruction describes feedback: "provenance says whose each field is: judge_said is a judge's reading and can be mistaken, so weigh it against the record; core_found is Core's own finding in its record and stands."
3. **Judge's unlocated claims.** Before this change, a no whose defects Core could not locate still produced earlier advice. Now it produces none, so `followed: "changed"` no longer reaches the re-ask for those trials.
4. **Scratch-file collisions.** I used scratchpad names `e1..e9.mjs`, `t1..t3.mjs`, `lib.mjs`, `w4p-*`. Some may have overwritten other workers' scratch files of the same name; I did not check.
