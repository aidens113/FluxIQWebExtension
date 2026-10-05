# t264 S3 W7: one owner of the build's ending words (B F4/F10, D w48, D C4, A6, A9 wording)

## Outcome

Done. Every validation command in the brief ran and exited 0:

- Core vitest on the seven brief paths: 172 files, 1860 tests passed.
- Core `fluxiq:check`, `structure-audit:check` and `pnpm build`.
- Downstream extension subset: 165 tests passed.
- Downstream extension check, domain check and structure audit.

Other facts:

- Every changed or new file in both trees has LF endings: 55 Core files and 5
  downstream files, 0 with CR (counted with node).
- `git status` lists only my owned files plus W5's and W6's.
- I changed one owned test for a cause outside my units. W6's C2 broke a
  dev-added extension-chat test. See the extension-chat section below.

Paths:

- `R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`
- `U` = `R/flow-bootstrap/unfinished-build/`
- `C` = `R/conversations/`
- `X` = downstream `apps/extension/src/`

## What changed and why

### Conflicts, and which wording I chose

1. **The not-finished opening and the stood-still list.**
   - Lane B: `I have not finished this Flow yet: the last N repairs made no measurable progress ...: a; b; c.`
   - Lane D: `I have not finished this Flow yet. My last attempt to fix it got no further than the one before: a, b, and c.`
   - **I chose lane D's sentence.** Lane B's version contains the internal words D fixed: "measurable", "round", "(6, as before)" and "handed back".
   - Lane B's facts and judge logic are kept inside lane D's wording.
2. **The judge clause for an unsure verdict after a `no`.**
   - Lane B distinguished the pair: "no longer agreed it was wrong: one check said ..., the other did not" or "could not judge it this time, where it had found the round before wrong".
   - Lane D said "still could not tell whether it does what you asked" in every case. That repeats B's defect: run musp4h2f was told "still" after a `no`.
   - **I used lane B's logic with lane D's words:**
     - `the judge no longer agreed it was wrong, as one of its two checks said it does what you asked` (the pair has `oneCallSaidYes`);
     - `the judge could not tell this time whether it does what you asked, though it had found the attempt before wrong` (the pair has no yes);
     - `the judge still could not tell whether it does what you asked` (both unsure);
     - `the judge now found it does not do what you asked` (lane D: unsure, then `no`).
   - The "the other did not" half of B's clause was dropped. The doubt sentence that follows already says it, so keeping it would repeat the point.
   - "round" became "attempt", and "judge it" became "tell".
   - This also covers W5's leftover: the not-finished ending for a pair of `no` then a split.
3. **The tried sentence.**
   - Lane B kept `I tried N times live -- exploring, then N repairs ... -- over N decisions.`
   - **I chose lane D's sentence:** `I worked on it live twice: first exploring the page, then fixing it once after testing what I had.`
   - It is now shared as `automationStudioFlowBootstrapWorkedLiveSaid` in `U/not-done.ts`.
   - The not-doable ending uses it too. Nothing pinned that ending's tried sentence, apart from not-doable.test's "and the last attempt ended when ...", which still holds.
   - Its "handed back the same Flow" became "came out with the same Flow".
   - The counts stay in `tried`.
4. **How far it got and the test.**
   - **I kept lane B's `ProgressAndTestSaid`.** The point is said once, with the step count in the run clause.
   - Lane D left the two sentences separate.
5. **Cutting the message.**
   - **I kept lane B's `ending-fit.ts`.** Lane D still sliced the message.
   - The not-finished ending fits with lane D's sentences.
   - Its close is the tried sentence and the kept sentence, both always whole.
