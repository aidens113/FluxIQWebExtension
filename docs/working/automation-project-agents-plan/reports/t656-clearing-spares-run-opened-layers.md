# t656 clearing spares run-opened layers (worker report)

Branch `task/t656-clearing-spares-run-opened-layers`, worktree
`fxwork/t656/!FluxIQWebExtension`. Core untouched. Nothing committed.

## Outcome

Done. All three parts are built, and the bigbox failure from
`run-mvac0ddx-f52ba929` is reproduced in a real browser. The test fails on the
old code, which closes the picker's `×` exactly as in the debug, and passes on
the new code.

1. **The clearing spares layers the run opened.** After a click succeeds, the
   layers it opened are recorded. Neither the clearing nor the presence
   question presses them until they leave.
2. **On a missing target, only a wall is cleared.** A wall is a painted modal,
   or a layer on a scrim over the viewport centre. Both the presence question
   and the press loop use this rule.
3. **"Present but not shown" is said apart from "not found" (downstream half).**
   - The code definition carries `shown: false` for TARGET_NOT_SHOWN.
   - The result's resolution measurement carries `shown: false` too.
   - Core's record shape and category are unchanged.

## What changed and why

**New files in `apps/extension/src/content/action-runtime/interference/`**

- `run-opened.ts`: exports one object, `runOpenedLayers`, with three methods.
  - `snapshot()` lists the layers over the page with the way out each offers. If
    the page cannot be read it returns `{ readable: false }`, and then no press
    is recorded.
  - `note(control, before)` runs after a press. It records each layer that is
    new, or offers a different way out than before, and is tied to the pressed
    control. A layer is tied when any of these holds:
    - the layer holds the control;
    - the layer is inside the control's innermost shadow host;
    - the control's `aria-controls` names the layer, something inside it, or
      something around it;
    - the control says `aria-expanded="true"` and the layer is the only new
      layer sharing the deepest container with it below `<body>`. A tie names
      no layer.
  - `has(layer)` answers whether a layer is still the run's. The record is
    dropped once the layer, or the way out it offered, stops being painted, or
    once the layer offers a different way out.
  - Records are kept in a `WeakMap` keyed by layer.
  - A promotion appended to `<body>` is tied by none of the rules, so it stays
    clearable.
- `page-wall.ts`: `isPageWall(layer)`. A layer is a wall in two cases:
  - it, or an element around it, is a painted `aria-modal="true"`, or it is a
    `dialog:modal`;
  - a fixed element covers at least 90% of the viewport each way and the
    viewport centre lands in it or in the layer's fixed root. That element can
    be the layer's own fixed root or the sibling just before or after that
    root.

  A sticky header is not a wall: its box is one strip of the viewport.
- `clearable-layers.ts`: `clearableLayers(spare, scope)`, the one list that both
  the press loop and the presence question read. It is `overlaysOverPage` minus
  the step's own layer (as before), minus run-opened layers, and minus every
  non-wall when `scope` is `"walls"`.

**Changed files**

- `presence.ts`: now uses `clearableLayers(spare, "walls")`.
- `press-ways-out.ts`: `pressWaysOut(spare, scope = "any")` iterates
  `clearableLayers`.
- `clear.ts`: `clearInterference(spare, scope = "any")`.
- `index.ts`: exports `runOpenedLayers` and the type `ClearingScope`. The
  header comment is updated.
- `recovery/attempt.ts`: the default intervention passes `"walls"` for
  `target_absent`. Comments are updated.
- `content/actions/execute.ts`:
  - For `web.dom.click` only, the attempt takes a snapshot before the press.
  - It wraps `deps` with `Object.create` so it can see the element the verb
    resolved. That element is the pressed control.
  - On success it calls `runOpenedLayers.note`.
  - The intervention passes `"walls"` for a missing target.
  - `measuredShown` stamps `resolution.shown = false` when the failure code's
    definition says `shown: false`.
- `domain/src/actions/types.ts`: `WebAutomationTargetResolution.shown?: false`.
  It is a boolean, so the gateway-mapping rule that the measurement carries no
  strings still holds.
- `domain/src/runtime/failure/codes.ts`: a new definition field
  `shown?: false`, set on the `web.target.not_shown` row only. Records built
  from it do not carry it.

**Where sparing happens.** Sparing is applied in the clearing list, not inside
`overlays.ts`. `overlaysAt` (refusal classification) and the rate-limit reader
still see the run's layers. They describe what is over the page, and hiding
the run's own notice from the rate-limit reader would be wrong.

**Docs**

- `docs/architecture/web-capabilities.md`: a new paragraph under "Default
  browser recovery" on which layers are never pressed.
- `docs/architecture/failure-taxonomy.md`: a paragraph on present-but-not-shown
  and `shown: false`.

**Tests**

- `interference/tests/fake-layer.ts` gains:
  - open shadow roots, positions and boxes, and a hit test (`zonedView`);
  - `setAttribute` and element siblings;
  - `hidden` that hides descendants, and removed elements that are
    disconnected;
  - async support in `withPage`.
- `interference/tests/travel-page.ts`: a shared fixture of a travel site. Its
  sticky header holds a shadow-DOM currency picker, and a fare-alert modal is
  shown on the page's own timer.
- `interference/tests/run-opened.test.ts` (8 tests):
  - an absent-target clearing spares the run-opened flyout and still presses
    the body offer;
  - without the record, the same flyout is cleared;
  - an offer shown during the press is not tied to it;
  - the record leaves with the layer;
  - a layer that was over the page before the press is not the press's;
  - an `aria-controls` drawer that is a wall is still spared;
  - `aria-expanded` ties the menu but not a body card;
  - without `aria-expanded`, nothing beside the button is tied.
