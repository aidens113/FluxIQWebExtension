# A separate zero-provider replays - 2026-10-11

Status: Complete; both separate zero-provider replays passed. Supervisor gate sign-off owed.
Owner: a-review worker, t342 slot 2.

## Current State

Both original accepted saved Flows separately replayed and passed on October 11 at approximately 18:31-18:34 Los Angeles. Source frozen at downstream 676614063c345c841c6f03a0e5c5ef1570b8b66b / Core 01621c946b34075a1d39f23cae5bf9b88f79b2e0. Neither source synced nor rebuilt from newer dev. Slot owner t342/A; no old slot process alive at intake; provider credential variables present 0. Every build reused in both preludes, rebuilt=[]; only owning generated host-copy occurred. Model providers disabled by replay owning topology; headed Chromium; original persisted workspace preserved. Both commands exited 0 and all owned lane processes/browser children ended normally. The two creation passes plus separate replay receipts now establish the requested creation/reuse gate evidence; supervisor independently verifies/signs off qualification.

## Evidence

First receipt: `test-runs/instances/t342-slot-2/replays/replay-mv4kt6g0-4e4900a8.json`.
Project `47ddc767-86f4-43c6-a335-a5dcb127527f`, Flow `flow.aa244ab2-77f1-4ddd-be15-318f679991c8`.
Saved hash before/after equals creation hash `aa84282af4d39760d1f823401627d49516c7dab3fed34c629d21c50c62d4efaa`.
Runtime succeeded; task playbackGoalHeld true; zero Core/accounted/provider/intervention/harness counts; modelProvidersEnabled false, runIntent null, gate invoked false. Stored key counts 1 before/after, preservation true. ResultVerification unverified is expected because replay disabled model checking; independent oracle is the acceptance evidence. Busy coupon press failed and then succeeded deterministically.

## Environment and scope

PowerShell invocation uses pnpm.cmd, FLUXIQ_LAB_INSTANCE=t342-slot-2, FLUXIQ_TEST_ENV_FILES=none, FLUXIQ_LAB_CORE_BRANCH=task/t342-lane-a-baseline (measure against frozen original branch rather than newer dev). Original command templates and expected IDs/hashes are in a-review.md. No user panel management, source edits, commits, pushes, model calls, or destructive resets.

## Second receipt and direct validation

Second receipt: `test-runs/instances/t342-slot-2/replays/replay-mv4kv3z1-2cfab70c.json`.
Project `ec76c3ee-3459-40ac-be84-c1a35e76302e`, Flow `flow.f5066fb1-61ce-42a7-b409-dcd2f025b0fd`.
Saved hash before/after equals creation hash `6005b989656b7f1eb70b6e86ba465624f762c8f24dac19a51d4b0b10cbb06d4f`.
Runtime succeeded; task playbackGoalHeld true; zero Core/accounted/provider/intervention/harness counts; modelProvidersEnabled false, runIntent null, gate invoked false. Stored key counts 1 before/after, preservation true. ResultVerification unverified is expected because replay disabled model checking. Busy coupon press failed then succeeded on deterministic retry, and final cart act succeeded.

Both receipts independently asserted exact workspace/project/Flow IDs, expected before/after saved hashes, passed verdict, empty reasons, successful runtime, no error, held independent task goal, servedAtSavedAddress true, credential-variable list empty, all five measured provider/intervention/harness counts zero, model wiring false, no adaptive runIntent, provider gate not invoked and keys preserved. This inspects the receipt fields rather than trusting top-level passed verdict. Both retained fixture origin http://127.0.0.1:61582 matches their saved navigation origin. No new running-identity snapshot is emitted by this replay result format; prelude matching input/output stamps, unchanged frozen source commits and historical four identity receipts support the same pair. A-review.md retains exact original digests.

Commands observed:

```powershell
$env:FLUXIQ_LAB_INSTANCE = 't342-slot-2'
$env:FLUXIQ_TEST_ENV_FILES = 'none'
$env:FLUXIQ_LAB_CORE_BRANCH = 'task/t342-lane-a-baseline'
pnpm.cmd lab replay crossborder-marketplace --workspace t342-a --project 47ddc767-86f4-43c6-a335-a5dcb127527f --flow flow.aa244ab2-77f1-4ddd-be15-318f679991c8 --instruction-task crossborder-marketplace-hub-to-cart
pnpm.cmd lab replay crossborder-marketplace --workspace t342-a --project ec76c3ee-3459-40ac-be84-c1a35e76302e --flow flow.f5066fb1-61ce-42a7-b409-dcd2f025b0fd --instruction-task crossborder-marketplace-hub-to-cart
```

## Remaining findings and limits

A-review's creation consequence-classification inconsistency and unspecific Clear the page recovery remain unresolved; these replays establish deterministic unchanged reuse, not policy correctness or persisted repair handlers. The replay checker exposes playbackGoalHeld rather than a per-fact oracle table; original creation bundles establish all four exact task facts. Browser was headed and owned processes were monitored; no new screenshot-based UI review performed. No paid/provider call, source/Core/shared-document edit, merge/commit/push, user panel management, new source rebuild, profile reset or stored-Flow rewrite. Persistent data remains for later inspection; only owning Lab runtime evidence written.