6. **The create-here line under an ending that kept a draft** (`C/commands/create-here.ts`).
   - Lane B: `What you asked is saved on the Flow "<name>".`
   - Lane D (C4): `The Flow "<name>" keeps your instruction, so you can build it again.`
   - **I chose:** `The Flow "<name>" keeps your instruction.` It is D's plain sentence, and it follows D's pattern for all three variants.
   - It drops "so you can build it again". The ending's kept sentence already says "building again carries on from it", which B made the one place for that point.
   - The other two variants are lane D's. Lane B left them unchanged.
7. **Repeated clauses neither lane fixed.** I found these with a probe of every ending. All are in owned files, and each fix is pinned by a test:
   - **Budget ending.** It said "not judged to do what you asked" in the progress sentence, then again as "what held it up was that the Flow it thought was ready was not judged to do what you asked". A `judged_wrong` stop is no longer said as what held it up when a judge was recorded (`U/budget-exhausted.ts`).
   - **Not-doable ending.** It said "judged not to do what you asked -- ..." and then the test's own "...judged not to be what you asked". The test sentence is now left out when the judge's account already says it. It is kept only for steps never run in this build, where it adds information (`U/not-doable.ts`).
   - **Not-doable's unsure reason** now goes through `UnsettledForBuild`, which closes lane B w10's open question 2.

### Final sentence for each ending

- **not_finished** (`U/not-finished.ts`). The probe output for run musp4h2f's inputs:

  > I have not finished this Flow yet. My last 2 attempts to fix it each got no further than the one before: 6 of the 6 things you asked have a step, no more than before, and the judge no longer agreed it was wrong, as one of its two checks said it does what you asked. What the judge doubted, in one check the other did not confirm: "step 9 clicked '+' once, ...". 6 of the 6 things you asked have a step that ran, or could run, when the Flow (16 steps) was run from its start, but the Flow was not judged to do what you asked. I worked on it live 4 times: first exploring the page, then fixing it 3 times after testing what I had. The Flow so far was kept as a draft, not put into the Flow, and building again carries on from it.

  Other variants:
  - Repeated unchanged: `My first attempt` / `My last attempt to fix it` `kept retrying the same things, which had already failed or done nothing, and left the Flow just as it started, so trying again would only do the same.`
  - The other stood-still clauses are lane D's.
  - The advice sentence: `What the judge says is left to change: "..."`.
  - The doubt sentence, when there is no observed text: `What one check of the judge says is left to change, which the other did not confirm: "..."`.
- **not_doable** (`U/not-doable.ts`):

  > I could not build this Flow, and I found no way to: it was tested from its start and judged not to do what you asked -- what its test did: "...". I worked on it live twice: first exploring the page, then fixing it once after testing what I had, and the last attempt to fix it ended when the judge found that what you asked can no longer be done.

- **budget_exhausted** (`U/budget-exhausted.ts`, lane B wording plus fix 7):

  > The build stopped at ... before the Flow was finished<spending>. <progress-and-test, said once>. The judge could not confirm it: ... Since they disagree, the build cannot finish on this test. I explored live 2 times over 38 decisions. <kept sentence, with what is left of the Flow's ceiling>.

- **replies_unreadable** (`U/replies-unreadable.ts`, lane B unchanged):

  > The build stopped because the model's replies could not be read: ... In all, 8 of 14 replies could not be read, over one live round; ... <progress-and-test, said once>. <kept sentence>.

- **Stop clauses** (`U/not-done.ts`, lane D):
  - "it used all the tries it had before the Flow was finished";
  - "too many attempts in a row went nowhere, because it kept trying changes to the Flow that changed nothing";
  - "the Flow it thought was ready was not judged to do what you asked".

  These feed the phases heading "The build stopped before the Flow was finished: ...".

### Ported as the lanes had it

- **`U/not-done.ts`.** I three-way merged lane B and lane D with `git merge-file` in scratch; there were no conflicts.
  - Lane B: the `QuoteRoom`/`room` parameters, `boundedAtWord`, `stepsInFlow`, `ProgressAndTestSaid` and `UnsettledForBuild`.
  - Lane B's D12 one-word fix "Repairing it live, running them again": it is in my file and removes a repeated label.
  - Lane D: `STOP_WORDS` and `BLOCKED_WORDS`.
  - Mine: `automationStudioFlowBootstrapWorkedLiveSaid`.
