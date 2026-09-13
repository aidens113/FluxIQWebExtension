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

---

## Stage 4j/k delta disposition — 2026-09-13

Read-only delta audit of tip `6b379a909973158e397f85490d866852816a024c`
against the previously accepted `db3cc17` scope.

**Accept. No P1 or P2 boundary/security finding.** Stage 4j admits the exact
tab-hosted extension control document used by the Lab runner without admitting
web/content senders. Stage 4k is a behavior-neutral structure move. The tracked
background bundle and source map match the final source, and neither domain nor
Core contract changed.

### Sender guard

- The only executable security change removes the blanket
  `sender.tab !== undefined` refusal. The guard still requires both
  `sender.id === chrome.runtime.id` and exact equality of `sender.url` with
  this extension's `sidepanel/index.html` or `popup/index.html`. A content
  script has this extension's id and a tab but retains its web frame URL, so it
  remains forbidden; another extension fails the id check; another own
  extension document fails the exact URL check.
- The focused test now models the production runner shape — exact side-panel
  URL plus a tab — as allowed. Its content-sender row now correctly uses a web
  URL plus a tab and remains forbidden with no manager call. The prior audit's
  statement that “no `sender.tab`” is required is superseded by this section;
  exact extension-document identity, not hosting surface, is the boundary.
- Request shapes, fixed negative responses, idempotent unauthorized cancel,
  manager-derived tab identity, loopback URL validation, and diagnostic
  withholding are unchanged.

### Structure move

- Git identifies the implementation move from
  `connection/scripted-navigation-intent.ts` to
  `connection/scripted-navigation/intent.ts` at 100% similarity. The moved
  test is 99% similar because only its subject import changed.
- The new child barrel exports `ScriptedNavigationIntent` from `./intent`; the
  parent barrel, `active-recording.ts`, `recorded-event-intake.ts`, and the
  intake test all point through that child seam. Search finds no old
  `scripted-navigation-intent` source/test import. The parent connection
  directory therefore loses the extra direct file while preserving its public
  export and composition.
- The barrel modules and type-only collaborator imports emit no new runtime
  behavior. Intent validation, state transitions, timers, commit ownership,
  send acknowledgement, and lifecycle cancellation are byte-equivalent to the
  accepted implementation.

### Generated parity and repository boundary

- The tracked background JavaScript diff removes only the generated
  `sender.tab !== void 0` guard term. It retains the runtime-id and two exact
  control-page URL checks. The bundle contains the new
  `scripted-navigation/intent.ts` source-map identity and no old
  `scripted-navigation-intent.ts` identity.
- The final source map's normalized `sourcesContent` equals disk source for
  every runtime-bearing Stage 4j/k file present in the bundle:
  `scripted-navigation-control.ts`, moved `scripted-navigation/intent.ts`,
  `active-recording.ts`, and `recorded-event-intake.ts`. The new/parent barrels
  are correctly tree-shaken, and test files do not ship.
- `db3cc17..6b379a9` changes no `domain/` file and introduces no gateway,
  protocol, package, or Core import/export. The intent remains private
  downstream browser-test infrastructure reusing the existing recording
  event. No FluxIQ Core edit or compatibility action is needed.

This delta audit ran no test, build, Lab, or Core command and changed only this
report. Functional and live acceptance remain the supervisor's gate evidence.
