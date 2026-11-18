# Tab gate (t926)

Worker report, 2026-11-17. Worktree `fxwork/t926-tab-gate` (extension at dev, shared Core read-only).
Security work on a local-only branch: nothing here was committed or pushed by this worker.

## Outcome

Done. One background tab gate, `apps/extension/src/background/tab-gate/`, now stands in front of
every call of the extension that reaches a tab: message sends, script injection and injected
reads, the screenshot, every tab act, the action runner's target choice, `selectTabForSwitch`,
fact checks, tab URL/title reports, the navigation URL feed and the content push intake. FluxIQ's
own pages are refused with a plain error the model reads ("FluxIQ does not act in its own
pages"). A structure-audit entry in the repository-local `scripts/structure-audit/config.mjs`
fails the audit on any `chrome.tabs` / `chrome.scripting` access in the extension's source
outside the gate. It failed on four planted raw calls and passed once they were removed. The
mirrored engine was not changed.

Round 2 (lead review) closed the two residual gaps of a tab-level check: a tab that moves to
FluxIQ's page between the check and the send, and a FluxIQ page framed in an ordinary tab. The
document a command reaches now decides by its own origin, with the same shared rule, and refuses
before any read; see "Round 2" below. Unit tests over every changed directory (3267, all passing),
the workspace build, the extension check, the structure audit and the headed provider-free Chrome
chat check all passed after round 2. Nothing was committed or pushed.

## The gate

`apps/extension/src/background/tab-gate/` is the one module of the extension that reaches a
browser tab. FluxIQ's own pages are every page on the origin of the configured web panel
(`coreApiUrl`, default `http://127.0.0.1:3000`) or gateway (`gatewayUrl`), with the three
loopback names (`127.0.0.1`, `localhost`, `[::1]`) treated as one host. The hosted sign-in routes
(`FLUXIQ_CONNECT_PATHS`: `/connect`, `/connect/authorize`, `/connect/done`, `/welcome`) are paths of
that same web app (the getting-started reachability probe resolves them against the same web
address), so excluding the origin excludes them; no separate route list is kept to drift.

| File | Exports | What it does |
| --- | --- | --- |
| `own-pages.ts` | `configureOwnPages`, `isOwnPage`, `isOwnPageTab`, `withoutOwnPages` | The policy. Addresses are read per decision, so a settings change applies at once. A tab is own when its `url` or `pendingUrl` is. |
| `refusal.ts` | `OwnPageRefusal` | The one refusal: `FluxIQ does not act in its own pages: tab N is a FluxIQ page, so nothing was sent to it.` Never carries the page's address or title. |
| `guard.ts` | `refuseOwnPageTab`, `ownPageRefusalFor` | Reads the tab (`chrome.tabs.get`) and throws / returns the refusal before anything else. |
| `page-message.ts` | `sendTabMessage` | Every `chrome.tabs.sendMessage`. |
| `page-script.ts` | `executeInTab` | Every `chrome.scripting.executeScript`. |
| `window-capture.ts` | `captureWindow` | Every `chrome.tabs.captureVisibleTab`, checked on the window's front tab (what is actually captured). |
| `tab-acts.ts` | `activateTab`, `navigateTab`, `reloadTab`, `goBackInTab`, `closeTab`, `openTab`, `openTabForPerson` | Every tab act. `navigateTab`/`openTab` also refuse an own-page address. `openTabForPerson` is the one unguarded open, reached only from the extension's own panel controls (the person asking to see their keys or data). |
| `tab-reads.ts` | `tabReads` | `Pick<typeof chrome.tabs, get, query, onActivated, onUpdated, onRemoved, onReplaced, onCreated>`: the only `chrome.tabs` view outside the gate. |

Refusals are plain errors. Where a path turns failures into a domain record, it reports
`ACTION_REJECTED` with the gate's words (`runtime/own-page/refused-result.ts`), so the model reads
"FluxIQ does not act in its own pages" and no retry ladder runs.

## Chokepoints wired (file:line, paths under `apps/extension/src/`)

| Path | Where | How |
| --- | --- | --- |
| Gate configuration | `background/connection.ts:132` | `configureOwnPages(() => ownPageAddresses(settings))` (the shared rule, round 2) |
| Tab message sends | `background/tabs.ts:63` (`sendToTab`) -> `tab-gate/page-message.ts:10` | every content command, look, fact check, extraction, recording toggle, overlay, trace capture, ping |
| Content-script injection | `background/tabs.ts:92` (`ensureContentScript`) | `executeInTab` |
| Build identity (raw send) | `background/diagnostics/build-identity.ts:9` | `sendTabMessage` |
| `executeScript` reads | `runtime/served-status.ts:36`, `runtime/navigation-events/page-work.ts:16`, `runtime/navigation-events/declared-refresh.ts:22` | `executeInTab` |
| Screenshot | `background/connection/state-assets.ts:66` | `captureWindow` |
| Automation tab acts | `runtime/automation-tab.ts:121` (open), `:238`, `:242` (front), `:243` (reload), `:245` (navigate) | `openTab`, `activateTab`, `reloadTab`, `navigateTab` |
| Browser tab action | `runtime/browser-tab.ts:169-170` (open), `:227` (switch), `:251-254` (close), `:270` (return after close) | own URL / own tab refused as `ACTION_REJECTED`; acts through the gate |
| `selectTabForSwitch` | `runtime/browser-tab.ts:110`, `:150`, `findTabForSwitch` | own tabs are never a match or the "tab before"; a request only the panel answers is refused at once, not waited on |
| Click landing | `runtime/click-landing.ts:409` (close), `:561` (back) | `closeTab`, `goBackInTab` |
| FluxIQ-opened tabs reset | `runtime/fluxiq-opened-tabs.ts:66` | `closeTab` |
| Action runner target choice | `runtime/action-runner.ts:124` (navigate to own URL), `:142` (named / leased / front tab), `:145-150` (resolution refused), `:152` (resolved tab) | refused before the tab is fronted, driven or sent to |
| Fact checks | `runtime/command-router.ts:87` | own tab answered `status: "failed"` with the refusal as `message`/`error`, nothing sent |
| `set_active_tab` | `background/connection/server-command-channel.ts:246-248` | refused before the page records it; fronting through the gate |
| Tab select (test hook) | `background/connection/active-page.ts:144` | `activateTab` |
| Tab URL/title reports | `background/tabs.ts:23` (`allTabs` omits own tabs), `background/connection/active-page.ts:97` (state update reports no active tab for the panel), `:113` (own tab update tracked, never recorded/attached/reported), `background/connection/recording-evidence.ts:197` | |
| Recording attach / broadcast | `background/connection/content-attachment.ts:30`, `:46` | own tab never attached; broadcast skips own tabs |
| Navigation URL feed | `background/index.ts:140` (`onCommitted`), `:145` (`onHistoryStateUpdated`) | own URLs dropped before the manager |
| Content push intake | `background/index.ts:264`, `:297-298` | `content.ready` / recording events from an own tab or own-origin frame are dropped |
| Panel "open page" | `background/panel/panel-control-deps.ts:50` | `openTabForPerson` |
| Tab reads | `background/index.ts`, `connection.ts`, `panel-control-deps.ts`, `content-attachment.ts`, `state-assets.ts`, `runtime/automation-tab.ts`, `runtime/browser-tab.ts`, `runtime/navigation-events/epochs.ts` | `tabReads()` |

## Mechanical enforcement

`scripts/structure-audit/config.mjs`, a new `restrictedReferences` entry "browser tab API":
`names: [/^tabs$/, /^scripting$/]`. The mirrored engine (`scripts/structure-audit/rules/` is
byte-compared with Core by `scripts/check/core-mirror.mjs`) has no rule that can tell
`chrome.tabs.update` from `map.update`, and only `config.mjs` is repository-local, so the rule
restricts the namespaces themselves: any `.tabs` / `.scripting` property access (or `{ tabs }`
destructured) in the extension's source outside the gate fails. Type positions
(`chrome.tabs.Tab`) are qualified names and are not read. Allowed: the gate directory; two
sign-in files another task owns whose `tabs` is an injected registry, not the browser API
(`background/authentication-attempts/session.ts`, `background/connect/pkce/start.ts`); two runtime
tests that patch a stubbed `chrome.tabs`; the panel's top-bar test (a UI tab strip); and every
tree outside `apps/extension/src` by prefix (the engine has no per-directory scope for an entry).
This is stricter than the brief asked (reads too), which is why reads go through `tabReads()`.
The engine was not changed.

## Round 2: the receiving document decides too

The lead's review named two gaps left by a tab-level check: a tab that moves to FluxIQ's page
between the gate's `tabs.get` and the send, and a FluxIQ page framed inside an ordinary tab. Both
are now closed by a second decision made by the document a command reaches, by its own origin.

- **One shared rule.** The own-page rule moved to `apps/extension/src/shared/own-pages/`
  (`rule.ts`: `ownPageAddresses(settings)` and `isOwnPageAddress(url, addresses)`, with the loopback
  normalization). The background's `tab-gate/own-pages.ts` now only holds the configuration and
  calls the shared rule; the content script calls the same function. Nothing is copied.
  `refusal-reply.ts` holds the one refusal text (`OWN_PAGE_REFUSAL_MESSAGE`, which
  `OwnPageRefusal.MESSAGE` now is) and the content reply shapes.
- **Where the content script learns the addresses.** Not from storage, deviating from the review:
  `background/index.ts:47` sets `chrome.storage.local` to `TRUSTED_CONTEXTS`, because the credential
  is stored there, so a content script cannot read the settings and opening that store would undo
  a deliberate protection. Instead the content script asks the background
  (`fluxiq.ownPageAddresses`, answered at `background/index.ts:168` from the connection's settings
  through the same `ownPageAddresses`). That reply travels on the extension's own messaging channel,
  which a page cannot write to, and nothing in the command is trusted for the decision. It is asked
  again for every decision (concurrent questions share one answer), so a settings change applies
  to the next command. A document whose question is not answered refuses
  (`own_page_unconfirmed`); it never assumes it is ordinary.
- **The document's origin** is `location.origin` and `self.origin` (an `about:blank` or `srcdoc`
  frame inherits its creator's origin; `location.origin` alone reads `"null"` there).
- **Command handling** (`content/message-handler.ts:121`): every command is first routed by
  `routeMessage` (`:131`), synchronously, from the message and the frame's place (active copy, top
  frame) and nothing of the page, so a frame a command is not for still stays silent and leaves
  the channel to the frame it is for. A routed command then waits for the decision
  (`content/own-document/guard.ts`). An ordinary document answers it; FluxIQ's document answers
  `{ refused: "own_page", error: "FluxIQ does not act in its own pages: ..." }` and does nothing
  else: no read, no act, no evidence. Only `fluxiq.ping` is answered in every document: it carries
  only "a current script is listening", and a document that never answered it would be injected
  into again by the background's readiness check. This listener is the content script's only entry
  for background commands (the picker, extraction, overlay and trace capture are all routed
  through it).
