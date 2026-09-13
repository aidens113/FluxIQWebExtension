# Report: f-final-scripted-navigation-transition

Worker report, amended twice on 2026-09-13 after
`i-final-scripted-navigation-review`. I changed only the five owned downstream
test-runner source/test files and this report. No Core, extension runtime,
shared working document, Lab, commit, or remote change was made.

## Outcome: amended implementation passes focused validation

Scripted `navigate` now sends Chromium CDP
`Page.navigate({ url, transitionType: "typed" })`. The former 5,250 ms timing
barrier and `page.goto` are gone. Unsupported CDP fails closed as
`environment.missing`; there is no nondeterministic fallback.

The amended adapter closes all four review findings:

1. One 30-second default or scenario-supplied deadline covers CDP session
   acquisition, `Page.enable`, `Page.setLifecycleEventsEnabled`,
   `Page.navigate`, and the resulting load.
   A pending command settles as `runtime.behavior`, then cleanup removes the
   listener/timer and attempts session detach.
2. Before the command, the adapter subscribes to `Page.lifecycleEvent`. It
   accepts `name="load"` only for the exact `frameId` and new `loaderId`
   returned by `Page.navigate`. A page already at the target cannot satisfy
   this identity check. A matching event arriving before the command response
   is buffered and accepted; unrelated redirect-loader events are ignored.
   A same-document response with no loader is rejected explicitly.
3. The document waiter is adapter-owned rather than Playwright-owned. Every
   exit clears its single timer and removes its lifecycle listener. Early
   command/protocol failures therefore leave no waiter, subscription, or
   timeout alive. The still-pending operation after a deadline has a rejection
   observer, while detach contains the real CDP command. If session acquisition
   resolves only after its deadline, the late session is detached through the
   same bounded cleanup helper without changing the reported timeout.
4. Protocol rejection requires a non-empty string `errorText`. Empty and
   explicitly undefined properties remain success-shaped. Primary command,
   protocol, and load failures retain precedence over simultaneous detach
   failure; detach failure after otherwise successful navigation remains
   `environment.missing`. Detach itself has a separate five-second cleanup
   bound, so a stalled transport cannot hold the Lab row indefinitely.

`ScenarioStepRunner` passes an explicit scenario timeout when present and
otherwise uses the adapter's 30-second navigation default. Its existing timing
still encloses setup, command, resulting load, and cleanup. The scenario-steps
barrel exports the focused adapter.

## Deterministic regressions

The adapter suite covers exact setup/request ordering; already-current URL;
load before command response; unrelated redirect-loader noise; hung command
deadline; command/protocol cleanup while the document remains pending; empty
and undefined `errorText`; missing loader; all three primary-failure precedence
paths including load timeout; unsupported CDP; and successful-navigation
detach failure; pending session acquisition plus late-session cleanup; and
pending detach after both success and primary failure. The step-runner suite
covers production wiring and honest timing.

## Validation

- `EXTENSION_TEST_BUILD_LABEL=f-final-scripted-navigation-transition pnpm
  --filter @fluxiq-web-extension/test-runner check`: **passed** after the
  amendment and again after mutation restoration.
- Private TypeScript compilation to
  `.private-scripted-navigation-review-restored`: **passed**.
- Final private TypeScript compilation to
  `.private-scripted-navigation-lifecycle-bound`: **passed**.
- Final focused suite (`scripted-navigation.test.js` plus
  `step-runner.test.js`): **15 passed, 0 failed**.
- Final package check after the second amendment: **passed**.
- The first-amendment restored focused suite passed **13/13** before the
  lifecycle-bound additions.
- Earlier amended private suite before the final test-strengthening edit also
  passed 13/13.

First-amendment mutation proof (before the later whole-lifecycle bounds):

- Pre-mutation SHA-256 for `scripted-navigation.ts`:
  `2A193AA6385E0F6039F4FCDAD2FB1E9A2E3CC371E4DC7F29B84A87D094784107`.
- I replaced the buffered exact-document check with unconditional load
  completion. The first run exposed that the already-current regression needed
  additional promise turns to observe completion; I strengthened that test.
- With the mutation still present, private rebuild plus the adapter suite
  produced **9 passed, 1 failed**. The failing row was
  `an already-current URL cannot satisfy the resulting new-document wait`,
  observing `true !== false` for “the command response alone is not a new
  loaded document”.
- The guard was restored with `apply_patch`; its SHA-256 returned exactly to
  the value above. Package check and the restored 13/13 focused suite passed.

Second-amendment mutation proof:

- Pre-mutation SHA-256 for `scripted-navigation.ts`:
  `88B2E17769D22CD3089428ED580F43505168C59DD8E0BDBB496DDB50DFD90717`.
- I removed only the late-acquired session's bounded-detach call. After a
  private rebuild, the adapter suite produced **11 passed, 1 failed**. The
  failing row was `pending session acquisition is bounded and a late session
  is cleaned up`; its last call remained `session` instead of `detach`.
- Restoring that call with `apply_patch` returned the source exactly to the
  SHA-256 above. Final package check passed and the restored focused suite
  passed **15/15**.

The indexed structure audit performed before the amendment reported no owned
source/test violation. Its only failures were supervisor-owned in-flight
working-document state (Current State over budget and stale working index); I
did not edit either file. Temporary private build directories are disposable
and are removed at handoff.

## Not verified

No Lab/browser run was authorized. Supervisor validation must run W10 primary
and `broken-link` at least 3/3 at the new pushed downstream pin. Every recording
must show two extension/Core actions and two proposal candidates; primary must
execute click then navigation and pass both verdicts; `broken-link` must begin
at candidate zero and report the expected first-click
`navigation_unexpected` failure. Firefox was not run or changed; this seam is
explicitly Chromium/Edge-only and fails closed elsewhere.
