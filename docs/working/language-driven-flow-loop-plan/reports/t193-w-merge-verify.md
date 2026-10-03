# t193-w-merge-verify: verify the combined t193 trees after merging dev

Trees: `fxwork/t193/!FluxIQ` (Core, HEAD `6da08162`) and `fxwork/t193/!FluxIQWebExtension` (downstream, HEAD
`3f0521f9`), branch `task/t193-live-self-repair`. Run 2026-10-03.

## Outcome

Done. Every named check passed and nothing failed, so no file was edited. Both trees are still clean (`git status
--short` prints nothing in either).

## What changed and why

No source changes. One scratch runner was added outside the repository:
`<scratchpad>/t193-merge-verify-run-dirs.mjs`. Neither package's test runner accepts a directory filter, so this runner
bundles and runs only the named `tests/` directories, using the same esbuild options and node:test as
`apps/extension/scripts/test-extension.mjs` and `domain/scripts/test-domain.mjs`. Its output goes to
`<package>/.test-build-scratch/t193-merge-verify/`, which git ignores.

Finding on order: `apps/web` resolves `fluxiq` through `packages/fluxiq/dist`. Before this run that `dist` was from
00:12, which is older than the merge. A web typecheck run before the library rebuild therefore checks against the old
kinds. The first web check (exit 0, before the rebuild) is not evidence. The second one, forced after the rebuild, is.

## Commands run and observed results

Core (`fxwork/t193/!FluxIQ`):

| Check | Command | Observed |
| --- | --- | --- |
| fluxiq typecheck | `heavy.sh "t193 core fluxiq check" pnpm --filter fluxiq check` | `"step":"fluxiq:check","reason":"no stamp; ..."`, 31953 ms, exit 0 |
| Structure audit | `node scripts/structure-audit.mjs` | `structure-audit: passed (233 warning(s), 349 baselined).` exit 0 |
| Docs reference | `node scripts/docs-reference.mjs --check` | `Deterministic framework reference is current.` exit 0 |
| Library rebuild | `heavy.sh "t193 core libs build" node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` | contracts reused; `fluxiq:build` built ("inputs changed: packages/fluxiq", 5301 files, 148963 ms); client-gateway-websocket reused; exit 0 |
| Kinds in the rebuilt dist | `grep -c ready_check / recall dist/ui/activity-action/types.d.ts` | 0 / 2 |
| apps/web typecheck (after rebuild) | `FLUXIQ_BUILD_FORCE=1 heavy.sh "t193 core web check" pnpm --filter @fluxiq/web check` | `web:check` built, 49143 ms, exit 0 |
| apps/web action-icons test | `npx vitest run src/features/automation-studio/conversation/components/tests/ConversationActionCard.test.tsx` (in apps/web) | `Test Files 1 passed (1)`, `Tests 5 passed (5)` |
| activity-action tests | `npx vitest run src/ui/activity-action` (in packages/fluxiq) | `Test Files 8 passed (8)`, `Tests 173 passed (173)` |

`ready_check` and `recall` agree across packages. A grep for `ready_check|readyCheck|ready-check` over Core `packages`
and `apps` .ts/.tsx finds no file. `recall` appears in `types.ts`, `action-of.ts` (`core.recall_result`), `icons.ts`
(`scan-search`), `names.ts` ("Recall result") and their tests, and in apps/web `action-icons.ts` (`recall: ScanSearch`).
The record type there is `Record<ActivityActionKind, LucideIcon>`, so the web typecheck would fail if it were missing.

Downstream (`fxwork/t193/!FluxIQWebExtension`):

| Check | Command | Observed |
| --- | --- | --- |
| Core build gate | `node scripts/check/core-build.mjs` | `FluxIQ Core's build at ... is current with its source.` exit 0 |
| Domain typecheck | `heavy.sh "t193 domain check" pnpm --filter @fluxiq-web-extension/domain check` | `domain:check` built (src + test tsconfig), 22700 ms, exit 0 |
| Extension typecheck | `heavy.sh "t193 extension check" pnpm --filter @fluxiq-web-extension/extension check` | `extension:check` built, 38635 ms, exit 0. It runs `tsconfig.json` and `tsconfig.test.json`, so `panel/chat/stream/step` and its tests are now compiled. |
| Extension tests, the 7 changed dirs | `node t193-merge-verify-run-dirs.mjs apps/extension t193-merge-verify background/activity/tests background/tests content/activity-overlay/placement/tests content/activity-overlay/tests panel/chat/conversation/tests panel/chat/stream/step/tests panel/chat/tests` | 44 files; `# tests 360`, `# pass 360`, `# fail 0`, exit 0 |
| Domain tests, the 8 changed dirs | same runner on domain: `runtime/tests runtime/llm-evidence/tests .../node-run/tests .../node-run/press-effect/tests .../plan-resolution/tests .../state-digest/tests .../structure/tests .../structure/first-item/tests` | 83 files; `# tests 582`, `# pass 582`, `# fail 0`, exit 0 |
| test-contracts tests | `heavy.sh ... pnpm --filter @fluxiq-web-extension/test-contracts test` | `# tests 161`, `# pass 161`, `# fail 0`, exit 0 |
| test-runner typecheck and build | `heavy.sh ... sh -c "pnpm run check && node scripts/domain-dist.mjs && node ../../scripts/build-cache/cli.mjs test-runner:build"` (in packages/test-runner) | domain:build built; test-runner:check built; test-runner:build built; exit 0 |
| test-runner tests, the changed dirs | `node --test "dist/flow-lane/creation/tests/*.test.js" "dist/flow-lane/tests/*.test.js" "dist/live-llm/tests/*.test.js"` | `# tests 454`, `# pass 454`, `# fail 0`, exit 0 |
| test-runner tests covering `run-scenario.ts` | `node --test dist/tests/coordinator-existing.test.js dist/tests/scenario-assertions.test.js` | `# tests 12`, `# pass 12`, `# fail 0`, exit 0 |
| Extension build | `heavy.sh "t193 extension build" pnpm --filter @fluxiq-web-extension/extension build` | chrome, firefox and e2e-chromium each `verified 22 files`; firefox shows the known placeholder gecko.id warning; exit 0 |
| Structure audit | `node scripts/structure-audit.mjs` | `structure-audit: passed (161 warning(s), 118 baselined).` exit 0 |

## Not verified

- The Core vitest union was not run again. The lead's earlier run is the evidence: 4025 passed, and 1 adaptation load
  timeout that passes alone. The second merge commit changed only one line in apps/web `action-icons.ts`, and the web
  check and the action-card test above cover that line.
- Not run, as the brief excludes them: full suites (`pnpm check`, `pnpm test` at the repository root, the whole
  package suites), the Lab and any live run.
- No manual browser check of the chat cards. The merged `card-words.ts` and `action-card.ts` are covered only by unit
  tests and the typecheck.
- The rebuilt Core `dist` is in the shared t193 Core worktree. It is ignored output and was not committed.

## Open questions or contradictions found

None for the merge. One point on order: run the Core library rebuild before the apps/web check, because `fluxiq/ui`
types come from `dist`.