- **`U/ending-fit.ts` (new).** Lane B's file, now exported from `U/index.ts`. Lane B had not exported it.
- **`U/budget-exhausted.ts`, `U/replies-unreadable.ts`, `U/not-doable.ts`.** Lane B's files, plus the changes above.
- **Tests.**
  - `not-done.test` and `not-finished.test`: both lanes' blocks. Lane B's pins are rewritten to the merged words, and the internal-words regex is added to the musp4h2f block.
  - `judged.test`: both lanes' hunks.
  - `budget-exhausted.test`, `replies-unreadable.test` and the `reserve-judging.test` hunk: lane B's.
  - `ending-never-cut.test` (new): lane B's file, with its pins rewritten to the merged words. Two "said once" assertions are added for fix 7, and an index anchor is fixed, because the count now also appears in the stood-still clause.
  - `no-progress-ending`, `phases` (w48 hunk only), `repair-rounds` and `R/tests/service-bootstrap/tests/unfinished-build.test.ts` (w48 hunks): lane D's, applied with `git apply` to the working tree only.
- **A6 (`C/`).** All lane A hunks are applied:
  - `commands/command.ts`: the `announce` type;
  - `create-here.ts`, `explore.ts`, `improve.ts` and `run-flow.ts`: in `run-flow.ts`, only the one `announce` line;
  - `conversations.ts`: `pageUrl`;
  - `instructions/respond.ts`;
  - new `site-name.ts` and `tests/site-name.test.ts`;
  - tests `execute`, `extension-chat` and `respond-to-turn`.

  Dev's `explore.ts` changes (summary, the instruction argument and the continue phrases) and `prompt.ts` are untouched and still apply. `prompt.ts` still imports `automationStudioConversationPageShown`, which A6 keeps.
- **A9 (`X/shared/activity/wording.ts` and its test).**
  - The `activityActionFailureReason` import from `fluxiq/ui`, and its use in `toolOutcome` for `core.replay.(changed|unreproducible)`, falling back to the old words.
  - The three test lines.
  - Both files are now byte-identical to lane A's (same blob hashes `275c4f56` and `aa119008`).

### extension-chat.test: a failure caused by W6, fixed in my owned test

- **The failure.** After I ported A6 and C4, `continues a kept creation through the real explore registry command ...` failed: `getFlowRouter` returned a router where it expected `null`. This test was added on dev; lane A's copy of the file does not have it.
- **The cause is W6's C2, not the wording.** I set `shortJudged` to `false &&` in `phases.ts` from a scratch backup:
  - the test then passed (1 passed);
  - after restoring, `cmp` against the backup was identical, and `grep -c "shortJudged = false"` gave 0.

  The mechanism: under C2, the first build's short-stopped round is now judged. The world's judge always said yes, so the creation finished instead of staying unfinished.
- **The fix, in my owned test.**
  - The world gains `scriptJudge(["no", ...])`, which sets the judge's next answers; after them it says yes.
  - This test scripts `["no", "no"]` for the first build, so the creation stays unfinished with its draft kept, as the test intends.
  - All its continuation assertions are unchanged and pass.

### Docs

- **`docs/architecture/automation-studio/llm-flow-bootstrap.md`.**
  - The stale "ends the build `not_doable`" paragraph now reads `not_finished`, from lane B's hunk without its D12 sentence.
  - New: a list of the single owner's ending rules: no internal words, each judge pair, the doubt, said once, never cut, the split judge in a build's words, and the create-here line.
  - The ending-code table: the `not_doable` trigger is corrected, a `flow_bootstrap.build_not_finished` row is added, and "three explicit endings" now reads "explicit endings".
