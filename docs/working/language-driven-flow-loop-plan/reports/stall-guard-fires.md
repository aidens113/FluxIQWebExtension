# The stall guard can fire, and redirects before it stops

Worker report. Brief: the evidence loop's no-progress guards could never fire, so
`run-mulum3x7-18ceeb75` spent most of its budget repeating itself and ended with
no Flow. All product changes are in `F:\!FluxIQ\packages\fluxiq\`. Nothing is
committed. This session was cut off by a machine crash midway; the surviving
state was checked for coherence (below) before the work continued.

## Outcome

Done. The guard is now 8 steps, not `min(24, maxIterations)`. What counts as "no
progress" now covers a successful call that answers what its own tool already
answered, and a repeat the caller announces. The loop no longer only stops: from
3 steps without progress it pushes a plain redirection that leads with what the
plan still lacks to answer the instruction (read from the completion check's
answerability) and keeps naming the last completion refusal until the model
tries to finish again. Stopping is five warnings later.

`maxIterations` was not touched.

---

## 1. What actually happened on `run-mulum3x7-18ceeb75`

Read from `snapshots/live-llm.json` -> `build.evidenceLoop.steps` (40 rows, the
full trace; `provider-failures.local.json` is truncated).

Two corrections to the brief's framing, both from the bundle:

- **It did not die at the iteration ceiling.** `maxIterations` was 48. The loop
  was stopped by the **token budget** at the top of iteration 35:
  534,026 of 600,000 tokens spent over 34 decisions (average about 15,700), so
  `tokensLeft = 600,000 - 534,026 - 15,706 = 50,268`, which is less than the
  56,000-token per-decision reserve (`loop-budget.ts:76-78`), so `decisionsLeft`
  was 0 and the loop ended `exhausted("budget")`. That is why the published
  `iterationCount` is 35 and `decisionCount` 34. The budget ran out *because*
  of the repetition: each of the wasted decisions cost about 15,700 tokens.
- **The row-0 `not_at_start_location` cost no turn** (section 4).

The shape of the trace:

| iterations | what happened | old counter |
|---|---|---|
| 1-7 | five actions that changed the page, a structure detection, an inspection | 0 |
| 8, 10 | `already_answered` on the detection | 0, then 2 |
| 11 | amendment `draft_rerun`, then the rerun returned 7,155 bytes **identical to iteration 7's** | reset to 0 |
| 12-13 | a real action, an applied amendment | 0 |
| 14-19 | **six** `draft_unchanged` amendments, `amended: 0`, the same two step ids refused every time | 1..6 |
| 20 | completion refused: `bootstrap.cannot_answer_instruction`, `recordProducerPresent: false` | 1 |
| 21-29 | structure refusals, four of them `answered_the_same_again` | up to 4 |
| 29-33 | four amendment reruns, each returning 8,960 bytes **identical to iteration 24's** | reset to 0 every time |
| 34 | completion refused by the dry run | 1 |

The highest the old counter ever reached was **6**. The guard was 24.

## 2. Why no guard could fire

Two faults, not one.

1. **The threshold.** `maxStepsWithoutProgress` defaulted to
   `min(24, maxIterations)`. On a Lab creation run `maxIterations` is the call
   budget (26 or 48), so no run of repetition could reach the guard before the
   budget ran out. This is the structural cause the previous worker named
   (`exhaustion-is-not-unusable-evidence.md`, audit item 3).
2. **What counted as progress.** The counter was reset by any call that was not
   "no applied effect and `ok: false`". A successful inspection that returned the
   same bytes as the last one reset it. A rerun through the amendment path is
   deliberately exempt from the repeat check (`rerun-request.ts`), so
   *amend-rerun, then identical success* could be repeated forever with the
   counter never rising above 1. That is the whole tail of this run
   (iterations 29-33). Lowering the threshold alone would not have caught it.

## 3. The fix

### 3.1 The numbers, and how they were chosen

`runtime/loop-limits/evidence-loop.ts`:

- `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_DEFAULT_MAX_STEPS_WITHOUT_PROGRESS`:
  **24 -> 8**.
- New `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_REDIRECT_AT_STEPS_WITHOUT_PROGRESS`:
  **3**.

Read off the trace under the new definition of progress:

- The longest run of no-progress steps that was **followed by new work** was
  **6** (iterations 14-19, after which the model tried to finish and then made a
  fresh structure detection). A stop at 6 or 7 would have ended a build that
  still had something to give. 8 is the first number above it.
- The longest run **not** followed by new work was **15** (iterations 20-34).
- The longest ordinary recovery measured on both debugged runs is **2** steps
  (`run-mulryg6h`: a `blocked_by_dialog` recovered on the next call). That is
  why 3 was wrong as a *stop*: it ended recoveries. For the same reason 3 is
  right as a *redirect*. It is the first step a recovery does not explain, and a
  redirect costs no call and no iteration.
- 8 is a sixth of a 48-call run and a third of a 26-call run. A test pins it
  below a third of `maxIterations` for 26, 48 and 64 calls.

`loop-configuration.ts` derives `redirectAtStepsWithoutProgress` as
`max(1, min(3, maxStepsWithoutProgress - 1))`, so the redirect always comes
before the stop, whatever a caller configures.

### 3.2 What counts as "no progress"

`runtime/llm/evidence-loop/no-progress.ts` (new) now owns all of the loop's
progress bookkeeping. It was six variables spread across five increment sites
in a 900-line file, which is how nobody saw that the guard was dead. A step
gives nothing new when:

1. nothing happened (no applied effect and `ok: false`; unchanged rule);
2. **the same answer again**: a call that changed nothing returned the bytes its
   own tool returned last time, whatever its code says. A call that *applied a
   mutation* is always progress, because two presses of the same control can
   answer `{ok:true}` twice and still do two different things;
3. **a repeat the caller announces**: new optional `repeatedAnswer` on the tool
   execution result (`tool-execution.ts`; parsed in `evidence-loop-decision.ts`,
   a whole number of 2 or more, otherwise dropped like the other diagnostics);
4. unchanged: a request answered from held evidence the model could already
   see, an amendment that applied nothing, and an unusable decision refused for
   issues already seen.

**On using `answered_the_same_again` / `detail.repeatedAnswer`, the brief's
point 2.** Core does not read the domain's `resultReason` string. That would
break the rule in `tool-execution.ts` that Core carries reasons and never reads
them. The signal is used in two ways:

- **The byte comparison (rule 2) catches the repeated *successes*.** No domain
  flag covers those, and they were the entire tail of this run.
- **The domain's own repeat notice defeats a byte comparison.** It writes
  `repeatedAnswer: n` onto the packet, so every repeat differs from the last by
  its count: 206 bytes, then 225, 225, 225. That is why Core needs the caller to
  say so in a field Core reads as a count: rule 3, `repeatedAnswer`.

**Downstream follow-up (not done; outside my files):** the web domain should set
`repeatedAnswer` on the `llm_evidence_tool_execution` result it returns, the
same number it already writes into `detail.repeatedAnswer`
(`domain/src/runtime/llm-evidence/repeated-refusal.ts:84`, beside
`answer.resultReason = "answered_the_same_again"`). Core already accepts the
field. Until then, refusals the domain marks as repeats are still counted by
rule 1, because they are `ok: false` with no effect. Only a *successful* repeat
that the domain announced would go uncounted, and none occurred on this run.

### 3.3 Redirect first, stop last

`runtime/llm/evidence-loop/stall-redirect.ts` (new) builds the entry, under
`core.no_progress`. From 3 steps without progress, and again on every further
step until progress or the stop, the loop pushes it as the newest evidence. It
costs no provider call and no iteration. It never ends the loop; if it does not
fit the evidence budget it is dropped.

It is codes, identifiers and counts only, under 1.5 KB. It says:

- **what the plan still lacks, first.** Added after the coordinator's
  mid-task note: the spinning on this run was a symptom of the iteration-20
  refusal, `bootstrap.cannot_answer_instruction` with
  `recordProducerPresent: false`. The redirect reads the latest completion
  check's answerability, which the loop already tracks as
  `previousAnswerability`. When the instruction asks for records and no step
  produces or saves them, it sets `stillMissing: "record_producer"` and leads
  with: your last attempt to finish was refused because the instruction asks
  for a set of records and no step in your draft produces or saves one; nothing
  you have already run supplies it; run the node that reads those records and
  keep it in the draft; complete only once the draft has it. It then does
  **not** say "complete now", which would contradict that;
- **the last completion refusal, kept until the model tries to finish again.**
  The surviving pre-crash code took it from `unusableInARow ? lastIssueCodes : []`.
  The first tool call after a refused completion resets that counter, so every
  redirect after iteration 20 of this run would have said nothing about the one
  thing that mattered. The ledger now records the refusal on the completion
  paths (`completionRefused`) and holds it. A mutation test confirms this: with
  that one line disabled, the pinning test fails;
- which tools keep answering the same thing, how many proposable steps the
  draft holds, and how many steps remain before the stop.

### 3.4 What the guard does on this run's trace

Replaying the recorded trace through the new rules (a script over
`live-llm.json`; this is the trace as recorded, so everything after the first
redirect is a run that would not have happened the same way):

- redirects at iterations **11, 16, 17, 18, 19, 22, 27, 28, 29, 30, 31**. The
  first fires before two thirds of the wasted work. Every redirect from 22 on
  leads with `stillMissing: record_producer`;
- the stop at iteration **32**, rather than a budget exhaustion at 35.

The saving in calls is small (3). The point is the eleven redirects, the last
six of which name the actual gap. It also shows both thresholds are reachable
on a real trace, which 24 was not.

## 4. `not_at_start_location` on iteration 0 is not a wasted turn, and not Core's to fix

- Row 0 is the loop's **free first look** (`evidence-loop.ts`, the
  `initialObservation` block before the `for` loop). It is made before any
  decision, with **no provider call**: the row has no `usage`. It is also **no
  iteration of the budget**: `accounting.iterations` starts at 1. It cost one
  domain round trip and 202 bytes of evidence.
- The refusal is deliberate and useful. A build told where it starts begins
  nowhere, so the Flow must contain the navigation step
  (`domain/src/runtime/llm-evidence/node-run/start-location.ts` explains why:
  a Flow handed its page never recorded how to reach it). The refusal names
  `startLocation` and tells the model to run the node that goes there, and the
  model did so on iteration 1.
- Core handles it correctly: the refused look is not filed as an answered
  request. The one change here is that it is now recorded as the tool's last
  answer, so a first decision that asks for the same capture again and gets the
  same refusal counts as a step without progress.
- The `iterationCount 35 / decisionCount 34` difference is the budget exit at
  the top of iteration 35 (section 1), not this row.

Nothing to fix. If anything, the first decision could be spared the refusal by
showing the start location up front, but that belongs to the domain's packet
and is not a defect.

## 5. The structure audit forced a real split

`evidence-loop.ts` was 797 lines against an 800-line hard limit. The first
version of this change took it to 907, and the structure audit failed. The
file-lines check is enforced, not advisory, so the fix is a split, not a
baseline entry:

- all progress bookkeeping moved to `evidence-loop/no-progress.ts`;
- two rationale comments moved to the modules they describe
  (`evidence-loop/draft-change.ts` now carries why a count joined the amendment
  code; `exhaustion.ts` already carried the exhaustion rationale, so the loop
  keeps a pointer).

The file is now exactly 800 lines. The new test lives in
`llm/evidence-loop/tests/`, the tests folder of the directory that owns
`no-progress.ts` and `stall-redirect.ts`. It is not in `llm/tests/`, which is
at its 25-file limit.

## 6. Tests

New file `llm/evidence-loop/tests/stall-guard.test.ts`, 14 tests:

- the guard is below a third of `maxIterations` for 26, 48 and 64 calls, and
  the redirect is strictly below the stop;
- a loop told the same refusal forever stops at iteration 8 of 48 with
  `repeat_without_progress`, after exactly five redirects counting down
  5, 4, 3, 2, 1;
- a byte-identical *success* is caught (stop at 9: the first answer is not a
  repeat of anything);
- a caller-announced repeat whose bytes differ every time is caught via
  `repeatedAnswer`;
- the amend-rerun-identical-result pair no longer launders the count;
- an ordinary recovery (two refusals, then a press that applied) sees no
  redirect and completes, and a loop whose answers keep changing runs to its
  ceiling with no redirect;
- **the live-run shape**: a press, a refused completion with
  `recordProducerPresent: false`, then repeated inspections. Every redirect,
  including those after the intervening tool calls, carries
  `stillMissing: "record_producer"` and the refusal code, leads with the gap,
  and never says "complete now";
- `automationStudioLlmEvidenceStillMissing` reads a gap only where the check
  found one;
- the note carries codes and counts only (page text and model words offered
  where codes belong are dropped) and stays small.

Rewritten, because it pinned the defect:
`runtime/tests/deepseek-bootstrap-exploration.test.ts`, "stops once a run of
unusable decisions has spent what the grant allows". Its own comment said
neither guard could fire first on a 12-call run. It is now "stops on the
no-progress guard while the grant still has calls". Eight malformed replies
stop at 8 of 12 as `flow_bootstrap.evidence_unusable_decision`,
`retryable: false`, with no `exhausted` block, and the grant is released.

## Commands run and observed results

**Crash recovery.** `git status` / `git diff --stat` after the crash showed
the eight modified files and three new ones this report lists. Each new file
ends on a complete closing brace. `evidence-loop.ts` alone was saved with LF
line endings where the checkout uses CRLF; I rewrote it as CRLF. The
repository stores LF, so git sees no difference. `tsc` and the stall-guard tests
passed on the recovered state before any further edit.

- `pnpm --filter fluxiq check` in the shared checkout: final run **exit 0**, no
  diagnostics. An earlier run in the same session failed with exactly one
  error, in `runtime/panel-capabilities/tests/vocabulary.test.ts` (`phrases`
  optional vs required). That file belongs to another agent's uncommitted edit,
  which has since cleared. To have a check not exposed to concurrent edits, I
  also exported `HEAD` with `git archive`, overlaid only my 11 files, and ran
  `tsc --noEmit -p tsconfig.json` there: **exit 0**.
- `node scripts/structure-audit.mjs`:
  `structure-audit: passed (189 warning(s), 355 baselined).` No baseline change.
  The first attempt failed on `evidence-loop.ts` (907 > 800 lines) and on
  `llm/tests/` (26 > 25 files); both were fixed by the split in section 5.
- `npx vitest run .../evidence-loop/tests/stall-guard.test.ts`:
  `Tests 14 passed (14)`. Mutation check: with
  `if (transition) noProgress.completionRefused(issueCodes);` disabled,
  `Tests 1 failed | 13 passed (14)`, and the failing test is the live-run-shape
  test. Restored afterwards.
- `npx vitest run src/.../runtime/llm src/.../runtime/loop-limits`:
  `Test Files 59 passed (59)`, `Tests 620 passed (620)` (before the answerability
  addition; the stall-guard file was rerun after it, above).
- `npx vitest run .../runtime/tests/deepseek-bootstrap-exploration.test.ts`:
  `Tests 11 passed (11)`, including the rewritten test.
- **The full Core suite, all 420 files, in two halves.** A single run was not
  possible. The pre-crash full run had given `2 failed | 418 passed (420)`: one
  was the test I then rewrote, the other a 15 s SQLite timeout in
  `database-manager/tests/index.test.ts` that passed alone (`8 passed`).
  After the crash, with a live Lab run, Playwright content tests and a Next
  build all running on the machine, a single run crashed a vitest worker
  (`Worker exited unexpectedly`) and timed tests out at 15 s. So:
  - `src/programs/automation-studio/runtime` (the half containing every file I
    changed), run in the isolated copy: `Test Files 5 failed | 275 passed (280)`,
    `Tests 7 failed | 3184 passed | 1 skipped (3192)`. Four were 15 s timeouts;
    three were `SQLITE_CANTOPEN: unable to open database file` in 33-65 ms,
    which is the isolated copy's path, not the code. Those five files rerun in
    the real checkout: `Test Files 5 passed (5)`.
  - everything else (`--exclude "src/programs/automation-studio/runtime/**"`),
    run in the real checkout, where nothing outside `runtime/` was being edited
    at the time: `Test Files 140 passed (140)`, `Tests 913 passed (913)`,
    exit 0.
  - The one isolated-copy failure outside `runtime`
    (`client-gateway/tests/bridge.test.ts`, `SQLITE_CANTOPEN`) was rerun in the
    real checkout: `Test Files 2 passed (2)`.
- `pnpm --filter fluxiq build`: **exit 0**. Confirmed in the output:
  `dist/.../loop-limits/evidence-loop.js` has
  `DEFAULT_MAX_STEPS_WITHOUT_PROGRESS = 8` and
  `REDIRECT_AT_STEPS_WITHOUT_PROGRESS = 3`, and
  `dist/.../llm/evidence-loop/{no-progress,stall-redirect}.js` exist and carry
  `completionRefused` / `stillMissing`. The Lab can run against it. Note that
  this build of the shared checkout also compiled other agents' uncommitted
  source in `runtime/panel-capabilities/` and `runtime/conversations/` as they
  stood at that moment. Before building I checked that the live Lab run in
  flight uses its own Core (`F:\fxwork\!FluxIQ`), so the `--clean` did not
  touch it.

## Files changed

All under `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\`.

New:
- `llm/evidence-loop/no-progress.ts`
- `llm/evidence-loop/stall-redirect.ts`
- `llm/evidence-loop/tests/stall-guard.test.ts`

Modified:
- `loop-limits/evidence-loop.ts` (8, 3, and the measured rationale)
- `llm/loop-configuration.ts` (`redirectAtStepsWithoutProgress`)
- `llm/evidence-loop.ts` (wired onto the ledger; answerability and refusal
  hand-off to the redirect)
- `llm/evidence-loop/index.ts` (barrel)
- `llm/evidence-loop/tool-execution.ts` (`repeatedAnswer`)
- `llm/evidence-loop-decision.ts` (parses `repeatedAnswer`)
- `llm/evidence-loop/draft-change.ts` (relocated rationale)
- `tests/deepseek-bootstrap-exploration.test.ts` (one test rewritten)

## Not verified

- **No live run.** The effect on a real build is shown by a replay of the
  recorded trace and by unit and end-to-end tests with a scripted provider,
  not against DeepSeek. Whether the redirects change the model's behaviour,
  and not just when the loop stops, is what the next live creation run will
  show. It is also the claim this change most needs measured.
- **The web domain does not yet set `repeatedAnswer`** (section 3.2). Core
  accepts it; the one-line downstream change is not made.
- **The redirect text has not been tuned against the model.** It is plain
  language by design, but its wording is untested against DeepSeek.
- **The replay in 3.4 is counterfactual** after the first redirect.

## Open questions or contradictions found

1. **The brief's framing:** the run ended on the token budget at iteration 35,
   not the iteration ceiling, and row 0 cost no turn (sections 1 and 4). Neither
   changes the fix.
2. **Concurrent edits in the shared Core checkout.** While I was validating,
   other agents had uncommitted changes in `runtime/panel-capabilities/` and
   `runtime/conversations/` (plus `api/contracts/conversation.ts` and
   `api/handlers/conversations.ts`). None of them are mine and I touched none of
   them. When the supervisor commits, my files are exactly the 11 listed under
   **Files changed**. My Core build includes those agents' source as it stood.
3. **A live Lab run was in flight** during my validation (`job-board`,
   `F:\fxwork\t172-live-lane-hard-sites`, its own Core at `F:\fxwork\!FluxIQ`),
   alongside Playwright content tests and a Next build. Machine load caused
   15-second timeouts in an early suite attempt; see below.
