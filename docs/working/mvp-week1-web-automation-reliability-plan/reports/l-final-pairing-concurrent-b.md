# `l-final-pairing-concurrent-b` — Stage 4s concurrent acceptance

**Status:** complete — B pairing matrix accepted 6/6. This worker owns only downstream worktree
`F:\fxlab\fxlab-16ff729-b`, new root
`F:\fxlab-runs\final3\pairing-concurrent\b`, and this report.

## Fixed inputs and safeguards

- Assigned cells: W09 primary Flow and W14 `interstitial` recording, three
  repetitions each (six total), while the independent A instance remains active.
- Every child removes `FLUXIQ_TEST_USERNAME`, `FLUXIQ_TEST_PASSWORD`,
  `FLUXIQ_TEST_PIN`, and `FLUXIQ_TEST_TOTP`, and sets
  `FLUXIQ_TEST_ENV_FILES=none`; no env file is loaded.
- Runs use headed Chromium, disposable `isolated` targets, a private B instance,
  and the assigned absolute run root. Inspection is restricted to bounded,
  closed evidence fields; no credential, token, raw page, or payload data is
  printed or copied.

## Execution log

Preflight accepted: downstream is detached and clean at
`74f6aa0713941206fdc61a739653579ca9fa14bb`; the linked Lab Core checkout is
detached and clean at `19468b72c4472fd5cc58940737702d5e4d72c985`.
The assigned root was absent, no pre-existing assigned Lab process existed,
and available memory was 13,772 MiB. The first call will build B's private
instance locally, after which the remaining five calls will reuse those exact
artifacts through the runner CLI.

| Repetition | Cell | Run | Verdict | Duration | Start | Harness |
| ---: | --- | --- | --- | ---: | ---: | ---: |
| 1 | W09 primary Flow | `run-mu0vmvsa-f802eb76` | passed | 54,952 ms | 0 | 0 |
| 1 | W14 `interstitial` recording | `run-mu0vp0c6-6dce36ea` | passed | 46,493 ms | n/a | 0 |
| 2 | W09 primary Flow | `run-mu0vq9ij-9d354c73` | passed | 57,109 ms | 0 | 0 |
| 2 | W14 `interstitial` recording | `run-mu0vrrvo-d23744df` | passed | 35,943 ms | n/a | 0 |
| 3 | W09 primary Flow | `run-mu0vt2t5-65198507` | passed | 49,049 ms | 0 | 0 |
| 3 | W14 `interstitial` recording | `run-mu0vuequ-b9c3e094` | passed | 53,747 ms | n/a | 0 |

All six runs paired and passed without a pre-approval timeout. The three Flow
evaluations passed the runner-verdict and evidence-packet-budget invariants,
created one-candidate Flows, started at candidate 0, and finished `succeeded`.
The three recording evaluations passed their runner-verdict invariant. No
harness activation or categorized automation failure appeared.

## Closed evidence and concurrency

- The six bundles are complete. Oracle and reported outcomes agree wherever a
  reported Flow outcome exists. W09 executed one `web.dom.click` in each
  repetition; recording correctly executed no Core Flow action.
- Each W09 bundle held two sanitized packets totaling 11,773 bytes, maximum
  5,909 bytes, with two truncations; all three packet-budget invariants passed.
  Recording held no sanitized packets under its lane contract. Raw-snapshot
  byte arrays were empty throughout.
- Every bundle's redaction attestation was `not-applicable` because the cells
  declared zero secret literals; all reported zero findings and zero
  advisories. This is not represented as a secret-bearing leak test.
- Both recording-discard reads in every bundle returned zero entries: zero
  discarded actions, zero discarded events, and zero late event-only rows.
  There was no `recording.persistence` signal or failure.
- The 3 GiB memory start guard passed before every invocation. Numeric endpoint
  samples were 13,772 MiB initially and 14,904 MiB finally; interval minima
  were not sampled, so no stronger minimum claim is made.
- Concurrency was real for the complete B materialization window. The A root
  had a completed run before B's first bundle, had six completed runs by B's
  finish, and still owned active Node/PowerShell processes immediately after
  B's sixth bundle completed.

## Commands and artifact control

- Instance-local build plus repetition 1 W09:
  `pnpm lab run data-table --workflow sort-by-price --flow --target isolated`.
  The launcher built scenario-lab, headed Chromium E2E extension, domain host,
  test contracts/evidence, and test runner, all successfully, into private
  instance `pairing-concurrent-b`.
- The remaining calls reused the launcher's exact private extension, scenario,
  and host paths through `node packages/test-runner/dist/cli.js`: W14
  `run modal-flows --workflow interstitial --target isolated` three times total
  and W09 `run data-table --workflow sort-by-price --flow --target isolated`
  three times total, alternating after the initial W09 run.
- Every invocation explicitly removed all four panel credential variables,
  set `FLUXIQ_TEST_ENV_FILES=none`, and used the assigned absolute root. No env
  file was read and no credential value was printed or persisted by this work.

## Cleanup, pins, and uncertainty

- The assigned root contains exactly six complete bundles and no staging
  directory. It is preserved; nothing was deleted.
- No Node/browser process remained whose command line belonged to the B
  worktree or root; consequently no owned TCP listener remained.
- Downstream remained detached and clean at
  `74f6aa0713941206fdc61a739653579ca9fa14bb`; linked Core remained detached and
  clean at `19468b72c4472fd5cc58940737702d5e4d72c985`.
- This report accepts only B's assigned 6/6 concurrent observations. The
  cross-worker 15/15 acceptance depends on the independent A report. As with
  the isolated matrix, successful bounded pairing is proven, but the bundles
  expose no connect-attempt counter and therefore do not show whether any run
  actually consumed a cold-epoch retry.
