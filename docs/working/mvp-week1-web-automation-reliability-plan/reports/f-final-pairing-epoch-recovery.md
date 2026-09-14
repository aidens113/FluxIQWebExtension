# `f-final-pairing-epoch-recovery` — Stage 4n

**Status:** implementation and bounded validation complete. Live Lab proof is
not authorized in this brief and remains outstanding.

## Implementation

- Added focused orchestration in
  `packages/test-runner/src/run-lifecycle/pair-extension.ts` and exported it
  through the directory barrel. `run-scenario.ts:526-531` now supplies only
  the three concrete transports: connect, status, and approval.
- The 15-second pre-approval absolute deadline begins before the initial
  connect transport. Its response status is observation zero. Transport time,
  polling sleeps, 100/200 ms exponential cold-reconnect backoff, and both
  bounded reconnect attempts consume that one deadline; no operation begins
  after expiry.
- Recovery is limited to the exact cold projection: `disconnected`, zero
  queue, and no reference code, session id, message timestamp, or error. It
  does not retry `error`, `reconnecting`, unknown/malformed, message-bearing,
  code-bearing, session-bearing, nonempty-queue, or error-bearing states.
- Every connect/reconnect response is inspected immediately. A pairing code
  is required before approval, approval is called once, an initially connected
  session skips approval, and the existing separate 15-second post-approval
  wait remains intact.
- Every pre-approval transport is timer-bounded. The promise is observed before
  the deadline check, its timer is cleared on every outcome, and a late
  rejection after timeout cannot become unhandled. Approval/transport errors
  retain precedence. Timeout publication retains the exact existing closed
  `pairingStage`, `timeoutMs`, `waitedMs`, and five-field safe status shape; no
  code, session, URL, settings, or arbitrary error text is added.
- Updated the existing runner-wiring assertion to prove `run-scenario.ts`
  delegates pairing to the focused lifecycle owner. This was the one additional
  file explicitly approved by the supervisor after the old assertion was found
  to require the two waits to remain inline.

## Tests

The new colocated suite covers:

- initial pairing and already-connected responses without a status gap;
- exact-cold recovery, immediate reconnect-response observation, two-attempt
  cap, and 100/200 ms backoff;
- refusal to reconnect every non-cold/message/code/session/queue/error shape;
- initial-transport and backoff consumption of the original deadline, with no
  late status/reconnect/approval call;
- hanging-transport timeout, timer cleanup, and late rejection observation;
- approval-failure precedence; and
- separate post-approval timeout stage with the fixed secret-safe projection.

Validation after final restoration:

- `pnpm --filter @fluxiq-web-extension/test-runner check`: **passed**.
- Private compile to
  `packages/test-runner/.private-pairing-epoch-recovery`: **passed**.
- Focused pairing, existing pairing-status, and runner-wiring command:
  **25 passed, 0 failed**.
- Full `pnpm --filter @fluxiq-web-extension/test-runner test`: **638 passed, 0
  failed**.
- `git diff --check` over the five changed/new source and test files: no
  whitespace errors; Git emitted only the repository's LF-to-CRLF notices.
- The private compilation directory was removed after validation and verified
  absent.

The first package check exposed one TypeScript narrowing error in the new
module. It was corrected before any passing result above; no failed check is
being represented as validation.

## Mutation proof

The one-shot mutation discarded the initial connect response by replacing its
assignment with an awaited connect followed by `lastStatus = undefined`.
Private compilation succeeded. The new focused suite then produced **3 passed,
7 failed**: immediate initial observation, already-connected short-circuit,
cold reconnect, capped retry, retained timeout status, and approval-precedence
guards all detected the removal.

The assignment was restored with `apply_patch`. The implementation SHA-256
returned exactly to
`E47F2E5643FC27545F7F1403D3BAC05CDD7882B94BFCBDD6696967CA399DC528`.
The restored 25-test focused set, full 638-test package suite, and final package
check all passed.

