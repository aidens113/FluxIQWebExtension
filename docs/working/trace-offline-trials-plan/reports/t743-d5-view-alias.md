# t743-d5-view-alias: a dialog view and a standalone page at one address are two views

## Outcome

Done. The store now keeps a dialog view and a standalone page at the same address as two views. A dialog handle resolves to the dialog's control, with the dialog's context and acted identity. A handle on the standalone page resolves to that page's control, with no dialog context. If one handle was shown in both views, it resolves to the view that showed it last. The acted identity is kept per address, so each view's control keeps the identity its own first press found. When an address has only one document, it still has exactly one view.

## The cause (pre-change line numbers, `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts`)

- **Line 639, `keep`.** `flow.pages` was a `Map<location, PageTargets>`, and `keep` did `flow.pages.set(location, targets)`. So the standalone page's capture at `/dish/x` replaced the dialog view's handles at that same address.
- **Line 327, `remember`, and line 340, `rememberLook`.** Both read `before` from that one per-address entry.
- **Line 370, `acted`.** It kept only the first act per handle (`flow.acted.has(handle)`).
- **Line 458, `actedAs`.** It lent that identity only while the resolution named the same address. Once a handle named the standalone control, the identity of the press in the dialog was dropped. A press of the same handle on the standalone page was never recorded either.

## What changed and why

`target-packets.ts`: 704 lines before, 779 after.

- **Views.** `flow.pages` is now `Map<viewKey, PageView>`, where `PageView = { location, dialogs, targets }`. The new function `viewOf` picks the view a capture replaces. It replaces the existing view at its location, unless that view meets both conditions below. In that case the new capture becomes a new view beside it.
  - It holds other dialogs. A view's dialogs are the sorted set of the binding's `dialogNames`.
  - It is another document: both `navigation.timeOrigin` values are known and they differ.

  If more than one view qualifies for replacement, the newest is replaced and the others are dropped.
- **Why both conditions.** A dialog that opens and closes within one document still replaces the view, as before, and so does any view whose document is unknown. A reload with no dialog change also still replaces. So renumbering marks, view history and resubmission keep their current behaviour.
- **Per-view state.** `renumbered`, `documents` and `partial` are now keyed per view. `letGo` stays per location: a location is added only when its last view is evicted.
- **Resolution.**
  - With a location given, `resolveCurrent` uses the newest view at that location that holds the handle. A renumbering mark is reported only when no view there holds it.
  - A bare handle takes, per location, the newest view that holds it. The existing rule that different locations must agree is unchanged.
  - `resolveOnPage` checks all views at the page. It falls back to bare resolution when any view there is partial.
- **Acted identity.** `acted` is keyed by handle plus address (`actedKey`), so the first act at each address is kept. `actedAs` looks up the identity at the resolved address.
- **Header.** New section "Two documents at one address are two views (t743 D5)". The acted wording now says "the first act's at that address".

`view-history.ts`: unchanged. The view history already gives the newest view that showed a handle, and no other change was needed.

`tests/target-packets.test.ts`: four tests added, on a generic recipe site. A dish opens as a dialog over the cook's list, and the dish also has its own page at the same address.

1. **Dialog view, then the own page.** The dialog's handle `t4` resolves to the dialog's selector, with `context.dialog`, in all four ways it can be asked for: bare, with the location, through `resolveOn`, and under `view_history`. The own page's `t3` resolves with no context.
2. **A Flow step written from the dialog view.** It goes through `resolveWebPlanNodeParameters` under `view_history`. The saved step keeps the dialog's selector, `context: {dialog}`, and the name from before the press ("Save", not "Saved").
3. **One handle shown in both views.**
   - It resolves to the own page, the view that showed it last, without the dialog's acted identity.
   - After a press on the own page, it resolves with the own page's acted name.
   - After the dialog is reopened over a newly loaded list, it resolves to the dialog again, with the dialog's acted identity.
4. **One document stays one view.** A dialog that closes within one document leaves its control `unknown`, through both `resolve` and `resolveOn`. The same holds when either view's `timeOrigin` is missing.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=t743-d5 node scripts/test-domain.mjs plan-resolution/tests/target-packets` -> `# pass 27`, `# fail 0`. This was the run after two assertions in the new tests were fixed: the identity holds the name as `accessibleName`, and the node's parameters are read flat.
- **Tests first.** The same command was run with the HEAD `target-packets.ts` temporarily in place. It was copied to the scratchpad, swapped in for about a minute, then restored, and `git diff` confirmed only my edits remain. Result: `not ok 24` (dialog then own page) and `not ok 26` (handle in both views), `# pass 25`, `# fail 2`. The other two new tests pass on the old store, which is expected:
  - Test 25 resolves under `view_history`, and the history already reached a dialog-only handle.
  - Test 27 guards the behaviour that was kept.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t743-d5 node scripts/test-domain.mjs plan-resolution/tests node-run/tests` -> `# tests 444`, `# pass 444`, `# fail 0`, `# cancelled 0`.
- `node scripts/structure-audit.mjs` (downstream root) -> `structure-audit: passed (217 warning(s), 618 baselined).` The only warnings for my files are the advisory file-lines ones: `target-packets.ts` at 779 lines and `target-packets.test.ts` at 573, both under the 800-line limit. No file was added to `plan-resolution/` or its `tests/`.

## Not verified

- No typecheck, build or browser run, as the brief forbids them. The domain test runner compiles the sources it runs, and that compile succeeded.
- I did not replay the photo builder's real sequence. My first line of "Open questions" below explains why the e3 Flow would still not resolve to the dialog control.
- Whole-package domain suites were not run (narrow checks only).

## Open questions or contradictions found

- **The trace's exact Flow is still resolved to the own page.** Rule 2 of the brief says a handle shown in both views resolves to the view that showed it last. In rerun round 4 the builder named `t593` at step 8, after viewing the post's own page in steps 6 to 12. So under this change it still names the own page's control, and the Flow e3 originally wrote (profile → grid cell → `t593`) would still carry an identity with no dialog into the dialog.
  - What the change does fix: handles shown only in the dialog stay resolvable for exploration too, not only through the history. A handle last shown in the dialog keeps the dialog's identity. A press in each view keeps that view's identity.
  - The remaining gap is choosing a view from the Flow's own preceding steps. For example, resolve a step in the view its previous step opens. That needs the resolver to know which view a step stands on, which is outside this store. It is for the supervisor to decide.
- **Stable handles alias across the two views.** `../stable-handles.ts` gives the dialog's control and the own page's control one handle. It is outside my Owns. If the dialog's controls got distinct handles, the aliasing would go away entirely.
- **A named non-modal dialog can now leave a separate view behind.** An example is a banner that is present on one load and absent after a reload, where the reload is a new document. In that case the banner's handles stay resolvable for that location until the view is evicted, instead of leaving with the page.