- `interference/tests/presence.test.ts` (6 tests):
  - a header flyout is a layer but no wall, and presence is false;
  - an `aria-modal` consent wall is true, and it is cleared by "Reject all";
  - a dialog on a scrim is a wall;
  - a dialog with a scrim beside it is a wall;
  - a corner card is no wall (and is still cleared for a covered target);
  - with no window, only a declared modal can be a wall.
- `actions/tests/execute.test.ts` (3 new), each through the real dispatcher and
  the real click:
  - an absent-target click after the chip click dismisses nothing, and a later
    wall is still cleared;
  - a not-shown refusal leaves the run's flyout and gets `shown: false`;
  - a not-found failure gets no `shown`.
- `domain/src/runtime/failure/tests/codes.test.ts`: the definition table now
  expects `shown: false` on not_shown. A new test checks:
  - only TARGET_NOT_SHOWN carries `shown`;
  - the category is unchanged;
  - the record has no `shown`;
  - Core's parser accepts the record.
- `apps/extension/e2e/content/tests/run-opened/tests/bigbox-store-picker-kept.spec.ts`
  (realistic scenario bigbox-retail, run headed):
  1. Reject consent and wait for the offer.
  2. The chip click clears the offer and opens the picker.
  3. The absent "No thanks" click fails with `not_found`, clears nothing, and
     leaves the picker open.
  4. The "Set as my store" press changes `storeId`. The press reloads the page,
     which can lose the reply, so site state is the oracle here.

## Commands run and observed results

All commands ran from the worktree.

**Unit tests**

- `EXTENSION_TEST_BUILD_LABEL=t656 node scripts/test-extension.mjs src/content/action-runtime/interference/ src/content/action-runtime/recovery/ src/content/actions/`
  printed `# tests 317 / # pass 317 / # fail 0`. This was the final run, after
  every change. The baseline before any change was 137/137 on the
  interference, recovery and execute subset.
- `DOMAIN_TEST_BUILD_LABEL=t656 node scripts/test-domain.mjs runtime/failure/tests client/tests/gateway-mapping`
  printed `# tests 66 / # pass 66 / # fail 0`.

**Typechecks and audit**

- Domain: `npx tsc -p tsconfig.json --noEmit` and
  `npx tsc -p tsconfig.test.json --noEmit` both printed no output (no errors).
- `node scripts/check-extension.mjs` (apps/extension) exited 0 with no output.
- `pnpm structure:check` printed
  `structure-audit: passed (201 warning(s), 639 baselined)`.
  - The first run had 2 FAILs in `run-opened.ts`: one `failure-as-empty`, one
    `swallowed-failure`. I fixed them with the explicit `{ readable: false }`
    snapshot and a `best-effort:` comment.
  - New advisory warnings: `class Fake` has 29 methods (advisory threshold 25),
    and `interference/` holds 18 files (advisory threshold 15).

**Content specs (headed)**

- `pnpm test:content -- --headed --workers=2 --reporter=line dialog-dismissal safe-clearing own-layer`
  printed `19 passed (3.1m)`. This includes company-website's "a wall over a
  target not drawn yet is still cleared" (the t174 regression).
- `pnpm test:content -- --headed --workers=1 --reporter=line run-opened`
  printed `1 passed (29.8s)`.

**Mutation checks**

- With the `note` call removed from `execute.ts`, the execute test
  "a click refused as not shown leaves the run's flyout…" fails, as intended
  (9 of 10 pass). It passed again once restored.
- With the old behaviour restored (no note, `"any"` scope everywhere), the
  bigbox spec fails. The absent "No thanks" got `clearedLayers` =
  `[{control:"Close", controlName:"×", … shadowHosts:["body > div > header > div > vr-fulfillment-picker"]}]`
  and "closing 1 dialog the page had put in the way". That is the debug's
  failure exactly. The files were restored afterwards (`diff` against the
  backup showed them identical).

## Not verified

- No Lab live run (forbidden), and no extension build or Firefox run. The
  content harness runs the content-script bundle in headed Chromium only. The
  path itself has no browser-specific code.
- The full suites (`pnpm check`, `pnpm test`) were not run, per the
  twice-a-day rule. Only touched directories and the named specs ran.
- Core's half of fix 3 (wording for `shown: false`) is not done, as briefed.
  Core still reads the measurement as a near miss.
- `recovery/attempt.ts`'s new default intervention has no test of its own. The
  production caller (`execute.ts`) always injects its own intervention, which
  is tested.

## Open questions or contradictions found

- **Where `shown: false` is written.** It is stamped in `execute.ts`, because
  the producer of gate refusals (`action-runtime/results.ts`) was not in my
  Owns. Moving it into `results.ts` `rejected()` later would be cleaner, and
  the behaviour would be the same.
- **Run-opened layers and a covered target.** A run-opened layer is spared for
  a covered target too, not only for a missing one, as the brief asked. If a
  later step's target is covered by the Flow's own open menu, the defence no
  longer closes it. The step fails `covered` and the refusal names the layer.
  Before, the defence silently closed the menu. This is the intended trade:
  the defence never undoes the Flow's state.
- **The same-shadow-host tie may over-tie.** On a page whose whole app lives in
  one shadow root, any layer that appears during a click would be tied. This
  is bounded to layers that are new during that one press.
- **Cross-directory import in tests.** `actions/tests/execute.test.ts` imports
  test support from `action-runtime/interference/tests/` (`fake-layer.ts`,
  `travel-page.ts`). The structure audit accepted it.
