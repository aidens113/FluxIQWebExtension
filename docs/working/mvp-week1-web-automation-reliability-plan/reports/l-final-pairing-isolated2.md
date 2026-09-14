# `l-final-pairing-isolated2` — Stage 4r corrected isolated acceptance

**Status:** complete — corrected isolated matrix accepted 5/5. This worker owns
only downstream worktree
`F:\fxlab\fxlab-09fd9c7-a`, new root
`F:\fxlab-runs\final3\pairing-isolated2`, and this report.

## Fixed inputs and corrected contract

- Downstream is detached and clean at
  `74f6aa0713941206fdc61a739653579ca9fa14bb`; Core is detached and clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`.
- The assigned root was absent and 15,415 MiB was available before launch.
- Every child explicitly removes `FLUXIQ_TEST_USERNAME`,
  `FLUXIQ_TEST_PASSWORD`, `FLUXIQ_TEST_PIN`, and `FLUXIQ_TEST_TOTP`; no env file
  is loaded. `FLUXIQ_TEST_ENV_FILES=none` remains set.
- Chromium is headed, the target is disposable `isolated`, runs are sequential,
  and all builds and evidence stay in the assigned instance/root.
- Inspection is limited to closed verdict/category/invariant, start-index,
  redaction/leak, persistence, discard, harness, memory, process/listener, and
  pin fields. No credential, token, or raw page data is printed.

## Execution log

W27 primary Flow is the discriminating probe. W09 primary Flow, W10 primary
Flow, W14 `interstitial` recording, and W28 primary recording follow only if
W27 clears bootstrap authentication and reaches pairing.

| Cell | Run | Verdict | Duration | Start | Harness | Executed actions |
| --- | --- | --- | ---: | ---: | ---: | --- |
| W27 primary Flow | `run-mu0vaif7-28e8dfcb` | passed | 45,635 ms | 0 | 0 | `web.dom.click` |
| W09 primary Flow | `run-mu0vbx3l-ef08c4ad` | passed | 41,940 ms | 0 | 0 | `web.dom.click` |
| W10 primary Flow | `run-mu0vd56v-5742ab90` | passed | 47,979 ms | 0 | 0 | `web.dom.click`, `web.browser.navigate` |
| W14 `interstitial` recording | `run-mu0vegeh-968aee1d` | passed | 30,830 ms | n/a | 0 | none (recording lane) |
| W28 primary recording | `run-mu0vfg3k-b5370c0d` | passed | 34,759 ms | n/a | 0 | none (recording lane) |

The W27 probe cleared authentication, paired, created and ran its Flow, so the
remaining sequence proceeded. All five reached gateway action traffic and a
final event with no error event; therefore pairing acceptance is 5/5 with zero
pre- or post-approval timeout. The three Flow runs all prove
`startCandidateIndex: 0`. Every runner invariant passed.

## Evidence and safety inspection

- All five bundles finalized completely. Verdicts and expected oracle/reported
  results agree on every lane; there was no categorized automation failure.
- Harness activations were 0 in every evaluation. The two recording lanes
  correctly executed no Core Flow action; the three Flow lanes executed four
  registered actions in total.
- The three Flow bundles measured 2, 2, and 4 sanitized packets respectively.
  Their maxima were 1,147, 5,909, and 1,274 bytes, all within the 6,000-byte
  invariant; truncation counts were 0, 2, and 0.
- Each redaction attestation was `not-applicable` because these cells declared
  zero secret literals; every attestation nevertheless reported zero findings
  and zero advisories. This is not represented as a secret-bearing leak proof.
- Both discard reads in every run reported zero rows, including zero discarded
  actions/events and `discardsAfterFirstRead: 0`. Thus action-bearing discards
  and late event-only discards were both zero. No `recording.persistence`
  failure occurred.
- The memory guard ran before every child and never approached its 3 GiB stop
  point. Initial available memory was 15,415 MiB.

## Exact command/check shape

- W27 used `pnpm lab run failure-surfaces --flow --target isolated`, which built
  scenario-lab, E2E Chromium extension, domain host, test contracts/evidence,
  and test runner into private instance `pairing-isolated2` before launching.
- With those exact private bytes fixed, the remaining calls directly invoked
  `packages/test-runner/dist/cli.js` as:
  - `run data-table --workflow sort-by-price --flow --target isolated`
  - `run navigation --flow --target isolated`
  - `run modal-flows --workflow interstitial --target isolated`
  - `run iframe-checkout --target isolated`
- Every child explicitly removed the four web-panel credential variables, set
  `FLUXIQ_TEST_ENV_FILES=none`, and used the assigned run root, A worktree,
  private build paths, and pinned sibling Core checkout. No env file was read.

## Cleanup and remaining uncertainty

- No Node or browser process remained whose command line belonged to the
  assigned worktree or run root; therefore no owned listener remained. Final
  available memory was 15,561 MiB, and all five bundles were complete.
- Downstream remained clean at
  `74f6aa0713941206fdc61a739653579ca9fa14bb`; Core remained clean at
  `19468b72c4472fd5cc58940737702d5e4d72c985`.
- This accepts the corrected one-pass isolated matrix. The bundles do not
  expose a successful connect-attempt count, so they prove successful bounded
  pairing but cannot say whether any cell exercised the new cold-epoch retry.
  The required concurrent repeat-three matrix remains separate work.
