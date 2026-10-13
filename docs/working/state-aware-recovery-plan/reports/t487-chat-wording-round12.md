# t487 chat-wording-round12: worker report

## Outcome

Done for faults 1 to 5, the downstream wording test, and the coordinator's addition about unchanged resubmissions. Fault 6 is not mine: t482 owns it, and I did not touch it.

Trees:
- Core: `C:/Users/osrs_/FluxStuff/fxwork/t487/!FluxIQ`, branch `task/t487-chat-wording-round12`.
- Downstream: `C:/Users/osrs_/FluxStuff/fxwork/t487/!FluxIQWebExtension`.

Nothing was committed.

## What changed and why

### Fault 1: "it ran, but the site set the box back" (Core)

- `ui/activity-action/failure-reason.ts`: the typing-step words for `output_not_observed`, `not_observed` and `state_mismatch` are now "it ran, but the text there didn't change the way it should have".
- Why these words: the card only has the result code and the kind. The kind `type` also covers clear, search and key presses. The new words are true for a clear the site undid and for text typed into a span that takes none. They name no box and no reset.
- Tests updated:
  - `ui/activity-action/tests/failure-reason.test.ts`, which now also asserts that the words never contain "box" or "set ... back".
  - `ui/activity-action/tests/action-of.test.ts`.
  - `runtime/activity/step/tests/recovering.test.ts`.
  - Downstream `apps/extension/src/shared/activity/tests/wording.test.ts`, plus its comment in `wording.ts:287`.

### Fault 2: "Testing of the Flow" (Core)

- `runtime/activity/wording/person-words.ts`: a new `REVISION_OF` pass runs before `REVISION`.
  - It turns "revision N of the/this/that/your/my/our/its" into that determiner, so "Testing revision 3 of the Flow, which ..." reads "Testing the Flow, which ...".
  - At the start of a sentence it keeps the capital: "Revision 2 of the candidate adds a wait." reads "The Flow adds a wait."
- Tests: two cases added in `wording/tests/candidate-words.test.ts`.

### Fault 3: a skipped step reading "Done" (Core and extension)

- Core, new file `ui/activity-action/skipped.ts`, exported from the barrel as `activityActionSkipped`. It maps the closed `skipped.reason` on a step row to words:
  - `optional_absent`: "Skipped: not there, optional", the same phrase `tested.ts` uses for a test's excused optional step.
  - `state_routed`: "Skipped: the page was already at another step".
  - `already_done`: "Skipped: already done in this run".
- Core wiring:
  - `ActivityActionEvent.detail.skipped` added in `types.ts`.
  - `activityActionOf` puts these words in `tested`, in place of "Done".
  - Tests: `ui/activity-action/tests/skipped.test.ts`.
- Extension, `panel/chat/stream/step/messages.ts`: when the row that settles a started run step is Core's `optional_absent` or `state_routed` skip for the same node:
  - The step's card is settled with those words.
  - The skip row adds no second card for that step.
  - An `already_done` skip keeps its existing "Already done" card, since it comes in place of a step rather than after one.
  - Tests: new `panel/chat/stream/step/tests/skipped-step.test.ts`.

### Fault 4: labels cut mid-word or mid-sentence (extension)

- Two causes:
  - `cutMiddle` cut every target to a 36-character head. The row name shared that room, so equal labels were cut differently on each row ("wait … be accepted · Jonas Weber").
  - The view's CSS ellipsis then cut inside a word at the end ("pa…").
- Fix in `panel/chat/stream/step/card-words.ts`:
  - A target of several words that is longer than the head is now shown whole, with `whole: true`. The existing `chat.css` rule `[data-whole="true"]` wraps it at its spaces. No CSS change was needed.
  - It is cut, from the middle and at word boundaries, only past `WRAP_ROOM` (120 characters).
  - A typing step's target keeps every word it typed. It still leaves out a field too long to fit beside them, as before: the card's label keeps the field, and the existing tests for that rule still hold.
  - A single word with no spaces, such as a path, keeps the old cut where one of its parts ends, because it cannot wrap at spaces.
- Tests updated in `panel/chat/stream/step/tests/card-words.test.ts`:
  - The D8 case now expects both napkin targets whole and wrapped.
  - New cases: equal wait labels read the same on every row, and a target over 120 characters is cut at word boundaries keeping both ends.

### Fault 5: the step counter running backwards (Core)

There were two causes. Both are fixed.

1. **The loop head was announced again.** `executor/graph-run.ts` said "Running step N of M" on every arrival at a node, including each time the run came back to a loop's head (For Each, Repeat, Loop) after a pass, and the time it came back to leave the loop.
   - New `runtime/activity/step/announced.ts`, `automationStudioActivityStepAnnounced`, exported through the step and activity barrels. It says a loop head only the first time the run reaches it.
   - `graph-run.ts:389` checks it before emitting.
   - I put the file in `activity/step` rather than `executor/` because `executor/` would have gone to 26 files, past the 25-file audit limit.
