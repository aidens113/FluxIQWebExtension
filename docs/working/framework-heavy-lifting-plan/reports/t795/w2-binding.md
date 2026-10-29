# Report: t795/w2-binding (P5: a computed fail is a Core no; which judge nos bind)

## Outcome

Partial. All five goals are implemented. Every test I wrote or own passes, and the same tests fail against the pre-change files. `pnpm check` in packages/fluxiq exits 0. The acceptance vitest set still has **5 failures in 3 test files I do not own**: `tests/flow-purse-check.test.ts`, `tests/judge-accounts-for-rows.test.ts` and `tests/judge-sees-the-read.test.ts`. They fail because the fact modules other workers filled now run inside `verify.ts`, and those modules return `fails` on the trimmed fixtures these tests use. The no then binds before any judge is called. This is the wiring working as briefed. Someone has to decide whether those fixtures or the facts should change (see Open questions).

## What changed and why

- **`verify.ts`** (goal 1). Right after `automationStudioResultCoreObservation` and before the provider check, `automationStudioResultComputedFacts` runs on the summary, the instructions, `requestText` (now built once, at the top) and `requestedOutput`.
  - **Any `fails` fact gives a Core no, and no judge is called.** The no has verdict `does_not_answer`, basis `core_observation` and code `core.result.computed_fact_failed` (a module constant). Its reason is "Core's own record ... so no judge was asked: <said>" and its observation is the facts' `said` lines.
  - **The repair directive reuses existing builders.** `automationStudioResultRepairDirective` builds it with `checked` set to the said lines. A finding `result.computed_fact_failed` with the said line as its detail goes first. The located defects go in `repair.judgement.defects`, where a judge's located no carries them (`verdict/result-verdict.ts` `withDefects`).
  - **The failure record also reuses existing code** (`automationStudioResultFailureRecord`).
  - **How it reaches the build.** `build-test/judge.ts` turns the Core no into a `no` with `findings: ["result.computed_fact_failed", ...]` and `checked: [said]`; the test checks this. The recovery reads `failure.expected`, which holds "Core checked the rows the check names: <said>", and `failure.actual`, which holds the said lines.
  - Before returning, it emits the "Result check started" and "Result check" activity events.
- **`verify.ts`, facts that hold.** They go only on the judge's copy (`judgedRequest`), as `computedFacts: [{kind, status, said}]`. They are inserted immediately before `earlierAdvice` with every other key left in place, or appended last when there is no earlier advice. The converse ask and every re-ask (`ask`) build on `judgedRequest`. The agreement, the requested-output hold and the unsupported-no re-ask still read the original `request.summary`. A pass never short-circuits anything: the judge is still asked.
- **`verify.ts` to `agreement/unsupported-no.ts`.** `requestText` is now passed into `automationStudioResultVerificationReaskUnsupportedNo` (new optional input field). From there it goes into the located-defects context.
- **`located-defects/searched-words-kept.ts`** (new; goal 2, F3, gated). A `kept_not_asked` defect is *not located* only when all of these hold:
  - `automationStudioRequestAsksEveryResult(requestText)` is true;
  - the quote's `requestWords` state no exclusion (leave/left out, exclude, except, without, not, no, omit, skip, ignore, other than, apart from, besides, but);
  - the quote holds at least one request phrase that some row Core holds says;
  - the row's own label says every such phrase.

  A request phrase here is a run of two or more of the quote's words that `record.phrases.isPhrase` accepts. "Search the store" is never held against a row, because no row says it. Without request text or phrases, the defect is located exactly as before. This is wired into `located-defects.ts` at the end of the kept and wrong-value branch, and `Context` gained an optional `requestText`.
