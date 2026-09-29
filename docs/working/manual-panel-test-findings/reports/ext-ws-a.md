# ext-ws-a: Workstream A -- shared panel shell, state, copy, build

Status: DONE (wave 1). Spec: `ext-ui-audit.md` section 5 "Workstream A", section 4, section 3.
Predecessor: `ext-ui-split.md` (popup-local split, superseded mid-task; its `popup/app/**` was deleted
and the useful parts rebuilt under `panel/`).

## Outcome

Done. Both surfaces are stub pages that mount one panel UI from `apps/extension/src/panel/`. The
extraction module moved to `panel/extraction/` and builds its own DOM, keeping every id. The build emits
`index.css` per page and fails if one is missing. The copy and state modules carry the pinned contracts
and have unit tests. A placeholder simple view (status card, Start/Stop recording, extraction entry) and
a placeholder Advanced view are mounted until B and C land. Check, build, smoke and e2e (13/13) are
green. The audit and unit tests are green for every file A owns; their remaining failures are all in
files owned by D, by the extraction worker, or shared.

Two deliberate deviations from the spec, both below: the Advanced placeholder is not empty, and the
`state/` files drop their `panel-` prefix.

## Final module map (apps/extension/src/)

| Path | Owns |
| --- | --- |
| `popup/index.html`, `sidepanel/index.html` | Identical stubs: `<div id="app">`, `./index.css`, `./index.js` |
| `popup/index.ts`, `sidepanel/index.ts` | `mountPanel(root, "<surface>", placeholderViews)`; integration swaps `placeholderViews` |
| `panel/index.ts` | Barrel: store, copy, `mountPanel`, `placeholderViews`, pinned types |
| `panel/shell/contracts.ts` | Pinned types: AdvancedTab, PanelRoute, PanelSurface, PanelView, PanelViewContext, PanelViews |
| `panel/shell/mount-panel.ts` | `mountPanel`: sets `data-surface`, creates the store, header, routing, remembered route, pairing forces Simple; module map comment |
| `panel/shell/header.ts` | h1 "FluxIQ", mode switch, gear (`#settingsButton`, name "Settings") -> Advanced/Connection |
| `panel/shell/mode-switch.ts` | `role="radiogroup"` "View": Simple / Advanced, arrow/Home/End |
| `panel/shell/mode-preference.ts` | `fluxiq.ui.mode`, `fluxiq.ui.advancedTab` in chrome.storage.local, all wrapped; `routeFromStored` |
| `panel/shell/view-host.ts` | Shows the routed view, hides the other |
| `panel/shell/shell.css` | Base, surface sizing (popup 380px, side panel fills), header, buttons, cards, notices, placeholder styles |
| `panel/shell/placeholder/` | `simple-view.ts`, `advanced-view.ts`, `settings-draft.ts`, `placeholder-views.ts`, `index.ts` |
| `panel/shell/tests/mode-preference.test.ts` | Stored-route parsing |
| `panel/state/result.ts` | `PanelResult<T>` (pinned) |
| `panel/state/request.ts` | `panelRequest` never throws; undefined reply / rejected send -> restart sentence; "Unknown FluxIQ extension message." -> `unsupported: true` |
| `panel/state/store.ts` | `createPanelStore()`: one getStatus + statusChanged; a reply carrying `status` publishes it; failures never touch status |
| `panel/state/tests/store.test.ts` | 8 tests against a stubbed chrome.runtime (restored after each test) |
| `panel/copy/connection-copy.ts` | `connectionCopy` per section 4 status-card table (`paired` read via widened type) |
| `panel/copy/step-copy.ts` | `stepSentence`, `satisfies Record<BrowserActionType, ...>` so a new action type fails the build; reads `targetName`, never `target` |
| `panel/copy/error-copy.ts` | `errorSentence`, `EXTENSION_RESTARTED` |
| `panel/copy/page-hostname.ts` | hostname or undefined |
| `panel/copy/tests/copy.test.ts` | 11 tests, one assertion per table row |
| `panel/dom/create-element.ts` | `createElement(tag, options, children)`, textContent only |
| `panel/theme/tokens.css` | Light and dark tokens (L5) |
| `panel/extraction/**` | Moved from `popup/extraction/` with tests. `panel-elements.ts` -> `buildExtractionPanel(host)` DOM builder; `mountExtractionPanel(host: HTMLElement): ExtractionPanelHandle` (handle unchanged); `extraction.css` moved beside it, sheet `position: fixed` (L2) |

