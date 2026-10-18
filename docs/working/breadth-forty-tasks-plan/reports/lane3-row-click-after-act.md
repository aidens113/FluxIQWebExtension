# lane3-row-click-after-act

## Outcome

Done. I found the root cause in the run's own stored evidence and fixed it in the domain and the extension. Core needed no change. Narrow tests, both packages' typechecks and the downstream structure audit all pass.

## Root cause

**The For Each did hand the row over. The domain then threw it away, because the saved control carried no sign that it sat in a row.**

Evidence from the trial of `run-mvd0qwhi-5f7dbf80` (`trial.31c60545…`). I copied it read-only out of the bf-slot-3 instance store into my scratchpad:

- The candidate plan has the row edge: `s10.item -> s11.item` (For Each to "hide the suggested post").
- The click went out with `element: { tagName: "div", role: "button", accessibleName: "Hide post", classNames: [...], selector: "body > … > div:nth-of-type(3) > div:nth-of-type(9) > div:nth-of-type(2) > div:nth-of-type(2)", context: { landmark: "main" } }`. That is no `record` and no `listPosition`, and so no row `values`.
- Pass 1 resolved by `selector` (1 candidate, score 0.708). Its state diff shows it removed **"Suggested for you … Urban Growers Network … pigeons"**. That is the post the build had looked at (the old t701), not row 1 (Aisha Khan). So pass 1 already pressed the wrong row and reported success.
- Pass 2 failed with `Target ambiguous: element fingerprint matched 11 elements: div (0.71) ×5, and 6 more`. The recorded post was now the "Hidden … Undo" bar, so the positional selector missed. The class-set fingerprint then matched every `x1pycuky…` element: every post's "Hide post" plus the chat window's buttons. With no row gate they all tied.

Where the scope was decided (HEAD):

1. Core wires the row. `runtime/flow-bootstrap/authoring/draft-routing.ts:507` sends For Each's `item` to every span step whose node declares `item`. Element-target nodes declare it (`domain/src/output-nodes/definitions.ts:271`). `nodes/control-flow/for-each.ts:71` hands out `items[index]`, and `runtime/executor/node-inputs.ts` `collectWiredNodeInputs` turns the edge into `inputs.item`. This part was correct.
2. The domain decided, and dropped the row. `domain/src/output-nodes/native-runtime.ts:83` calls `webAutomationScopedToRow`. Then **`domain/src/output-nodes/targets/row-scope.ts:47`** (HEAD) returned the parameters untouched unless the element context had a `record` or a `listPosition`.
3. Why the identity had neither: `domain/src/runtime/llm-evidence/packet-fingerprint/from-packet.ts:86,89`.
   - `listPosition` comes only from the packet's `item`, which is only set for `li`/listitem/option/treeitem. A `[role=article]` card in a `[role=feed]` has none.
   - `record` comes only from `within`, which the packet publishes only on look-alikes and repeat exemplars. Here it was not carried.
   - So whether a control was row-scoped depended on what the packet happened to publish, not on the page.
4. The extension applies the gate. `content/action-runtime/resolve-target.ts` with `content/identity/record.ts` (`agreesWithRecordedRecord`, `holdsRowValues`) only ever saw a target with no row.

**Two consequences:**

- **Every pass of this kind acts on the build's own row** while that row exists.
- **Once that row changes shape, every later pass fails as ambiguous.** This happens with any action that changes the row it acts on: hide, collapse, swap to "Undo", "Request sent", and so on.

## What changed and why

The page, not the saved identity, now decides whether a control belongs to a row. A row's control is only ever pressed in the pass's own row, and that row is found by the values it holds, never by its position.

- `domain/src/output-nodes/targets/row-scope.ts`: `webAutomationScopedToRow` writes the pass's `values` onto **every** recorded element. It used to do this only when the element had a record or a list position.
  - A `key`/`text` already on the record is kept beside the values (the values still take precedence on the page). That key/text, or a `listPosition`, is what tells the page the build placed the control in a row.
  - Parameters with no `element` are still returned unchanged.
