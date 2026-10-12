# Extension worker observation-gap recovery
Status: Complete
Status detail: Recovery/source-order checks and injected actual-browser proof pass; supervisor sync/index regeneration/final audit remain separate.
Created: 2026-10-11
Last updated: 2026-10-11
Owner: worker-start-recovery worker
Scope: t455 downstream browser-session recovery, narrow wiring/tests, provider-free injected proof.

## Current State
Supervisor observed 16 natural provider-free starts (initial 4 plus ordered 12) using the actual extension and allowed everything-store fixture, fresh/copied isolated profiles, diagnostic tracing on/off. All passed: the original intermittent startup split is NOT naturally reproduced. Ordered results confirm persistent contexts have no browser() handle even when live, so browserConnected=false alone cannot prohibit recovery.

Original C run-mv4p3qri-4c59c2ff had Chrome worker target/listening evidence, no crash, zero Playwright observed workers at its unchanged 30-second readiness timeout and zero provider calls. Target-only acceptance was reverted before integration because network canary containment requires a Playwright-attached worker. The transferred prototype will instead normal-close the owned browser once only on the proved observation gap, relaunch the same isolated profile, then require fresh original strict worker readiness, awaited worker canary proof and every subsequent identity/pairing gate.

## Owned paths
- browser-session/launch-extension-session.ts, chrome-worker-target.ts and owning tests/barrel.
- run-scenario.ts narrow callback wiring preserving capture/trace/console/guard ownership.
- Approved affected tests: guarded-browser/tests/launch-containment.test.ts, run-evaluation/tests/runner-wiring.test.ts and browser-session core/host/server-adapter identity tests.
- Existing extension-control-page/readiness/guard source remains unchanged; Core shared 3291fb25 read-only; no scenario/default/model/profile changes.

## Work Ledger
### 2026-10-11 - Intake and fail-first
- Read main authoritative brief/current state, transferred prototypes, original lifecycle/guard/launch/source-order owners, natural probe and original C full debug/screened trace.
- Added owning helper tests for one bounded relaunch, missing timeout evidence, missing/ambiguous target, repeated failure, abandoned containment violations and awaited fresh proof. Build is running before source correction to record fail-first outcomes.
- No provider calls, source integration, commits, merges, old profile changes or full suites.

## Intermediate receipts
- Initial actual owning build passed, 48.944 seconds; new helper tests failed first (3 failed, 3 passed), proving missing timeout validation and discarded first-owner containment checks.
- Corrected helper now awaits already-started first-owner proofs and asserts violations before any retry, per supervisor review; it awaits/asserts fresh owner proof before return. Positive original timeout/timing fields remain required.
- Current source-order run initially passed 96 of 97 checks; the remaining stopped-lane literal assertion failed because Windows text writing translated the spine's LF into CRLF. Restored LF without changing that lane logic.
- First audit found prototype discovery swallowed failures, new test never casts/statement packing, spine growth above 800 and shared index staleness. Discovery now fails closed with typed diagnostics; typed test options replace never casts and packed lines are split.
- Supervisor approved exact session-observers.ts and owning tests to own one capture/watch registration and console disposal/rebinding. Startup callbacks extracted; spine is 800 lines, terminal context/guard still adopted before readiness and available for outer failure evidence/cleanup. Control trace observation now lives in the startup owner, and successful session exposes the same-origin predicate used by later recording/press checks.
- Owning extension build passed for isolated t455-worker-start; actual scenario-lab build reused matching stamp. Existing extension-control-page/readiness source remains unchanged. Current test-runner owner build is running.
- Ignored injected proof script: test-runs/worker-start-recovery/probe.mjs. It uses the actual stamped extension, allowed everything-store fixture and a new owned profile; it suppresses only the first readiness observer while real Chrome/guard stay attached, waits original timeout, then checks one restart/fresh readiness/proofs/running extension identity and denied worker traffic. Not yet run; natural reproduction remains false.

- Corrected current build passed (28.796 s), 99 focused tests passed and actual uncached test-runner typecheck passed. Code structure violations cleared; direct audit now fails only the shared working README pending supervisor regeneration.
- First injected actual-browser recovery reached fresh control/worker containment proofs and verified actual running extension identity, then its negative traffic assertion failed. Root cause was test instrumentation: the existing guard probes an unknown loopback origin through driver-owned /__control/health before denying it, and the spy counted that health request as ordinary worker traffic. Probe now counts those paths separately, records no headers/content, and will run a new isolated profile. No product/guard change is justified by this assertion. First probe/log/profile retained; no natural reproduction claim.

## Injected actual-browser proof and final worker receipts
- Corrected path-accounting probe passed, exit 0. Exactly two browser launches on one NEW owned profile; first context normal-closed; only the first strict readiness observer was suppressed; original 30-second timeout completed, Chrome discovery found the actual target, then second ordinary strict control start and awaited worker containment proofs succeeded. This is an injected observation split, NOT natural reproduction of the intermittent race.
- Actual running extension receipt verified true; background/content each exactly match the intended current owner stamp. Current intended Core source/artifact/reached-input validation also passed before launch. No Core host/chat/provider run was started in this isolated proof; model wiring disabled, zero provider calls. No saved-Flow/live semantic qualification claimed.
- Ordinary forbidden worker fetch rejected; its actual resource received 0 requests, other resource requests 0, and the guard recorded/refused that traffic (assertNoViolations rejects as expected AFTER the recovered guarded session was returned). Driver-owned origin attestation /__control/health received exactly 1 request, expected by the existing dynamic Scenario Lab origin-proof contract. No headers/bodies/controller values logged. Neither canary nor ordinary-traffic guard was relaxed.
- Successful evidence directory: C:/Users/osrs_/FluxStuff/fxwork/t455-worker-start-observation/test-runs/worker-start-recovery/1791778474025/. Contains result.json, running-build-identity.json and the isolated browser-profile; log is ../probe-path-counts.log. First assertion-failed instrumentation probe/profile remains at ../1791778355798/ and ../probe.log. Original natural-start probe/probe.log/probe-ordered.log/results.json remains under test-runs/worker-start-observation, untouched.
- Final observed code gates: current owning test-runner build 28.796 seconds, 1,964 outputs; 99 affected tests passed, actual uncached test-runner typecheck exit 0, git diff --check exit 0. Last direct structure audit has no code violations and one shared working README mismatch; supervisor will sync/regenerate and run final audit. One existing baseline entry can lower after extraction.
- Only approved downstream sources/tests and own report changed; shared Core source/defaults, existing extension-control-page/readiness, scenarios/oracles/instructions, old profiles and .env untouched. No commits/merges/pushes/full suites/paid calls. All worker build/type/test/probe/audit commands are idle; supervisor may sync/review now.

## Supervisor acceptance
- Synced downstream dev b16ad470 after worker commands stopped. Rebuilt owning runner and passed uncached typecheck; supervisor selected 36 lifecycle/containment/wiring tests passed.
- Independently reran injected actual-browser proof on fresh isolated profile 1791779636817: two launches, normal first close, fresh strict worker/guard readiness, actual extension identity verified, forbidden endpoint requests0, expected driver health attestation1, provider calls0. Natural intermittent race remains unreproduced.
- Authored testing-facility recovery contract updated. Owning structure baseline regenerated: run-scenario import count31 to28 only; no budget increase. Final structure/whitespace and task integration gate recorded by supervisor.
