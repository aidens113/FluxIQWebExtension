# hubs attempt 2: why the second attempt cost 3.6 times the first

Run `run-mwa19obz-abd5d558` (crossborder-marketplace-free-hubs-under-ten, Sonnet 5.5, `--attempts 2`). Worker report, t885.

## Outcome

Partial. All three suspects are confirmed. Causes 1 and 2 are fixed in Core, and each has a provider-free test that fails when its fix is reverted. Cause 3 is confirmed but not fixed: fixing it changes what every judge is given, which is a design call for the lead (see the end of this report). Cause 1 was what started the extra spending. Cause 2 and the repeated "unsure" verdicts from cause 3 made it worse.

## The causes, in the order they happened

### Cause 1 (the root): a press that met the robot check was then treated as already done on every later pass

- **What the saved Flow run did.** The steps were: search, then the sort (draft step 5) met the traffic screen. The Lab played the person, then pass 1 read page 1 and stored 10 rows. Next page moved to page 2. Pass 2 read page 2, and its Next page met the traffic screen. The person cleared it and the page reloaded as page 3. On every pass after that, Next page was not sent. The loop read page 3 again and again, then stopped with `repeat.no_progress` (step 0029).
  - Evidence: the site's activity in `attempt-2/site.json` shows only one further load after the second `verify-human`. The opening look (step 0030) is on `page=3`. The `flowRun` told to the next round (0031 `request.txt` line 70) says position 8 passed and position 9 failed. Position 9 is the step that last sent a call, as `steps-ran.ts` chooses it, because the Repeat node has no draft step.
- **Why Next page was not sent.** Code path:
  1. A plain press whose answer is a failure goes to `heldByTarget` (`settling.ts`). A failed answer that is not `unacted` reads as uncertain (`run-acts/node-answer.ts:39`).
  2. So the press goes through `heldInDoubt`. That records it with `instructedAct: "flow_step"`, which makes it a *lasting* act that may have landed (`settling.ts:116`).
  3. On the next pass, the run gate's `record.carried(...)` (`run-gate.ts:116`) matches that act and answers "Already done" without sending anything.
  4. The page does not move. The domain's diff shows nothing changed, and after three such passes `no-progress.ts:76` ends the loop.
- **The judge saw the same record.** It listed `acts: Price ↑ may_have_landed, Next page may_have_landed` (0032 request, around line 624), with no `undeclared` flag. A plain press that landed cleanly is recorded as `undeclared` instead.
- **The same record led to the wrong rows later.** The next round's `core.run_flow` (0034) navigated home, which undid the sort. The sort press was then refused with `attempt.act_look_first` (0038), and the read at 0039 ran on the *unsorted* list. That is how cause 2 started.
- **Why this is wrong.** When a person clears the check, the engine continues down the step's own success route (`engine/automation/person-needed.ts`). The press reached the page, so it should not be held in doubt.
- **Fix.** `run-acts/settling.ts`, `heldByTarget` (lines 121-124, helper `metPersonCheck` at 221, constant at 72). A step whose answer is a `user_intervention_required` failure is now settled like a plain press that acted: undeclared, shown to the next round, and never refused. It is never held in doubt. If the answer says nothing was sent (`effect: "unacted"`), nothing is recorded. Lasting (declared) acts that meet a check are unchanged: they stay "may have landed", which is the safe reading for them. The file header explains why.
- **Test.** `run-acts/tests/plain-press.test.ts`: "runs on every pass of a repeat after a person cleared the check one press met, and is not held to a look". A repeat of 4 passes; the 2nd press meets a check; a parking port answers `person_done`. With the fix reverted it fails with `expected 2 to be 4`. Only 2 presses went out, which is the run's own symptom. A second new test checks that an `unacted` check records nothing; it passes with or without the fix and guards that boundary.

### Cause 2: rows from a short re-read and the next run merged out of the site's order

- **What happened** (the account in `rows/row-sink.ts` with `rows/list-after-read.ts`):
  1. The saved run's batch held 10 sorted rows.
  2. The unsorted read at 0039 matched only 2 rows (9,87 € Hubsmith and 8,99 € Keelson). All of them were known rows, so the list started over on those 2.
  3. The next run, 0044 to 0046, sorted the list and read all 10. The read was of another view with `writeMode: "append"` from the Flow's own read, so rule 2 did not start the list over (`list-after-read.ts:73`).
  4. 2 known rows out of 10 is under half, so rule 5 took the 10 as a *next page* (`known * 2 < read`) and appended them after the 2.
- **What the judge saw.** 0051 shows `9,87, 8,99, 2,89, 5,42, 6,99, 7,99, 8,20, 8,49, 9,15, 9,49`. That is exactly what this rule produces. Judges 0051, 0069, 0075 and 0078 all said no because the rows were out of order.
- **Fix.** In `list-after-read.ts`, `carriesOn` (lines 81-83, helper `holdsEveryRow` at 87): when a read holds every row the list holds, and more, out of the list's order, it is the list read whole again. The list starts over in the read's order. This loses nothing, because the read contains every row that was held. "Takes up where it ended" (a feed window) is still checked first. The header explains the change (rule 5 and a new paragraph).
- **Tests.** `rows/tests/list-after-read.test.ts`:
  - A rule-level test: two rows of a short list, then all ten read, `moved` and `append`; the result should start over in the read's order.
  - A sink-level replay of 0039 and 0046: the run's batch, then a 2-row read of another view, then the whole list read sorted. The result should be the sorted order, written as a `replace`.
  - With the fix reverted, both fail. The sink test gets `[ 'Ivy basket', 'Gum chest', … ]`: the two rows first, the same shape as the live run.

### Cause 3 (confirmed, not fixed): the judge sees only the page the run ended on