## What changed and why

- **Surfaces**: both pages are stubs; the side panel no longer imports the popup's entry. Deleted
  `popup/styles.css`, `sidepanel/styles.css`, the old 222-line duplicated HTML, and the superseded
  `popup/app/**`.
- **Build** (`scripts/build-extension.mjs`): `copyStatic` copies `.html` only; esbuild emits
  `index.css` beside `index.js` from the CSS the entry imports; new `assertPageStylesheets()` fails
  the build if `popup` or `sidepanel` emitted no `index.css`.
- **Smoke** (`scripts/smoke-test.mjs`): also requires sidepanel/panel/tokens files; checks both stub
  pages carry `id="app"`, `./index.css`, `./index.js`, and both entries call `mountPanel(root, "<surface>",`.
- **e2e** (`e2e/install-and-content.spec.ts`): heading "FluxIQ Recorder" -> "FluxIQ" (exact), plus the
  View radiogroup and Settings. New test "mounts the shared panel": status card copy, Connect enabled,
  Start recording disabled with visible reason, extract entry hidden and sheet closed, gear -> Advanced,
  the Lab's six settings labels visible, route remembered across reload, Close -> Simple, no page errors.
- **Docs** (`docs/architecture/extension-client.md`): new "Panel UI" section (module table, CSS per
  entry, F1 note); responsibilities bullets updated; extraction link repointed to `panel/extraction/`.
