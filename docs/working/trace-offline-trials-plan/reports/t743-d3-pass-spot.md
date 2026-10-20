# t743-d3-pass-spot: a loop pass's act is recorded on its own row

## Outcome

Done. Core now passes the attempt's inputs to `inspectStateDiff`. The domain uses the pass row (`item`) to place a
looped step's control in the record holding that row on the page before. Where no record holds the row, the diff
gives no spot. Without an item, the diff is unchanged.

## What changed and why

Core (C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ, `R = packages/fluxiq/src/programs/automation-studio/runtime/`):

- `R/host-runtime.ts`: the `inspectStateDiff` input type has a new optional field,
  `inputs?: Readonly<Record<string, JsonValue>>`. Its doc comment says why the field exists.
- `R/executor/host-state.ts`: `enrichAttemptWithHostState` passes `inputs: attempt.inputs` to the diff, the same
  inputs the captures already receive.
- New test `R/executor/tests/host-state/tests/diff-inputs.test.ts`. The diff receives the attempt's inputs,
  including a pass row, and still receives `{}` when the inputs are empty.

Domain (`domain/src/runtime/`):

- `host-runtime.ts` `inspectStateDiff`: passes `input.inputs?.item` to `webStateDiffPlaces`. Only this path changed.
- `state-diff/places/diff.ts`: `webStateDiffPlaces` takes an optional `item`. It scopes the node with
  `webNodeScopedToPassRow` and then resolves the spot through `webPassRowHandle`. `controls` reads `spot.place`, so
  its counts follow the resolved control. The header documents the rule.
- New `state-diff/places/target-parameters.ts`: `webNodeTargetParameters`, moved out of `node-target.ts` (now a
  user of it) so that three modules can share it.
- New `state-diff/places/scoped-node.ts`: `webNodeScopedToPassRow` applies the output-nodes barrel's
  `webAutomationScopedToRow` (the same function dispatch uses) to a web output node or to a policy action's
  `parameters`.
- New `state-diff/places/node-row-values.ts`: `webNodeRowValues` reads the scoped
  `element.context.record.values`.
- New directory `state-diff/places/pass-row/` (barrel `index.ts` exports `webPassRowHandle`). It reproduces the
  extension's `content/action-runtime/pass-row/` and `identity/record.ts` rule using capture elements. It does not
  import the extension.
  - `handle.ts`, the rule itself:
    1. If the template control is in no record, it is the same control on every pass, so the template is used.
    2. If the template's own record holds every value, the template is used.
    3. Otherwise, exactly one other record must hold every value. The control is the element at the template's
       place in that record: the same root index and child path by tag and same-tag index. It must also pass the
       copy check. In every other case there is no handle, so no spot.
  - `holds.ts`: a record holds a value when the value appears in its elements' words (name, label, text,
    whitespace-collapsed), or equals one of their attribute values, resolved links or current values (cut to 200
    characters), or is a set of joined lines (`" · "`) with every line found in the record.
  - `copy.ts`: mirrors `differsOnlyByRowData`. Tag, the template attributes (role, type, test ids, name) and the
    class set must be equal. The name must be equal or be row data, and the id must follow the same stem pattern.
    Links are deliberately not compared (see the header).
- Tests:
  - New `state-diff/places/tests/pass-row-spot.test.ts`. The site is a library catalogue with two keyed cards, each
    with a wordless reserve icon whose subject is the book.
    - The selector addresses row 1 and the item carries row 2's values: the spot's item and subject are row 2's,
      equal to row 2's own icon spot. This also holds for the policy-action node shape.
    - With no item, or an item for the build's own row, the spot is row 1's, as before.
    - An item whose record is absent, or only partly held, gives no spot.
    - On a toggle, the spot's state is row 2's, and `controls` equals the counts at that place.
  - Appended to `runtime/tests/host-runtime-places.test.ts`: a test showing that `inspectStateDiff` with
    `inputs.item` gives the pass row's item and differs from the recorded row's.

## Commands run and observed results

- `cd C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ/packages/fluxiq && pnpm exec vitest run --maxWorkers=2 --minWorkers=1 src/programs/automation-studio/runtime/executor/tests/host-state/tests/`
  -> `Test Files 2 passed (2)`, `Tests 6 passed (6)`: `diff-inputs.test.ts` 2 tests and
  `one-capture-between-steps.test.ts` 4 tests.
- `cd .../domain && DOMAIN_TEST_BUILD_LABEL=t743-d3 node scripts/test-domain.mjs runtime/tests/host-runtime-places state-diff/places`
  -> `# pass 19`, `# fail 0`: the 5 new pass-row tests, the 10 existing places tests, the 3 existing host-runtime
  places tests and the 1 new one.

## Not verified

- No typecheck was run, as the brief requires. The domain reads Core's `inspectStateDiff` input type through the
  `fluxiq` package types. If those resolve from a built Core rather than source, the domain test's `inputs` argument
  will typecheck only after Core is rebuilt.
- The structure audit was not run. I followed its rules by hand: one export per file, a barrel in the new
  directory, no shared filename prefix of 3 or more files, one statement per line, no `as never`.
- I did not check that Core's real loop attempts carry `item` in `attempt.inputs` for every route, such as candidate
  trials and the judged run. The debug note and `native-runtime.ts` say a body node receives it as an input. Nothing
  was run live.
- The new tests do not exercise the joined-lines and link-equality branches of `holds.ts`.

## Open questions or contradictions found

- The domain's rule 1 treats a control in no record as page-level. The extension also asks the DOM whether the
  as-recorded answer sits in a repeated row, which the capture cannot show. A per-row control the capture placed in
  no record therefore keeps the template's spot, as it did before this change.
- `site-reset/tests/ledger-subject.test.ts` (three looped creates, each undone on its own row) was in the debug's
  proposal but not in this brief. It was not written.
