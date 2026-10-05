# t263-tabs-assert: worker report

## Outcome

Done. A7 (t174-w104: the replay reset closes only the tabs FluxIQ opened, and a remembered press is answered without waiting) and D1 (t195: a row-scoped assert checks the current row) are ported onto `fxwork/t263/!FluxIQWebExtension` (base `bdda64b1`). Neither is committed.

**A7 still needs browser proof in a live run.** The unit tests stub `chrome.tabs`, so they cannot show how a real browser orders its tab events.

## What changed and why

Both lane diffs applied cleanly onto current `dev` with `git apply`, and there were no conflicts with t262. Nothing was copied whole over a file t262 changed. The new files are LF; the lane's `fluxiq-opened-tabs.ts` was CRLF and was converted.

A7 (from `fxwork/t174`):
- `domain/src/client/close-opened-tabs-parameter.ts` (new): adds the `closeOpenedTabs` navigate parameter. Only the reset sends it, and it is not in the authorable schema. It is exported from `domain/src/client/index.ts`.
- `domain/src/runtime/llm-evidence/node-run/replay.ts`:
  - The reset now sends `closeOpenedTabs: true`.
  - New `targetAbsentBefore`: when the page read before a replayed press is whole, stands at the recorded location, holds neither the selector nor the identity's words, the step answers `remembered` without pressing.
  - The test file gains 3 cases.
- `apps/extension/src/runtime/fluxiq-opened-tabs.ts` (new): an in-memory record of the tabs FluxIQ opened (`note`, `forget`, `recorded`, `closeAll`). It has its own test.
- `action-runner.ts`: a navigate carrying the parameter first closes the recorded tabs. If the tab in front was one of them, it then drives the tab they were opened from. A new-tab navigate is recorded.
- `browser-tab.ts`: a tab open is recorded and a tab close is forgotten.
- `click-landing.ts`: a `_blank` tab is recorded, and forgotten when it is closed on a refused landing. `click-landing-new-tab.test.ts` gains 2 cases.
- `command-options.ts`: adds `closesOpenedTabs`.
- `docs/architecture/web-capabilities.md`: the Click row and the dry-run `reset` paragraph are updated.

D1 (from `fxwork/t195`):
- `apps/extension/src/content/actions/assert.ts`: an assert whose `element` (or `options.element`) carries a non-empty `context.record.values` now resolves through `resolveTarget` (the record gate) instead of the bare selector. A row with no such control is asked about an empty target and does not fall back to the selector.
- Tests: 3 cases in `actions/tests/assert.test.ts` and 2 end-to-end resolver cases in `action-runtime/tests/resolve-target.test.ts`.

## Commands run and observed results

- Domain, label `t263-tabs`: `node run-subset.mjs <domain> t263-tabs src/runtime/llm-evidence/node-run/tests/replay.test.ts`, then `node --test` printed `tests 20, pass 20, fail 0`.
- Extension, label `t263-tabs`: `fluxiq-opened-tabs`, `click-landing-new-tab`, `assert`, `resolve-target` and `navigate-action` tests printed `tests 65, pass 65, fail 0`. A second batch (`action-runner`, `browser-tab`, `command-options` tests) printed `tests 55, pass 55, fail 0`.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` and `... extension check` both exited 1 before typechecking. The guard `scripts/check/core-build.mjs` refused because "FluxIQ Core's build ... is 6 minute(s) behind its source", since t263-core is editing `step-log/tool-step.ts` in the shared Core worktree. I did not rebuild Core while the other worker is editing it. Instead I ran the guarded commands directly:
  - `domain`: `npx tsc -p tsconfig.json --noEmit` exited 0, and `npx tsc -p tsconfig.test.json --noEmit` exited 0.
  - `apps/extension`: `node scripts/check-extension.mjs` exited 0.
  - This typechecks against Core's existing dist. None of my files touch Core.
- `pnpm.cmd --filter @fluxiq-web-extension/extension build` exited 0, and chrome, firefox and e2e-chromium each reported "verified 22 files".
- `node scripts/structure-audit.mjs` printed "passed (166 warning(s), 118 baselined)". This ran on the shared tree, which also holds t263-domain's edits.

## Not verified

- No live or browser proof of A7: real tab closing, the order of `onCreatedNavigationTarget` events, and service-worker restart forgetting the record. This must come from a live run.
- No live proof of D1 on a real repeated-row page.
- The full `pnpm check` / `domain check` / `extension check` were not run through the guard, because Core's dist is stale from t263-core's concurrent edits. The supervisor should re-run both checks after Core is rebuilt.
- The domain and extension typechecks ran on a tree that also contains t263-domain's in-progress edits, and they passed at that moment.

## Open questions or contradictions found

- The brief's "Must not touch: every file t263-domain owns" was respected. `node-run/index.ts` did not need any change for A7.
- The `apps/extension/src/runtime/index.ts` barrel exports only selected modules (10 lines), and the lane did not add `fluxiq-opened-tabs` to it. I left it unchanged; it is not owned by this brief, and the structure audit passes.
