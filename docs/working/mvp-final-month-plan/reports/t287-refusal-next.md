# t287-refusal-next: the way out of every amendment refusal (C4, W2)

Worker report, Core tree `C:/Users/osrs_/FluxStuff/fxwork/t287/!FluxIQ` on branch `task/t287-fix-refusal-churn`.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing was committed.

## Outcome

Done.

- **C4** (`run-mustvzvg-99695308`). A `changes_nothing` about a step that did not work now says this:
  - the exact call was refused before and would be refused again;
  - the step's own code-shaped codes, and the call id whose result names what was refused;
  - change exactly that in a rerun, with the rerun shape; the input merges over the stored argument, so a key the refusal named stays until changed, and `null` removes it;
  - or gather new evidence first.

  It no longer says that rows stand or "go on to the act". The read-that-ran wording is kept for steps that worked.
- **W2.** Every amendment refusal reason now gets a `next` in the draft's own numbers, with or without a checklist. The `next` names the step and the amendment or call to send instead. When there is a checklist, every `next` ends with the acts still not done. The one exception is an act that was named again and is still to do: its `next` says to correct the step its todo names, and does not point back to the checklist.
- **Other refusals in the owned files.** I audited all of them. Each already names a way out, so I changed none. What other files still owe is listed below.

## What changed and why

### `R/llm/draft-amendment-feedback.ts` (685 lines)

- **Header.** Two paragraphs added at the end: C4, and W2 ("Every refusal names its way out"). No reordering.
- **`REFUSAL_REASONS.changes_nothing`.** One sentence appended: a `did_not_work` step was refused and never ran, so it has no result to go on with, and the same call would be refused again. The existing sentences stay. `repeat-guard.test.ts` pins "identical request was not sent again".
- **`AutomationStudioDraftAmendmentFeedbackStep`.** Extended with `proposes`, `written`, `checkedCandidate`, `resultCode`, `resultReason` and `callId`. All are optional, so `context.draftSteps` still type-checks structurally. `resultReason` is read when present, but today's draft step does not carry it (see "Owed elsewhere").
- **`nextStep`, `changes_nothing` branch.** It first checks `didNotWork(step)` and returns `refusedAgain(step)`.
  - `didNotWork` uses the same rule as `flow-draft/entry.ts` `shownDisposition` and `flow-draft/amendment/apply.ts`: not written, not checked, `effectApplied === false`, and either `effect === "mutate"` or `proposes === true`.
  - `refusedAgain` quotes `resultCode`, `resultReason` and `callId` only when they are code-shaped (`/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/u`, no spaces), so no page value can pass.
- **New chain.** `wayOut()` replaces the old chain and `stillToDo`. It tries, in order: `reach`, `takenOff`, `replacedAttempt`, `nextStep`, `actDone`, `notRunYet`, `pressBound` and `fallback`, then appends `checklistLeft` once. `replacedAttempt`, `actDone` and `notRunYet` no longer append the checklist themselves. `next` is now always present on a refusal entry.
- **`fallback()`.** A `Record` over every refusal reason. It is exhaustive by type, so a new reason fails to compile until it has a way out.
- **Helpers.** `notKept()` tells apart:
  - a look;
  - a step that did not work;
  - a step out of the Flow (add it);
  - a step in the Flow whose routed step is not (name or add that one);
  - a step whose state is unknown.

  `actOnRead()` names the press after the read, with `keep` or `add` and the act, or says no step does the act yet.
- **`actDone()`.** Now leads with the step: "Step N already names X, and the acts checklist shows X done ...". Before, it did not name the step.

### Tests

- **`R/llm/tests/draft-amendment-feedback.test.ts`** (owned). Pins that encoded "no next" now require a numbered way out:
  - every-reason;
  - `act_already_named` still to do, and with no checklist;
  - the non-listing `changes_nothing` and `over_not_before` cases;
  - `no_such_step` past the free number, and for a gap in the numbering;
  - empty `bindable`, and `bind_row_outside_loop`;
  - the two loop tests about an act already done.

  The loop test of a failed read's unchanged rerun now requires "Step 2 did not work", and forbids "go on to the act" and "intended rows".

  The byte bound was "under 2 KB" for 16 refusals with no `next`. It is now `1024 + 16 × 256` bytes, because every refusal carries its way out; the observed size was 4,386 bytes.

  The file is 778 lines. The new blocks were moved out because the structure audit failed it at 942 lines (limit 800).
