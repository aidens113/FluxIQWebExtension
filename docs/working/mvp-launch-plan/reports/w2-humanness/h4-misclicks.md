# W2 H4: one misclick before a press, only on a step Core marks safe

## Outcome

Done. Core marks a command `humannessMisclick: true` only when the run's humanness is above 0 and the node is known not to be lasting. The mark travels through the runtime, the gateway transport and the domain mapping. On a marked command above level 0, the click verb may make one seeded misclick on a verified-inert point beside its target before its press. Unmarked, or at level 0, the click takes today's path: the same events and points, no added await, and no added read of the page. Every test named in the brief passes, and both structure audits pass for the files this lane touched.

## What changed and why

### Core (`fxwork/t898/!FluxIQ`)

- `packages/contracts/src/client-gateway.ts`: `ClientGatewayActionCommand.humannessMisclick?: true`.
- `packages/fluxiq/src/runtime/contracts.ts`: `FluxIQRuntimeCommand.humannessMisclick?: true`.
- `packages/fluxiq/src/runtime/client-gateway-transport.ts`: copies the mark only when it is `=== true`. The gateway spreads the command onto `server.execute_action`.
- `packages/fluxiq/src/engine/automation/contracts/graph-execution-options.ts`: `humannessMisclick?: true` on the `effectDispatcher` context type, with its documentation.
- `packages/fluxiq/src/engine/automation/node-execution/attempt.ts`: `RecordCaptureTarget` now carries `node` (the execution node). The two dispatch call sites set it. The new private `misclickAllowed(options, target, effect)` feeds `effectDispatchContext(..., misclick)`, which adds `humannessMisclick: true` only when the check passes. Before this change the context was `undefined` when nothing was set, and it still is.
- `packages/fluxiq/src/framework/automation-service/io-policy.ts`: `createRuntimePolicyEffectDispatcher` copies the mark onto the dispatched command when `context.humannessMisclick === true`.
- Tests:
  - New `engine/automation/node-execution/tests/humanness-misclick.test.ts` (7 tests).
  - One added test in `framework/automation-service/tests/io-policy.test.ts`.
  - One added test in `runtime/tests/client-gateway-transport.test.ts`.

### Domain

- `domain/src/actions/types.ts`: `WebAutomationActionCommand.humannessMisclick?: true | undefined`.
- `domain/src/client/gateway-mapping.ts`: copies the mark only when `command.humannessMisclick === true`; otherwise it adds no key. No new dependency.
- `domain/src/client/tests/gateway-mapping-humanness.test.ts`: one added test covering `true`, absent, `false`, `"true"`, `1` and `null`.

### Extension

- `apps/extension/src/content/actions/click.ts`:
  - Header paragraph.
  - Import.
  - Four lines after the H3 aim: `const misclick = human && action.humannessMisclick === true ? await misclickBefore(element, action, startedAt) : "none"`. The guard is synchronous, so an unmarked or level-0 command awaits nothing.
  - On `"moved"`, the target is measured again (`measure()`). A refusal from that measure is returned as the gate's own refusal is.
  - The press then uses `report` exactly as before. File is 708 lines.
