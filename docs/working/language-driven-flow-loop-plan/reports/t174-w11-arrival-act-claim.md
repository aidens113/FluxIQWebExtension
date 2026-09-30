# t174-w11: a step that only arrives at the start answers no act but `open`

## Outcome

Done. Core's instructed-acts check now refuses a claim that names a step which only went to the build's start location for any act whose kind is not `open`. It refuses with the new closed reason `step_only_arrives`. Completion passes `startLocation` into the check. Tests were written first and failed on the old code, and they pass now. `tsc` and the structure audit pass.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t174/!FluxIQ`. `P` = `packages/fluxiq/src/programs/automation-studio/runtime`.

- `P/flow-bootstrap/reachability/step-goes-to-location.ts` (new): exports `automationStudioFlowBootstrapDraftStepGoesToLocation(step, startLocation)`. This is the former private `goesThere` from `start-step.ts`: `automationStudioFlowBootstrapValuesCarryLocation(step.ranWith ?? step.input, startLocation)`. It gets its own file because of the one-export-per-file rule. The arrival restore and the acts check now share this one reading.
- `P/flow-bootstrap/reachability/start-step.ts`: the private `goesThere` is removed. The file imports the shared function under the alias `goesThere`, so its behaviour is unchanged.
- `P/flow-bootstrap/reachability/index.ts`: exports the new file and explains in a comment why it is published.
- `P/flow-bootstrap/instructed-acts/contracts.ts`: adds `"step_only_arrives"` to `AutomationStudioInstructedActMissingReason`, with a doc comment.
- `P/flow-bootstrap/instructed-acts/check.ts`:
  - New optional input `startLocation`.
  - After the kept, mutate and proposable checks and before the `step_claimed_twice` check, it now runs: `else if (act.kind !== "open" && onlyArrives(step)) missing.push({ ...act, reason: "step_only_arrives", ...named })`.
  - When `startLocation` is absent, nothing new is enforced.
  - When any missing act has this reason, the refusal adds `ARRIVAL_INSTRUCTION` to its instruction: "...the step named only goes to the page this Flow starts on: arriving at the start page does not do the act. After arriving, press or set the control that does it (the add, collect, save or set control), keep that step, and name it for the act instead."
  - The plain refusal instruction is unchanged, so the existing `toContain` assertions still hold.
  - The header comment records runs 15 and 13.
  - No node ids are named.
- `P/llm/harness-options/bootstrap-completion.ts`: the one call site now passes `startLocation: input.startLocation`.
- Tests:
  - `instructed-acts/tests/check.test.ts`: 5 new cases.
    - Run 15's two navigations to `http://127.0.0.1:59512` are refused. One is read from `ranWith` and the other from `input` with a trailing `/`. The acts are `add_to` and `claim`.
    - Presses (clicks) named for the same acts are accepted.
    - An arrival still answers an `open` act.
    - The arrival sentence is absent when no claim names an arrival.
    - With no start location, nothing is refused.
  - `harness-options/tests/bootstrap-completion.test.ts`: 2 new end-to-end cases. The refusal carries `missingActs` reasons `step_only_arrives` and the arrival instruction. Presses after the arrival are accepted.
  - `reachability/tests/step-goes-to-location.test.ts` (new): 2 cases. `ranWith` is read before `input`, and `input` is used when there is no `ranWith`.

## Commands run and observed results

All commands ran from `packages/fluxiq` unless noted.

**Failing first, before the fix:**
- `npx vitest run --minWorkers=1 --maxWorkers=2 src/.../flow-bootstrap/instructed-acts` gave "Tests 1 failed | 56 passed (57)". The failure was "refuses run 15's two arrivals ... → expected true to be false". The `acts.kind` assertion (`add_to`, `claim`) passed before it.
- `npx vitest run ... src/.../llm/harness-options/tests/bootstrap-completion.test.ts` gave "Tests 1 failed | 25 passed (26)". The failure was "is refused, naming each act as only arrived at → expected true to be false" at line 533, so the whole completion accepted run 15's Flow.
- The other new cases passed before the fix because they describe behaviour that must not change: open acts, clicks, and no start location.

