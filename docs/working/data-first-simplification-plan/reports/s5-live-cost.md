# S5 live cost progress

Lead-owned implementation within t986. No paid call was launched. Core model-step.ts records settled provider costUsd/taskKind/phase/role before whole-attempt settlement. The new observer reads only meta.json and checks request.json existence; it never reads request/response bodies, URLs, summaries or page values.

Observer reports each attempt's known settled estimates by decisions/repairs/judge/chat/other, separately counting pending, unpriced and unreadable records. Physical call folders are unique receipts even when request IDs repeat. Completed metadata is cached, partial files retried, and a pending folder retains its attempt identity if it settles during a later attempt. Reports use fixed labels/numbers only. Tiny positive costs never display as zero. This is diagnostic reported accounting, not a replacement for Core's charged purse or the campaign spending ledger.

S5 forwarding was handed off by p0_judge in run-attempt-command.ts. Only live mode creates the reporter; existing progress polling logs changed estimates, each ending flushes the last call before advancing, and teardown flushes late settlement. Scripted/recorded provider-free stand-ins do not emit real-dollar claims. The existing progress marker, budget authority, stopping rules and oracle are unchanged.

Five owning temporary-file tests cover pending/late settlement, duplicate logical request IDs, failed paid replies, unknown prices, raw-body non-reading, safe output labels, malformed retry, absent source, final/duplicate ending flush, zero settled calls and immutable metadata caching. Source is prepared; tests/types/build/audit have not run yet because the shared memory gate is waiting for physical headroom. No validation or live behavior is claimed.

Changed: packages/test-runner/src/attempt-lane/live/cost-progress/**, minimal run-attempt-command.ts forwarding, this report. Root and worker coordinate whole-tree freeze before t986 checks. Remaining: actual owner tests, types/build/audit, lead combined acceptance and observed paid reporting only during the approved later round.
