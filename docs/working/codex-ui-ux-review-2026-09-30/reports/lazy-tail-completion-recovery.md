# Lazy-tail completion observation recovery

Status: Complete - two paths frozen; supervisor verification pending
Owner: recording_controls
Date: 2026-10-01

## Written brief and accepted contract

- Root reviewed actual NEW clock harness/report and independently reproduced eight cases native0/338.551ms (root73682 CLOSED). Actual due loader600 remains pending when old poll50 at950 settles complete12; absolute901 deadline also incorrectly settles complete at950. This proves source behavior; exact full-run causal trace remains unverified.
- Root accepts local negative-growth completion policy: before declaring no growth, give one queued timer task an observation boundary, then reread actual count and absolute command deadline. Do NOT grant another900ms growth window or wait indefinitely for arbitrary loaders. Never extend an elapsed command deadline;500 deadline stays timed_out. Keep waitUntil and unrelated pagination behavior unchanged.
- Exact two paths NOW RELEASED: apps/extension/src/content/extraction/list-wait.ts and already NEW content/extraction/tests/list-wait-ordering.test.ts. Own this report additionally. Shared store-pager/original lazytail/page-render/reader/config/other worker paths frozen.
- Add failing regressions first to existing NEW local clock harness: older-poll-first950 must not settle complete12 before queued observation; due loader then observation yields genuine16,901 deadline at950 returns timed_out, fresh deadline reached during queued boundary returns timed_out, genuine no-growth completes after one task without another window. Preserve existing eight characterization/integrity assertions; add actual no-loader storePage variant locally when needed, no fixture mutation.
- Minimal awaitListComplete-only change around negative growth: current expired deadline is timed_out; one queued-task observation; fresh deadline and actual match count decide completion/continuation. Preserve600 fixture/50poll/900growth/fourreveals/30000/500/low-demand/no-scroll bounds. No arbitrary fixed longer delay or copied wait implementation.
- Run heavy updated owning probe +UNCHANGED list-reader-lazy-tail.test.ts and relevant list-wait/list-reader tests discovered by exact names; no unrelated full run. Actual-config exact two-root strict including all dependencies and whitespace/budgets. No assertion/timeout/compiler/baseline/harness weakening; report precise schedules and limits.
- Record failing regressions and actual fix results progressively, freeze for root review. No full-run causal proof from synthetic probe, machine attribution, browser certification or count-summary fabrication. No shared docs/commits/broad/live/browser/Lab/providers/panel/private actions.

## Tests-first checkpoint

Four durable regressions appended to the existing NEW probe: due-tail observation, elapsed901 deadline, deadline reached during queued boundary with positive growth, genuine no-loader local store variant. Original8 cases/helpers/assertion call texts are saved externally before additions. Local no-loader variant only removes its synthetic sentinel before reveal; original store fixture and all existing product paths remain unchanged.

## Observed original failure and minimal fix

Baseline updated probe: native1,8/12 passed,4 durable regressions failed,562.9539ms. Existing8 characterization/integrity cases passed untouched. Original subject settled before queued observation, called an elapsed901 deadline complete, lost the during-boundary deadline opportunity, and completed genuine no-loader without the accepted task boundary. Only the owning unchanged-growth branch now checks current absolute deadline, awaits one0ms queued observation, checks fresh deadline and actual match count. waitUntil/constants/shared fixture/original tests remain unchanged.

## Owning pass; scoped typing pending

Expanded four-suite owning gate CLOSED: native0,48/48 passed,42130.2133ms (updated12 ordering cases, unchanged6 lazy-tail cases, unchanged list-reader and page-render suites). Original32 helper/eight-case assertion call texts compare unchanged to saved TypeScript AST snapshot;26 new assertion calls cover four durable regressions. git diff --check passed; product diff exactly7 inserted/1 replaced lines in awaitListComplete unchanged-growth branch; shared store-pager/original lazy-tail/page-render unchanged. Scoped actual-config2-root run session81464 remains queued for heavy slot with no output. Source/test have not changed after owning pass; source freeze awaits this type closure. No broad/source expansion/live/commit.

## Final frozen evidence

Exact released two paths are FROZEN: content/extraction/list-wait.ts and content/extraction/tests/list-wait-ordering.test.ts. Only this report was additionally updated. Actual-config strict two-root check CLOSED native0: zero owned/global diagnostics and zero dependency diagnostics. External harnesses are TEMP/codex-t224-lazy-tail-recovery-focused.mjs and codex-t224-lazy-tail-recovery-scoped-types.mjs. Worker owning gate remains48/48 native0,42130.2133ms; no source/test changed after that passing run.

Durable behavior proven by actual subject/fixture: overdue older negative poll at950 leaves completion pending until one0ms observation; due real loader then task observes16 and completes at950. Absolute901 already elapsed at950 returns timed_out with no queued extension. A deadline925 reached while boundary is pending returns timed_out even after genuine16-card growth arrived. A genuine local no-loader page observes900ms unchanged growth, queues exactly ONE task, then completes12 at the SAME fake900 time without another growth window. Standard600ms success,500ms cutoff, low-demand no-scroll and original four related suites remain passing. Existing32 probe/helper assertion texts stay unchanged;26 appended assertions cover these four regressions.

Implementation scope is seven inserted lines replacing the one immediate unchanged return. Fresh absolute deadline checks occur ONLY on this local negative-growth path; existing waitUntil semantics and unrelated global deadline behavior were not changed or claimed repaired. The one0ms task grants an observation turn, not another900ms budget or an indefinite wait for arbitrary future loaders. Actual elapsed queued-task delivery still respects the fresh deadline checks. Growth window900, poll50, genuine fixture600, four reveals, original30000 and500 bounds remain unchanged.

Limits: the controlled regression proves the local completion behavior and accepted recovery policy, not the exact callback trace that caused the prior full4.408s/page2 failure. Full gate recovery and native browser behavior require independent root checks; no machine cause, browser certification, binding causality, global deadline repair, across-page count-summary invention or broader source change is claimed. Root owns further review, broad validation, authored shared docs and commits. No shared fixture/original test/barrel/config/baseline/other worker/Core/live/private/provider/full-gate source or operation was touched.
