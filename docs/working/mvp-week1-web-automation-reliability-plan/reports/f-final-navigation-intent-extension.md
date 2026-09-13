# f-final-navigation-intent-extension — acknowledged scripted navigation (extension)

Implemented 2026-09-13 within the Stage 4e extension partition. No runner,
domain, Core, shared working document, Lab, commit, or remote change was made.

## Outcome

The extension now owns a test-control-only scripted-navigation intent:

- Arm accepts one bounded bare loopback HTTP(S) URL, derives the current
  automation tab inside `FluxIQConnection`, and returns only an opaque id.
- That tab's next top-frame commit gets first refusal before browser
  transition/reload classification. Every browser label uses the existing
  `NavigationRecorder.schedule` debounce, so a redirect burst still replaces
  the earlier commit.
- A matched settled commit re-enters the public recording intake exactly once
  as the existing `browser.navigation` / `transition: "typed"` event, using the
  validated arm URL rather than query, fragment, credentials, or commit data.
- Await succeeds only after that existing recording-event path resolves. A
  failed send is reduced to `send_failed`; no caught text crosses the control
  response.
- The intent expires after 30 seconds, retains a terminal result for a bounded
  late await, and cancels safely on explicit cancel, recording stop/refusal,
  tab close, disconnect, and reset-through-disconnect. Terminal state wins over
  a late send.
- Only this extension's sidepanel and popup pages, with no sender tab, may use
  the three control messages. Cancel remains idempotent and fixed-shape even for
  an invalid or unauthorized id.

Unarmed commits retain the previous typed/page/other, reload, initial-page,
click-explanation, and redirect rules. The domain/Core wire event is unchanged.

## Files

Source:

- `apps/extension/src/background/connection/scripted-navigation-intent.ts`
- `apps/extension/src/background/connection/recorded-event-intake.ts`
- `apps/extension/src/background/connection/active-recording.ts`
- `apps/extension/src/background/connection/index.ts`
- `apps/extension/src/background/connection.ts`
- `apps/extension/src/background/scripted-navigation-control.ts`
- `apps/extension/src/background/index.ts`
- `apps/extension/src/shared/constants.ts`

Tests:

- `apps/extension/src/background/connection/tests/scripted-navigation-intent.test.ts`
- `apps/extension/src/background/connection/tests/recorded-event-intake.test.ts`
- `apps/extension/src/background/connection/tests/active-recording.test.ts`
- `apps/extension/src/background/tests/scripted-navigation-control.test.ts`

No navigation-recorder source/API change was needed; the existing `schedule`
and `noteRecordedTab` seams were sufficient, so its optional test stayed
unchanged.

## Focused coverage

The added rows cover strict loopback/bare URL validation; missing recording or
tab; one-live-intent busy behavior; top-frame/tab ownership; `typed`, `link`,
other, and `reload` labels; redirect replacement; destination mismatch;
exactly-one public-intake event; deferred-send acknowledgement; cancellation
winning over late send; expiry; recording stop; tab close; unknown/idempotent
cancel; timer cleanup; and sidepanel/popup sender authorization.

An initial state-machine test correctly exposed a test assumption: a committed
URL can carry query/fragment even though an arm request cannot. Commit matching
now reads only canonical origin/path, while the emitted action URL remains the
validated bare arm destination. The first complete integration run then
exposed a missing `noteRecordedTab` method on the intake test stub; the stub was
made faithful. Neither issue changed an unowned production rule.

## Validation

- `EXTENSION_TEST_BUILD_LABEL=f-final-navigation-intent-restored pnpm --filter
  @fluxiq-web-extension/extension check`: **passed**.
- Restored private extension smoke and unit run: **476 passed, 0 failed**.
- `git diff --check` over the owned extension partition: **passed** (only the
  repository's CRLF conversion notices were printed).

### Mutation A — first-refusal early return

Pre-mutation SHA-256 for `recorded-event-intake.ts`:
`2A0133E65ADDE7D49FE1D0B33DD2EEC8D6BF14FBE3CE0ED56FBA909735B2EE58`.

I removed only the return after an intent claimed a commit. The private suite
then produced **475 passed, 1 failed**. The failing row was `an owned commit has
first refusal and re-enters once as typed, whatever its browser label`, which
observed the duplicate ordinary path. Restoring the return returned the file
exactly to the SHA-256 above.

### Mutation B — post-send acknowledgement

Pre-mutation SHA-256 for `scripted-navigation-intent.ts`:
`C99BCA79962D46FDD7B8FC7844FF78A5CD69EFD63276E7BCD7463EB8EB196B4D`.

I moved successful completion before awaiting the deferred recording send. The
private suite then produced **475 passed, 1 failed**. The failing row was
`acknowledgement waits for send and cancellation wins over a late send`.
Restoring the await-before-completion order returned the file exactly to the
SHA-256 above.

The final package check and 476/476 private run were performed after both exact
restorations.

## Not verified

No browser or Lab run was authorized. The supervisor must integrate the runner
half, independently review this extension boundary, then run the targeted W10
primary and `broken-link` proof before restarting the final benches.

## Stage 4g review corrections

Outcome: complete for the bounded review findings.

- `ScriptedNavigationIntent` now owns a separate 250 ms redirect debounce and
  no longer calls `NavigationRecorder.schedule`; an ordinary pending click
  landing and the scripted redirect-settled callback survive independently.
- Each intent stores its original arm-time deadline. Separate expiry,
  debounce, and retention timers keep terminal retrieval inside that original
  30-second lifetime rather than restarting it.
- Added deterministic pending-landing/two-commit, original-deadline,
  `send_failed`, composed deferred gateway-send acknowledgement, recording
  stop/refusal, tab-close/disconnect, and sender-security regressions.

Final validation after restoration:

- `EXTENSION_TEST_BUILD_LABEL=f-final-navigation-intent-review-fixes pnpm
  --filter @fluxiq-web-extension/extension check` — passed.
- Focused `tsx --test` run over the four changed suites — passed, 41/41.

Mutation: temporarily restoring the production shared scheduler made
`ordinary landing and intent redirect debounces survive independently exactly
once` fail exit 1 (one callback observed, two required). `apply_patch`
restoration returned the three mutated files byte-exactly to SHA-256
`13AFD9ED3D3721C278183E396B33DDF9C12DEB9CCC3FEE117ED8167513B94D38`,
`4BED54BA1C70457E2FD70C212A25823ADE7D350E0EC69126103FE409B090D0B5`, and
`8484F894BFFCECC089374975BE459DA319831DFE3E0F7C18FB982C939556023F`; final check and
focused tests then passed.

No Lab, live browser, build, complete extension suite, Core/domain/runner
validation, commit, or push was performed. W10 primary and `broken-link` 3/3
remain the required live acceptance.