2. **The step after a loop was numbered before the loop's body.** `runtime/activity/step/numbers.ts` numbers steps by reverse post-order and walked the routes in edge order. So with `each.body` listed before `each.done`, the step after the loop got a lower number than the body steps. This was found by the new test: "final" came out as step 3 and the body as steps 4 and 5.
   - Fix: routes that leave a loop (`done`, and a Repeat's last step's `ended`) are walked first, so they are numbered last.
   - I edited this file although the coordinator's message named only `graph-run.ts`, because the counter cannot be monotonic without it. It is not under `step-loop/**`.
- Tests:
  - `executor/tests/step-counter.test.ts`, new "around a loop" case: the head is said once, and nothing lower is said after the last pass.
  - `activity/step/tests/numbers.test.ts`: exits are numbered after the body, whatever the edge order, for For Each and for Repeat.
  - `activity/step/tests/announced.test.ts`.
  - `executor/tests/step-count-activity.test.ts`: the paging-loop expectations no longer contain the bare "Running step 2 of 5" before each pass. That line was exactly the backwards jump.
- What remains: within a loop, each new pass still starts again at the body's first number (for example 7, 8, then 7, 8). The pass words ("on page 3", the row's name) say which pass it is.

### Coordinator's addition: an unchanged resubmission narrated as a refusal (Core)

- `runtime/activity/candidate/submission-words.ts` gets new `UNCHANGED` words for `candidate.unchanged_submission` and `candidate.unchanged_after_no`:
  - "it was the same Flow as the one already saved, sent again unchanged, so nothing new was saved"
  - "it was the same Flow the check had already found doesn't do what was asked, sent again unchanged, so it wasn't saved again"

  They are said alone, with no step count. The result also carries `unchanged: true`.
- `runtime/activity/decision-answer/narration.ts`: a new `ended` outcome, `"unchanged"`, which says "The AI model sent the same steps again, unchanged, so the Flow stays as it was." It replaces `REFUSED`'s "it was refused, so it is not what the Flow does".
- Plumbing: two small edits outside the two named files, needed to carry the flag through.
  - `runtime/activity/candidate/result.ts` passes `unchanged`.
  - `runtime/activity/observer.ts:337` maps it to `"unchanged"`.
- Tests:
  - `activity/candidate/tests/submission-steps.test.ts`.
  - `activity/tests/narration.test.ts`: a new case checks that the thought and the card never say "weren't written in a way the Flow can run" or "it was refused".

## Commands run and observed results

- Core, in `packages/fluxiq`, one run of `npx vitest run` over the test folders and files beside every change (`src/ui`, `runtime/activity`, `executor/tests`, `executor/state-routing`, `executor/step-skip`, `executor/graph-navigation`, `flow-bootstrap/candidate`, `activity-publisher`, `api/handlers/tests/activity`, `candidate-trial-facade`): **120 files passed, 1216 tests passed.**
- Core typecheck, `npx tsc --noEmit -p .` in `packages/fluxiq`: exit 0, no output.
- Core `node scripts/structure-audit.mjs`: "structure-audit: passed (337 warning(s), 1159 baselined)". An earlier run failed with `[directory-files] executor/: 26 source files`; moving the new file to `activity/step` fixed that.
- Core build, `npm run build` in `packages/fluxiq`: completed. The extension reads Core's `dist`. `node ../../scripts/check/core-build.mjs` then printed "FluxIQ Core's build ... is current with its source."
- Extension tests, `EXTENSION_TEST_BUILD_LABEL=t487 node scripts/test-extension.mjs panel/chat shared/activity`: **tests 383, pass 383, fail 0**.
- Extension typecheck, with the package's pinned compiler: `tsc -p tsconfig.json --noEmit` exit 0, and `tsc -p tsconfig.test.json --noEmit` exit 0. The test project first reported a possibly-null value in my new test; I fixed it and reran.
- Extension `node scripts/structure-audit.mjs`: "structure-audit: passed (188 warning(s), 646 baselined)".

## Not verified

- No live browser check, Lab run or provider run, as the brief excluded them. The wrapped card targets have not been seen in the real side panel. The CSS rule `[data-whole="true"]` already existed and applies to them.
- No full suites were run. I did not run Playwright (`test:e2e`, `test:content`), which may contain card text expectations.
- Any other package that pins the number of "Running step" rows in a looped Flow could be affected. I searched Core tests for "Running step", `step.index` and `numberOf(` and ran every file found. I did not search the extension's Lab or test-runner packages.

## Open questions or contradictions found

- Fault 5 needed `activity/step/numbers.ts` as well as `graph-run.ts`. With only the `graph-run.ts` change, leaving a loop still dropped the number, because the step after the loop was numbered before the body.
- The unchanged-resubmission fix needed one-line plumbing in `candidate/result.ts` and `observer.ts`. Only these carry the submission's evidence to the narration.
- Within a loop, the counter still restarts at the body's first step on each pass. Showing progress instead of a step's place in the Flow would be a product decision.
