# t378 w4: runtime wording (worker report)

## Brief

### Brief: t378-w4-runtime-wording (worker-high)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Rule: words a person sees are plain English (chat-first): what happened, why, what next; never internal codes, node ids, handles or command names.
- Task:
  1. Refusal card (lane B): `R/activity/wording/completion-refusal.ts:9` words the reason by issue code (a step that sends something without saying what sending does is not "some steps point at things that weren't seen on the page"); `R/activity/candidate/submission-words.ts:35-39` counts distinct steps, not issue codes ("4 things to fix" was 2 steps). Issues are gaining `line` and `step` (another worker, now); count distinct `line`, falling back to distinct node paths.
  2. A submission refused as an identical repeat is described as the same Flow sent again unchanged (Core-side words; the card's act label is another worker's `src/ui/activity-action/action-of.ts`).
  3. Ending (lanes B, C, D): `R/conversations/commands/progress.ts:113` ("it kept trying without getting any further") and what feeds it: the build-failed ending names its cause in the person's terms (for example: the Flow it wrote was refused because two search steps did not say what sending them does, and it was sent again unchanged; or: the step that keeps only some rows could not be written), says nothing was tested when nothing was, and never quotes the command name "Create an automation here". Plumb the last refusal's reason to it (`R/service/candidate-failure/**`, `R/service/flow-bootstrap-commands/candidate-generation.ts:91`).
  4. An unusable model reply is not headed "Decided the next step" where Core produces that heading, and "The AI model's reply couldn't be read or used. Asking it again" reads less technical (`R/activity/observer.ts`; the extension's own heading map is another worker's).
  5. Model narration is not shown as fact: narration on a call refused as an identical repeat, or contradicted by its result (lane C: "Resubmitting the corrected Flow" three times for an unchanged script; lane D: "confirms only requests with 5+ mutual friends" for a Flow that confirmed all eight), is replaced or qualified by what actually happened. Find where `R/activity/` attaches the decision's reason.
  6. Lane D: `R/activity/wording/recovery-choice.ts:5` ("often works on a second try"): for a refusal whose failure carries a site wait (`retryAfterMs`, a slow-down notice), say the site asked to slow down and FluxIQ is waiting N seconds before pressing again.
  7. Lane D: the step event of a node running inside a `repeat over` pass carries `row` (a string: the pass's row as a person reads it, e.g. the row's first text field) so a card can say "Confirm · Jonas Weber"; another worker renders `row`. Produce it in `R/activity/**`; if the row is not reachable from there, say exactly where it lives.
- Required reads: the files named; lane C UI defects (read-only) `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/lane-c-candidate-ui.md`; lane D UI findings `C:/Users/osrs_/FluxStuff/fxwork/t275/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/lane-d-candidate-w3-ui.md`.
- Owns: `R/activity/**`, `R/conversations/commands/progress.ts`, `R/llm/unusable-decision.ts`, `R/service/candidate-failure/**`, `R/service/flow-bootstrap-commands/candidate-generation.ts`, new files beside them, their barrels and `tests/`.
- Must not touch: `T/!FluxIQ/packages/fluxiq/src/ui/**`, the extension, `R/flow-bootstrap/**`, `R/llm/repeat-guard/**`, `R/llm/decision-handlers/**`, `R/executor/**`, `R/service/candidate-trial/**`, any other tree, lab slots or processes.
- Concurrency: other workers edit other Core files in T now. An error only in a file you do not own is theirs: record it, do not fix it. Core rules: one exported thing per file, a barrel per directory, tests in `tests/` beside the subject.
- Definition of done: tests beside each change pass (`npx vitest run <paths>` from `T/!FluxIQ`); `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` clean for your files. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w4-runtime-wording.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Partial. Items 1, 2, 4 and 5 are done. Items 3, 6 and 7 work inside the files I own,
but each needs a small follow-up in files I do not own before it reaches the person
completely (see "Not verified" and "Open questions").

## What changed and why

Paths are relative to R unless shown otherwise.

