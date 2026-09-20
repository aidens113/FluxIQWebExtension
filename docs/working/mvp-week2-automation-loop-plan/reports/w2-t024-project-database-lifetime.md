# Report: w2-t024-project-database-lifetime

## Outcome

The database-pool lifetime hypothesis was falsified. Live operation tracing showed every queued SQLite operation settling, and the final run-detail save returned. The post-playback request instead stalled while resolving a verification provider for an action-only run whose extractor had created one empty dataset shell.

Core now classifies results from stored/refused row counts rather than dataset-shell count. A summary with zero stored rows is routed to the deterministic verifier before instructions or provider resolution. The verifier records `no_result` for zero stored and zero refused rows, while an all-refused result still reaches Core's existing `every_record_refused` observation. This is the smallest change that avoids an unnecessary provider resolution without weakening the all-refused failure.

The final live run passed and returned normally. Its persisted sanitized Flow snapshot records `resultVerification: "no_result"`.

## What changed and why

Core changes in the paired `t024` worktree:

- `runtime/result-verification/run-outcome.ts`: changed the provider-free gate from `recordSetCount === 0` to `totalRecordCount === 0`. Empty shells and all-refused datasets therefore reach deterministic verification before any provider lookup.
- `runtime/result-verification/verify.ts`: changed `nothingToJudge` from dataset presence to the absence of both stored and refused rows. Empty shells become `no_result`; refused rows remain eligible for Core's deterministic failure observation.

The experimental pool-retention change and all temporary database/runtime stage tracing were removed. `storage/project/database.ts` and `runtime/service.ts` have no content diff.

## Live-first validation

Only `social-scheduler-schedule-post` was run, with target `isolated`, instance `t024`, environment files disabled, and new run directories. No credentials, recorded page values, or browser state were inspected or emitted.

- `F:\r24`: playback succeeded, but the outer request timed out after the full readback window. This reproduced the original symptom.
- `F:\r24b`: temporary database lifecycle tracing showed no outstanding operation and no slow close capable of explaining the stall. This falsified the pool-lifetime hypothesis.
- `F:\r24c` and `F:\r24f`: temporary stage markers narrowed the unresolved await to result-verification provider resolution, after the final run-detail save and dataset read had returned. The live project contained one dataset shell with zero stored and zero refused rows.
- `F:\r24g` and `F:\r24e`: provider/runtime failures occurred before the target verification boundary and were treated as live-provider noise, not code evidence.
- `F:\r24i`, run `run-muab3b80-96e9ec3b`: a forced-new isolated build proved current bundle provenance, but playback failed at action 9 (`web.dom.wait_for_selector`) with `web.action.timeout`; no verification marker was reached.
- `F:\r24j`, run `run-muab7mp7-72cb20ba`: playback reached verification on the confirmed-current bundle and reproduced provider resolution. This exposed the earlier `recordSetCount === 0` gate in `run-outcome.ts`; the corrected predicate in `verify.ts` could not run until this gate was also fixed.
- `F:\r24k`, run `run-muabdpmu-6c1f639d`: passed in 160,663 ms with 9 successful actions, 3 Flow-creation provider calls, zero recovery activations, and a normal `/run-runtime-session` return. Stage evidence showed one dataset summary followed directly by deterministic verification, runtime-session persistence, and run-detail persistence, with no instruction read or provider-resolution stage. The finalized sanitized snapshot records `resultVerification: "no_result"`.

### Bundle provenance note

The isolated facility serves an immutable published Core web build, not Core's checkout-local `apps/web/.next`. A checkout build alone therefore does not prove which artifact an already-running isolated server serves. The final iterations used a fresh cache root (`F:\c24`), confirmed the generated artifact contained both new predicates and no old predicate, and observed the server launched from that artifact. The fresh-bundle reproduction also proved that bundle staleness was not the semantic root cause; the pre-provider gate was.

## Narrow validation after live success

- `pnpm --filter fluxiq build` — passed after all temporary tracing was removed. This is the owning package's narrow TypeScript build/type check.
- `git diff --check` — passed in both paired worktrees.
- No unit test or full suite was run, per the live-first brief.

## Not verified

- An all-refused live scenario was not run. Its behavior is preserved structurally: zero stored rows take the provider-free branch, `nothingToJudge` declines to skip when `totalRefusedCount > 0`, and the existing Core observation returns `every_record_refused`.
- No other scenario or browser matrix was exercised.

