# Background and Production refresh adapter audit

Status: Read-only discovery complete and frozen for supervisor scoping. Exact brief/Current State, frozen operational-refresh report, current shared hook, two named view sources and directly owning tests read. Own report only; product/test sources remain frozen for supervisor gates. No heavy/live/provider/panel calls, shared-doc edits or commits.

Confirmed: Background snapshot/countdown still mount/manual only; its page request has no cleanup/owner fence and preserves old selectedRun objects by id. Production has mounted/latest-read guards and immediate launch/per-run locks, but captured handlers and post completions are not API-owner guarded. Existing Production overlapping-manual-read regression conflicts with shared coalescing contract and needs an explicit behavioral update, not a silent harness-only change. Exact proposal and race regressions follow.

## Current-source evidence

| Source | Observed behavior | Adapter requirement |
| --- | --- | --- |
| background-tasks.tsx:17,31-36 | Snapshot stored as ApiResponse; mount/manual reads; local one-second interval advances time. | Shared snapshot hook, stable API owner/read/validator and clockMs1000. Retain successful payload and show snapshot confirmation/stale/paused feedback. Preserve pure countdown/progress math and sampled-estimate wording. |
| background-tasks.tsx:38-53,70-71 | Visible task reconciliation already exists; explicit task selection invalidates requestRef and clears run/detail/page/filter; automatic visible fallback clears detail/offset in passive effect. | Preserve visible selection/filter behavior, but derive history/detail ownership from visible task during render. A prior task's page/detail must never appear under a newly selected task heading before effects. |
| background-tasks.tsx:56-68 | Detail POST limit50 uses task/status/offset; latest-started integer fences completion only; no abort/cleanup or rejection handling. Filter/page changes invalidate only after next effect. Failed response clears rows and uses raw response error in status. | Separate read-only page owner `{api,taskId,status,offset}`, abortable bounded detail read, render/request/captured-refresh guards; retain only same-query successful page on error, fixed page error and Retry. Changing query masks previous page immediately. Never poll run/set-enabled/control. |
| background-tasks.tsx:65 | Successful page retains current selectedRun object when its id exists in new rows. | Store selected id/owner or derive the selected object from the newly confirmed current page. Same-id running->succeeded must update status/timestamps/detail; missing/filtered run clears detail. Preserve current post-run successful detail deliberately if not yet represented in the page; distinguish it from confirmed history. |
| background-tasks.tsx:66 | Offset beyond total moves back exactly one page. | Confirm clamp behavior for substantial shrink: clamp to last valid50-row offset, not many sequential obsolete pages. Preserve normal forward/back controls. |
| background-tasks.tsx:74-97 | Run/enable/control callbacks post immediately, busy is React state only; no API-owner/lifecycle fences or try/finally. Old run completion selects its payload and invokes old refresh/loadRuns closures. | Guard captured handler identity/owner/current task or scheduler state before POST; fence post completion against current owner and task. Existing posted mutations are not aborted/replayed by read cleanup. Lock/release in finally if hardening included in released brief; stale completion cannot reset another owner's lock/status or show old task detail. |
| production-runner.tsx:13,30-35 | Snapshot generation+mounted guard covers reads started latest; mount/manual/own-success only. Old refresh closure can become latest again after owner change; old data is not masked during render. | Replace read lifecycle with shared hook owner=api/read/validator, clockMs10000. Hook already fences render owner, captured refresh and pre-read cancellation. Feedback stays outside explicit workspace grid. |
| production-runner.tsx:19,40-46 | Parameter draft keyed by type+id; same-target refresh preserves edits, fallback/type reset uses new defaults. | Keep same-owner same-target edits and all launch controls; API-owner change must mask previous owner's draft even if type/id match. Add owner identity to draft ownership or equivalent render guard. No parameter-schema/metadata contract changes. |
| production-runner.tsx:50,115,120 | Selected run derived from current snapshot by id; console/log-filter state remains local; newest logs capped500. | Preserve this derivation and log cap. External same-id progress/completion updates selected detail; removal clears rendered detail. Refresh must not clear console/filter/drafts or steal focus. |
| production-runner.tsx:52-94 | Launch lock and independent pendingRuns set prevent duplicate mutations; response/catch/finally check mounted only. Captured stale start/changeRun posts before any mounted check. Old-owner completion can pass mounted after new owner effect mounts; old finally can clear busy for same run id. | Add current render-owner and target/run validity guard before POST, then owner generation guard on every post-result/catch/finally side effect. Partition pending locks by owner generation; old completion cannot clear a new owner's same-id lock. Preserve lock helper behavior and independent per-run activation. |

These are source findings, not browser observations. No actual user payloads or raw logs were inspected or included.

## Exact proposed independent paths

Background adapter:

- `apps/web/src/features/programs/live-views/background-tasks.tsx`
- new `apps/web/src/features/programs/live-views/tests/background-freshness.test.tsx`

Production adapter:

- `apps/web/src/features/programs/live-views/production-runner.tsx`
- new `apps/web/src/features/programs/live-views/tests/production-freshness.test.tsx`
- `apps/web/src/features/programs/live-views/tests/production-runner-operations.test.tsx`: visibility/fake-timer harness plus one explicitly authorized refresh-contract regression rewrite, with all mutation/draft assertions preserved.

No operational-refresh changes are required for the basic adapters. Existing pure/source `background-tasks.test.ts` and `production-runner.test.ts` can remain unchanged; both source assertions still require selected-run and bounded-history/launch/log contracts. Watch structure budgets before implementation; if owner/history responsibilities need extraction, propose exact owning module/barrel/test paths before expanding ownership. Do not raise baselines or edit unrelated shared time/math/API/backend/styles.