- **`agreement/exclusion-words.ts`** (goal 2). `exclusionRecheckWords(exclusions, asksEveryResult = false)` drops the clause "or the words naming what the request asks for, which that row by its own words is not" when the gate is true. `reask-contradicted.ts` passes `automationStudioRequestAsksEveryResult(input.requestText)`.
- **`located-defects/presence-settled.ts`** (new; goal 3, F4). An `asked_missing` defect is located when all of these hold:
  - its value is "(no value)", "no value", "none" or "(none)";
  - some read's condition with `settledKind: "presence"` holds the row in `leftOutSettled`, by whole label, said as `label — column: (no value)`;
  - the defect's column is that column (compared the way `untested-column.ts` compares columns).

  It runs before `askedCellNotFound` in `located-defects.ts`. The untested-column and tested-value-only checks still follow it.
- **`computed-facts/act-passes.ts`** (goal 4). It reads `proofs[].notRun` structurally, only in this file, and only when every entry has the proposed shape.
  - **Absent: no fact.** That is every summary today.
  - **Non-empty, on a part with a typed effect: a `fails` fact.** It carries one `act_missing` defect per entry. The `row` names the step (with its label), the passes ("passes 2 and 3 of 3", "any pass") and why ("a guard routed past it, as it runs only after X" or "the run ended or failed before reaching it"). `step` is the step number. `requestWords` is the part's task-checklist words, or else the request text (capped at 500 characters).
  - **Present and empty: `holds`.** The proposal says the field is never empty, so this should not happen in practice.
- **`site-change/held.ts`** (goal 4). `NOT_PROOF` is keyed loosely and gains `not_run` ("no step serving it ran on any pass of this trial"), so a yes over a `not_run` proof is held like `no_change`.
- **`located-defects/index.ts`**: two header paragraphs and the two new exports.
- **Tests**:
  - `located-defects/tests/garden-catalog-fixture.ts` (a library catalog fixture);
  - `located-defects/tests/searched-words-kept.test.ts` (test 4);
  - `located-defects/tests/presence-settled.test.ts` (test 5);
  - `agreement/tests/exclusion-words.test.ts`;
  - `computed-facts/tests/act-passes.test.ts`;
  - a `not_run` block appended to `site-change/tests/held.test.ts`;
  - `tests/verify-computed-facts.test.ts` (the wiring test; it stubs the facts with `vi.mock("../computed-facts/index.ts")`).
- **`tests/verify.test.ts` (owned).** I added a `vi.mock` that makes `automationStudioResultComputedFacts` return `[]`. That file tests retry mechanics, and its trimmed `run-muw60j7c` summary stores only name and url and repeats rows, so the filled `columns` and `repeated` facts now fail it before any call is made. A comment in the file says why.

## Commands run and observed results

Every vitest and tsc run below was run under `heavy-check.lock`, from `packages/fluxiq`.

- **Fail-first.** I swapped in the pre-change `verify.ts`, `located-defects.ts`, `exclusion-words.ts`, `held.ts` and the `act-passes.ts` stub, ran `npx vitest run` on the 6 new or extended test files, then restored my versions (checked with `cmp`: all 5 restored). Result: **`Test Files 6 failed (6)`, `Tests 11 failed | 15 passed (26)`.**
  - The 11 failures are F3 "not located", F4 "located", exclusion-words "drops it", 3 act-passes tests, `not_run` held, and 4 wiring tests.
- **With the fix, run 1** (acceptance command). Everything I own passed:
  - `verify.test.ts` (23)
  - `verify-computed-facts.test.ts` (6)
  - `held.test.ts` (7)
  - `located-defects.test.ts` (9)
  - `asked-cells.test.ts` (7)
  - `act-passes.test.ts` (4)
  - `searched-words-kept.test.ts` (4)
  - `exclusion-words.test.ts` (2)
  - `presence-settled.test.ts` (3)

  27 failures were all in other workers' unfinished fact tests (columns, count, kept-bounds, left-out-accounted, order, repeated), whose modules were still stubs.
