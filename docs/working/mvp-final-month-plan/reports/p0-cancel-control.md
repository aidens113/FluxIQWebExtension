# P0 cancellation and reachable Stop

Status: Active
Created: 2026-10-06
Last updated: 2026-10-06
Owner: p0-cancel-control worker
Scope: Paired task t298 cancellation control implementation and narrow evidence.

## Current State

Implementation is complete locally in paired t298 trees. Source is frozen; both provider-free headed browser proofs and all final narrow checks pass. Supervisor integration and independent verification remain pending. No worker git mutations, paid calls, full suites or user-panel management occurred.

Initial inspection: Core had run cancellation but no active-build controller. Build loop signals combine permission/person-needed signals, and top-level bootstrap generation has no external cancellation scope. The extension panelStopRun relay exists, but chat does not mount a reachable general Stop control. Build activity IDs are random; the correct build cancellation target is subject.flowId, while run cancellation targets subject.id. A stale paced display is insufficient authority to target active work.

## Decisions

- Reuse panelStopRun routing with an explicit optional flowId build target; reject ambiguous run plus Flow targets.
- Add Core cancel-flow-bootstrap (runtime.control, authoring) through paired-client allowlist; no new broader permission grants.
- Keep controller lifecycle and AsyncLocalStorage cancellation scope in a focused Core module. Register before database/lock waiting and clear only the matching operation in finally.
- Feed controller signal to provider, tools, permission/person-needed waits and judge. Check at persistence after awaited validation to refuse late results.
- A cancelled build cannot be described as ready. Stop acknowledgement means requested cancellation, with final activity determining settled state.
- Already dispatched irreversible browser effects are not rolled back. Preserve existing run cancellation semantics.

## Validation

Provider-free owning controller/API tests, actual Core build cancellation tests and extension Stop tests have run. Exact outcomes and remaining live limits follow below.

## Implementation ledger

- Added scoped Core controller, build cancellation endpoint and restricted paired-client allowlist; inherited run signal for reauthor builds. Provider/tools/permission waits/judge receive abort; cancellation is checked before proposal persistence.
- Added visible chat Stop build/run with raw subject target and owner/connection gates. Core cancellation response remains pending until final activity, failures allow retry. Background relay reuses existing run cancellation and refuses ambiguous targets.
- Added stopped terminal headline and architecture documentation in both repositories.
- Controller tests initially failed because module was absent, then passed 3/3; added pre-aborted parent test afterward. Core service negatives passed 2/2 after correcting test's nonexistent public list method to assert no create call. Focused API/run handler tests passed 25/25. Initial typecheck passed before new API test, then caught a test-only permissions literal widening; corrected.
- Extension Stop/run-relay/chat focused tests passed 15/15. Typecheck passed initially; a later repeat overlapped Core's rebuilding dist and saw missing Core declarations. Repeat must run after dependency build completes; this failure is not product evidence.
- Structure audit caught a new test pushing existing service-bootstrap tests directory over 25 files; moved owning service cancellation test beside cancellation module. It also flagged obsolete-owner catch discard; documented the intentional owner boundary while current-owner failures remain visible. Subsequent downstream audit reports passed (exit 0).
- Provider-free headed real extension/Core cancellation proof authored with synthetic gateway transport and actual Core service controller. No paid calls or user-panel management. Both build and active-run cases pass against rebuilt matching artifacts.

## Current validation receipts

