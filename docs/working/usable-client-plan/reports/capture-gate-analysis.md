# Capture gate analysis (follow-up 1 precondition)

Read-only investigation, 2026-11-17. Trees read: dev `C:/Users/osrs_/FluxStuff/!FluxIQWebExtension`
and t914 `fxwork/t914/!FluxIQWebExtension` + `fxwork/t914/!FluxIQ` (status, diff, untracked files
only; nothing built, tested or modified there). Paths below are under `apps/extension/` unless noted.

## Outcome

A single gate at the screenshot/trace "capture authority" does **not** give t914's guarantee: most
page data leaves through other paths. A background gate at a small set of browser-API chokepoints
**can** cover pull, push, capture and tab acts, and t914 already contains most of that background
foundation. What no background gate can do is stop manifest-injected code from running in an
excluded tab; t914 handles that by making content inert until admitted. Recommendation: neither
"finish as is" nor "replace": keep t914's background modules, wire them as one gate, add a
mechanical check, and cut the content side down to startup inertness (about 6 files, not 105).

## 1. The guarantee t914 implements (and its state)

**Which tabs are refused** (`src/background/authentication-privacy/access/project.ts:15-39`):
tabs owned or reserved by an authentication attempt (`authentication-tabs` `ownership()` in the
registry diff), tabs not yet proved ordinary, every tab without a current ordinary proof after a
restart quarantine or a "possible auth" journal entry, and any tab whose `url` or `pendingUrl` is
not http/https/file, carries URL credentials, or matches a hosted sign-in route
(`access/destination.ts`, dev `background/authentication-tabs/route-policy.ts:30-40`). Decisions are
per tab (top document); a frame is admitted on its tab's decision plus its own documentId
(`authentication-privacy/content/create.ts:12-15`).

**Which acts.** Read/snapshot/act/record/fact-check/extraction/trace replies: every content message
except `fluxiq.ping` and build identity is refused unless it carries the frame's current grant
(t914 `src/content/message-handler.ts:131-139`); replies are re-bound to the grant.
Recording: content does nothing at startup until admitted, then installs listeners and sends
`content.ready` (t914 `src/content/index.ts:34-56`); recorder emits are grant-checked
(`content/recorder.ts` diff). In-flight work: every verb's dependencies are proxied so each call
asserts the grant and watches die on revocation (`content/action-runtime/admitted-dependencies.ts:5-42`,
plus ~90 verb/extraction files). MAIN world: a cooperative hint only, explicitly "never authority"
(`src/page-world/admission.ts:8`). Screenshot: privacy access + HTTP owner lease + global capture
gate, blocked while any auth tab exists (`authentication-privacy/captures/create.ts:10-60`,
`background/connection/state-assets.ts` diff). Trace capture: owner-pinned, re-checked through
hash and upload (`background/trace-capture/*` diff). Inject: not gated; injected content is inert.

**Where decided.** Background: `authentication-privacy` (tab projection), `content-admission`
registry (grant per retained Port, sender from the browser, `registry.ts:21-60`),
`admitted-tabs/transport/create.ts:29-93` (the one guarded page RPC). Content enforces it.

**State: not wired, not shippable as is.** Background `index.ts:110-111` (unchanged in t914) accepts
only the action-evidence Port, so no content frame can ever be admitted; `background/tabs.ts` is
unchanged, so no background sender attaches a grant; the transport is used only by its tests. Built
as is, content would refuse every command. `background/connection.ts:223-226` (unchanged) still
builds `StateAssetStore` with `{credentials, onActivity}` while t914's deps are
`{privacy, http, onActivity}`, so the full program would not typecheck (inferred from types; the
ledger reports scoped TypeScript roots only). t914's own doc says "The production background
connection is not yet wired to it" (`docs/architecture/browser-content-admission.md:3-5`).
Core side: docs, briefs, reports and two generated IAM catalog files; no Core runtime code.

## 2. Every path on dev, and whether it passes one background authority

There is no single authority on dev. The de facto chokepoint is `src/background/tabs.ts`:

