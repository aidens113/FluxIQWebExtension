# Lazy-tail ordering probe plan

Status: Complete ? tests-first probe design; tracked test/source writes HELD
Owner: recording_controls
Date: 2026-10-01

## Written brief

Supervisor corrected types1691/build11533 were active when this plan was dispatched. Own ONLY this NEW report; no tracked product/test write or check until explicit release. Read prior lazy-tail-full-failure-audit.md and relevant list-wait.ts/store-pager.ts slices only. The future source release is TESTS FIRST ONLY: NEW apps/extension/src/content/extraction/tests/list-wait-ordering.test.ts. Product list-wait.ts, shared store-pager fixture, original lazy-tail assertions, page-render, constants, original deadlines and harnesses remain frozen. No fix authorization is inferred.

Root full observed2062pass/1 missing page2 tail at4.408s; root unchanged existing-built narrow6/6 native0/12711.216ms, deadlinecase525.2105ms. The prior report's queued-turn production idea and desired cross-order equality are exploratory alternatives, NOT accepted requirements for this probe. This plan supersedes any impression that a particular implementation outcome is already prescribed. First record actual current behavior under controlled schedules, then supervisor decides whether evidence demonstrates a product contract defect and releases a separate regression/fix.

## Actual entry and immutable constants

Call production awaitPageComplete, not a copied wait loop or mocked extraction. Construct real storePage(2,{lazyTail:STORE_LAZY_TAIL}); PageWant is {everything:false,records:16,taken:()=>false}, absolute actionDeadline30000. This isolates page2's real completion path and needs all16 actual synthetic cards. Use a separately described records48 control only if useful to observe the second no-growth reveal when more than this page can still be used; do not imply16 is the full reader's hidden default max.

Pin actual registered delays: first loader600ms; first growth poll50ms; growth window900ms; original4 reveal ceiling remains in product. No constant/export/fixture edits. Existing command bounds500ms and30000ms remain, with exact900/901 absolute-boundary characterization optional. The future test runs actual store layout/scroll/sentinel replacement and actual production Promise continuations.

## NEW-file local clock/timer harness

Capture descriptors for Date.now, global setTimeout/clearTimeout, document/window/HTMLElement/HTMLInputElement before the NEW harness installs them. Date.now returns local now. Each intercepted timeout stores {id,due:now+delay,registrationOrder,callback,args,cleared:false}; only real production/fixture callbacks are stored. No inference/list implementation/body is replaced. clearTimeout cancels exact local handle. Timers use synthetic handles only within this harness and NEVER escape to native timers. Tests restore page first and every captured descriptor in finally, clear captured callbacks and settle/observe operation rejection so no unhandled Promise or pending synthetic callback leaks.

Normal delivery chooses eligible earliest due then registration order, moves now to that deadline, invokes ONE callback, and drains its Promise microtasks before another macrotask. Hostile delivery moves now without invoking anything, selects an explicitly named eligible callback, invokes only it, then drains microtasks. The trace distinguishes due timestamp from actual delivered timestamp; load600 means scheduled eligibility, not a guarantee it executed at600. At clock950 both old poll50 and loader600 are eligible; both retain original due times.

Use microtask checkpoints solely to run actual awaited Promise continuations. Capture a settled flag/outcome through the original awaitPageComplete Promise and append observations after bounded checkpoints. Never service another macrotask in a microtask flush. If expected local continuations do not quiesce, stop with harness evidence rather than manufacturing a read result. No native sleep, real wall-clock deadline, test-run serialization or machine cause assumptions.

Each trace records registration/delivery {id,due,deliveredAt}, clock, actual document card count/IDs, page.scrolls(), completion settled flag/outcome and pending eligible/future timer IDs. testcontext.diagnostic may emit these SYNTHETIC structural IDs/timestamps only. No actual page data/runtime/browser storage is read.

## Exact scenarios and assertions

A. Normal schedule: actual page2 atclock0 starts with12. Start awaitPageComplete and assert registered600ms loader and50ms poll; service due polls ontime through550, then same-deadline600 loader/poll by original registration order. Observe card13-16 arrive from actual sentinel callback. Continue production wait to settle; final actual IDs should contain16 and completion complete for wanted16. This is the positive existing fixture contract, not an invented product extension.

