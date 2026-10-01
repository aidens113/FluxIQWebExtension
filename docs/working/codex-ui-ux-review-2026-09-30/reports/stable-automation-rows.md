# Stable extension automation rows

Status: Complete (worker; pending supervisor verification)
Owner: worker stable-automation-rows

## Current State

Source complete and frozen in the four assigned files. Original identity/focus defects reproduced; final10focused tests pass and scoped TypeScript check passes. Shared fake DOM untouched; focus/removal semantics simulated locally in the assigned tab test. Supervisor broad/integration validation remains.

## Findings

- controller.refresh and setWorking trigger draw; row handlers currently close over initial data.
- Reconcile by flowId, update text/handler data in place, and restore only a previously focused row after DOM reordering.
- Removed focused rows choose next surviving original neighbour, then previous, then first new row; empty or heading fallback must be visible/programmatically focusable. Background external focus and hidden panel must never be claimed.
- Existing HTMLLIElement builder API will remain assignable/compatible.

## Validation

Pending narrow reproduction. No broad checks, browser, Lab, providers, panel processes, commits or other-worktree edits.

- Reproduced original defect via six tab regressions: native exit1, 5fail/1pass/0skip in936.5477ms. Original focus/identity/current-handler/reorder/removal checks fail; background no-steal already passed. Logs /tmp/codex-t224-rows-before.log.
- Implemented keyed nodes/current handler data; retained HTMLLIElement return assignability. Focus restores with preventScroll only when previous focus was a row, active visible panel, visible document; nearest original neighbour then named empty/heading fallback. Shared fake DOM untouched.

- Corrected focused suite passed8/8, nativeexit0,350.8205ms. Initial narrow command emitted .js but ran old .mjs; that stale run failed5/6 and is not validation. Corrected bundler uses explicit --out-extension:.js=.mjs. Added heading-on-offline and new-row/hidden-document fallback cases for final10test run. One later harness attempt ran8tests then failed because the scoped type config had not been created (wrong edit cwd); corrected paths before final rerun.


## Final change and validation

- Changed only apps/extension/src/panel/automations/{automations-tab.ts,row-element.ts,tests/automations-tab.test.ts,tests/row-element.test.ts} plus this own report. Shared document/index, controller, fake DOM, Core and other worktrees untouched by this worker.
- Row builder remains an HTMLLIElement with additive typed button/update members. Text nodes/button/li stay mounted; updates replace current full row data read by the single handler. Only textContent/setAttribute is used for untrusted names.
- Tab reconciles flowId keys and order, leaving unchanged children untouched. It remembers original focus before removals, restores moved-row focus with preventScroll, chooses next surviving original neighbour then previous/first-new, or named programmatically focusable empty/heading. Focus movement requires previous row focus, active visible panel, and visible document. External focus is untouched.
- Final narrow command (package cwd apps/extension, explicit Git Bash heavy label codex t224 rows final corrected): pnpm exec esbuild the two assigned test files --bundle --platform=node --target=node22 --format=esm --external:fluxiq --external:fluxiq/* --external:@fluxiq/client-gateway-websocket --external:@fluxiq/client-gateway-websocket/* --loader:.css=empty --sourcemap=linked --out-extension:.js=.mjs --outdir=.test-build-scratch/codex-stable-rows; then node --enable-source-maps --test both generated .mjs files; then pnpm exec tsc -p .test-build-scratch/codex-stable-rows/tsconfig.json --noEmit. The ignored scoped config extends extension tsconfig.test.json and contains only the four assigned roots, with empty include/exclude.
- Final heavy session99323 nativeexit0: 10tests/10pass/0fail/0skip/0cancelled,352.6029ms; scoped TypeScript nativeexit0. Owned production git diff --check0 (line-ending notices only).
- Exact logs: C:/Users/osrs_/AppData/Local/Temp/codex-t224-rows-{before,build,final,types}.log. Final types log empty (success). Independent execution may use apps/extension/.test-build-scratch/codex-stable-rows/{automations-tab,row-element}.test.mjs without rewriting artifacts.
- No broad test suite/audit/build run; no live browser, accessibility certification, Lab, provider, panel startup, commits or pushes. Focus behavior is covered by local controlled DOM simulation, not a live browser claim. All source/report frozen for supervisor review and integration.
