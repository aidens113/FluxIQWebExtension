# t264 S3 W5: judge evidence (A3a and B F2 merged by hand, B F3)

## Outcome

Done. A3a (t174-w106), F2 (t193 1003 w3) and F3 (t193 1003 w4) are ported into
Core `C:/Users/osrs_/FluxStuff/fxwork/t264/!FluxIQ` on top of `e223e765`.
Every validation command in the brief ran and exited 0. All 17 touched files
have LF endings (0 CR, counted with node). `git status` lists only owned files.

R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## What changed and why

### A3a and F2 together (`summary.ts`, `observation.ts`, the prompt and the pin)

The merge keeps lane B's route and adds lane A's bounding to it. Nothing was
settled by taking the last writer's version.

- **B's route.** For a mutating step that was not only checked and was run
  again (`replayed`, or it has passes), `summary.ts` builds the set of codes its
  outcome already gave (`replayedCodes`, same as lane B). The step is then
  observed through the normal observation reader, both for its pass lines and
  for its own row. The reader keeps an answer only when it carries `changed` or
  `notice`. It removes `ok`, `said` and any `code` already in that set, and then
  applies B's full screen: denied keys, locators, the whole-value credential
  screen, and "as step N".
- **A's bounding, applied inside that route.** Before the screen, the answer's
  `changed` member is passed through `R/result-verification/build-test/change-lines.ts`. Its lines are:
  - capped at 3, each cut to 160 characters;
  - ordered with lines quoting the step's own words first;
  - stripped of locator text, or dropped and marked withheld when they look like a credential;
  - counted in `changedNotShown` when left out.

  The reader's third argument changed from B's `restating?: Set` to
  `changing?: { restating, words }`, so the reader knows the step's words.
