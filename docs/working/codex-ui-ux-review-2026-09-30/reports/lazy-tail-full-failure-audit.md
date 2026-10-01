# Lazy-tail full extension failure audit

Status: Complete ? source-based ordering candidate; deterministic reproduction HELD
Owner: recording_controls
Date: 2026-10-01

## Written brief and observed evidence

Supervisor released READ-ONLY exact4: content/extraction/list-wait.ts; tests/store-pager.ts; tests/list-reader-lazy-tail.test.ts; page-render.ts. Own ONLY this NEW report. No product/test writes, checks, heavy duplicate, browser/private/live/Core/provider/commit operations were performed.

Root full extension failed2062pass/1 in the first lazy-tail test: page2 records2-13 through2-16 were absent, while first/third tails succeeded; case ended around4.408s, far before its explicit30000ms command timeout. No binding causal link is established. Root then ran unchanged existing-built narrow suite43990: CLOSED native0,6/6passing,12711.216ms total,deadlinecase525.2105ms. Narrow pass confirms the ordinary schedule but does not explain or waive the full failure. Constants900ms growth,600ms synthetic load,50ms polls,4 reveals, max bounds and original timeout/assertions stay intact.

## Actual source behavior

list-wait.awaitListComplete captures before count, reveals the sentinel immediately after the last item, then calls waitUntil(count>before,900,50,actionDeadline). waitUntil records windowEnd and repeatedly awaits timer-backed polls. At each continuation it evaluates condition FIRST; only when false does it evaluate Date.now>=end and return unchanged/timed_out. If the non-command900ms window returns unchanged, awaitListComplete immediately calls the page complete. A paged caller can advance and detach the missing tail before its load callback gets a turn. No settle/drain after an unchanged growth window exists here.

store-pager.resultsOf starts a real600ms timer synchronously when scroll brings the sentinel into reach. That callback replaces the sentinel with cards13-16. Fake layout is DOM-order row40px, viewport800px, reach+200px; scrolling triggers listeners only when scrollY changes. Each page turn resets scrollY0, replaces old result nodes, and creates a new sentinel/loader closure. The tail loader operates on its captured sentinel; if page advancement detached that sentinel, replaceWith finds no parent and cannot publish the late old tail into the next page. This explains why an early page2 completion would permanently lose precisely its four records while page3 can still load correctly.

Original first test explicitly asks next paging over3 pages and expects all48 card IDs, pagesRead3, timedOutfalse,page_limit and followed[2,3], with at least3scrolls. The failure at the first record assertion does not mean the later summary assertions were observed to pass in the full run. The numbered/continued/preview/item-limit/deadline cases cover distinct behavior; the500ms deadline fixture uses1500ms load to require honest timeout/no-next. Do not conflate that intentional short command timeout with the failed30s next-read test.

page-render.awaitPageRendered declares arrival immediately when an unread item exists, which12 eager page2 cards satisfy; its pagination-controls empty2s settle is not the lazy-tail growth mechanism. Its first-page unpaged settle uses900ms stable-count observation, but the paged read's reveal is governed by list-wait. Its comments explicitly warn that a settled complete document can still have pending timer-driven data; stillness cannot certify an absent or future list. Nothing in these four sources reads the new panel/background binding identity.

## Deterministic ordering risk ? candidate, not verified root cause

Schedule: reveal at t0 registers loader due600 and first poll due50. Resume an overdue OLDER poll at an observation time>=900 before invoking the loader callback that is also already due. The poll resolves its Promise; its immediate continuation observes count12, then elapsed900ms, and returns unchanged before the ready loader callback executes. The page is declared complete, and subsequent page replacement can detach the sentinel. This candidate does not require changed constants, a30s timeout, ID wiring, machine blame or malformed DOM.

The symmetric schedule demonstrates order sensitivity: if the600ms loader callback runs first at that SAME observation time, waitUntil checks condition before time and returns changed even after900ms. The code therefore already allows an overdue positive observation, yet a negative older-poll observation can terminate before another due callback gets its opportunity. Wall time alone does not determine the result; callback delivery/microtask ordering does. Full missing-only-page2 is consistent with this mechanism but does NOT prove it occurred without the actual callback trace.

