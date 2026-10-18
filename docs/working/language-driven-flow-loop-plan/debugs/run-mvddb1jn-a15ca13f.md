# Debug: run-mvddb1jn-a15ca13f

- Task: company-website-apprentices, project authoring through the real extension chat; persistent isolated workspace bf-company-website-apprentices-codex, slot-4. Headed Chromium and extension side panel verified open.
- Result: failed at build, no promoted Flow or judged playback/replay. Seven candidate revisions/trials; six executed successfully and one stopped execution. Final revision was judged no. 118 provider calls, $0.082465122, 1,049,531 ms including isolated web preparation. No balance or ceiling failure.
- Stable source: downstream b79796c7, paired Core included held drawing normalization and judge fix; no source/build mutation during the run. The new lifetime Core lease held throughout. The earlier behind-dev refusal was setup-only at $0, before this run.
- Evidence: machine-wide run steps 0139/0196 test-subflow feedback describe only eight people read and no following page; final submission 0194 uses the detected list handle for Next page without a separate scroll phase. The final assembled candidate remains a draft. No oracle acceptance was reached.

## Cause traced

The real team grid starts with eight people. It loads further batches on scroll before showing its Load more control. Detection records that control even while it is hidden. The next-page request inherits loadMore, whose renderedLoadMore waits one second and then returns control_absent for a hidden control. That is a successful ended route, so automatic retries never run and the Flow stops reading the list too early.

The previously verified reveal-by-scroll fix applies to explicit target presses. This distinct paging path bypasses it. The run shows why a passing explicit-click harness did not prove Next page on this hybrid list. No selector identity or task/oracle weakening is justified.

## Correction and verification

Implemented generic correction: keep a visible load-more control preferred; before ending on an absent/hidden control, make a bounded scroll of this same list and wait on its ordinary loading evidence. New items count as a scroll move. If the scroll exposes the control without adding items, recheck and press it; if neither happens, retain the ended result. Disabled visible controls still end without pressing. The requested page limit is checked before fallback movement.

Fail-first generic hidden-control/scroll-growth and page-limit tests both failed against the old code (9/11 passed). Initial corrected paging/action run passed68/68. Added a third regression for scroll revealing only the control, plus a realistic company harness reaching every batch through Next page, including the swallowed first button press's ordinary retries. Final integrated tests, typecheck, audit and real-browser proof are pending before one changed-source paid rerun. The correction may expose further causes; no live fix or pass is claimed yet.

Final generic paging tests passed69/69. The first expanded browser run reached28 cards and ended correctly; its assertion incorrectly expected the stale filter-chip count26. The fixture catalogue actually contains28 cards (27 people and a hiring card). Corrected the harness to compare against TEAM.length, preserving the requirement to reach its complete final batch. The corrected-source Chromium run passed2/2, including all28 cards through Next page. This assertion failure was not a runtime regression.

Integrated verification: Core focused tests48/48, frozen cache-off Core library build and fluxiq typecheck, downstream domain and extension typechecks, and both structure audits passed (all exit0). No full suite was run. The changed-source paid rerun remains pending; these provider-free checks do not establish a successful live build or replay.
