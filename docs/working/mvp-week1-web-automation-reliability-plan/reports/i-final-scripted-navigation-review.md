# i-final-scripted-navigation-review — read-only implementation review

## Final acceptance amendment — session and cleanup bounds

This amendment supersedes the second-pass blocker below. The latest adapter and its focused tests close the remaining P1/P2 findings:

- The single overall navigation deadline now begins before `newCDPSession`, so session acquisition cannot leave the step pending indefinitely. A late-resolving session is handed to bounded cleanup; acquisition rejection remains observed and classified without an unhandled rejection.
- Detach is independently bounded by the cleanup deadline. Cleanup rejection, synchronous failure, and timeout are all contained; the timer is cleared on settlement.
- Failure precedence is correct: a command/load/setup/session primary failure remains the reported failure even when detach subsequently rejects or times out. A detach failure after an otherwise successful navigation is surfaced as the cleanup failure.
- Focused tests cover pending acquisition with late cleanup, pending detach after success, pending detach after a primary command failure, cleanup-timer removal, and primary-failure precedence.

No new P1 or P2 issue was found in this final bounded pass. If session acquisition never settles, no session exists to detach; the caller is nevertheless deadline-bounded and the losing promise is observed. That unavoidable provider-level condition is not a release blocker for this adapter.

**Disposition:** accepted for the targeted mutation and live W10 proof. This is source-review acceptance only; this reviewer did not run tests, builds, or Lab scenarios in this pass.

## Amendment — second pass after the lifecycle/loader rewrite

Reviewed the amended five owned files and amended worker report without running
validation. **The four original findings are resolved:**

1. `Page.enable`, lifecycle enablement, `Page.navigate`, and the exact-document
   load now race one deadline (`scripted-navigation.ts:35-84`). A pending
   command can no longer keep the main operation waiting after that deadline.
2. A lifecycle listener is installed before any command, load events are keyed
   by the exact command-returned frame/loader pair, and early matching events
   are buffered (`:37-48,65-79`). An already-current URL cannot satisfy it.
3. The timer and lifecycle listener are owned locally and removed in `finally`
   on every established-session exit (`:87-98`); command and protocol failures
   no longer leave a Playwright URL waiter behind.
4. Protocol rejection now requires a non-empty string `errorText` (`:68-73`).

The amended tests directly cover those four paths, including pending command,
already-current page, fast load, exact loader, listener/timer cleanup, empty
error text, and primary-error precedence
(`scripted-navigation.test.ts:68-196`). Step-runner wiring uses the options
shape correctly and retains full-operation timing
(`step-runner.ts:54-86`; `step-runner.test.ts:52-121`).

### New P1 — CDP session acquisition remains outside the deadline

`context.newCDPSession(page)` is awaited before `timeoutMs`, the deadline
promise, or its timer exist (`scripted-navigation.ts:14-28,30-50`). A rejected
session is categorized, but a session request that never settles still hangs
the Lab row forever. This is the same class of defect the amendment correctly
fixed for a pending `Page.navigate`, just one operation earlier. The worker
report accurately says its deadline covers `Page.enable` onward; it does not
cover session acquisition.

**Required fix:** start the overall deadline before session acquisition and
race acquisition against it. If the deadline wins, observe the late acquisition
promise; if it later returns a session, detach it without changing the already
reported timeout. The normal acquired-session path keeps the existing exact
document logic and cleanup precedence.

**Required test:** make `newCDPSession` remain pending, expire the injected
deadline, and assert the call settles as categorized `runtime.behavior`. Then
resolve acquisition late and assert that late session is detached and no timer,
listener, or rejected promise remains.

### New P2 — session detach itself has no cleanup bound

After the operation/deadline race, the overall timer is cleared and
`session.detach()` is awaited without any bound (`scripted-navigation.ts:87-97`).
If the CDP connection is the thing that stalled, cleanup can still prevent the
row from returning indefinitely. Existing tests cover detach rejection, but
not a detach promise that never settles.

**Required fix/test:** give detach a short bounded cleanup wait (or an
equivalent transport-close guarantee), observe the losing detach promise, and
preserve the primary failure. On an otherwise successful navigation, a cleanup
timeout should remain the existing explicit `environment.missing` class. Add
pending-detach tests for both success and primary-failure paths.

### Second-pass disposition

**Still blocked before live proof on the new P1.** The navigation event/loader
algorithm is now acceptable, and the P2 is a bounded-cleanup hardening issue,
but the declared scenario timeout still does not bound the whole adapter while
session acquisition can wait forever. Close P1, add its deterministic test,
then the targeted W10 proof may proceed; close P2 in the same small helper while
the timeout/cleanup seam is open.

Reviewed only the five source/test files owned by
`f-final-scripted-navigation-transition` and that worker's report. I made no
source or shared-document edit and ran no build, test, or Lab command.

## Verdict

**Changes required before the live W10 proof.** The typed CDP request and
failure precedence are directionally correct, but the implementation has two
load/timeout correctness holes and one cleanup leak. The focused tests model a
cooperative CDP command and a load waiter that cannot resolve early, so they do
not exercise those holes.

## Findings, ranked

### P1 — a stuck `Page.navigate` is not bounded by the scenario timeout

