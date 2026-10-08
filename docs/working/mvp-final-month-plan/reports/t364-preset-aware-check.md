# t364 preset-aware check: report

## Outcome

Done. `web.dom.check` now works on any control whose chosen state the page shows, including the preselected
Space Grey `<div>` swatch from lane A round 5. If the control is already chosen, nothing is pressed and the step
succeeds. Otherwise it is pressed once with the click gesture and the state is read back. A control that shows no
chosen state is refused with a plain sentence. Native checkboxes and radios behave as before.

## What changed and why

Extension (`apps/extension/src/content/`):
- `action-runtime/checkable-state/` (new directory; `checkable-state.ts` moved in from `action-runtime/` because that
  directory would otherwise go over the 25-file budget):
  - `checkable-state.ts`: `setCheckedState(element, checked, point?)`.
    - Checkbox or radio: unchanged. A `<label>` bound to one now sets that control.
    - Text field, dropdown or file box: still refused as `<input[type=text]> is not a checkbox or a radio`.
    - Any other control goes to `setChosenState`. A disabled control is refused first (`:disabled`, `aria-disabled`,
      or a `not-allowed` cursor, which marks a sold-out option). A control with no readable state is refused:
      "`<div>` shows no chosen state to read: it is not a checkbox or a radio, it has no aria-checked, aria-pressed
      or aria-selected, and it is not one of a row of like options drawn apart when chosen".
    - Already in the requested state: success, nothing pressed. Clearing a radio-role control or an
      `aria-selected` one is refused. Otherwise: one `dispatchClickGesture` at the point the gate checked, wait 50 ms,
      read the state back. A result that does not match the request is a failed validation, never a second press.
      Retries are left to the node retry rule; a retry is idempotent because it re-reads the state first.
  - `chosen-state.ts` (new): `readChosenState`. It checks `aria-checked` (`mixed` counts as not chosen), then
    `aria-pressed`, then `aria-selected`, then whether the control is drawn apart from its like options. That last
    test uses the snapshot's own rule, so the swatch the page view prints as `marked` is the one check finds chosen.
    A row with two members drawn apart gives no reading.
  - `index.ts` (new barrel). `tests/checkable-state.test.ts` moved here, with 8 new tests added.
- `evidence/like-options.ts` (new): the run and drawn-apart logic taken out of `set-apart.ts` so the snapshot and
  check share it. `set-apart.ts` now calls it, with the same behaviour (its existing tests pass).
  `evidence/index.ts` exports it.
- `actions/check.ts`: passes `report.point`. For a drawn control the result says "the option is chosen (drawn
  apart from the like options beside it)", with the message "Option already chosen; nothing pressed." or "Option
  chosen.". `actions/types.ts`: optional `point` on `setCheckedState`.
- `action-runtime/execute-action.ts` and `action-runtime/index.ts`: import paths only.
- `e2e/content/tests/check-chosen-option/tests/check-chosen-option.spec.ts` (new). Placed in a subfolder because
  of the same file budget. It runs on the real crossborder item page.

Domain: the `web.dom.check` description in `domain/src/actions/schemas.ts`, and the doc comment in `types.ts`.
Neither refused a non-checkbox target, so no plan-resolution change was needed.

Core: the candidate guidance in `.../flow-bootstrap/plan/flow-script-format.ts` and its test. It said to check
"the box or radio itself" and to click "a plain button with no box, radio or dropdown behind it". That is what
sent round 5's model hunting for a hidden radio. It now says to check the swatch or chip itself, never to look for
a hidden box, and to click only when the page shows no chosen state.

Docs: `docs/architecture/web-capabilities.md`, form-interaction row: new path and one sentence on chosen-state
controls.

## Commands run and observed results

- Unit tests, bundled with esbuild and run under node:test using `scratchpad/t364/run-one.mjs`:
  - Fail-first: with the HEAD `checkable-state.ts` in place, 4 passed and 7 failed. All 7 failures were new
    swatch, aria and refusal tests.
  - After the fix: `checkable-state.test.ts` + `set-apart.test.ts` + `gate-refusal.test.ts` + `execute.test.ts`
    gave `# pass 26 # fail 0`.
- Core: `npx vitest run .../plan/tests/flow-script-format.test.ts`. Before the source edit: 1 failed, 14 passed.
  After: `npx vitest run .../plan/tests/` gave 14 files and 116 tests passed.
- Core libraries rebuilt (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`): Done.
- `pnpm --filter fluxiq check` (Core typecheck): exit 0.
- `pnpm --filter @fluxiq-web-extension/extension build` (tsc, then bundles): every target verified, exit 0.
- `tsc -p apps/extension/tsconfig.test.json --noEmit` (src and e2e): exit 0.
- `pnpm --filter @fluxiq-web-extension/domain check`: exit 0.
- `node scripts/structure-audit.mjs`, downstream: passed (177 warnings, 257 baselined). The first run failed the
  directory-file budget in two directories; fixed by the moves above. Core: passed (289 warnings, 710 baselined).
- Content harness, provider-free, crossborder-marketplace, `FLUXIQ_LAB_INSTANCE=t364-preset-check
  node scripts/test-content.mjs -- check-chosen-option`: 2 passed. On the real page:
  - check on the preselected Space Grey succeeded with nothing pressed, and the label still read Space Grey.
  - check on Silver chose it; a replay pressed nothing.
  - Space Grey, 7-in-1 and Spain were all set by check, then Add to cart. The Lab's server cart became
    `Space Grey · 7-in-1 · Spain`.
  - check on Add to cart was refused `not_checkable: <div> shows no chosen state to read…` and the cart stayed
    empty.
  - On the first visit a welcome dialog covered the swatch. The defence closed it, and the result says so after
    the verdict.
- Neighbouring specs (`check-assert`, `press-answers`, `page-view-controls`, `actionability-gate`): 35 passed, 3
  failed. All 3 failures are in `actionability-gate`: the two bigbox consent-scrim check rows ("Execution context
  was destroyed", a navigation) and the inert-upload row. The same 3 fail with HEAD's `apps/extension/src` restored
  (checked by restoring and then re-applying my patch), so they were failing before this change.
- No Lab or browser processes were left running. The harness's Playwright exited.

## Not verified

- I did not run the e2e swatch spec against HEAD. Fail-first was shown at unit level only.
- No live or paid run, and no Lab flow run. The crossborder evidence comes from the T2 content harness (headless,
  real page, no background, no Core).
- I did not exercise a real page with `aria-pressed` or `aria-selected` controls, or a `<label>`-targeted check.
- Full suites were not run, per the twice-a-day rule.

## Open questions or contradictions found

- The 3 `actionability-gate.spec.ts` failures were already failing before this change. The bigbox check row now
  navigates; the consent-scrim refusal seems to be recovered by the defence instead. Someone should own them.
- "Clearing is meaningful" covers drawn-apart options: a press is tried and the read-back decides. That is true on
  crossborder, where a second press clears. On a site where it is not, `checked: false` gives a failed validation
  rather than a refusal.
- `web-capabilities.md` still says `web.dom.check` "does not use the actionability gate". That has been wrong
  since 2026-09-22 and was outside this brief.