- **`R/llm/decision-handlers/tests/refusal-way-out.test.ts`** (new; the one allowed new file). It holds the C4 block (6 tests), the W2 block (4 tests), and the "next free number" block moved from the feedback test file (3 tests). It imports through the `../../index.ts` barrel.
- **`R/llm/evidence-loop/tests/stalled-amendments-replay.test.ts`** (an owned existing test in `evidence-loop/tests/`). It pinned `did_not_work` and `already_in_flow` refusals with no `next`, which W2 removes. They now require `{"step": 2, "change": "rerun", "input": {` and "Step N is in the Flow already". No other line changed.

## Audit table

"Before" is what the model got as `next` (or as an answer) before this change. "After" is the new `next`, or the change owed by the file's owner. N is the step number the model wrote.

### Amendment refusals (`REFUSAL_REASONS`, `R/llm/draft-amendment-feedback.ts`)

| Code | Way out before | Way out after |
| --- | --- | --- |
| `no_such_step` | Only for the next free number ("run it first"). Otherwise none, or only the checklist. | Next free number: unchanged. Missing number: "There is no step N in the draft: name a step listed under positions ... or run the step you meant as a new call with add true." N exists (routing named a missing check, to or over): "Step N is in the draft, but the step its check, to or over named is not: name only a step listed under positions ...". |
| `already_so` | None; only the checklist when there was one | "Step N already says that, so it stays as it is: do not send the same change again. Send step N a different change only if ...; otherwise go on with what the Flow still lacks." |
| `no_such_position` | None, or only the checklist | `{"step": N, "change": "reorder", "to": <a step from 1 to LAST>}`, or leave step N where it is |
| `run_by_the_loop` | None, or only the checklist | Send it alone in the next decision with an input, `{"step": N, "change": "rerun", "input": {<only the keys that change>}}`, one rerun per decision; or run an offered tool as a new call with add true |
| `no_step_before_it` | None, or only the checklist | `{"step": N, "change": "only_if", "check": <that step>}` or `{"step": N, "change": "repeat", "over": <the listing>}`, or leave it |
| `over_not_before` | Only when the draft had effects and a listing could be found | Unchanged when found. Otherwise: the act/listing repeat shape plus the reorder to send beside it, naming "Step N's repeat over step O". |
| `not_a_kept_step` | Only for the attempt a rerun replaced | Look: "Step N only looked ... run the step that does what you meant as a new call with add true". Did not work: rerun it. Out of the Flow: `{"step": N, "change": "add"}`, then send the change again. In the Flow: the routed step is not; name an inResult step or add it. Unknown: the general form. |
| `did_not_work` | None, or only the checklist | "Step N did not work, so it is already out of the Flow: leave it ... read what its result under call ID names as refused and rerun it with exactly that changed: `{"step": N, "change": "rerun", ...}` -- or run the action again as a new call with add true." |
| `already_in_flow` | Checklist only (with a "leave it" lead) | "Step N is in the Flow already: leave it, and do not keep it again. Run what the Flow still lacks as a new call with add true, or complete." |
| `already_out` | Checklist only (with a "leave it out" lead) | Leave it out, or `{"step": N, "change": "add"}` if the Flow needs it |
| `changes_nothing` | Read: "Inspect ... go on to the act ... If those rows are right: repeat ...", **even for a read that never ran (C4)**. Press: none. | Did not work: `refusedAgain` (C4 wording above). Read that ran: unchanged. Press, or no effects known: "Step N's identical call was not sent again ... Rerun it only with what should differ -- `{rerun shape}` -- or leave step N as it is ...". |
| `act_on_a_read` | None, or only the checklist | Names the press after it: `{"step": P, "change": "keep"/"add", "act": <the act>}`; or "No step after step N does an act yet: run the press ... with add true and its act" |
| `act_already_named` | Only when the act was done and a checklist existed; otherwise none | Act still to do: "Step N already names X, and the checklist still shows it not done ... correct exactly that step -- rerun it ... -- or run the act's own control as a new call with add true and act X". No checklist: leave step N as it is and go on. Act done: unchanged, now naming step N. |
| `bind_not_a_binding` | None, or only the checklist | Bind with `KEY set to {"$input": <name>, "test": <its value>}` (or `$row` inside a repeat), or rerun with a concrete value |
| `bind_new_key` | Only when it was the press control | Control: unchanged. `bindable` given: "bind one of A, B on step N instead, or leave it as it is". Otherwise: "Step N has no value to bind at KEY: leave step N as it is ...". |
| `bind_row_outside_loop` | None, or only the checklist | `{"step": N, "change": "repeat", "over": <the listing>}` first and the bind after it, or bind as `$input` |
| `bind_malformed` | None, or only the checklist | Rewrite in a form from `reasons.bind_malformed` and send it again, or rerun with a concrete value |
| `rerun_holds_binding` | None, or only the checklist | Rerun with a concrete value for every bound key, or write the step as a new call to `core.run_node` with write true |
| `strands_a_step` | Only when `strands` was carried | Unchanged. Otherwise: "Step N stays in the Flow ... leave step N in, or drop that later step too". |
| `repeat_taken_off` | Only when `over` and `takenOff` were carried | Unchanged. Otherwise: "Step N's repeat was taken off ... send `{"step": N, "change": "repeat", "over": <the listing>}` with the listing before it". |