- **Content push** (`content/recorder.ts:58`, `:72`): `content.ready` waits for the decision and
  builds and sends nothing unless the document is ordinary. Recording events are sent only when the
  last decision was ordinary; recording itself starts only through a command, which a FluxIQ
  document refuses. The background's intake check (round 1) still drops anything from an own tab
  or own-origin sender as a second fence.
- **Background side.** `tab-gate/page-message.ts:26` turns the content refusal into the same
  `OwnPageRefusal` (an unconfirmed one into a plain error). The action runner
  (`runtime/action-runner.ts:196`) and the command router (`runtime/command-router.ts:69`) report it
  as `ACTION_REJECTED` with the gate's words; a fact check any of whose frames refuses is answered
  `failed` with the refusal (`runtime/command-router.ts:95-107`), not claims quietly `unknown`.
- **Injected reads** (`executeScript` functions cannot run the content check): `tab-gate/page-script.ts:19`
  re-checks the tab once the injection returns, and a tab now on FluxIQ's page has the result
  discarded and the call refused, so nothing read there leaves the gate. The content script
  injected by `ensureContentScript` refuses commands itself.
- **`documentId` binding** was not adopted. Chrome supports `tabs.sendMessage(..., {documentId})`
  from 106 (the Chrome manifest admits 116), but Firefox support at the Firefox manifest's minimum
  (128) could not be confirmed here, and the review made it optional on both. The content-side
  check is the fix.
