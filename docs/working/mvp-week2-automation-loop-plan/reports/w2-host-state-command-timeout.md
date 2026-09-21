# Report: w2-host-state-command-timeout

Worker report for brief `w2-host-state-command-timeout`. Work was performed in
the fresh isolated pair `F:\fxlab\t027-host-timeout\!FluxIQWebExtension` and
`F:\fxlab\t027-host-timeout\!FluxIQ`. The earlier unproven batch-wording diff
was not present. No commit or push was made.

## Outcome

Done. Downstream web host-state commands now carry a finite 5,000 ms gateway
command timeout, matching Core's ordinary `builtin.policy.action` default. The
identical real-provider created-Flow lane then reached a terminal readable
outcome instead of remaining `running` through the 600-second read-back window.

Live run `run-muah724i-1e821737` passed in 197,849 ms end to end. The built Flow
finished with `status: succeeded`, `reportedVerdict: passed`, and
`oracleVerdict: passed`; it executed 10 browser actions, used 4 provider calls,
and required no harness recovery. Its terminal runtime settlement was published
about 84 seconds after build settlement and about 139 seconds after initial
runtime dispatch, far inside the old 600-second failure window.

## What changed and why

- `domain/src/runtime/host-runtime.ts`
  - Added a host-runtime dispatch shape that admits optional `timeoutMs` without
    broadening the shared expectation-evaluator contract.
  - Added `HOST_STATE_COMMAND_TIMEOUT_MS = 5_000`, explicitly aligned with
    Core's ordinary policy-action default.
  - Forwarded that bound on both `captureStateSnapshot` and
    `observeRouteState` calls to `web.dom.capture_snapshot`.
- `domain/src/runtime/tests/host-runtime.test.ts`
  - After the live proof, extended the focused gateway spy and asserted that
    both attempt snapshots and Router route-state snapshots carry 5,000 ms.

This is deliberately downstream-only. It does not change Core, the outer
30-second HTTP request policy, the 600-second granted-run read-back bound, batch
prompting/telemetry, or browser content.

## Live-first proof

The real-provider command was the same focused lane used for the preceding
created-Flow diagnosis:

```text
pnpm lab run social-scheduler --target isolated --live-llm
  --llm-profile lab-create-flow --llm-provider deepseek
  --llm-model deepseek-chat --llm-task create-flow
  --instruction-task social-scheduler-schedule-post
  --llm-max-actions-per-decision 16 --llm-max-input-tokens 48000
  --llm-max-output-tokens 8000 --llm-max-total-tokens 56000
  --llm-max-run-tokens 600000 --llm-max-calls 26
  --llm-timeout-ms 30000 --llm-max-retries 0
  --llm-max-cost-usd 0.25
```

The provider credential was injected process-locally from the main checkout
and was neither printed nor copied. The isolated instance and run/cache roots
were unique to this unit.

Sanitized lifecycle evidence:

| Event | UTC | Result |
| --- | --- | --- |
| Runtime dispatch | 2026-09-20 23:58:02.613 | Created-Flow lane started. |
| Build settle | 23:58:57.581 | Proposal settled; snapshot reports 47,586 ms build duration. |
| Runtime settle | 2026-09-21 00:00:21.267 | Terminal run detail became readable. |
| Flow settle | 00:00:21.303 | Runtime run id, action count, and Flow shape published. |
| Final | 00:00:21.306 | Final verdict published. |

The terminal Flow snapshot records `status: succeeded`, a present
`resultVerification` value (`no_result` for this task), 10 durable actions, and
both reported and oracle verdicts as `passed`. The evaluation reports 20
sanitized evidence packets, all within the 6,000-byte policy. No page evidence,
instruction text, credential, target value, or raw snapshot is reproduced here.

## Validation after live proof

- `pnpm --filter @fluxiq-web-extension/domain check` before the live run:
  passed (`tsc` source and test configurations).
- Focused bundle and execution of only
  `domain/src/runtime/tests/host-runtime.test.ts` after the live proof:
  12/12 tests passed in 19.4 ms.
- `git diff --check` over the two source/test files and this report: passed.
- No package-wide or full-suite test run was performed.

One initial focused-test invocation used the workspace root's `pnpm exec`,
where `esbuild` is not exposed, and exited before building. Re-running through
the owning domain package resolved the executable and the focused test passed;
this was an invocation error, not a product/test failure.

## Files changed

- `F:\fxlab\t027-host-timeout\!FluxIQWebExtension\domain\src\runtime\host-runtime.ts`
- `F:\fxlab\t027-host-timeout\!FluxIQWebExtension\domain\src\runtime\tests\host-runtime.test.ts`
- This report in the main task working-document report directory.

## Not verified

- A deliberately silent-browser fault injection was not run. The live proof
  exercised the real created-Flow path and terminal read-back, while the focused
  test proves both host-state dispatch shapes carry the finite command bound.
- No full domain, repository, or Core suite was run, per the live-first narrow
  validation brief.
- No batch-adoption wording was included or retested in this clean unit.

## Handoff

The source and focused test diffs are uncommitted in the isolated downstream
worktree. Core is unchanged. The senior supervisor should review and integrate
only this downstream unit; it is independent of the still-unproven batch
adoption wording.