- `domain/src/actions/types.ts`: the `record.values` doc now says a record holding only values means the build never placed the control, and the page decides.
- `apps/extension/src/content/action-runtime/pass-row/` is new (`index.ts`, `resolved-for-pass.ts`). It handles a target whose record holds `values` but no `key`/`text`/`listPosition`:
  1. Resolve it as recorded, with the row taken off. If the answer sits in no repeated row (a dialog's Close, a toolbar), act on it: it is the same control on every pass.
  2. Otherwise resolve it again with the row's values as the gate. The answer is found in the pass's own row, or the step fails `web.target.not_found`. Another row's control is never pressed.
  - Targets the build did place in a row are resolved exactly as before.
- `apps/extension/src/content/identity/record.ts`: added `sitsInRepeatedRow(element)`. It returns true for a record that has a sibling of its own tag, or for a control's own row whose twin row has the same shape. It uses the same rules a recording places a record by. It is exported through `identity/index.ts`.
- `apps/extension/src/content/action-runtime/resolve-target.ts`: `resolveTarget` now goes through `resolvedForPass`. The former body is now an internal `resolution()`, and `settle` became `settled`. Both return `{ resolved } | { failed }` instead of throwing, so no catch-and-swallow was added. The file is 798 lines, under the 800 limit.

Tests changed or added:

- New: `apps/extension/src/content/action-runtime/tests/pass-row-resolution.test.ts`. It builds a synthetic feed of `[role=article]` cards in `[role=feed]`, each with a "Hide post" whose class a dialog button shares. Hiding replaces a card's contents with a notice and an Undo, and the card stays in the list. The recorded selector names row 3. It checks that:
  - each pass hides its own row, across earlier rows changing shape;
  - a row with no such control fails not_found;
  - with no row (what the live run dispatched) and the build's row hidden, the result is `web.target.ambiguous`. This reproduces the live failure.
  - a dialog control is still pressed on a pass;
  - a target the build placed in a row is gated as before.
- Updated to the new contract (the recorded key/text is kept beside the values, and an element with no record still gets values):
  - `domain/src/output-nodes/targets/tests/row-scope.test.ts`
  - `domain/src/output-nodes/tests/native-runtime.test.ts`
  - `domain/src/runtime/llm-evidence/node-run/tests/replay.test.ts` (line 160)
  - `domain/src/client/tests/gateway-mapping-identity.test.ts` (the row test)

Every file I changed:

- `domain/src/output-nodes/targets/row-scope.ts`
- `domain/src/actions/types.ts`
- `domain/src/output-nodes/targets/tests/row-scope.test.ts`
- `domain/src/output-nodes/tests/native-runtime.test.ts`
- `domain/src/runtime/llm-evidence/node-run/tests/replay.test.ts`
- `domain/src/client/tests/gateway-mapping-identity.test.ts`
- `apps/extension/src/content/action-runtime/resolve-target.ts`
- `apps/extension/src/content/action-runtime/pass-row/index.ts` (new)
- `apps/extension/src/content/action-runtime/pass-row/resolved-for-pass.ts` (new)
- `apps/extension/src/content/action-runtime/tests/pass-row-resolution.test.ts` (new)
- `apps/extension/src/content/identity/record.ts`
- `apps/extension/src/content/identity/index.ts`
- this report

## Commands run and observed results

- `EXTENSION_TEST_BUILD_LABEL=lane3-row node scripts/test-extension.mjs content/action-runtime/tests/pass-row` (apps/extension): 5 tests, 5 pass.
  - With the new rule disabled for a moment (then restored), only "a control outside every row is the same control on every pass" failed. That confirms the test pins the page-side rule.
- `EXTENSION_TEST_BUILD_LABEL=lane3-row node scripts/test-extension.mjs content/action-runtime/tests content/identity/tests content/actions/tests`: `# tests 447 # pass 447 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` (apps/extension): both exit 0.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` (domain): both exit 0.
- `DOMAIN_TEST_BUILD_LABEL=lane3-row node scripts/test-domain.mjs output-nodes/targets/tests output-nodes/tests/native-runtime runtime/llm-evidence/node-run/tests runtime/tests/carried-row` (domain): `# tests 317 # pass 317 # fail 0`. The first run had 2 replay failures (the expected record shape); I fixed them.
- `DOMAIN_TEST_BUILD_LABEL=lane3-row node scripts/test-domain.mjs client/tests runtime/llm-evidence/plan-resolution/tests`: `# tests 206 # pass 206 # fail 0`. This was after updating the gateway-mapping row test, which had failed on the newly kept `keyAttribute`/`key`.
- `DOMAIN_TEST_BUILD_LABEL=lane3-row node scripts/test-domain.mjs output-nodes/ runtime/tests/ runtime/llm-evidence/way-out-handles`: `# tests 366 # pass 364 # fail 2`. The two failures were:
  - `output-nodes/extract/tests/parameter-contract` "a wrong extract is refused…": got `bootstrap.parameter_schema_mismatch`, expected `web.extract.unknown_mode`.
  - `runtime/tests/carried-service-repair` "actual saved repair refuses missing start…": got `succeeded`, expected `failed`.
  - **Both fail the same way with `row-scope.ts` put back to HEAD** (checked, then my version restored), so this change did not cause them. They line up with other lanes' uncommitted edits in this tree (`domain/src/actions/schemas.ts`, `domain/src/client/gateway-action-parameters.ts`, and Core's `flow-bootstrap/candidate/trial-gate.ts` and plan validation).
- `node scripts/structure-audit.mjs` (downstream root): `structure-audit: passed (205 warning(s), 638 baselined)`.
- Core: no file changed, so no Core tests or audit were run.

## Not verified

- No live or browser run. The fix is proven on a synthetic stub-DOM page, not on social-network-feed in a real browser. The next live round of this scenario should show each pass hiding its own row.
- The trial trace's attempt `inputs` show `index`/`count` but no `item`. I inferred that the row arrived from the plan's `s10.item -> s11.item` edge and from `collectWiredNodeInputs`, and assumed the saved trace leaves out captured rows. Even if the row had arrived, HEAD's `row-scope.ts:47` would have dropped it, because the dispatched element had neither a record nor a list position.
- I did not trace why the saved identity for t701 lost the `within` that `describe_element` showed (a cross-view agreement, or an `acted` identity, in `plan-resolution/target-packets.ts` / `element-identity.ts`). The fix no longer depends on it.
- Check steps (`web.dom.assert`) inside a loop now always resolve through `resolveTarget` (`actions/assert.ts` `scopedToRow` sees values on every element). I did not test that path separately beyond the existing `content/actions/tests`, which pass.

## Open questions or contradictions found

- `apps/extension/src/shared/dom-element.ts` (`DomElementContext.record.values` doc) is outside my brief. It still describes values as written only for a control recorded in a row. It needs one sentence matching `domain/src/actions/types.ts`: a record holding only values means the build never placed the control, and the page decides (`content/action-runtime/pass-row/`).
- A row with no such control (here, Maya's own post with no "Hide post") now fails that pass with `web.target.not_found`. That is the same fail-closed behaviour the gate already had for rows the build placed. A Flow over a mixed list needs `extractList.where`, or an optional step, to skip such rows. No model guidance was changed.
- The old `row-scope.ts` rationale (a dialog's Close is the same control on every pass) still holds. It is now decided on the page, by whether the resolved control sits in a repeated row, instead of in the domain from the saved identity.
