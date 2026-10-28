# t766 — Core judging sweep failures (and the act-only grounding regression)

## Outcome

Done.

**PRODUCTION REGRESSION FOUND AND FIXED (judging).** Since t752 (534c41fb, merged 149ba69e on
2026-10-21), a judge's "no" counts only if it lists a defect Core can find in its record. That
record held only stored rows. So a Flow that only acts (checkout, save, like, send, switch on) gave
the judge nothing it could name. Every "no" of such a run came back unsure
(`core.result.refutation_unsupported`): the run was not failed and **no repair was ever requested**.
A build's test judged the same way came back "unknown" rather than "no". t766 now grounds those
negatives in Core's record of the steps the run took (supervisor decision, 2026-10-27). The tests
that prove it failed on the original code first (see Commands).

All 31 listed failures are fixed. Each was a stale mock judge: it said "no" without the `defects`
list that 534c41fb made mandatory. In 11 of them, though, the test could not have passed without
the production fix, because their Flows store no rows. The five downstream domain tests that t767
reported (carried-service-repair ×4, carried-row-service-repair ×1) now pass against this Core
build.

## Round 2: supervisor decisions (2026-10-27)

1. **Mixed tasks.** Act defects are now accepted for any result, including a task that owes
   records and must also act. An act defect is checked only against Core's record of the steps the
   run took, which is separate evidence from the rows. Row claims (a row kept, missing or wrong)
   still need their row in Core's record, exactly as before.
   - I wrote the tests first:
     - `located-defects/tests/mixed-fixture.ts`: a made-up library request that owes the books due
       this week and also asks to turn reminders on.
     - Two new route tests in `act-only-no-route.test.ts`, run with `requestedOutput` declaring
       records owed. A "no" naming the missing act gives `does_not_answer`, fails the run and
       carries a repair. A "no" claiming a kept row Core does not hold stays unsure
       (`refutation_unsupported`): it fails nothing and has no repair.
   - Before the change: `Tests 1 failed | 4 passed (5)`. The mixed act "no" was refused; the
     mixed row claim already stayed unsure.
   - The change: I deleted `located-defects/act-result.ts` and removed the `recordsOwed` threading.
     `verify.ts` is back to its HEAD contents, and `agreement/unsupported-no.ts` and
     `located-defects.ts` are simplified.
   - The model-facing defects sentence now reads "an act the request asks for is named as one,
     whether or not the result also stores rows:". The re-ask text and reason were adjusted to
     match. Pins, the prompt test and the architecture doc were updated, and the reference
     regenerated.
   - The unit tests now say that a stored-rows result takes an act defect while its row claim
     still needs a row.
2. I reran everything after the change. Results are under Commands, "Round 2".
3. Build tests cannot ground kept or wrong rows, and the no-defects-list versus ungroundable-no
   asymmetry remains. Both are recorded below as follow-ups, with no change.
4. The downstream fixture edits stand. `process-restart.test.ts` is untouched.

The Round-1 text below describes an `act-result.ts` gate ("result of acts" only). Round 2 removed
that gate.

## What changed and why

### Production (Core, `packages/fluxiq/src/programs/automation-studio/runtime/`)

- `llm/verification-defects/schema.ts`: two new defect kinds, `act_missing` and `act_wrong`, plus
  an optional `step` field. `well-formed.ts`: `step` is a bounded text, and `act_wrong` must name
  one. `llm/harness/structured-response.ts`: the type and its documentation.
- `result-verification/verdict/defects.ts`: carries the act kinds and `step`, screened like every
  other text. This also fixes a latent slot shift: a `value` given without a `column` used to land
  in the column slot.
- `result-verification/located-defects/act-steps.ts` (new): Core's act record. It holds each
  `flowShape` step (node id, label, authored parameter text, the changes the run saw it make) and
  each build-test step (number, action, target). Steps that read rows are marked as reads.
- `located-defects/act-result.ts` (new): decides whether a result is a result of acts. That is
  true when it stores no answer rows. It is also true when its rows are only the list a step acted
  on row by row (`rowsActedOn`, or build-test `passes`), provided the build declared no records
  answer and no read is flagged `workingRows`. The `workingRows` exclusion keeps out the t752 case:
  a list read again as the answer, where the acts only opened each row.
- `located-defects/act-located.ts` (new): `act_wrong` is found when it names a step Core holds
  that acts rather than reads. `act_missing` is found when no acting step's own words name what the
  act is done to. Both must still quote the request's own words. A row result never takes an act
  defect, so a "no" on a row task still cannot rest on blaming a step.
- `located-defects/located-defects.ts` and `index.ts`: dispatch to the act check. The context
  gains `recordsOwed`, which `verify.ts` threads in through `agreement/unsupported-no.ts`
  (`owed !== undefined`).
