# activity-join report

## Outcome
Partial. Code and tests are written; none of the checks has run, because the heavy-slot queue never reached this job.

## What changed and why
All paths are under C:/Users/osrs_/FluxStuff/fxwork/t928/!FluxIQ/apps/web/src/app/api/security/server/.

- `shape-activity-entry.ts`
  - Takes an optional third argument, the outcome row's `IamAuditOutcome`.
  - Adds `result: "succeeded" | "failed"` and, on failure only, `errorKind`.
  - Still builds the entry from the allow-list, so no request id leaves the server.
  - Exports `JoinedActivityEntry = ActivityEntry & { result?, errorKind? }`. The shared `ActivityEntry` type lives in features/security/activity/model/types.ts, which is t925's, so I did not touch it. t925 should fold these two optional fields into it.
- `audit-read/assemble.ts`
  - An outcome row (`record.outcome` set) is held in a map keyed by [requestId, action] and is never emitted on its own.
  - A decision row takes its outcome from that map.
  - Newest-first order puts an outcome before its decision row, so the map is filled by the time the decision is read.
  - A page that would end at 50 entries, or at the 2000-record scan limit, does not stop while any outcome is still waiting for its decision row. It reads on, bounded by `PAIR_GRACE` = 200 further records.
  - So a page boundary cannot split a pair, and a page can hold slightly more than 50 entries in that case.
  - An outcome whose decision row is never found is dropped, never sent alone.
- `tests/activity-outcome-join.test.ts` (new) covers:
  - a failed save as one failed entry with its errorKind, and a succeeded one as one succeeded entry;
  - an endpoint without an outcome row, unchanged;
  - no `requestId` text anywhere in the answer;
  - join by requestId and action, not by adjacency;
  - a pair that would straddle a full page;
  - an orphan outcome that is not sent.

## Commands run and observed results
- `node heavy-slot.mjs run activity-join -- npx vitest run src/app/api/security` (from apps/web) never started.
  - Its log only ever said "waiting (place 8 in line): hc2bb-worker, t905-af; 0.7 GB free".
  - After more than two hours, `heavy-slot.mjs status` showed the same two holders, with start times unchanged, and activity-join at the back of a 7-deep queue.
  - I stopped a duplicate copy I had queued by mistake. The original copy was still queued when I stopped.
- `pnpm --filter @fluxiq/web check` and the Core structure audit: not run, same reason.

## Not verified
- Everything: the new tests, the existing tests in src/app/api/security, the typecheck and the structure audit have not run.
- Possible typecheck issue: the new tests read `result` and `errorKind` through casts because `ActivityEntry` does not declare them yet. That should be fine, but it has not been checked.

## Open questions or contradictions
- Behaviour to confirm: an outcome whose decision row is more than 200 records past a full page is dropped, so that decision then reads without a result. This is rare.
- The record shape needs no change in packages/**.
- The heavy-slot holders (hc2bb-worker and t905-af) look stale or long-held. I did not bypass the gate.
- To finish: run `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run activity-join -- npx vitest run src/app/api/security` from apps/web once a slot frees. Then run `pnpm --filter @fluxiq/web check` and the structure audit.