- **MAIN-world script (`page-world/`).** It holds no messaging to the background and acts only on
  DOM events in its own document (`shared/dialog-channel.ts`, `press-probe-event.ts`,
  `request-start-event.ts`, `scheduled-work-event.ts`). The content script raises those only while
  running an action or a look (`content/action-runtime/dialog-control.ts`, `ignored-press/*`,
  `press-readiness/watch.ts`) and the background only through the gated page-work read. In a FluxIQ
  document none of those run, so nothing from the content script reaches the page-world script
  there. The page-world script still installs its own wrappers at document start in every page,
  FluxIQ's included; that is the startup-inertness work that stays out of scope.

## Commands run and observed results

All from `C:/Users/osrs_/FluxStuff/fxwork/t926-tab-gate` unless noted.

- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` (in
  `apps/extension`) -> no output, exit 0.
- `EXTENSION_TEST_BUILD_LABEL=t926 node scripts/test-extension.mjs src/runtime src/background`
  (in `apps/extension`):
  - first run, before the test stubs were updated: `# tests 1312 # pass 1282 # fail 30`. Every
    failure was a stub with no `chrome.tabs.get` (`chrome.tabs.get is not a function`). The
    gate now reads the tab before each send, injection and act. The failing stubs were in the
    `active-page`, `server-command-channel`, `build-identity`, `tabs` (9), `click-landing*` (14)
    and `served-status` (4) tests, and each gained a `get`. The rate-limited click test now
    models "address unread" as a tab with no `url` instead of a rejecting `get`, because the tab
    exists and only its address is unread.
  - after: `# tests 1331 # pass 1331 # fail 0` (19 new tests included).
