# i-final-navigation-intent-runner — runner-side intent sequencing

Read-only investigation, 2026-09-13. I read the Week 1 Current State, Stage 4c
brief/report, runner extension-control page wiring, recording sequence,
scripted-navigation/step-runner code, and their closest tests. I made no source,
shared-document, Core, extension, build, Lab, commit, or remote change.

## Conclusion

Replace the rejected CDP transition coercion with one runner driver bound to
the existing extension side-panel control page. The driver must execute this
exact protocol:

1. `fluxiq.test.armScriptedNavigation` with `{ url }`;
2. the scenario page's trusted `page.goto(url)`;
3. `fluxiq.test.awaitScriptedNavigation` with the returned opaque `intentId`;
4. `fluxiq.test.cancelScriptedNavigation` with that ID in cleanup, on success
   or failure.

The extension derives the active automation tab; the runner never supplies a
tab ID. `await` succeeds only after the extension has sent exactly one existing
typed navigation recording event through the gateway. The extension must keep
that terminal result available when the commit/send completes before the
runner begins `await`, then retain it until cancel/expiry. That makes sequential
arm → drive → await safe and avoids an abandoned long-poll while `goto` runs.

## Exact protocol and validation

| Message | Request | Accepted response | Runner validation |
| --- | --- | --- | --- |
| `fluxiq.test.armScriptedNavigation` | `{ type, url }` | `{ ok: true, intentId }` | ID is an opaque bounded string; malformed or negative response fails with a fixed message. |
| `fluxiq.test.awaitScriptedNavigation` | `{ type, intentId }` | `{ ok: true }` | Success means the typed recording-event send resolved, not merely that a commit occurred. |
| `fluxiq.test.cancelScriptedNavigation` | `{ type, intentId }` | `{ ok: true }` | Idempotent; accepted after success, failure, expiry, or an earlier cancel. |

Before arming, parse the destination and require loopback HTTP(S), no username
or password, no query or fragment, and the extension's agreed length bound.
Send only `origin + pathname`. The only current scripted navigation is W10's
fixed loopback history path, so this restriction does not weaken another row.
Do not include the URL, opaque ID, runtime response text, tab ID, page title, or
page data in a `RunnerFailure`, evidence event, or report. Error messages are
fixed; details may carry only an allowlisted reason code and timeout bound.

## One-deadline algorithm

`createScriptedNavigationDriver(extensionControlPage)` returns the function
injected into `ScenarioStepRunner`. For each call:

1. Compute one absolute deadline from `step.timeoutMs ?? 30_000`. All main
   phases consume the remaining duration; none receives a fresh full timeout.
2. Start arm through the extension control page. Race the runtime-message
   promise against the remaining deadline and observe the losing promise.
   If arm responds only after timeout, validate its response and issue a
   bounded best-effort cancel for the late ID.
3. Validate and retain the ID only in local memory. Call
   `page.goto(fullUrl, { waitUntil: "load", timeout: remainingMs })` and await
   it. Playwright owns/cancels this waiter; do not start an independent URL
   waiter. Wrap navigation rejection with a fixed `runtime.behavior` message.
4. With the remaining main deadline, send `await` and require the exact
   success response. This blocks the next recording step until the extension's
   recording-event send has completed. A commit alone is insufficient.