**After the fix:**
- `vitest ... flow-bootstrap/instructed-acts`: 2 files passed, 57 tests passed.
- `vitest ... flow-bootstrap/reachability`: 3 files passed, 27 tests passed, including the 2 new ones.
- `vitest ... llm/harness-options`: 6 files passed, 96 tests passed.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174 w11" npx tsc --noEmit -p tsconfig.json` printed "[heavy] t174 w11 holds b2" and exited 0 with no diagnostics.
- `node scripts/structure-audit.mjs`, run from the Core root, printed "structure-audit: passed (194 warning(s), 354 baselined)" and exited 0.
  - Among the touched files it warns only on `bootstrap-completion.ts` (452 lines) and `tests/bootstrap-completion.test.ts` (547 lines). Both are advisory 400-line warnings, and both files were already past 400 lines before this change (+2 and +36).
  - It also printed "1 baseline entries can be lowered". I did not run `pnpm structure:baseline`; the baseline file is outside my brief.

## Not verified

- No live or Lab run. Whether the model, given this refusal, goes on to press the add-to-cart and coupon controls is untested. That needs the supervisor's next live run on crossborder-marketplace.
- Run 13's exact 7-step URLs were not read. The test covers the pattern (navigations to the start), not that draft verbatim.
- I did not run the complete Core suite, only the three named directories.

## Open questions or contradictions found

1. **The reused reading is already broader than "only to the start".** `location-agreement.ts` counts a value as going to the start when it agrees with the start location for its first 12 characters.
   - With start `http://127.0.0.1:59512`, any value beginning `http://127.0` matches, including another port. With `https://shop.test/...`, any `https://shop...` URL matches.
   - So this fix already refuses same-site navigations such as `/cart` or `/item/3` named for add, claim, save, set, move or submit. For the failure seen, that is the intended outcome.
   - The cost: a press step whose own parameters carry a same-site URL string would also be refused for a non-`open` act. An example is a click node that records an `href` or the page URL as a parameter. The web fixture's click is selector-only, so I found no such case, but a domain could add one.
   - I kept the brief's instruction to reuse the one reading, rather than writing a stricter second one, because `location-agreement.ts` exists precisely to prevent two readings.
2. **Assessment, not implemented: should every navigation be barred from non-`open` acts?**
   - Yes in principle. A cross-site navigation adds, collects, sets or sends nothing either. The value-agreement signal cannot see such a step, because it only knows the start location.
   - Signals Core could use without naming web ids:
     - (a) **Recommended.** A domain-declared, closed effect class on the node definition, or on the draft step's `effect`. For example, a third value `arrive` (or `changes: "location"`) beside `observe` and `mutate`. The web domain would set it on its navigate node. Core would then bar any `arrive` step from non-`open` acts, whatever the destination. It is domain-neutral, as the `observe`/`mutate` split already is.
     - (b) The step's run evidence: the page location changed and nothing else did. This depends on per-step evidence Core may not keep.
     - (c) A heuristic that every string parameter is location-like. It is weak, and Core deliberately does not parse locations.
   - Option (a) needs a node-definition contract change across Core and the web domain, so it is out of this brief.
3. **Stale comment.** The header comment in `P/flow-bootstrap/reachability/location-agreement.ts` still says it is read "by the completion's arrival restore ... (`./start-step.ts`)". It is now read through `step-goes-to-location.ts`, which serves both the restore and the acts check. I left it because that file is outside what I own; it is a one-line comment fix for whoever owns it.
4. `missingActs.stepsThatChangedSomething` still lists arrival steps, because they may still answer an `open` act. I left this as it was deliberately.
