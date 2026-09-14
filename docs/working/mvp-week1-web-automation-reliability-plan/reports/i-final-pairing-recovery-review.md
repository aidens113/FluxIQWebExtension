# Report: i-final-pairing-recovery-review

Read-only Stage 4n cross-review, 2026-09-13. I reviewed the Stage 4n brief,
pairing-timeout investigation and implementation report, the new lifecycle
source/tests, the `run-scenario` and wiring delta, and the existing pairing
status wait contract. This report is the only edit. I ran no tests, build, Lab,
or Core command and changed no source, generated output, shared document,
commit, or remote.

## Disposition

**Changes required: three P2 gaps. No P1 finding.** The central recovery is
well-scoped: observation zero is retained, only the cold state reconnects,
attempts/backoffs stay inside one absolute pre-approval deadline, and the
runner wiring is thin. However, the composed pairing operation is not fully
bounded or fixed-diagnostic across approval/post-approval, and an empty
reference can reach approval.

## Findings

### P2 — post-approval status transport can outlive its advertised 15-second bound

After approval, the new orchestrator delegates to `awaitPairingStatus`
(`run-lifecycle/pair-extension.ts:76-82`). That existing helper calculates a
15-second deadline but directly awaits both `readStatus()` and `sleep()`
without racing either against the remaining time
(`pairing-status-wait.ts:33-41`). A pending `fluxiq.getStatus` promise therefore
hangs forever: it neither reaches the deadline check nor emits the promised
fixed `post-approval` timeout. A late rejection is also not proactively
observed until that direct await resumes.

The Stage 4n pending-transport test covers only the new pre-approval helper
(`pair-extension.test.ts:142-152`). The post-approval test advances a synthetic
clock through immediately resolved status/sleep calls (`:162-181`), so it does
not exercise this failure. This matters under the same service-worker/load
conditions that motivated Stage 4n and can stall a whole bench cell instead of
producing a bounded failure.

**Smallest correction:** extend ownership to
`run-lifecycle/pairing-status-wait.ts` and its existing test. Observe each
status/sleep promise immediately, race it against the remaining absolute stage
deadline, clear timers on every outcome, and reject at/after the deadline. Add
a deterministic pending post-approval status row, late-rejection row, and a
row proving no subsequent sleep/status starts after expiry. Keep the existing
separate post-approval 15-second stage and safe projection.

### P2 — immediate connect/status transport errors can publish arbitrary text

`beforeDeadline` observes late rejection, but a rejection that wins the race is
rethrown unchanged (`pair-extension.ts:68-70,105-125`). In production,
`runtimeMessage` builds a `RunnerFailure` from the extension's returned
`error` text (`run-scenario.ts:616`); the run catch then publishes that error's
message as the failure summary (`run-scenario.ts:375-384`). Consequently an
arbitrary background exception message can cross into a persisted run bundle.
The brief requires fixed, non-secret diagnostics, and the investigation says
not to publish errors.

The only sentinel transport error in the new suite is rejected *after* the
deadline already won and is intentionally swallowed
(`pair-extension.test.ts:142-151`). There is no immediate connect rejection or
post-approval status rejection assertion proving the sentinel is absent.

**Smallest correction:** in `run-lifecycle/pair-extension.ts`, map
pre-approval connect/status transport rejection to a fixed categorized
`RunnerFailure` without caught text or response data. Apply the same fixed
mapping to the post-approval status seam while making the prior finding's wait
bounded. Preserve an already-safe approval `RunnerFailure` as primary, as the
current approval-precedence row requires. Add immediate connect, polled status,
and post-approval status rejection tests with a private sentinel and assert it
is absent from message/details/serialization.

### P2 — an empty pairing reference is treated as approval-ready

`readyForApproval` requires only `typeof pairingReferenceCode === "string"`,
and the later guard repeats only that condition
(`pair-extension.ts:73-75,87-90`). Thus
`{connectionState:"pairing", pairingReferenceCode:""}` calls
`approvePairing("")`. The brief requires never approving without a reference,
and the investigation explicitly requires malformed responses to fail closed.
The tests use only a valid nonempty value and do not cover empty or oversized
references.

**Smallest correction:** define one bounded nonempty reference predicate in
`pair-extension.ts` and use it for both readiness and the approval call. Add
empty, whitespace-only, non-string, and over-limit rows proving approval is
never called and diagnostics contain no supplied value. The exact maximum
should follow the extension/Core pairing-reference contract already used by
the facility rather than inventing a second incompatible limit.

## Checks that pass by inspection

