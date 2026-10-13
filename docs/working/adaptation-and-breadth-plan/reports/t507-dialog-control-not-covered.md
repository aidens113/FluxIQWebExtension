# t507 dialog-control-not-covered: worker report

## Outcome

Done, with the brief's premise corrected. Neither refusal was a dialog's own control judged covered by its own layer. Both were real foreign covers, and the extension's covering check (`apps/extension/src/content/evidence/overlays.ts`) reported them correctly. On company-website the build died for a different reason. The domain's pre-press refusal gave the model no way to close the cover, and the page view filed the cover's controls inside the consent dialog. Those are fixed in the domain. No extension source changed.

## Evidence: what covered t317 and how it relates to the dialog

- **company-website, `run-mv6qrcln-2e194a12`, step 0008.** The refusal reads `instead: [t319]` with no `closeWith`. t319 is the chat widget's shadow host (`client/shell-script.ts` `mountChat`). That host is a 0x0 box at the bottom-right corner with `z-index:2147483000`, which is above the consent host's `2147482000` (`pages/shell.ts` `consentBanner`). The greeting card is fixed at right 16 and bottom 16, 396x152.
  - Reproduced in the content harness at 1280x720: the card spans x 868 to 1264 and y 552 to 704. The centres of Customise, Reject non-essential and Accept all are at (889, 674), (1040, 674) and (1193, 674), all inside the card.
  - So the widget is unrelated to the dialog and genuinely paints over its answers. The existing spec `company-website-layers.spec.ts` already states "the greeting opens on its timer, over the wall's buttons".
- **auction-marketplace, `run-mv6qrbgx-06151cdb`, step 0004.** "Reject all" (t114) on the cookie banner was covered by t100, the "Bid on the go" app modal, a separate modal in front of the banner. The refusal named `closeWith: [t109 "Not now"]`, and the model recovered at step 0006. That is correct behaviour.

## Cause, proved

The covering check in `overlays.ts` (`blockerAt` / `overlayRoot`) already excludes the target itself, its ancestors and its descendants across shadow roots. It also tests the visible centre within the target's scroll clips (`hitPointFor`). Nothing to fix there.

The company-website build ended because of three domain defects:

1. **`domain/src/runtime/llm-evidence/node-run/covered-target.ts`, `closersOf`.** It named no closer.
   - The greeting's "×" (name "Close") has no cursor or listener of its own. The capture omits a cursor its parent shares, and the listener sits on the card. So the "×" was not counted as pressable.
   - The card's own text "×Kes…" fails `CLOSE_WORDS`, because under `/i` the `K` after the "×" matches `[a-z]`.
   - Result: no `closeWith`.
2. **`domain/src/runtime/llm-evidence/layers.ts`, `markInsideModals`.** `inDialog` was decided by geometry alone. The widget's launcher, card and "×" sit after the sheet in document order, have their centres inside the sheet's box and are not covered. They were therefore marked `inDialog` of the consent dialog, and the view printed them under `[dialog t312]`. The model read them as the sheet's own controls.
3. **`domain/src/runtime/llm-evidence/page-view/header.ts`, `closerOf`.** The COVERING line said `close t321`, which is the card. Readable words turn "×Kes" into "× Kes", which passes `CLOSE_WORDS`. But pressing the card opens the chat panel; it does not close the greeting.

Together these explain the run: told to "close it with its own controls" and seeing none, the model repeated the same press three times.

## What changed and why

- **`layers.ts`, new `inAnotherLayer` and `reaches`.** An element whose described ancestry reaches a different cover (an element with `covers` or `coversCount`) before the modal belongs to that cover, not to the dialog, unless that cover itself sits inside the dialog. An element with no cover in its ancestry still falls back to geometry.
- **`covered-target.ts`, `closersOf`.**
  - A mark whose whole name is a closing word (`CLOSE_MARK`: ×, ✕, ✖, x, close, dismiss), inside a pressable ancestor in the same layer, counts as pressable.
  - Where one closing element holds another, the inner one is named (`innermost`).
  - **Coordinator addition (classifieds fix 7).** On a non-consent layer, a control whose whole name is a confirming word (`CONFIRM_WORDS`: apply, done, save, ok, okay, confirm, apply filter(s), save changes) is named first, ahead of the dismissing ones. It is never named on a consent layer, where "OK" consents.
- **`header.ts`, `closerOf`.** Same rules as `closersOf`, so the COVERING line names the "×" and not the card.
- **The real-cover refusal is kept.** The press under the widget is still refused, and `coveredBy` is unchanged.

Tests, each written to fail first:
- `domain/src/runtime/llm-evidence/tests/layers.test.ts`: one test, "a widget painted over a modal dialog is not inside it". The fixture is a generic consent sheet with a backdrop, a body, three answers and a help widget over them, with no scenario words.
- `domain/src/runtime/llm-evidence/node-run/tests/covered-target.test.ts`: four tests.
  - The × inside the card is the closer, and the card is not.
  - Only a mark that is a bare closing word is pressed through its card; a page "×" outside the layer is not named, and neither is a "Close the door…" paragraph.
  - Confirm first, then dismiss: [Apply, ×, Cancel].
  - "Save 20% with a plan" is not a confirming control, and a consent layer's OK is never named.
