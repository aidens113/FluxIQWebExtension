# Lane S-D6: the extension and the domain enforce Core's recording-capture policy (t728, audit finding 7)

## Outcome

Done in `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension`. Nothing was committed. Under Core's default policy, behaviour does not change: every capture switch stays as the person set it, and direct requests stay off.

## What changed and why

### Background: new `apps/extension/src/background/capture-policy/`

The directory holds one export per file, a barrel, and tests in `tests/`.

- **`read-capture-policy.ts`, `readCapturePolicy(value)`.** Strict shape check of Core's answer. Every switch must be `{allowed: boolean, default: boolean}` and `directRequests` must be `{allowed: boolean}`. Anything else is `undefined`.
- **`effective-settings.ts`, `effectiveSettings(settings, policy)`.** Returns the person's `FluxIQSettings` with Core's `clampAutomationStudioRecordingCaptureSettings` applied:
  - the three capture flags are clamped
  - `requestsEnabled` becomes the clamp's `directRequests`
  - the person's stored preference is not changed
- **`capture-policy-source.ts`, `CapturePolicySource`.** Calls `get-recording-capture-policy` through an injected `call`, which is wired to `callCoreProgram`, and sends `{projectId}` when one is known.
  - `current()` returns the last policy Core gave, or `AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY` if Core has given none.
  - `refresh()` shares a read that is already under way and never rejects.
  - If Core is unreachable, refuses (`not_paired`, 403), is an older Core without the endpoint (404), or answers with a malformed payload, the source keeps its current policy. That is the default if Core has never answered.
  - It calls `onChange` only when a read changed the policy.
- The endpoint string is written out as a literal. `AUTOMATION_STUDIO_ENDPOINTS` lives in the `fluxiq/automation-studio` barrel, which pulls in `node:crypto`.

### `background/connection.ts`

- Builds a `CapturePolicySource`:
  - `call` is `callCoreProgram(this.coreApiCredentials(), ...)`
  - the project is the active recording's project, otherwise the session's
- New public `effectiveSettings()`. `currentSettings()` still returns the person's own settings, which the panel and the status use.
- `ContentAttachment` and `ActiveRecording` now get `settings: () => this.effectiveSettings()` instead of the raw settings.
- `ContentAttachment` also gets `capturePolicy: () => source.current()`.
- The policy is refreshed fire-and-forget in two places, so neither is held up:
  - on `onSessionReady`
  - at every `startRecording`
- When a refresh changes the policy during a recording, `onChange` resends `setRecordingState(activeTab, true)` so the recorded page picks the policy up. A tab attached later gets it anyway.
- The `.catch` on that resend carries a best-effort comment, which the structure audit requires.

### `background/connection/content-attachment.ts`

- New optional dep `capturePolicy`.
- `setRecordingState` adds `capturePolicy` to the `recording` message beside the clamped settings.

### `content/message-handler.ts`, the second fence

- When a `recording` message arrives, the requested flags are clamped again with Core's clamp. The requested flags are each message flag, or the current value when the message omits it, as before.
- The clamp uses the policy carried in the message, or Core's default when none came. Messages with `recording: false` from `active-recording.ts` carry no policy, but their settings are already clamped.
- If a carried policy has a malformed or missing part, that part counts as forbidden, so the fence fails closed.
- Under the default policy the result equals the old assignments for boolean inputs.

### Hard-coded `requestsEnabled = false` replaced with Core's clamp

`requestsEnabled` is now on only when the policy allows direct requests and the value is exactly `true`.

- **`background/saved-state.ts`:** `readSavedSettings(stored, defaults, policy = Core default)`.
  - `requestsEnabled` is now `clamp({directRequests: stored === true}, policy)`.
  - The field is reported repaired when the stored value differs from the clamped one. Under the default this is the same rule as before.
- **`background/panel/settings-save.ts`:** `mergeSettings(current, requested, policy = Core default)`.
  - `requestsEnabled` is clamped from the current value.
  - A boolean `requested.requestsEnabled` is honoured only through the clamp.
- **`panel/settings/draft-store.ts`:** the draft's `requestsEnabled`, both parsed and written, goes through the clamp under Core's default policy.
- **`panel/settings/form-fields.ts`:** each switch's `disabled` comes from `forbidden(POLICY.<switch>.allowed)`, using Core's default policy.
  - Direct requests: disabled, as before.
  - Capture switches: enabled, as before.
  - `address-form.ts`, which I did not change, already renders `disabled` and saves a disabled switch as off.

### Domain: `domain/src/requests/policy/validation.ts` and `contracts.ts`

