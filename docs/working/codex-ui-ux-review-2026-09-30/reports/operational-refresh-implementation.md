# Operational refresh foundation and Compute

Status: Corrections implemented;19 focused tests and corrected scoped typing pass. Product/test source and report refrozen for supervisor verification.

Own new programs/operational-refresh/{useOperationalSnapshot.ts,OperationalFreshness.tsx,index.ts,tests/useOperationalSnapshot.test.tsx}, Compute view/new freshness test and existing selection harness only. No Background/Production/backend/runtime/contracts/styles changes. No broad/live/provider/panel calls or commits.

Stable intended hook contract: owner identity + stable typed read(signal) + unknown payload validator + optional local clock cadence; returns retained validated data, safe error/loading/paused/stale/lastSuccessAt/nowMs and coalesced refresh.10s after completion visible cadence,20/40/60s failure backoff,403 auto stop, hidden read abort/timer pause, one immediate resume/manual recovery and old-owner request/render/callback fences. Compute preserves heartbeat thresholds and visible selection, labels sampled estimates while stale/paused.

## Implemented seam

Directory barrel exports `useOperationalSnapshot` and `OperationalFreshness`. The hook infers its payload type from `read(signal): Promise<ApiResponse<T>>` and `validate(value: unknown): value is T`; owner is an identity object, optional clockMs controls estimate-clock cadence. Results expose data, loading, fixed safe error, paused, lastSuccessAt, nowMs, stale and coalesced refresh. Stable callbacks/owner references are required. ProgramApi continues to own authentication and HTTP coordination. The hook does not subscribe globally or issue mutations.

The visible read starts at mount, repeats ten seconds after completion, and backs off20/40/60 seconds following failure. Hidden state aborts its read and stops read/clock timers; resume starts one read unless permission denied.403 stops automatic retries, including visibility resume; manual refresh can recover after permission restoration. Previously confirmed data remains on failed/invalid responses; error strings never use server content. Owner/read changes mask prior data during render and fence old requests/captured refresh handlers. Cleanup aborts and clears timers.

Compute uses the hook for its existing snapshot endpoint with the existing API abort seam, validates the three snapshot arrays, and keeps its120/300-second health thresholds unchanged. Shared feedback identifies sampled ages, last successful load, loading, hidden pause, error, stale state and recovery. Existing visible-selection logic/activity remain. Only the existing selection-test timer/document harness changed.

## Validation ledger

- Initial focused run: native1,14pass/1fail. My heartbeat assertion incorrectly counted the toolbar's Offline option. Second run: native1,14pass/1fail, because the status badge has nested formatted text. Both failures were synthetic-test targeting errors; product code was unchanged. Final assertion inspects the two actual rendered badges' healthy status titles.
- Final focused `codex t224 operational refresh final16` through explicit Git Bash/heavy.sh: native0,4files/16tests,7.39s. New hook6, new Compute freshness4, preserved Compute selection4, existing pure/source Compute2. No skips. Covers completion cadence/coalescing, hidden abort/clock/resume, stale aborted response,20/40/60backoff,403manual recovery, malformed/synchronous failure recovery, owner/reader/unmount callback fences, heartbeat renewal beyond300seconds, retained sampled state/retry, hidden Compute pause, and filtered selection/activity retention followed by confirmed removal.
- Initial scoped strict TypeScript: native0, session26508. Temporary tsconfig extends unchanged web config, disables incremental output, includes exact owned entry/tests plus Next ambient declarations; transitive imports are checked. Final scoped rerun session43565 also native0 after last test correction/addition. Temporary config: `%TEMP%/codex-t224-operational-refresh-tsconfig.json`. Scoped diff whitespace check native0.
- Full checks/build/structure and live behavior were not run by this worker. Supervisor owns broader gates. Existing protected service baseline failure is outside scope. React test renderer emitted its existing deprecation warning; no failing runtime warnings.

## Resume/integration

Read-only CSS inspection after checks found `.compute-control-shell` is a grid with a full-width toolbar then three panels. Inserting feedback as its first direct child would change auto-placement. Supervisor released the correction: feedback now precedes the unchanged grid section in a fragment. No styles edits. This layout was not live tested.

Supervisor also identified the first read's microtask window: a hide/unmount before the initial yield resumed could call the API with an already aborted signal. Added active/generation/abort check before read. The captured refresh additionally checks current render owner/read, preventing an old handler from entering the old runtime before passive cleanup. Three new regressions cover synchronous hide, synchronous unmount and replacement layout-effect invocation before passive cleanup. The latter asserts old timers are not disturbed, in addition to no old API request.

Corrected focused runs: session10473 native0,4files/19tests,9.00s; final stronger timer-identity regression run `codex t224 operational refresh frozen19` native0,4files/19tests,7.39s. Final corrected scoped typing55934 native0. Source refrozen; no other owned paths expanded.

Supervisor independently review the seven frozen paths and focused tests. Background Tasks/Production adapters remain future bounded work; no source changes there. No commits or shared-document edits by this worker.
