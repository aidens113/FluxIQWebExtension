# panel-chrome (t925) report

## Outcome
Partial. All edits are written. None of the checks ran: my one queued run (`pc-vitest`) never reached the front of the heavy-slot queue.
Holders t911 and t933-port were unchanged across about 1.5 hours, with 12 labels queued. I did not run anything outside the queue. `pnpm check`, `structure-audit` and the typecheck were never queued, since the test run never started.
Every file below is unverified: no typecheck, no test run.

W = Core `apps/web/src`.

## Per item
- Sweep #2 (toast): `W/app/styles/global-foundation/04-feedback-and-status.css`, `global-responsive-certification.css`. The viewport now sits under the top bar (`--toast-top`, 56px; 96px at <=390, no longer pinned to the bottom, so it cannot cover the tab bar). It is no longer over the Account button.
  NOT DONE: plain error titles ("Notice / boom"). They come from `features/programs/components/feedback/notifyGlobalAlert.ts` and `GlobalAlertViewport.tsx`, which I may not touch.
- Sweep #8 (dev pages at 390): `12-background-tasks.css` (`.link-button` and `.summary-strip div` get `min-width: 0` and `overflow-wrap: anywhere`), `17-database-explorer.css` (`.db-grid-wrap` gets `min-width: 0; max-width: 100%`), `01-identity-and-access.css` (`.identity-user-link`), `03-docs-workspace.css` (`.docs-viewer-header` `min-width: 0`, and the kicker's `max-width`). The expected effect is no content past the viewport and no 150-390px-tall link buttons. Not seen live.
- Sweep #10 (modal footer): `15-modals-and-drawers.css`. `.modal-panel` now has `grid-template-columns: minmax(0, 1fr)`, so the footer's negative-margin rule reaches both padded edges. The gap moved from 14px to `--space-md` (12px). The cause is inferred, not confirmed live.
- Journey 9 (modal buttons 140-175px tall): `global-responsive-certification.css`. In the <=390 column, `.modal-actions > .button` gets `flex: none`.
- Sweep #11 (pairing rows): `W/app/client-pairing-modal.css` rewritten on the tokens. Rows are `align-items: baseline` and the code box is tighter.
- Sweep #4 (top bar second row at 390) and #19 (Ask button): `W/features/panel-shell/panel-shell.css`.
  - At <=720 the bar has `min-height` for two rows and the facts are `flex: 1 1 100%`, so the page no longer drops 40px.
  - The Ask button is now a full-width bar in its own grid row ("ask") above the tab bar. It is no longer a fixed round button, and the page's bottom padding is gone.
- Journey 11 (pairing name): `W/app/GlobalClientGatewayPairing.tsx`. New exported `pairingClientName` and `pairingTitle`, and the title reads "Chrome on Windows wants to connect". The "Someone is asking to connect" line and the Name row are gone. The extension already sends the label "Chrome on Windows" as the session name, so no extension change is needed.
- Journey 8 (hidden path): `W/app/product/preset/is-hidden-panel-path.ts`. `/settings/saved-logins` (and anything under it) always passes, derived from `SECURITY_TOOLS` hrefs. A test is added in `tests/is-hidden-panel-path.test.ts`.
- P1, P3, P28, E6 in `W/app/AuthShell.tsx`:
  - P1: the first-time line now reads "First time here? Open the setup link FluxIQ printed where you started it, and choose your password there. Already set up? Sign in with your username and password above."
  - P3: new `signInFailureMessage` gives two sentences, "Invalid username or credentials. 3 tries are left before sign-in locks for a while."
  - P28: sign-in already returned to the requested URL. The audit's "Home" came from sign-out going to "/". `signedOutPath` (`features/panel-shell/account/sign-out.ts`, also used by `AuthStatus`) now keeps the current page.
  - E6: the sign-in page shows "Sign in to approve the browser that is asking to connect." when the URL has `?pairing=1`.
- Tests added or edited:
  - `app/tests/AuthShell.test.tsx`
  - `app/tests/GlobalClientGatewayPairing.test.ts`
  - `app/product/preset/tests/is-hidden-panel-path.test.ts`
  - `features/panel-shell/account/tests/account.test.tsx`
  - new `features/panel-shell/tests/panel-shell-css.test.ts`
  - new `app/styles/tests/toast-and-modal-css.test.ts`
  - Possible break: `app/tests/AuthStatus.test.tsx` stubs `window.location` with only `href`. `signedOutPath` falls back to "/", so it should still pass, but that is unchecked.

## Not done, and why
- Theme follows the device on first run (journey 13). The theme is chosen in `features/settings-page/appearance` (`init-script.ts`, `parse-theme.ts`, `read-theme.ts`, `AppearanceSection`) plus `app/layout.tsx`, none of which I own. The change is: default to "system" instead of "dark" in the init script and readers, and say so in `AppearanceSection`. It is for the settings-page worker or the lead.
- Plain toast error titles (#2 second half): in `features/programs`, which I may not touch.

## Open question
The sign-in page cannot know about a waiting pairing request without a session. I used a `?pairing=1` flag, exported as `PAIRING_WAITS_PARAM`. The extension's open-FluxIQ call must add it. That is another worker's file (`background/panel/open-fluxiq.ts`, `shared/fluxiq-web-routes.ts`), so E6 does not work end to end until it does.

## Commands run and results
- `node .heavy-slots/heavy-slot.mjs run pc-vitest -- pnpm --filter @fluxiq/web exec vitest run <changed dirs>`: queued, never started, output file empty after about 1.5 hours.
- Not run: `pnpm --filter @fluxiq/web check`, `node scripts/structure-audit.mjs`.

## Not verified
Everything above: types, tests, structure audit, and all CSS effects (a live screenshot pass is still needed). Line endings: the sed and node edits normalised some CSS files to LF. Git warned about LF to CRLF, but the diffs stayed small.
