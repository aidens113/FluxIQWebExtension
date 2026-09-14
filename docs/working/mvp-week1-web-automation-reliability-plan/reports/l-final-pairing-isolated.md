# `l-final-pairing-isolated` — Stage 4p isolated pairing acceptance

**Status:** stopped — isolated matrix rejected by a deterministic non-pairing
blocker. This worker owns only downstream worktree
`F:\fxlab\fxlab-09fd9c7-a`, run root
`F:\fxlab-runs\final3\pairing-isolated`, and this report. It does not edit
source, Core, shared working documents, or Git history.

## Fixed inputs and safeguards

- Downstream is detached, clean, and pinned to
  `74f6aa0713941206fdc61a739653579ca9fa14bb`.
- Core is detached, clean, and pinned to
  `19468b72c4472fd5cc58940737702d5e4d72c985`.
- The run root was absent before launch. Available memory was 15,708 MiB.
- Runs are sequential, headed Chromium, `isolated`, and use
  `FLUXIQ_TEST_ENV_FILES=none`, a private instance label, the assigned absolute
  run root, and credentials already held only in the process environment.
- Output inspection is restricted to closed verdict/category/invariant,
  persistence, discard, redaction/leak, process/listener, timing, and size
  fields. Credentials and raw page data are never printed or copied here.

## Execution log

The five required cells are queued in this order: W27 primary Flow, W09
primary Flow, W10 primary Flow, W14 `recording`, and W28 `recording`.

### W27 primary Flow — first attempt

- Command shape: `pnpm lab run failure-surfaces --flow --target isolated`.
- Run `run-mu0uv5od-e041e5ac` finalized in 34,682 ms with verdict `failed`,
  category `environment.missing`, Flow not created, two scenario steps, zero
  actions, and zero harness activations. Its closed first-failure summary is
  `FluxIQ authentication failed (401)`. It never reached the pairing gate, so
  it is neither a pairing timeout nor pairing acceptance.
- The instance-local scenario, extension, domain host, dependency, and runner
  builds all passed before the run. The launcher observed Core quiet before the
  build and did not report a Core output change during the run.
- The run finalized a complete bounded bundle with one error event and no
  screenshot. Available memory after it was 15,628 MiB.
- This rejects the literal first-attempt 5/5 matrix. Because a 401 against an
  isolated identity is a rare/impossible shape on this machine and one sample
  is not deterministic, the supervisor authorized the working document's
  faulty-RAM rerun rule. The rerun is retained as a separate observation; it
  cannot erase the first result.

### W27 primary Flow — faulty-RAM classification rerun

- Without rebuilding or changing either pin, the already-built private Lab
  paths were passed directly to the runner and the identical W27 command was
  repeated once under the working document's faulty-RAM rule.
- Run `run-mu0uzku0-7ca922fc` reproduced the same result in 15,584 ms:
  `failed`, `environment.missing`, `FluxIQ authentication failed (401)`, Flow
  not created, two scenario steps, zero actions, and zero harness activations.
  It also finalized one error event, no screenshot, and redaction state
  `not_applicable` because evidence capture never began.
- Before the rerun, a closed boolean comparison confirmed the wrapper's three
  required process values exactly matched the repository environment parser's
  values for the same private source file. No value was printed. This rules
  out the wrapper changing quoting, whitespace, or inline-comment semantics;
  it does not determine why isolated Core rejected the login.
- Two consecutive identical 401 failures prove the non-pairing blocker is
  deterministic enough to activate the brief's stop rule. W09 Flow, W10 Flow,
  W14 recording, and W28 recording were not run. No claim about the pairing
  recovery can be made from this matrix because neither attempt reached it.

## Commands and checks

- Pin/clean/root check: detached checkout of downstream
  `74f6aa0713941206fdc61a739653579ca9fa14bb`, plus read-only `rev-parse` and
  `status --porcelain` for both worktrees and absence check for the run root.
- First attempt: `pnpm lab run failure-surfaces --flow --target isolated`,
  with private instance `pairing-isolated`, the assigned absolute run root,
  process-only credentials, and `FLUXIQ_TEST_ENV_FILES=none`. The launcher
  successfully built scenario-lab, the E2E Chromium extension, the private
  domain host, test contracts/evidence, and test runner.
- Classification rerun: direct invocation of the just-built
  `packages/test-runner/dist/cli.js` with the same `run failure-surfaces
  --flow --target isolated` arguments and the launcher's exact private artifact
  paths. This avoided introducing another build between the observations.
- Bounded inspection read only both bundles' evaluation, first-failure,
  event/screenshot count, action/harness count, redaction state, and cleanup
  metadata. It did not output credentials or page/evidence payloads.

## Cleanup and final state

- Both bundles are complete and preserved under the assigned root. No source,
  shared document other than this report, Core file, or Git history was
  changed.
- Zero Node or browser processes remained whose command lines belonged to the
  assigned worktree or run root. With no owned process, no owned listener
  remains. Available memory was 15,534 MiB at final inspection.
- Downstream remained clean at
  `74f6aa0713941206fdc61a739653579ca9fa14bb`; Core remained clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`.
- Leak, persistence, and action-bearing-discard acceptance are unmeasured, not
  passed: both attempts stopped before pairing/automation and emitted no
  action. Harness activations were zero. The surviving uncertainty is the
  cause of the isolated authentication rejection and, after that is cleared,
  whether the recovery pairs all five required cells.
