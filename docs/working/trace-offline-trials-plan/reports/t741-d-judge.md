# Report: t741-d-judge (D, generic judge guidance)

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime/`.
No commits, merges, pushes or branch switches.

## Outcome

Done. Both parts are built, with tests that use made-up fixtures (a recipe archive and a library's loans).

1. The read account and the judge prose now say that when a list goes on past an end marker the page shows, or past the range the request asks for, the rows after it are not rows missing from that range. Both `loop_verification` pins moved by exactly that one sentence.
2. When a builder's judged-no trial repeats advice the builder was already given after an earlier trial, the builder no longer gets the same text again. It gets a note instead (`adviceRepeated`), saying the judge repeated itself and what the trial after the earlier advice answered.

## What changed and why

### Part 1: a list that goes on is not rows missing from the range

- **R `result-verification/read-account/list-continues.ts`.**
  - The read's `said` gets one more sentence, but only for a list that grows as it is revealed: evidence `declared_feed` or `still_growing`, or kind `infinite_scroll`. The sentence: "Where it goes on past an end the page itself marks, or past the range the request asks for, what follows is not rows missing from that range: judge what was read against the request's own range."
  - That is the case that misled the judges in social 0141/0214. A list whose next part the page names by a page number or a control keeps its wording unchanged.
  - The `fix` line for every list now ends: "Where the request asks only for what its first part shows, or what was read already reaches an end the page itself marks or the end of the range the request asks for, leave the read as it is."
  - Judges see `said` through `judge-paging.ts` and `sentence.ts`. The builder sees it as `reads[].listContinues` in `service/candidate-trial/feedback.ts`, and the repair directive also uses it. So all of them get the same words.
  - Why the sentence is limited to growing lists: `result-verification/tests/repair-directive.test.ts:319` (a file I do not own) pins the exact `said` text for a `next_page`/`next_control` read. Saying the sentence for every list would have moved that pin. The judge prose below covers every list either way.
- **R `llm/diagnosis-instructions.ts`.** `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION` gets one sentence. It goes right after the reads sentence that ends "that condition is wrong and is the one to change.":
  > A read whose paging words say its list goes on past what it read has not by that alone left rows out: where the list goes on past an end the page itself marks, or past the range the request asks for, what follows is not rows missing from that range, so judge coverage against the request's own range, and ask for more of the list only where that range goes on past what was read.

  A header comment paragraph records the cause.
- **R `llm/deepseek/tests/system-prompt-pins.json`.** `loop_verification` and `loop_verification_build_test` were re-pinned by inserting exactly that sentence and a space, done by a script. A node comparison against `HEAD` confirmed the other 10 pins are byte-identical and both verification pins differ only by the sentence.
- **R `llm/deepseek/tests/system-prompt.test.ts`.** The header history now has a t741 entry. A new test checks three things:
  - the sentence appears exactly once in both verification prompts;
  - it sits right after the reads sentence;
  - no other task's prompt contains it.
- **R `service/candidate-trial/tests/paging-feedback.test.ts`.** The exact `listContinues` pin for a `declared_feed` read was updated to the new `said`. This is a test of `feedback.ts`, which I own.

### Part 2: repeated advice is not handed to the builder again

- Where the advice reaches the builder: `service/candidate-trial/feedback.ts` builds one trial's feedback with no memory of earlier trials. Remembering earlier trials therefore belongs in the builder loop, and flow-bootstrap never imports from service. `feedback.ts` is unchanged.
- **New R `flow-bootstrap/subflow-candidate/repeated-advice.ts`** exports class `AutomationStudioSubflowRepeatedAdvice`. Its method `told(answered)` takes the `core.test_subflow` answer and:
  - records every trial in order: its revision, its verdict, and the gate's own `stoppedBy.said` when the trial did not run to its end (cut at a word end after 300 characters);
  - for a judged `no`, splits `feedback.judge.advice` into its "Judge call N:" parts and then into sentences;
  - removes each sentence that matches one given after an earlier trial, and adds `judge.adviceRepeated`. For example: "The judge repeated a sentence of the advice it gave after the trial of revision 1, which is left out of advice. The trial that followed that advice, of revision 2, answered execution_failed: <stoppedBy.said> Weigh the repeated advice against what that trial answered before following it again."
  - says instead "This trial, of revision N, is the next trial after that advice, and it was judged no again." when no other trial came between;
  - keeps new sentences under their judge call, and drops `advice` entirely when nothing new is left;
  - passes unchanged a part that carries Core's label ("Judge call N (...)"), an unsure's reading, refusals, yes answers and every other verdict.
- **What counts as the same sentence:** both sentences contain the same numbers, and at least four in five of their words are shared, ignoring case, punctuation, small joining words, step ids and a plural's closing "s". Negations are kept. A sentence of fewer than 3 words is never compared.
- **R `flow-bootstrap/subflow-candidate/builder-loop.ts`.**
  - Every `core.test_subflow` answer now passes through `advice.told(...)` after the trial view.
  - A new optional input, `repeatedAdvice`, lets a caller pass one memory to every brief of a build. Without it, each builder keeps its own memory.
  - A header paragraph records the cause.
- **R `flow-bootstrap/subflow-candidate/index.ts`.** One line was added to export the new file, as the barrel rule requires. No other worker owns `subflow-candidate/` in wave 2.
- **R `flow-bootstrap/subflow-candidate/tests/builder-loop.test.ts`.** The tests directory is already at the 25-file budget, so the tests went into this existing file. Four tests:
  - repeated sentences are left out and new ones kept, with the follow-up trial's `execution_failed` sentence in the note;
  - advice repeated in full on back-to-back trials becomes a note only;
  - a different number or more than one word in five keeps the advice, and unsure answers and refusals pass unchanged;
  - an end-to-end run through `runAutomationStudioSubflowBuilderLoop` (submit, test three times, with a shared memory holding an earlier brief's advice) shows the model receiving the rewritten answers.

Tests first: the part 1 tests were seen failing before the change (list-continues: 2 failed and 6 passed; system-prompt: 1 failed and 38 passed). The part 2 tests were written before the module, but their first run came after the module existed, because they import its export. So I never saw them fail.

## Commands run and observed results

All from `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ/packages/fluxiq`, with R as above.

- `pnpm exec vitest run R/result-verification/read-account/tests/list-continues.test.ts`:
  - before the change: "Tests 2 failed | 6 passed (8)";
  - after: "Test Files 1 passed (1), Tests 8 passed (8)".
- `pnpm exec vitest run R/llm/deepseek/tests/system-prompt.test.ts`: before the prose change, "Tests 1 failed | 38 passed (39)".
- `pnpm exec vitest run R/llm/deepseek/tests/system-prompt.test.ts R/service/candidate-trial/tests/paging-feedback.test.ts`: "Test Files 2 passed (2), Tests 48 passed (48)".
- Pin comparison script against `git show HEAD:` of the pins: the 10 other pins are "same"; `loop_verification` and `loop_verification_build_test` are "moved by exactly the sentence".
- `pnpm exec vitest run R/llm/tests/diagnosis-channel.test.ts R/llm/harness/tests/run-size.test.ts R/llm/harness/tests/judge-request-prefix.test.ts R/result-verification/tests/repair-directive.test.ts`: "Test Files 4 passed (4), Tests 70 passed (70)".
- `pnpm exec vitest run R/flow-bootstrap/subflow-candidate/tests/builder-loop.test.ts`: "Tests 15 passed (15)".
- Contract tests plus all owned tests: `pnpm exec vitest run R/flow-bootstrap/subflow-candidate/tests R/result-verification/read-account/tests R/llm/deepseek/tests/system-prompt.test.ts R/flow-bootstrap/plan/tests/extraction-vocabulary.test.ts R/flow-bootstrap/plan/tests/issue-feedback.test.ts R/service/candidate-trial/tests/feedback.test.ts R/service/candidate-trial/tests/paging-feedback.test.ts R/result-verification/tests/repair-directive.test.ts R/llm/tests/diagnosis-channel.test.ts`: "Test Files 48 passed (48), Tests 405 passed (405)".
- Dispatch tests that send judge advice through builders: `pnpm exec vitest run R/project-agents/dispatch/tests/brief-loops.test.ts R/project-agents/dispatch/tests/brief-return-reason.test.ts R/project-agents/dispatch/tests/carried-opening.test.ts R/service/project-build/tests/project-build-brief-ports.test.ts`: "Test Files 4 passed (4), Tests 37 passed (37)".
- After the final typing fixes, `pnpm exec vitest run R/flow-bootstrap/subflow-candidate/tests`: "Test Files 24 passed (24), Tests 133 passed (133)".
- Probe of the matcher against the social run's recorded `core.test_subflow` results (a scratch script under my scratchpad; nothing from it is in the repo or tests):
  - Brief-3 alone (0103, 0125, 0133, 0141): no sentence matched. The judges reworded their advice each time.
  - One memory spanning brief-3 and brief-4: 0214 matched one sentence of 0141's advice (the "add a text field ... expanding See more" sentence).

## Not verified

- Typecheck, the structure audit and `pnpm check` were not run (the lead runs them). I checked the types by reading only. `told` returns `as T`. The new test's step functions have an explicit type.
- No live or Lab run.
- Builders in the social run would not have triggered part 2. Within one brief the advice was reworded each time, so it never matched. The one match found needs one memory shared across briefs. Sharing it means `project-agents/dispatch/run-brief.ts`, which I must not touch, passing one `AutomationStudioSubflowRepeatedAdvice` to each `runBuilder` call through the new `repeatedAdvice` input. That change is not made.
- The whole-candidate authoring loop (`flow-bootstrap/candidate/`, `core.test_candidate`) does not use the repeated-advice memory. The brief named only the builder loop.
- Repeated advice in an unsure's `unconfirmedReading.advice` is passed unchanged. The brief covered judged-no only.

## Open questions or contradictions found

- The brief says "identical" advice, but the evidence shows the judges never wrote identical text. The matcher allows close rewording: same numbers, at least 80% of words shared. Anything looser could drop advice that is really new. Whether to share one memory across a build's briefs is the supervisor's call (one line in `run-brief.ts`).
- Fix 4's first point in the social note, attaching the disclosure order when a read was refused `incomplete_text`, was not in this brief and is not done. The note found the judge's "add a text field" advice working against the incomplete_text hint, and that is what kept the builder swinging back and forth.
- `result-verification/tests/repair-directive.test.ts`, which I do not own, would need its exact `said` pin at line 319 updated if the range sentence should cover every kind of list and not only growing ones. I avoided touching it by limiting the sentence to growing lists.
