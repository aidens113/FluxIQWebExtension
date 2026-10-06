# t276-core-ending: the build ending in the chat, plain, whole and said once

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t276/!FluxIQ` (branch `task/t276-live-ui-fixes`).
Nothing committed. In this report, R means `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Items 2a-2d and 4 are fixed, with tests that fail on the old code and pass on the new.
One test outside my files still asserts the old run-ending wording: `R/activity/tests/scope.test.ts` lines 152 and 160.
The other worker owns that file, so I did not change it. The fix it needs is in "Open questions".

## What changed and why

### One screen for the judge's words: `R/flow-bootstrap/unfinished-build/judge-words.ts` (new)

`automationStudioFlowBootstrapJudgeWordsSaid(text, most)` is now the only way an ending quotes the judge.

**What it removes or rewrites:**
- A handle, id or code in parentheses is left out ("(t958)").
- A step id that follows a noun is dropped ("the confirm loop s11" becomes "the confirm loop").
- Any other step id becomes "a step", or "the step's" for a possessive like "s8's".
- The draft's words become plain words:
  - "its where" becomes "its condition"
  - "end view" becomes "the page at the end"
  - "node" becomes "step"
  - "draft" becomes "Flow"
  - names like `mutualFriends` or `snake_case` are written as ordinary words
- A sentence, or a clause between semicolons, that still holds an id or a code is left out whole. A bare code says nothing at all.

**How it fits the words into the room it is given:**
- It keeps whole sentences only, never cutting inside one.
- If even the first sentence is too long, it drops the asides in parentheses. If that is still too long, it keeps the opening clauses up to a ", and", ", but" or ", so".
- If nothing fits, it returns nothing, and the ending says it in Core's own words.
- The result is not a quote any more, so the endings no longer put quotation marks round it.

### Item 2a/2b: raw ids, cut quotes and quotes inside list clauses

| Defect | Cause (old file:line) | Fix |
| --- | --- | --- |
| U9 "this time the judge found: \"s8 kept only ... where requires ... equal ...\"" | `not-finished.ts:153` put `after.observed` in quotes inside the list clause of what stood still; `bounded()` at `:166-168` sliced it at the room limit | The clause now says "the judge's finding changed". A separate sentence follows: "What the judge found this time: <screened words>" (`foundSaid`). |
| U4/U9 "What the judge says is left to change: \"... (t958) ...\"", "fix s13 so..." | `not-finished.ts:77` `bounded(judge.advice, room.judge)` | Advice goes through the screen, with no quotation marks. |
| The doubt said by an unsure judge | `not-finished.ts:132-135` `bounded(...)` in quotes | Screened, with no quotation marks. |
| Same defect in the not-doable ending | `not-doable.ts:108-123`: quotes after " -- " that `bounded()` cut | Separate sentences: "What you asked, as the judge read it: ...", "What its test did: ...", "The judge said: ...". No dash. The checklist sentence after them opens with a capital. |
| Same defect in the budget ending | `budget-exhausted.ts:193-203` `bounded()` | Screened. |
| Same defect in the repair heading ("Repairing it live") | `not-done.ts:207-212` `boundedReason` cut mid-way when no sentence ended inside 160 characters | Screened at 160 characters. |

### Item 2c: the same sentence or count said twice

| Defect | Cause | Fix |
| --- | --- | --- |
| U4 "5 of the 5 things you asked have a step" said twice | `not-finished.ts:105-112` `stepsAskedSaid` gave the count in the stood-still sentence, and `automationStudioFlowBootstrapProgressAndTestSaid` gave it again | The stood-still sentence now says only whether the count moved: "no more of what you asked has a step than before", or "N fewer ...", or "the one thing you asked no longer has a step / still has no step". The progress sentence alone gives the count. |
| Any repeated sentence | `ending-fit.ts` `joined()` | `joined()` now drops a sentence that repeats an earlier one, ignoring case and spacing. Every ending is put together through `joined()`. |