- **`docs/architecture/automation-studio/client-gateway.md`.** A new bullet on A6's first reply and site naming. Lane A had no doc hunk.
- **Downstream `docs/architecture/extension-client.md`.** It does not describe A9's replay outcome words (grep found none), so it is unchanged.

### Before and after, for each changed chat line

| Line | Before | After |
| --- | --- | --- |
| createHere first reply | `Doing "Create an automation here".` | `I'll make you a new automation for this, working out its steps by trying them on <place>. I'll say here when it is ready.` |
| explore first reply | `Doing "Build the Flow by exploring the site" for the Flow "<n>".` | `I'll work out the steps for "<n>" (or: the Flow's steps) by trying them on <place>, and say here when they are in.` |
| improve first reply | `Doing "<title>" for the Flow "<n>".` | `I'll work out the change to "<n>" by trying it on the website, then ask you here whether to apply it.` |
| run first reply | `Doing "Run a Flow" for the Flow "<n>".` | `Running "<n>" (or: the Flow) now. I'll say here how it went.` |
| client-run capability | `Doing "<title>" for the Flow "<n>".` | `On it: <title> for the Flow "<n>".` |
| landed step (create, explore) | `explored <origin+path> and worked out the steps` | `tried the steps on <site> and worked out which ones work` |
| createHere success | `Created the Flow "<n>", explored <origin+path>, and put the steps it worked out into the Flow. Say "run it" to try it.` | `Your automation "<n>" is ready: I tried its steps on <site> and put the ones that worked into it.` |
| explore success | `Explored <origin+path> and put the steps that worked into the Flow. Say "run it" to try it.` | `The Flow's steps are in: I tried them on <site> and kept the ones that worked.` |
| failed build, nothing kept | `What is left: the Flow "<n>", empty, with what you asked saved on it, so it can be built again.` | `The Flow "<n>" has no steps yet, but it keeps your instruction, so you can build it again.` |
| failed build, kept, with ending | `What is left: the Flow "<n>", with what you asked saved on it.` | `The Flow "<n>" keeps your instruction.` |
| failed build, kept, no ending | `What is left: the Flow "<n>", with what you asked saved on it and the steps found so far kept, so building again carries on from them.` | `The Flow "<n>" keeps your instruction, and the steps found so far were kept as a draft, so building it again carries on from them.` |
| extension status, `core.replay.unreproducible` | `<label> — it didn't work the same way again` | `<label> — the page wasn't in the same state when the test got there` |
| extension status, `core.replay.changed` | `<label> — it didn't work the same way again` | `<label> — it did nothing this time, where it did something before` |

`<place>`/`<site>` is the host without `www.`. A loopback or IP page is "the page you had open", and no page is "the website".

## Commands run and observed results

From Core `packages/fluxiq` unless noted.

- `npx vitest run <unfinished-build> <conversations> --exclude ".tmp/**"`, first run after porting: 1 failed, 297 passed. The failure was `extension-chat.test.ts` "continues a kept creation ...": `expected { schemaVersion: '0.1', … } to be null`.
- The probe with `shortJudged` disabled, running that one test: "1 passed | 9 skipped". `phases.ts` was then restored; `cmp` shows it identical to the backup.
- After `scriptJudge`: `extension-chat.test.ts` gave "10 passed (10)".
- The brief's seven paths (`flow-bootstrap`, `conversations`, `result-verification`, `tests/service-bootstrap/tests`, `tests/deepseek-bootstrap`, `tests/service-authoring/tests`, `tests/service-flows`), run with `--maxWorkers=4 --minWorkers=1`:
  - exit 0, "Test Files 172 passed (172)", "Tests 1860 passed (1860)", 119 s;
  - rerun after fix 7 and the docs: exit 0, the same counts, 121.5 s.
