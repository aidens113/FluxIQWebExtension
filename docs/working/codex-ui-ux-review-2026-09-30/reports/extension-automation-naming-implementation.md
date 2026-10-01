# Extension automation naming implementation

Status: Complete — source/report frozen; pending supervisor verification
Owner: worker wait_gaps

Read Current State, released six-path brief and naming audit. Product unchanged; extending exact existing owning models with captured list polls/history/selection/focus/scroll and confirmed missing-list regressions. No shared helper/controller/Core/style/shared-document edits. Preparing source reproduction before passive API implementation.

Original-source reproduction:22tests/19pass/3fail, nativeexit1. Actual list-poll rename leaves context name stale; actual removal and strip complete-list absence lack feedback. Exact TEMP codex-t224-naming-before.log. Local shell model captures only owned intervals and supplies synthetic historical thread; existing navigation cases preserved.

Implemented strip passive onNameChange after remembering/drawing new name; shell same-flow forwarding; Chat updateAutomationName uses same-thread metadata update with follow suppressed only on this path. Public open/follow unchanged. Strip missing-flow message guarded complete list/empty mode and no readError; no deletion assumptions or auto-navigation. Preparing direct API/current-send/duplicate/reentrant/state-restoration regressions and scoped checks.

Supervisor approved exact synchronous passive flow/name marker with finally restoration in shell: matching metadata echo skips strip.show (which otherwise calls controller.focus/load detail), while other targets still propagate. Synthetic pending learned-run poll proves exactly one normal detail read, not an extra metadata-triggered read. Reentrant different-flow/later explicit navigation checks preserve marker scope. Related47/47 and scoped six-root TypeScript passed before adding final pending-read generation and notice rename pending/error assertions; rerunning that final revision.

## Final behavior

- Strip remembers fresh matching-flow name before notifying subscribers after drawing. Unchanged names do not emit; reentrant same-name show terminates and subscription cleanup works. Current Run name, keyed export controls and notice pending/error state remain current and mounted.
- Shell forwards only metadata for the current matching automation. Its exact flow/name marker suppresses only the already-drawn strip's metadata echo, restored in finally; different reentrant flow navigation and later explicit selection still propagate. No controller.focus/detail read is added by naming.
- Chat's additive updateAutomationName method fences wrong-flow/Latest/question/no-op updates, updates target/context/title/empty/placeholder and same-thread controller metadata, and skips followNow only on this passive path. Public open keeps prior explicit follow behavior. Same-flow pending reads still land, proving generation is preserved; first send carries the new name as title. History nodes, draft, selection, focus and reading position are retained.
- Complete list/empty with no matching flow and no readError shows “This automation is unavailable in the current list.” Existing disabled Run/cleared exports remain. Offline/loading/fallback/read failures do not invent removal evidence. Returning rows clear feedback and refresh names; historical chat remains selected throughout. No Core deletion or authorization semantics assumed.
- Only three assigned product files and three existing owning tests changed, plus this own report. Shared fake/helpers, controllers/composer/context-line/target/barrels/styles/contracts, extraction/top-bar, Core and other worktrees unchanged.

## Final validation

- Clean original reproduction22tests/19pass/3fail, nativeexit1,415.7943ms. Final heavy label `codex t224 automation naming final`, session16017 nativeexit0:48tests/48pass/0fail/0skip/0cancelled,1222.3601ms. Twenty-eight assigned owning cases (strip10/chat8/shell10) plus20 unchanged automations-tab/chat-panel/in-place-update cases; six bundles imported sequentially in one Node process like actual extension runner.
- Scoped six-root TypeScript nativeexit0, empty types log. All six owned source/test git diff --check exit0.
- Exact evidence: `C:/Users/osrs_/AppData/Local/Temp/codex-t224-naming-{before,build,final,types}.log`.
- Final heavy command from apps/extension: esbuild src/panel/automations/tests/automation-strip.test.ts src/panel/automations/tests/automations-tab.test.ts src/panel/chat/tests/navigation-focus.test.ts src/panel/chat/tests/chat-panel.test.ts src/panel/chat/tests/in-place-updates.test.ts src/panel/shell/tests/mount-panel-navigation.test.ts with bundle/platform-node/target-node22/format-esm, fluxiq/gateway package externals, CSS empty, .js=.mjs, outdir .test-build-scratch/codex-naming; then node .test-build-scratch/codex-naming/related-runner.mjs; then pnpm exec tsc -p .test-build-scratch/codex-naming/tsconfig.json --noEmit. Ignored type config extends tsconfig.test.json with the exact six assigned roots and empty include/exclude.
- Independent execution from repository cwd: `node apps/extension/.test-build-scratch/codex-naming/related-runner.mjs`. Assigned bundle paths under that output: automations/tests/automation-strip.test.mjs, chat/tests/navigation-focus.test.mjs, shell/tests/mount-panel-navigation.test.mjs.
- Reentrant marker regression uses a local empty-title setter callback to induce different-flow navigation during passive rendering, then checks later explicit navigation after marker restoration. Poll tests use only captured local30s automation callbacks; no waiting on a real poll or new requests/timers in product.
- No broad suite/check/build/structure audit, live/browser/provider/panel management, commit/merge/push. This is controlled component/source evidence, not browser certification. Source and report frozen for supervisor review and broader gates.