- New `apps/extension/src/content/action-runtime/humanness/misclick/` (the audit's naming rule turned the `misclick-` prefix into a directory):
  - `before.ts` (`misclickBefore`): decides and makes the misclick.
  - `chance.ts` (`misclickChance`).
  - `random.ts` (`misclickRandom`).
  - `point.ts` (`misclickPoint`).
  - `inert-point.ts` (`inertHitAt`).
  - `interactive-element.ts` (`isInteractiveElement`).
  - `open-layer.ts` (`pageHasOpenLayer`).
  - `index.ts` (barrel).
- `humanness/index.ts`: re-exports the barrel and gains a header line.
- Tests:
  - `humanness/misclick/tests/misclick.test.ts` (14 tests).
  - Test-only hand-built DOM in `humanness/misclick/tests/fake-page/` (one class per file, with a barrel).
  - `actions/tests/click/tests/misclick.test.ts` (3 click-level tests).

## The inert definition as built

A misclick is made only when **all** of the following hold. Any failure means no misclick.

1. **Page-level refusals:**
   - The page shows no robot check. This is `robotCheckIn(document.body, "page")` from `challenge-evidence.ts`, used read-only; anything it cannot read counts as a robot check.
   - Nothing is open (`open-layer.ts`), checked across open shadow roots:
     - a painted `dialog[open]`, `[role=dialog|alertdialog|menu|listbox]` or `[aria-modal="true"]`;
     - any `:popover-open` element, or, on an engine that cannot evaluate that selector, any painted `[popover]`;
     - `overlaysOverPage()` from the interference code, asked only when the target's document is the content script's own;
     - a fixed or sticky outermost ancestor covering 35% or more of the viewport at any of the interference probe points (`probePoints`).
   - Any error while reading counts as "open".
2. **The point** (`inert-point.ts`):
   - It lies inside the viewport.
   - It lies outside the target's box plus a 2 px margin.
   - The `deepElementFromPoint` hit exists. It is not `<html>`, not extension UI, and not inside the target (`composedContains`).
   - Walking the hit element and every ancestor with `composedParent` (through shadow roots), none:
     - is interactive (`interactive-element.ts`);
     - matches `dialog, [role=dialog], [role=alertdialog], [aria-modal=true], [popover]`, which covers a dialog's backdrop because the hit test answers it as the dialog;
     - is `position: fixed` or `sticky` (scrims, bars, page chrome).
3. **Interactive** (`isInteractiveElement`) means any of:
   - tag `A`, `AREA`, `AUDIO`, `BUTTON`, `CANVAS`, `DETAILS`, `DIALOG`, `EMBED`, `FRAME`, `IFRAME`, `INPUT`, `LABEL`, `MAP`, `OBJECT`, `OPTGROUP`, `OPTION`, `SELECT`, `SUMMARY`, `TEXTAREA` or `VIDEO`;
   - any ARIA control, widget or layer role (button, link, checkbox, radio, switch, tab, menu*, option, combobox, slider, spinbutton, textbox, searchbox, tree*, grid*, row, columnheader, rowheader, listbox, tablist, dialog, alertdialog, tooltip, scrollbar, radiogroup);
   - the attributes `tabindex`, `aria-haspopup`, `aria-expanded`, `aria-pressed`, `aria-checked`, `aria-selected`, `aria-controls` or `aria-owns`;
   - `draggable="true"`, `contenteditable` (not `false`) or `isContentEditable`;
   - any inline `on*` attribute;
   - a function in `onclick`, `onmousedown`, `onmouseup`, `onpointerdown`, `onpointerup`, `onauxclick`, `ondblclick` or `oncontextmenu`;
   - a computed cursor of `pointer`, `grab`, `grabbing`, `move`, `zoom-in`, `zoom-out`, `crosshair`, `cell`, `col-resize`, `row-resize` or `all-scroll`, or any `url(...)` cursor.
4. **Candidates** (`point.ts`): up to 8 tries. Each try draws an edge, a position along it, and a gap of 6 to 24 px beyond it. The first inert point is used; if none of the 8 is inert, there is no misclick.

## The chance formula

`chance = 0.08 × (level / 100)`, per marked command:

| Level | Chance |
|---|---|
| 100 | 8% |
| 50 | 4% |
| 10 | 0.8% |
| 0 | 0% (the code is never reached) |

The roll is the first draw of `misclickRandom(commandId)`, which is `humannessRandom(humannessSeedOf(commandId + "\0misclick"))`. Later draws pick the point (3 per try) and then the pause after the miss: 150 to 400 ms, fitted within the command's own time by `fitWithinCommand`. A test of 4,000 draws at level 100 lands in the expected band.

## Safety argument, line by line

- **The mark is set only above 0, on an empty declaration, on a node not marked as mutating** (`misclickAllowed`). It returns false when any of these holds:
  - `humanness` is undefined or 0 or below;
  - `metadata.declaredConsequences` is not an array, or is non-empty;
  - for the node, or for the dispatched output (payload `parameterValues` with its `metadata` laid over the node's), any of Core's own checks is true: `automationStudioNodeActLasts`, `automationStudioNodeMutates` or `automationStudioNodeExplicitLastingRisk`.

  These checks use the resolved action-effect floor, so any floor that is not `observe` refuses (`commit` and `state` are both tested). Absence of a declaration never counts as "not lasting": a missing declaration and the string `"none"` are both tested as refusals. At level 0 the context deep-equals today's `{ humanness: 0 }`. With no level and no other field, the context is `undefined`, as today.
- **Absent mark means no misclick.** The click verb checks `action.humannessMisclick === true`, and so does `misclickBefore`. Only `=== true` survives each copy step: transport, io-policy and domain mapping.
- **No misclick while any layer is open, and never on a backdrop.** See points 1 and 2 above. There is one test per layer kind (native dialog, open popover, menu, listbox, ARIA dialog, alert dialog, `aria-modal`, fixed scrim). A separate test covers the backdrop, fixed scrim, sticky band and popover hits.
- **Inert means what the brief says.** No open layer. The hit and every composed ancestor is non-interactive (link, button, label, `cursor: pointer`, `onclick` property, inline handler, `tabindex`, control role, `contenteditable` and `aria-expanded` are each tested). The point is outside the target's box and not on any other control.
- **At most one misclick, before the real press; the real press is unchanged.** `misclickBefore` dispatches exactly one gesture and is called once, before the press. The click-level test shows the marked command's target events (types and points) and validation deep-equal the unmarked command's with the same id.
- **Never on a lasting act.** Core's mark is the only gate, as above.
- **Never on robot-check pages.** `robotCheckIn` is only read; the check-wait code is untouched (tested).
- **Seeded, and H3's choices unchanged.** See the deviation below.

## Deviation from the brief, with reason

The brief said to draw "from the command's existing H3 generator, after H3's draws". I used a separate stream seeded from the same command id (`random.ts`) instead. The reason: H3 also draws lazily *after* the first press, from `aimAgain` when a press is made once more (`click.ts`). Any misclick draws taken from the shared generator before the press would therefore move that second aim. A separate stream keeps every H3 choice identical with or without the mark, and it stays reproducible from the command id.

## Other notes

- **Duplicated walk.** `open-layer.ts` needs the outermost fixed or sticky ancestor. `interference/overlays.ts` has this as `outermostFixed`, but the interference barrel does not export it, the audit refuses a reach past the barrel, and `interference/` is not mine to edit. So `open-layer.ts` carries a 10-line private copy, documented in place. Exporting `outermostFixed` from `interference/index.ts` would remove the copy.
- **The misclick counts as the action's first act.** It goes through `dispatchClickGesture`, so `actedClock` records the misclick as the action's first act on the page. Its `focusForPress` finds no focusable ancestor, because inertness excludes all of them, so focus does not move.
- **`"moved"` then refused.** If the misclick changed things and the re-measure refuses, the verb returns the rejection with `refusedBeforeDispatch: true`. The press was not made; only the inert misclick was. That is safe because the step is known not to be lasting.

## Commands run and observed results

- **Core node-execution, io-policy and transport tests:** `pnpm --filter fluxiq exec vitest run src/engine/automation/node-execution src/framework/automation-service/tests/io-policy.test.ts src/runtime/tests/client-gateway-transport.test.ts` → `Test Files 11 passed (11)`, `Tests 140 passed (140)`.
- **Transport test, re-run after the statement-packing fix:** `pnpm --filter fluxiq exec vitest run src/runtime/tests/client-gateway-transport.test.ts` → `14 passed`.
- **Core structure audit:** `node scripts/structure-audit.mjs` in Core reports `3 violation(s) across 1 rule(s)`. All three are `[imports]` in `engine/automation/pacing/{arrival-pause,humanness-seeded,trace-with-humanness}.ts`, which are another worker's files under "must not touch". Nothing from this lane remains; my statement-packing finding in the transport test is fixed.
- **Domain tests:**
  - The first run failed to load all 11 entries, because Core's `packages/contracts/dist` was half-built (subfolders stamped 19:16, no top-level `.js` files).
  - I rebuilt it with `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-h4 -- pnpm run build` in `packages/contracts`. After queueing for a slot it exited 0, logging `"contracts:build" ... stored in the shared store (1169 file(s))`.
  - Then `cd domain && DOMAIN_TEST_BUILD_LABEL=t898-h4 node scripts/test-domain.mjs client/tests/gateway-mapping` → `# tests 48`, `# pass 48`, `# fail 0`.
- **Extension content tests:**
  - `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-h4 node scripts/test-extension.mjs content/actions/tests content/action-runtime/humanness/tests content/action-runtime/humanness/misclick/tests` → `# tests 272`, `# pass 272`, `# fail 0`.
  - The first run had 3 click-level failures because the test fake lacked `document.location`. I added it to the fake, not to product code.
  - The `misclick/tests` filter was added because the audit's naming rule moved the tests there.
- **Extension structure audit:** `node scripts/structure-audit.mjs` → `structure-audit: passed (245 warning(s), 552 baselined)`.

## Not verified

- **Package typechecks** (Core `fluxiq`/`contracts`, domain, extension `tsc`): left to the supervisor as briefed. Vitest and esbuild do not type-check. The domain mapping reads `command.humannessMisclick` from `ClientGatewayActionCommand`, so it needs Core's rebuilt `.d.ts`; `contracts` is rebuilt, but `client-gateway-websocket` and `fluxiq` dist were not.
- **No live browser run.** In particular, the real `getComputedStyle` cursor inheritance, `:popover-open`, shadow-DOM hits and `overlaysOverPage` on a real page were not exercised. The unit tests use a hand-built DOM.
- **End to end.** No test sends a whole run from Core through the gateway to the content script with the mark.

## Open questions or contradictions found

- The brief's "draw from the existing H3 generator after H3's draws" conflicts with H3's lazy second-press aim (see the deviation above). I resolved it with a separate seeded stream. Confirm this is acceptable.
- Should `interference/index.ts` export `outermostFixed`, so the private copy in `open-layer.ts` can go?
- The contracts `dist` in the t898 Core worktree was left half-built by some earlier build around 19:16. I rebuilt it; whoever owns that build may want to know.
