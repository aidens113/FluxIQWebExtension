# Lane S-F5: saved settings and the gateway hello follow Core's recording-capture policy (t728 follow-up 5)

## Outcome

Done in `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQWebExtension`. Nothing was committed.

Under Core's default policy, behaviour is identical to before:
- direct requests are saved off;
- the hello reports the person's three capture switches unchanged, because the default policy allows all three.

## What changed and why

- **`apps/extension/src/background/storage.ts`**
  - `normalizeSettings` no longer forces `requestsEnabled: false`. It sets `requestsEnabled` to `clampAutomationStudioRecordingCaptureSettings({directRequests: stored === true}, policy).directRequests`.
  - `readSettings(policy?)` and `writeSettings(settings, policy?)` take an optional policy. It defaults to `AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY`.
  - The policy is also passed to `readSavedSettings` and to the write-back after a repair.
  - Every existing caller passes no policy, so each one keeps today's result: requests off.
  - The capture switches are not clamped here. They are the person's stored preference, and the recorder clamps them when it uses them (`capture-policy/effective-settings.ts`). This matches D6.
- **`apps/extension/src/background/connection/gateway-session.ts`**
  - New required dep `effectiveSettings: () => FluxIQSettings`.
  - The hello's `metadata.settings` is now built from `deps.effectiveSettings()` instead of `deps.settings()`.
  - `settings` is still used for `gatewayUrl` and `autoReconnect`.
