# W4-B5b: brand fixes from the real side panel review (lane t900)

Nothing committed. Paths are under `apps/extension/` unless noted.

## Outcome

Done for all six items; one limit on item 1 (see below). Acceptance run: 345 tests, 0 fail; structure audit passed.

## What changed and why

1. **Panel frame** (`src/panel/shell/shell.css`): `html` now has margin 0 and `background: var(--canvas)`, so the page itself is the panel; no
   margin, radius or border on the surface. The popup's fixed size (`html[data-surface="popup"] body`) is untouched. Limit: the light header
   and light surround seen in `chrome-real-*.png` are Chrome's own side-panel frame (defect 4 in b5a); a page cannot paint outside its own
   area, so nothing here can change them. The panel page itself fills edge to edge. Not re-captured, so unconfirmed in the real window.
   Panel rules that re-set `accent-color` (`.humanness-slider`, `.theme-choice input`) were removed; Core's tokens.css handles it. No panel
   rule touched scrollbars or `::selection`.
2. **Settings** (`src/panel/settings/`):
   a. The Permissions switches were outside `.settings-form`, so the 12px/13px rules never reached them and labels fell to the 16px body size.
      `.toggles`/`.toggle`/`.toggle label` are now general: label 13px, weight 500; hints 12px muted (`.field-hint` 11 to 12px). The slider label
      matches (13px/500).
   b. Save model: `#saveSettingsButton` keeps its id, shows "Save changes" and is hidden until something is unsaved. The save bar (draft line,
      button, "Saved." and failure notice) moved to the end of the settings column and is sticky at the bottom of the scroll. It stays visible
      after a save only to show the outcome. Appearance still applies at once. The button's accessible name stays "Save" (`aria-label`),
      because the Lab and the e2e specs press `getByRole("button", { name: "Save", exact: true })` (`browser-session.ts` and six specs);
      renaming the visible text alone would have broken them. See open questions.
   c. Slider label is "Starting humanness for new Flows and tasks" with the one line "Each Flow and task can set its own level; this is where they start."
      Binding (`#humanness`, 0-100, step 5, saved as `humanness`) unchanged.
   d. New `durability-line.ts` (exported from the barrel) and a line in the Connection group. Added `credentialDurability?: "lasting" | "browser_session" | undefined`
      to `ExtensionStatus` in `src/shared/protocol.ts`. Only `"browser_session"` shows the sentence you gave; `"lasting"` and absent show nothing.
3. **Getting started** (`src/panel/getting-started/start/step-words.ts`): step 1 now reads "FluxIQ needs to be running on this computer. Start it and keep it
   running while you use this panel. When it is running, its web page opens." The problem line says "Check that it is still running on this computer, then press
   Try again." No command, folder name or address (an existing test forbids addresses). The sign-in line was also made plainer. `steps.test.ts` updated
   (now asserts the running wording and the absence of `pnpm`/folder names). Ids and classes unchanged.
4. **Extraction** (`panel-elements.ts`, `extraction.css`): the preview table and its heading now come right after the dataset name and summary, before Pages and the
   column editor; the preview scroll box is capped at 190px so the columns stay reachable. Nothing removed.
5. **Icon** (`scripts/release/icon-png.mjs`): for sizes up to 32 a small-size variant is drawn: middle bar shortened to end at x 12.5, top bar trimmed to x 24, node moved
   to x 26.5 with radius 5 (about a quarter of the tile across), stroke half-width 2.7 at 16 and 2.4 at 32. 48 and 128 are the unchanged website mark.
   Viewed at 8x, nearest neighbour, on grey (scratch files `icon16-8x.png`, `icon32-8x.png` in the session temp folder, not in the repo): at 16 an F with a thick stem, a
   short middle stub and a top bar, then about 3 px of clear dark gap and a separate round amber dot about 4 px across at the right of the middle row. The F and dot read
   apart. At 32 the same drawing at double size, cleanly separated, with the dot clearly round. Added a release test: on the middle row there is a gap (3 px at 16, 6 px at 32)
   between the last light pixel and the first amber one, and the amber area is a quarter-tile-ish node. The 128 px amber test point needed no change.
6. **Audit**: `e2e/content/tests/screens/tests/all-screens-capture-company-website.spec.ts` unpacked to one statement per line (same calls, same order, same captures).
   `e2e/real-panel-capture.spec.ts` (also B5a tooling) failed the audit too (statement packing on 23 lines, a barrel-bypassing import, a fixed temp folder), so
   it was also fixed: statements unpacked, `installTemporaryAddon` imported from the `extension-chat-check/firefox` barrel, and the raw photograph folder is now
   `FLUXIQ_CAPTURE_RAW` or a fresh `mkdtemp` folder. Behaviour otherwise unchanged.

New test: `src/panel/settings/tests/save-model.test.ts` (Save hidden until edited, keeps its name and id, hides after save with "Saved." kept; the durability sentence only for `browser_session`).

## Commands run and observed results

- `node scripts/test-extension.mjs panel/shell/tests panel/settings/tests panel/getting-started panel/extraction release/tests panel/tests/css-tokens` -> `# tests 345  # pass 345  # fail 0`
  (an earlier run failed my own new icon test on a too-strict amber pixel count, 7 px against 12; the threshold was corrected, not the icon).
- `node scripts/structure-audit.mjs` (repo root) -> `structure-audit: passed (245 warning(s), 552 baselined).` (after fixing the two e2e specs and one packed line in my new test).
- Scratch script rendering the 16 and 32 icons, printed the 16 px pixel map and 8x PNGs; viewed both images.

## Not verified

- No type-check ran (whole-package tsc is a heavy job and the brief said not to run check-extension), so the new TypeScript (settings-view, durability-line, protocol field,
  the two e2e specs) is only proven by esbuild bundling and the tests, not tsc.
- Nothing recaptured or seen in a real browser: the frame fix, the sticky save bar, the 13px/12px scale, the preview position and the 16 px icon in the real toolbar are unseen.
- The e2e specs were not run (Playwright).
- Sticky bar offsets (negative margin to the settings padding) were reasoned, not looked at.

## Open questions or contradictions

- "Save changes" versus the Lab: the visible text is "Save changes" but the accessible name is "Save", which keeps `packages/test-runner/.../browser-session.ts` and the e2e
  specs working but is a label-in-name mismatch. Either accept it, or change those callers to `/^Save( changes)?$/` and drop the `aria-label`.
- The Lab edits an address before pressing Save, so hiding the button when clean does not affect it; any caller that presses Save with no edit would now find it hidden.
- Item 1 cannot reach Chrome's own frame (see above).
