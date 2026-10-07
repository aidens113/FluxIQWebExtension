# sweep-1007 report (2026-10-07)

## Outcome
Done. All commands ran to completion. Trees: downstream at `ac50dd85` and Core at `93c059b0`, both detached under `C:\Users\osrs_\FluxStuff\fxwork\sweep-1007\`. Nothing was edited or committed, and nothing ran in the Lab or a browser.

## What changed and why
Nothing. The sweep was read-only. The only file written is this report. Logs are in the worker scratchpad (`sw-*.log`).

## Commands run and observed results
| Step | Command | Exit | Totals |
| --- | --- | --- | --- |
| Core | `pnpm install --frozen-lockfile` | 0 | |
| Downstream | `pnpm install --frozen-lockfile` | 0 | |
| Core | `pnpm build` | 0 | |
| Core | `pnpm check` | 0 | |
| Core | `pnpm test` (`pnpm -r --no-bail test`) | 1 | contracts 127/127, client-gateway-websocket 10/10, apps/web 2933/2933 (359 files). fluxiq: 10 failed, 8617 passed, 7 skipped (8634 tests). Files: 6 failed, 877 passed, 3 skipped. 649 s |
| Downstream | `pnpm check` | 2 | Script node tests: 602 tests, 601 passed, 0 failed (1 is unaccounted for in the TAP summary, probably skipped or todo). Then the `test-runner:check` typecheck failed with 32 TS errors and the recursive run stopped there. Packages after test-runner were not checked |
| Downstream | `pnpm test` | 1 | boundary-audit 6/6, real-site-policy 7/7, test-contracts 168/168, test-matrix 17/17, domain 1582/1582, agent-orchestrator 16/16, test-evidence 17/17, scenario-lab 685/685. apps/extension: 2588 tests, 2584 passed, 4 failed. The run stopped at the first failure, so packages/test-runner tests **did not run** |
| Downstream | `pnpm build` | 0 | |

### Core failures (packages/fluxiq, `pnpm test`). None are timeouts; each ran in 3 ms to 0.5 s.
I reran the 6 files once in isolation (`npx vitest run <files>` in packages/fluxiq). The same 10 failed and 64 passed, so they are deterministic, not flaky.
All paths are under `src/programs/automation-studio/runtime/`.
- `executor/tests/defensive-policy.test.ts`, "every dispatch path gets the policy... > dispatches a node only through the one seam...". First error: `AssertionError: expected [ Array(1) ] to deeply equal [ 'executor/node-execution.ts' ]`.
- `llm/tests/loop-budget.test.ts`, "an evidence loop given a budget > sends the decision the purse can pay for at $0.0738 of $0.10...". First error: `expected +0 to be 7`.
- `flow-bootstrap/generation-failure/tests/provider-refusal.test.ts`, "...carries the status, what the provider objected to, and every omission it named". First error: `TypeError: automationStudioWithoutLocators is not a function` (at llm/deepseek/refusal.ts:198).
- `flow-bootstrap/generation-failure/tests/provider-throw.test.ts`, 3 tests: "publishes the class, the cause's code and the message of a failed fetch...", "keeps the codes and drops a message carrying an authorization header" and "...a configured-looking key". First error for all three: `TypeError: runAutomationStudioLlmHarness is not a function` (test line 28).
- `tests/refuted-result/tests/carried-steps-between-rounds.test.ts`, "a Flow holding a carried Merge > is judged without the Merge...". First error: `TypeError: undefined is not a function` (at result-verification/build-test/observation.ts:91).
- `tests/refuted-result/tests/failed-step-reauthor.test.ts`, 3 tests: "is re-authored in extend mode, approved and held, re-run, and the re-run judged" gave `expected "spy" to be called 1 times, but got 0 times`. "is re-authored when the domain refused the ladder's target override" and "re-authors once: a re-run that fails at a step again is handed back failed" each gave `expected [] to have a length of 1 but got +0`.

The 'is not a function' errors suggest test mocks or exports no longer match the modules they replace (renamed or moved exports). That is a guess I did not investigate.

### Downstream failures
- `pnpm check`, packages/test-runner (`tsc -p tsconfig.json --noEmit`): 32 errors. Most are `TS2307: Cannot find module '@fluxiq-web-extension/test-evidence'`, plus some TS7006 implicit-any errors that follow from them. Examples: src/secret-keys-ui.ts(3,28), src/browser-evidence.ts and src/inspect.ts. Cause observed: `packages/test-evidence/package.json` exports `./dist/index.d.ts`, and in this fresh tree `packages/test-evidence` has no `dist/`. Nothing in `pnpm check` builds it before test-runner's typecheck. This looks like a clean-tree ordering defect in `pnpm check`, not a source type error. Not a timeout.
- `pnpm test`, apps/extension: 4 failures. None are timeouts; each ran in 0.5 ms to 486 ms.
  - `content/actions/tests/execute.test.ts` (built execute.test.mjs:4497), "a target that never appears is still reported as the page's own TARGET_NOT_FOUND, with the account beside it". Error: `attempts were unbounded or absent: 1`.
  - `content/tests/landmark-role.test.ts` (built :3114), "the context call site reports the same role the rule gives". Error: `Cannot read properties of undefined (reading 'nodeType')`.
  - Same file (built :3119), "the region call site reports the same role the rule gives, for the same elements". Error: `Cannot read properties of undefined (reading 'querySelectorAll')`.
  - Same file (built :3125), "neither call site is answering from a rule of its own". Error: `Cannot read properties of undefined (reading 'querySelectorAll')`.
  I did not rerun these.

## Not verified
- The packages/test-runner test suite. It was never reached because `pnpm test` stops at the first failing package.
- Every downstream `pnpm check` step after test-runner's typecheck, including the domain and extension typechecks.
- Whether the extension failures are flaky. They were not rerun.
- The root cause of any failure.

## Open questions or contradictions found
- Should `pnpm check` build test-evidence's dist first, or should test-runner resolve test-evidence from source? As it stands, `pnpm check` fails in any fresh tree.
- The downstream recursive runs stop at the first failure (unlike Core's `--no-bail`), so one failure hides the rest of the sweep.