- Core `pnpm.cmd --filter fluxiq check`: exit 0 after final source accounting/cause wiring.
- Core 5 owning test files: 31/31 passed; expanded service-cancellation tests afterward: 3/3 passed. Actual service coverage: before provider resolution, queued generation lock, pending ignored provider and actual evidence tool, no next dispatch/no proposal/unchanged Flow.
- Core `pnpm.cmd --filter fluxiq build`: exit 0. This is one touched-package dependency build, not a whole suite.
- Core and downstream `node scripts/structure-audit.mjs`: exit 0, with existing advisory warnings/baselines. `git diff --check` both: exit 0.
- Downstream extension `pnpm.cmd exec tsc -p tsconfig.json --noEmit`: exit 0.
- Six extension test bundles in separate Node test processes: 71/71 passed. Same-process import execution exposed existing global fake-chrome pollution; separate processes removed that harness interference. One pacer assertion was correctly updated for changed cancellation wording.
- Core web restricted bearer route + program-route tests: 54/54 passed, including cancel-flow-bootstrap through the actual mocked route. Web app typecheck exit 0.
- Final Chrome, Firefox and e2e Chromium extension targets rebuilt and their 22 files each verified. Firefox's preexisting permanent-addon-ID warning remains unrelated to this change.
- Headed browser proofs passed 2/2 through e2e/cancellation/tests/cancel-build.spec.ts and cancel-run.spec.ts in owned isolated profiles. Full extension source+e2e tsconfig.test.json typecheck also exited 0.

## Accounting limitation and follow-up

A fail-first cost probe expected the ignoring mock provider's late USD usage. It failed: existing provider-retry cancellation races the outstanding request and returns before that provider supplies usage. This is an unknown in-flight charge, not zero cost. Cancellation forwards the original recognized failure diagnostic (request estimate/provider invocation information) through the abort cause; it does not fabricate settled spend. Full late-usage reconciliation belongs to P2 accounting. The creation purse still counts the request and retains reserves; cancelling does not authorize free subsequent calls. A normal respecting provider can stop promptly; an ignoring provider may remain outstanding after terminal cancellation.

## Real browser receipt

`pnpm.cmd exec playwright test -c e2e/playwright.config.ts e2e/cancellation/tests/cancel-build.spec.ts --workers=1 --reporter=list` passed 1/1 (2.5 s test body, 23.8 s total). Headed Chromium, rebuilt e2e extension, new run-scoped temporary profile, real sidepanel/chat Stop button and background HTTP relay. An actual isolated Core service was waiting inside a mock provider; Stop reached its real controller by project/Flow, cancellation rejected the build, a deliberately late mock result could not call proposal creation, and accepted Flow equality held. Exactly one mock provider invocation; zero paid provider calls. All owned server/profile/data resources were closed/removed through test cleanup.

The gateway/HTTP host were synthetic loopback transport, not the user's web panel. Activity delivery was a synthetic representation of the actual service operation. The real Next web bearer route was verified separately by 54 owning tests; this browser proof did not exercise Next login/pairing or a real provider. Chrome/Edge installation parity, Firefox live popup remain unexercised browser behaviors. Existing run cancellation is reused; owning real Core queued-run API test passes. Existing before-dispatch/tool/late-result tests cover the cooperative guarantees; effects already applied by a tool cannot be rolled back.

## Strengthened live proof progress

Supervisor requested a separate active-run proof and an explicit visible terminal build label. First strengthened run failed on two fixture defects: synthetic terminal activity omitted Core's step detail (so there was no terminal chat card); active-run fixture used legacy artifact storage rather than canonical Flow/subflow APIs. Corrected only fixtures, forwarding actual captured Core terminal label/detail and constructing the stored runnable graph through createFlow/createFlowSubflow/saveFlow/setFlowMapFallback. A subsequent fixture attempt mistakenly substituted a builtin executor (builtins bypass the native executor), timed out, and was corrected to registered native delayed/after implementations. The run executor is deterministically delayed, then returns late after actual cancelRuntimeSession; assertions require no next-node dispatch, unchanged parent and subflow graph, cancelled session, actual terminal Core label and visible chat terminal card/hidden Stop. No paid calls. Both headed cases passed 2/2 (2.6 s build, 2.4 s run, 11.9 s total), and full source+e2e TypeScript check exited 0. The exact command added both named cases to the earlier Playwright invocation. Actual Core activity terminal label/detail are forwarded by the synthetic transport; both terminal chat labels are asserted visible.

Web app package check completed exit 0. Core package check repeated after final service-test additions completed exit 0. Both reports intentionally separate request-count/unknown-cost limitations from no-promotion guarantees.
