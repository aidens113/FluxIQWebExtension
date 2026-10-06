# live-a-r2-fix-rerun-node (Core, lane A round 2)

## Outcome
Done.

## What changed and why
- `packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop/rerun-input.ts`: after the patch is placed (`automationStudioRerunPatchPlacement`), if the stored `node` and the patch's `node` are both strings and differ, the stored `parameters` are deleted before the merge. The result's parameters are then the patch's as written, or absent when the patch writes none. Every other top-level key (`consequences`, ...) merges as before. A same-node patch takes the unchanged path, including withheld-key restoration and renames. A header paragraph states the rule as the top-level counterpart of the `kind` rule and cites run-muwaobm2-882cadd9, draft step 14, decisions 0052 and 0060-0092. Added the `NODE_KEY` and `PARAMETERS_KEY` constants and the `changesNode` helper.
- `.../evidence-loop/tests/rerun-input.test.ts`: added the describe block "a rerun that changes the step's node" with three tests:
  1. The 0052 case yields exactly `{node:"web.output.dom-click", parameters:{target:{handle:"t958"}}, consequences:[]}`.
  2. A node change with no parameters yields `{node, consequences:[]}`, with no parameters.
  3. A same-node patch `{parameters:{text:"4"}}` keeps `target` and `submit`.

## Commands run and observed results
- Before the fix, from packages/fluxiq: `pnpm.cmd exec vitest run .../evidence-loop/tests/rerun-input.test.ts` -> rerun-input.test.ts reported (20 tests | 2 failed). The two failures were the node-change tests: the received parameters held `text: "3", submit: false` (and target t964 in the no-parameters case). The same-node test passed.
  - That run also printed "Test Files 11 failed (11), Tests 22 failed | 198 passed (220)". Vitest also picked up copies of the test under `.tmp/core-web-build/...`. My edits did not cause this, and I did not investigate it.
- After the fix: `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/evidence-loop/tests` -> Test Files 25 passed (25), Tests 262 passed (262). This covers rerun-input, rerun-request and rerun-replacement.
- `pnpm.cmd run check` -> tsc --noEmit build-cache step ran ("inputs changed"), exit 0, no errors.

## Not verified
- No live rerun of the scenario.
- I did not run tests outside evidence-loop/tests.
- Another worker was editing other llm/ files at the same time, so the green run reflects the tree as it stood then.

## Open questions or contradictions found
- A node change also leaves the stored parameters' withheld keys (selectors) behind, as the brief intends: the old node's parameters do not belong to the new node.
- The top-level rename heuristic (`renamedKeys`) still runs against the remaining top-level keys. In practice those are only `node` and `consequences`, so it should be inert.