B. Hostile older-poll-first: new real page2/clock0; register unchanged600 loader/50 poll. Advance clock to950 without callbacks. Assert BOTH captured callbacks are eligible and document still12. Deliver old50 poll first, microtask-checkpoint, snapshot whether production completion already settled and its count/outcome. THEN deliver the due600 loader at SAMEclock950, checkpoint and record actual16-card document plus whether read had already completed before loader delivery. Do not assert that production MUST wait for this overdue callback before observing the original result. A missing-tail early completion is recorded/reproduced behavior, not automatically assigned a fix or stable expected defect assertion.

C. Same-clock loader-first comparison: fresh identical page2/clock0; advance to950; deliver captured600 loader before the captured50 poll; record both real callback/continuation traces and outcome. This is an explicit callback-order perturbation to establish observation dependence, NOT a claim that all JavaScript engines normally schedule a later-due callback ahead of an older one. The harness models selected macrotasks and mandatory continuation checkpoints; it does not claim to reproduce the full engine or explain why a real full-run callback became overdue.

D. Command deadline500: unchanged600ms fixture and50ms polls, actionDeadline500. Service ontime polls through500 without loader; observe timed_out with12, loader remains future/undelivered, no extra window. The NEW test directly calls page completion, so it must not fabricate full extractList.pagesRead/paginationStop/no-next assertions; those remain in unchanged original suite.

E. Growth window/no-load decision: keep the genuine600ms fixture but deliberately leave its callback UNDELIVERED while servicing polls through900. Snapshot whether completion becomes complete with12 and the due600 callback is still pending. This is a delayed-delivery characterization, not a change to loadMs. If a future true-no-growth fixture is needed, use separate NEW local explicit page geometry with no loader; do not edit shared fixture or silently change600 to1500.

F. Demand below eager count: real lazy fixture, records10. Actual awaitPageComplete should settle complete immediately with12 existing cards, zero scrolls and no newly scheduled timer. Preserve preview/item bound intent; no required extra observation turn is introduced by this probe.

G. Boundary characterization if needed: deadline900 versus901 at the same hostile950 observation time, plus callback delivered before poll versus after. Report actual return/settlement/card-count traces separately from deadline intent. Current waitUntil checks condition before clock and commandEndsFirst is chosen at construction; probe should not automatically decree a new policy for late growth or elapsed command handling. This can reveal a separate ordering/deadline fact for supervisor review, not authorize broader waitUntil changes.

Initial hard assertions protect harness/fixture integrity, scheduled constants, actual DOM growth, allowed outcome enum and known normal/500ms/low-demand behavior. Hostile actual outcome is written as measured trace/characterization; do NOT bake an arbitrary future queued-turn expectation, cross-order equality or desired16 expectation into hostile case until reproduction and contract review. No original48-row/30s/900/600 expectation is relaxed. If a durable failing regression is requested later, root separately specifies the supported observation boundary and expected outcome based on the reproduced evidence.

## Scheduling claim and inference limits

An older due poll delivered before a later due loader, followed by that callback's Promise continuation, is the precise dependency tested. Declaring both due does not mean both callbacks have run. Moving fake now is controlled late delivery, not a machine-load diagnosis. Loader-first same-clock comparison is deliberately not asserted as native ordering equivalence. Synthetic probe alone cannot prove the actual full-run ordering or certify Chrome/Node scheduling; direct trace/full reproduction remains distinct evidence.

A normal600ms load can satisfy900ms growth in ordinary delivery, as unchanged narrow tests observed. At950, a600ms scheduled callback has not necessarily delivered before the negative poll checks window. Whether completeness should wait one queued task, treat all late arrival as outsidewindow, or retain current behavior is a separate contract decision after probe. No fix, queued turn, new deadline allowance, new load duration or source edit is pre-authorized.

## Execution release/check boundary

After root reports active gates closed and explicitly releases NEW test path, create only that owning probe, run its actual baseline through an external TEMP focused heavy harness, and report exact traces/cases/native status. Do not rebuild/rerun root original broad suite or modify production/shared fixture/tests. Actual-config scoped typing of that new test may be requested after release; root owns source integration, independent reproduction and later broad verification. Any instrumentation beyond NEW local harness requires exact added scope first.

Only this plan report was written. No test/source/check/live/private/provider/Core/commit operations. Original audit remains intact with its exploratory candidate clearly narrowed by this tests-first plan.