**1. A refusal is worded by its issue codes, and counted by step.**
- New `activity/wording/issue-words.ts`. It holds plain words per issue code, in one-step
  and several-step forms. The codes covered are: consequences not declared
  (`web.step.consequences_undeclared` and similar); script repeats (`flow_script.repeat_*`);
  handles not seen on the page; a required input left unconnected; a setting the step
  can't use; a setting the step doesn't take; a missing setting.
- Places are counted per step. The order of preference is the issue's `line`, then the
  node its path names (`plan.subflows.0.nodes.13`), then the script line in
  `flow.line.N`, then the path itself. An issue with no path counts as a place of its own.
- `counted` mode says the number instead of "some" ("two steps that ..."). The ending
  uses this mode.
- New `activity/wording/issues-of.ts` reads issues from feedback by shape.
- New `activity/wording/refusal-tally.ts` turns issues into reasons plus a count, and
  says whether that count is of steps or of things.
- Changed `activity/wording/completion-refusal.ts` and
  `activity/candidate/submission-words.ts`. Both now use the issues' own words, falling
  back to the refusal family's words when the issues have none. They count distinct
  steps, so the card reads "...; 2 steps to fix" where it used to read "4 things to fix".

**2. An identical resend is said as such.**
- `activity/decision-answer/refused-call.ts`: a `core.submit_candidate` call refused as a
  repeat now gets the status line "Not done: <action> — the same Flow was sent again
  unchanged, so it was not checked again".
- Its record ends `· Declined: <same words>`, which the shared card reads as its closing
  part.
- `core.test_candidate` gets an equivalent sentence.

**3. The build-failed ending names the cause.**
- New `service/candidate-failure/refusal-codes.ts`. It encodes the last refused
  submission as diagnostic issue codes, because a diagnostic carries codes only:
  - `candidate.last_submission_refused:<refusals in a row>`
  - `candidate.last_submission_sent_again:<n>`
  - `candidate.last_submission_family:<refusal code>`
  - `candidate.last_submission_issue:<code>:<line.N | path>`, at most 10 of these.

  The same file also decodes them.
- New `service/candidate-failure/submission-refusals.ts`. It wraps the loop's
  `executeTool` to record each submit result: refusals in a row, the last issues and the
  last family. It resets when a submission is accepted. On a stall it reads the trace for
  identical resends (`repeat_refused` or `already_answered` on `core.submit_candidate`).
- `service/flow-bootstrap-commands/candidate-generation.ts`:
  - `observe` is now `submissions.observe(observeAutomationStudioEvidenceLoop(loop))`.
  - `stalled` puts the encoded codes first in `issueCodes`, only when the stall code is
    `flow_bootstrap.evidence_repeat_without_progress`.
  - The stall code itself is still computed from the original codes.
- `conversations/commands/progress.ts`:
  - For a no-progress code, `automationStudioConversationCallCause` decodes the codes and
    writes the cause. Example: "the Flow it wrote was refused [N times in a row, the last
    time] because <issue words, counted>[, and then it was sent again unchanged N
    times][, so nothing was tested]". "Nothing was tested" is said only when
    `diagnostic.candidate` has no accepted revision and `trialCount` is 0.
  - With no refusal carried, the old words remain.
  - The opening no longer quotes the command title. A call cause ("the build failed: ...")
    becomes its own capitalised sentence; any other cause reads "I stopped because ...".
    The `title` parameter is kept as `_title` for callers.
  - Lane C now reads: "The build failed: the Flow it wrote was refused because a repeat
    was written where the Flow can't run it, and then it was sent again unchanged 3
    times, so nothing was tested. The Flow "Hubs" has no steps yet, ...". This is
    asserted in a test.

**4. Unusable or unanswered replies.**
- `activity/observer.ts` `decisionFailed`: the failed row's title is now "Asking the AI
  model again" (it was "Deciding the next step", which the extension shows as "Decided
  the next step").
- Text for an unusable reply: "The AI model's answer didn't make sense, so FluxIQ is
  asking it again. If that keeps happening, the build stops."
