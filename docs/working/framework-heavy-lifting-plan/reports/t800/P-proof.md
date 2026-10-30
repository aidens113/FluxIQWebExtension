# t800 / proof: recent group posts by a CC2 mark and a date bound, headed and provider-free

The first attempt (worker P-proof) was blocked because the domain did not compile (`packet.ts` lacked the
request's new `now`). The sub-supervisor fixed it. The second worker's driver died before the lock freed, so the
sub-supervisor ran the proof itself with the worker's scripts.

## Outcome

Passed. Replay `replay-mvu2ksyn-10c26651`, task `social-network-feed-recent-group-posts`, verdict `passed`, reasons
`[]`. Stored 3 rows, expected 3, matched 3 in order, 15/15 fields, 0 unexpected rows, `extraColumns: []`,
collected 8, duplicates 5, filtered out 0. Model: `modelProvidersEnabled: false`, `coreProviderCallCount: 0`,
`accountedCalls: 0`, `llmGate.invoked: false`.

## The Flow (scratch `t800-proof-flowA2.txt`)

This is the t790 Flow with two changes:
- Membership is a CC2 mark field, `"member": {"kind": "attribute", "selector": "svg[role=\"img\"][aria-label^=\"Shared
  with Members of\"]", "attribute": "aria-label", "mark": "badge", "required": false}`, kept by
  `{"field": "member", "is": "present"}`. t790 used a `where` `read` test instead.
- `recordOutput.process` adds `"columns": ["group", "author", "posted", "text", "comments"]`, so the mark is stored
  but not answered.
- Date: `{"field": "posted", "atLeast": "2026-09-19", "as": "date"}`. No group name, no date pattern.

## Commands (all inside the heavy-check lock)

- `FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs recovery-matrix --list` -> exit 0 (rebuilt
  `extension:build`, reused the rest).
- `FLUXIQ_TEST_ENV_FILES=none node t800-proof-driver.mjs t800-proof-flowA2.txt a2` -> exit 0, result above.
- Evidence: `W/test-runs/t800-proof/t800proof-a2-4af2f0/` (`proof.json`, screenshots `00-before-run.png` to
  `zz-after-run-full.png`).

## Not verified

- The per-condition account (which condition alone left out which row) was not extracted this time. t790's account
  on the same fixture showed both the mark and the date bound doing necessary work.
- `within` and relative bounds were not exercised live. The fixture's dates are September 2026 and the run is
  29 October 2026, so a `within` would keep nothing. They are covered only by the shared parity cases.
- Firefox, and a model authoring this Flow.
