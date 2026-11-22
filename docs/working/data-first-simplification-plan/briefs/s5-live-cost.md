# S5 live settled-call cost observation
Owner: lead, within existing t986 Lab work unit; p0_judge owns the other t986 paths.
Owned: packages/test-runner/src/attempt-lane/live/cost-progress/** and owning tests; run-attempt-command.ts integration only after p0_judge hands off its frozen hunk.
Source: Core runtime/llm/step-log/model-step.ts writes completed model meta.json with costUsd/taskKind/phase/role before whole-attempt settlement. Read metadata only, never request/response bodies or page data.
Show per-attempt decision/repair/judge/chat/other settled-call estimates while followAttempt runs, and flush at attempt end. Canonical purse/paid ledger remains budget authority; do not reprice tokens or change limits.
Unknown/in-flight/malformed/missing costs never become zero. Count each physical settled call once; repeated request IDs may be separate paid attempts. Preserve late settlement's original attempt attribution across later attempts.
Cache immutable completed metadata, retry incomplete files; do not reread all historical payloads every poll. No arbitrary cap, source mutation, new provider request, test-oracle change or new terminal failure.
Only live paid mode emits dollar reporting; scripted/recorded provider-free stand-ins are not real spend.
Acceptance: synthetic temp folders test pending->settled, unknown cost, failed paid reply, same request ID distinct calls, late settlement, malformed/retry, unavailable source, safe labels and no raw-body read. Test actual integration flush and no double count.
Use shared heavy gate, owning tests/types/audit only; root and worker coordinate complete t986 downstream source freeze before validation.
Keep implementation/checks in reports/s5-live-cost.md; no paid launch until whole-plan prerequisites.
