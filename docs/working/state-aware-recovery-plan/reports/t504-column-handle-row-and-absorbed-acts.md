# t504 column-handle-row-and-absorbed-acts: worker report

## Outcome

Done. All three goals are implemented with fail-first tests, and every check the brief names passes. Two kinds of files
outside the named ownership had to change; see "Open questions". None of the changes restricts what the model may do,
and none changes whether a trial is admitted.

## What changed and why

### Goal 1: a control column's `at` names its row (domain `structure/`)

I tied `at` to its row rather than dropping it:

- The page view already prints every row's control under that row's own `- i/n` marker. Listing per-row handles in
  the packet would only repeat them, n handles per column.
- Dropping `at` from control columns would bring back the column-mapping failures that `at` was added to fix: run 38
  mapped `mutual` to the Confirm column, and round 1002-M filtered on the Delete column.
- Putting the row next to the handle makes "this is one row's control" visible at the point where the model reads
  the handle.

Changes:

- **New `structure/item-row.ts` (`webLlmItemRow`).** Given a page and a handle, it returns
  `item i/n (words)` or `row r (words)`.
  - The words come from the view lines printed in the same marker block (same region and same item, found with
    `chosenWebLlmLines`): text, image words and links. Other buttons and fields are skipped, because their words
    repeat in every row.
  - At most 2 lines are used, capped at 80 characters. If the element has no line of its own, the capture's `within`
    is used instead. With no words at all, it gives the place alone.
  - It is exported from the `structure/` barrel.
- **`structure/packet.ts`:**
  - `WebLlmStructureField` gets `atItem?: string`. It is set only when the shown element for `at` is a control line
    (`webLlmViewTraits(...).lineRole === "control"`) inside an item of a list of several items, or inside a table row.
  - Text columns carry no `atItem`, so the packet still quotes no other row's values. The D3 rule of one sample per
    column is unchanged.
  - `AT_NOTE` now says `at` is "never of the whole column", and that for a control it is "the item its atItem names
    by place and words". The old phrases that `column-at.test.ts` checks are kept.
  - The header comment records the decision and its reasons.

### Goal 2: press outcome `actedOn` (domain `node-run`)

The press-outcome module is `node-run/outcome.ts` (the `WebNodeOutcome` type) plus `node-run/press-effect/` (what an
act did). The outcome is assembled in `node-run/run.ts`, and a written step's outcome in `node-run/written-step.ts`.

- **New `node-run/press-effect/acted-on.ts` (`webNodeActedOn`).**
  - When a mutate node acts on a handle that sits in a list item, it returns:
    `This acted on item 1/3 (Ana Ruiz, Invoice for March) only, through its "Archive"; no other item was acted on.`
  - The sentence is read from the look taken before acting.
  - It imports `../../structure/item-row` directly. Importing the `structure/` barrel closed a 33-module import
    cycle, which the audit flagged.
- **`outcome.ts`:** adds `actedOn?: string`, placed before `choice` and `changed` so it is read first.
- **`run.ts`:** one import, plus `actedOn: webNodeActedOn(node, current, named)` in the outcome literal, and
  `actedOn: undefined` in the look-only literal.
- **`written-step.ts`:** `actedOn: undefined`, because `present<>` requires every key to be named.

### Goal 3: `absorbedByStartReset` (Core)

- **`site-reset/ledger.ts`, `beforeTrial` `startReset` branch.** It builds the list of acts it marks undone (only
  acts that were undoable and not yet undone, including kept ones) and returns
  `{ kind: "admit", absorbedByStartReset: [{act, did, call?}] }`.
  - The key is left out when nothing was absorbed.
  - Whether the trial is admitted is unchanged.
  - The header comment cites round 17.
- **`site-reset/contracts.ts`:** the `admit` decision gets `absorbedByStartReset?: AutomationStudioSiteResetNamedAct[]`,
  with doc comments.