### Other model-facing refusals and no-change answers in the owned files

| Code / answer | Owned file (where the words live) | Way out before | After / owed |
| --- | --- | --- | --- |
| Completion refused (check feedback) | `R/llm/decision-handlers/completion.ts` (feedback built by the caller's completion check) | `sentAgain`: "first do what the reasons ask -- run the step that is missing, or amend the steps they name -- then complete" | Unchanged: it names a way out. The per-issue feedback is the completion check's own (flow-bootstrap), and was not audited here. |
| Completion refused by the test | `R/llm/evidence-loop/completion-attempt.ts` | Codes only; the dry run's own `core.dry_run` entry carries the words | Unchanged here. Owed by `R/llm/node-tools/dry-run-gate.ts` / `R/flow-draft/` dry run: not audited beyond this. |
| `already_answered`, `already_observed`, `not_offered` (answered from memory) | `R/llm/decision-handlers/answered-request.ts` (words in `R/llm/evidence-loop/answered-request.ts`) | "use it, choose a different tool or input, or complete" / "use it, change something first, or complete" / "Complete from your draft, or amend it and complete" | Unchanged: they name a way out |
| `looked_again_unchanged` | `R/llm/decision-handlers/answer-check.ts` (words in `R/llm/evidence-loop/answered-request.ts`) | "use it, run an action, or complete" | Unchanged |
| `look_withdrawn` | `R/llm/decision-handlers/look-withdrawal.ts` (words in `R/llm/unusable-decision.ts`) | "run an action the instruction needs, amend the draft, or complete" | Unchanged |
| `searching_without_acting` | `R/llm/decision-handlers/searching.ts` | Press, type into or choose a control, go to another page, use the page's search or menus, amend or complete | Unchanged |
| Failed call (`tool_failed`, `tool_result_invalid.*`) | `R/llm/decision-handlers/failed-call.ts` (words in `R/llm/tool-failure.ts`) | "Choose a different tool or input, or complete from the evidence you have": general, and no step number | Owed by `R/llm/tool-failure.ts`: name the draft step the failed call became (`did_not_work`) and its rerun shape |
| `complete_not_offered`, `amend_not_offered`, `decision_shape_invalid` | `R/llm/evidence-loop/decision-refusal.ts` (words in `R/llm/unusable-decision.ts`) | Run a tool call first / "Choose one of the variants it does offer" / what to fix in the shape | Owed by `R/llm/unusable-decision.ts`: `amend_not_offered` should name the decision kinds that are offered |
| Exhaustion record | `R/llm/evidence-loop/exhaustion.ts` | Not model-facing: an ending record | n/a |

### Owed elsewhere (listed, not edited)

- **`R/llm/repeat-guard/feedback.ts`.**
  - `FAILED_AMENDMENT_INSTRUCTION` is the repeat guard's version of C4. It names the general moves, but not the step or the failing key. It should name the rerun's step number with the rerun shape, and say that a key its refusal named stays in a merged rerun until set or nulled.
  - `INSTRUCTION`, `DRAFT_INSTRUCTION` and `AMENDMENT_INSTRUCTION` name ways out in general words, not in the draft's numbers.
- **`R/llm/evidence-loop.ts` (draftRecord) and `R/flow-draft/step.ts`.** Record the execution's code-shaped `resultReason` on the draft step. The C4 `next` already reads `resultReason`; today it can quote only `resultCode`.

  The key the domain refused (`web.handle.malformed:extractList.maxPages` in C4) is only in the result's evidence. Carrying such code-shaped `instead` codes on the step would let `next` name the key directly; that is C3's "say which key".
- **`R/llm/evidence-loop/rerun-request.ts`** (another worker this round). This is where `changes_nothing` is decided; C3 (the merged stale key) is that file's to fix.
- **`R/llm/node-tools/**` and the domain extract_list wording (C1 and C2).**
  - "page bound reached ... raise it" should name `paginate.maxPages`.
  - `paginate: true` should say it reads one page.
  - `malformed_handle` `instead` codes should name the key path to move or null.
- **`R/flow-draft/**`** (dry-run refusals and the draft entry instruction): grep-level look only, not audited.
- **Domain codes:** not audited.

## Fail-first

All new and changed tests were written first and run against the unmodified source. Command (from `packages/fluxiq`):

`npx vitest run src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts`

The observed output was `Tests  17 failed | 46 passed (63)`. The failing tests:

```text
× the feedback an amendment refusal is shown as > can say every reason the draft computes, with what the word means
× the feedback an amendment refusal is shown as > tells an act named again that the checklist shows done that nothing is left for it, and what still is
× a refusal about a listing says what comes next > still names a way out by number where the refused step is not a listing, or the draft gives no effects
× a refusal about a listing says what comes next > does not claim usable rows after a failed read's unchanged rerun, and does not run it again
× a refusal naming the next free number says to run the step first > names the positions to choose from for a number past the next free one, or one inside the draft
× a refusal naming the next free number says to run the step first > ends with the acts the checklist still shows not done, and names only those for any other number
× a refused bind says what the step offers instead, run B7 > passes on an empty bindable, and says what that means
× a refused bind says what the step offers instead, run B7 > passes on nothing for a refusal of another reason
× run mustvzvg C4: ... > says the exact call was refused before and would be refused again, names its code, and says what to change
× run mustvzvg C4: ... > says the same of a press that did not work, naming no code where the step carries none
× run mustvzvg C4: ... > ends with the acts the checklist still shows not done
× run mustvzvg C4: ... > quotes only code-shaped words from the step, never a value that could be a page's
× run mustvzvg C4: ... > says it in the reason too
× W2: ... > gives every reason a next naming the step, without a checklist and with one
× W2: ... > names the amendment or call to send instead
× W2: ... > tells a step that is not in the Flow apart from a look, and from a routed step that is not
× W2: ... > names the press after a read an act was put on, or says to run one
```

The key C4 failure, before the fix:

`expected 'Step 8's identical request was not sent again. Inspect the previous result: only if it actually returned the intended rows should you go on to the act; ... If those rows are right: No step after step 8 does anything to a row yet ...' to contain 'Step 8 did not work'`

That is a refused, never-run read being told to go on to the act. The 13 C4, W2 and next-free-number tests were later moved to `decision-handlers/tests/refusal-way-out.test.ts`.

After the fix, six pins that I had expected to fail did fail:

- the exact old text of the act already done;
- the bind refusal `toEqual` without `next`;
- the 2 KB bound (observed 4,386 bytes);
- the two loop tests on act already named;
- one string of my own.

Each was updated as described above. `stalled-amendments-replay.test.ts` then failed in 2 tests on `toEqual` with no `next`, and was updated.

## Commands run and observed results

All vitest commands were run from `packages/fluxiq`.

| Command | Observed |
| --- | --- |
| `npx vitest run .../llm/tests/draft-amendment-feedback.test.ts .../llm/decision-handlers/tests/refusal-way-out.test.ts .../llm/evidence-loop/tests/stalled-amendments-replay.test.ts` (run 1) | `Test Files 3 passed (3)`, `Tests 72 passed (72)` |
| The same (run 2) | `Test Files 3 passed (3)`, `Tests 72 passed (72)` |
| `npx vitest run src/programs/automation-studio/runtime/llm/decision-handlers/tests` | `Test Files 8 passed (8)`, `Tests 39 passed (39)` |
| `npx vitest run .../llm/evidence-loop/tests .../llm/tests` | `Test Files 50 passed (50)`, `Tests 702 passed (702)` |
| Earlier: `npx vitest run .../decision-handlers/tests .../evidence-loop/tests .../step-log/tests` | 2 failed (`stalled-amendments-replay`, the pins above), 339 passed. After the update: 9/9 in that file. |
| Pin check: `npx vitest run` on `activity/tests/observer.test.ts`, `activity/wording/tests/reasons.test.ts`, `flow-bootstrap/unfinished-build/tests/not-done.test.ts`, `llm/decision-context/tests/recorded-windows.test.ts`, `tests/deepseek-bootstrap/tests/answerability.test.ts`, `src/ui/activity-action/tests` | `Test Files 15 passed (15)`, `Tests 304 passed (304)` |
| At Core root: `node scripts/build-cache/cli.mjs fluxiq:check` | `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; stored in the shared store ...","ms":31048}`: passed |
| `npx tsc --noEmit` in `packages/fluxiq` (uncached) | `tsc-exit=0`, no output |
| At Core root: `node scripts/build-cache/cli.mjs structure-audit:check` (first run) | `FAIL [file-lines] .../llm/tests/draft-amendment-feedback.test.ts: 942 lines exceeds the 800-line limit`, 1 violation. Fixed by moving the new blocks to `refusal-way-out.test.ts`. |
| `node scripts/build-cache/cli.mjs structure-audit:check` (after the split) | `{"build-cache":"build","step":"structure-audit:check","reason":"no stamp; stored in the shared store ..."}`: passed, no FAIL lines |

`R/llm/tests/` and `R/llm/evidence-loop/tests/` still hold 25 files each.

## Not verified

- **No live, Lab, build, browser or provider run.** I did not check whether the model changes course on the new words.
- **Whether failed reads are marked so the new wording fires.** Whether the web domain's refused list reads always report `proposes: true` with `effectApplied: false` (and so are taken as did-not-work) comes from the C4 debug, which shows step 8 as `did_not_work`. I did not observe it here.
- **Looks are not covered.** A refused look (`proposes: false`) cannot be told from a look that worked, so its `changes_nothing` keeps the read wording.
- **`resultReason`** is never populated on draft steps today (see "Owed elsewhere"), so the C4 `next` quotes `resultCode` and the call id only.
- **Audit depth.** The `R/llm/node-tools/**`, `R/flow-draft/**` and domain refusals were audited at grep level only.

## Open questions or contradictions found

- **The C4 wording had already changed.** The text the debug quotes ("its result stands as shown") was already gone at the start; the read-that-ran text was in its place, which still said "go on to the act" and "If those rows are right". It was the same defect in other words.
- **The new test file's location is a judgment call.** It sits in `decision-handlers/tests/` as the brief allowed, but its main subject is `R/llm/draft-amendment-feedback.ts`. AGENTS.md placement would put it in `R/llm/tests/`, which is capped at 25 files. The structure audit's `test-placement` rule accepts it.
- **I edited `evidence-loop/tests/stalled-amendments-replay.test.ts`** as an owned existing test, reading "their existing tests in `R/llm/evidence-loop/tests/`" to cover it. If the supervisor reads that phrase more narrowly, this edit is the one to review.
