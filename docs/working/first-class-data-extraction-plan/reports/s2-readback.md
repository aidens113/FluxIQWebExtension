# Report: s2-readback (C7, a stored do-while read back as a draft)

## Outcome

Done. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ`, branch `task/t283-read-list-s2-loop`. No commits.

## What changed and why

`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

- `R/llm/node-tools/seeded-loops.ts`
  - The header now states both loop kinds' read-back rules in one place.
  - New `seededDoWhile` reads exactly C4's shape:
    - the head Merge's only way out is into the Repeat; the head is entered only by the back edge and at most one way into the loop;
    - the Repeat is entered only from the head and leaves by exactly one `body` and one `done`;
    - the body is one contiguous chain: each step is entered once, by the step before it (or by the Repeat's `body` for the first), and leaves only by `success`;
    - the last step leaves by `success` into the head, and otherwise only into the exit Merge by ports other than `success` or `failed`;
    - the exit is entered only by `done` and the last step.
  - Framing is `[head, Repeat, exit]`.
  - `most`:
    - It is omitted when it is absent or equals the definition's default (50).
    - It is carried when it is an integer within the node's constraints (1..500).
    - Any other value, or any other non-default Repeat setting (`maxStepsPerIteration`), causes a fall back.
  - `REPEAT_NODE_ID` was added to `PATH_NODES`, so a Repeat is never a body step of either kind of loop. A For Each body holding a Repeat, or a nested Repeat, falls back.
  - `AutomationStudioFlowDraftSeedLoop` is now `{ body, framing } & ({ over } | { while: true, most? })`.
  - The shared-claims check copes with the absence of `over`.
  - `settingsAreDefaults` now takes the values and the definition id.
- `R/llm/node-tools/draft-from-flow.ts`
  - A do-while loop seeds `{ kind: "repeat", through, while: through, most? }` on its first body step.
  - A For Each still seeds `{ kind: "repeat", through, over }`.
  - `ROUTING_NODES` now includes `builtin.control.repeat`, so `planKeys` skips the derived Repeat in the same way it skips For Each and Merge.
  - The header paragraph was extended.
- `R/llm/node-tools/tests/draft-from-flow.test.ts`: one new `describe` with 4 tests:
  - the C4 shape reads back as `[open, read, next, summary]` with `{ kind: "repeat", through: "f3", while: "f3" }` on `read`, and no Merge or Repeat step;
  - `most: 50` reads back with no `most`;
  - `most: 7` reads back as `most: 7`;
  - six variants fall back to a plain Repeat step with no repeat routing: a branching body (`read.failed`), a stray Repeat `pass` edge, `next.failed` into the exit, `maxStepsPerIteration: 9`, no `done` edge, and a nested Repeat.
  - The existing For Each tests are unchanged and pass. No new test file was added (the directory still holds 25).

## Commands run and observed results

All were run from `C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ/packages/fluxiq`.

- Fail-first: `npx vitest run src/programs/automation-studio/runtime/llm/node-tools/tests/draft-from-flow.test.ts` gave `Tests 4 failed | 28 passed (32)`.
  - All four new tests failed. In the fallback test the failure was its positive assertion (`expected { pass: true, repeats: false } to deeply equal { pass: false, repeats: true }`).
- After the change: `npx vitest run .../tests/draft-from-flow.test.ts .../tests/run-flow-in-loop.test.ts .../tests/run-flow-rows-in-loop.test.ts` gave `Test Files 3 passed (3)`, `Tests 36 passed (36)`.

## Not verified

- Typecheck: I ran no tsc, `fluxiq:check` or structure audit, because the brief reserves them for the lead. Vitest does not typecheck.
  - I confirmed that `AutomationStudioFlowDraftStepRouting` is exported through `R/flow-draft/index.ts` (`export * from "./routing.ts"`).
  - The discriminated union in the `repeats` map is unchecked by a compiler.
- Round trip through assembly: do-while assembly in `draft-routing.ts` belongs to another worker and was not present when I read it. So no test assembles a seeded do-while and reads it back. The tests build the C4 shape by hand.

## Open questions or contradictions found

- C4 sends "every output of `last`'s node whose role is `branch`" to the exit. A domain node's definition (for example the next-page `ended` port) is not readable from this module, because `getAutomationNodeDefinition` covers built-ins only. So the read-back accepts any port other than `success`/`failed` from the last step into the exit as a branch answer. It does not check that port's role. A stricter check would need the registry passed into `automationStudioFlowDraftSeedFromFlow`.
- Two cases depend on `orderedNodes` and its fallback to document order, which is unchanged:
  - a do-while that is the Flow's first step, with nothing before the head Merge;
  - a do-while whose way in is only from `start`, because `start` is filtered out before ordering.
- The existing For Each read-back has the same behaviour in both cases.