| Path | Where on dev | Through `tabs.ts`? |
| --- | --- | --- |
| Content commands: actions, snapshots, merged frame looks, fact checks, extraction picker/read, trace capture, recording on/off, activity overlay | `sendToTab` `background/tabs.ts:53-63`; callers `runtime/action-runner.ts:85-170,517`, `runtime/command-router.ts:76-81`, `connection/server-command-channel.ts:383,391`, `extraction/control.ts:125-127,249`, `trace-capture/page-capturer.ts:49`, `connection/content-attachment.ts:36,44`, `connection/recorded-event-intake.ts:104`, `connection/recording-evidence.ts:179,212`, `connection.ts:384-385` | Yes |
| Build identity | `background/diagnostics/build-identity.ts:8` raw `chrome.tabs.sendMessage` (control page only, no page data) | No |
| Script injection of content | `ensureContentScript` `tabs.ts:84-99` (`executeScript` at :91) | Yes |
| Page reads by injected function | `runtime/navigation-events/page-work.ts:15`, `declared-refresh.ts:21`, `runtime/served-status.ts:34` (scalars: settled flag, meta refresh, HTTP status) | No |
| Screenshot | `connection/state-assets.ts:61-66` `captureVisibleTab` of the tab's *window* (captures whatever is in front) | No |
| Content push: ready, recording events, describeTab | `background/index.ts:253-257, 268-272, 274-276`; sent unprompted by `content/recorder.ts:57,65`; `content.ready` carries URL+title (`recorder.ts:159-166`) | No (sender.tab only) |
| Recording broadcast to every tab | `connection/content-attachment.ts:39-46` | Yes, but iterates all tabs |
| Tab metadata to Core (URL, title, favicon of every tab) | `tabs.ts:8-16` → `connection/active-page.ts:93` → `connection/browser-state.ts:47-62`; seeding `active-recording.ts:425-431` | Yes (`allTabs`), unfiltered |
| Navigation URLs while recording | `background/index.ts:120-143` → `recorded-event-intake.ts:113-124` | No |
| Tab acts: navigate, reload, back, close, activate, create | `runtime/automation-tab.ts:120,237-244`, `runtime/click-landing.ts:408,560`, `runtime/browser-tab.ts:146-153,211,236`, `runtime/fluxiq-opened-tabs.ts:65`, `server-command-channel.ts:244`, `connection/active-page.ts:136` | No |
| Tab choice for switch | `runtime/browser-tab.ts:100-109` matches any tab | No |
| Declarative injection, both worlds, every frame, document_start | `manifest.chrome.json:30-47` (Firefox similar); content startup `content/index.ts:25-29` | Not controllable from background |
| Frames | addressed by frameId through `sendToTab`; no per-frame URL policy | Yes (tab-level only) |
| Side panel / popup | no tab API calls (grep of `src/panel`, `src/popup`, `src/sidepanel`); privileged routes gated by `background/control-page.ts:39-42` then reach the paths above | Indirect |

A gate placed only at capture (screenshot + trace) would miss actions, snapshots, extraction, fact
checks, pushed recording events, tab metadata, navigation URLs and tab acts.

## 3. Answers

**(a) Does a single gate suffice?** Not at the capture authority. A background gate does suffice
for everything that leaves the tab or acts in it, if it sits at these chokepoints: `sendToTab` and
`ensureContentScript` (bind each send to the checked `documentId`; Chrome supports
`tabs.sendMessage(..., {documentId})`), a gated `executeScript` helper for the three runtime reads,
the screenshot, the intake routes in `background/index.ts` (check `sender.tab.id` and
`sender.documentId` before `handleContentReady`/`handleRecordingEvent`), the tab-metadata projection
in `tabs.ts` (`activeTab`, `allTabs`, `describeTab`) and the webNavigation/onUpdated handlers, and
every runtime tab act plus `selectTabForSwitch`. Paths that bypass any one-place gate today: the 3
`executeScript` reads, `captureVisibleTab`, the raw build-identity send, the push intake, the
navigation URL feed, and the 10 runtime tab-act call sites. Nothing in the background can stop the
manifest's MAIN and isolated scripts from running inside an excluded tab.

**(b) Coverage difference.** t914 covers, and the gate would not: content inert at startup in an
excluded frame (no listeners, no `content.ready`, page-world told to stand down); in-page abort of
an action already running when a grant is revoked without a document change; a second, in-page
refusal if a background sender is ever missed. The gate covers, and t914 as written does not: tab
metadata to Core (`tabs.ts`, `active-page.ts` untouched in t914), navigation URLs, the 3 runtime
`executeScript` reads, tab acts (navigate/reload/close/switch) on excluded tabs, `selectTabForSwitch`,
and build identity. Both are tab-level: neither excludes a sign-in page embedded as a frame of an
ordinary tab.

