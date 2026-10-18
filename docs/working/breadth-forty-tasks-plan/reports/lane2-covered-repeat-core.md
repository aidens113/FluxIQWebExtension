# Report: lane2-covered-repeat-core

## Outcome

Done. Core tree `fxwork/t565/!FluxIQ` (branch task/t565-a8-lane-2), uncommitted. No build was run and no `dist` was touched.

## What changed and why

Paths are under `packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/`.

- `covered-refused.ts` (new): `automationStudioLlmEvidenceRepeatCoveredRefused(earlier)` is true when the earlier outcome is `failed` and its `resultCode` ends in `target_covered` or `blocked_by_dialog`, with `^` or `.`/`_` before the suffix. It checks the code only, so it matches whichever reason the press carried (`covered_by_layer`, `answered_the_same_again`, or none). It follows the pattern of `permission-refused.ts`. The header cites run-mvcwem7d-34689f55.
- `feedback.ts`: added `COVERED_INSTRUCTION`. `instructionFor` returns it after the handle-unshown case and before the permission case. The text says:
  - the press was refused because something over the page covers its control, so nothing was pressed;
  - it is refused the same way until that layer is gone;
  - the earlier answer under sameAsCall names the layer and, where it can, the controls that close it;
  - press one of those first, or another control inside that layer, never a control the page marks as covered by it;
  - then this press may be made again, because a call made after the page has changed is not a repeat.

  It ends with the usual "Repeats refused in a row end this round..." sentence, so the undrafted rewording still applies. It uses no site words and names no downstream fields.
- `candidate-feedback.ts`: the evidence's note is the candidate-mode SAME_CALL wording ("...use a different control or a different input, submit a corrected candidate, or ask the person"), so a builder's `core.run_node` press reaches this file's fallback branch. That means the same note is built here, and I added `COVERED` here too, plus the standard `ending(inARow, maxInARow, "this press")`. That gives "...3 repeats refused in a row end this build with nothing tested", or on the last refusal "...ends this build with nothing tested".
- `index.ts`: exports `./covered-refused.ts`.
- `tests/feedback.test.ts`: the "plain repeat note for any other failure" case used `target_covered`, which now gets its own note. It uses `target_disabled` instead and also asserts the covered wording is absent.
- `tests/covered-repeat.test.ts` (new, 5 tests):
  - the predicate matches the three covered shapes and rejects four near-misses;
  - the drafting note has each required clause and lacks the generic "use a different control or a different input";
  - the undrafted note;
  - the candidate/builder note, for the first refusal and the last;
  - the guard: a covered press is refused on page "layered", and it is allowed again after a closing press applied and moved the page to "clear".

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/llm/repeat-guard` (in packages/fluxiq): 11 test files passed (11), 68 tests passed (68). This includes precondition-lift.test.ts, 3 passed: its "any other failure stays keyed on its page" case with `target_covered` is unchanged, because only the note changed and the guard did not.
- `npx vitest run .../evidence-loop/tests/stall-guard.test.ts .../evidence-loop/tests/repeat-guard.test.ts .../decision-handlers/tests/candidate-repeat-told.test.ts`: 3 files passed, 33 tests passed.
- `npx tsc --noEmit -p tsconfig.json` (packages/fluxiq): no output, exit 0.
- `node scripts/structure-audit.mjs` (Core root): "structure-audit: passed (397 warning(s), 1155 baselined)", exit 0. The only repeat-guard warnings are the existing file-lines ones (outcomes.ts at 554 lines, evidence-loop/tests/repeat-guard.test.ts at 438 lines). None is for a file I touched.

## Not verified

- Whether the model behaves differently: there was no live run, and none should run until the downstream domain fixes (keeping `closeWith`, the `next` sentence) land and the tree is rebuilt.
- The real page digest changes when a layer closes. The page-change lift is shown only with synthetic states. If a site's close leaves a byte-identical digest, the press stays refused.
- Other test suites that quote the repeat note were checked by grep only. No test outside repeat-guard asserts the generic wording for a covered code. I did not run the full Core suite.

## Open questions or contradictions found

- A builder's covered `core.run_node` repeat gets the candidate ending, "end this build with nothing tested", not the builder's "end this brief" with the `ended: "blocked"` way out. The builder branch only covers `core.submit_subflow` and `core.test_subflow`. This existed before this change and was left as it was.
