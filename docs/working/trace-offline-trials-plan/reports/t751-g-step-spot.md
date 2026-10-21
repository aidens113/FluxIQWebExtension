# t751-g-step-spot report

## Outcome

Blocked. The failing test is written. The change itself needs a file the brief does not give me.

## What changed and why

- Added `domain/src/runtime/llm-evidence/plan-resolution/tests/step-spot.test.ts`. It is written first and fails on current code as it should.
  - Row 1: a click step whose handle is a Star toggle (`aria-pressed`) inside a row of a complete list (`aria-setsize`), on a page with an h1 and a trusted `resetResource`. It is resolved through `resolveWebPlanNode`, with a check that records each declaration's `control`. The test asserts that the declared spot (item, dialog, subject, page, scope, resource, place, state) deep-equals `webTargetSpot(binding, handle)`. The fixture produces all six required tokens, plus item.
  - Row 2: a step with no target handle declares no spot.
- No source change was made.

### Why blocked: the brief assumes something that is not true

The brief has me hand step-permission "the view binding" from "the one caller". That caller is `plan-resolution/resolve-plan-node.ts`, the only caller of `webPlanStepPermission`, and it never holds a binding. It resolves handles against `stores.targets` (`target-packets.ts`), and that store keeps only targets derived at capture (`targetsOf(binding)` -> `PageTarget`). The same is true of `view-history.ts` and `step-views/`: each keeps `PageTarget`s and a `{view, location}` (`shownIn`), never the `WebLlmSnapshotBinding`. `webTargetSpot` needs that binding: records, dialogNames, subjects, pageSubject, evidence, selectors, resetResource. The tokens can only be computed where the binding is in hand, which is `targetsOf` in `target-packets.ts`.

### The change I would make (3 files; target-packets.ts is not mine)

1. `plan-resolution/target-packets.ts` (needs ownership):
   - In `targetsOf(binding)`, add `spot: webTargetSpot(binding, element.target)` to each `PageTarget`.
   - Add `spot?` to the `ok: true` resolution, copied in `resolved()`.
   - `acrossView` already spreads the newer target, so a merged handle carries its newest view's spot. That matches `shownIn`, which is also the newest view.
   - Each step-views dialog view keeps its own capture's targets, so a step standing in a dialog gets that dialog view's spot.
   - Open choice for the supervisor: should `actedAs` (the identity "as the first act found it") also substitute the acted view's spot? That would put the pre-act state token from the view the press was made from. I would say yes for consistency with the acted identity.
2. `plan-resolution/resolve-plan-node.ts`:
   - Carry `spot` on `Resolved` from `resolveTarget`, and through the `$state` branch and `resolveRunOutput`.
   - Pass the first named target's spot to `webPlanStepPermission`.
   - A step with no handle target passes none.
3. `plan-resolution/step-permission.ts`:
   - Accept an optional `spot` input and spread its eight tokens into `control` for `webActionPermission`.
   - Header note: for a row-bound step, the tokens are those of the handle's own row as shown.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t751-g-step-spot node scripts/test-domain.mjs plan-resolution/tests/step-spot`
  - `# tests 2  # pass 1  # fail 1`.
  - Row 1 fails with `actual: {}` against expected `{ resource, item, subject, page, scope, place, state }`, all opaque `p:`/`s:`/`i:` tokens.
  - Row 2 passes on current code, as expected.
- Domain check and structure audit: not run, because there is no source change.

## Not verified

- The proposed implementation. Nothing was implemented.
- The brief's "exploration declaration unchanged" row was not added. It belongs with the implementation, and existing tests already cover it (control-spot tests, node-run).

## Open questions or contradictions found

- The brief's premise is wrong: no caller of step-permission holds a view binding. Unblocking needs ownership of `plan-resolution/target-packets.ts`, which is not on the must-not-touch list but is also not owned.
- Should an acted handle's spot come from the act's own view (`actedAs`)?

---

## 2026-10-20: t751-g2-step-spot (implementation)

## Outcome

Done. A plan step's permission declaration now carries all eight spot tokens (item, dialog, subject, page, scope, resource, place, state), taken on the view its target handle was shown in. Tests were watched failing before the change and pass after it. The tests directory is back at 25 files.

## What changed and why

- `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts` (now 797 lines; the cap is 800)
  - Every `PageTarget` keeps `spot`, computed at capture in `targetsOf`.
  - A successful resolution carries `spot` when it is nonempty, copied in `resolved()`.
  - Which view's tokens a resolution gets:
    - `acrossView` spreads the newer target, so it gets the newest view's tokens, the same view `shownIn` names.
    - A bare handle merged across pages gets the newest page's tokens.
    - A step standing in a dialog gets the dialog view's tokens, through `resolved(standing.target)`.
    - Under `view_history`, `actedAs` swaps in the tokens of the acted view, the view the saved control is taken from. This follows the decision in the brief.
  - Added a header paragraph explaining this.
  - **Changed from my proposal: it does not call `webTargetSpot` once per element.** I benchmarked that on a synthetic page of 2,021 elements in 20 complete lists. It had used more than 9 minutes of CPU without finishing the first page, and I killed it. The cause is that `webTargetSpot` rebuilds `webResetCollections(page)` on every call, and that work is O(elements × lists).
  - So the new helper `spotsOf(binding)` finds the collections once per capture. It then calls `webTargetSpot` on the binding minus `selectors` (only `webResetCollections` reads `selectors`), so every other token comes from the same function. Where a collection's scope exists, it replaces the location scope, just as `webTargetSpot` does (`collection ?? location`).
  - That `collection ?? location` rule is copied from `control-spot/target.ts`. A new test checks that every handle's stored spot deep-equals `webTargetSpot(binding, handle)`, so any drift fails.