- **`candidate/trial-gate.ts`:**
  - **Trial evidence:** the evidence now carries `absorbedByStartReset`, listing the acts absorbed before this trial,
    each as `{act, did, call?}`.
  - **Run record:** the gate also keeps a build-wide list (`absorbed`). The stored verdict (`verdicts`, returned by
    `standing()`, which becomes the authoring loop's `trial` result) carries every act a hook absorbed so far in the
    build. An exploration act absorbed before an earlier revision's trial is therefore still in the final record.
  - `leftOnSite` now uses the same local `namedAct` helper. Its output is unchanged.
  - The header comment records the change.
- **`candidate/contracts.ts`:** `AutomationStudioCandidateTrialResult` gets
  `absorbedByStartReset?: Array<{act; did; call?}>`. The gate sets it; it is never read from a port. `ask()` rebuilds
  the port's result, so a port cannot inject the field.

### Tests (all fixtures are generic: an inbox and a Save button)

- New `domain/.../structure/tests/control-at-item.test.ts`: 3 tests.
- New `domain/.../node-run/press-effect/tests/acted-on.test.ts`: 4 tests.
- `Core .../site-reset/tests/ledger.test.ts`:
  - The existing t479 hook test is updated. It now expects acts 1, 2, 3 and 5 to be absorbed, act-4 (an irreversible
    `send_or_publish`) not to be, and a later hook to name only act-6. An empty hook still gives `{kind:"admit"}`.
  - One new test: an absorbed exploration act is named, and an act the model already undid is not.
- `Core .../candidate/tests/trial-gate-reset.test.ts`: 2 new tests.
  - Real loop with a `prepareStart` hook: the evidence of each trial names what was absorbed, and `outcome.trial`
    carries both acts, cumulatively.
  - A hook that absorbed nothing: no key in the evidence and none in the record.

## Commands run and observed results

Fail-first:

- `DOMAIN_TEST_BUILD_LABEL=t504 node scripts/test-domain.mjs structure/tests/control-at-item press-effect/tests/acted-on`
  (in `domain/`), before the source changes: `# pass 3`, `# fail 4`.
  - Failing: tests 1, 2, 5 and 6 (the new behaviour; `atItem` was `undefined`, and the note lacked "never of the
    whole column").
  - Passing: tests 3, 4 and 7 (the negative cases).
- `npx vitest run .../site-reset .../candidate/tests/trial-gate-reset.test.ts` (in `packages/fluxiq`), before the
  source changes:
  - ledger: `2 failed | 71 passed`. Received `{ kind: 'admit' }`.
  - trial-gate-reset: `1 failed | 11 passed`. No `absorbedByStartReset` in the evidence.

After the changes:

- **New domain tests:** the same command gives `# pass 7`, `# fail 0`.
- **Domain llm-evidence tests:** `DOMAIN_TEST_BUILD_LABEL=t504 node scripts/test-domain.mjs runtime/llm-evidence` gives
  `# tests 1050`, `# pass 1050`, `# fail 0`. This includes `column-at.test.ts` with the reworded note.
- **Core tests:** `npx vitest run src/.../flow-bootstrap/site-reset src/.../flow-bootstrap/candidate` gives
  `Test Files 20 passed (20)`, `Tests 203 passed (203)`. I ran it again after the test-line fix below, with the same
  result.
- **Extra Core neighbours:** `npx vitest run .../flow-bootstrap/tests/site-reset-build.test.ts .../site-reset-irreversible.test.ts`
  gives `2 passed`, `18 passed`.
- **Core typecheck:** `pnpm run check` (in `packages/fluxiq`) exited 0. I ran it again after the last edit, and it
  exited 0 again.
- **Core dist rebuild:** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  (in Core) gave `fluxiq build: Done`. The domain check requires it: before the rebuild it refused with "Core's build
  ... is 10 minute(s) behind its source".
- **Domain typecheck (src and test):** `pnpm run check` (in `domain/`) printed `core-build: ... current with its source`
  and exited 0.
- **Downstream audit:** `pnpm structure:check` first failed with `[import-cycles]`: `acted-on.ts` imported the
  `structure/` barrel. After switching to the direct import it printed `structure-audit: passed (192 warning(s), 646 baselined)`.
- **Core audit:** `pnpm structure:check` first failed with `[statement-packing]` on my test line 195. After splitting
  that line it printed `structure-audit: passed (340 warning(s), 1159 baselined)`, plus
  "2 baseline entries can be lowered". I did not run `structure:baseline`, because the baseline is a shared file.

## Not verified

- **No live or Lab check.** I did not check that the model reads `atItem` or `actedOn` correctly in a live build.
  No Lab or provider run was made, as the brief says.
- **The Lab's run record.** I did not check whether the Lab's debug or `evaluation.json` reads the new trial-evidence
  key or the stored `trial.absorbedByStartReset`. The Lab is downstream code I did not read or edit.
- **Copies listed apart from their row.** I did not test `item-row.ts` on a page whose repeated-control copies are
  listed apart from their rows. That case falls back to `within`, and no test covers it.
- **Real pages.** I did not test a table-row (`row r`) case, or a frame detection, end to end.
- **Full suites.** No full suites were run, as the brief says.

## Open questions or contradictions found

- **Files outside the named ownership.** I changed these instead of stopping. Each change is minimal, and none
  overlaps t503's paths.
  - Domain `node-run/run.ts` and `node-run/written-step.ts`: they assemble `WebNodeOutcome`, and `present<>` makes
    every producer name each key. Goal 2 cannot be done without them.
  - Core `flow-bootstrap/candidate/contracts.ts`: one optional field on `AutomationStudioCandidateTrialResult`, so
    that the stored verdict (the build's record of its trials) can carry `absorbedByStartReset`.
  - Revert either if that is not wanted. Without `contracts.ts`, the "run record" half of goal 3 has nowhere typed
    to live inside the trial gate.
- **What "run record" means.** I took it to be the trial gate's kept result (`standing()` into the authoring
  loop's `trial`) and made it cumulative across the build. If the supervisor meant the trial run's own service
  record (`service/candidate-trial/summary.ts`, which records `startedWith`), that is a separate change outside
  this brief.
- **Trial acts are listed too.** A hook also absorbs the previous trial's own acts, which were already reported as
  `leftOnSite`, so they appear under `absorbedByStartReset` as well. Only exploration acts carry `call`, which tells
  the two kinds apart.
