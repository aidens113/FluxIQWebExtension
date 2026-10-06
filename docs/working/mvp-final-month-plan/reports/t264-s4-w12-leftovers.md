# t264-s4-w12-leftovers: worker report

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t264/!FluxIQ`, branch `task/t264-core-integration-chain`.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime/`; `U` = `R/flow-bootstrap/unfinished-build/`.
I made no git writes. Nothing is staged. W8-W11's uncommitted ports are untouched, apart from the owned files listed below.

## Outcome

**Partial.** Tasks 1, 2, 3, 4 and 6 are done. **Task 5 is blocked by the structure audit, and I put the file back to W11's
state** (see task 5).

Every check the brief names exits 0 on the final tree:
- the Core vitest set (numbers under "Commands run");
- the Core typecheck, the structure audit and `pnpm build`;
- the downstream domain and extension checks.

## What changed and why

### Task 1: `bootstrap.instructed_act_only_optional` is carried and said

- **`R/flow-bootstrap/plan/issue-feedback.ts`**: the code is added to `AUTHORED_CODES`, after
  `completion_profile_limit_exceeded`, with a 3-line comment.
  - Its message is fixed and quotes nothing: "The instruction asks for something that only an optional step of this
    draft does, so the Flow may never do it."
  - **Line endings:** git stores this file `-text` (`i/-text w/-text`, because of the literal NUL, US and DEL bytes in
    `printablePath`'s regex), and its index content is CRLF.
  - So I kept CRLF and inserted my 4 lines as CRLF, through a latin1 Buffer edit. Converting the file to LF would have
    rewritten all 203 lines in the diff.
  - `git diff --text` is my 4 added lines only (`+4`, no `-`).
  - This is the one file I touched that is not LF, and the reason is deliberate.
- **`R/flow-bootstrap/plan/tests/issue-feedback.test.ts`** (also `-text`, but LF): new test "carries the sentence of an
  act only a step the Flow may skip does". **It failed first** (1 failed, 8 passed), then passed (9 passed).
- **`U/not-done.ts`**: the first `BLOCKED_WORDS` entry became
  `/^bootstrap\.instructed_act_(?:missing|only_optional)$/u`, as W10 suggested, with a comment.
- **`U/tests/not-done.test.ts`**: new test of `BlockedSaid` and `StopSaid` for the code. **It failed first**
  (`expected '' to be 'the Flow did not yet do what you asked'`), then 26 passed.

### Task 2: ending words with no internals

| Where | Before | After |
| --- | --- | --- |
| `U/kept-said.ts` (every ending that keeps a draft) | "The Flow so far was kept as a draft, not put into the Flow, and building again carries on from it[, with $X left of this Flow's $Y]." | "The steps I found so far were kept as a draft, so building again carries on from them[, with $X left of this Flow's $Y]." |
| `U/budget-exhausted.ts` tried sentence | "I explored live once over 40 decisions, and what held it up was that the Flow did not yet do what you asked." | "I worked on it live once, exploring the page. What held it up was that the Flow did not yet do what you asked." (W7's `WorkedLiveSaid`; for 3 rounds: "I worked on it live 3 times: first exploring the page, then fixing it twice after testing what I had.") |
| `U/replies-unreadable.ts` opening | "The build stopped because the model's replies could not be read: 6 in a row came back unreadable -- because ... -- and each was asked again with a note of what was wrong." | "The build stopped because the replies it got back could not be read: 6 in a row came back unreadable -- because ... -- and it asked again each time, with a note of what was wrong." |
| `U/replies-unreadable.ts` count | "In all, 6 of 6 replies could not be read, over one live round; each was paid for and counted in the build's budget." | "In all, 6 of 6 replies could not be read; each was paid for and counted in the build's budget." For more than one round, `WorkedLiveSaid` + "." now goes in the close, before the kept sentence. |
| `R/activity/build.ts` headline | "Build stopped: the model's replies could not be read" | "Build stopped: the replies it got back could not be read" |

Why these words:
- **The kept sentence** uses lane D's own words from the chat's closing in `R/conversations/commands/create-here.ts`
  ("the steps found so far were kept as a draft, so building it again carries on from them"). It no longer calls the
  draft "the Flow" and then says it is not in the Flow. The header comment records the history.
- **"the replies it got back"** is the phrase `BLOCKED_WORDS` already uses for the same failure. W7's voice says "I"
  for the build, so "the AI's replies" would read as a different speaker.
- **The budget ending** splits "what held it up" into its own sentence, because `WorkedLiveSaid` already holds a colon
  clause.
- **The unreadable ending** says nothing about rounds when there is one: the opening sentence already says what
  happened, and "I worked on it live once, exploring the page" is not true of six unreadable replies.
- The counts (rounds, decisions) stay in `tried`.

Pins updated:
- the three files the brief named: `exploration.test.ts:120`, `unreadable-replies.test.ts:103-104` and
  `unfinished-build.test.ts:148`. The last also gains `not.toMatch(/\bdecisions?\b/)`.
- every other pin of the changed sentences:
  - `U/tests/`: budget-exhausted, ending-never-cut, judged, murzln6g-repair-funding, no-progress-ending, not-finished,
    phases, replies-unreadable, reserve-judging, reserve-unchanged, shared-purse;
  - `R/tests/service-bootstrap/tests/judged-build.test.ts` (2 kept-sentence pins).
- Two test titles that said "not put into the Flow" were renamed.

New assertions:
- `replies-unreadable.test` checks that one round's message has no `model`, `round` or "I worked on it live".
- `ending-never-cut.test` checks that the 3-round unreadable message puts the worked-live sentence right before the
  kept sentence.
- `budget-exhausted.test`'s "never says worked" now strips "I worked on it live" (which describes the build, not what
  the Flow does) before it checks for "worked".
- `activity/tests/scope.test.ts` pins the new headline and checks that it contains no "model". No test pinned the old
  headline.

### Task 3: the step number on a `repeat_taken_off` from a held amendment

- **Cause.** `settle()` applies each held amendment against the draft after the rerun, so a `repeat_taken_off` from
  `TakeOffBrokenRepeats` is numbered in that draft. It then overwrote every refusal's `step` with the held amendment's
  own step.
  - Scenario: step 2 repeats over step 1 through step 3, and the decision is `3 rerun` + `3 reorder to 2`. The
    refusal said step **3** (the rerun's) had its repeat taken off, but it was step **2**'s.
- **Fix, in `R/llm/evidence-loop/held-amendments.ts`:**
  - Only a `repeat_taken_off` keeps its own step. Its `step`, `over` and `through` are mapped back to the numbers the
    model wrote: the step objects as numbered when the amendment was applied, to their positions when the decision was
    read, with the rerun read as the step it replaced.
  - `now`, `overNow` and `throughNow` are recomputed against those numbers (new `takenOffAsWritten`).
  - Every other refusal still takes the held amendment's step, as before.
- **Test, in `R/llm/evidence-loop/tests/held-amendments.test.ts`:** a direct test of
  `automationStudioLlmEvidenceHeldAmendments` with `RerunReplaced`. **It failed first** (received `step: 3`, expected
  `step: 2`), then 5 passed. It expects
  `{ step: 2, reason: "repeat_taken_off", over: 1, through: 3, takenOff: "span_broken", now: 3, throughNow: 2 }`.

### Task 4: lane B's two bind assertions

`R/llm/evidence-loop/tests/authored-draft.test.ts` gets lane B's 2 `toContain` lines and their comment, exactly as in
`git -C t193 diff`. Result: 47 passed. (They pass at once, since W11 already ported the sentence.)

### Task 5: BLOCKED, left as W11 had it

- **What I did.** I moved the 4 cases into `R/llm/tests/rerun-needs-input.test.ts` with normal formatting: the import
  on 5 lines and the comment on 7. I restored `unusable-decision.test.ts` to HEAD (756 lines).
  - Both files passed (65 tests).
- **Why it failed.** The structure audit then failed:
  `FAIL [directory-files] .../runtime/llm/tests/: 26 source files exceeds the 25-file limit.`
  - W11's alternative, `R/llm/evidence-loop/tests/`, is also at 25 files.
- **What I left.** The only compliant homes are files I do not own, so I rebuilt W11's `unusable-decision.test.ts`
  exactly and deleted the new file.
  - The rebuild is HEAD plus W11's 2 imports and 41-line hunk, with the hunk taken from the moved file.
  - Result: 797 lines, `git diff --ignore-cr-at-eol --stat` = `41 insertions(+)`, the same as before.
- **Options for the supervisor:**
  - (a) Append the cases as a describe to `R/llm/evidence-loop/tests/rerun-input.test.ts` (249 lines, about rerun
    input, t211). This needs that path owned.
  - (b) Group `llm/tests/` by its shared prefixes, for example `deepseek-*` (3 files) or `evidence-loop-*` (5 files),
    into a feature directory. That frees room for the new file, but is a wider move.
  - (c) Leave it at 797 of 800 lines.

### Task 6: comments only

- `R/flow-draft/act-claim.ts:20` and `R/flow-draft/reversal.ts:46`: `./amendment.ts` → `./amendment/apply.ts`. That
  file calls both `automationStudioFlowDraftClaimAct` and `DropReversals`.
- `R/llm/evidence-loop/trace.ts:98` and `R/service/flow-bootstrap-commands/evidence-trace.ts:162`:
  `../../flow-draft/amendment.ts` → `../../flow-draft/amendment/types.ts`, where the refusal reason set lives.
- `R/service/flow-bootstrap-commands/build-judge.ts` `judgedTest` doc now reads: "the one left by a round the judging
  reserve stopped, or by a round that stopped short of saying its Flow was ready (`reserve-judging.ts`)".
- The `./amendment.ts` references in `R/llm/decision-handlers/` point at `decision-handlers/amendment.ts`, which exists,
  so I left them.

### Line endings

- All 33 files I touched are LF (0 CR, counted with node), except `issue-feedback.ts` (CRLF on purpose, see task 1).
- Six files I touched had CRLF in the working tree, all `i/lf`, and I converted them: `kept-said.ts`, `reversal.ts`,
  `evidence-trace.ts`, `murzln6g-repair-funding.test.ts`, `reserve-unchanged.test.ts`, `shared-purse.test.ts`.
- `judged-build.test.ts` and `authored-draft.test.ts` were converted too.
- `held-amendments.ts` was also CRLF in the working tree and is now LF.

## Commands run and observed results

From `packages/fluxiq` unless noted.

- **Failing-first runs:**
  - `held-amendments.test.ts`: 1 failed, 4 passed (`step` 3 vs 2), then 5 passed.
  - `issue-feedback.test.ts`: 1 failed, 8 passed, then 9 passed.
  - `not-done.test.ts`: 1 failed, 25 passed, then 26 passed.
- **First full run of the brief's set:** `Test Files 2 failed | 330 passed (332)`, `Tests 2 failed | 3434 passed (3436)`,
  exit 1. I traced both:
  - `rerun-needs-input.test.ts` was a collect error, because I deleted that file mid-run (task 5).
  - `judged-build.test.ts`: two pins of the old kept sentence. Updated.
- **Second run of the brief's set:** `1 failed | 330 passed (331)`, `Tests 1 failed | 3439 passed (3440)`, exit 1.
  - The failure was `service-bootstrap/tests/adaptation.test.ts` "bridges a generated proposal ID ...":
    `Test timed out in 15000ms`.
  - It ran while I was running the downstream extension and domain checks, the typecheck and the audit at the same
    time.
  - It references nothing I changed. It passed in the first run, and alone it gives `9 passed`.
- **Final run of the brief's set, with nothing else running:** `Test Files 331 passed (331)`,
  `Tests 3440 passed (3440)`, `Duration 215.88s`, exit 0.
- **Core root:**
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0, re-run on the final tree.
  - `node scripts/build-cache/cli.mjs structure-audit:check`:
    `structure-audit: passed (251 warning(s), 349 baselined).`, exit 0.
    - It exited 1 with `rerun-needs-input.test.ts` present (task 5).
  - `pnpm.cmd build`: exit 0 (`web:build` rebuilt).
- **Downstream root:**
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0.
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0.
  - Both report "core-build: FluxIQ Core's build ... is current with its source".
- **`git status --short`:**
  - compared with the snapshot taken before my work, there are 30 new `M` lines, all files I own, and 0 lines removed;
  - `act-claim.ts`, `held-amendments.test.ts` and `unusable-decision.test.ts` were already `M`;
  - `git diff --cached` is empty.

## Not verified

- **Live behaviour** (no Lab, browser or provider call), in particular:
  - whether the reworded endings read well in the extension chat;
  - whether a held move that takes off a repeat ever happens live. Task 3 is exercised in a unit test only.
- `docs/reference/framework-reference.md` was not regenerated, as instructed.
- **Authored docs:** `docs/architecture/automation-studio/llm-flow-bootstrap.md:1171` still quotes "The build stopped
  because the model's replies could not be read:". I do not own that file.

## Open questions or contradictions found

1. **Task 5's target path breaks the 25-file limit.** See the options under task 5.
2. **Old sentence in an unowned fixture.** `R/conversations/commands/tests/execute.test.ts:256` uses the old kept
   sentence as fixture input. It asserts nothing about Core's output, so it passes. Updating it would keep the fixture
   realistic.
3. **Same kind of mapping gap in other held refusals.** Their `over` and `through` (for example on `over_not_before`)
   are still numbered in the draft after the rerun, not the model's. With the rerun taking the replaced step's place,
   the two numberings agree, except when a held move has shifted steps. I fixed only `repeat_taken_off`, as briefed.
4. **Another internal word.** The budget ending's opening still says "its limit of 12 model calls" (`budgetSaid` in
   `U/budget-exhausted.ts`; pinned at `unfinished-build.test.ts:146`). It is outside this brief's sentences.
5. **Docs:** see "Not verified" for `llm-flow-bootstrap.md:1171`.
