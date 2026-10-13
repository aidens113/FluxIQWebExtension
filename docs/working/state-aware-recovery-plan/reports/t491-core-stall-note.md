# t491 Core half: stall note stops pushing a submit the evidence does not support

## Outcome

Done, but with a limit on which signal can be used. See "Open questions" Q1.

## What changed and why

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t491/!FluxIQ`, branch `task/t491-stall-note-and-near-find`.

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-progress/stall-redirect.ts`
  - The candidate-mode (`discoveryOnly`) branch with no accepted candidate now picks one of two notes.
  - **Covered: `candidateCovered()`.** This holds only when Core's acts checklist was read (`actsMissing` was given; it comes from `flow-bootstrap/instructed-acts` through `draft.actsMissing`), the checklist owes nothing, and the completion check's answerability names no gap (`stillMissing` is absent). The old wording stays unchanged here: "Use the evidence already gathered, correct any named submission issues and submit the whole candidate ...".
  - **Not shown covered: `untriedRoutes()`.** This covers three cases: acts are owed, the completion check names a gap, or Core holds no record at all. The note names the gap: the owed act ids, or `stillMissing: record_producer`, or a general "nothing yet shows every act ... done on the right item". It then says:
    - going back to pages already seen, or running the same search again, will not change that, and submitting now would submit what is still missing;
    - routes not yet tried: a control on the current page not yet used (an option or variant choice, an "Options", "More" or "See all" link, a related or similar items section), a page search with other or fewer words, or going back to a listing and opening a result not yet opened;
    - one example from a library catalogue: the wrong edition is shown, so use its "Other editions" link or search for the title without the edition words;
    - submit the whole candidate only once the evidence shows every act done, using steps that were seen working; then test the receipt; never complete an untested candidate.
  - The wording names nothing from any scenario (no napkins, packs, shops, carts or products). A test enforces this.
  - The accepted-candidate branch and the non-candidate (draft) branch are unchanged.
- `.../evidence-progress/tests/stall-redirect.test.ts`
  - Added a new `describe("a no-candidate stall")` with 5 tests:
    - owed acts lead to routes and no "submit";
    - no record leads to routes;
    - a completion-check gap leads to routes;
    - an empty checklist leads to "submit";
    - no scenario words appear.
  - Updated the existing "does not invent a receipt" test. With no record, it now expects "Submit the whole candidate only once".
- `llm/deepseek/tests/system-prompt-pins.json`: not touched. A grep found no pin of this text.

**Signal used:** Core's own records, never the model's prose. These are the instructed-acts checklist (`actsMissing`) and the completion check's answerability (`stillMissing`). The model's reasoning text is not an input to the note.

## Commands run and observed results

All commands ran from `!FluxIQ/packages/fluxiq` unless noted.

- **Fail-first check.** I swapped the original `stall-redirect.ts` back in from `git show HEAD:...` and ran `npx vitest run src/.../evidence-progress/tests/stall-redirect.test.ts`.
  - Result: `Tests 4 failed | 10 passed (14)`.
  - The 4 failures were the updated no-candidate test and the three "routes" tests.
  - "says submit when the checklist owes nothing" and "uses no scenario words" pass on the original as well. That is expected: the first is the branch that keeps the old wording.
  - I then restored the new source.
- `npx vitest run src/programs/automation-studio/runtime/llm/evidence-progress/tests src/programs/automation-studio/runtime/llm/tests` gave `Test Files 32 passed (32)`, `Tests 484 passed (484)`.
- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` exited 0 with no output.
- `node scripts/structure-audit.mjs`, run from the `!FluxIQ` root, gave `structure-audit: passed (338 warning(s), 1159 baselined)`. None of the warnings concern the touched files (283 and 184 lines).

## Not verified

- No live, Lab or provider run.
- I did not check whether the model takes the new routes in practice.
- No full suites were run.

## Open questions or contradictions found

1. **In live candidate builds, Core holds no record of what exploration achieved.**
   - The candidate loop runs `draft: false`. That is enforced at `llm/evidence-loop.ts:175`, and `flow-bootstrap/candidate/authoring-loop.ts:91` sets it.
   - As a result, `redirect-facts.ts` passes `actsMissing: undefined`, and exploration steps are not appended to `draftSteps` (`evidence-loop.ts:202`). The completion-check answerability is also normally absent before a submit.
   - So today every no-candidate stall in a real build takes the "untried routes" note. That note still says to submit once the evidence shows every act done, so a model that holds full evidence is not blocked. But Core cannot yet confirm coverage by itself.
   - To make the "submit" branch reachable from Core's own record in candidate mode, an instructed-acts checklist over the actions exploration ran has to be computed and fed into `automationStudioLlmEvidenceRedirectFacts`. That touches `llm/evidence-progress/redirect-facts.ts` and probably `llm/evidence-loop.ts`, neither of which I own. It is a follow-up brief.
2. The brief mentioned "the model's last decisions say something is still missing". I did not use model prose, as Goal 1 prefers. Without a Core record, the note defaults to the cautious, routes-first branch.