- **What happened.** 0032's diagnosis says: "The only page shown is page 3 of 45 results, which starts at 21,74 €. Pages 1 and 2, where the cheap items sit, are not shown. Shipping terms and ad flags for the stored rows are not shown either". It answered `unknown` at confidence 0.4.
  - The judge's `endView` is the page the run left (`attempt/run-attempt.ts:189`, via `flow-stage.ts`, "The look after a run stays where the run left the page").
  - The only `looked` entry was the opening snapshot of page 3, cut to 600 characters.
  - Attempt 1's judge (0027) said yes only because its run happened to end on page 2, which starts at 11,99 €.
- **Fixing cause 1 does not remove this.** The repaired run ends on page 3 too, because Next page `ended` there. So the stage's judge would still see only page 3.
- **Why I did not fix it here.** A real fix gives the judge evidence of the pages the stored rows came from. That needs three things:
  - read the read steps' captured page views out of the engine trace (`stateRefs.beforeAction.summary`, a host shape that Core otherwise carries without reading),
  - add a new judge-summary field, or lift the `looked` 600-character cut,
  - spend more judge tokens on every judged run.
  It changes what every judge is given, across lanes. It is a design decision for the lead, not a contained fix.
- **Recommended shape.** For a judged run whose result is a run's rows, add a "pages read" item for each read step: where it read, and how many rows it kept. That part is generic and comes from Core's own record capture (`outputs.records`). Optionally add the view of the page where the last row was kept. I did not build this.

## What changed (Core worktree `fxwork/t885/!FluxIQ`, `packages/fluxiq/src/framework/automation-service/service/answer-first/`)

- `run-acts/settling.ts`: cause 1 fix and header (+21 lines, 228 lines in total).
- `run-acts/tests/plain-press.test.ts`: two tests.
- `rows/list-after-read.ts`: cause 2 fix and header (+18 lines, 95 lines in total).
- `rows/tests/list-after-read.test.ts`: two tests.
- Nothing in `domain/src`, the Lab, fixtures, docs/working (other than this report), or git.

## Commands run and what they printed

- **Reverted-fix checks.** I disabled each fix in turn with `false &&` and ran its test file:
  - plain-press: 1 failed, `expected 2 to be 4`.
  - list-after-read: 2 failed (`expected false to be true`; `expected [ 'Ivy basket', 'Gum chest', …(8) ] to deeply equal [ 'Alder bench', … ]`).
  - Both files were restored from scratch backups and re-run green.
- `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first/run-acts src/framework/automation-service/service/answer-first/rows` → exit 0, 11 files, 167 tests passed.
- Neighbouring suites: `vitest run .../answer-first/tests .../answer-first/flow-run .../answer-first/attempt` → exit 0, 65 files, 432 tests passed.
- `pnpm --filter fluxiq check` → exit 0.
- `pnpm structure:check` (Core) → exit 0, "structure-audit: passed (536 warning(s), 1095 baselined)". The warnings are already there and are not in these files.
- `pnpm build` (Core) → exit 0. The final step was web:build, and the build stamped its runtime identity.
- `FLUXIQ_LAB_INSTANCE=t885-proof FLUXIQ_TEST_ENV_FILES=none pnpm lab attempt crossborder-marketplace --task crossborder-marketplace-free-hubs-under-ten --authoring-mode answer-first --scripted-model` → exit 0, `{"status":"passed","answerVerdict":"right","ended":"achieved","live":false}`, 12 live steps, the traffic screen played once. Evidence: `test-runs/instances/t885-proof/attempts/run-mwa3w40j-40bb3baa`.
- The same with `--attempts 2` (my addition, because attempt 2 is where cause 1 lives) → exit 1, `not_judged`, `AttemptScriptRefused`.
  - Attempt 1 was right.
  - In attempt 2, the saved Flow met the traffic screen at its search and the person cleared it.
  - The run then stopped at draft step 7 with `executor.target.gone`: a `dom-click` on a "Not now" notification cover that attempt 1 had met and attempt 2 did not.
  - The scripted model then could not answer request 17 ("The read's fields hold no title").
  - Neither failure is on the act-record path. The person-cleared search is recorded `undeclared`, with no held `flow_step` act (0028 request).
  - Evidence: `test-runs/instances/t885-proof/attempts/run-mwa3kh87-d34c2f04`.

## Not verified

- No live or paid rerun of the pair.
- I did not rerun the scripted `--attempts 2` with my fixes reverted. So whether the "Not now" target-gone stop happened before my change is inferred from the code, not observed.
- The saved run's own engine trace for attempt 2 is not kept anywhere. Cause 1's sequence (passes 1-2 moved, later passes skipped on page 3) is reconstructed from the site activity, the `flowRun` note, the act list, the page at 0030, and the code path. It is not read from a trace. The unit test reproduces the mechanism exactly.
- Domain tests were not run, because no domain file changed.

## Open questions or contradictions

1. **Cause 3 needs a decision from the lead** on judge evidence (above). Until then, a records task whose saved run pages to the end may still get "unsure" verdicts.
2. **A saved Flow can stop on a cover that is not there.** It fails on a cover the first attempt dismissed but that does not appear this time (`executor.target.gone` on "Not now", scripted pair). A dismiss-cover step that finds nothing to dismiss should probably be optional or skipped as absent.
3. **The scripted crossborder script cannot drive attempt 2's rounds.** It fails "The read's fields hold no title" at request 17. This is a Lab script limit in `packages/test-runner/...`, which I do not own.
4. **Runs within one attempt still merge into one list.** Rows from separate `core.run_flow` runs in one attempt still join one list, as designed. Only the "read whole again" case now starts over. If the lead wants each whole-Flow rerun to start its list over, that is a separate rule in `row-sink.ts`.
