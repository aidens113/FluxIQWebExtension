# Activity feed recovery implementation

Status: Complete - exact two source/test paths frozen
Owner: recording_controls worker
Date: 2026-10-01

## Brief

Read parent Current State and released Activity feed recovery worker brief. Exact source/test ownership: panel/chat/feed/activity-feed.ts and its existing tests/activity-feed.test.ts only. Report progressively here. Preserve direct calls before start, synchronous overlay lock, API/messages and unsupported semantics. No additional source or shared-document edits.

Reproduce read ordering, stop/restart completion and overlay reply after newer push with deferred synthetic fixtures before changing source. Implement narrowly, run owning tests and actual-config scoped types through heavy.sh, freeze and report exact evidence/limitations. No commits, broad gates, live/browser/provider/panel operations or actual activity data.

## Progress

Awaiting worker inspection.

Original source reproduction label `codex t224 activity feed reproduce` observed native1: original9 passed and new3 failed,168.4935ms. Confirmed older read overwrites newer read, stopped listener/completion overwrites restarted state, and overlay reply replaces newer pushed state. No shared fixture changes. First fix label `codex t224 activity feed first fix` native0,12/12pass,181.7355ms.

Implementation separates lifecycle, read request generation and observed-state revision. Subscriptions capture lifecycle; stop invalidates callbacks/results, releases obsolete overlay presentation lock without cancellation claims. Fresh direct requests remain legal without start; unsupported status remains terminal for feed lifetime. Overlay acknowledgements only publish state if no newer observation; operation-owned finally releases only its current lock. Defensive read/overlay rejections use fixed messages and retain confirmed state. API/messages unchanged. Expanded deferred tests now pending.

Expanded deferred run native0,23/23pass,207.9842ms. Additional reentrant stop reproduced native1,23pass/1fail,157.6208ms: onChange could stop feed before request dispatch, but the unissued overlay mutation was still sent. Added immediate current-operation recheck after pending notification; corrected run24/24pass,201.621ms. This only prevents requests not yet issued; already-issued writes are not cancelled.

Initial strict scope found one TS2367 diagnostic from control-flow narrowing of reach across an await despite asynchronous read/push mutations. Replaced the post-await inline comparison with a current supported predicate, retaining terminal semantics without casts or config/assertion relaxation. Added pending-overlay/unsupported-read regression. Final focused label `codex t224 activity feed final supported coverage` observed native0: **25tests/25pass/0fail/0skipped/0cancelled,254.9885ms**, including all original9 tests unchanged.

Final strict scoped label `codex t224 activity feed corrected scoped types` native0: **2 owned source/test roots,0 owned/global diagnostics,0 unowned dependency diagnostics**. External TEMP harness reads actual extension tsconfig and package cwd; no repo compiler/build/config edits. Owned git diff --check native0. Source/tests frozen.

Coverage includes latest-read ordering, push/read/overlay observation ordering, stop/restart old subscriptions and request results, direct requests before start and after stop, operation-specific saving release, synchronous duplicate suppression, transport rejection fixed retry messages, retaining confirmed state, unsupported feed lifetime and pending unsupported completion. No shared fixture/helper, caller, protocol, Core, storage, redaction, stylesheet or shared-doc edits. Only exact source/test paths and this own report changed. No broad gates, live/browser/provider/panel operations, commits or pushes. Supervisor reviews and independently verifies.