`runScriptedNavigation` applies `timeoutMs` only to `page.waitForURL`
(`scripted-navigation.ts:23-26`), then awaits `session.send` by itself before it
ever awaits the load promise (`:31-43`). If the CDP command does not settle, the
load waiter may time out in the background, but the function remains blocked on
`session.send` indefinitely. The attached catch at `:27-29` only suppresses the
load rejection; it cannot release the command await or reach `detach`.

Impact: one browser/protocol stall can hang the entire Lab row past the declared
step bound, and session cleanup never runs. This violates the brief's explicit
timeout and failure-cleanup requirements.

Required correction: the one deadline must govern both command acceptance and
the resulting document load. At minimum, start both promises with rejection
handlers and await them under one bounded coordination path so a load timeout
can enter `finally` even while the command is pending. Prefer a cancellable
resulting-navigation waiter owned by the adapter; detaching the session must
also settle/contain the pending command. Preserve which side failed so command
rejection and load timeout retain their current categorized messages.

Missing test: leave `session.send` pending forever, let the injected/short
navigation deadline expire, assert categorized `runtime.behavior`, assert
detach was attempted, and assert the function settles rather than hanging.

### P1 — `waitForURL` does not necessarily identify the navigation caused by this command

The waiter at `scripted-navigation.ts:23-26` is armed before the CDP send, which
fixes the ordinary fast-event race, but it asks only for “the page is at this URL
and its load state is load.” If the page is already at the requested URL with
load complete, that condition can settle before `Page.navigate` is sent. The
adapter then waits only for the command response and detaches without proving
that the **resulting** document loaded. A same-URL scripted navigate/reload is
therefore reported complete too early.

This is exactly the distinction in the brief: wait for the resulting document,
not merely a URL predicate that was already true. It can also make later
recording steps race the new document.

Required correction: arm a new main-frame navigation/document identity event
before the CDP command, correlate it with the command's returned frame/loader
where available, and await that document's requested load state. The event
waiter must be installed before `send`, and its listeners/timer must be
disposable on every exit. Define and test redirect and same-document behavior;
do not restore `page.goto` as a fallback.

Missing test: begin with the fake page already at the target and already loaded;
prove the adapter remains pending after `Page.navigate` resolves and completes
only after a new main-frame document/load event.

### P2 — early command/protocol failures leave the Playwright load waiter alive

When `session.send` rejects (`scripted-navigation.ts:32-36`) or returns
`errorText` (`:37-40`), the function throws and detaches without awaiting or
cancelling `loaded`. `void loaded.catch(...)` prevents an unhandled rejection,
but the Playwright waiter, event subscriptions, and timer stay alive until a
later navigation or timeout. A later step can satisfy this abandoned waiter;
even when harmless, every early failure retains resources beyond the function
that owns them.

The current failure-loop test explicitly opens the load gate before asserting
each command/protocol failure (`scripted-navigation.test.ts:76-89`), so it hides
this leak rather than proving cleanup.

Required correction: use an adapter-owned cancellable waiter, or otherwise
dispose the URL/document waiter in `finally`. The cleanup must not replace the
primary command/protocol failure.

Missing tests:

- reject `send` while the document waiter remains pending; assert every waiter
  listener/timer and the CDP session are cleaned up;
- return `errorText` with the waiter pending and assert the same;
- combine command, protocol, and load failures individually with a detach
  failure, asserting the primary `runtime.behavior` object/message wins. The
  report claims this precedence, but `scripted-navigation.test.ts:92-102` tests
  detach failure only after success.

### P3 — protocol `errorText` is tested by property presence, not a value

`scripted-navigation.ts:37` rejects whenever the response owns an `errorText`
property, including a defensive/mock response whose value is `undefined` or an
empty string. Chromium normally omits the optional property on success, so this
is unlikely in the current protocol, but checking a non-empty string would
express the intended contract and avoid a false rejection at an external API
boundary.

The existing fake returns either a non-empty property or omits it
(`scripted-navigation.test.ts:20-25`), so this branch boundary is not tested.

## What is correct

- The exact request is `Page.navigate({ url, transitionType: "typed" })`
  (`scripted-navigation.ts:31-35`), matching the Chromium-only decision.
- CDP acquisition fails closed as `environment.missing`; there is no
  nondeterministic `page.goto` fallback (`:14-19`).
- The load waiter is initiated before the command (`:23-33`) in the ordinary
  non-current-URL case.
- `failed` is set before rethrow, so a detach failure does not overwrite an
  already-caught primary navigation failure (`:47-55`). A detach failure after
  otherwise successful navigation is explicitly categorized.
- `ScenarioStepRunner` delegates `navigate` to the adapter and encloses the
  entire call in its existing start/end timing (`step-runner.ts:54-72,75-88`).
  The prior 5.25-second barrier and injected sleep state are removed.
- The barrel export is correct (`scenario-steps/index.ts:9`).

## Minimum acceptance tests before Lab

In addition to the current eight focused rows:

1. pending CDP command + expired bound settles and detaches;
2. target already current does not satisfy the resulting-document wait;
3. command rejection and `errorText` dispose a still-pending document waiter;
4. primary command/protocol/load failure beats simultaneous detach failure;
5. redirect burst produces one typed committed navigation and waits for the
   final document load, or the adapter explicitly rejects redirects if that is
   the intended contract;
6. mutation removing the new-document correlation or overall command bound
   fails the relevant row, with exact restoration.

After those corrections pass private focused tests and package check, the
supervisor should run the targeted W10 primary/`broken-link` 3+3 proof. The
final benches should not restart on the current implementation before these P1
items are resolved.