- `EXTENSION_TEST_BUILD_LABEL=t926-conn node scripts/test-extension.mjs src/background/connection src/background/tests src/background/tab-gate`
  (after the last `content-attachment.ts` change) -> `# tests 511 # pass 511 # fail 0`.
- New tests, `EXTENSION_TEST_BUILD_LABEL=t926-gate node scripts/test-extension.mjs src/background/tests/own-page-reports src/runtime/tests/own-page-gate src/background/tab-gate`
  -> `# tests 19 # pass 19 # fail 0`. Each test runs against a fake browser that records every
  call. They prove that each refusal happens before any send, injection, capture or act:
  - `background/tab-gate/tests/gate.test.ts` (7): the policy (paths, loopback names, `pendingUrl`,
    settings read per decision); `sendTabMessage`, `executeInTab`, `captureWindow` and every act
    refused on the panel tab or a panel address; ordinary tabs served; a missing tab fails with the
    browser's words.
  - `runtime/tests/own-page-gate.test.ts` (9):
    - a command naming the panel tab;
    - the panel in front with no tab named (click and look);
    - a navigate to a panel address, and a navigate naming the panel tab;
    - an automation tab that is the panel;
    - a switch by pattern and a switch by id whose match is the panel;
    - a close of the panel tab, and an open of a panel address;
    - a switch both tabs answer, which takes the ordinary tab;
    - a fact check on the panel tab, answered `failed` with the refusal;
    - `servedStatus` / `pageWorkSettled`, which never inject into the panel;
    - a click and a fact check on an ordinary tab, which still reach it.

    Refusals carry `ACTION_REJECTED`.
  - `background/tests/own-page-reports.test.ts` (3): `allTabs()` omits the panel; the state update
    names neither the panel's address, title nor tab id; a panel tab update is tracked but never
    recorded, attached or reported, while an ordinary one still is.
