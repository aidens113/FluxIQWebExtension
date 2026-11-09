# Integration round 2 checks (t880)

Outcome: Partial. 1 real test failure and a failed browser proof (scripted model). Everything else passes. Nothing edited.

## Diff (dev...HEAD)
- Extension: content/actions/click.ts (+tests/click), panel/chat/transport/ports/results tests, scenario-lab local-classifieds script (filters, results), domain output-nodes/extract-list, domain runtime/llm-evidence (capture, sanitize, stable-handles, structure/detect, node-run/press-effect, plan-resolution control-intents + extraction), debug docs.
- Core: contracts task-attempts/saved-state; fluxiq engine/automation (graph-navigation, step-skip), framework/automation-service/answer-first (attempt, attempt-store, completion, flow-run, witnesses, run-acts, tests), runtime/answer-first/act-record, flow-authoring bootstrap, runtime/llm (anthropic, deepseek, harness, verification-checked, diagnosis), runtime/result-verification (cited-yes, flow-less, verdict), models/providers/anthropic; ui-components chat/answer words + ports; lane reports.

## Core (worktree !FluxIQ)
- `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build ui-components:build` -> exit 0 (fluxiq and ui-components built fresh, tsc inside; others restored).
- vitest (fluxiq, over the changed dirs: engine/automation graph-navigation + step-skip, answer-first service dirs, runtime/answer-first, answerability, authoring, runtime/llm, models, result-verification) -> 620 files, 5895 tests passed.
- `pnpm exec vitest run src/task-attempts` (contracts) -> 10 files, 96 passed.
- `pnpm exec vitest run src/chat` (ui-components) -> 101 files, 668 passed.
- `node scripts/structure-audit.mjs` -> exit 0.

## Extension (worktree !FluxIQWebExtension)
- Typecheck: `pnpm run check` in domain -> exit 0; in apps/scenario-lab -> exit 0; in apps/extension -> exit 0 on the second run. First run failed only on `@fluxiq-web-extension/domain/node` not found (domain dist not yet built in the fresh worktree); after `node scripts/domain-dist.mjs` it passed. Environmental, not a regression. `tsc -p tsconfig.json --noEmit` in apps/extension alone: 0 errors.
- `node scripts/test-extension.mjs content/actions panel/chat/transport` -> 253 tests, 253 pass.
- `node scripts/test-domain.mjs runtime/llm-evidence output-nodes/extract-list` (from domain/) -> 1747 tests, 1746 pass, 1 FAIL (twice, identical):
  - `two actual pre-act sources for the same absolute target remain ambiguous through public completion`
    (domain/src/runtime/llm-evidence/tests/control-intent/tests/lineage.test.ts:106)
  - error: `true !== false` at `assert.equal(completed.ok, false, ...)`; completion returned ok:true.
  - Re-run alone (`node scripts/test-domain.mjs runtime/llm-evidence/tests/control-intent/tests/lineage`) -> 2 tests, 1 pass, 1 fail, same test. REAL failure, not a load flake.
  - Likely cause: commit 175acd38f (t876 lane-b) "Resolve a control pressed from two pages when its witnesses agree" changed control-intents/absolute.ts so agreeing pre-act witnesses now resolve; this older test still expects `web.handle.ambiguous`. Test file was not touched by the diff. The test needs updating to a disagreeing-witnesses case (or the behaviour reconsidered).
- Scenario lab: `node ../../scripts/build-cache/cli.mjs scenario-lab:build`, `test-contracts:build`, then `node --test` on all 7 `dist/scenarios/local-classifieds/**/*.test.js` -> 43 tests, 43 pass (first attempt failed only because test-contracts was not built; environmental).
- Lab runner: diff does not touch packages/test-runner or scripts/lab, so the site-change/answer/core-web-build runner tests were not run. Ran `node --test` on dist/attempt-lane/**/*.test.js (after domain-dist, test-runner:build, test-evidence:build) -> 117 tests, 117 pass (first attempt had 13 fails from test-evidence not built; environmental).
- `node scripts/structure-audit.mjs` -> exit 0 ("passed (244 warning(s), 552 baselined)").
- `node scripts/check/core-mirror.mjs` -> exit 0 (1 mirror set matches Core).

## Provider-free browser proof
- `FLUXIQ_ATTEMPT_SCRIPT_FORM=again-check pnpm lab attempt local-classifieds --task local-classifieds-save-dining-tables --authoring-mode answer-first --scripted-model --attempts 2` -> exit 1, status `not_judged`, why `AttemptScriptRefused`.
- Error: `The script for local-classifieds-save-dining-tables expects no request 4 of kind loop_verification`. Attempt 1 reached 31 live steps / 28 calls / 65 steps, then asked for a 4th loop_verification the script does not provide; 0 attempts ended and were kept, so attempt 2 never ran.
- Evidence: test-runs/attempts/run-mw9tqkp0-228b64e4 (in the extension worktree).
- Not re-run: the scripted model is deterministic and the refusal is a script/flow mismatch, not a load symptom. Likely the script (apps/scenario-lab local-classifieds script, or test-runner scripted-model) needs one more loop_verification answer, or the Flow now asks for more verification than before.

## Not run
Full pnpm check/test/build, Core's whole vitest, site-change/answer/core-web-build runner tests (untouched code).