### Item 2b: the Flow name cut mid-word

| Defect | Cause | Fix |
| --- | --- | --- |
| U9 close: `The Flow "Go through ... at least five mutua..." keeps your instruction.` | `conversations/commands/create-here.ts:77` sliced the name at 77 characters | The name is cut after its last whole word. The live text now gives "... at least five...". |

### Item 2d: U-10 in `R/activity/wording/run-ending.ts`

| Defect | Cause | Fix |
| --- | --- | --- |
| "Run failed — It returned 30 rows, but ..." | `run-ending.ts:33-38` opened with a capital and said "returned" | It now reads "it saved N rows, but the check found ...", "it saved no rows ..." and "the check found its result ...". Every variant opens in lower case. |

### Item 4: messages Core stores for a failed build or run (`R/conversations/**`)

| Defect | Cause | Fix |
| --- | --- | --- |
| U1 old thread: "the build failed: Flow Bootstrap generation failed (flow_bootstrap.blank_target_required) (pre_provider_validation: flow_bootstrap.blank_target_required)" | `commands/progress.ts:60-64` `automationStudioConversationCallCause` added the error text with its code, then the stage and the code again | The cause now comes from what the code means (`CODE_WORDS`). For example, blank_target_required reads "FluxIQ could not tell which part of this Flow to build on, as it builds on a Flow with one main part". If the code has no words of its own, the stage's meaning is used (`STAGE_WORDS`). After that comes the error with its codes taken out (`automationStudioConversationPlainCause`, new export). The last resort is "something went wrong inside FluxIQ". |
| Any other cause holding a code | `progress.ts` `failed()` | `failed()` now screens every cause, so the stored summary and `error` are plain whatever the caller wrote. |
| A failed run: "The run run.7 ended failed: <reason>", "started run <id>" | `commands/run-flow.ts:56,61` | Now "The run failed: <plain reason>." or "The run was cancelled ...", and "started the run". The `runId` is still carried on the outcome. A successful run's summary is unchanged. |
| A thread note: "the model call failed (code)" | `instructions/interpret.ts:110` | Now "the model call failed". |

## Tests

**New tests. Each was run against the old sources by putting the HEAD versions back temporarily (restored afterwards and checked with `cmp`):**

- `R/flow-bootstrap/unfinished-build/tests/plain-ending.test.ts`: 12 tests. They use the judges' own words from runs A and B (steps 0100-judge and 0127-judge). On the old code 8 failed. The 4 that passed are unit tests of the new module, which the old code does not have.
- `R/conversations/commands/tests/plain-failure.test.ts`: 6 tests, covering the blank_target_required refusal through `flow.improve`, codes and stages, failed runs, model problems and the Flow name. All 6 failed on the old code.
- `R/activity/wording/tests/run-ending.test.ts`: one new U-10 test. It failed on the old code, as did 4 existing tests updated to the new wording.

**Existing tests updated to the new wording:**
- `ending-never-cut`, `judged`, `no-progress-ending`, `not-doable`, `not-finished`, `phases`, `repair-rounds`, `reserve-judging` and `reserve-unchanged` (all under `unfinished-build/tests`)
- `conversations/commands/tests/execute.test.ts` (2 assertions)
- `R/tests/service-bootstrap/tests/judged-build.test.ts:457`: one quoted-advice expectation, changed because it asserts this ending's wording.

## Commands run and observed results

From `packages/fluxiq`:

| Command | Result |
| --- | --- |
| `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build src/programs/automation-studio/runtime/conversations src/programs/automation-studio/runtime/activity/wording/tests/run-ending.test.ts src/programs/automation-studio/runtime/tests/service-bootstrap/tests/judged-build.test.ts` | Test Files 45 passed (45); Tests 343 passed (343) |
| Fail-first check: `plain-ending.test.ts` with HEAD versions of not-finished, ending-fit, not-doable, budget-exhausted and not-done | 8 failed, 4 passed (12) |
| Fail-first check: `plain-failure.test.ts` with HEAD versions of progress, run-flow, interpret and create-here | 6 failed (6) |
| Fail-first check: `run-ending.test.ts` with HEAD `run-ending.ts` | 5 failed, 4 passed (9) |
| Other Core tests that assert ending texts (found by grep): build-ending, run-controller, refuted-result-port, deepseek-bootstrap answerability and exploration, service-bootstrap judged-build, provider-unavailable, unfinished-build, unreadable-replies and rejections, plus activity scope | Before the judged-build edit: 3 failed (2 in `activity/tests/scope.test.ts`, 1 in judged-build), 93 passed. After the edit, judged-build: 7 passed (7). |

From the Core root:

| Command | Result |
| --- | --- |
| `node scripts/build-cache/cli.mjs fluxiq:check` | Exit 2. Two type errors, both in the other worker's files: `R/activity/tests/call-context.test.ts(112,112)` TS2322 and `R/activity/wording/draft-edit-card.ts(77,5)` TS2375. None in my files. |
| `node scripts/structure-audit.mjs` | "structure-audit: passed (260 warning(s), 349 baselined)" |

- I grepped `apps/web/src` tests for the changed strings and found none. The web `messages.test.ts` does not assert them.
- All files I touched are LF (checked with `grep -c $'\r'`, which found 0).

## What the next live run's UI review must see

- The not-finished ending:
  - No step ids (`s8`, `s11`, `s13`), handles (`(t958)`), "where", "end view", "node" or `camelCase` names.
  - No `...` inside the judge's words, and no quotation marks round them.
  - The judge's words as sentences of their own: "What the judge found this time: ..." and "What the judge says is left to change: ...".
- The count "N of the M things you asked" appears once. The stood-still clause reads "no more of what you asked has a step than before".
- No sentence of the ending appears twice.
- The not-doable ending has no " -- " before the judge's words.
- The Flow name in the closing sentence ends at a whole word.
- A run that failed at its result check shows "Run failed — it saved N rows, but the check found ...", with a lower-case "it" and "saved".
- A failed build or run message stored in the thread holds no `flow_bootstrap.*`, no stage name, no "Flow Bootstrap generation failed" and no run id. A blank_target_required refusal reads "the build failed: FluxIQ could not tell which part of this Flow to build on, as it builds on a Flow with one main part".

## Not verified

- No live run, Lab, browser or provider call, as the brief required. Everything above is checked by unit and integration tests only.
- The panel's "Run failed — <text>" join (apps/web) was not run. U-10's lower-case start assumes the chat puts the dash and title before `detail.text`, as the U-10 picture shows.
- Whether "step 6" in the judge's advice matches the panel's own step numbering. The screen keeps "step N" as written and removes only ids.

## Open questions or contradictions found

- **`R/activity/tests/scope.test.ts` lines 152 and 160** belong to the other worker and still expect "It returned 13 rows ..." and "Run failed: It returned 2 rows ...". They need:
  - line 152: "it saved 13 rows, but the check found they don't answer what you asked, and the fix used all its rounds before it could test a change."
  - line 160: "Run failed: it saved 2 rows, but the check found they don't answer what you asked."
- **Old threads already stored** still show their raw text (U1). Only new messages are plain. Rewriting stored text when it is read would go against `rows.ts`, which says the thread is the record of what was said, so I did not do it. Rewriting it on read would be a supervisor decision.
- **The person's own quotes** in the still-to-do list (`not-done.ts` `boundedAtWord`) are still shortened at a word boundary with "...". That is a cut inside a quote of the person's words, not of the judge's, and I left it alone.
- **Not touched, outside my files:**
  - the overlay "Couldn't fix your Flow" (U4, apps/web headline)
  - U-10's missing blocker ("what stopped the fix")
- **Line limits:** `unfinished-build/tests/` now holds 25 source files, the limit, so the next test added there must go in a subfolder or merge into an existing file. `unfinished-build/` holds 23.
