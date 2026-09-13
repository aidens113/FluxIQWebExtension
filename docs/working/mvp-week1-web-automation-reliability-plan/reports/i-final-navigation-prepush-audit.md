# i-final-navigation-prepush-audit — downstream boundary and security

Read-only audit on 2026-09-13 of downstream range `8327ddd..db3cc17`.
I read the binding repository/security/generated-data rules, only the changed
production source, tracked generated entrypoints/maps, the testing-facility
architecture update, and closest control-message tests. This report is the
only edit. I ran no build, test, Lab, or Core command and made no source,
shared-document, commit, or remote change.

## Disposition

**Accept for supervisor pre-push gates. No P1 or P2 boundary/security finding.**
The final range removes the superseded CDP navigation driver and implements a
downstream-only, extension-internal test-control seam. It neither changes nor
requires a FluxIQ Core API. The remaining live-behavior claim is covered by the
separate W10 proof, not inferred here.

## Boundary

- The changed executable source is confined to `apps/extension` and
  `packages/test-runner`. No `domain/` or sibling Core file changed. The
  facility-specific concepts — Playwright page, browser tab, extension control
  page, loopback URL, top-frame commit, and scenario step — belong downstream
  under the repository's Automated Testing Facility Boundary.
- The runner binds the factory to the existing extension control page only
  after recording-state confirmation (`run-scenario.ts:282-288`). It sends no
  new gateway/Core operation. The extension turns a claimed commit into the
  existing `browser.navigation` event with existing `metadata.transition =
  "typed"`, then re-enters the ordinary public recording intake
  (`recorded-event-intake.ts:121-130`). The existing domain mapping and Core
  recording contract therefore remain the seam.
- The final `scripted-navigation.ts` has no CDP session, `Page.navigate`, or
  transition-coercion code. The only remaining `newCDPSession` in runner source
  is the pre-existing, unrelated browser-version probe
  (`run-scenario.ts:574`); it does not drive navigation.
- The authored architecture now states that scripted `navigate` arms an
  extension-internal loopback intent, waits for the existing recording send,
  owns the matching commit independently of browser labels, and leaves
  ordinary unarmed recording unchanged (`testing-facility.md:670-675`). This
  accurately describes the final source rather than the superseded CDP work.

## Internal message and sender security

- The only message names are the three `fluxiq.test.*ScriptedNavigation`
  constants. Outside generated bundles, they are referenced only by the
  background control handler, its tests, and the private test runner. They add
  no shared protocol/domain/Core export and are not reachable from gateway or
  server-command routing.
- `isControlPage` requires `sender.id === chrome.runtime.id`, no `sender.tab`,
  and an exact own-extension URL for `sidepanel/index.html` or
  `popup/index.html` (`scripted-navigation-control.ts:6-11`). Content scripts,
  web tabs, another extension, other extension pages, and missing/altered URLs
  fail before manager access. Unauthorized arm/await returns fixed
  `forbidden`; unauthorized cancel remains fixed idempotent success with
  `cancelled:false` (`:21-27`). Closest tests pin both allowed pages, content/
  wrong-extension/other-page rejection, missing URL, unauthorized await, and
  no manager calls.
- The caller never supplies a tab id. `FluxIQConnection` obtains the active tab
  through `ActivePage.tabId()` and the intent accepts only a non-negative safe
  integer (`connection.ts:96-103`; `scripted-navigation-intent.ts:72-85`). No
  response includes that tab id.

## URL, response, and diagnostic safety

- Both runner and extension independently require a bounded HTTP(S) URL whose
  parsed hostname is exactly `127.0.0.1`, `[::1]`, or `localhost`; credentials,
  query, and fragment are rejected, the request is at most 2,048 code units,
  and pathname at most 1,024. Only canonical origin/path is retained. A commit
  may contain query/fragment for destination comparison, but only its origin/
  path is compared and the recorded action uses the validated bare armed URL.
- Arm/await success is exactly `{ok:true,intentId}`, negative arm/await is
  exactly `{ok:false,code}` from the fixed vocabulary, and cancel is exactly
  `{ok:true,cancelled}`. The runner rejects extra response keys and malformed/
  mismatched IDs. The extension reduces gateway rejection to `send_failed` and
  never returns caught text.
- Runner failures use fixed messages and at most an allowlisted `reasonCode`.
  `page.goto`, runtime-message, acknowledgement, late-arm cleanup, and cancel
  errors are never interpolated. URL, opaque ID, response extras, page title/
  data, tab id, token, and browser/gateway error text cannot enter its
  diagnostic objects. The regular validated navigation event is recording
  data by design; it is not copied into control responses or facility errors.
- Intent state is in-memory only, arm-deadline-bounded, removed on await or
  expiry, and never written to extension storage/activity/status. Stop,
  refusal, tab close, disconnect/reset, expiry, destination mismatch, send
  failure, and explicit cancel settle through fixed terminal results; a late
  send cannot overwrite them.

## Unarmed production behavior

`RecordedEventIntake.noteNavigationCommitted` still rejects subframes first.
Its new claim branch returns false when no explicit intent exists, after which
the old reload return, transition classification, click explanation, initial
page grace, duplicate suppression, and ordinary per-tab redirect debounce run
unchanged (`recorded-event-intake.ts:107-118`). The intent has its own 250 ms
debounce and cannot clear an ordinary pending click-landing timer. Lifecycle
calls are no-ops with an empty intent map. Thus merely installing the extension
does not convert, add, or suppress an unarmed navigation.

## Generated tracked bundles

The tracked background bundle contains the final separate intent debounce,
original arm-relative deadline retention, first-refusal intake, lifecycle
cancellation, fixed control handler, and exact sender guard. It contains no
superseded navigation CDP code. A read-only source-map comparison found exact
normalized `sourcesContent` equality for every changed runtime-bearing source:

- background `connection.ts`, `active-recording.ts`,
  `recorded-event-intake.ts`, `scripted-navigation-intent.ts`, `index.ts`,
  `scripted-navigation-control.ts`, and `shared/constants.ts`;
- popup and sidepanel `shared/constants.ts`.

The connection barrel has no emitted runtime body of its own and is correctly
tree-shaken from the map. Popup/sidepanel bundles contain only the shared
constant names; they do not contain the background handler or intent state.
This establishes that the committed tracked bundles correspond to final source
without regenerating or hand-editing them in this audit.

## Verification limit

This is static boundary/security acceptance, not independent functional
verification. The supervisor must still rely on its observed package gates and
the committed W10 live report for runtime acceptance, inspect the final clean
tree, and push only if those gates remain green.