- `unfinished-build` alone after fix 7: "Test Files 24 passed (24)".
- Core root, `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0.
- Core root, `node scripts/build-cache/cli.mjs structure-audit:check`: exit 0, "structure-audit: passed (249 warning(s), 349 baselined)".
  - W6 had 248. The one new warning is advisory: `[exported-values] U/not-done.ts: 11 exported values`, because of `WorkedLiveSaid`.
- Core root, `pnpm.cmd build`: exit 0 (`web:build` 104 s).
- Downstream, `node <scratchpad>/t262-gate/run-subset.mjs <abs apps/extension> t264-w7 <17 test files under shared/activity/tests, panel/chat/stream/step/tests, panel/chat/view/tests, background/activity/tests>`: exit 0, 17 bundles.
- `node --test <bundles>`: exit 0, "# tests 165 # pass 165 # fail 0".
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0, with "core-build: ... current with its source".
- `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0.
- Downstream `node scripts/structure-audit.mjs`: "structure-audit: passed (170 warning(s), 118 baselined)".
- Line endings: Core 55 files, 0 with CR; downstream 5 files, 0 with CR (counted with node).
- The probe of every ending (`<scratchpad>/w7/probe.mts`, `node --experimental-transform-types`) printed the sentences quoted above.

## Not verified

- No live run, no browser and no Lab run. None of the new wording has been seen in the panel or in the overlay.
- I did not run the full Core vitest suite or the full extension suite. Tests outside the brief's paths could pin old ending text. I grepped Core `src`, and the only such pins are the ones listed under Open questions, which I did not change.
- The new assertions for fix 7 and the `scriptJudge` test were not run failing-first against the old code. Fix 7's repetition was observed in the probe output before the fix.
- `docs/reference/framework-reference.md` was not regenerated, as the brief says. It now lacks `automationStudioFlowBootstrapEndingFitted`, `WorkedLiveSaid`, `ProgressAndTestSaid` and `UnsettledForBuild`, and it was already stale.

## Open questions or contradictions found

1. **Internal words left in two endings.** The budget ending still says "I explored live N times over N decisions", and the unreadable-replies ending still says "the model's replies" and "over one live round". Their pins are in files I do not own:
   - `R/tests/deepseek-bootstrap/tests/exploration.test.ts:120`;
   - `R/tests/service-bootstrap/tests/unreadable-replies.test.ts:103-104`;
   - `R/tests/service-bootstrap/tests/unfinished-build.test.ts:148` (not the w48 hunk);
   - `R/activity/build.ts:58` (the activity headline "Build stopped: the model's replies could not be read").

   One owner of those files could switch them to `WorkedLiveSaid` and plain words.
2. **W6's C2 changes a dev test's scenario.** Any test that expects a short-stopped round to stay unfinished while its judge says yes now finishes instead. I fixed the one in my file. W6's open question 3 (C2 is wider than the live case) is the underlying question for the supervisor.
3. **Lane B's D12 was not ported.** That covers the `phases.ts` heading "Building on the Flow" and its `phases.test` pins: it is a repair heading, not an ending, and the brief limited me to the ending hunks in `phases.ts`. Only its one-word fix in `not-done.ts` ("Repairing it live, running them again") is in, because it is my file and removes the label repeated in the text.
4. **Other lane hunks deliberately left out:**
   - Lane B docs: `client-gateway.md` (F6 refusal cards), `flow-authoring.md`, and the `llm-flow-bootstrap.md` lasting-acts hunk at about line 1448 (w10 task 4, not an ending).
   - Lane D: w41, w46 and w47 hunks (`unchanged-complete.test`, `extend.test`, the doc at about line 735).
5. **`kept-said.ts` (not owned).** "The Flow so far was kept as a draft, not put into the Flow" is still awkward, as lane D's C4 report noted.
6. **`not-done.ts` has 11 exported values.** The advisory threshold is 8. `WorkedLiveSaid` could move to `tried.ts`, which is not mine.
