# i-final-navigation-intent-runner-review — Stage 4e runner cross-review

Read-only Stage 4f review, 2026-09-13. I reviewed only the six runner files in
the Stage 4e diff, their focused tests, the implementation report, and the
accepted intent contract/design. I made no runner, extension, Core, shared
document, build, Lab, commit, or remote change; this report is the only edit.

## Stage 4h final disposition

**Accepted after Stage 4g corrections, for supervisor validation and live
W10.** The three prior findings below are resolved. This is source-review
acceptance only; this pass ran no tests, build, browser, or Lab command.

- `beforeDeadline` observes the promise before reading remaining time. The new
  zero-remainder/late-rejection row verifies fixed `recording.persistence`,
  cancel, timer cleanup, and no later unhandled rejection. Prior P1 is closed.
- All arm, acknowledgement, cancel, and known-negative responses require exact
  own-key sets. Four extra-field rows prove malformed fixed failures without
  exposing values. Prior P2 is closed.
- The harness retains requested timer delays and proves a 500 ms absolute
  deadline leaves acknowledgement 200 ms after a 300 ms loaded `goto`. Await
  transport rejection is separately sanitized and still cancels. Prior P3 is
  closed.
- Sequencing remains arm -> loaded `goto` -> post-send await -> bounded cancel.
  Arm/goto/await share one absolute deadline; cleanup has a separate 5-second
  bound. Every acquired ID reaches `finally`, primary failure wins over cleanup
  failure, and cleanup failure after success becomes fixed `extension.worker`.
- Cross-half shapes are exact: runner sends arm `{type,url}` and await/cancel
  `{type,intentId}`; extension returns arm/await `{ok:true,intentId}`, known
  negatives `{ok:false,code}`, and cancel `{ok:true,cancelled}`. Production UUID
  IDs satisfy the runner predicate, and both sides share the negative-code set
  (with `forbidden` supplied by the extension control boundary).
- Both validators accept only bounded bare loopback HTTP(S) origin/path, with no
  credentials, query, fragment, caller tab id, response error text, or page
  data. The factory remains bound after recording confirmation, and outer step
  timing includes acknowledgement and cleanup.

The implementation report records package check passing, 27/27 focused tests,
and the immediate-observer mutation failing the deadline-edge row with
`unhandledRejection`, followed by exact hash restoration. These remain worker
claims for supervisor verification.

## Prior Stage 4f verdict (superseded)

**Changes required before live W10.** Arm → loaded `goto` → post-send await →
bounded cancel is wired in the right order, uses the manager-derived tab, and
preserves primary failures. One deadline-edge promise race remains capable of
surfacing an unhandled rejection, however, and the response validators do not
enforce the exact safe shapes claimed by the report.

## Findings, ranked

### P1 — an acknowledgement started after the absolute deadline is not observed

The driver creates the acknowledgement message promise first, then passes it
to `beforeDeadline` (`scripted-navigation.ts:48-54`). `beforeDeadline` checks
remaining time before delegating to `within` (`:123-127`). If `page.goto`
settles at the deadline, or `now()` crosses it between the send and that check,
`beforeDeadline` throws immediately. The promise never reaches `within`, whose
line 132 is the only general losing-promise rejection observer.

Cleanup still sends cancel and the primary result is correctly
`recording.persistence`, but a later rejection of the already-started
`page.evaluate`/runtime-message promise is unhandled. Node's test process can
treat that as a fatal asynchronous error. This violates the design's explicit
rule that every losing runtime-message promise be observed.

The arm call has the same low-level ordering (`:34-40`), but its deadline catch
passes the promise into `cancelLateArm`, which awaits/catches it (`:114-120`).
The acknowledgement path has no equivalent observer.

**Smallest correction:** attach `void promise.catch(() => undefined)` at the
start of `beforeDeadline`, before checking `remaining`, rather than relying
only on `within`. Keeping the observer in `within` as well is harmless. An
alternative is to compute positive remaining time before creating the await
message promise, but the shared helper-level observer is harder to regress.

**Required test:** let `goto` consume the whole main deadline, have the newly
created acknowledgement evaluation reject on a later turn, and assert the
driver returns the fixed `recording.persistence` deadline failure, cancels
once, clears its timers, and produces no unhandled rejection. The current
tests exercise a deadline that expires while `within` is already racing the
pending acknowledgement (`scripted-navigation.test.ts:132-138`), not the
non-positive-entry branch.

### P2 — success and failure response validators accept extra fields

