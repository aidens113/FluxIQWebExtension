# t748-u1b-preceding-steps: Core tells a candidate's node the steps before it

## Outcome

Done. The domain no longer tracks a plan's position from one resolver call to the next. Core now sends each node of a
candidate submission (`handleReach: "view_history"`) a new optional field, `precedingSteps`: the plan's steps before
that node, in plan order. The domain folds u1's `webPlanStepMove` over that list on every call to find the dialog view
the node stands in. The cross-call cursor (`followed`, `standingIn`) and all its resets are gone. When the field is
absent (an older Core, or any resolution that is not a candidate submission), there is no standing view, and resolution
is exactly HEAD's.

## What changed and why

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime/`)

- `R/llm/harness-options/binding.ts`: `resolvePlanNodeParameters` input gains an optional, documented
  `precedingSteps?: readonly { definitionId: string; parameters: JsonObject }[] | undefined`. Its contract:
  - Sent only beside `handleReach: "view_history"`.
  - Lists every Subflow's nodes before this one, in plan order. Inherited-untouched steps and handlers with a refused
    fact are included.
  - Each step is as the plan held it before any resolution: handles intact, the consequence declaration stripped by
    `automationStudioPlanStepConsequences`. Each call gets its own copy.
  - Page-fact targets are not steps. They are not in the list and are sent none.
  - At most 200 steps. A node with more than 200 before it is sent none.
  - The doc says plan order is not run order in a branching Flow.
- `R/llm/harness-options/plan-parameter-resolution.ts`:
  - Under `handleReach`, `runOrder` is built from the plan's clone before any fact is resolved. Handler facts are
    written into handler parameters, so the snapshot has to come first.
  - A flat `position` counter advances for every node, refused handlers included.
  - Each node gets `structuredClone(runOrder.slice(0, position))` when `position <= MAX_PRECEDING_STEPS` (200).
  - `resolveNode` takes it as a sixth argument and spreads it into the resolver call only under `handleReach`. Fact
    calls never pass it.
  - The header has a new paragraph.
- `R/llm/harness-options/tests/plan-handle-reach.test.ts`: one new `describe` with 4 tests. No new file was added,
  because the folder is at 25 files. The plan used:
  - `primary`: an inherited navigation (`n0`), a handler `h1` whose `when` fact the stand-in refuses, a press `n1` that
    declares `consequences: "none"` on its parameters, and a press `n2`;
  - `later`: a press `m0`.

  The tests check:
  1. Core asks about the fact, then `n1`, `n2` and `m0`, never `n0` or `h1`. The fact call carries no
     `precedingSteps`. The three nodes get `[n0,h1]`, `[n0,h1,n1]` and `[n0,h1,n1,n2]`, with `n1` stripped of its
     declaration and handles intact.
  2. A domain that mutates its copy changes neither the plan nor the next call's copy.
  3. Without `handleReach`, no call carries the field.
  4. In a 202-press plan, node 200 gets 200 steps and node 201 gets no field.

### Domain (`C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQWebExtension/domain/src/runtime/llm-evidence/plan-resolution/`)

- `step-views/views.ts`: `followed` and the `standingIn` state are removed, and so are the resets in `captured` and
  `pressedInto`. `standing(handle, location, after)` now folds `after` per call. A press looks up `led`, a `stays` step
  keeps the current view, and a `moves` step clears it. The header is rewritten to match.
- `target-packets.ts`:
  - `WebLlmTargetPackets.followed` is removed.
  - `resolve` gains an optional fifth argument, `after?: readonly WebLlmPlanStepMove[]`. It is used only under
    `view_history`, and `inStandingView` runs only when it is given.
  - `acting`, `resolve` outside `view_history`, and `resolveOn` no longer reset anything. Each is back to HEAD's form.
  - The header and the `FlowPages` doc are updated. 764 -> 756 lines.
- `resolve-plan-node.ts`:
  - `WebPlanNodeResolutionInput` gains `precedingSteps` (documented).
  - The `resolveWebPlanNode`/`resolveNodeOnce` wrapper is reverted to HEAD's single function.
  - `Scoped` gains `after`, computed as `precedingSteps.map(webPlanStepMove(actingStep(...)))`, only under
    `view_history`. It is passed to `targets.resolve` and to the Next-page slot.
  - 799 -> 796 lines (limit 800). No split was needed.
- `next-page-slot.ts`: `resolveWebNextPageSlot` takes an optional `after` and passes it to `targets.resolve`. Under
  u1's cursor, the Next-page control resolve also saw the standing view, so this keeps that behaviour.
- **The mapping file is `domain/src/runtime/llm-evidence/tools.ts`** (`resolvePlanNodeParameters(input)`, line ~698).
  It is unchanged. It hands Core's input object whole to `resolveWebPlanNodeParameters`, typed
  `WebPlanNodeResolutionInput & { handleEvidence? }`, so the new field already passes through. There is no
  accepted-keys check on the resolver input. The repair path (`handleEvidence`) never has `handleReach`, so it gets no
  steps.
- `tests/dialog-identity.test.ts`:
  - u1's four tests now resolve each node with `precedingSteps = steps.slice(0, index)` through a new `resolveStep`
    helper. `lastStep` takes `unasked` (steps Core never asks about, which stay in later lists) and `told: false` (no
    field).
  - Test 3 now also checks that a later exploration capture does not erase what the steps say.
  - Test 4 adds a candidate sent no field after card+press, which resolves to the own page (HEAD behaviour).
  - Three new tests:
    - two plans back to back with no capture between them: the second plan's first press resolves to the own page;
    - an inherited navigation to the dish's address that Core never asks about: the press resolves to the own page,
      and an inherited cook-list navigation followed by card+press resolves to the dialog;
    - a refused handler before the press: it counts as `moves`, so the press resolves as HEAD does.
  - The scenario is u1's generic recipe site.
- `docs/architecture/build-loop.md`: u1's paragraph now describes `precedingSteps`, the bound, the absent-field rule
  and the statelessness. The remaining limit is restated: plan order is used as run order, and a handler or non-web
  node counts as moving the page.

## Commands run and observed results

- **Core tests first.** `pnpm exec vitest run .../harness-options/tests/plan-handle-reach.test.ts` before the Core
  change: `Tests 3 failed | 6 passed (9)`. For example, `expected undefined to be 200`. The "sends none" test passed
  trivially, as expected. After the change: `Tests 9 passed (9)`.
- **Domain tests first, against u1's cursor version.** u1's files were backed up to
  `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/t748/u1b-u1-version/`
  and the new tests were run before any source edit:
  `DOMAIN_TEST_BUILD_LABEL=t748-u1b node scripts/test-domain.mjs plan-resolution/tests/dialog-identity` gave
  `# pass 7`, `# fail 4`. Failing were:
  - `not ok 8`: a candidate sent no field after card+press;
  - `not ok 9`: two plans back to back;
  - `not ok 10`: an inherited navigation;
  - `not ok 11`: a refused handler.

  Each failed with `expected: 'main > article > section > div:nth-of-type(1)'` and
  `actual: 'body > div:nth-of-type(2) > article > section > div:nth-of-type(1)'`. That is, u1's cursor carried the
  dialog view over.
