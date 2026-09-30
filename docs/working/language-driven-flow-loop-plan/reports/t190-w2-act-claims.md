# t190-w2 report: an act claim must name its act; step lists say what they withheld (cause 4)

## Outcome

Done. All work is in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t190/!FluxIQ` (branch `task/t190-instructed-acts`). Nothing is committed.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

- `instructed-acts/check.ts`
  - Removed the in-order fallback from `assign`, the old `take(act, () => true)`. A claim now answers an act only if it names it. The passes run in this order:
    1. id;
    2. **new** distinctive-word pass;
    3. verb;
    4. kind word.
  - An unnamed claim answers nothing, so its act is refused as `no_step_named`.
  - Distinctive-word pass: it applies only where two or more acts share a kind. For each act it collects the words of length >= 4 (lowercased, `[a-z0-9]+`) that appear in that act's quote and in no other same-kind act's quote. The first free claim whose action contains one of those words goes to that act. The helpers are `distinctiveWords` and `wordsOf`, plus the constant `MIN_DISTINCTIVE_WORD = 4`.
  - Rewrote the header comment. It no longer says leftover claims "are matched in order"; it now names run `run-muncqlr0-3348202b` as the reason.
  - `INSTRUCTION` now tells the model to list every act by its id (`a1`, `a2` ...), gives an example claim, and says "A claim that names no act answers none."
  - Raised `MAX_LISTED_STEPS` from 32 to 100. When the list is cut, `missingActs` also carries `stepsWithheld: <count>`.
- `instructed-acts/contracts.ts`: changed only the doc comment on `no_step_named`, which now lists the ways an act can be named.
- `reachability/check.ts`: raised `MAX_FEEDBACK_STEPS` from 24 to 100 and fixed the stale "sixteen per subflow" comment (it now says a hundred nodes per Subflow). `stepsWithheld` changed from `true` to the count withheld.
  - **Boolean or count:** I changed it to the count. Grepping Core for `stepsWithheld` finds only `reachability/check.ts` and `answerability/check.ts`. The answerability hit is its own separate `cannotAnswer.stepsWithheld: true` writer, which I did not touch. The only outside reader of `cannotReach` is `runtime/llm/harness-options/bootstrap-completion.ts:286`, and it passes the object through opaquely. Nothing reads the flag as a boolean.
- Tests:
  - `instructed-acts/tests/check.test.ts`, 8 new cases:
    - **a:** run 6 refused, as a claims list with `action: ""`, as a claims list with no action field, and as a map whose keys name no act. Each asserts that every act is `no_step_named` and that the instruction says "by its id". None depends on how many acts there are.
    - **b:** the same draft passes once each claim names its act by id; the verb and kind-word test is extended with "bookmark" and "view".
    - **c:** "Add the paper towels to my cart. Add the dinner napkins to my cart." with the claims given in reverse order. The napkins claim goes to a2 and the towels claim to a1; the towels claim names a dropped step, so the assignment shows in the refusal.
    - **d:** 120 kept mutating steps give a list of 100 and `stepsWithheld: 20`. A draft that fits carries no `stepsWithheld`.
  - `reachability/tests/check.test.ts`, 1 new case (**d**): a 120-step plan gives 100 steps and `stepsWithheld: 20`.

## Commands run and observed results

Run from the Core root. The brief's exact command, `... --maxWorkers=2`, fails before any test runs with `RangeError: options.minThreads and options.maxThreads must not conflict` (a tinypool conflict with the config), so I added `--minWorkers=1` to every run.

- Baseline, before any edit: `pnpm --filter fluxiq exec vitest run .../flow-bootstrap/instructed-acts .../flow-bootstrap/reachability --maxWorkers=2 --minWorkers=1` gave 4 files, 64 tests passed.
- Baseline: `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/llm/harness-options --maxWorkers=2 --minWorkers=1` gave 6 files, 92 tests passed.
- New tests, before the fix (same command): 9 failed, 68 passed.
  - **Mine:** 6 of my new cases failed, as expected:
    - run 6 x3: `expected true to be false`;
    - distinctive word: got `[a2, step_not_kept, d4]` instead of `[a1, ...]`;
    - instructed-acts list: length 32, expected 100;
    - reachability list: length 24, expected 100.
  - Two of my new cases passed before the fix, as they should: the by-id case and the verb/kind case.
  - **Not mine:** the other 3 failures are in `instruction-acts.test.ts` (w1's concurrent tests for its extractor change).
- After the fix (same command): 3 failed, 74 passed.
  - `instructed-acts/tests/check.test.ts`: 16 passed.
  - `reachability/tests/check.test.ts`: 14 passed.
  - `start-step.test.ts`: 11 passed.
  - The 3 failures are still w1's `instruction-acts.test.ts` cases ("reads bigbox pickup cart", "gives each act its own clause, not the whole sentence", "reads one act per counted object, each quoting its own"). All three expect 3 acts where the extractor still reads 2, meaning w1's `instruction-acts.ts` change was not in the tree when I ran.
- After the fix, harness-options (read-only) passed: 6 files, 92 tests. No bootstrap-completion test depended on the fallback.
- `npx tsc --noEmit` in `packages/fluxiq` exited 0.
- `node scripts/structure-audit.mjs` printed "passed (197 warning(s), 355 baselined)". It also printed "1 baseline entries can be lowered"; that entry is not in my files, so I left it alone.

## Not verified

- I have not tested against w1's final `instruction-acts.ts`. Test a is written so it does not care whether there are 2 or 3 acts.
- For test b under w1's 3-act reading, the by-id case adds a third kept step (`d13`), but that branch has not actually run yet.
- No live, Lab or browser run, as the brief required.

## Open questions or contradictions found

- The brief's vitest command needs `--minWorkers=1` in this worktree; the supervisor may want to fix the brief template.
- The distinctive-word pass hands out claims in act order. A claim whose text holds distinctive words for two acts (e.g. "add paper towels and napkins") goes to the first of them, and the second act is then refused `no_step_named`, which the model can correct.
- Run 6's current 2-act reading puts both acts' quotes in one sentence, so they share every word. The pass only matters once w1 gives each act its own clause and there are two `add_to` acts.
- `answerability/check.ts` still writes `stepsWithheld: true` with its own cap. It was outside my ownership, so it is unchanged.
