# t264 S3 W6: stopped-round judging (D C2) on t262's reserve, and the finishing verdict (A w118 Core)

## Outcome

Done. Lane D's C2 (t195-w42) is rebuilt on t262's judging reserve, which is
bound by calls as well as money. The Core part of lane A's w118 is ported in
place. Every validation command in the brief ran and exited 0:

- vitest: 197 files, 2139 passed, 1 skipped (a conditional `skipIf`, explained below);
- `fluxiq:check`, `structure-audit:check` and `pnpm build`;
- the downstream domain, extension and test-runner checks.

Other facts:

- `service.ts` is 4400 lines.
- All 25 changed or new files have LF endings (0 CR, counted with node).
- `git status` lists only W5's files and mine.

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t264/!FluxIQ`. `R` is `packages/fluxiq/src/programs/automation-studio/runtime/`; `U` is `R/flow-bootstrap/unfinished-build/`.

## What changed and why

### C2: a round that stopped short is judged (rebuilt on t262)

- **`U/reserve-judging.ts`.** t262 gave the reserve function an optional
  `bound?: "cost" | "calls"`, and lane D gave it `stopped: "reserve" | "short"`.
  These are now one required field, `stopped: "cost" | "calls" | "short"`, which
  selects one of three summaries (`JUDGED_SUMMARY`):
  - `cost` and `calls` use t262's wording, unchanged;
  - `short` uses lane D's wording.

  t262's rules are unchanged:
  - the empty, dirty and refused (`accept`) cases are still not judged;
  - a yes counts only when it is about this Flow;
  - the reserve that call refusals keep back is still honoured.

  The `judged` result now also carries `verdict`, the non-yes verdict as it
  applies to this Flow (lane D). The module comment covers both cases and names
  t262's `keptBackCalls`.
- **`U/phases.ts`** (683 → 716 lines, budget 800). It takes lane D's logic:
  - `unchangedSinceNo` is factored out, and `unchangedAtStop = stoppedAtReserve && unchangedSinceNo`;
  - `shortJudged = ending.kind === "unfinished" && judge !== undefined && !unchangedSinceNo`;
  - the test runs with `{ judged: true }` when `atReserve || shortJudged`;
  - the judging step runs for either case, and only a short round announces "Judging the Flow";
  - `judgedAtStopUsd` is set only for a reserve stop;
  - a `no` updates `judgedNo`.

  The `stopped` argument is `"short"`, otherwise t262's `"calls"`/`"cost"`
  choice. The header paragraph and the `judgedNo` and `acceptStopped` docs come
  from lane D. t262's `stoppedAtReserve` (cost or calls) and its announcements
  are untouched.
- **`U/judgement.ts`.** Lane D's two doc-comment hunks only.
- **`U/tests/judge-stopped-round.test.ts`** (new). Lane D's 5 tests, unchanged,
  plus additions for t262 and w118. They pass without a purse, so t262 did not
  force any change.
  - Test 1 now also asserts `finishing` (`judgedAt: "stopped_short"`, `round: 1`, `matchesStandingFlow: true`) and the "stopped short" summary.
  - New test 6, "judges it with the calls kept back for judging when the round left no call for anything else (t262)":
    - it uses a purse with `maxCalls: 3`;
    - the round spends one decision, then a second non-judge hold is refused (the reserve keeps 2 calls back);
    - the round stops short on refused repeats;
    - the judge's two `judge: true` holds succeed;
    - the build finishes with `purse.spentCalls() === 3` and `judgedAt: "stopped_short"`.

### w118 (Core part): the finishing verdict on record

- **`U/contracts.ts`.** The yes verdict gains optional `confidence` and
  `unconfirmedAdvice`, and there is a new type
  `AutomationStudioFlowBootstrapYesAdvice`. The doc paragraph says both are a
  record only. W5's `oneCallSaidYes` and `judge_no_longer_refutes` hunks are kept.
- **`U/finishing-verdict.ts`** (new). Lane A's file, with one change:
  `judgedAt` gains a third value, `"stopped_short"`, for a yes about a round that
  C2 judged after it stopped short. Lane A's two values could not name that
  case. `judging_reserve` now covers reserve stops on money or on calls.
- **`U/index.ts`.** Exports `finishing-verdict.ts`.
- **`U/phases.ts`.** The `finished` outcome carries `finishing` beside `judged`
  on all three finishing paths:
  - a finished round: `finished_round`;
  - a reserve stop: `judging_reserve`;
  - a short stop: `stopped_short`.

  The header paragraph comes from lane A. The decision still reads only
  `verdict` and `flowSignature`.
- **`R/service.ts`.** These are the `buildJudged` lines only, every edit in
  place, so the file has 4400 lines before and after:
  - the barrel import;
  - the `let buildJudged`;
  - the assignment beside `evidenceTrace = built.trace`;
  - the spread into the proposal input;
  - the input field;
  - `detail.buildJudged` on the `created` audit event.

  Lane A's `automationStudioLlmBuildTrace` hunks belong to another unit and were
  not ported.
- **`U/tests/finishing-verdict.test.ts`** (new). Lane A's 4 tests, unchanged.
- **`R/tests/deepseek-bootstrap/tests/answerability.test.ts`.** Lane A's block of
  4 assertion lines in "converges ...".

### Docs (`docs/architecture/automation-studio/llm-flow-bootstrap.md`)

- Lane D's C2 bullet, after the "not judged again unchanged" bullet. It adds
  that the judge draws on the reserve's money and, under a call allowance, its
  calls (t262).
- A new paragraph after the success-audit counts paragraph, describing
  `detail.buildJudged`:
  - its fields, including the three `judgedAt` values;
  - why it holds digests;
  - that confidence and unconfirmed advice are a record only.

  Lane A had no Core doc hunk for w118: its report says the doc was not in its
  ownership and suggested this line.

### Lane hunks accounted for

- Lane D `phases.ts`, `reserve-judging.ts` and `judgement.ts`: every hunk is C2,
  and all are ported (reserve-judging reworked as above).
- Lane D `llm-flow-bootstrap.md`:
  - the C2 hunk is ported;
  - the hunk at about line 735 (rerun receipt `replacedBy`) is t195-w41, not ported.
- Lane D test hunks in `judged`, `no-progress-ending`, `phases` and
  `repair-rounds`: all are ending wording (w48) and were not ported. They are
  left to the later ending-wording unit.
- Lane D `unchanged-complete.test.ts`: the hunk is t195-w46 (the repeat guard's
  `MAX_REFUSED_REPEATS_IN_A_ROW`), not C2, and was not ported.
- Lane D `not-done.ts`, `not-finished.ts` and their tests: not mine (ending wording).
- Lane A `contracts.ts`, `index.ts`, `phases.ts`, `finishing-verdict*` and the
  answerability test: all ported.
- Lane A `service.ts`: the `buildJudged` hunks are ported. The
  `automationStudioLlmBuildTrace` import and its two `.timed(...)` call sites
  belong to t174-w116 and were not ported.
- Lane A `flow-authoring.md` and the other `llm-flow-bootstrap.md` hunks
  (w107, w94/w103 toggle, optional-only and claim-doubt): other units, not ported.
- Lane A downstream (`packages/test-runner/...`, `testing-facility.md`): a later
  stage, as the brief says.

## Commands run and observed results

From `packages/fluxiq` unless noted.

- **unfinished-build after the edits.** `npx vitest run .../flow-bootstrap/unfinished-build --exclude ".tmp/**"` gave "Test Files 23 passed (23), Tests 158 passed (158)".
- **Failing first.** I temporarily set `shortJudged` to `false &&` in
  `phases.ts`, from a scratch backup. `judge-stopped-round.test.ts` then gave
  "4 failed | 2 passed (6)": tests 1, 2, 3 and the new t262 test failed, and
  the two pins passed. With the backup restored, `grep -c "shortJudged = false"`
  gives 0, and the file gives "6 passed".
- **answerability.** `answerability.test.ts` gave "3 passed".
- **The brief's six paths.** `npx vitest run` on `R/flow-bootstrap`,
  `R/result-verification`, `R/tests/service-bootstrap/tests`,
  `R/tests/deepseek-bootstrap`, `R/tests/service-authoring/tests` and
  `R/service`, with `--exclude ".tmp/**" --maxWorkers=4 --minWorkers=1`:
  - exit 0, "Test Files 197 passed (197)", "Tests 2139 passed | 1 skipped (2140)", 115.6 s;
  - no failures and no timeouts;
  - the skip is `loop-budget-cost-ending.test.ts:75`, an `it.skipIf(CEILING < LEFT_BY_EARLIER_BUILD)`. It is a conditional skip, not my change. The same test ran and passed in the unfinished-build-only run.
- **Core root, `node scripts/build-cache/cli.mjs fluxiq:check`.** Exit 0.
- **Core root, `node scripts/build-cache/cli.mjs structure-audit:check`.** Exit 0, "structure-audit: passed (248 warning(s), 349 baselined)". This is the same warning count as W5's. My files have advisory warnings only:
  - `phases.ts` is 716 lines (advisory 400, budget 800);
  - the `unfinished-build/` and `tests/` directory file counts are over the advisory threshold.
- **Core root, `pnpm.cmd build`.** Exit 0 (`web:build` took 101 s).
- **Downstream root:**
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0;
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0;
  - `pnpm.cmd --filter @fluxiq-web-extension/test-runner check`: exit 0. The script exists.
- **Line endings.** I normalised the CRLF working copies (`phases.ts`,
  `reserve-judging.ts`, `index.ts`, `answerability.test.ts`) to LF before
  editing. The node count gives "files with CR: 0 of 25". `git diff --stat` and
  `git diff --ignore-cr-at-eol --stat` agree: "19 files changed, 413
  insertions(+), 81 deletions(-)", plus 6 untracked files. These totals include W5's.
- **`service.ts`.** `wc -l` gives 4400. My script reported the same line count
  before and after the edit.

## Not verified

- **No live run.**
  - Whether a real stopped-short round's Flow passes the service's
    `acceptStopped` completion check is untested.
  - Whether the real judge's `judgedTest()` hands over the short round's test
    report is untested. The service is unchanged, and the scripted test only
    shows that `judged: true` is passed.
- **Confidence and advice are still never filled by the real judge.** This is
  lane A's open question 1:
  - `R/result-verification/build-test/judge.ts` maps an "answers" outcome to
    `{ verdict: "yes", spent }` and drops confidence, advice and patchNeeded;
  - so `confidence` and `unconfirmed` are covered only by scripted values;
  - `judge.ts` is not mine.
- **The typed-store path of `getFlowAdaptation` with `detail.buildJudged` is not
  exercised** (lane A noted this too).

## Open questions or contradictions found

1. **The downstream reader must accept the third `judgedAt`.** Lane A's
   downstream `packages/test-runner/src/flow-lane/creation/build-proposal.ts:493`
   (the later stage) rejects any `judgedAt` other than `finished_round` or
   `judging_reserve`. When it is ported, it must also accept `stopped_short`.
   Otherwise a build that finished on a C2 judgement records `judged: null`.
2. **A stale doc comment outside my ownership.** The `judgedTest` doc in
   `R/service/flow-bootstrap-commands/build-judge.ts` still describes only the
   reserve case (lane D noted this).
3. **Behaviour wider than the live case, as lane D reported.** A short-stopped
   round 0 with no earlier judge is also judged. That costs one judging pair
   from the reserve, which is kept back from the start anyway.
4. **A Flow unchanged since its `no` gets no judge account.** A short-stopped
   round on the Flow last judged no is not judged again, and no judge account is
   copied onto it. Unlike the reserve-unchanged case, it therefore has no
   one-more-round allowance. This is lane D's behaviour, kept as is.