- `cd <Core>/packages/fluxiq && pnpm exec vitest run src/programs/automation-studio/runtime/llm/harness-options src/programs/automation-studio/runtime/recovery/annotation`:
  `Test Files 37 passed (37)`, `Tests 368 passed (368)`.
- `pnpm exec tsc --noEmit -p .` in `packages/fluxiq`:
  - First run: two errors in `flow-bootstrap/site-reset/tests/words.test.ts`, which is another worker's file being
    edited concurrently. None were in my files.
  - Rerun: 0 errors, exit 0.
- `cd D/domain && DOMAIN_TEST_BUILD_LABEL=t748-u1b node scripts/test-domain.mjs plan-resolution/tests node-run/tests`:
  `# tests 447`, `# pass 447`, `# fail 0`, `# cancelled 0`. u1 had 444; the 3 new tests account for the difference.
- Tests beside `tools.ts` that exercise the resolver (`runtime/llm-evidence/tests/reauthor-reruns-own-extraction`,
  `recovery-selector-hints`, `stable-handles`): `# tests 35`, `# pass 35`, `# fail 0`.
- `npx tsc -p tsconfig.json --noEmit`: exit 0. `npx tsc -p tsconfig.test.json --noEmit`: exit 0.
- `node scripts/structure-audit.mjs` at the downstream root:
  - First run: one `FAIL [contract-spread]` in my test, for a conditional spread of `precedingSteps`. I rewrote it as
    `precedingSteps: before?.map(...)`.
  - Rerun: `structure-audit: passed (218 warning(s), 618 baselined).`
  - `plan-resolution/` and `tests/` are still at 25 files. `resolve-plan-node.ts` is at 796 lines and
    `target-packets.ts` at 756; both are advisory warnings only.
- `node scripts/structure-audit.mjs` at the Core root: `structure-audit: passed (436 warning(s), 1152 baselined).` It
  also printed "1 baseline entries can be lowered", which is not from my files.

## Not verified

- Core was not rebuilt and no browser spec was run, per the brief. The domain compiles against the Core build it links,
  which does not yet send the field. So end to end, a live candidate submission still gets no `precedingSteps` until
  the lead rebuilds Core. Until then, the resolver behaves exactly as at HEAD (no standing view). The dialog fix is
  proven by unit tests on both sides only.
- No whole-package suites (narrow checks only).
- I did not add a runtime-level test through `createWebAutomationLlmEvidenceRuntime().resolvePlanNodeParameters`. The
  pass-through is a direct call with the same input object, and tsc checks the field's type there.

## Open questions or contradictions found

- **Handlers count as `moves`.** A handler, or any node the domain does not run, makes the next press resolve as HEAD
  does (no standing view). Under u1's cursor, a refused handler was invisible and the dialog view carried over. "Moves"
  is the safe reading, because whether a handler runs, and what it does to the page, is unknown at plan time. The lead
  may want handlers treated as `stays` instead (they run only when their fact holds). That is a one-line change in
  `step-views/move.ts`.
- **Branching Flows.** Plan order is still treated as run order. Core sends plan order, and the binding doc says so.
- **Proposed Core doc text.** I did not edit Core docs. Suggested addition wherever Core documents the
  `resolvePlanNodeParameters` seam (for example, Core's LLM evidence binding or flow-bootstrap architecture page):

  > **Steps before a candidate's node (t748 U1b).** Under `handleReach: "view_history"`, Core sends each node
  > `precedingSteps`: every Subflow's nodes before it in plan order, as the plan held them before resolution (handles
  > intact, the consequence declaration stripped), each call its own copy. The list includes the steps Core never asks
  > about (an inherited step left untouched, a handler whose page fact was refused). A page fact's target is not a step,
  > so it is in no list and is sent none. A node with more than 200 steps before it is sent none. A domain reads where
  > a node stands only from this list, never from the order of the calls. Plan order is not run order in a branching
  > Flow.
