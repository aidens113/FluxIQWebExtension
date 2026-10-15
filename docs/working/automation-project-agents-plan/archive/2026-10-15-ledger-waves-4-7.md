# Work Ledger, 2026-10-15, A8 waves 4-7 (archived)

Moved from `../../automation-project-agents-plan.md` when the plan neared 800 lines. Every entry here is settled;
the A8 Run Plan's tables and Current State carry what still matters.

### 2026-10-15 — The Lab's startup builds (t620); the browser-worker test (t616); wave 5 canaries
- Agent: supervisor (canaries, debugs); workers t620-lab-gateway-build-reused (two rounds), t616 (downstream side); supervisor verified and integrated
- Changed: t620 `packages/test-runner/src/core-web-build/server-adapter.ts` skips the gateway server build when Core's strict identity receipt already matches its sources, and every startup build (gateway server, `next build`, `host-build`, the demo's host build and domain setup, defined once in new `startup-build/`) runs through `runBoundedBuildStep`: a quiet bound output restarts plus a ceiling, a timeout named as a Lab startup failure with step, bound, limit and elapsed time; `docs/architecture/testing-facility.md`; t616 `launch-browser-worker.test.ts` reads the worker's build from Chrome's target list over CDP (its `context.close()` took 50-125 s loaded, past a 120 s budget)
- Why: canary 2 `run-mv93ywox` failed `process.startup` when esbuild was stopped at a fixed 60 s; test 1540 failed the sweep under load
- Validation: t620 after merging dev: test-runner check, no tsc errors; core-web-build, startup-build, server-adapter-identity tests -> tests 75, pass 73, fail 0, skipped 2 (opt-in real-Next probes); audit passed; merged `00e1e50b`. t616: browser test 6/6 loaded; after merging dev: `launch-browser-worker.test.js` -> pass 1, fail 0; audit passed; merged; both pushed. Canaries: debug notes for `run-mv8zw5l2-98064abf` and `run-mv93ywox-9b5aa220`
- Outcome: Accepted

### 2026-10-15 — A8 wave 5; Next keeps the filters the page shows applied (t623)
- Agent: supervisor (wave 5, four runs at once); read-only debugs `a8-towels-run-mv96rz68-debug.md`, `a8-towels-run-mv96rz6d-debug.md`, `a8-social-run-mv96rz6h-debug.md`; worker t623-next-page-keeps-list-scope (two rounds); supervisor verified and integrated
- Changed: the A8 Run Plan's wave 5 table and reading; t623 `apps/extension/src/content/extraction/page-advance/{dropped-state,applied-controls,follow-next}.ts`: a next move whose Next drops query state the page shows applied (a checked, selected or pressed control) follows the pager's following number that keeps it, or fails `page_fault` and presses nothing; `docs/architecture/web-capabilities.md`
- Why: in both towels runs the Flow's Next followed an arrow that dropped every filter, so later pages were read unfiltered while the step reported success
- Validation: wave 5: `project` everything-store passed ($0.085, oracle passed; the first `project` pass there); `project` social failed ($0.063), `project` towels failed ($0.176), `candidate` towels failed ($0.048); debug notes for all four. t623 after merging dev: `test-extension.mjs content/extraction` -> tests 291, pass 291, fail 0 (5 of 8 move tests fail with the call site reverted); `check-extension.mjs` exit 0; audit passed; merged `0638d45f`; pushed
- Outcome: Accepted. Wave 6 reruns all four on the pair after t622-t624
- Follow-up: a filter shown only as a link or chip, with no checked or pressed state, is not seen, so a Next that drops it is followed as before

### 2026-10-15 — A8 wave 6; a default choice is not a filter (t626)
- Agent: supervisor (wave 6, four runs at once, debugs); read-only debugs `a8-everything-store-run-mv9a48cs-debug.md`, `a8-towels-run-mv9a4aj0-debug.md`; worker t626-default-select-not-a-filter (two rounds); supervisor reworded its fallback sentence, verified and integrated
- Changed: the A8 Run Plan's wave 6 table and reading; t626 `apps/extension/src/content/extraction/page-advance/applied-controls.ts`: a single select's first option and a named radio group's first radio are unchosen defaults, not applied filters (a t623 regression faulted Next on an unfiltered search); the fault carries `nextPage.filtersDropped` to a new domain reason `next_leaves_filtered_list` (`domain/src/runtime/llm-evidence/{tool-rejection,repeated-refusal}.ts`, `action-failure/refusal.ts`) with a generic next sentence ending "saying in the answer that the later pages could not be reached with the filters kept" (supervisor's wording)
- Why: wave 6 everything-store's Next faulted twice on a default "All" select and the model saw only `action_failed`
- Validation: wave 6: `candidate` towels passed ($0.086, the first towels pass; t623 and t624 live), `project` social passed ($0.063, t622 kept the rescued pass), `project` everything-store failed ($0.066), `project` towels failed ($0.138); debug notes for all four. t626 after merging dev: `test-extension.mjs content/extraction content/actions/tests/next-page` -> tests 305, pass 305, fail 0; `test-domain.mjs runtime/llm-evidence actions/next-page` -> tests 1136, pass 1136, fail 0; domain tsc (both) exit 0; `check-extension.mjs` exit 0; audit passed; merged `e9c2b5f5`; pushed
- Outcome: Accepted. Wave 7 reruns the same four on the pair after t625-t628
- Follow-up: a first radio or option that really narrows is not seen as applied (Next followed as before t623)

### 2026-10-15 — A8 wave 7: `project` passes all three tasks
- Agent: supervisor (wave 7, four runs; the first slot-2 launch refused by the debug guard because a note was committed after the lane sync); read-only debugs `a8-towels-run-mv9dcztz-debug.md`, `a8-everything-store-run-mv9dd0fk-second-subflow.md`
- Changed: the A8 Run Plan's wave 7 table and reading; debug notes for all four runs
- Why: wave 7 on the pair after t625-t628
- Validation: `project` everything-store passed ($0.121), `project` social passed ($0.027, its second consecutive pass), `project` towels passed ($0.096, the first `project` towels pass; two repairs ran and returned done); `candidate` towels failed ($0.058, the exact rows held by unrefuted nos: Core t629); spend ledger
- Outcome: Accepted. Wave 8 runs all four on the pair after t629 and t630; wave 9 repeats it on the same pair if wave 8 finds nothing new