- The pre-approval deadline begins before initial connect. Connect, status,
  interval sleeps, 100/200 ms reconnect backoff, and at most two reconnects
  use one absolute deadline. `beforeDeadline` observes its promise immediately,
  rejects resolution at the deadline, and clears its wrapper timer.
- Cold recovery requires `disconnected`, queue zero, and absence of reference,
  session, last-message, and last-error evidence. `error`, `reconnecting`,
  pairing/connecting, message/code/session-bearing, and nonempty-queue states
  do not reconnect. Full extension status objects legitimately contain other
  status fields, so exact own-key matching would be incorrect; the meaningful
  epoch evidence fields are the correct predicate boundary.
- A valid initial pairing response is approved immediately once; an initially
  connected response skips approval and polling. Approval rejection preserves
  the existing primary error and does not enter post-approval polling.
- Pre-approval timeouts retain only stage, numeric timing, and the established
  five-field safe status projection. They expose no reference, session, URL,
  settings, last error, or response body. `pairingStatusWaitFailureDetails`
  accepts the new projection without broadening publication.
- Structure is cohesive: one focused lifecycle module, colocated test, barrel
  export, a thin three-transport adapter in `run-scenario`, and an ownership
  assertion in the existing wiring test. No extension, domain, or Core API is
  changed.

## Acceptance after correction

Rerun the focused pair-extension, pairing-status-wait, and runner-wiring tests;
test-runner check and full suite; then supervisor mutations for observation
zero plus post-approval pending transport and diagnostic withholding. Live
acceptance remains the exact isolated/concurrent cells and fresh full benches
specified by the investigation. This review makes no live claim.

---

## Authoritative Stage 4o disposition — 2026-09-13

This disposition supersedes the Stage 4n “changes required” verdict above.

**Accepted for supervisor gates and live validation. No remaining P1 or P2
finding.** The amended source closes all three review findings without widening
the pairing recovery or repository boundary.

### P2 closure verified by inspection

- **Post-approval absolute bound and late rejection:**
  `awaitPairingStatus` now computes one deadline for the named stage and sends
  every status and interval-sleep promise through `beforeDeadline`. That helper
  observes rejection before checking the remaining time, races against the
  exact remainder, rejects a result at or after the deadline, and clears its
  timer in `finally`. The post-approval caller passes the injected clock,
  sleep, timer, and clearer through, so pending status and sleep cannot extend
  that stage's original 15 seconds. Late and deadline-edge status rejection is
  observed without replacing the fixed timeout.
- **Sanitized transport and precedence:** both initial/reconnect connect and
  pre-/post-approval status calls go through `safeTransport`. Arbitrary errors
  and `extension.worker` failures become a fixed `gateway.connection` message
  containing only the stage. An already categorized non-worker
  `RunnerFailure` remains primary; approval remains outside the transport
  wrapper and preserves the control client's categorized failure. No caught
  message, response, URL, code, session, settings, or page data is attached.
- **Exact approval reference:** readiness and the final approval guard share
  `validReferenceCode`, which requires exactly six ASCII digits. This matches
  Core's generator (`client-gateway/service/pairings.ts`, which produces
  100000–999999) and its `/^\d{6}$/` service test. Empty, whitespace, numeric,
  and seven-character values therefore never reach `approvePairing`.

### Regression and integration review

- The new pairing tests cover immediate connect and polled-status rejection,
  categorized transport precedence, invalid references, pending and immediate
  post-approval status, timer cleanup, late rejection, and fixed safe timeout
  projection. The existing rows retain observation-zero, connected
  short-circuit, exact-cold reconnect, retry cap/backoff, refusal states,
  absolute pre-approval deadline, and approval precedence.
- The pairing-status-wait tests independently pin pending status, pending
  sleep, no later read after expiry, timer cleanup, and the deadline-edge
  rejection observer. These are deterministic regressions for the previously
  uncovered wait behavior.
- Structure remains cohesive: the lifecycle barrel exports the focused owner;
  `run-scenario` supplies only connect/status/approval transports; the wiring
  test pins that delegation and the existing safe failure-detail selector.
  There is no extension, domain, or Core API change.
- The implementation report records three targeted mutations: removal of the
  status rejection observer, restoration of raw transport rethrow, and
  relaxation of the six-digit predicate. Each caused its intended regression
  to fail before exact restoration. Its reported final focused set is 33/33,
  package suite 646/646, and package check passing; this read-only review did
  not rerun those commands.

Live acceptance remains necessary: the repaired isolated cells, concurrent
matrix, and fresh full benches must demonstrate that cold-epoch recovery works
under the load that exposed it. This final review changed only this report and
ran no source mutation, test, build, Lab, Core, commit, or push operation.