- Model-facing text (prompt-contract tests updated):
  - `llm/diagnosis-instructions.ts`: the defects sentence now offers the act kinds "where the
    request asks for acts rather than records…". `other` no longer lists "actions".
  - `agreement/unsupported-no.ts`: the re-ask text and the recorded reason now mention acts.
  - The task-generic wording names no site or task.
- Docs: a new paragraph in `docs/architecture/automation-studio/llm-flow-bootstrap.md` (grounded
  defects section). `pnpm docs:reference` was regenerated (2 lines in each copy).

### New tests (failing first)

- `result-verification/located-defects/tests/act-only-fixture.ts`: a made-up library account
  with a request to turn on reminders. It matches no Lab scenario.
- `located-defects/tests/act-defects.test.ts` (9 tests) covers:
  - a missing act is found, and refused where a step names it;
  - `act_wrong` is found by node id, label or build-test number, never on a read step or an
    unknown step;
  - words the request never says are refused;
  - a row result never takes an act defect;
  - the act-on-each-row shape takes one, but not when records are owed or a list is re-read.
- `result-verification/tests/reask-route/tests/act-only-no-route.test.ts` (3 tests, through
  `verify.ts`):
  - a "no" naming a missing act gives `does_not_answer`, fails the run, and carries a repair with
    the judge's reading and defects;
  - a "no" naming a wrong step does the same;
  - a "no" naming only `other` stays unsure, fails nothing and has no repair.

### Stale tests (mock judges given a defect Core finds; no assertion weakened)

| file | test | cause | commit | stale/regression | fix |
| --- | --- | --- | --- | --- | --- |
| service/flow-bootstrap-commands/tests/build-judge.test.ts | 5: "is told what the completion check found…", "stamps every verdict…", "stamps no signature…", "is judged without a page…", "reads the phases' judged test…" | Mock "no" has no `defects`, so `llm_output.verification_defects_required` makes the reply unreadable (`not_judged`). The Flow stores no rows, so before t766 no defect could ever be found (it would be "unknown"). | 534c41fb | Stale mock **and** the act-only regression | Mock names `act_missing` (the table read no step does). The "counts every provider call" test was passing vacuously: it counted 2 calls of an unreadable reply. It now counts a real double "no". |
| tests/service-bootstrap/tests/judged-build.test.ts | 3: "judged no, twice > starts a repair round…", "lane A's run 40…", "reserve stopped… judge says no" | Same; act-only build tests | 534c41fb | Stale **and** act-only regression | `judgeSaid` carries `act_missing` defects. `fixtures.ts` `judgeReply` now accepts non-string values. |
| tests/deepseek-bootstrap/tests/answerability.test.ts | 2 | Same; the Flow stores no row | 534c41fb | Stale **and** act-only regression | `JUDGE_NO` in `replies.ts` lists `act_missing`. The `JudgeReply` type gains `defects`. |
| service/flow-bootstrap-commands/tests/candidate-failure-kept.test.ts | 1: "refused submissions in a row…" | Same; Start-to-End act-only trial | 534c41fb | Stale **and** act-only regression | The no-mock lists `act_missing`. |
| service/flow-bootstrap-commands/tests/applied-judged-trial.test.ts | 2 | Mock lists no defects. Also, the hand-built check port omitted `deniedEvidenceKeys`, which `service.ts` passes from the runtime. With it omitted, every row value is withheld, so no row could be found. | 534c41fb | Stale | Mock lists `kept_not_asked` "Brandywine Pink" (stored by both playbacks). The port passes `deniedEvidenceKeys: []`, as `service.ts` does for this runtime. |
| tests/service-adaptation/tests/judged-promotion.test.ts | 1: "re-runs a patch the refuted result's repair wrote…" | Mock lists no defects. The harness has no domain runtime, so values are withheld and no row can be found. Two sibling "no" tests passed only because an unreadable reply fails closed. | 534c41fb | Stale | Mock lists `kept_not_asked` "Desk". The harness declares a domain with `deniedEvidenceKeys: []` and no tools (nothing exploratory is reachable). All 7 tests pass. |
| tests/service-adaptation/tests/unattended-retry-verification.test.ts | 1: "fails the run when the repair produced another wrong answer" | Same as judged-promotion | 534c41fb | Stale | Same fix |
| tests/refuted-result/tests/reauthor-service.test.ts | 9 (persists unsupported held reauthor; reaches re-author ×4 modes; private retention [60 s timeout]; caller for verification; structured reauthor failure; seeded Flow unchanged) | Mock lists no defects, so the result is never refuted and the re-author is never routed | 534c41fb | Stale | Mock lists `kept_not_asked` "Beta" |
| tests/service-adaptation/tests/judged-reauthor.test.ts | 3 | Same | 534c41fb | Stale | `KEPT_NOT_ASKED` "Beta" on both judges |
| tests/service-adaptation/tests/caller-paid-reauthor-check.test.ts | 1 | Same | 534c41fb | Stale | Same |
| tests/refuted-result/tests/repair-replay-chain.test.ts | 1 | Same | 534c41fb | Stale | `kept_not_asked` "Beta" ("every red product") |
| tests/refuted-result/tests/repair-purse-chain.test.ts | 1 | Shared `repair-purse-harness.ts` judge | 534c41fb | Stale | Same, in the harness |
| tests/refuted-result/tests/flow-purse-chain.test.ts | 1 | Same harness | 534c41fb | Stale | Same harness |