- **`apps/extension/src/background/connection.ts`** (where the session's deps are built)
  - Passes `effectiveSettings: recordingSettings`. That is the existing `() => this.effectiveSettings()`, backed by D6's single `CapturePolicySource`.
  - No second policy read was added.
- **`capture-policy/**`** was not changed.

## Tests

- `background/tests/storage-settings.test.ts`
  - The existing default-policy test is unchanged and still passes.
  - New test: a policy that allows direct requests saves and reads `requestsEnabled: true`.
  - New test: the capture switches are saved as the person chose them.
  - New test: a read with no policy gives requests off.
  - New test: the clamp never turns requests on.
- `background/connection/tests/gateway-session.test.ts`
  - The harness gets an optional `policy`. Its `effectiveSettings` is the real D6 `effectiveSettings(PERSON_SETTINGS, policy ?? Core default)`.
  - The existing hello test passes unchanged under the default.
  - New test: a policy that forbids snapshots makes the hello report `captureSnapshots: false`, while the person's setting stays `true`.
- `background/connection/host-lease/tests/gateway-carriage.test.ts`
  - Got the new required dep, one line. This file was not named in the brief, but it builds `GatewaySessionDeps`, so it would not compile without the change.

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=lane-s-f5 node scripts/test-extension.mjs background/tests/ background/connection/tests/ background/capture-policy/`
  - Result: `# tests 361 # pass 361 # fail 0`.
  - Ran and passed: "the hello reports the settings under Core's policy, not the person's raw switches" (ok 138) and "settings storage applies Core's clamp: ..." (ok 352).
- Same script on `background/connection/host-lease/tests/`: `# pass 11 # fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (208 warning(s), 625 baselined).`
- `pnpm --filter @fluxiq-web-extension/extension check`: **refused by its Core-freshness gate**, exit 1.
  - First run: "Core's build ... is not current with its source. Stale: ... inputs changed: packages/fluxiq".
  - Second run: "no stamp".
  - The Core worktree holds another worker's uncommitted edits (`packages/fluxiq/.../build-purse`, `ui/activity-status`, `apps/web/.../activity`), and someone rebuilt Core's dist while I ran.
  - Core is read-only for me, so I did not rebuild it.
- `node scripts/check-extension.mjs` (the typecheck run directly, after that dist rebuild finished): exit 1. The only error is `src/background/activity/activity-relay.ts(143,36)`: `ActivityPacerOptions` now requires `hostWords`.
  - That error comes from the concurrent Core change, in a file this brief excludes (`background/activity/**`).
  - None of my files reported an error.

## Not verified

- A clean pass of the gated `pnpm --filter @fluxiq-web-extension/extension check`. It needs a current Core build and the `activity-relay.ts` fix from the activity worker.
- Live browser behaviour: the hello seen by a real gateway, and settings saved from the panel.
- No caller passes a non-default policy to `readSettings`/`writeSettings` yet.
  - Saved settings follow Core's default until a caller with a known policy chooses to pass one.
  - The hello already uses the live policy.

## Open questions or contradictions found

- Should panel saves (`panel-control-deps.ts`, `index.ts` settings messages) pass `CapturePolicySource.current()` to `writeSettings`, so that a policy allowing direct requests can persist the person's choice? This brief did not ask for it. D6's `mergeSettings` and `readSavedSettings` also still clamp under the default.
- The activity worker's `activity-relay.ts` needs `hostWords` to match the Core change that is in progress.

---

# Follow-up: saved settings use the live policy, and the panel shows what Core allows

## Outcome

Done. Nothing was committed. Under Core's default policy the extension behaves as before: same values saved, same disabled switches, same hints, same e2e text "Unavailable in this version.".

## What changed and why

### Background: every read and write of saved settings uses the live policy

All paths below use the live policy from D6's single `CapturePolicySource`. They fall back to Core's default only when no policy is known.

- **`background/connection.ts`**
  - New `currentCapturePolicy()`, which returns `CapturePolicySource.current()`.
  - `status()` adds `captureAllowed: allowedCapture(policy)`.
  - The source's `onChange` now also calls `emitStatus()`, so an open panel updates when the policy changes.
- **`background/panel/panel-control.ts`**
  - New dep `capturePolicy`.
  - The save path calls `mergeSettings(read, requested, deps.capturePolicy())`.
- **`background/panel/panel-control-deps.ts`**
  - `readSettings` and `writeSettings` are wrapped to pass `connection.currentCapturePolicy()`, read on every call.
  - It also supplies the `capturePolicy` dep.
- **`background/index.ts`**
  - The `connect` path reads and writes with `manager.currentCapturePolicy()`.
  - `onInstalled` uses the connection's policy if one is already built, otherwise Core's default.
  - `buildConnection` has no connection yet, so it uses Core's default (commented).
- **`background/capture-policy/allowed-capture.ts`** (new, exported from the barrel): `allowedCapture(policy)` reduces Core's policy to the four `allowed` booleans.

### Protocol

- **`shared/protocol.ts`**
  - New `ExtensionCaptureAllowed`: `{captureMutations, captureInputValues, captureSnapshots, directRequests}`, all booleans.
  - New optional `ExtensionStatus.captureAllowed`, carried on the status the panel already receives. If it is absent, the panel uses Core's default.
  - The doc comment on `requestsEnabled` now says it follows the policy.

### Panel

- **`panel/settings/form-fields.ts`**
  - Each switch Core governs now carries `policy`, `allowedHint` and `forbiddenHint`.
  - `disabled` and `hint` still describe Core's default exactly, so existing tests and the e2e spec are unchanged.
  - The forbidden reason for a capture switch is "Turned off by FluxIQ's recording policy.".
  - The requests toggle shows "Unavailable in this version." when forbidden and "Lets a Flow call a site's addresses directly." when allowed. The allowed wording is mine and the supervisor may want to review it.
- **`panel/settings/toggle-view.ts`** (new, exported from the barrel): `toggleView(field, allowed)` returns `{disabled, hint}`.
- **`panel/settings/address-form.ts`**
  - New `allow(allowed)` on the form. It sets each switch's disabled property and attribute, swaps its hint text, and unchecks a forbidden switch.
  - `read` and `fill` treat a switch as forbidden based on the current policy, no longer the static field.
- **`panel/settings/settings-view.ts`**: one line in `render`, `form.allow(status.captureAllowed)` before `fill`. This file was not named in the follow-up, but it is the only place the form meets the status.

## Tests

- `background/panel/tests/panel-control.test.ts`
  - The harness takes a policy.
  - New test: a save keeps `requestsEnabled: true` when the policy allows it, and saves `false` under Core's default.
- `background/tests/connection-status.test.ts`: new test that the status carries the default `captureAllowed`, and that `currentCapturePolicy()` is Core's default.
- `background/capture-policy/tests/allowed-capture.test.ts` (new).
- `panel/settings/tests/policy-toggles.test.ts` (new):
  - `toggleView` under no policy or the default equals `SETTING_FIELDS`;
  - a forbidden switch gets its reason, and requests follow `directRequests.allowed`;
  - the form disables, explains and reads off a forbidden switch, then restores it under the default;
  - the settings screen applies `status.captureAllowed`.

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=lane-s-f5 node scripts/test-extension.mjs background/ panel/settings/`: `# tests 618 # pass 618 # fail 0`. Every new test appears as `ok`.
- `node scripts/structure-audit.mjs`
  - First run: one `statement-packing` violation in my new test.
  - After the fix: `structure-audit: passed (208 warning(s), 625 baselined).`
- `node scripts/check-extension.mjs`, the typecheck run directly against Core's current dist: exit 0.
- `pnpm --filter @fluxiq-web-extension/extension check`
  - At first: refused, "Core's build ... is not current with its source ... inputs changed: packages/fluxiq". Core still had uncommitted edits in progress from another worker.
  - Retry: a background loop waits for Core's freshness gate to pass, then runs the gated check. Its result is in the return contract.

## Not verified

- Live browser behaviour, both the panel and the hello.
- A real non-default policy coming from Core end to end. Only unit tests with injected policies were run.

## Open questions or contradictions found

1. **Requests choice lost on restart.** The background reads storage before any policy is known (`buildConnection`). D6's `readSavedSettings` treats a stored `requestsEnabled: true` under Core's default as a repair and writes back `false`. So under a policy that allows direct requests, the person's choice is lost on every worker restart until they save again.
   - This fails closed: effective settings stay correct.
   - Fixing it means `saved-state.ts` should clamp the returned value without rewriting storage when no policy is known. That is a D6 file, not mine.
2. **Panel draft.** `panel/settings/draft-store.ts` still clamps a draft's `requestsEnabled` under Core's default. Under an allowing policy, a ticked requests box survives the Firefox popup closing only after Save. The background clamp is authoritative either way.

### Gated check retry result

- The background loop polled `scripts/check/core-build.mjs` every 30 s for 20 minutes (40 tries). The gate never passed.
- At the end, `pnpm --filter @fluxiq-web-extension/extension check` still refused: "Stale: ... inputs changed: packages/fluxiq", EXIT 1. Other workers' Core edits are still uncommitted and have not been rebuilt.
- I did not rebuild Core.
- Right afterwards, `node scripts/check-extension.mjs` (the same typecheck, run without the gate) against the current Core dist exited 0.

---

# Follow-up 2: a stored choice is never overwritten by a read made before the policy is known

## Outcome

Done. Nothing was committed.

- **Stored value:** the stored direct-requests choice is kept exactly as the person set it.
- **Where the policy applies:**
  - when settings are used: the effective settings behind the hello, the content attachment and the recorder, all unchanged and already clamped;
  - when a save is made under the policy Core gave this connection.
- **Under Core's default:**
  - requests stay effectively off;
  - a save can neither turn requests on nor overwrite a stored choice;
  - the panel shows the switch disabled and unchecked, as before.

This replaces part of follow-up 1. Storage no longer takes a `policy` argument, and the wrappers in `panel-control-deps` were reverted.

## What changed

- **`background/saved-state.ts`**
  - `readSavedSettings(stored, defaults)` no longer takes a policy and no longer clamps.
  - `requestsEnabled` is read like every other switch:
    - a stored boolean is kept;
    - a missing value takes the default, `false`;
    - a mistyped value becomes the default and is reported repaired.
  - A stored `true` is no longer treated as a repair, so nothing is written back.
- **`background/storage.ts`**
  - `readSettings()` and `writeSettings(settings)` no longer take a policy.
  - Normalising only coerces the choice to a boolean (`=== true`) and keeps the existing legacy-address fix.
- **`background/capture-policy/requests-choice.ts`** (new, in the barrel)
  - `requestsChoice(stored, requested, policy)` returns the requested boolean only when Core's clamp says direct requests are allowed (`clamp({directRequests: true}, policy)`).
  - Otherwise it keeps the stored value. A disabled switch reads as off in the form, so applying a clamped `false` would erase the choice.
- **`background/panel/settings-save.ts`**: `mergeSettings` no longer clamps the current value and uses `requestsChoice` for the requested one.
- **`background/index.ts`**: the `connect` path also uses `requestsChoice` with `manager.currentCapturePolicy()`. `onInstalled` and `buildConnection` are back to plain reads and writes.
- **`background/panel/panel-control-deps.ts`**: plain `readSettings`/`writeSettings` again. The `capturePolicy` dep stays and decides what a save may change.
- **`panel/settings/draft-store.ts`**
  - The draft keeps the request switch as the form read it, as a boolean. The form reads a forbidden switch as off.
  - The default-policy clamp that discarded a ticked box was removed.
- **`apps/extension/e2e/runtime/tests/requests-settings.spec.ts`** (Playwright, not run)
  - The last step stored `requestsEnabled: true`, restarted the worker, and expected storage to be rewritten to `false`. That assertion encoded the behaviour this follow-up removes.
  - It now expects the stored `true` to survive, while the checkbox stays disabled and unchecked.
  - The earlier steps are unchanged:
    - a panel save asking for requests under the default still leaves storage `false`;
    - the switch is still disabled and shows "Unavailable in this version.".

## Tests (written alongside the change)

- `background/tests/storage-settings.test.ts`, rewritten:
  - **Restart test:** a stored `requestsEnabled: true` read before any policy comes back as `true`, nothing is written back, and storage still holds `true`.
  - Effective settings under Core's default give `false`; under an allowing policy they give `true`.
  - Writes keep the person's choices and coerce a non-boolean to `false`.
- `background/tests/saved-state.test.ts`
  - The stored choice is read as set and never repaired away. Only a mistyped value is repaired.
  - The malformed-fields test no longer lists `requestsEnabled` as repaired when it is missing.
- `background/panel/tests/settings-save.test.ts`: under the default, a save never changes the stored choice (for both stored values, across all request shapes) and cannot turn requests on. The allowing-policy test is unchanged and passes.
- `background/capture-policy/tests/requests-choice.test.ts` (new).
- `panel/settings/tests/connection-settings.test.ts`: drafts keep the switch as a boolean, and the field is still disabled with "Unavailable in this version." under the default.

## Commands run and observed results

- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=lane-s-f5 node scripts/test-extension.mjs background/ panel/settings/`: `# tests 617 # pass 617 # fail 0`. All the new tests are listed as `ok`.
- `... test-extension.mjs background/capture-policy/`: `# pass 10 # fail 0`, including requests-choice.
- `node scripts/check-extension.mjs`: exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (208 warning(s), 625 baselined).`
- The gated `pnpm --filter @fluxiq-web-extension/extension check` was not run, as the lead instructed. The lead runs it after Core's rebuild.

## Not verified

- The updated Playwright spec `requests-settings.spec.ts` was not run, because it needs a browser.
- Live panel behaviour.

## Open questions

- Raw `currentSettings()` now carries `requestsEnabled: true` when the person stored it under a forbidding policy, and the status sends those settings to the panel.
  - The panel unchecks a forbidden switch.
  - In the extension, the only consumer of `requestsEnabled` is `effective-settings.ts`, which clamps it.
  - Any future consumer of the raw value must go through effective settings.
