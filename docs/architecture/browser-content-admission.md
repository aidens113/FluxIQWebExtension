# Browser Content Admission

When the extension may read, act in, script or report a browser tab, and when
its content script must be inert. Two decisions exist today, both about
FluxIQ's own pages; a third, about tabs owned by a sign-in attempt, has only
its registry. Installed-browser behavior of the whole is not yet accepted.

An approved client stays authenticated without a second default key unlock.
Admission is separate: it prevents FluxIQ's own pages (the web panel, the
hosted sign-in routes it serves) from becoming automation evidence. It does not
grant or revoke account, model-key or gateway authority and provides no Unlock
UI. Explicit account/IAM refusal and credential revocation remain Core's.

## Which addresses are FluxIQ's own

One rule, `shared/own-pages/rule.ts`, used by both sides below. It reads the
connection's settings (panel and gateway origins, which include the hosted
sign-in routes) and treats a loopback name as the same origin. Nothing else
keeps a route list of its own.

## The background's tab gate (before sending)

`background/tab-gate/` is the only module that touches `chrome.tabs` or
`chrome.scripting` (the structure audit enforces it). Every message, injected
script, screenshot and tab act reads the tab's top document first and, for an
own page, refuses with `OwnPageRefusal` before anything reaches it. The browser
may move the tab between that read and the send; the content script's own check
below covers that window, and the window itself is not hidden.

## The content script's own-document verdict (where the command lands)

`content/own-document/` decides by the document's own origin, never by anything
a command carries, asking the background where FluxIQ's pages are
(`OWN_PAGE_ADDRESSES_MESSAGE`). The verdict is `ordinary`, `own` or
`unconfirmed` (the background did not answer, which is refused, not assumed
safe). In an own or unconfirmed document every command is refused before a
read, `content.ready` is not sent and nothing is emitted.

## Inert at startup

The message handler is installed first, so a refusal and the liveness ping
(`fluxiq.ping`, which says only that a current script is listening, and is
what keeps the background from reinjecting) work everywhere. Everything that
listens to or watches the page is installed only once the verdict is
`ordinary` (`content/lifecycle/install-when-ordinary.ts`): the page-change
counter, the frame-geometry bridge and the recording listeners. Each returns a
disposer. In an own page none of them is registered, so no listener, observer
or counter exists to leak layout. An `unconfirmed` document is asked again until
decided, because staying inert for want of an answer would silently disable
the counter a later look depends on. The MAIN-world wrappers (`page-world/`)
are not yet dormant in an own page; they hold no authority and are a later,
optional tranche.

## Revocation

When the background learns a tab it treated as ordinary has become one it must
not touch, `revokeTabContent(tabId)` (`background/tab-gate/revoke.ts`) sends
the one message `fluxiq.revoked` (`shared/own-pages/revoked-message.ts`). It is
the only gate message sent to an own-page tab, because that is its point; it
carries nothing and is answered with a bare acknowledgement. No caller is wired
yet: `background/index.ts` and `background/connection/` belong to the
connection work.

The content script routes it where it routes the ping (before the own-document
check, in every document, from a superseded copy too) and `suspendContent()`
(`content/lifecycle/`):

- advances a module-level revoked epoch (`content/revoked/epoch.ts`);
- runs every install disposer;
- discards, without flushing, the recorder's pending input and mutation batch,
  the observed event elements, the shadow-root listeners, the picker session,
  the activity overlay and the hover state.

A recording stop flushes the typed text; a revocation never does: what was
typed in a page FluxIQ may no longer read must not leave it.

Work in flight ends in a page-free refusal, never a reply read from the page.
`waitUntil` (`content/action-runtime/waits.ts`) checks the epoch each time it
polls and rejects with `ContentRevokedError` (not `undefined`, which would read
as "the condition did not hold"). Every routed reply is fenced
(`content/revoked/fence.ts`): a command answered after a revocation is refused
`{ ok: false, errorCode: "content.revoked", phase: "before-dispatch" }`
(nothing was started), and one begun before it and finishing after it is
answered `phase: "interrupted"` whatever it computed. An `interrupted` reply
means the work may already have acted: it is a retryable step outcome, never a
terminal failure and never a claim that a lasting act did not happen. The
background must classify it so; that mapping belongs with the wiring.

## Tabs owned by a sign-in attempt

`background/authentication-tabs` owns authenticated-flow tab ownership:
`ownership(tabId)` (excluded, unowned or unavailable before the saved state is
read), `captureBlocked()`, `inherit(tabId, openerTabId)` (a tab opened by an
owned sign-in tab is owned by the same attempt) and `eligible()` (which also
checks a navigation's `pendingUrl`). Nothing consumes them yet. A sign-in page
off FluxIQ's origin, such as an external identity provider, is covered by no
decision above; if that is in scope, the entry point is a predicate inside the
tab gate (`isOwnPageTab` is its one decision point), not a second gate.

## Not done, and why

- Document-bound sends (`tabs.sendMessage(..., { documentId })`,
  `sender.documentId`) would close the window between the tab read and the
  send. Chromium 106 and Firefox 153 support them while the Firefox manifest
  allows 128, so it needs a manifest decision first.
- Upload and screenshot hardening (omit credentials, reject redirects, no
  cache, no referrer, a current-owner check) is a separate unit in
  `background/connection/`.
- Restart quarantine and a journal of possible authentication surfaces, and a
  background privacy authority, were built on a branch and parked; the gate
  above covers the own-page case without them.
- Live-browser validation of startup inertness and revocation has not been
  done; the unit tests stub the page.
