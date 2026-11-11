# W4 Brand and extension UI (lane t900): sub-supervisor report

## Checkpoint 1: B1 brand tokens and fonts (2026-11-10)

### Outcome
B1 done and stable in the Core worktree `fxwork/t900/!FluxIQ`. Nothing committed. B2-B5 not started (two open scope questions below gate B2's fonts and B3's Core side).

### Interface I2 as landed (for t901 / W5 P1)
- Import `@fluxiq/ui-components/styles/tokens.css`, and `@fluxiq/ui-components/styles/fonts.css` where the host's bundler can load `.woff2` files (Geist, Geist Mono, OFL 1.1, in `src/theme/fonts/`).
- Dark brand is the default on `:root`. `<html data-theme="light">` selects the derived light theme; `data-theme="system"` follows the OS through `prefers-color-scheme`.
- Every one of the 39 old token names is kept with brand values (`--canvas` ink #0c0d0f, `--surface` panel #111214, `--divider` #23252a, `--text` #e8e6e3, `--muted` #b5b2ac, `--accent`/`--focus`/`--send` amber #f5b83d, `--success` #7fc99b, `--warning` #f5b94a, `--danger` #fa6571, ...).
- 13 new names: `--text-soft --text-dim --line --edge --accent-hover --accent-edge --accent-wash --accent-row --accent-ink --font-sans --font-mono --focus-width --focus-offset`. `--chat-font`/`--chat-mono` alias the font tokens.
- Full dark/light table and contrast ratios (every text pair at least 4.5:1 in both themes): the package README "Theme" section and `reports/w4-brand-extension-ui/b1-tokens.md`.
- Warning (#f5b94a) is almost the same hue as the accent, as the plan fixed it; warnings are told apart by their icon and wording, not colour alone.

### Worker summary
- b1-tokens (worker, Sonnet): tokens.css rewrite, fonts.css, font files, package.json export and files, README Theme section. Outcome Done. I re-ran its checks (below).
- Discovery for B3/D1 and B2/B4 (2 x Explore, Haiku): read-only; conclusions used below.

### Integration changes I made
- The worker used `light-dark()` for every colour. I checked it against the extension build: esbuild 0.24.2 passes `light-dark()` through unlowered at target chrome109, the Chrome manifest's floor is Chrome 116, and `light-dark()` needs Chrome 123 (Safari 17.5 for the hosted panel). On those browsers every colour token would be invalid. I rewrote the file as plain blocks: dark on `:root`, light under `:root[data-theme="light"]` and again under `@media (prefers-color-scheme: light) { :root[data-theme="system"] }` (scratchpad script `split-tokens.mjs`), and fixed the header comment and README to match.
- New `packages/ui-components/src/theme/tests/tokens.test.ts`: the two light copies are identical, every colour token has a light value unless it is the same in both themes (amber fill and the ink on it), and `light-dark(` does not return.

### Commands run and observed results
- `pnpm exec vitest run src/theme/tests/tokens.test.ts src/chat/view/tests/styles.test.ts` (Core ui-components) -> 2 files, 6 tests passed.
- Old vs new token names (`git show HEAD:...tokens.css` vs working file) -> missing: none; added: the 13 above.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (529 warning(s), 969 baselined).` exit 0.
- `node scripts/test-extension.mjs panel/tests/css-tokens.test.ts` (extension worktree, reading Core through the link) -> 1 test, pass 1, fail 0.
- esbuild probe: `esbuild ld.css --bundle --target=chrome109,firefox109` -> `light-dark(#fff,#000)` emitted unchanged.
- Free memory: 1.93 GB at start (no heavy run), 2.85 GB before the tests.

### Not verified
- No browser render yet (B5 does it with screenshots). Fonts are not loaded by any host yet: the extension needs a build change (question 1).
- Core `apps/web` `chat-widget-tokens.test.ts` not run; it will fail on the 13 new names until W5 P1 maps them or removes the bridge.
- Core ui-components `check` (tsc) not run: no `.ts` source changed except the new test file, which vitest compiled.

### Open questions for the lead
1. **Fonts in the extension (B2).** esbuild has no `.woff2` loader, so importing `fonts.css` fails the extension build. It needs one option in `apps/extension/scripts/build-extension.mjs` (`loader: { ".woff2": "file" }` with an asset name under the page folder). That file is not in W4's list; it already hosts the icon step W4 owns. May W4 edit it for the font loader and the new icon renderer?
2. **Rename and delete do not exist in Core (B3, I3).** Core's conversations API can create, list, read, append and answer; nothing renames a thread or removes one (status is `open|resolved`; turns are append-only). The extension also does not implement `listAllThreads`, so its thread picker is off today (and the picker is a `<select>`). I3 therefore needs Core `packages/fluxiq` changes: store and service functions, two `automation-studio` endpoints (`rename-conversation`, `delete-conversation`), their handlers, and the paired-client allowlist in `server/program-route/program-route.ts`. That is outside W4's paths and next to W5's "conversations API routes". Recommendation: W4 owns these additions (one worker-heavy, since it is data integrity) and W5 consumes them. Delete semantics recommendation: a real delete of the conversation with its turns and asks, refused while a run in that thread is still active, because a "Delete" that only hides the chat would keep recorded page data the person believes is gone. Please confirm the ownership and the semantics.
3. **D1 may already be in Core.** `ui-components/src/chat/stream/step/card-words.ts:142` already renders "Already done" for a step skipped with `reason: "already_done"` (`engine/automation/step-loop/already-done.ts` -> activity `skipped` -> `isAlreadyDoneStep`). If you saw "Done" on such a step, it came through another path, probably t898's run gate. A run id or step log where it showed "Done" would let a worker trace it rather than guess.
4. `@fluxiq/ui-components` version not bumped (it is published); bump it at your commit if Core's rules want it.

## Checkpoint 2: B2 shell, logo and icons; B3 conversation list (I3); D1; B4 settings (2026-11-10)

### Outcome
B2, B3, D1 and B4 are built and verified narrowly, with nothing committed. B5 has not started: the browser review with screenshots in the Chrome side panel and Firefox popup comes next. B4's humanness binds through a local mirror until t898 lands (see the integration notes).

### Worker summary
- **b2a-fonts-icons** (worker, Sonnet). Changed `build-extension.mjs`: `.woff2` file loader, fonts copied under each page's `assets/`. `icon-png.mjs` now draws the website mark from geometry, with strokes thickened at 32 px and below. Panel `theme/tokens.css` imports `fonts.css`. Outcome Partial: `pnpm build` was blocked by Core's currency guard while D1 was mid-edit; `build-extension.mjs` ran on its own and verified all three targets. Viewing icon16, the amber node is barely visible.
- **b2b-shell** (worker, Sonnet). New `panel/icons/logo-mark.ts` (an inline SVG mark built with DOM APIs), the top bar and `shell.css` restyled, colour literals removed from `getting-started.css` and `recording.css`. Outcome Partial: the test bundler had no `.woff2` loader (fixed by me, below). The restyle is modest; B5 reviews it on screen.
- **b3-core-conversations** (worker-heavy, Opus). Core `rename-conversation`, `delete-conversation`, `open-conversation fresh: true`, and `list-conversations` without a project (confirmed and tested).
  - Delete runs in one transaction and removes the thread, its turns, its asks and the stored mutation records owned by the thread.
  - Delete is refused with `conversation_run_active` in four cases:
    - a run is parked on one of the thread's asks;
    - chat work started from the thread is still running in this process;
    - a task attempt the thread holds is still working;
    - a run that is the thread's own subject has not ended.
  - Authorisation goes through the existing registry IAM, per project. A thread the caller may not change answers `conversation_not_found`, exactly like a missing id; there are tenant tests under the `service` profile.
  - Both endpoints are on the paired-client allowlist, narrowed to their fields. Outcome Done.
- **b3-ui-thread-list** (worker-heavy, Opus). Ports `newThread`, `renameThread` and `deleteThread` (all optional) and the conversation list component, which replaces the `<select>`:
  - New chat, search, in-place rename and delete;
  - keyboard navigation and "Show older chats";
  - `ChatThreadsOptions.layout` `"drawer" | "column"`.
  - Its styles moved to `view/thread-list/thread-list.css`, which `chat.css` `@import`s first, keeping `chat.css` under 800 lines. Outcome Done.
- **d1-already-done** (worker-heavy, Opus). Root cause, traced from run-mwbadi79-d928f922 attempt 2, step 0025: the answer-first run gate (`run-acts/run-gate.ts`) decides "already done" inside the step's executor, so its skip row arrives after the step was announced. `skippedStep` in `stream/step/messages.ts` let only three skip reasons settle an announced card and left out `already_done`. The fix: that skip now marks the announced card, and `card-words.ts` reads "Already done — not pressed again" (or "not typed again", "not opened again", "not repeated"). The reproduction tests failed before the fix (3 failed) and pass after.
- **b3-ext-relays** (worker-heavy, Opus). The extension ports and background relays:
  - `list-all` read, `open` with `fresh`;
  - new `panelConversationRename` and `panelConversationDelete`, accepted only from the panel;
  - Core's refusal sentence reaches the person (`transport/reply/thread-change-of.ts`);
  - the chat enables the drawer list;
  - the thread on screen is remembered per window in `chrome.storage.session`.
  - It split the `PanelConversation*` types into `shared/panel-conversation.ts` (protocol.ts had reached 803 lines) and rebuilt Core's libraries and domain through the slot. Outcome Done.
- **b4-settings** (worker, Sonnet). Settings regrouped: Connection, Model (key status only), Behaviour (Humanness slider 0-100, step 5), Permissions (the capture and request switches with plain lines; ids kept), Appearance (Dark default, Light, System, applied as `data-theme` from `panel/theme-choice/`), Help, then Advanced. Outcome Partial: its check-extension run predated the domain build. I re-ran it (below).

### Integration changes I made
- `apps/extension/scripts/test-extension.mjs`: `loader: { ".woff2": "empty" }`. Unit-test bundles of the panel now take its CSS with the fonts; Node never draws them. Same infrastructure category as the `build-extension.mjs` grant.
- Core `packages/ui-components/package.json` `files`: added `src/chat/view/thread-list/thread-list.css`, the sheet `chat.css` imports. No version bump; the new ports are optional additions.
- `docs/architecture/extension-client.md`: a "conversation list" paragraph and a message-to-endpoint table.
- A regression I caught on re-run: with the list on, the shell test "a followed run of another automation shows its steps" found the composer saying "Chat unavailable". B3-fix (worker-heavy, Opus) traced it.
  - Cause: Core's list mode gated a latest chat with no project as having nowhere to send (`chat-threads.ts` `nowhere()`). The extension switched that gate on by passing `unavailableReason`, though its background finds the session's project when the message is sent.
  - It also deadlocked: the read the gate skipped is the one that makes the background pick up a project.
  - Fix: `ChatThreadsOptions.unavailableReason` is now optional and only gates when given; the extension leaves it out and the web panel keeps it. New tests on both sides fail without the fix. I documented the choice in the Core README and `extension-client.md`.

### Commands run and observed results (mine, after all workers)
- Core ui-components, slot: `pnpm exec vitest run src/chat src/theme` -> 106 files, 706 tests passed (before B3-fix). B3-fix then re-ran `src/chat/threads src/chat/tests src/chat/view/thread-list src/chat/conversation` -> 48 files, 321 passed, and rebuilt dist (`pnpm build` exit 0).
- Extension: `node scripts/test-extension.mjs panel/shell/tests panel/chat panel/settings/tests panel/theme-choice/tests panel/tests/css-tokens release/tests` -> 1 failed of 132 before B3-fix; after it, 209 tests, 209 pass, 0 fail.
- Extension: `node scripts/test-extension.mjs background/panel/tests shared` -> 117 tests, 117 pass, 0 fail.
- Core fluxiq: `pnpm exec vitest run` on thread-changes, conversations, domain-scope, conversation-changes and program-route tests -> 5 files, 66 tests passed.
- `node scripts/structure-audit.mjs` -> Core `passed (529 warning(s), 969 baselined).`; extension `passed (245 warning(s), 552 baselined).`
- Free memory before the runs: 3.2-3.4 GB.

### Not verified
- No browser render of any screen yet: shell, logo, fonts, conversation drawer, settings, theme switching, Firefox popup. That is B5.
- No live call against a real Core over a paired token (rename, delete, fresh open, list-all).
- Core `apps/web` was not run. Its `e2e/chat-widget.spec.ts` (lines 62-66, 136-143) still picks threads through the removed `<select>` (combobox "Thread") and will fail. Its `route.test.ts` allowlist does not exercise the two new endpoints. Both are W5's.
- Core fluxiq whole-package tsc was run by B3-core (exit 0); nothing in fluxiq changed after it, so I did not re-run it.

### Open questions and hand-offs for the lead
1. **For W5 (apps/web):** update `e2e/chat-widget.spec.ts` to the list. Click the "Chats" button, then `.chat-thread-row[data-conversation-id] .chat-thread-open`. Add the two endpoints to `route.test.ts`. The panel keeps passing `unavailableReason`, and may use `layout: "column"`.
2. **For W1 (answer-first lanes):**
   - `run-acts/run-gate.ts:188`, the run gate's path for Core's own nodes, names the output id, not the node id. Such a card would still read "Done". Fix by naming the node, or by having the engine mark the attempt as skipped the way `already-in-state.ts` does; that would also put the skip on the run's record, which today shows a plain success.
   - The answer-first locator (`answer-first/attempt-store/locator.ts`) keeps entries for deleted threads, so "Open in chat" can point at a deleted chat. It needs a "forget thread" operation.
3. **Delete has no PIN.** It is classified `authoring`, like `delete-flow`, as the no-PIN rule and the token allowlist require.
4. **Refusal codes are dropped in the extension.** `core-api.ts` and `panel/state/request.ts` keep codes only for authority errors, so `conversation_run_active` arrives as a failure carrying Core's sentence; the person sees the right words, but no code reaches the panel. Owner: whoever owns `background/connection` and `panel/state`. Not changed.
5. **Humanness binds through a mirror.** The slider binds `FluxIQSettings.humanness` through `panel/settings/humanness/` with a local type and bounds in `limits.ts`. When t898 lands in this lane, I swap `limits.ts` to import `HUMANNESS_MIN/MAX/DEFAULT` from `@fluxiq/contracts` and drop the local type.
6. **Paths outside the original list that this checkpoint touched:**
   - `apps/extension/scripts/test-extension.mjs` (`.woff2` empty loader).
   - `apps/extension/src/shared/{constants.ts, protocol.ts, panel-conversation.ts}`: two message names, and the `PanelConversation*` types moved to a new file because of protocol.ts's 800-line limit.
   - `apps/extension/src/background/panel/**` (the relays, granted for I3).
   - `docs/architecture/extension-client.md`.
   - Core `ui-components/src/chat/stream/**` (D1).
7. **Slot tool defect** (B3-fix observed it): a waiting `heavy-slot.mjs run` lost its queue ticket while still alive and would have waited forever (line 78 never re-creates a missing ticket). Its likely cause is another lane's `alive()` judging the pid dead. The new fair queue may differ; worth a look.
8. **Small icon:** at 16 px the amber node is barely visible. B5 judges it on the real toolbar.

## Checkpoint 2b: answers require a person's activation (SEC1, from W6's finding)

### Outcome
Done in code, with one end-to-end gap. Two of the three gates are verified by me. The Lab's trusted press is proven in the real Chrome side panel by a probe; the end-to-end ask check did not reach the press (see below).

### What changed
- **Extension transport.** In `apps/extension/src/panel/chat/transport/ports/conversation.ts`, `answer` sends only while `navigator.userActivation.isActive` (`person-activation.ts`). The check is read before the first await. When it fails, or when `userActivation` is absent (fail closed), the panel sends nothing and the person sees "Press the answer yourself to give it." The result carries no `code`, so Core's "refused this browser" fallback is not triggered. This is the only place the panel sends `panelConversationAnswer`. Reads and sends are not gated.
- **Firefox.** It supports `navigator.userActivation` from version 120 with no flags (MDN browser-compat-data `api/Navigator.json` and `api/UserActivation.json`). The extension's floor is Firefox 128, so no substitute is needed. Not checked in a live Firefox popup.
- **Core ui-components.** `chat/conversation/person-event.ts` gives `isPersonEvent` (`event.isTrusted === true`), used in:
  - `ask-controls.ts` (choice buttons, the Answer button, Enter);
  - `presented-ask.ts` (every action button, Send answer, Enter).
  - `testing/fake-dom.ts`: `dispatch` is trusted by default; new `dispatchUntrusted()`, and `click()`, which is untrusted like `HTMLElement.click()`.
- **Lab driver.** The answering press is in `packages/test-runner/src/extension-chat-check/panel-driver.ts`, not in `attempt-lane/live/`: `attempt-person.ts`, `chat-entry.ts` and `prove/ask-answered.ts` call it. I took the grant to mean that file, because a Chrome Lab run could not answer without it. `press` now goes through a CDP session to the side panel's own target (new `view-target-press/`): it finds the button, then sends `Input.dispatchMouseEvent` move, press and release at its centre, and confirms the click arrived trusted and with activation. If not, it throws instead of pressing twice. Firefox and any path with a real Page already used `locator.click()`.

### Commands run and observed results
- Mine: Core `pnpm exec vitest run src/chat/conversation/tests/ask-controls-keyboard.test.ts src/chat/conversation/tests/presented-ask.test.ts` -> 2 files, 21 tests passed.
- Mine: `node scripts/test-extension.mjs panel/chat/transport/tests panel/chat/tests` -> 30 tests, 30 pass, 0 fail. These include a script click on Allow sending nothing, inactive or absent activation sending nothing, and a press with activation being sent.
- SEC1: Core `src/chat src/screens src/testing` -> 794/794 passed; Core `pnpm build` (slot) exit 0.
- SEC1b:
  - `panel-driver-press` and `panel-driver` tests -> 7 pass;
  - `test-runner:build` (slot) exit 0;
  - probe in the real Chrome side panel on social-network-feed, with no Core and no model: a script click arrived `{isTrusted:false, activation:false}`; the driver's press arrived `{isTrusted:true, activation:true}` in 32 ms.
- Extension `node scripts/check-extension.mjs` (slot) -> CHECK_EXIT=0. It ran after B3-fix and B4 but before SEC1's edits; SEC1 ran a typecheck of its touched files (exit 0).

### Not verified, and open items
- **End-to-end ask in Chrome.** The provider-free ask check (`--browser chrome --scenario social-network-feed`) stopped before the press. Core refused its saved approval Flow ("Write active instructions in this automation's Instructions before running or building it"), a pre-existing defect in `extension-chat-check/approval-flow.ts` (`saveApprovalFlow`), outside W4. Your Lab run that answers through the panel is the end-to-end proof; the ask check needs that fix to run again.
- `open-chrome-session.ts:65` still says the driver presses Yes with `HTMLElement.click()`. The wording is stale and the file is outside the grant.
- Script clicks remain where nothing answers an ask:
  - `panel-controls.ts:74` (recording);
  - `person-simulation/panel-run-control.ts:295` (run controls);
  - `press-run-again.ts:39`.
  - If run controls should also require activation later, these move to the same trusted press.
- Commit message suggestion: "Answers require a person's activation".

## Checkpoint 3: refusal codes, B5 brand review and fixes, per-Flow and per-task humanness (2026-11-11)

### Worker summary
- **rc-refusal-codes** (worker, Sonnet). Core's `errorCode` now travels `core-api.ts` -> relay -> `panelRequest` -> panel result as `coreCode`, because `code` already carries relay failure codes and `"refused"` triggers the browser-refused fallback. The sentence people see is unchanged. Authority, project-domain, 401 and 403 handling are as before; invalid or oversized codes are dropped. Touched `shared/protocol.ts` for one optional field.
- **b5a-capture** (worker, Sonnet). About 100 screenshots in `reports/w4-brand-extension-ui/screens/`:
  - harness captures (the real panel over a scripted background, on company-website) in Chrome at 400 px and Firefox at 380x580, dark and light;
  - the real Chrome side panel (360x655) for chat, drawer, settings and getting started;
  - the real toolbar icon.
  - **Not captured: the real Firefox popup.** Playwright's Firefox cannot navigate to the temporary add-on's `moz-extension://` popup (`goto` times out, even on the unmodified build), and the add-on shows no toolbar button there. The Firefox pictures are the same panel in Firefox's engine at the popup's CSS size, not the popup frame.
  - It added the capture tooling under `apps/extension/e2e/` (two specs, a config and a scripted entry), and `panel-frame.ts` now loads `.woff2` so the existing screens specs bundle again.
- **My review** of the real Chrome panel:
  - Good: top bar, mark, tabs, drawer, step cards, mono section labels, amber accents.
  - Defects:
    - a light surround around a rounded dark panel;
    - system-blue checkboxes, light scrollbars and blue text selection;
    - Permissions labels at 16 px against 13 px hints;
    - a Save button that didn't say what it saved;
    - developer wording on getting-started step 1 ("run pnpm dev");
    - the extraction preview below the fold;
    - the 16 px icon's node merging into the F's bar.
- **Core tokens (mine).** `accent-color: var(--accent)` and `scrollbar-color: var(--edge) transparent` on `:root`, and `::selection` amber at 35%, as the website does.
- **b5b-brand-fixes** (worker, Sonnet):
  - the panel page now has the canvas background, with no outer margin or radius;
  - one type scale in Settings;
  - one save model: "Save changes" shows only when something changed (its accessible name stays "Save" for the Lab and six e2e specs);
  - the slider is relabelled "Starting humanness for new Flows and tasks";
  - the Connection line for `credentialDurability: "browser_session"`, built against an optional status field (`shared/protocol.ts`); W6's copy is used verbatim;
  - getting-started steps in plain words;
  - the extraction preview moved into view;
  - a small-size icon variant (<= 32 px): shorter middle bar, larger node with a clear gap;
  - both capture specs repaired for the audit.
  - The light Chrome header above the panel is Chrome's own frame and cannot be changed from the page.
- **h1-humanness-control** (worker-heavy, Opus):
  - Core `createHumannessControl` (0-100 in steps of 5, Fastest to Most human-like, "Uses your starting value (N)", "Use starting value" sends null, one commit on release, refusal reverts with the person's words);
  - mounted on each task's answer card behind "Humanness · N";
  - new optional port `ChatTransport.taskSettings { read, setHumanness }`.
- **h2-humanness-wiring** (worker-heavy, Opus):
  - relays `fluxiq.panel.flowHumannessRead` (get-flow-metadata-detail), `flowHumannessSet` (update-flow-settings `{ projectId, flowId, flow: { flowId, metadata: { humanness } } }`) and `taskHumannessSet` (update-task-settings), all panel-only;
  - the extension's `taskSettings` port;
  - the Flow control in the open automation's strip;
  - the task level read from the existing `listTasks` row;
  - one line in `chat-panel.ts` passes the status to the transport.

### Integration changes I made
- Core `tokens.css`: native-control accent, scrollbar colour and `::selection`, as above.
- Core `ui-components/package.json` `files`: added `src/chat/controls/humanness/humanness.css`, which `chat.css` imports.
- Repaired `all-screens-capture-company-website.spec.ts:26`, where a `"\n"` inside a string had become a real line break: a syntax error that would have failed every typecheck. Then parsed every new or changed extension `.ts`/`.mjs` with esbuild: all clean.
- `pnpm structure:baseline` (extension): `automation-strip.test.ts` statement-packing lowered from 7 to 6.
- `docs/architecture/extension-client.md`: a "Humanness per Flow and per task" paragraph and a message table.

### Commands run and observed results (mine)
- `node scripts/test-extension.mjs background/panel background/connection panel/state panel/chat panel/automations panel/tasks panel/shell/tests panel/settings/tests panel/getting-started panel/extraction panel/theme-choice release/tests panel/tests/css-tokens` -> 1068 tests, 1068 pass, 0 fail.
- Core ui-components `pnpm exec vitest run src/chat/controls src/chat/answer src/chat/tests/lease-transport.test.ts src/chat/view/tests src/theme` -> 24 files, 169 passed.
- Slot: `node scripts/check-extension.mjs` -> CHECK_EXIT=0. This covers everything up to H2, after the spec repair, so it includes SEC1, as you asked.
- Slot: the extension build was refused by Core's currency guard ("Core's build cache would rebuild ui-components:build: inputs changed"), because my tokens edit and the `files` line came after H1's dist build. I rebuilt ui-components first and re-ran the build and captures; results below.
- `node scripts/structure-audit.mjs` -> Core `passed (530 warning(s), 969 baselined)`; extension `passed (245 warning(s), 552 baselined)`, before the baseline update.

### Open items for the lead
1. **Core paired-client allowlist** (`server/program-route/program-route.ts`) lacks `get-flow-metadata-detail` and `update-flow-settings`, so the Flow control is refused for a paired browser. The first is a read. The second must come with a narrowing in `narrowPairedClientRequest` that accepts exactly `{ projectId, flowId, flow: { flowId?, metadata: { humanness } } }`, or a paired token could change any Flow setting. W2 owns these endpoints, so this goes to W2 or t898.
2. **The starting value is dropped until t898 lands:**
   - `FluxIQSettings` has no `humanness`;
   - `background/panel/settings-save.ts` `mergeSettings` drops it;
   - `background/saved-state.ts` `readSavedSettings` rebuilds from defaults.
   - So "Uses your starting value (N)" shows 0 until t898's field and normalisation merge here. Then I swap `panel/settings/humanness/limits.ts` to Core's constants.
3. **An open task card does not follow a Settings change**; it re-reads when opened. The Flow strip does follow it. A live refresh would need a Core hook; I judged it not worth it now.
4. **`credentialDurability`**: the panel reads optional `status.credentialDurability`; the background must set it from W6's `credentialDurability()` at integration.
5. **The real Firefox popup is not captured** (Playwright Firefox cannot open the add-on's pages). The Lab's window-capture helper also lists only chrome.exe and msedge.exe, so it cannot photograph Firefox. A manual check in Firefox, or a web-ext based capture, is needed for real popup pixels.
6. **Manifest name.** Chrome's side-panel header shows the manifest name; the e2e build reads "FluxIQ Web Automation Client (E2E)". Whether the store build should be just "FluxIQ" is a listing decision; manifests are not W4's.
7. **Save's accessible name.** The Save button keeps the accessible name "Save" because the Lab and six e2e specs press it by that exact name. Renaming it to "Save changes" means updating those callers.
8. **Screenshots in the repo.** `screens/` is about 5.5 MB of PNG and JPEG evidence (fixture sites only, no user data). Decide whether to commit them or keep only the "after" set.

### B5 after the fixes (recaptured)
- Slot chain: Core ui-components `pnpm build` -> CORE_BUILD_EXIT=0; extension build -> BUILD_EXIT=0; harness capture -> `2 passed (1.9m)`, `CAPTURE-DONE chrome problems=[]`, `CAPTURE-DONE firefox problems=[]`; real Chrome capture -> `1 passed (1.9m)`.
- Pictures: `screens/after/` (harness, Chrome and Firefox, dark and light) and `screens/after/real-raw/` (real Chrome window photographs, side panel open).
- My review of the real Chrome panel (`after/real-raw/chrome-panel-settings-2-dark.jpg`):
  - the Permissions checkboxes and the Dark radio are amber;
  - the scrollbar is dark;
  - labels and hints sit on one scale;
  - the getting-started steps are plain words.
  - The rounded edge around the panel is Chrome's own side-panel container.
- **Toolbar icon** (`after/real-raw/chrome-window-toolbar-nopanel.jpg`): at 1x the 16 px icon now shows a clear F with a separate, visible amber node beside Chrome's puzzle button. Accepted.
- Firefox remains harness-only (open item 5).

## Checkpoint 3b: panel-assistant threads (for W5)

- **pa-panel-threads** (worker-heavy, Opus). New web-panel endpoints:

| Endpoint | Body | Answer | Class | Refusal codes |
| --- | --- | --- | --- | --- |
| `get-panel-thread-attachment` | `{ conversationId, turnId, projectId? }` | `{ attachment: { attachment, payload } \| null }` | `programs.read`, read | as get-conversation-attachment |
| `rename-panel-thread` | `{ conversationId, title }` | `{ conversation }` | `programs.write`, authoring | `conversation_title_required`, `conversation_title_too_long`, `conversation_not_found` |
| `delete-panel-thread` | `{ conversationId }` | `{ deleted: true, conversationId }` | `programs.write`, authoring | `conversation_run_active`, `conversation_not_found` |

- **Authorisation:** as the other panel-assistant endpoints (`selfUser`, the signed-in actor). Each person's threads are in their own database, so another person's thread answers exactly like a missing id. All three refuse a paired client; none is on the paired-client allowlist.
- **Delete:** reuses the conversation store's one-transaction delete. A new panel migration `9004_panel_waiting_calls_follow_thread` adds a trigger that also removes the thread's waiting card calls, which hold the person's words. It is refused while the assistant's own work holds the thread (`PanelAssistantThreadUse`, in this process).
- **Attachment:** a proposed Flow change (`flow-graph-diff`) is read only in the project the request names, decided by IAM and checked for domain access. It is refused for `"panel"` or no project.
- **Checks:**
  - Worker: 14 + 65 + 51 tests; fluxiq `tsc --noEmit` (slot) exit 0; audit passed.
  - Mine: `pnpm exec vitest run` on thread-use, panel-threads and panel-assistant tests -> 5 files, 31 passed; Core `node scripts/structure-audit.mjs` -> `passed (530 warning(s), 969 baselined)`.
- **For the lead / W5:**
  1. Under the `service` profile, `FluxIQUserAccess` (`platform/iam/predefined/user-access.ts`) grants no panel-assistant endpoint at all, old or new; an existing test pins `list-panel-threads` as forbidden. So as it stands a hosted user cannot use the dock. Granting the panel actions on the caller's own user is an IAM policy change outside W4.
  2. The dock must send the proposal's real `projectId`, not `"panel"`, to read a `flow-graph-diff`. Nothing in Core writes such a turn into a panel thread yet, so W5's fixture must plant one.
  3. A delete racing work in another process is not covered: the hold is per process.
