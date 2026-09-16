# x5g-recordable-actions-contract

## Outcome

**Partial.** All four edits the brief names are done, and the mutation was
observed red and reverted. **X5.4 is unblocked**: `web.dom.extract_list` is now
a legal `expected.actions` entry, so the fixtures waiting on it can land.

It is Partial for one reason: the named acceptance command does **not** pass
green. `pnpm --filter @fluxiq-web-extension/test-contracts test` is now
**91 tests, 89 pass, 2 fail** (89/89 before). Both failures are in
`packages/test-contracts/tests/scenario-validation.test.mjs`, which is not in my
"Owns" list and falls under "every other file", so I could not fix them.

The two failures are **not defects in this change** — they are two assertions
that encode the *old* contract as their expected value. The change necessarily
invalidates them. Neither the brief nor the report's X5.1 "Tests" section
(`reports/x3-x5-execution.md:801-810`, which names only
`flow-lane-exclusion.test.mjs`) assigns that file to anyone. This is the same
class of omission x5d hit, one layer down.

## What changed and why

### `packages/test-contracts/src/recordable-actions.ts` (3 of the 4 edits)

- **`:55` → `extract: ["web.dom.extract_list", "web.dom.extract"]`.** An extract
  step is now recorded as a data-extraction action rather than yielding nothing.
- **The paginated-click branch (old `:67-68`) is deleted.** `recordableActionTypes`
  no longer special-cases `extract` with `pagination`; every operation now reads
  its row straight out of `ACTIONS_BY_OPERATION`. Because `pagination` was the
  only reason the function inspected anything but `operation`, its parameter type
  narrowed from `{ operation?: unknown; pagination?: unknown }[]` to
  `{ operation?: unknown }[]`. Both callers (`validation.ts:243`,
  `flow-lane-exclusion.ts:25`) pass full steps, so both still compile unchanged.
- **The stale comment (old `:22-26`) is replaced, not merely deleted.** It
  claimed "no recording holds a `web.dom.extract`" and that a paginated extract
  "yields what a click yields" — both now false. Deleting it outright would have
  left `extract` the only operation in the list with no documentation, so it is
  now a bullet in the same list as the others, stating that pagination belongs to
  the one recorded node and therefore yields no `web.dom.click`.

I did **not** narrow `flowLaneExclusion`'s own
`Pick<ScenarioStep, "operation" | "pagination">` parameter. It still compiles,
and changing a public signature is beyond the four edits.

### `packages/test-contracts/src/flow-lane-exclusion.ts:12-15` (the 4th edit)

Comment only, as specified. It said an `extract` without `pagination` "only
reads the page, which is all W04 and W08 do". It now says only the runner's own
waits and checks (`waitForState`, `checkpoint`, `waitForDownload`) record
nothing, and that an extract records a `web.dom.extract_list` paginated or not,
so **W04 and W08 now reach the Flow lane** and their extraction is judged there.
That is the behaviour change D14 deferred to X5 and D16 counts on.

### `packages/test-contracts/tests/flow-lane-exclusion.test.mjs`

Rewritten for the new contract; 3 tests became 5 (this is the whole of the
89 → 91 test-count rise).

- `NON_ACTING` drops `"extract"`, leaving the three runner-owned waits. The
  "no Flow lane" test now uses those, since an extract-only script is no longer
  an example of one.
- **New row: W04's and W08's shapes keep a Flow lane** (`flowLaneExclusion`
  returns `undefined` for both). This is the brief's mutation target.
- The exhaustive `acting` list gains `"extract"` at the end, in
  `scenarioStepOperations` order. That `deepEqual` is the guard that makes a new
  contract operation fail until someone places it on one side.
- **New row: a paginated extract yields `web.dom.extract_list`, not a click.**
  It asserts the set is exactly `["web.dom.extract", "web.dom.extract_list"]`,
  explicitly `!has("web.dom.click")`, and that a paginated and an unpaginated
  extract yield the same two types.
  `recordableActionTypes` is **not exported from the package barrel**
  (`src/index.ts` has no `recordable-actions.js` line, and index.ts is not mine),
  so this row imports it from `../dist/recordable-actions.js`. The structure
  audit raised no finding against that import.

## Commands run and observed results