- `domain/src/runtime/llm-evidence/page-view/tests/header.test.ts`: one test, the COVERING closer is the "×", not the card.
- `apps/extension/e2e/content/tests/own-layer/tests/widget-over-consent.spec.ts`: a new content-harness spec on company-website. It waits for the greeting, captures, and builds the real domain view. It then checks four things:
  - "Reject non-essential" is covered by the widget.
  - The widget's elements carry no `inDialog`.
  - The COVERING entry for the widget names `close <×>`.
  - Pressing "×" through the content script gives `greetingDismissed: true` with consent still pending. The answer is then uncovered, and pressing "Reject non-essential" gives `consent: "essential"`.

I first put the unit tests in one new file under `llm-evidence/tests/`, but that broke two structure-audit rules (26 files against a limit of 25, and an import that bypassed a barrel). So I split the tests into the three existing files beside their subjects.

## Commands run and observed results

- **Probe** (temporary spec, since deleted): `node scripts/test-content.mjs own-layer/tests/t507-probe --workers=1` reproduced the run's view exactly, with handles renumbered (Reject is t197, the widget t199, the card t201, the "×" t202, the sheet t192):
  - `COVERING t190 "We value your privacy" consent covers 25 · t199 covers 3 close t201 "× Kes from Kestrel Lane …" · t192 "Your privacy choices" consent covers 1`
  - t200, t201, t202 and t203 had `inDialog: "t192"`.
- **Fail-first, unit tests.** With the three source files temporarily restored from HEAD, `DOMAIN_TEST_BUILD_LABEL=t507 node scripts/test-domain.mjs llm-evidence/tests/layers llm-evidence/node-run/tests/covered-target llm-evidence/page-view/tests/header` printed `# tests 27  # pass 23  # fail 4`. With the fix: `# pass 27  # fail 0`.
- **Fail-first, confirming control:** `node scripts/test-domain.mjs llm-evidence/node-run/tests/covered-target` printed `not ok 9 … names the control that keeps it first`, then 10/10 after the change.
- **Fail-first, harness spec.** With the HEAD sources, `node scripts/test-content.mjs own-layer/tests/widget-over-consent --workers=1` printed `Error: t116 is the widget's, not the sheet's (t108) … Received: "t108"` and `1 failed`.
- **Touched directories:** `DOMAIN_TEST_BUILD_LABEL=t507 node scripts/test-domain.mjs llm-evidence/tests/ llm-evidence/node-run/tests/ llm-evidence/page-view/tests/` printed `# tests 488  # pass 488  # fail 0`.
- **Domain typecheck:** `npx tsc -p tsconfig.json --noEmit` exited 0, and `npx tsc -p tsconfig.test.json --noEmit` exited 0.
- **Extension typecheck:** `node apps/extension/scripts/check-extension.mjs` exited 0. Its `tsconfig.test.json` includes `e2e/**/*.ts`, so the new spec is typechecked.
- **Extension content tests:** `node apps/extension/scripts/test-extension.mjs content` exited 0 with `# tests 1117  # pass 1117  # fail 0`.
- **Structure audit:** `node scripts/structure-audit.mjs` printed `structure-audit: passed (192 warning(s), 646 baselined)`, exit 0.
- **Headed harness:** `node scripts/test-content.mjs own-layer/tests/ --workers=2 --headed` printed `6 passed (1.3m)`: the five existing `company-website-layers.spec.ts` specs and the new one.

## Not verified

- **No Lab run, model-free or paid.** The harness spec drives the same consent sheet, greeting, "×" and Reject sequence through the real content script, but not through Core or a model. Whether the model now presses the "×" named in `closeWith` is unproved until a live run.
- **The classifieds case** (fix 7) is covered only by the generic unit test. I did not open the classifieds debug report or its run.
- **No full suites**, as the brief instructs.
- **The scrollable-body part of goal 2** was already handled by `overlays.ts` (`hitPointFor`, which clips to the visible part, and `escapedByScrolling`). I changed nothing there and added no new test for it; `clipped-controls.spec.ts` already covers it.

## Open questions or contradictions found

1. **Premise.** The brief's "a dialog's own control judged covered by its own layer" did not happen in either run. Both covers were foreign, and the extension check is right to report them.
2. **Words in `closeWith`** (coordinator addition). `closeWith` carries handles only; their words reach the model through the page view attached to the refusal. To put words in `closeWith`, or to change "press one of closeWith to close it" so it mentions a confirming control, edit `domain/src/runtime/llm-evidence/tool-rejection.ts` (`rejectionDetail`, `COVERED_NEXT_CLOSE`). I left that alone because it would have been a fourth source file.
3. **Selector collision across shadow roots** (`apps/extension/src/content/selector` `selectorFor`, used by `overlays.ts` `describeBlocker`). The greeting card's blocker selector `div:nth-of-type(2)` also matches the consent dialog in the other shadow root. The domain join (`layers.ts` `handleOf`, first match) attributes the card's blocker record to the dialog, which produces the spurious "t312 … consent covers 1". This is not fixed here.
4. **"Below the fold".** The widget host (0x0 at the viewport corner) is printed under "--- below the fold ---" in the view. This is cosmetic but misleading; the fix would go in page-view placement.
5. **Duplicated rules.** `CLOSE_WORDS`, `CLOSE_MARK`, `pressable` and the insidePressable logic now exist in both `covered-target.ts` and `header.ts`, as `CLOSE_WORDS` and `pressable` already did. A shared closer module would remove the duplication. I did not add one, because `page-view` would then import from `node-run` (which already imports page-view) and it would mean more files.
6. **The "×" is printed as plain text** (`t202 "×"`), not as a control. Its cursor and listener are its card's. `page-view-controls.spec.ts`'s rule might want it shown as a control.