Why 534c41fb and not t757, t758, t764 or t751:

- Every failure message traced to `verification_defects_required`, or to its downstream effects
  (`not_judged`, `model_unavailable`, `refutation_unsupported`).
- `git log -S verification_defects_required` shows only 534c41fb.
- All 31 pass with no change to t757, t758, t764 or t751 code.

I did not bisect commit by commit.

### Downstream (`fxwork/t766/!FluxIQWebExtension`, test fixtures only)

- `domain/src/runtime/tests/carried-service-repair.test.ts` and
  `carried-row-service-repair.test.ts`: the judge's "no" now lists
  `{ kind: "act_wrong", step: "type", row: "the editor message", requestWords: <request's words> }`.
  Without the Core fix, adding defects could not help, which matches t767's finding. With it, the
  carried-row Flow (read a list, type into each row, then type the summary) counts as a result of
  acts because a step acted on each row.

`UNIT READY: Core packages/fluxiq` — all files listed above, plus `docs/architecture/automation-studio/llm-flow-bootstrap.md`, `docs/reference/framework-reference.md` and `packages/fluxiq/docs/reference/framework-reference.md`.

`UNIT READY: downstream domain/src/runtime/tests/carried-service-repair.test.ts, domain/src/runtime/tests/carried-row-service-repair.test.ts` (these overlap with t767; the supervisor integrates).

## Commands run and observed results

- Reproduced the failures before any change: `pnpm test <13 listed files>` in packages/fluxiq gave
  parallel `Test Files 1 failed (1)` and real-sql `Test Files 12 failed (12)`. All 31 named tests
  showed ×.
- Failing first: with the 8 production files restored to their HEAD contents, `pnpm test
  act-defects.test.ts act-only-no-route.test.ts` gave `Tests 9 failed | 1 passed (10)`. With the
  fix, both passed. I restored my versions afterwards. The later tests for the act-on-each-row
  shape were added after the gate was broadened; that shape could not be grounded before t766
  either.
- Final run, all 13 listed files plus the 2 new test files, through the grouped runner:
  - parallel: `Test Files  3 passed (3)` / `Tests  25 passed (25)`
  - real-sql: `Test Files  12 passed (12)` / `Tests  48 passed (48)`
- Directories I changed, via `pnpm test <dirs>`:
  - result-verification + llm/verification-defects + llm/deepseek + llm/harness/tests + the two
    plan contract tests: `Test Files 188 passed (188)` / `Tests 1593 passed`; real-sql
    `1 passed (1)`.
  - service/flow-bootstrap-commands, tests/service-bootstrap, tests/deepseek-bootstrap,
    llm/deepseek, llm/harness: `81 passed (81)` / `651 passed`; real-sql `35 passed (35)` /
    `182 passed`. This batch ran before the act-result broadening.
  - tests/service-adaptation, tests/refuted-result, flow-bootstrap/candidate,
    flow-bootstrap/subflow-candidate, service/candidate-trial: `87 passed (87)` / `607 passed`;
    real-sql `27 passed (27)` / `124 passed`. This batch also ran before the broadening.
- Prompt contracts (`scripts/task/contract/list.mjs`: system-prompt.test.ts,
  extraction-vocabulary.test.ts, issue-feedback.test.ts): pass. The pins changed by exactly one
  clause in the defects sentence of `loop_verification` and `loop_verification_build_test`.
  output-schema.test.ts was updated for the new schema.
- `pnpm check` in packages/fluxiq: tsc ran, with no errors printed. Output was
  `{"build-cache":"build","step":"fluxiq:check",...}`.
- `pnpm structure:check`: `structure-audit: passed (443 warning(s), 1152 baselined)`. A first run
  failed on an `as never` in my new test; I replaced it with `satisfies`.
- `pnpm docs:reference`: wrote both references (4142 public declarations).
- Built Core with `node scripts/build-cache/cli.mjs contracts:build fluxiq:build`.
- Downstream domain tests, run with `DOMAIN_TEST_BUILD_LABEL=t766 pnpm test carried-service-repair
  carried-row-service-repair` (the core-build gate reported "current"):
  - Before the fixture change: `# pass 2 # fail 5`. These were exactly t767's five.
  - After, with a "stores no rows" gate only: `# pass 6 # fail 1`. The row test still failed with
    `refutation_unsupported`, which drove the act-result broadening.
  - Final: `# tests 7 # pass 7 # fail 0`.