**(c) Recommendation: both, reordered and smaller.**
1. *Gate first, reusing t914's background work.* Bring over `shared/tab-access`,
   `background/authentication-privacy`, `background/capture-authority`, the `authentication-tabs`
   registry changes, the `state-assets`/`trace-capture` changes, and wire them in `background/tabs.ts`
   (all sends, injection, metadata), `background/index.ts` (intake), `background/connection.ts`
   (deps), `background/diagnostics/build-identity.ts`, `runtime/navigation-events/page-work.ts`,
   `runtime/navigation-events/declared-refresh.ts`, `runtime/served-status.ts`,
   `runtime/automation-tab.ts`, `runtime/browser-tab.ts`, `runtime/click-landing.ts`,
   `runtime/fluxiq-opened-tabs.ts`, `connection/server-command-channel.ts`,
   `connection/active-page.ts`, `connection/recorded-event-intake.ts`.
2. *Enforce it mechanically.* Add a structure-audit rule (`scripts/structure-audit/config.mjs`) that
   fails `pnpm check` on `chrome.tabs.sendMessage`, `chrome.scripting.executeScript`,
   `chrome.tabs.captureVisibleTab` or tab-mutating `chrome.tabs.*` outside the gate module.
3. *Content: startup inertness only.* Keep t914's `content/index.ts`, `content/instance.ts`,
   `content/recorder.ts` (emit gating), `content/message-handler.ts` (refuse until admitted),
   `content/admission/*`, `page-world/admission.ts`. Drop the per-verb proxy across
   `content/action-runtime`, `content/actions`, `content/extraction` (~90 files): the gate re-checks
   before every dispatch and discards stale replies, so those wrappers only add in-page abort, which
   one background "revoked" message handled in `message-handler.ts` can give. Whether the
   Port/grant handshake is still needed once sends are documentId-bound is a design choice to make
   then; a simpler alternative is excluding sign-in routes from injection with
   `scripting.registerContentScripts({excludeMatches})`, which needs a probe first (see Not verified).

**Tests that would prove it.** Unit, with stubbed `chrome`: a send, inject, `executeScript` read,
screenshot or tab act aimed at an owned auth tab, a sign-in-route tab or a quarantined tab is
refused *before* the browser API is called; a send is bound to the checked `documentId`; intake from
an excluded sender is dropped before `recordEvent`; `allTabs`/state updates omit excluded tabs'
URL/title; no `captureVisibleTab` while any auth tab is owned; `selectTabForSwitch` skips excluded
tabs; the audit rule fails on a planted raw call. Keep t914's suites
(`background/authentication-privacy/tests`, `background/connection/tests/state-assets.test.ts`,
`background/trace-capture/tests/guarded-capture.test.ts`, `background/content-admission/tests`).
Browser: a preclaimed tab on a sign-in route with recording on; assert no `client.state_update` or
recording event carries its URL, no snapshot or screenshot is taken, and actions naming it are
refused.

## Security

A finding is held locally (not described here).

## Not verified

- Nothing was built, typechecked or tested in either tree; the t914 typecheck failure is inferred
  from `connection.ts:223-226` versus the new `StateAssetStoreDeps`.
- `tabs.sendMessage` `documentId` targeting and `sender.documentId` on Firefox: t914's doc cites
  Firefox 153+, while `manifest.firefox.json` allows 128+. Both approaches share this gap.
- Whether `excludeMatches` also excludes `about:blank`/origin-fallback child frames, and whether
  dynamic registration keeps `document_start` timing for the MAIN-world wrappers.
- Whether the content action runtime already has a cancellation signal a "revoked" message could use.
- I read the hosted-plan lines that mention admission or capture, not the whole plan.

## Open questions or contradictions

- AGENTS.md limits Playwright specs to the ten realistic scenarios; a sign-in containment browser
  test (like `e2e/native-auth-feasibility/tests/containment.spec.ts`) needs a sign-in page, so the
  lead must decide how that rule applies.
- `docs/working/usable-client-plan.md:53` says 105 extension files; the t914 status shows 105
  modified plus 17 untracked entries (about 90 new files), consistent with "about 122 paths".
