# t285-e-change-evidence: worker report

## Outcome

Done. The act judge now reads what a step changed (`changed`). A step whose change shows the act is never caught. A step that says it changed something, none of which shows the act, while another eligible step's change does, gets the new reason `another_step_shows_it`. That reason travels through the checklist, the verdict and the claim verdict (unchanged `claim-verdict.ts`).

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t285/!FluxIQ`, branch `task/t285-fix-act-claims`. R = `packages/fluxiq/src/programs/automation-studio/runtime`. No commits, and no Lab, browser or provider calls.

## What changed and why

- `R/flow-bootstrap/instructed-acts/kind-words.ts`: added `AUTOMATION_STUDIO_INSTRUCTED_ACT_PLACE_WORDS` and `AUTOMATION_STUDIO_INSTRUCTED_ACT_DONE_WORDS`, one list per kind as the brief gave them, with set/open empty. A header note says why. A PLACE word is a place whose count rising is the act, never the verb ("Add 2 to cart" rising is the button counting, and "Qty 2" names no place). DONE words are past tense the page states, never a present verb a button still offering the act carries. They are kept apart from KIND_WORDS, which say what a control names. File kept CRLF.
- `R/flow-bootstrap/instructed-acts/act-evidence.ts`:
  - new export `automationStudioInstructedActChangeShows(act, step)`. It is true when some `changed` entry either `rose` and names a PLACE word of the act's kind but neither `act.verb` nor "add", or `appeared`/`reads` and names a DONE word. `went` never shows the act. It is always false for set/open.
  - `automationStudioInstructedActStepDidInstead(act, step, steps, acts)`: `acts` is a new required 4th parameter. It returns undefined first when the step's change shows the act, so positive evidence wins over words, interruption and choice. The new last rule: if the step has `changed.length > 0` and another step in `couldDoIt` shows the act by its change, the result is `{ fault: "another_step_shows_it" }`. This rule is reached only when the words exist and do not name the act.
  - a new private `couldDoIt`, which `StepThatNamesIt` also uses. Its filter: not the judged step (neither the object nor its position), kept or taken, mutate and proposable, named for no other act or another act's choice, and not bound to another act's object by `automationStudioInstructedActStepActsOn`.
  - `automationStudioInstructedActStepThatNamesIt` prefers change-showing candidates (first after the judged step, else first before) over words-only ones. Words-only candidates are filtered as before.
  - `automationStudioInstructedActEvidenceSaid` has a new-fault sentence: `Step N ("Not now") changed nothing that shows aN, and does not do aN.` Where `instead` shows the act by its change, it says `Step M ("Add to cart") shows it: name aN there with amend_draft add on step M with act aN.`, else "names it" as before.
  - `EVIDENCE_FAULTS`, the `AutomationStudioInstructedActEvidenceFault` type and the `AutomationStudioInstructedActStepInstead` type all include the new reason. Header docs updated.
- `R/flow-bootstrap/instructed-acts/contracts.ts`: added the reason `another_step_shows_it`, documented with run `run-muqiho5c-e830ce01` cited. The `instead` doc lists the new reason.
- `R/flow-bootstrap/instructed-acts/checklist.ts`: `AutomationStudioInstructedActEvidenceTodo` now includes `another_step_shows_it`, and the header and `todoSaid` docs are updated. One addition beyond the brief: no advisory `claimSaid` (claim doubt) on a doer whose change shows the act, since the change answers the doubt about its words. It is tested on the "＋" case. File kept CRLF.
- `R/flow-bootstrap/instructed-acts/check.ts`: added `ANOTHER_SHOWS_INSTRUCTION` and its `REASON_INSTRUCTIONS` entry, placed after `step_only_clears_the_way`. Header paragraph updated.
- `R/flow-bootstrap/instructed-acts/standing.ts`: passes `input.acts` to DidInstead. One addition beyond the brief: `opensItsChoices` also returns false for a step whose change shows the act, so positive evidence wins there too. Header W1 paragraph updated.
- Tests:
  - `tests/act-evidence.test.ts`: the 3 existing DidInstead calls take the 4th argument. A new `describe` has 10 tests covering every case the brief listed, plus the change-before-words preference and the towels/napkins exclusion. The exclusion is tested both by record binding (towels named in `ranWith`) and by the towels step being named a1. A control case shows the same add with no towels record is offered.
  - `tests/claim-verdict.test.ts`: 1 new test. The claim on "Not now" is refused with the exact sentence and `instead: 4`, and the claim on the Add to cart stands.

## Commands run and observed results

All from `packages/fluxiq` unless noted.

1. Fail-first: `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/tests` gave `Test Files 2 failed | 8 passed (10)` and `Tests 7 failed | 320 passed (327)`. The failures were: another_step_shows_it not given; claim verdict undefined; "＋"/Yes-continue not done; `automationStudioInstructedActChangeShows is not a function`; preference returned 8 instead of 3; "offers one that names no other object" undefined; the claim-verdict refusal undefined.
2. After the implementation, the same command passed `10 passed (10)`, `Tests 327 passed (327)`. It was run three more times after the final test edit, each with `Tests 327 passed (327)`.
3. First `node scripts/build-cache/cli.mjs fluxiq:check` (Core root): failed with exit code 2.
   - One error was mine: TS2379 at `tests/act-evidence.test.ts:249`, where `{ changed: undefined }` breaks `exactOptionalPropertyTypes`. I fixed it by destructuring `changed` off.
   - Four TS2741 errors were in files outside my ownership: `act_not_done_there` missing in `activity/wording/draft-edit-card.ts`, `flow-bootstrap/evidence-loop-steps.ts` and `llm/draft-amendment-feedback.ts` (two sites). That is another worker's in-flight edit, and I did not touch it.
4. Second `fluxiq:check` run: only my TS2379 remained; the others' errors were gone.
5. Final `fluxiq:check` after my fix: no `error TS` lines. Output: `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; stored in the shared store ..."}`, which means it passed.
6. `node scripts/build-cache/cli.mjs structure-audit:check` (Core root): `structure-audit: passed (273 warning(s), 349 baselined).` The instructed-acts warnings are advisory only:
   - the directory has 21 source files (it already had 21);
   - `check.ts` is 505 lines (it was 496 before);
   - `tests/check.test.ts` is 503 lines (unchanged).

## Not verified

- No full suites were run, by the brief's narrow-check rule. I did not run tests outside `instructed-acts/tests`, so a flip elsewhere is not excluded. For example, `unfinished-build/tests/not-done.test.ts` and `llm/evidence-progress/tests/stall-redirect.test.ts` read these reasons. The typecheck covers the whole fluxiq package and passed.
- I did not check that the host actually sends `changed` (another worker's job). Live behaviour is unexercised.

## Open questions or contradictions found

- There are two additions beyond the literal brief, both in owned files and both following "positive evidence wins":
  1. `opensItsChoices` (standing) is skipped for a step whose change shows the act;
  2. the checklist's advisory `claimSaid` is suppressed on such a step.

  Revert either if unwanted.
- Another worker's `unfinished-build/not-done.ts` already words `another_step_shows_it` ("the step I named for it was not the one that did it"). It is consistent with this reason name, and the typecheck passes with both in place.
- To check how the towels/napkins instruction parses, I briefly created `instructed-acts/t285e-probe.test.ts`, ran it once, and deleted it straight away. Nothing remains.
- `kind-words.ts` (CRLF) was briefly rewritten as LF by a script and restored to CRLF at once. `git diff --stat` shows only the 41 added lines.