- Downstream `npx tsc --noEmit -p tsconfig.json` and `npx tsc -p tsconfig.test.json --noEmit`:
  exit 0.

### Round 2

- Mixed tests first: `pnpm test act-defects.test.ts act-only-no-route.test.ts` gave
  `Tests 1 failed | 4 passed (5)` for the route file before the change. After it:
  `Test Files 2 passed (2)` / `Tests 13 passed (13)`.
- result-verification + llm/verification-defects + llm/deepseek + llm/harness/tests +
  diagnosis-channel + the two plan contract tests:
  - parallel `Test Files  188 passed (188)` / `Tests 1594 passed`
  - real-sql `Test Files  1 passed (1)` / `Tests 3 passed`
- Batch A (service/flow-bootstrap-commands, tests/service-bootstrap, tests/deepseek-bootstrap,
  llm/deepseek, llm/harness):
  - parallel `Test Files  81 passed (81)` / `Tests 651 passed`
  - real-sql `Test Files  35 passed (35)` / `Tests 182 passed`
- Batch B (tests/service-adaptation, tests/refuted-result, flow-bootstrap/candidate,
  flow-bootstrap/subflow-candidate, service/candidate-trial):
  - parallel `Test Files  87 passed (87)` / `Tests 607 passed`
  - real-sql `Test Files  27 passed (27)` / `Tests 124 passed`
- These batches contain all 13 listed files and both new test files.
- `pnpm check` (packages/fluxiq): no TS errors.
- `pnpm structure:check`: `passed (443 warning(s), 1152 baselined)`. I first split the mixed
  fixture out, because the act-only fixture had gone past the 8-export advisory.
- `pnpm docs:reference`: regenerated.
- Rebuilt Core (`contracts:build fluxiq:build`), then ran
  `DOMAIN_TEST_BUILD_LABEL=t766 pnpm test carried-service-repair carried-row-service-repair`
  (core-build gate "current"): `# tests 7 # pass 7 # fail 0`.

## Not verified

- No live or paid run, and no model call. I have not confirmed that a real DeepSeek judge picks
  `act_missing`/`act_wrong` correctly from the new instruction text.
- No full suites. The 2 changed-directory batches (service-adaptation, refuted-result, candidate,
  subflow-candidate, candidate-trial; and flow-bootstrap-commands, service-bootstrap,
  deepseek-bootstrap) ran before the act-result gate was broadened. After it, only result-verification, llm and
  the 15 target files were rerun.
- `process-restart.test.ts` ("reopens exact late-finalize history in a separate process") was the
  sweep's 32nd failure. It is not in my list and not judging (a child-process `Command failed`
  after about 45 s). I did not investigate it.
- Extension and web packages were not built or tested.

## Open questions or contradictions found

Round 2 status:
- Item 1 is resolved: mixed tasks now accept act defects.
- Items 2 and 4 are follow-ups by supervisor decision, with no change now.
- Item 5 is settled: t767 merged without touching those files.
- One consequence of Round 2: a row task's judge may now ground a "no" on an act defect, for
  example `act_missing` for something no step names. That is the accepted trade-off: the act
  evidence is separate, and row claims are unchanged.

1. **Mixed tasks stay ungrounded for acts.** When the build declared a records answer, or a list
   is re-read as the answer, an act defect is refused. A task that both stores records and must do
   an act (for example "save these and report them") still cannot get a grounded "no" for a
   missing act. That is deliberate, to protect t752's row grounding, but the supervisor should
   decide on it.
2. **Build tests never hold stored rows in Core's record.** A build test's `recordSets` is always
   `[]`; the answer is in `buildTest.stores`. So `kept_not_asked`/`wrong_value` can never be found
   in a build test. Also, `asked_missing` for a row a test read is "found" even when the test's
   answer holds it, because the stored labels are not consulted. A build still repairs on
   "unknown", so this is not a false pass, but its "no" is weaker than a run's. Not fixed here.
3. **Withheld values disable row grounding.** A service with no domain runtime declaring
   `deniedEvidenceKeys` withholds every sample row from the check, so no row "no" can ever be
   grounded and such runs are never refuted. The web domain declares its keys, so live runs should
   be unaffected; two Core harnesses had this shape.
4. **Asymmetry.** An unreadable judge reply (for example a "no" with no `defects`) fails closed:
   the run fails. An honest "no" that Core cannot ground is merely unverified. A model that omits
   `defects` therefore fails runs that a careful one would not. That predates t766.
5. The downstream fixture edits overlap with t767's files; the supervisor should integrate them
   with t767.
