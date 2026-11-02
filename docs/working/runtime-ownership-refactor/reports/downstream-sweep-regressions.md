# Downstream sweep regression triage

Outcome: SOURCE FROZEN. All 25 historical failures are repaired through the seven failed test subjects and one shared test helper. Core production and the historical pair remain unchanged. Normal current-tree acceptance awaits the lead's coordinated Core rebuild.

## Exact historical baseline

Lead provisioned t844 at downstream `c9056f1a` / Core `16b5043c` and confirmed its normal built libraries ready. The unchanged historical tests reproduce all 25 observed sweep failures: 31 tests, 6 passed, 25 failed, 80.652 seconds.

Command, from t844 downstream, with `DOMAIN_TEST_BUILD_LABEL=sweep-baseline`:

`pnpm.cmd --filter @fluxiq-web-extension/domain test refusal-notice.test replay-other-record.test replay-ambiguous-target.test replay-remembered.test listing-order-in-repeat.test carried-row-service-repair.test carried-service-repair.test`

Observed exit 1. The ignored baseline log is t844 downstream `.fluxiq/refactor/sweep-baseline.log`. The 25 titles and actual outcomes match the original daily sweep. This establishes that these failures predate the ownership migration; it does not by itself establish their causes or validate the current task tree.

## Causes and bounded corrections

- Fifteen refusal/replay failures: fixture host replies provide only a failure code and optional text. They omit the required category, retryability, stage and effect controls. The existing fail-closed guard correctly treats the dispatched committing press as uncertain. Fixtures now use the actual closed web failure constructor, which truthfully reports target resolution/refusal as unacted. Target failures exhaust the required initial attempt plus three retries; exact request-count assertions reflect all four unacted attempts. Reason, redaction, effect, record provenance and one-navigation oracles are retained.
- Five listing-order failures: the fake resolver sends only extraction through the domain and answers `unchanged` for the lasting click without consulting its permission callback. Core correctly refuses the unchecked consequence before reaching the listing-order rule. The fixture now publishes and observes the actual button, copies its real handle into the script and delegates every node to the actual domain resolver; the original precise order-rule acceptance/refusal assertions remain.
- Five carried-repair failures: the scripted mock providers search historical result `.page` fields, but the pre-refactor context already replaces them with view references and publishes the whole page under `core.current_view.value.groups`. Their seed-field assertion throws before returning the replacement tool call. Test support now reads the current published page group. Original real writer, schema, binding, declaration, permission, mutation and full-test assertions remain.

## Validation

Lead authorized an ignored esbuild TEST-only virtual overlay onto unchanged t844 production. This validates corrected fixtures against the historical implementation without changing its source. The listing test's canonical registry import is virtually mapped to the historical Studio export because that old package predates the new canonical barrel.

- From t843 downstream: `node .fluxiq/refactor/run-test-overlay.mjs refusal-notice.test replay-other-record.test replay-ambiguous-target.test replay-remembered.test listing-order-in-repeat.test` -> the four refusal/replay files passed all 19 tests; the first listing correction exposed an additional truthful-fixture requirement (an observed handle), corrected next. Its initial five failures were retained in the ignored leaf log.
- `node .fluxiq/refactor/run-test-overlay.mjs listing-order-in-repeat.test` -> final corrected listing overlay passed 5/5, exit 0. Log `.fluxiq/refactor/sweep-overlay-listing-resolved.log`.
- `node .fluxiq/refactor/run-test-overlay.mjs carried-row-service-repair.test carried-service-repair.test` -> final current-page overlay passed 7/7, exit 0, 12.833 seconds. Log `.fluxiq/refactor/sweep-overlay-carried-current-page.log`. An earlier helper selected the wrong group; that failed probe remains in `.fluxiq/refactor/sweep-overlay-carried.log`.
- Thus the seven corrected subjects cover 31 distinct tests, all passing against unchanged historical production across the final scoped groups. This is fixture validation, not current integration acceptance.
- From unchanged t844 downstream, with `DOMAIN_TEST_BUILD_LABEL=sweep-safety`: `pnpm.cmd --filter @fluxiq-web-extension/domain test lasting-act.test uncertain-outcome.test plan-step-permission.test replay-permission-reason.test` -> 52/52 passed, exit 0, 31.619 seconds. This retains the unknown/uncertain committing-action stop, complete retry controls and declaration/permission floors. Log t844 downstream `.fluxiq/refactor/sweep-safety.log`.
- Additional requested historical Core baseline: the eight exact subjects in the updated brief reproduced all 14 Core sweep failures: 55 passed, 14 failed, 8 failed files, exit 1, 40.16 seconds. Log t844 Core `.fluxiq/refactor/core-eight-baseline.log`. The separate Core fixture brief/report owns their corrections.

Changed authored files: the seven test subjects named in the brief, `domain/src/runtime/tests/current-page.ts`, and this report. No downstream production file changed.

The normal current t843 runner is pending the lead's coordinated Core source freeze and rebuild. No provider calls, browser runs, full suite repetition, Core source edits or baseline source edits are authorized or performed.