- **Run 2.** Those workers had filled their modules. New failures appeared in `verify.test.ts` (10), `flow-purse-check`, `judge-accounts-for-rows` and `judge-sees-the-read`. All share one cause, shown by a probe (`w2b-facts-probe.mts`): on `runMuw60j7cRunSummary`, the `columns` fact fails ("No stored column is price, rating, which the request names.") and the `repeated` fact fails (3 rows stored twice), so the provider is never called.
- **Final run (run 3)**, after the mock in `verify.test.ts`: **`Test Files 3 failed | 64 passed (67)`, `Tests 5 failed | 589 passed (594)`, exit 1.** All 5 failures are in the 3 non-owned files above, each asserting a provider call that the Core no now prevents.
- **`pnpm check` (packages/fluxiq):** `{"build-cache":"build",...,"reason":"inputs changed: packages/fluxiq"...}` then `exit 0`.
  - An earlier attempt failed on another worker's file, `value-readings/order-claim.ts(72,23): TS1161`, which was later fixed by its owner.
  - A scoped TS-API diagnostic pass over my 17 files found one error of mine (a missing `said` in a test's `earlierAdvice` literal). I fixed it, and the next `pnpm check` exited 0.
- **Real-reply probe** (`node --experimental-transform-types scratchpad/w2b-probe.mts`), run against the run-mvtdoyf3 steps on the t795 Core tree:
  - **With the fix:** 0043 and 0044 `located 0 of 1`; F3's finding reads "...the row's own label says "for wireless earbuds", so "Search the store for wireless earbuds" say where the request looked, not words that row fails...". Under F4: 0067 2/2, 0068 2/2, 0085 2/2, 0086 3/3 located.
  - **With the pre-change `located-defects.ts`:** 0043 and 0044 `located 1 of 1`; 0067, 0068 and 0085 0/2 and 0086 0/3 ("Core holds no cell "brand" ... its label does not say "(no value)"").
  - **With no `requestText` in the context:** 0043 and 0044 stay located (1 of 1).

## Not verified

- I did not replay the whole run end to end through `verifyAutomationStudioRunResult`. I showed that the defects are unlocated and located; I did not show that the t752 re-ask then follows and leaves the trial unsure, nor that the `closedDigests` lock no longer fires.
- The wiring test stubs the facts. I did not check how the other workers' real facts behave in verify beyond the probe above.
- I did not run the structure audit (`scripts/structure-audit.mjs`). `verify.ts` keeps its existing several exports and I added none.
  - I added two source files under `located-defects/`, each with one export.
  - The new modules' tests sit in `located-defects/tests/` named after them.
- Gate breadth: the F3 exclusion-cue list and the "phrase some row says" rule were exercised only on the library fixture and the six real replies. Other phrasings of an "every result" request were not tried.

## Open questions or contradictions found

1. **Lead decision needed: the 3 non-owned test files now fail** (`tests/flow-purse-check.test.ts`, `tests/judge-accounts-for-rows.test.ts`, `tests/judge-sees-the-read.test.ts`; 5 tests). With the computed facts live, their trimmed `run-muw60j7c` summaries are a Core no before any call. Either their fixtures need the asked columns and no repeated rows, they need the same `vi.mock` I used in `verify.test.ts`, or the `columns` and `repeated` facts need to be narrower. I recommend the mock where a test is about call mechanics, after the fact owners confirm their facts are meant to fail those fixtures.
2. A Core no is binding through `build-test/judge.ts`, but the agreement never builds a `standingNo` record for it. The build's trial gate therefore keeps no Core record of a computed no. Whether the gate should hold one is outside my files.
3. `act-passes` emits `holds` only for `notRun: []`. The proposal says the field is absent, not empty, when every step ran, so in practice this fact only ever fails. If t796 adopts "present and empty when all ran", the hold will show up without any change here.
4. On my own machine run, `order-claim.ts` lost its backslashes in the same way my first scratch script did when written through a Git Bash heredoc. That may be how its owner's file broke. I mention it only as a pointer.