- `normalize(input, capturePolicy = Core default)` and `register(owner, input, capturePolicy?)`.
- The input is still validated whole, so `enabled: true` without an exact HTTPS origin still throws.
- The output's `enabled` is `clamp({directRequests: enabled}, capturePolicy).directRequests`. Under Core's default, every domain request policy now comes out with `enabled: false`.
- This changes no runtime behaviour. `enabled` was never an execution grant: capabilities never include `web.request`, and `canExecute("web.request")` is false.
- Conflict detection still works for the existing cases, because origins differ.
- The contract doc comment says so.

## Tests added or updated

- `background/capture-policy/tests/read-capture-policy.test.ts`: 2 tests.
- `background/capture-policy/tests/effective-settings.test.ts`: 2 tests.
- `background/capture-policy/tests/capture-policy-source.test.ts`: 4 tests. They cover:
  - default before any answer, the endpoint and the project payload
  - no project
  - unreachable, throwing, malformed and 404 answers
  - keeping the last policy, `onChange` only on a change, and a shared read under way
- `background/tests/saved-state.test.ts`: a policy-allowing case.
- `background/panel/tests/settings-save.test.ts`: a policy-allowing case.
- `panel/settings/tests/connection-settings.test.ts`: capture switches are enabled under the default.
- `domain/src/requests/policy/tests/validation.test.ts`:
  - the existing assertion `enabled === true` changed to `false`, because Core's default forbids direct requests
  - an allowing-policy case was added
  - a new test for normalize and register under each policy

## Commands run and observed results

- In `apps/extension`, `EXTENSION_TEST_BUILD_LABEL=lane-s-d6 node scripts/test-extension.mjs background/capture-policy/tests background/tests/saved-state background/panel/tests/settings-save panel/settings/tests background/tests/connection-status background/connection/tests/active-recording background/connection/tests/core-api` printed `# tests 123  # pass 123  # fail 0`.
- In `apps/extension`, `EXTENSION_TEST_BUILD_LABEL=lane-s-d6 node scripts/test-extension.mjs background/connection/tests background/tests background/panel/tests` printed `# tests 411  # pass 411  # fail 0`.
- In `domain`, `DOMAIN_TEST_BUILD_LABEL=lane-s-d6 node scripts/test-domain.mjs requests` printed `# tests 10  # pass 10  # fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension check` exited 0. It printed "core-build: FluxIQ Core's build ... is current with its source."
- `pnpm --filter @fluxiq-web-extension/domain check` exited 0.
- `node scripts/structure-audit.mjs`:
  - first run: 1 FAIL, `[swallowed-failure]` on my new `.catch(() => undefined)` in `connection.ts`
  - I added a best-effort comment
  - rerun: `structure-audit: passed (209 warning(s), 638 baselined)`, with no warnings naming any file I changed
- The extension check ran before the comment-only edit to `connection.ts`. I did not rerun it after that edit.

## Not verified

- No live browser validation. Not exercised:
  - a real `get-recording-capture-policy` round trip against Core
  - a content script receiving the new `capturePolicy` field
  - a policy change mid-recording
- `content/message-handler.ts` cannot be imported in the Node test runner because it touches the DOM and `chrome` on load, so the second fence has no unit test. Its logic is Core's clamp plus a small policy guard.
- I did not run the full suites, per the repository's validation rule.

## Open questions or contradictions found

- **The panel uses only Core's default policy, not the live one.** `form-fields.ts` and `draft-store.ts` decide from Core's default. A stricter live policy is enforced where it matters, in the background clamp and the content fence, but the panel would not show its switches disabled. Showing that needs the policy in `ExtensionStatus` (`shared/protocol.ts`) and dynamic disabling in `panel/settings/address-form.ts`, and neither file was mine. Similarly, `mergeSettings` and `readSavedSettings` take a policy parameter, but their callers (`panel-control-deps.ts`, `storage.ts`) still pass none, so they use the default.
- **Lane G's force-false stays.** `background/storage.ts` still forces `requestsEnabled: false` on write and read. Even under a Core policy that allows direct requests, a stored `true` would not survive until lane G routes it through the clamp.
- **The gateway hello still sends raw capture flags.** `background/connection/gateway-session.ts` (lane G) sends the person's raw capture flags in its hello (`settings: () => this.settings` in `connection.ts`). I left the gateway on the raw settings, as the brief named only content-attachment and active-recording. Handing it `recordingSettings` would be a one-line change in `connection.ts` if Core should see the clamped flags. The policy is not fetched yet at first hello in any case.
- **A failed read keeps the last policy.** After Core has answered once, a later failed read keeps that policy rather than reverting to the default. The brief's "fall back to the default when Core cannot be reached" is applied only while no policy has been heard. I chose this so that a stricter policy is not lost when Core briefly cannot be reached.
- **The domain behaviour change for `enabled: true`.** The domain's `enabled: true` request policies, including the hosts' and the tests' callers, now normalize to `enabled: false` under Core's default. This is what the brief asked for. It has no execution effect, but any caller that reads `policy.enabled` will now see false.