The accepted contract gives exact safe shapes. Arm success is
`{ ok:true, intentId }`, acknowledgement success is the same, cancellation is
`{ ok:true, cancelled }`, and negative arm/await is `{ ok:false, code }`.
Current validation checks required fields but never checks the key set:

- arm success accepts any additional properties (`scripted-navigation.ts:94-99`);
- acknowledgement success accepts additional properties (`:102-106`);
- cancel success accepts additional properties (`:109-112`);
- `isFailureResponse` accepts arbitrary fields beside `ok` and `code`
  (`:148-151`).

The implementation safely does not interpolate those fields into a
`RunnerFailure`, so this is not a demonstrated artifact leak. It is still
weaker than the exact protocol and contradicts the worker report's statement
that responses are checked against exact success shapes. Accepting a response
which carries `url`, `error`, or another unexpected page-data field also makes
the runner silently tolerate the extension violating the security boundary.

**Smallest correction:** use an exact-own-key predicate for each of the four
response shapes. Known negative codes with extra keys should be malformed
`extension.worker`, not accepted `recording.persistence`; arbitrary response
content must still never enter the error.

**Required tests:** valid id plus an extra arm field, matching id plus an extra
ack field, valid cancel boolean plus an extra field, and known negative code
plus an extra field must all fail as malformed fixed protocol responses. The
existing malformed test uses an invalid arm id and a mismatched acknowledgement
id (`scripted-navigation.test.ts:150-157`), while its negative response test
explicitly accepts an extra `error` field (`:140-147`).

### P3 — the acknowledgement remainder claim is not directly asserted

The source correctly supplies the absolute deadline to `beforeDeadline` for
both arm and acknowledgement (`scripted-navigation.ts:30,37,50-54`). The test
harness, however, stores timer callbacks but discards their requested delays
(`scripted-navigation.test.ts:27-55`). The acknowledgement test advances its
clock only after the acknowledgement timer has already been created and then
resolves the acknowledgement (`:71-85`); it proves pending/order, not that the
timer received the remaining rather than full duration. The arm-time test
does assert the reduced `goto` timeout (`:87-95`).

This is not a source blocker once P1 is fixed, but the report's claimed
“absolute-deadline subtraction” coverage is broader than the actual guard.
Record timer delays in the harness and assert the acknowledgement timer gets
the remaining budget. Also add an await transport-rejection row: source maps it
to a fixed `extension.worker` failure and cleanup (`scripted-navigation.ts:55-65`),
but the focused suite currently covers negative response and timeout only.

## What is correct

- The local validator matches the accepted extension boundary: bounded bare
  loopback HTTP(S), no credentials/query/fragment, canonical origin/path, and
  no side effect before validation (`scripted-navigation.ts:28-30,72-85`; test
  `:170-179`).
- Requests contain no tab id and follow exact operation order. `goto` waits for
  `load`, and await begins only after it resolves (`scripted-navigation.ts:34-59`;
  test `:59-69`).
- The one main deadline is reduced before `goto` and await; cancel has a
  separate five-second bound (`scripted-navigation.ts:30,37,44-54,109-134`).
- A timed-out arm is observed by the late-arm helper; a valid late id is
  bounded-cancelled without replacing the arm timeout (`:34-41,114-120`; test
  `:97-108`).
- An acquired id is cancelled in `finally` after success or failure. Navigation
  failure skips await, and primary navigation/acknowledgement failures beat
  cancel rejection or timeout; cleanup failure after success is explicit
  `extension.worker` (`:60-68`; tests `:110-148,160-168`).
- Diagnostics use fixed text and only an allowlisted negative `reasonCode`;
  neither requested URL, opaque id, response text, nor caught browser text is
  interpolated (`:83-105,145-150`).
- `ScenarioStepRunner` requires the injected driver, passes the step timeout,
  and keeps its timing outside the complete driver call. `runScenario` binds
  the driver only after the recording-state poll and before the recording loop;
  the wiring test pins that order.
- The diff remains inside the accepted runner partition. The focused module is
  151 lines and its test 189 lines; no structure split is needed.

## Minimum acceptance after correction

Close P1 and P2 in `scenario-steps/scripted-navigation.ts` and its colocated
test only. Re-run the package check and focused private suite. Mutation of the
new pre-check rejection observer must make the deadline-edge late-rejection row
fail; mutation permitting an extra acknowledgement key must make the exact
shape row fail. Restore exactly. The prior await-operation and failure-cancel
mutations remain useful and do not need repeating if the supervisor verifies
their recorded hashes.

Only after those corrections and the extension cross-review are accepted
should the supervisor run the targeted W10 3+3 live proof.