- `pnpm build` -> exit 0 (`apps/extension build: Done`, `packages/test-runner build: Done`). An
  earlier `pnpm build` failed only because a file was renamed while `tsc` ran
  (`TS6053 ... tab-message.ts not found`).
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0
  (`{"build-cache":"build","step":"extension:check",...}`).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (251 warning(s), 551 baselined).`
  No warning names a gate file.
- Planted-call proof: four lines were appended to `background/diagnostics/build-identity.ts`
  (`chrome.tabs.sendMessage`, `chrome.scripting.executeScript`, `chrome.tabs.captureVisibleTab`,
  `chrome.tabs.update`). Then `node scripts/structure-audit.mjs --rule restricted-references`
  printed four `FAIL [restricted-references] ...build-identity.ts:14..17: reads the name
  "tabs"/"scripting", a restricted browser tab API reference.` lines and `structure-audit: 4
  violation(s) across 1 rule(s).`, exit 1. The file was restored from a copy, and the same command
  printed `structure-audit: passed (0 warning(s), 0 baselined).`, exit 0.
- Live: `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario everything-store --page ./ --no-ask --model-key`
  - first attempt exit 2: `Required test topology path is missing: ...domain/dist/host/web-panel-host.mjs`.
    The worktree's domain host bundle had never been built, and `pnpm build` does not build it.
    `pnpm --filter @fluxiq-web-extension/domain host:build` built it.
  - rerun exit 0, `"stage":"done","panelMode":"side-panel","failure":null`. All 20 checks were
    true, among them `approvedWithoutAKey`, `keylessLibraryUsesPairedAuthority`,
    `configured-later:modelAccess`, `after-panel-logout:modelAccess`,
    `reconnectedWithoutReapproval`, `restartedWithoutReapproval`, `explicitRevokeReachesCore` and
    `revokedCredentialCannotCallModel`. Evidence:
    `C:/Users/osrs_/FluxStuff/evidence/t198/2026-11-17T23-19-22-869Z-chrome`. The CLI strips
    provider credentials, and no paid call was made.

- Round 2:
  - `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` -> exit 0.
  - New tests, `node scripts/test-extension.mjs src/tests/own-page-race src/content/own-document src/content/tests/message-handler-own-page`
    -> 12/12 pass:
    - `content/own-document/tests/own-document.test.ts` (8): the decision by origin (loopback
      names, an inherited `self.origin`); an unanswered question is `unconfirmed`, never ordinary;
      questions asked at once share one answer and a later one asks again; a command delivered to
      FluxIQ's document is refused before the answer that reads the page runs; the ping is still
      answered; a framed FluxIQ document is refused while the ordinary top document answers; a
      frame a command is not for stays silent and asks nothing; an unconfirmed document refuses.
    - `content/tests/message-handler-own-page.test.ts` (1): the real `routeMessage` behind the
      guard, with a `document` that records every member read: `executeAction`,
      `captureSnapshot`, `fluxiq.evaluateFacts`, `fluxiq.pageChallenge`,
      `fluxiq.tracePageCapture`, `recording` and `fluxiq.pageChanges` are each refused in FluxIQ's
      document with zero document reads; the same routing in an ordinary document answers.
    - `tests/own-page-race.test.ts` (3): the gate's check sees the shop tab, the message lands in
      a FluxIQ document, and `sendTabMessage` rejects with `OwnPageRefusal` while the runner
      reports `ACTION_REJECTED` with nothing answered there but the ping; a FluxIQ page framed in
      the shop tab is refused at frame 4 while frame 0 answers; an injected read whose tab moved
      to FluxIQ's page while it ran is discarded and refused.
  - `EXTENSION_TEST_BUILD_LABEL=t926 node scripts/test-extension.mjs src/content src/runtime src/background src/shared src/tests`
    -> `# tests 3267 # pass 3267 # fail 0`.
  - `pnpm build` -> exit 0 (`apps/extension build: Done`, `packages/test-runner build: Done`).
  - `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0.
  - `node scripts/structure-audit.mjs` -> `structure-audit: passed (252 warning(s), 551 baselined).`
    The one new warning is advisory: `content/tests/` holds 16 files, past the 15-file advisory.
  - `pnpm --filter @fluxiq-web-extension/domain host:build` -> reused, current; then the live chat
    check (same command as above) -> exit 0, `"stage":"done","failure":null`, all 20 checks true.
    Evidence: `C:/Users/osrs_/FluxStuff/evidence/t198/2026-11-17T23-53-02-769Z-chrome`. No paid call.
  - `apps/extension/src/shared/constants.ts` and `shared/fluxiq-web-routes.ts` (now t925's) were
    read only: `git diff --stat` on both is empty.

## Closed in round 2

- The window between the gate's tab read and the send: the receiving document refuses.
- A FluxIQ page framed inside an ordinary tab: the framed document refuses; the ordinary top
  document is unaffected.

## Not verified

- The live check pairs, selects a project, opens the side panel and exercises model access with
  the gated extension loaded. It does not drive a web action on the scenario page, so ordinary
  automation through the gate is proven by the unit tests above, not live. No live test opened the
  web panel in a tab and tried to act in it.
- Firefox was not run.
- Round 2 is proven by unit tests against stubbed browsers and a recorded `document`; no live
  test navigated a tab to the panel mid-command or framed a panel page, and Firefox was not run.
- Injected `executeScript` reads cannot run the document's own check; they are re-checked on the
  tab after the injection and their result is discarded if the tab is now FluxIQ's. They target
  only the top frame.
- Content-side startup inertness stays out of scope: the manifest still injects the content and
  MAIN-world scripts into FluxIQ's pages, and both install their listeners and wrappers at start.
  The content script there answers only the ping and, as on every page, the cross-frame geometry
  request (`content/frame-geometry.ts`), which carries layout numbers only.
- `documentId` binding of sends was not adopted (Firefox support at the manifest minimum not
  confirmed).
- `web.browser.download` (`runtime/browser-download.ts`) uses `chrome.downloads`, not a tab, and
  is not gated, so a download of a panel address is not refused.
- The extension's own pages (`chrome-extension://`) are not in the own-page set.
  `unsupported-page.ts` already refused them for automation, and the brief named only the panel's
  origins and sign-in routes.

## Open questions or contradictions found

- Hosted sign-in routes: on dev, every sign-in route is a path of the configured Core origin, so
  the origin rule covers them. The PKCE sign-in (`background/connect/pkce/`) is not wired into
  the background on dev. If it is wired with a selected origin different from `coreApiUrl`, that
  origin must be added to `ownPageAddresses` (`shared/own-pages/rule.ts`), which both sides read.
- The audit restricts `.tabs` and `.scripting` by property name, the only shape the mirrored
  engine's `restrictedReferences` can express. This is stricter than the brief asked (it covers
  reads too). The allow list has five exact files, and a future UI file that names a property
  `tabs` will need an entry. A per-directory `restrictedReferences` scope in Core's engine would
  let the rule name only the page-reaching methods.
- `set_active_tab` from Core now throws on the panel tab instead of fronting it. Whatever handles
  that command's errors reports the failure as before.
- When the panel tab is in front, a non-navigation action is now refused; dev ran it in the panel.
  Core sees no active tab while the panel is in front.
- `pnpm build` does not build `domain/dist/host/web-panel-host.mjs`, which the chat check needs.
  A fresh worktree has to run `pnpm --filter @fluxiq-web-extension/domain host:build` first.
