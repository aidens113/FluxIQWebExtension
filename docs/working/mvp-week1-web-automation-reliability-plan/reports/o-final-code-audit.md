# `o-final-code-audit` — adversarial review of the integrated repairs

## Outcome

The repair set is directionally sound, but it is not ready to accept unchanged.
I found two material gaps:

1. the new HTTP operation-stage diagnostic is not projected into a run artifact
   or the `lab run` result, so the next startup transport failure still loses the
   exact stage the repair was meant to preserve; and
2. awaiting the navigation drain while the public recording state remains
   `recording` creates an unfenced stop interval. Concurrent stops can settle the
   same recording twice, and new events can be admitted after the stop's
   `endedAt` was captured.

I found no secret exposure in the new thrown HTTP error itself, no unbounded
cause traversal, no HTTP transport retry, no readiness listener/timer leak on
the normal success or timeout paths, and no cleanup error that replaces the
primary isolated-startup failure.

## Findings

### High — safe startup stage is discarded before durable reporting

**Files/lines:** `packages/test-runner/src/http-control.ts:178-185` creates the
closed `operationStage` / `transportCategory` / optional `transportCode`
details, but `packages/test-runner/src/run-scenario.ts:376-384` retains only the
error message and category for ordinary `RunnerFailure`s. The returned result at
`run-scenario.ts:516` likewise contains only `failureCategory`.

**Concrete failure path:** `project.create` rejects with an undici socket error.
`boundedFetch` correctly throws a safe `RunnerFailure` whose details identify
`project.create` and, when allowlisted, the socket code. `startTopology` cleans
the run-owned topology and rethrows it. `runScenario` then writes an error event
whose summary is only `FluxIQ HTTP transport failed` and whose details contain
only `failureCategory`. The finalized run, evaluation, and CLI result therefore
cannot distinguish login, cached-session validation, project creation, project
selection, or another control request. This recreates the diagnostic loss that
made the W25 failure irrecoverable, albeit with a safer generic message.

**Proposed correction:** add one narrow projector for HTTP transport failures
that accepts only the fixed stage enum, `transportCategory: "network"`, and an
allowlisted transport code. Include that projection in the run error event (and
in any deliberately supported failure-detail field returned by inspection).
Do not spread arbitrary `RunnerFailure.details`. Add an integration test at the
run/event boundary proving the safe keys survive and sentinel URL, body, raw
error, cause, and credentials do not. Mutating away the projector must fail that
test.

### Medium — stop has no synchronous single-flight or event-admission fence

**Files/lines:** `apps/extension/src/background/connection/active-recording.ts:176-203`
checks `recordingState`, captures `endedAt`, then awaits `navigation.flush()`
without changing any state or recording a stop-in-progress promise.
`recorded-event-intake.ts:82-90` and `137-143` continue to admit ordinary events
and fresh navigation commits solely because the state is still `recording`.

**Concrete failure paths:**

- Two UI stop messages, or a UI stop crossing a server `stop_recording`, can
  both pass line 177 while the drain is pending. Both perform teardown and log /
  broadcast the stop; two notifying callers also send duplicate
  `client.stop_recording` messages. The old implementation changed state before
  its first stop await, so the widened drain window introduces this re-entry.
- `endedAt` is fixed before the drain. A content event or navigation commit that
  arrives while a pending landing send holds the drain is still accepted. It can
  be appended to the recording with a timestamp after the `endedAt` already
  destined for Core, and repeated fresh navigation can keep extending what was
  intended to be a bounded drain.

**Proposed correction:** establish a stop-in-progress token/promise
synchronously before the first await and return that same promise to every
concurrent caller. Separately close admission of new events at that boundary
while allowing callbacks already captured in the current navigation generation
to finish under the old recording identity. Capture `endedAt` at the chosen
logical boundary consistently with that policy. Add tests for two concurrent
notifying stops, a server/UI crossing, and a new content/navigation event arriving
after stop begins while an earlier landing remains blocked.

## Guard and mutation assessment

### Recorder drain

- Removing `await navigation.flush()` from `ActiveRecording.stop` is detected by
  the new active-recording tests.
- Restoring `void` in `RecordedEventIntake.scheduleNavigation` is also detected
  indirectly: the held async landing would no longer hold stop open.
- Removing pending-timer cancellation or generation filtering is covered by the
  pending-cancellation and old-running-generation tests.
- Removing the callback rejection catch while leaving promise rejection to
  `Promise.all` is **not clearly distinguished** by the current tests. The
  rejection test calls `flush`; there is no test for a timer-fired rejected
  callback before any flush, which is the unhandled-rejection guard's important
  case.
- Removing the `do/while` re-drain, or the stale-timer identity check, is **not
  directly mutation-pinned**. No callback schedules a second navigation during
  settlement, and cleared timers do not exercise an already-queued stale
  callback.
- There is no guard or mutation proof for stop single-flight or post-boundary
  event admission; those are the second finding.

### Extension readiness

- Observation-zero, subscribe-then-recheck, the 30-second deadline,
  `chrome-extension:` filtering, bounded timeout fields, and listener/timer
  cleanup each have a focused assertion. The reported deadline and protocol
  mutations would fail the suite.
- Removing either cleanup action would fail the success/timeout listener and
  timer counts. Publishing an observed worker URL would fail the secret-safe
  timeout assertion.
- I found no double-settlement path in normal Playwright use: `settled` gates
  event and timer completion, and cleanup occurs before resolution/rejection.
  A browser disconnect remains bounded by the same 30-second timer.

### HTTP transport diagnostics and startup cleanup

- Cause-chain traversal, fixed stage labels, allowlisted codes, abort/timeout
  precedence, raw-cause absence, and primary-over-cleanup precedence are covered
  by focused assertions and the reported mutations.
- The implementation performs no transport retry. However, an unsafe retry
  mutation is **not pinned by an explicit call-count assertion**; repeated
  failures could still yield the expected final `RunnerFailure`. Add exact fetch
  counts, especially for non-idempotent `project.create`.
- The safe thrown diagnostic itself is closed: it retains no URL, path, request
  body, credential, raw message, or cause, and cause traversal is bounded to four
  objects. No diagnostic leak was found in that layer.
- The durable projection guard is missing entirely, as described in the first
  finding; the current exact-object tests stop one layer too early.
- Suppressing cleanup rejection in isolated startup preserves the primary error
  as intended. Its focused test would fail if either cleanup error were allowed
  to replace that primary error. No incorrect failure-precedence change was
  found there.

## Inspection and verification performed

- Read the plan's `Current State`, both diagnosis reports, and all three
  implementation reports named by the brief.
- Reviewed only the changed recorder, readiness, HTTP diagnostics, startup
  cleanup, wiring, and focused-test files. Generated bundles and architecture /
  shared working documents were not reviewed as product implementation.
- Traced both stop entry points (runtime UI and server command), the run-level
  failure capture, finalized evaluation projection, and CLI result projection.
- Ran `git diff --check` over every inspected tracked product/test path; it
  exited zero (the working tree emitted only its existing LF-to-CRLF warnings).
  I did not rerun the heavy package suites
  because their completed results and mutations are recorded in the three
  implementation reports and concurrent live validation was active on this
  machine.

No product code, test, shared plan, artifact, Core file, commit, or remote was
changed. This report is the only file I wrote.
