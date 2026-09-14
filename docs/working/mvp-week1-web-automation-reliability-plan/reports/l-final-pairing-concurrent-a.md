# `l-final-pairing-concurrent-a` — Stage 4s A matrix

**Status:** complete — A accepted 9/9 pairing observations. This worker owns
only downstream A worktree
`F:\fxlab\fxlab-09fd9c7-a`, new root
`F:\fxlab-runs\final3\pairing-concurrent\a`, and this report. The independent B
worker owns all B state.

## Fixed inputs and safeguards

- Downstream is detached and clean at
  `74f6aa0713941206fdc61a739653579ca9fa14bb`; Core is detached and clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`.
- The A root was absent and 15,552 MiB was available before launch.
- Every child removes `FLUXIQ_TEST_USERNAME`, `FLUXIQ_TEST_PASSWORD`,
  `FLUXIQ_TEST_PIN`, and `FLUXIQ_TEST_TOTP`; no env file is read and
  `FLUXIQ_TEST_ENV_FILES=none` is set.
- Instance `pairing-concurrent-a` uses headed Chromium and disposable isolation.
  Runs remain sequential within A while B remains independently active.
- Inspection is restricted to closed verdict/category/invariant, start,
  redaction/leak, persistence, discard, harness, memory, cleanup, and pin fields.
  No secret, raw page data, or raw payload is printed.

## Execution log

The assigned order is W27 primary Flow, W10 primary Flow, and W28 primary
recording, repeated as a complete three-cell sequence three times.

- Repeat 0, W27 Flow: `run-mu0vlm2y-fd67ff24` passed in 42,185 ms; pairing
  completed, Flow created, start index 0, one click, harness 0, two packets
  (maximum 1,147 bytes), truncations 0.
- Repeat 0, W10 Flow: `run-mu0vn01c-5061d372` passed in 63,306 ms; pairing
  completed, Flow created, start index 0, click plus acknowledged navigation,
  harness 0, four packets (maximum 1,274 bytes), truncations 0.
- Repeat 0, W28 recording: `run-mu0vouny-4e0ff505` passed in 52,479 ms;
  pairing and recording completed, harness 0, with no Flow-lane action or
  packet expected.
- Repeat 1, W27 Flow: `run-mu0vqina-5b28bf77` passed in 56,337 ms; pairing
  completed, Flow created, start index 0, one click, harness 0, two packets
  (maximum 1,147 bytes), truncations 0.
- Repeat 1, W10 Flow: `run-mu0vscdf-240f76d1` passed in 71,766 ms; pairing
  completed, Flow created, start index 0, click plus acknowledged navigation,
  harness 0, four packets (maximum 1,274 bytes), truncations 0.
- Repeat 1, W28 recording: `run-mu0vub1k-4b06e028` passed in 57,050 ms;
  pairing and recording completed, harness 0, with no Flow-lane action or
  packet expected.
- Repeat 2, W27 Flow: `run-mu0vw0pk-e75e8ad5` passed in 42,859 ms; pairing
  completed, Flow created, start index 0, one click, harness 0, two packets
  (maximum 1,147 bytes), truncations 0.
- Repeat 2, W10 Flow: `run-mu0vxjps-e768e343` passed in 71,784 ms; pairing
  completed, Flow created, start index 0, click plus acknowledged navigation,
  harness 0, four packets (maximum 1,274 bytes), truncations 0.
- Repeat 2, W28 recording: `run-mu0vzl3x-ae4af293` passed in 29,946 ms;
  pairing and recording completed, harness 0, with no Flow-lane action or
  packet expected.

## A verdict and bounded diagnostics

- All nine bundles are complete and passed every runner invariant. Each reached
  gateway action traffic and finalization with no error event, so A contributes
  9/9 pairing acceptances and zero pre- or post-approval timeouts.
- All six Flow observations created a Flow, reported and observed `passed`, and
  have `startCandidateIndex: 0`. They executed nine registered actions in
  total: three W27 clicks and three W10 click/navigation pairs.
- Harness activations were 0 across all nine. No run reported a persistence
  failure, and both discard reads had `discardsAfterFirstRead: 0` throughout.
- Two unique post-finalization event-only disclosures occurred: one W28 repeat
  0 `recording.event_discarded` at 6 ms and one W10 repeat 2 at 7 ms. Each had
  `discardedActions: 0` and `discardedEvents: 1`. They appear in both bounded
  discard reads, so four observed rows represent two unique disclosures. There
  were zero action-bearing discards. They are disclosed, not hidden as zero.
- Every redaction attestation was `not-applicable` because these cells declare
  no secret literal, and all nevertheless reported zero findings/advisories.
  This is not a secret-bearing leak proof; no leak finding activated the stop
  rule.
- Every Flow packet-budget invariant passed. W27 always measured two packets,
  maximum 1,147 bytes; W10 always measured four, maximum 1,274 bytes. All six
  Flow runs had zero truncations.

## Commands and environment

- The first W27 invocation used `pnpm lab run failure-surfaces --flow --target
  isolated`, building the private scenario-lab, E2E extension, domain host,
  contracts/evidence, and runner outputs before running.
- Subsequent fixed-build calls directly invoked
  `packages/test-runner/dist/cli.js` with one of:
  - `run failure-surfaces --flow --target isolated`
  - `run navigation --flow --target isolated`
  - `run iframe-checkout --target isolated`
- Each child ran the memory guard, removed all four web-panel credential
  variables, set `FLUXIQ_TEST_ENV_FILES=none`, and received only the assigned A
  root/private artifact paths and exact sibling Core path. No env file was read.

## Cleanup, pins, and uncertainty

- All nine assigned bundles are complete. Zero Node/browser processes remained
  whose command lines belonged to the A worktree, root, or instance, so no A
  listener remained. Final available memory was 15,442 MiB.
- Downstream remained clean at
  `74f6aa0713941206fdc61a739653579ca9fa14bb`; Core remained clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`.
- This report establishes only A's 9/9 half. Combined 15/15 acceptance depends
  on the independently owned B report and supervisor review.
- As in the isolated matrix, successful bundles do not expose a closed
  connect-attempt count. They prove bounded pairing under shared load but do not
  identify whether the new cold-epoch reconnect branch fired.