- **Defects addressed in A's files**: F1 (a failed request's sentence stays in its card; status
  renders never wipe it), E2 (undefined reply / dead worker -> "The extension restarted. Close this
  panel and open it again."; the placeholder asks once on mount so it can say so), E3 in the view
  (status-card failure notice cleared once connected; raw `lastError` is not rendered in the simple
  view), L2 (sheet fixed to viewport), L4 (surface sizing), L5 (light/dark tokens), F2 for record
  (visible reason line).
- **Decisions**:
  - Extract button keeps "Extract Data From This Page": the Lab clicks it `exact: true`
    (`ui-e2e/journeys/extraction.ts:146`), inside the range section 5 pins. Section 4's lower-case copy
    would break that journey.
  - **Advanced placeholder is not empty (deviation).** `demo-workspace/browser-session.ts:210-234`
    opens Settings, fills "Gateway URL", "Core API URL", checks "Auto reconnect", "DOM mutations",
    "Input values", "Snapshots", presses "Close", then "Connect". Every Lab session goes through it,
    so an empty Advanced view would stop every Lab run at `settings-gateway` until C lands. The
    placeholder Advanced view therefore carries those controls under their old labels and ids, plus
    Disconnect and "Reset Session" (`extension-project.ts:28-31`), and the placeholder Connect sends
    the form's settings as HEAD did (`placeholder/settings-draft.ts`). C deletes the placeholder and
    moves the journeys to the new labels together.
  - **`state/` file names (deviation).** The spec names `panel-store.ts`, `panel-request.ts`,
    `panel-result.ts`; three siblings sharing `panel-` fail the audit's prefix rule
    (`[naming] ... 3 files share the prefix "panel-"`). Renamed to `store.ts`, `request.ts`,
    `result.ts`; exported names and pinned types unchanged. Likewise the placeholders live in
    `shell/placeholder/` rather than `shell/placeholder-views.ts`.
  - `paired`/`targetName` read through widened local types, so A compiles with or without D's fields.
  - Placeholder "Nothing running" detail says "Record the steps yourself with Start recording."
    instead of section 4's "Ask FluxIQ below..." because the placeholder has no conversation card.
  - Record is disabled while a run is going ("Wait for FluxIQ to finish."), per section 4; HEAD did
    not disable it then.

## Commands run and observed results

All from `F:\!FluxIQWebExtension` unless noted; final runs after all edits.

- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0, no errors, all 5 bundles built.
  (An intermediate run failed only on `src/content/extraction/{list-reader,pagination}.ts` TS2367/
  TS2322, the extraction worker's files; they had cleared by the final run. An earlier one failed on
  D's `src/background/connection.ts(250,11)` missing `paired`, also since cleared.)
- `EXTENSION_TEST_BUILD_LABEL=ext-ws-a pnpm --filter @fluxiq-web-extension/extension test` ->
  `Extension smoke test passed.`; `# tests 912`, `# pass 908`, `# fail 4`. All 21 new panel tests
  pass. The 4 failures are not in A's files:
  `background/panel/tests/conversation-relay.test.ts` (2), `background/panel/tests/run-control.test.ts`
  (1), both D's; `content/extraction/tests/list-reader.test.ts` (1), the extraction worker's. An earlier
  run with the same label, before D's and the extraction worker's newest files, was
  `# tests 869`, `# pass 869`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension build` -> exit 0; `build\popup\index.js 222.3kb`,
  `build\popup\index.css 10.7kb`, `build\sidepanel\index.js 222.3kb`, `build\sidepanel\index.css 10.7kb`;
  `dist/{chrome,firefox}/popup` and `dist/chrome/sidepanel` each hold index.html, index.css, index.js.
- `node scripts/structure-audit.mjs` -> `structure-audit: 6 violation(s) across 3 rule(s).` None in
  A's paths: `background/connection/core-api.ts`, `background/panel/open-fluxiq.ts`,
  `background/panel/auto-connect.ts`, `background/panel/toolbar-indicator.ts` (D);
  `content/extraction/pagination.ts` (extraction worker); `docs/working/README.md` out of date
  (shared; needs `pnpm structure:baseline`). A's own four findings (docs link, page-hostname catch,
  mode-preference empty catch, `panel-` prefix) were fixed.
- `pnpm check` (root) -> exit 1 at the structure-audit step, for the violations above; the preceding
  `structure:test`, `lab:test`, `task:test` reported `# fail 0`. The later `pnpm -r check` step did not run.
- `cd apps/extension && npx playwright test -c e2e/playwright.config.ts` -> `13 passed (11.4s)`,
  including the new panel test.
- `node apps/extension/scripts/smoke-test.mjs` -> `Extension smoke test passed.`

## Not verified

- **Pair, record and extract end to end were not run live.** That needs FluxIQ Core's gateway and web
  panel running, and a Lab journey; I was not authorized to start the panel, and a Lab run must queue
  behind any campaign in flight. Covered instead by the e2e panel test against the real background,
  and by keeping every name the Lab drives. The supervisor should queue `ui-e2e/journeys/extraction.ts`
  (pair, record, extract, confirm) once wave 1 is integrated.
- Firefox popup not loaded; the 600px height budget (L3) not measured.
- Dark and light rendering not inspected visually.
- The pairing-forces-Simple rule and the placeholder's recording block/OK path are not exercised by a test.

## Open questions or contradictions found

1. Section 5 says the wave-1 Advanced view is empty, but the Lab's session setup requires the old
   settings form; resolved by the placeholder form above. The supervisor should confirm C's brief says
   to delete `panel/shell/placeholder/` and move `browser-session.ts` and `extension-project.ts` in the
   same change.
2. Section 4 writes "Extract data from this page"; the Lab and section 5 pin "Extract Data From This
   Page". B should keep the Lab's spelling or change the journey in the same workstream.
3. The spec's file names `panel-store.ts` / `panel-request.ts` / `panel-result.ts` violate the
   repository's prefix rule; B and C should import from `panel/state` (the barrel), not by file.
4. Comments in files A does not own still name `popup/extraction/`:
   `shared/extraction-messages.ts:224,266`, `background/extraction/session-store.ts:52`,
   `background/extraction/control.ts:24,349`. Comment-only; left for their owners.
5. This work ran in the main checkout on `dev`, not the task branch plus worktree section 5 asks for,
   alongside D and the extraction worker, so the check and test results above moved while I worked.
