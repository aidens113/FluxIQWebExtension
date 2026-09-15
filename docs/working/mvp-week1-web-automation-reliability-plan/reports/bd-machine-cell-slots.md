# `bd-machine-cell-slots` — global bounded concurrency lease

## Outcome

Implemented a reusable filesystem-backed FIFO machine slot pool under the new
assigned `bench/campaign/machine-slots/` directory. The default global capacity
is two active isolated cells. Tickets and active owners are fenced by boot,
PID, and process-start identity, and ownership is claimed by atomically renaming
the caller's published ticket directory into a numbered slot.

## Contract and behavior

- The pool publishes strict schema `0.1` owner records containing only a random
  ticket ID, PID, SHA-256 boot/process identities, and request time.
- FIFO order is request time plus ticket ID. Only the earliest tickets fitting
  currently available capacity can claim a slot, preventing one scheduler from
  overtaking another.
- The default memory gate retains 4 GiB and budgets 3 GiB for every active slot
  plus the candidate's FIFO rank. Including active owners prevents a second
  ticket whose queue rank has reset to zero from being admitted on only 7 GiB;
  two admitted slots require at least 10 GiB. A pluggable free-memory probe
  supports deterministic tests and machine-specific integration.
- Polling and total wait are bounded and strictly validated. Timed-out callers
  remove only their own ticket.
- Dead, rebooted, and PID-reused ticket or slot owners are atomically moved to
  history before capacity is reused. Process-probe uncertainty propagates as a
  hard failure.
- Stable malformed/unreadable ownership fails closed. A one-time re-read
  distinguishes malformed ownership from a directory that atomically vanished
  during ordinary release/claim contention.
- Release verifies the exact ticket before removing a slot, tolerates Windows
  reader/remover contention with bounded native retries, and is idempotent for
  its owner handle.
- Relative/filesystem-root paths, unsafe IDs, invalid PIDs, absent current
  process identity, unsafe capacity, timeout, and memory configurations are
  rejected before a claim.

## Validation

The test-runner package check and build passed. The focused emitted test passed
10/10, covering:

- two-slot concurrency and a blocked third caller;
- cross-scheduler FIFO progress;
- the 4 GiB reserve plus 3 GiB new-slot memory threshold;
- the regression where one active slot and 9 GiB free blocks the second until
  the probe reports the required 10 GiB;
- dead, rebooted, and PID-reused owner recovery;
- stable unreadable-owner refusal;
- unsafe root/config/identity/ticket rejection; and
- idempotent release and exact ownership checks.

`git diff --check -- packages/test-runner/src/bench/campaign/machine-slots`
passed. An earlier package-check attempt was blocked by parallel sharding
integration, but the final rerun after that integration settled passed.

## Boundary

No existing barrel, lease, campaign, CLI, executor, Lab artifact, or Core file
was edited for this task. No Lab/corpus run, commit, or push was performed.
