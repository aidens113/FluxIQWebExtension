# f-final-navigation-intent-runner

## Stage 4g review corrections

The three findings in `i-final-navigation-intent-runner-review` are resolved:

- `beforeDeadline` now observes its promise immediately on entry, before
  reading the clock. A runtime-message promise created as the deadline expires
  therefore cannot reject unhandled even when the helper returns without
  entering its normal race.
- Arm success, acknowledgement success, cancellation success, and closed
  negative responses now require their exact own-key sets. Extra response
  fields are malformed protocol and no unexpected value is exposed.
- The timer harness records requested delays. Focused tests now directly prove
  the acknowledgement receives the main deadline remainder, a deadline-edge
  acknowledgement rejection is observed, acknowledgement transport rejection
  maps to fixed `extension.worker` and still cancels, and extra own fields are
  rejected for every response shape.

Stage 4g validation:

- `pnpm --filter @fluxiq-web-extension/test-runner check`: **passed**.
- Focused scripted-navigation, step-runner, and runner-wiring suite: **27
  passed, 0 failed**.
- `git diff --check` on the two corrected files: **passed** (only repository
  CRLF conversion notices).

The restored `scripted-navigation.ts` SHA-256 is
`F3B3BB95479D127F953C165558EF85CFB9FFCF7B5812B5D68F7809418FB09B2C`.
I removed only the immediate promise observer and ran the scripted-navigation
suite. The deadline-edge row failed with `unhandledRejection`: **12 passed, 1
failed**. Restoring the observer returned the file exactly to that hash; the
package check and full 27-row focused set above passed after restoration.

No extension, Core, shared-document, Lab, commit, or remote operation was part
of Stage 4g.

Date: 2026-09-13  
Outcome: Complete for the bounded runner implementation; live acceptance remains unverified.

## Implemented

- Replaced the Chromium CDP navigation adapter with
  `createScriptedNavigationDriver(extensionControlPage)`. It validates and
  canonicalizes a loopback HTTP(S) destination locally, then sends exactly
  arm -> `page.goto(..., { waitUntil: "load" })` -> await -> cancel. Requests
  contain no caller tab id.
- Arm, goto, and acknowledgement share one absolute deadline (30 seconds by
  default). A timed-out arm is observed and a valid late ID is cancelled under
  a separate bounded cleanup timeout. Every acquired ID is cancelled once in
  `finally`, including after successful acknowledgement.
- Responses are checked against the exact success shapes and the extension's
  closed failure-code vocabulary. Failures expose only fixed text and an
  allowlisted `reasonCode`; response text, URLs, opaque IDs, tab IDs, and page
  data do not enter diagnostics.
- Navigation failure is `runtime.behavior`, a known negative acknowledgement
  is `recording.persistence`, and malformed/transport arm or acknowledgement
  behavior is `extension.worker`. A primary failure wins over cleanup rejection
  or timeout; cleanup failure after otherwise successful work is
  `extension.worker`.
- `ScenarioStepRunner` now requires the injected driver and retains its outer
  timing boundary, so step completion follows acknowledgement and cleanup.
  `runScenario` constructs the control-page-bound driver only after the
  extension's recording-state poll has succeeded.

## Files changed

- `packages/test-runner/src/scenario-steps/scripted-navigation.ts`
- `packages/test-runner/src/scenario-steps/tests/scripted-navigation.test.ts`
- `packages/test-runner/src/scenario-steps/step-runner.ts`
- `packages/test-runner/src/scenario-steps/tests/step-runner.test.ts`
- `packages/test-runner/src/run-scenario.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
- This report

The existing `scenario-steps/index.ts` barrel already exported the navigation
module and did not need a change.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check` — pass.
- `pnpm exec tsx --test packages/test-runner/src/scenario-steps/tests/scripted-navigation.test.ts packages/test-runner/src/scenario-steps/tests/step-runner.test.ts packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
  — pass, 24/24.
- `git diff --check` — pass for content (only repository line-ending notices).

The focused tests cover exact protocol ordering, post-load acknowledgement,
absolute-deadline subtraction, late-arm cancellation, navigation and
acknowledgement failures, cleanup rejection/timeout precedence, response
sanitization, local URL refusal before side effects, injected timeout routing,
honest step timing, and recording-confirmed production sequencing.

## Mutation proofs

The source SHA-256 before both mutations was
`A513F467C4257E1723BAF641C150646955D38AE51929A9211F839CF52CB7A2D8`.

1. Replaced the await message type with cancel (removing the acknowledgement
   operation), then ran the exact-order row. It failed exit 1 with
   `The extension returned an invalid scripted navigation acknowledgement`.
2. Changed failure cleanup from `if (intentId)` to
   `if (intentId && primaryFailure === undefined)`, then ran the navigation
   rejection row. It failed exit 1 because the last call was `goto`, not the
   expected `fluxiq.test.cancelScriptedNavigation` request.

Both mutations were restored with `apply_patch`; after each restoration the
source SHA-256 was again exactly
`A513F467C4257E1723BAF641C150646955D38AE51929A9211F839CF52CB7A2D8`.
The full focused suite and package check above passed after restoration.

## Not verified

I did not run a package build, the Lab, a live browser, W10, a full package test
suite, extension tests, or Core tests. The required live acceptance must show
W10 primary and `broken-link` 3/3 each with two extension/Core actions, two
proposal candidates, the primary click then navigate success, the expected
variant first-click failure, and zero harness activations or leak findings.

I made no extension, domain, Core, or shared-working-document source change,
and did not commit or push.