- **The quantity evidence.** A "+" or "-" has no word longer than one character,
  so A's priority rule finds no line about the control. The change-lines file
  now ranks lines in three tiers:
  1. lines quoting the step's own words;
  2. lines where a text now reads otherwise (the domain's `was "..."`, as in `t932 "2" was "1"`);
  3. the rest, in the domain's order.

  This means the cap cannot push the quantity a "+" set off the list. The
  domain's own closing line, `and N more changes` (from `page-changes.ts`), is
  added to `changedNotShown` and never counted as a line. These two rules go
  beyond either lane. I added them to meet the brief's "essential quantity
  evidence" requirement, and they are tested.
- **Departures from lane A.** A read only the last answer of a step with no
  passes. B's wider scope wins: every answer, repeated steps' passes included,
  and each is bounded. A non-array `changed` is not sent; it is not the
  domain's shape.
- **The prompt** (`R/llm/diagnosis-instructions.ts`):
  - B's `observed (... a check's answer, or, for a changing step run again, what it changed or what the page answered -- a replayed press's observed.changed is what the test saw it change)` is kept exactly.
  - A's sentence that exploration's state predates the test is kept exactly.
  - A's second sentence is reworded so `observed.changed` is not defined twice: "A replayed step's observed.changed gives the lines about its own control first, then text that now reads otherwise, such as a quantity it set (changedNotShown more not listed): read it for a step that undoes what another step did."
  - A history comment paragraph covers both units.
- **The pin** (`R/llm/deepseek/tests/system-prompt-pins.json`): only the
  `loop_verification_build_test` value changed. I edited it with a script
  (`scratchpad/w5-prompt.cjs`) that made the same two exact-once replacements in
  the source and in the pin, and rewrote only that line. Lane B's
  `evidence_tool_decision` pin change belongs to another unit and was not
  ported.
- **Other files.**
  - `R/result-verification/build-test/index.ts` exports `change-lines.ts` (A).
  - `change-lines.ts` exports the `"changed"` key constant and the function,
    following the precedent in `read-rows.ts`.
  - The `summary.ts` header covers both units.
- **Tests.**
  - `tests/summary.test.ts`: B's six run-musp4h2f tests, unchanged.
  - New `tests/change-lines.test.ts` has 7 tests:
    - A's three tests. Its assertions stand, plus one check that no restating keys are sent.
    - The quantity line ranks ahead of the page-order lines.
    - The domain's `and 7 more changes` is counted.
    - A credential-shaped line is dropped and withheld.
    - An answer whose only lines were screened out is not sent, and the summary is marked withheld.
  - `llm/tests/diagnosis-channel.test.ts`: A's describe block, with the strings from both units.

### F3 (`judge.ts`, unfinished-build)

- `R/result-verification/build-test/judge.ts`: B's `oneCallSaidYes?: true` on
  the unknown verdict, set when `outcome.basis === "model_disagreed"`. This is
  the 2-line change that lane B's w4 could not make. Applied onto t262's purse
  and call-allowance changes with an offset of 3 lines, no conflict.
- `tests/judge.test.ts`: B's test that no-then-yes carries the flag and
  no-then-unknown does not.
- `unfinished-build/contracts.ts`: B's three F3 hunks, all ported:
  - the verdict union field and its documentation;
  - `JudgedWrong.oneCallSaidYes`;
  - the `judge_no_longer_refutes` measure and its documentation entry.

  Lane B's contracts diff has no other hunks. Lane A's w118 finishing-verdict
  hunks were not touched.
- `judgement.ts`: carries the flag. `progress.ts`: the new measure and its
  header paragraph. The new file `tests/progress.test.ts` has 3 tests, and
  `tests/judgement-value.test.ts` has 1 new case.

### Docs

`docs/architecture/automation-studio/llm-flow-bootstrap.md`:
- B's F2 paragraph, extended with A3a's bounding rules and the predates-test
  sentence. Lane A had no doc hunk for w106.
- B's F3 bullet for `judge_no_longer_refutes`.

### Lane hunks deliberately not ported here (left for named later units)

- Lane A `summary.ts` header "Cause 5" paragraph (`step_is_optional` `said`) and
  lane A `tests/summary.test.ts` "an act whose only step may be skipped" block:
  these belong to A's optional-only unit, not A3a.
- Lane A `unfinished-build/{contracts,index,phases}.ts`, `finishing-verdict*`:
  these are w118.
- Lane B `unfinished-build/not-finished.ts` and `tests/not-finished.test.ts`
  (F3's ending wording):
  - "the judge no longer agreed it was wrong";
  - "could not judge it this time".

  `not-*` is on this brief's Must-not-touch list, so this goes to the unit that
  owns `not-finished.ts` (F4/F10, `1003-w9`). Until then the measure works, but
  the not-finished ending after a no-then-split pair still uses the old wording.
- Lane B `tests/judged.test.ts`: both hunks are ending or repair-heading
  wording ("when the Flow (3 steps) was run", "Repairing it live") from the
  not-* and phases units. It has no F3 hunk, so nothing was ported. The current
  file passes unchanged.
- Lane B pin `evidence_tool_decision` (the binding unit), lane B
  `client-gateway.md` (activity refusal cards), lane B `flow-authoring.md`, and
  lane B `llm-flow-bootstrap.md` at about line 922 (not-finished wording, F4
  and the not-* units).

## Commands run and observed results

From `packages/fluxiq` unless noted.

- `npx vitest run` on the focused build-test, diagnosis-channel, system-prompt, progress and judgement-value tests: "Test Files 13 passed (13), Tests 141 passed (141)".
- `npx vitest run --maxWorkers=4 --minWorkers=1` on the brief's seven paths:
  - paths: `.../result-verification`, `.../flow-bootstrap/unfinished-build`, `.../llm/tests`, `.../llm/deepseek/tests`, `.../tests/service-bootstrap/tests`, `.../tests/deepseek-bootstrap`, `.../tests/service-authoring/tests`;
  - result: exit 0, "Test Files 115 passed (115), Tests 1126 passed (1126)", 110.9s;
  - no failures and no timeouts.
- Core root, `node scripts/build-cache/cli.mjs fluxiq:check` (incremental `tsc --noEmit`):
  - First run: exit 2 with `change-lines.test.ts(94,50): error TS2322: Type 'string | undefined' is not assignable to type 'JsonValue'`. The cause was my test indexing `lines[3]` under `noUncheckedIndexedAccess`. I fixed it with `lines[3]!`.
  - Rerun: exit 0. That test file was rerun alone: 7 passed.
- Core root, `node scripts/build-cache/cli.mjs structure-audit:check`: exit 0, "structure-audit: passed (248 warning(s), 349 baselined)".
  - The only warning on an owned file is `[file-lines] build-test/summary.ts: 417 lines is past the 400-line advisory threshold`. It was already 401 lines at HEAD, so already past the threshold.
- Core root, `pnpm.cmd build`: exit 0. `web:build` finished in 95s.
- Downstream root:
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0, with "core-build: ... current with its source".
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0.
- Line endings:
  - `git apply` (the lane B patch) wrote 8 files back as CRLF under `core.autocrlf=true`. I normalized all touched files with node.
  - Count: "files with CR after: 0 of 17".
  - `git diff --stat` and `git diff --ignore-cr-at-eol --stat` now agree: 14 files, 239+/21-, plus 3 untracked.
  - Rerun after normalizing: build-test, unfinished-build, diagnosis-channel and deepseek tests, "Test Files 40 passed (40), Tests 357 passed (357)".
- `git status --short` (Core): the 14 modified files and 3 new files listed under Changed, all owned. Nothing else.

## Not verified

- No live run and no real judge call. The judge's reading of the merged prompt
  and of the bounded `changed` lines is untested.
- Request size with change lines present: `request-size.test.ts` passes, but its
  run-36 fixture has no `changed` lines. Bounded, a row adds at most about 500
  characters.
- The new tests were not run failing-first against the pre-merge source. Their
  expectations follow from the code paths they exercise.
- F3 end to end: no phases-level scripted test of no then split then
  continuing. The not-finished wording for that pair is not ported (see above).
- `docs/reference/framework-reference.md` cites `observation.ts` line numbers
  (`:53`, `:68`). It is generated, the brief forbids touching it, and none of
  the checks above flagged it.

## Open questions or contradictions found

- The brief lists `unfinished-build/tests/judged.test.ts` as owned for "F3 hunks
  only", but lane B's diff of that file has no F3 hunk. Both hunks there are
  wording from other units.
- The three-tier ranking (quantity lines second) and the counting of the
  domain's own `and N more changes` are new over both lanes. They are my
  reading of "keep the essential quantity evidence". The supervisor may want to
  confirm that reading.
- The `R/result-verification/contracts.ts` doc comment on `observed` ("the rows
  a read returned, or a check's answer") is now incomplete, as lane B's w3
  already noted. The file is not owned here.