- `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` (now 798 lines)
  - `Resolved` and the resolved `NodeOutcome` carry `spot`. It flows through `resolveTarget`, the `$state` branch (the concrete fallback handle), `resolveNode` (the first named target slot) and `resolveRunOutput`.
  - It is passed to `webPlanStepPermission`. A step with no handle passes `undefined`.
  - No new module was needed, and none could have been added: `plan-resolution/` already holds 25 source files.
- `domain/src/runtime/llm-evidence/plan-resolution/step-permission.ts`
  - New optional `spot` input. All eight tokens are written member by member into `control` for `webActionPermission`, with no spread.
  - The header now says a row-bound step declares its handle's own row as shown, and a step with no handle declares none.
- `domain/src/runtime/llm-evidence/plan-resolution/tests/plan-step-permission.test.ts`: added a generic notebook fixture and five tests.
  1. A press on a row's stateful toggle declares exactly `webTargetSpot`'s spot. The tokens contain none of the row's words, and the spot never appears in the answer Core reads.
  2. Every stored handle's spot equals `webTargetSpot` on its capture (the drift guard above).
  3. A handle exploration pressed resolves under `view_history` with the tokens of the view before the press. Exploration's own current resolution keeps the newest view's tokens.
  4. A step with no target handle declares no spot.
  5. "Exploration declaration unchanged": a call gated by its caller (`gatedByCaller`, the node-run path) makes no plan-step declaration here, so exploration's own declaration stays the only one.
- Deleted `plan-resolution/tests/step-spot.test.ts`, which was untracked; its cases are now tests 1 and 4.

## Commands run and observed results

- **Fail-first:** I restored the three source files to HEAD (`git show HEAD:<file> > <file>`), ran the tests, then put my versions back.
  - `cd domain && DOMAIN_TEST_BUILD_LABEL=t751-g2 node scripts/test-domain.mjs plan-resolution/tests/plan-step-permission`
  - Result: `# tests 17 # pass 14 # fail 3`.
  - The failures were tests 1, 2 and 3 above. Tests 4 and 5 are guard rows and pass on old code too.
- **After the change:**
  - `cd domain && DOMAIN_TEST_BUILD_LABEL=t751-g2 node scripts/test-domain.mjs plan-resolution/tests plan-resolution/step-views control-spot/tests/declared`
  - Result: `# tests 190 # pass 190 # fail 0`.
  - This covers every test in `plan-resolution/tests/` (target-packets, target-packets-look, acted-identity, dialog-identity, press-control, pressed-with-effect, resolve-plan-node, view-history, plan-step-permission and the rest), the step-views tests, and `control-spot/tests/declared.test.ts`, which tests exploration's press declaration of row, subject, place and state.
- **Domain check:**
  - `pnpm --filter @fluxiq-web-extension/domain check` was refused by its Core-build gate: "FluxIQ Core's build at ...\t751\!FluxIQ is not current with its source ... no stamp".
  - I then ran its two commands directly: `npx tsc -p tsconfig.json --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check-src.tsbuildinfo` printed nothing and exited 0, and `npx tsc -p tsconfig.test.json --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check-test.tsbuildinfo` printed nothing and exited 0.
- **Structure audit:** `node scripts/structure-audit.mjs` at the downstream root.
  - The first run found two `statement-packing` failures in my files: the line holding the `Spot` alias in resolve-plan-node.ts, and the one-line check in the test. I fixed both.
  - The rerun printed `structure-audit: passed (220 warning(s), 618 baselined)`.
  - My files appear only in advisory warnings: `plan-resolution/` and `plan-resolution/tests/` at 25 files each, and the line-count advisories.
- **Timing** (a temporary bench test, since deleted). Time for `remember()` on synthetic complete-list pages, HEAD versus this change:

  | Page | HEAD | This change |
  | --- | --- | --- |
  | 2,021 elements | 141 ms | 276 ms |
  | 3,011 elements | 86 ms | 245 ms |
  | 4,041 elements | 168 ms | 542 ms |

  For comparison, calling `webTargetSpot` once per element did not finish the first page in more than 9 minutes of CPU.

## Not verified

- Typecheck ran against Core's existing compiled dist, which the gate says is not current with Core's source.
- No live or Lab run, and no browser run.
- No end-to-end test through Core's `resolveAutomationStudioFlowBootstrapPlanParameters` with a real gate checking that the tokens arrive. The new rows drive `resolveWebPlanNode` with a recording check.
- A Next page step's control (the `nextPage` slot) still declares no spot. Its element is never resolved into `Resolved.element`, and the brief did not cover it.

## Open questions or contradictions found

- **Performance cost.** Each capture now pays for one `webResetCollections` pass plus a sha256 token per element per token kind, about +0.1 to +0.4 s on pages of 2,000 to 4,000 elements. `acted()` also re-derives every target of the `before` capture, spots included, on each act.
  - The clean fix is in `control-spot/`, which I do not own: a batch form of `webTargetSpot` that takes the collections once. That would also remove the copied `collection ?? location` rule in `spotsOf`.
  - The other option is computing tokens lazily at resolution. That would keep every binding alive as long as any of its targets is held (view history holds up to 8,192 handles per Flow), so I did not choose it.
- `target-packets.ts` (797 lines) and `resolve-plan-node.ts` (798) are now at their 800-line cap, and `plan-resolution/` is at its 25-file cap. The next change to either file will need a split by responsibility, for example into a subdirectory.
