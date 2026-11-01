# Domain paging acceptance

Outcome: Done; Domain production source unchanged. Tests are frozen for lead verification.

Changed:

- `domain/src/runtime/tests/paging-progress/tests/evidence.test.ts`
- `domain/src/runtime/tests/paging-progress/tests/playback.test.ts`
- `domain-brief.md` beside this report, corrected only under the lead's explicit follow-up authorization.
- This report.

The corrected stable receipt is the existing `NO_EFFECT` constructor: `web.action.no_effect`, execution stage, `effect: unacted`, `certainNoEffect: true`, retryable. It is admitted only when the browser establishes no pagination effect and no possible outstanding supported click work. Verification-stage `OUTPUT_NOT_OBSERVED` remains protected, including a receipt carrying an unacted label. No new wire field, metadata waiver, Core operation identity, or Domain production change is needed.

The ten focused tests cover the production evidence retry wrapper, actual exploration through a detected-list handle, actual draft step replay, canonical paired IO dispatch, and real required service playback. A genuine no-effect followed by success sends twice and advances exactly one page. Repeated no-effect sends exactly four times and advances zero pages, without manufactured stale-source refresh. Verification/unacted, unknown, ambiguous, lost acknowledgement, permanent, and original non-retryable controls remain protected. Forged request fields and observer/loop/idempotence annotations cannot lower the registered pagination commit floor.

Required playback uses Core's supported `builtin.policy.action` output-dispatch boundary, with both actual Domain IO and `createWebAutomationRuntimeAdapter` registered. The public native runtime is also registered with the real Domain manifest/bundle, so its output declaration supplies the trusted `commit` floor even for a policy node. The fixture asserts that floor before execution. Direct native web-node execution in required mode is intentionally unsupported by Core; it was a fixture error, not a propagation defect. SQLite is necessary here to exercise real required-command settlement and durable service history. All storage is in a validated temporary root; providers are disabled, the paired transport supports only synthetic pagination/capture, and cleanup checks its owned absolute path.

## One-command recovery budget

`apps/extension/src/content/action-runtime/recovery/fault.ts:133,374` already excludes `NO_EFFECT` from page recovery via `ABSORBED_ELSEWHERE`. The press is counted and repeated only by Core's first-plus-three policy. Reusing the content recovery loop for a post-click pagination failure would either be refused by current gates or multiply physical clicks if those gates were relaxed.

`content/actions/next-page.ts:59` passes the command timeout to the page mover; `content/extraction/page-advance/move-page.ts:56` creates one deadline for that move. Private checkpoint/status/exact-origin restoration may spend only the remaining deadline, polling or restoring without another press. It must not start a fresh command budget or another click ladder. After genuine settled no-effect, return the existing receipt and let Core count the next attempt. Pending, unsupported, tampered, changed-origin, arbitrary-control, or otherwise unproven outcomes stay uncertain.

The public gateway command owner contains only project/run/flow/invocation/attempt/effect ordinal. The executor creates a new invocation UUID per attempt; neither node ID nor parsing attempt IDs grants a safe retry group across loop passes. The lead explicitly confined recovery to one command instead, so no metadata derivation or token is introduced.

## Validation

Command (PowerShell, private t839 downstream root):

```powershell
$env:DOMAIN_TEST_BUILD_LABEL='t839-paging-contracts'; pnpm.cmd --filter @fluxiq-web-extension/domain test runtime/tests/paging-progress/tests
```

Observed final freeze run: **10 tests, 10 pass, 0 fail/cancelled/skipped; 12088.6823 ms; child exit 0.** The Core build guard reported the sibling build current with source. This rerun includes the fixture-only const alias preserving the narrowed public dispatcher function. The preceding behavioral run also passed 10/10 in 11733.1765 ms.

Investigation failures were not hidden: the original verification/unacted proposal stopped at one attempt at Core's existing after-action gate, which caused the lead's corrected receipt contract. An intermediate run after that correction passed 8/10; the two native required-playback fixtures stopped before dispatch with `executor.unsupported_native_or_composite`. Registering the real native floor and using required mode's supported policy-output boundary resolved both failures without production changes or weakened assertions. A standalone real-service attempt also required a held fixture timer because Core's backoff timers are unreferenced; the timer is cleared at teardown.

Source review: both test files contain no casts, suppression directives, `any`, or object spreads. Cross-directory imports use public/owning barrels. The brief remains limited to focused tests and this report; no production file, Core, Extension, provider, browser, fixture/oracle, git, or shared working document was changed.

Not verified: actual DOM provenance, click-causal deferred-work accounting, target readiness, and checkpoint restoration are the producer/browser lane's separate acceptance. No package typecheck/build, structure audit, full suite, candidate whole-Flow trial, browser or provider execution was run under this worker's brief. The service tests stub trusted paired receipts; they do not claim physical browser proof.

Notes:

- Preserve the original strict failure controls; no code-only relabeling or verification-stage bypass.
- Browser proof can use `webNodeDispatchWithRetries` through its owning barrel and map each actual harness result with public `gatewayActionResultFromBrowserResult`, without hand retries.
- All worker edits remain uncommitted for the lead's integration; workers are prohibited from git mutations.