- Text when the provider gives no answer: "The AI model provider didn't answer, so FluxIQ
  is asking it again. If it keeps not answering, the build stops."
- The label is now "The AI model's answer couldn't be used".
- The started row is unchanged.

**5. Narration is held to what happened.**
- New `activity/decision-answer/narration.ts`, wired into the observer. It replaces the
  direct `emitAutomationStudioActivityThought` after `decide`. Every other decision's
  reason is still said at once.
- The reason of a call identical to an earlier decided call (same tool and same
  serialised input) is held. So is any `core.submit_candidate` or `core.test_candidate`
  call.
- How a held reason is settled:
  - A call that runs is said as the model said it (non-candidate calls when they start;
    candidate calls when they end).
  - A refused submission is said as "The AI model sent a version of the Flow's steps, but
    it was refused, so it is not what the Flow does."
  - A failed test is said as "The AI model expected this version to do what was asked,
    but the test showed it doesn't yet."
  - An identical call that never ran is said as "This is the same Flow it had already
    sent, unchanged, so it was not checked again." (or the step or test equivalent).
- Placement: the thought comes before the repeat card. For candidate calls it now comes
  just before the call's end row, not before its start row.
- A decision with no stated reason says nothing, as before.

**6. A site wait is worded as a slow-down.**
- `activity/wording/recovery-choice.ts` has new `run` options: `siteWaitMs`, `slowedDown`
  and `presses`.
- On a retry it now says "Waiting: the site asked to slow down" / "The site asked FluxIQ
  to slow down, so it is waiting 6 seconds before pressing again." With no named wait it
  says "a moment". With `presses` false it says "trying the step again".

**7. The row a pass is on.**
- New `activity/loop/row.ts`: the row of a list loop. It finds the last For Each
  (`builtin.control.for-each`) attempt on its `body` route among the loops the node
  belongs to, and names the row by its first text field that is not an address (up to
  40 characters, curly quotes removed).
- `loop/loops.ts` takes an optional `head` definition id.
- `loop/words.ts` `passOf` returns the do-while pass with `row` added, or a pass of the
  new unit `row` when only a list loop applies.
- `loop/pass-words.ts` adds no words for the `row` unit.
- `loop/types.ts` adds `"row"` to `unit` and an optional `row`.
- `step/started.ts` puts `row` on `step`. `bounded.ts` clips it to the title bound.
- Result: the executor's existing `loopWords.passOf(currentNode.id, attempts)` call
  (`executor/graph-run.ts:426`) now carries the row with no executor edit.

Barrels updated: `activity/index.ts`, `activity/wording/index.ts`,
`activity/decision-answer/index.ts`, `activity/loop/index.ts` and
`service/candidate-failure/index.ts`.

Tests:
- New: `activity/tests/narration.test.ts`, `activity/wording/tests/issue-words.test.ts`,
  `activity/wording/tests/recovery-slow-down.test.ts`,
  `activity/candidate/tests/submission-steps.test.ts`, `activity/loop/tests/row.test.ts`,
  `service/candidate-failure/tests/submission-refusals.test.ts`.
- Updated for the new wording: `activity/tests/observer.test.ts`,
  `conversations/commands/tests/{candidate-endings,execute,extension-chat,plain-failure}.test.ts`,
  and `service/flow-bootstrap-commands/tests/candidate-failure-kept.test.ts`. The last
  one drives the real service end to end and now gets "the build failed: the Flow it
  wrote was refused 3 times in a row, the last time because some steps weren't written
  in a way the Flow can run".

## Commands run and observed results

All commands were run from `T/!FluxIQ`.

- **Baseline, before any edit.** Command: `npx vitest run R/activity R/conversations/commands/tests`
  plus the candidate service tests. Result: 356 passed, 1 failed. The failure was
  `execute.test.ts`, "answers the thread's waiting question ...", which timed out at
  5000 ms under load.