## Bounded integration design

1. Each snapshot uses stable read callback and validator with shared hook cadence/backoff/403/visibility behavior. Initial unavailable state differs from valid empty state; background one-second/production ten-second local clock only supports estimate/staleness feedback. Put feedback before existing grid section, as corrected for Compute.
2. Background page can use a second instance of the existing generic hook with a memoized query-owner identity and stable `detail` read callback. It loads only the visible task's current50-row query; no task means no detail read. Its own completion-based10s cadence keeps history fresh without polling all tasks or resetting rows on every snapshot identity. Page validator checks runs plus paging fields. Query changes reset confirmation; same-query failures retain rows with explicit stale/Retry history feedback. Do not treat snapshot lastSuccess as history confirmation.
3. Avoid coupling an extra history refresh to every snapshot clock tick: independent selected-page cadence would otherwise combine with snapshot-triggered reads and double requests. If the supervisor specifically requires one history read after each confirmed snapshot, instead specify a single page lifecycle driven by confirmed snapshot revision with coalescing/abort/backoff/owner fences; do not implement both schedules. Tests must assert the selected policy's exact read counts.
4. Mutation success may call coalesced snapshot/page refresh. A read already pending before the write can finish after it with a pre-write payload; coalescing does not guarantee that returned promise confirms the mutation. Keep mutation success status distinct from snapshot freshness. If immediate read-after-write confirmation is required, explicitly queue one fresh read after the prior read finishes, guarded by current owner, without replaying the mutation or adding a second automatic loop. This contract decision belongs in the next written brief.
5. Snapshot failures retain confirmed data, launch drafts, operation status and selected ids. Scope changes mask old snapshot/page/detail/draft/error immediately; stale captured mutation handlers must produce no POST. Post completion guards compare operation owner/generation, not callback identity across harmless snapshot renders. Old finally cannot release a new operation's lock. No read abort should cancel a successful or pending server mutation.
6. Do not add raw payload UI/log/persistence. Existing task result/metadata render behavior is outside this freshness increment. New feedback uses fixed strings and timestamps; tests use synthetic payloads only.

## Existing test contract conflict

`production-runner-operations.test.tsx` has7 behavioral tests covering immediate launch/per-run locks, refusal/retry, transport rejection, type-specific defaults, removed-target draft reset and latest overlapping snapshot. The test named "keeps the newest snapshot when an older refresh finishes later" explicitly activates Refresh twice and expects two API reads. Shared hook intentionally coalesces them into one, so a harness-only adaptation is insufficient.

Authorize rewriting that one regression to assert two manual activations issue one pending read and one confirmed payload; retain its target/default/post assertion. New owner/late-aborted-response regression must prove stale reads cannot replace a newer owner's snapshot. Do not manufacture two automatic requests just to retain the old test or weaken duplicate mutation assertions. Existing Background tests cover pure countdown cases and source-level bounded-history/detail contracts, with no component race coverage.

## Meaningful regressions before acceptance

Background:

- Confirmed snapshot advances nextRunAt and toggles scheduler externally; countdown/progress updates from new server data, hidden clock/read pause and one resume; no automatic run/set-enabled/control POST.
- Detail calls are current visible task/status/offset only, limit50; independent selected-page cadence bounded/no overlap. Same-id selected run changes running->succeeded in detail, removed/filtered run clears. Large total shrink clamps page once to valid offset.
- Deferred page followed by task search/fallback, explicit task, status filter, offset or API change: old rows/detail never appear under new controls during render or after resolution. Abort/unmount, hidden cancellation before microtask, captured old Retry/page-selection handlers do not read/publish into a new query.
- Same-query failure retains stale rows/selected detail with fixed Retry history feedback; malformed/rejected response recovers. Snapshot and history confirmation/failure are distinct.
- Deferred run mutation followed by another task/owner: old completion cannot select old payload, issue old query refresh or clear current busy/error. Captured old Run Now/Run Again/Enable/scheduler controls invoked after a replacement publish perform no POST. If duplicate-activation hardening is included, synthetic double activation produces one mutation and unexpected rejection releases only its own lock.

Production:

- Poll shows external progress/completion/new log without start/advance/cancel calls; selected same-id detail refreshes and removed detail disappears. Same-target draft/loops/delays/console/filter survive normal success/failure; fallback target uses defaults.
- Hidden stop/resume, retained stale snapshot/error/retry and malformed/rejected response. Coalesced manual/automatic reads obey shared contract; API change masks old render state and ignores delayed response/captured old Refresh.
- Captured old start/advance/cancel after target/run removal, target switch or owner change causes no mutation. Pending old-owner mutation result/catch/finally cannot update status/launch error or release a new owner's same-id operation lock. Same-owner pending successful launch preserves draft edits made while waiting.
- Retain every existing launch/per-run duplicate-activation, refusal retry, rejection release and target-parameter contract assertion. Snapshot refresh never repeats a successful mutation, including a pre-write read still pending at write completion.

## Verification and release needs

Discovery only: no tests, types, builds, broad gates or live checks run by this worker. Supervisor independently passed combined110tests including foundation19 before this task; that result belongs to supervisor, not this audit. Next brief should choose Background history cadence and post-write confirmation policy, authorize the existing Production test change, release source freeze, and name any extraction paths before edits. Run narrow new/existing adapter suites plus unchanged hook19/pure contracts and scoped strict typing; supervisor owns combined full gates and browser certification remains unperformed.