The fixture also leaves outstanding loader callbacks after restore/page replacement. They cannot mutate a new page through captured detached sentinel replacement in the inspected code, although they can remain scheduled. That cleanup issue is not a demonstrated cause of this first-test failure and is not authorization to modify the shared fixture or weaken assertions.

## Smallest executable investigation/regression ? exact two paths proposed

Product under investigation: apps/extension/src/content/extraction/list-wait.ts.
NEW owning test: apps/extension/src/content/extraction/tests/list-wait-ordering.test.ts.

Existing store-pager.ts, original lazy-tail tests and page-render.ts remain unchanged. New test imports actual awaitListComplete and uses the genuine existing synthetic storePage/STORE_LAZY_TAIL; it replaces Date.now and timer delivery only within its local NEW-test harness, restores descriptors in finally, and invokes actual scheduled callbacks. No production injection hook, old fixture delay, global test-run serialization or timeout relaxation.

Tests first:
- Install synthetic clock0, real storePage eager12/lazy4/load600, start actual awaitListComplete with wanted16 and deadline30000. Capture scheduled600ms loader and50ms poll. Move clock to950 WITHOUT delivering callbacks; deliver the older50ms poll first and flush its actual Promise continuation. Original source should incorrectly complete with12 before the due loader is delivered. The desired regression expects completion decision to allow already-ready queued growth observation before declaring complete, yielding16 when the600ms callback is then delivered. Record that this is a controlled late-callback ordering, not elapsed-fetch speed.
- Deliver the600ms loader before the older poll at the SAME950 observation time; count16 succeeds. Both orderings must reach the same supported completeness decision after a ready task gets its turn.
- No-growth sentinel/window remains bounded: never deliver a future1500ms load within900ms; after the window and any zero-delay decision boundary, return complete with12. Do not wait another600/900ms or raise constants.
- Action deadline500 precedes the900 window; completion remains timed_out and no page advance is permitted. Already-expired command must never receive a fresh growth budget or a late artificial success.
- Synchronously published growth is observed immediately; wanted<=eager count and no-scroll geometry return without extra timer. Four reveal bound stays intact for a genuinely endless list.
- Restore fake clock/page/timers and prove no pending NEW-test callbacks leak into another case. Original browser-shaped fixture and all its assertions remain unchanged.

If that deterministic original-source failure reproduces, a narrow candidate is ONE queued-task decision boundary only after unchanged non-command growth, then a fresh count/deadline check before declaring complete. Apply it locally in awaitListComplete rather than changing every waitUntil caller by default. This would allow already-ready loader callbacks to run, preserve the900ms configured growth window, and retain the original500ms command cutoff; it must NOT become another growth wait or extend reveal/item bounds. Since actual queued-turn elapsed time can vary, its deadline behavior and no-growth bound must be explicit in the owning test and supervisor review. This is a proposed investigation/refinement, not an already-authorized product change or a claim of exact real-time certification.

A stricter fixed-wall-time contract could instead classify all after-window growth as incomplete; current condition-before-deadline semantics does not consistently implement that. Supervisor must decide the intended observation contract after the controlled reproduction; do not change the original48-row expectation or silently reinterpret a missed due callback as a complete page. If reproduction does not yield this defect, request an exact instrumented ordering trace in the NEW owning test and investigate further rather than declaring narrow pass exoneration.

## Validation and limits

Root existing-built6/6 is the only new executed evidence for this audit. No duplicate suite or fake-clock probe was run by this worker, so the candidate remains unverified. After explicit release, first reproduce actual source with the deterministic NEW test, then relevant unchanged lazy-tail/reader/pagination/render suites through external TEMP heavy harness and actual-config scoped typing. Root owns independent review and full/type/build/structure rerun; no existing full failure can be waived based on this report or a single narrow pass.

Only this report changed. No claim of machine capacity failure, live/browser correctness, new binding causality,30000ms deadline exhaustion, fixed900ms guarantees, broad pass or unrelated source repair is made.