Final relevant hashes:

- `pair-extension.ts`:
  `E47F2E5643FC27545F7F1403D3BAC05CDD7882B94BFCBDD6696967CA399DC528`
- `pair-extension.test.ts`:
  `4754FB2EE2FFC85E7BF31F4FBCAE15D99EA3558976AE26E824F528C75F041A31`
- `run-scenario.ts`:
  `F2132A334E07EC83D18F7C10132259107DE3220E3AFAC5ED516FA3307000681D`
- `runner-wiring.test.ts`:
  `7FC89D6B4BF4026754D5028F94A0E217297EAAEF2712F9688555F16285BF03D1`

## Boundaries and remaining proof

No extension, Core, shared document, Lab, active Stage 4m worktree/run root,
commit, or remote was touched. Stage 4n does not prove the background epoch
hypothesis; it supplies bounded recovery for its exact observable signature.
The supervisor must review and rerun the checks/mutation, then perform the
isolated and concurrent exact-cell matrix and restart the full A/B benches at
the new pushed pin as specified by `i-final-pairing-load-timeouts.md`.

## Stage 4o review corrections

All three P2 findings from `i-final-pairing-recovery-review.md` are corrected.

- `pairing-status-wait.ts` now observes every status/sleep promise before
  checking deadline remainder, races each operation against that remainder,
  rejects a result at or after the deadline, and clears its timer on every
  outcome. A hung post-approval status or sleep therefore terminates at that
  stage's original 15-second deadline. Late and deadline-edge rejections are
  observed.
- Pre- and post-approval connect/status rejections are mapped to fixed
  `gateway.connection` messages with no caught text or response data. Existing
  categorized non-`extension.worker` `RunnerFailure`s retain precedence, as
  does the approval client's own categorized failure.
- The reference accepted for approval must match Core's exact generated
  contract, six ASCII digits. Empty, whitespace-only, non-string, and
  over-limit values remain unapproved and are never copied into diagnostics.

Stage 4o added deterministic coverage for pending post-status and sleep,
deadline remainder, timer cleanup, late and deadline-edge rejection,
immediate connect/pre-status/post-status arbitrary text, categorized transport
and approval precedence, and invalid pairing references.

Final Stage 4o validation:

- focused pairing/status/wiring suite: **33 passed, 0 failed**;
- `pnpm --filter @fluxiq-web-extension/test-runner check`: **passed**;
- `pnpm --filter @fluxiq-web-extension/test-runner test`: **646 passed, 0
  failed**;
- private output was removed and verified absent.

Independent Stage 4o mutations, each privately recompiled before its focused
run:

1. Removed the pairing-status promise's immediate rejection observer. The
   deadline-edge late-rejection row failed with `unhandledRejection`: **6
   passed, 1 failed**.
2. Replaced fixed transport wrapping with rethrow of the caught value. The
   immediate pre- and post-approval transport rows rejected the arbitrary
   errors: **13 passed, 2 failed**.
3. Relaxed the six-digit reference predicate back to any string. The invalid
   reference/never-approve row failed: **14 passed, 1 failed**.

Every mutation was restored with `apply_patch`. Final restored hashes are:

- `pair-extension.ts`:
  `19972789BDC6A52A4D559E363FF8CFE0D72096B423C3CA7E1B1F16BD2C8A1D1D`
- `pairing-status-wait.ts`:
  `268C56EAFD190A2A7AEF7C78867568CB4F533F4492393D890DF9F597FF2C6B47`
- `pair-extension.test.ts`:
  `AA32E938705EA64FF0BC5FE0403501A3E7B190FFD966F2269F3687CD2AED0C33`
- `pairing-status-wait.test.ts`:
  `45FD0F3A374802A3CD133D4B8D42A9DC6CC852C85B697560B133259720B3C053`

No extension, Core, shared document, Lab, active bench worktree/run root,
commit, or remote operation was part of Stage 4o.