Run one at a time, never concurrently (the brief says run alone, and this
machine's RAM fault makes parallel heavy gates unreliable).

1. **`pnpm --filter @fluxiq-web-extension/test-contracts test`** —
   `# tests 91`, `# pass 89`, `# fail 2`, exit 1. Was 89/89/0.
   The 2 failures, in full:

   - `not ok 79 - an expected action that no step of its workflow's recording
     script records is rejected as a scenario defect`
     (`scenario-validation.test.mjs:189`). The path list at `:205` expects three
     issues and now gets two:
     ```
     + actual - expected
       [
     -   '$.expected.actions[1].action',
         '$.variants[0].expected.actions[0].action',
         '$.workflows[0].expected.actions[1].action'
       ]
     ```
     Its `unmeetable` fixture pins `web.dom.extract` on a workflow whose script
     **does** contain an extract step (`:194,196`), so that entry is now
     legitimately meetable. `:206` then also fails, because `issues[0]` is no
     longer the `web.dom.extract` message.

   - `not ok 80 - an expected action some step records is accepted, and a
     playback goal with no script is not judged`
     (`scenario-validation.test.mjs:211`, asserting at `:227`):
     ```
     [{"path":"$.workflows[0].expected.actions[0].action","message":"names
     web.dom.click, which no step of this workflow's recordingScript records..."}]
     false !== true
     ```
     Its `readsPages` helper (`:225`) pins `web.dom.click` on an extract-only
     workflow and expects the **paginated** case to be valid — which was true
     only because of the paginated-click branch this change deletes.

2. **`pnpm --filter @fluxiq-web-extension/test-runner build`** — exit 0, no
   diagnostics.

3. **`pnpm structure:check`** — `2 violation(s) across 1 rule(s)`, exit 1. Both
   are `[working-docs]` on the supervisor's own documents and **neither is mine**:
   `first-class-data-extraction-plan.md` is 1103 lines (over the 800-line
   compaction threshold) and `docs/working/README.md` is out of date. No
   `[file-lines]` or `[exported-values]` warning names any of my three files.
   (x5a and x5d both reported these same two.)

4. **Mutation, as the brief requires** — `extract` reverted to `[]`, leaving the
   rest of the change in place:
   `# tests 91`, `# pass 87`, `# fail 4`. **The W04 row failed**, as specified:
   `not ok 40 - W04's and W08's shapes keep a Flow lane, because an extract is
   recorded as a data-extraction action`, together with rows 41 and 42.

   Two details worth recording:
   - **`not ok 79` *passed* under the mutation.** With `extract: []` its original
     expectation holds again — direct confirmation that failure 79 is caused by
     this contract change and nothing else.
   - **`not ok 80` failed under the mutation too.** It is broken by the deleted
     paginated-click branch, not by the `extract` row, so reverting `extract`
     alone would not fix it.

5. **Restore verified by content, not by line count** (the tree holds several
   workers' uncommitted work, so no `git checkout`):
   `recordable-actions.ts:53` reads
   `extract: ["web.dom.extract_list", "web.dom.extract"],` and a grep for
   `pagination|ACTIONS_BY_OPERATION\.click` in that file returns **0**.
   Re-run: `# tests 91`, `# pass 89`, `# fail 2` — back to the pre-mutation state.

## Not verified

- **`pnpm --filter @fluxiq-web-extension/test-runner test` was not run** (build
  only, per the brief; the package is x5f's). By inspection it **will** now have
  a failure: `packages/test-runner/src/bench/tests/week1-corpus.test.ts:74-75`
  declares `const NO_FLOW_LANE_ROWS = new Set(["W04", "W08"])` — "the week1 rows
  whose workflow's script records no action". That is exactly the fact this
  change inverts, so those rows now plan with no `skipReason`. Predicted from the
  source, **not observed**.
- **No browser, no Lab, no Playwright, no bench.** Nothing here is evidence about
  a real recording: that the extension actually records an extract node as
  `web.dom.extract_list` is the X4/X5.3 seam's claim, not something this contract
  edit proves.
- **Root `pnpm check`, `pnpm test`, `pnpm build` were not run**, and no other
  consumer of test-contracts (scenario-lab, scripts) was built. Every package is
  owned by a running worker.
- I did not re-run the scenario-lab suite; I only grepped its manifests (below).

## Open questions or contradictions found

1. **`tests/scenario-validation.test.mjs` is unowned and now fails (blocking the
   acceptance command).** The brief's own "Tests" line and the report's X5.1
   Tests section both name only `flow-lane-exclusion.test.mjs`. Someone must own
   this file to get the package green. The fixes are small and I have identified
   them precisely:
   - `:205` — drop `'$.expected.actions[1].action'` from the expected path list.
   - `:206` — `issues[0]` is now the variant's `web.dom.keypress` message. To
     keep an unmeetable-extract case, pin `web.dom.extract` on the `scroll-only`
     workflow (`:200`), whose script has no extract step; it is still refused.
   - `:223-229` — invert the `readsPages` case: the paginated workflow should now
     expect `web.dom.extract_list` and be **valid**, and `web.dom.click` on an
     extract-only workflow should be **refused in both** the paginated and the
     unpaginated case. The comment at `:223` is stale.
   - `:185-187` — the doc comment ("because an extract step is the runner's own
     check") is now false.
2. **Three stale comments in files I must not touch.** Each states the contract
   this change reverses:
   - `src/validation.ts:234-236` — "W11 and W15 each pinned a `web.dom.extract`
     that no recording holds".
   - `src/scenario.ts:22-27` — "`extract` is the runner's own data-extraction
     check, never recorded as an extract action ... the extension records those
     clicks (`recordableActionTypes`)".
   - `apps/scenario-lab/src/scenarios/admin-console/tests/scenario.test.ts:232` —
     x5d flagged this one as "will become stale once X5.1 lands". It has.
3. **x5d's blocked item is now unblocked.** Per its report, add
   `actions: [{ action: "web.dom.extract_list" }]` to the `expected` of W04, and
   of the `paginated-extraction` (W05) and `in-stock-only` (W07) workflows in
   `product-catalog/manifest.ts`. Nothing else is needed.
4. **No fixture is broken in the other direction.** I grepped every
   `actions: [` in `apps/scenario-lab/src`: each workflow pinning `web.dom.click`
   beside an extract step (`data-table/scenario.ts:95`, `admin-console`,
   `auth-gate`, `basic-form`, `navigation`, `instruction-only-form`) also has a
   real click or type step in its `recordingScript`, so `web.dom.click` stays
   recordable there. Only the extract-*only* workflows lose the click, and no
   manifest pins one. Verified by grep, not by running the scenario-lab suite.
5. **`recordableActionTypes` is absent from the package barrel.** My new test
   deep-imports `../dist/recordable-actions.js`. If the supervisor would rather
   the test import from the barrel, `src/index.ts` needs an
   `export * from "./recordable-actions.js";` line — that file is not mine.
