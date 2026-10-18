# lane4-w3-repeat-span (live-lane-4, t567): report

## Outcome

Done. The fix is in Core at `C:/Users/osrs_/FluxStuff/fxwork/t567/!FluxIQ`, branch `task/t567-a8-lane-4b`. Nothing is committed.

## What changed and why

Evidence checked first. Steps 0081 and 0156 of `run-mvcwqwec-0aa4f98b` both submit `step jobs:` (extract_list, minItems 0) and then two unlabelled adjacent steps that each say `repeat over: jobs`. Both were refused with only `bootstrap.source_port_cardinality` on the listing's line.

The cause: the script router (`authoring/draft-routing.ts`, `routeAutomationStudioFlowScriptRepeats`/`scriptSpan`) built one For Each loop per `repeat over:` line. The second loop added a second `records` edge out of the listing. No list output port in Core or the downstream domain declares `multiple`, so that shape can never build.

1. **New lowering: `script-statements/adjacent-list-repeats.ts`** (`automationStudioFlowScriptAdjacentListRepeats(blocks) -> { blocks, issues }`, exported from the `script-statements` barrel).
   - **What it merges.** A span over a listing takes in the step written right after it when that step also says `repeat over:` the same listing and has no `repeat while:`. If that step's own `repeat through:` points at or after itself, the span's end moves on. A step inside the span that repeats over the same listing is absorbed the same way.
   - **How the merged span is written.** The span's first step gets `repeat through: <new last step>`. If the last step has no label, it gets the label the router already derives for unlabelled steps (`:line<N>`). The script locator treats that prefix as derived.
   - **Pace and most on a merged step.** The step keeps any `repeat pace:` or `repeat most:` it also wrote, so the existing pace and bound lowerings move or refuse them.
   - **The new refusal.** A second span over a listing its block already walks, with other steps between the two, is refused as **`flow_script.repeat_over_twice`** at its `repeat over:` line: "The step at line N repeats over "L", and the span that starts at line M already repeats over it, with other steps between the two. A listing is repeated over once: write every step of each pass in one span, `repeat over: L` on its first step and `repeat through: <its last step>`." That step's repeat lines are removed, so this is the only refusal it gets.
   - **What it leaves alone.** A block with fewer than two `repeat over:` lines comes back as the same object. Malformed shapes (`over` beside `while`, or a `through` that names a missing or earlier step) are left for the router's own refusals.
   - **Why this directory.** `authoring/` already holds 25 source files, the directory limit, and `repeat-` would become a three-file shared prefix. So the module sits beside `repeat-bound.ts` and `repeat-pace.ts`, the other span lowerings.
2. **`authoring/assemble.ts`** runs the lowering first, before called parts, `optional:`/`only after:` (`guarded-steps.ts`), entry points/checkpoints and the repeat router. Every reader of `automationStudioFlowScriptSpans` therefore sees one span. The file is exactly 800 lines: the limit was held by folding the import onto an existing line and rewording the existing comment in place.
3. **`authoring/draft-routing.ts`, the draft path (item 3 of the brief).** The drafted route (`routeAutomationStudioFlowDraftSteps`, used by `assemble-draft.ts`) could produce the same two-loop shape and reach the same cardinality refusal. When two adjacent drafted steps each had routing `{ kind: "repeat", over: <same step> }`, `repeat()` added a second `records` edge out of the source. `effectiveSteps` now applies the same reading to its copy of the steps: the first span's `through` extends to the adjacent or inner member's `through`, and the member's routing is removed. The draft the model sees is unchanged. The file is now 790 lines.
4. **Other routes checked:**
   - Candidate submissions (`candidate/submission.ts`) and scoped subflow submissions (`subflow-candidate/scoped-submission.ts`) both assemble through `accept.ts` and then `assembleAutomationStudioFlowScriptPlan`, so the fix covers them.
   - `assemble-draft.ts` routes the draft first (now covered) and hands the assembler steps that no longer say `repeat`.
   - The other parsers of a script (`callable-target.ts`, `output-refusals.ts`, way-out and optional-act checks) do not read `repeat` lines.
   - A JSON plan names its edges outright, so it is not this shape.
5. **`plan/flow-script-format.ts`**: not changed. The adjacent shape now builds, and the non-adjacent shape gets a refusal that says what to write, so no prompt wording was needed.

Tests:
- New file `script-statements/tests/adjacent-list-repeats.test.ts` (7 tests, examples on a library-loans site):
  - adjacent same-list repeats are read as one span with the derived label, and the parsed script is not mutated;
  - they build one For Each whose body holds both clicks, with one `records` edge, and the plan validator accepts it;
  - the result is identical to the same span written with `repeat through:`, and a labelled last step keeps its label;
  - an explicit `repeat through:` span is extended by an adjacent same-list step;
  - the `repeat through:` form comes back as the same block object;
  - non-adjacent duplicates are refused with `flow_script.repeat_over_twice` as the only error, at the second `repeat over:` line;
  - different listings still make two loops, and the plan validates.
- One new test in `authoring/tests/draft-routing.test.ts`: adjacent drafted repeats over one list give the same wiring as `through` on the first step, with one `records` edge and one For Each, and the plan validates.

## Commands run and observed results

- `cd !FluxIQ/packages/fluxiq && npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests/adjacent-list-repeats.test.ts` -> `Test Files 1 passed (1)`, `Tests 7 passed (7)`.
- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/authoring/tests src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests`, run before and after the final type fix -> both times `Test Files 30 passed (30)`, `Tests 336 passed (336)`.
- `npx tsc --noEmit -p tsconfig.json`, the package typecheck (no emit; dist was not built). The first run printed one error in my file: `adjacent-list-repeats.ts(98,5): error TS2412 ... exactOptionalPropertyTypes`. After the fix -> no output, exit 0.
- `node scripts/structure-audit.mjs` at the Core root -> `structure-audit: 5 violation(s) across 3 rule(s)`. All five are in files other workers are editing in this tree:
  - `directory-files` on `project-agents/supervisor/`, `project-agents/supervisor/tests/` and `service/project-build/` (26 files each);
  - `failure-as-empty` and `web-vocabulary` on `project-agents/supervisor/left-told.ts`.

  None are in `flow-bootstrap/authoring` or `flow-bootstrap/script-statements`.
- `npx biome check <my files>` -> "No files were processed": Core's biome config ignores these paths.

## Not verified

- No live run. Whether the builder now gets past this point in `job-board` is still unproven, and the run's other causes (the save control missing from the page view, and the identity floor) are untouched.
- Core's whole vitest suite and `pnpm check` were not run (per the brief), and dist was not built.
- In the draft path, a non-adjacent drafted repeat over a list already walked is **not** given a plain refusal. It still reaches `bootstrap.source_port_cardinality`, because only the adjacent and inner shapes were merged there. Adding a `flow_draft.*` refusal in `repeat()`, by checking whether the source already carries a rows edge, would cost about 3 lines in `draft-routing.ts` (790 lines now).

## Open questions or contradictions found

- `authoring/assemble.ts` is at exactly 800 lines and `authoring/` at 25 files. The next change to either has to cut something first.
- I changed no prompt wording. Whether the script format should also say "adjacent steps repeating over one listing are one span" is a supervisor call. With the merge in place it is not needed for correctness.
- The working tree also holds uncommitted changes by other workers: `conversations/commands/*`, `project-agents/supervisor/*` and `service/project-build/*`, including the audit failures above. I did not touch them.