5. In `finally`, when an ID was obtained, always send idempotent cancel under a
   separate short cleanup bound (5 seconds is consistent with the current
   runner's bounded CDP cleanup). Observe any losing message promise.
6. Preserve the first arm/navigation/acknowledgement failure over cancel
   failure or timeout. If arm, navigate, and await succeeded but cleanup fails,
   fail as `extension.worker`: the runner cannot claim it released its intent.

The step's existing `ScenarioStepRunner.run` clock begins before arm and ends
after acknowledgement and cancellation. Thus successful duration includes
arm, actual document load, gateway-send acknowledgement, and terminal-state
cleanup. Failed duration includes attempted cancel. A deadline plus bounded
cleanup may honestly exceed the declared main timeout by at most that cleanup
bound; do not truncate the measured duration.

## Failure design

| Failure point | Category | Fixed meaning / precedence |
| --- | --- | --- |
| Destination rejected locally | `fixture.invalid` | Scenario scripted navigation is outside the loopback/no-query test contract. |
| Arm transport, negative/malformed response, or arm timeout | `extension.worker` | The test-control extension seam could not establish an intent. |
| `page.goto` rejection or timeout | `runtime.behavior` | The fixture page did not perform the scripted navigation; cancel intent. |
| Await negative/malformed response | `recording.persistence` for a fixed extension failure code; `extension.worker` for malformed protocol | A committed navigation was not confirmed as sent, or the control contract itself broke. |
| Await missing at the absolute deadline | `recording.persistence` | The runner did not receive proof that the navigation recording event was sent. |
| Cancel failure/timeout after a primary failure | Preserve primary | Publish no raw cancel response and do not replace the causal failure. |
| Cancel failure/timeout after success | `extension.worker` | Intent cleanup was not confirmed. |
| Arm response arriving after timeout | Preserve arm timeout | Best-effort bounded cancel; its outcome cannot change the returned failure. |

The extension's negative responses should be `{ ok: false, code }` with a
closed, non-sensitive code vocabulary. Runner mapping switches only on that
vocabulary and never interpolates `error`, URL, or message fields. Cancellation,
expiry, recording stop, tab close, and gateway-send failure must settle `await`
negatively rather than leave it pending.

## Exact file partition

Runner implementation can remain confined to these files:

- `packages/test-runner/src/scenario-steps/scripted-navigation.ts`: replace the
  CDP implementation with the extension-control-page-bound factory, URL/response
  validation, absolute-deadline coordination, late-arm cleanup, fixed failure
  mapping, and bounded idempotent cancel.
- `packages/test-runner/src/scenario-steps/tests/scripted-navigation.test.ts`:
  protocol order, deadline, late response, acknowledgement, sanitization, and
  cleanup/precedence tests.
- `packages/test-runner/src/scenario-steps/step-runner.ts`: add one required
  injected `scriptedNavigation(page, url, timeoutMs?)` option and invoke it for
  `navigate`; retain the existing outer timing.
- `packages/test-runner/src/scenario-steps/tests/step-runner.test.ts`: inject a
  fake driver and prove the URL/timeout call plus duration and failed timing.
- `packages/test-runner/src/run-scenario.ts`: import the factory from the
  existing scenario-steps barrel and bind it to `extensionControl` when the
  recording-lane runner is constructed. The runner is already created only
  after pairing, active-tab confirmation, recording start, and
  `recordingState === "recording"`; preserve that order. Combine imports and
  keep this already-baselined file at no net line growth.
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`: static
  sequencing assertion that confirmed recording start precedes driver binding
  and all recording-script steps, and that stop follows the loop.
- `packages/test-runner/src/scenario-steps/index.ts`: no new line should be
  needed because it already exports `scripted-navigation.ts`; rename its
  exported symbol in place.

No Core, domain, manifest, Flow-lane, gateway contract, or evidence schema file
is needed. The runner sends extension-internal test-control messages only; the
extension investigator owns their runtime constants/handlers and exactly-once
state machine separately.

## Required deterministic tests and mutations

1. Exact calls are arm → `goto` → await → cancel; arm URL has no credentials,
   query, fragment, or caller tab ID. Await success occurs after `goto` load.
2. Ack is deliberately held pending after `goto`; the driver and step timing
   remain pending until it resolves, then include the elapsed acknowledgement
   and cancel time.
3. Arm timeout returns promptly; a subsequently resolved arm is cancelled once
   without changing the timeout. All timers/message promises are observed.
4. Navigation rejection cancels once; await is never sent. Await timeout or
   negative response also cancels once.
5. Primary arm/navigation/await failures beat cancel rejection and cancel
   timeout. Cancel failure after otherwise successful acknowledgement becomes
   the fixed `extension.worker` cleanup failure.
6. Malformed/mismatched IDs and arbitrary response error strings cannot appear
   in thrown messages or details. Invalid destination fails before any runtime
   message or navigation.
7. Runner wiring proves the extension reports recording before any intent can
   arm, and `step.complete` cannot publish before acknowledgement/cleanup.
8. Mutations removing await, accepting a malformed acknowledgement, or
   omitting failure-path cancel each fail their targeted row and restore
   byte-identically.

## Live acceptance still required

After both runner and extension halves pass supervisor gates and are pushed at
one downstream pin, rerun W10 primary three times and `broken-link` three times
under loaded Stage 4 conditions. All six recordings must have extension/Core
action counts 2/2 and proposal candidates 2; harness activations and leak
findings remain zero. Primary executes click then navigation and passes all
verdicts. `broken-link` starts at candidate zero, reports the expected
`navigation_unexpected` / `web.navigation.unexpected` first-click failure, and
passes its test verdict. The two complete final benches must restart from
repeat zero only after that targeted proof passes.