- **After the changes.** Command: `npx vitest run R/activity R/conversations/commands/tests R/service/candidate-failure R/service/flow-bootstrap-commands/tests R/executor/tests/step-count-activity.test.ts`.
  Result: "Test Files 58 passed (58) / Tests 476 passed (476)".
- **One intermediate run.** It showed 4 `execute.test.ts` failures, all 5 s timeouts.
  Rerunning `execute.test.ts` alone gave "36 passed (36)". The final run above includes
  it.
- **Typecheck.** Command: `npx tsc --noEmit -p packages/fluxiq/tsconfig.json`. Result:
  no errors. An earlier run showed 2 errors in files I don't own
  (`executor/tests/run-pacing.test.ts:94` and
  `flow-bootstrap/candidate/tests/refusal-domain-fixture.ts:40`). They were gone on the
  final run.
- **Structure audit.** Command: `node scripts/structure-audit.mjs`. None of my files
  appear in a FAIL line. Two kinds of result remain:
  - Two FAILs in files I don't own:
    - `as-never` in `llm/decision-handlers/tests/candidate-repeat-told.test.ts:29`.
    - `failure-as-empty` in `llm/repeat-guard/outcomes.ts:356`.
  - Advisory warnings on my directories: `activity/` has 19 files and `activity/wording/`
    has 18; the threshold is 15.

## Not verified

- No live run, Lab run or extension rendering was done; the brief forbids them.
- Item 3: the cause words are tested for real lane C and D refusal shapes, but there is
  no recorded lane B run in the tests. The lane B issue codes
  (`web.step.consequences_undeclared` on two nodes) are assumed from the domain's codes.
- Item 3: lane D's "the step that keeps only some rows" is not produced. The issues name
  the node only by its plan index (`plan.subflows.0.nodes.8.parameters.items`), so the
  ending says "a step was given a setting it doesn't take". It could name the step if the
  other worker's issue `step` field carries the node id or the step's kind; I did not
  read `step`, because its shape was not in the tree when I worked.
- Item 6: nothing passes the new options yet. `executor/graph-run.ts:622` (not mine) must
  pass `siteWaitMs`, either `fault?.hintedWaitMs` or the bounded `wait.waitMs`, which is
  computed after the choice today. It must also pass `slowedDown` (a rate-limit or
  slow-down failure code) and `presses`.
- Item 7: `row` is on the event, but `ClientGatewayActivity.step` in
  `T/!FluxIQ/packages/contracts/src/client-gateway.ts:191` (not mine) does not declare
  `row?: string`. It travels as an extra field: `step/started.ts` builds it through a
  wider local type, and `bounded.ts` reads it by cast. Only `emitAutomationStudioActivityStep`
  carries it. The recovering and settled rows (`step/recovering.ts`) do not, because the
  executor does not pass the pass to them.

## Open questions or contradictions found

- **Item 4.** The extension's `isModelThought` (`shared/activity/model-thought.ts`)
  treats only the title "Deciding the next step" as status. The renamed row ("Asking the
  AI model again", kind thought, with text) will now be drawn as a message and not used
  as the live line. Its fixture `panel/chat/stream/step/tests/words.test.ts:18` still
  uses the old title. The extension worker should map the new title.
- **Item 5.** For candidate calls the thought now follows the card's start row, so in a
  long test it appears after the trial's step cards. If the panel needs it above the
  card, the extension should place thoughts by `ref`, or Core needs a "replace earlier
  row" mechanism that the contract does not have.
- **Item 3.** New `candidate.last_submission_*` codes appear in the stalled candidate
  diagnostic's `issueCodes`. Readers that pattern-match issue codes (for example
  `flow-bootstrap/unfinished-build/not-done.ts`, the Lab) will see them. They are
  code-shaped and come first, so the loop's own codes stay within the cap of 16.
- **Item 1.** Without the other worker's `line`, lane C's two repeat issues
  (`flow.line.22` and `flow.line.27`, both about the step at line 23) count as two steps.
  With `line: 23` on both, they count as one; this is tested.
