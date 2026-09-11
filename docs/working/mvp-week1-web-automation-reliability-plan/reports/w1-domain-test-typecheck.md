# Report: w1-domain-test-typecheck

## Outcome

Done. `pnpm --filter @fluxiq-web-extension/domain check` now type-checks
every `domain/src/**/tests/*.test.ts` as well as the source, and it passes.
A deliberate type error in a test fails it. The labelled domain test run
still passes 26 of 26, plus the smoke script. I fixed all 22 errors in test
files. No test exposed a real type defect, so no source file changed.

## What changed and why

- **`domain/tsconfig.test.json`** (replaced). The old file set
  `outDir: ".test-build"` and `include: ["src/**/*.ts"]`, but it inherited
  `exclude: ["src/**/tests/**", ...]` from `tsconfig.json`. It therefore
  covered no tests at all, and running it without `--noEmit` would have
  written into the tracked `.test-build/`. The new file sets
  `"noEmit": true` and keeps `include: ["src/**/*.ts"]`. It overrides
  `exclude` with `[".test-build", ".test-build-scratch", "dist"]`, which
  drops only the tests exclusion.
- **`domain/package.json`**: `check` is now
  `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`. The
  source-only pass stays first. It checks the source with no test files in
  the program, so source cannot come to depend on test-only code without
  failing.
- **Moved** `domain/src/actions/tests/safety.test.ts` to
  `domain/src/tests/safety.test.ts`. The file was untracked, so I used a
  plain move. The four imports now point to `../actions/safety`,
  `../actions/types`, `../io/manifest-definitions` and `../output-nodes`,
  in alphabetical order. The body is unchanged. I removed the empty
  `actions/tests/` directory. The audit's `test-placement` rule only
  requires a `tests`/`e2e` parent, so this location is valid.
- **Errors fixed** (22, all in test files):

| File | Line(s) | Error | Fix |
| --- | --- | --- | --- |
| `recording/tests/web-state.test.ts` | 92 | TS2339 `statePath` not on `StateVisualLayer`; the `image` and `text` members lack it | Bound the found layer to `saveScreenLayer` and narrowed with `"statePath" in saveScreenLayer`. Line 93's duplicate `find` reuses it. |
| same | 112, 113, 114, 116, 137, 138, 139, 160 (8) | TS2532: `bounds` is optional on `text`/`element` layers | `?.bounds.` became `?.bounds?.`. An absent `bounds` still fails the assertion, because `undefined` never equals the expected number. |
| same | 140 | TS2339 `.x` on `JsonValue`; frame `metadata` is `JsonObject` | Cast `frameViewportOffset` to `{ x?: number } \| undefined`, the file's existing pattern (line 88). |
| `runtime/tests/llm-evidence.test.ts` | 3 | TS5097 `"../index.ts"` specifier | Changed to `".."`, matching every other test's extensionless barrel imports. I chose this over enabling `allowImportingTsExtensions`. |
| same | 97, 122, 135, 141 (4) | TS2322: the `snapshot()` helper returned `unknown`, but `ClientActionResult.payload` is `JsonObject` | The helper now returns `JsonObject` (`import type` from `fluxiq/core`), and its literal is valid JSON. The source contract is correct: gateway payloads are JSON. |
| `runtime/tests/reusable-evidence-coordinator.test.ts` | 3 | TS5097 | `"../index.ts"` became `".."`. |
| `runtime/tests/reusable-evidence.test.ts` | 3 | TS5097 | `"../index.ts"` became `".."`. I changed the line 4 `import type` too, for consistency; tsc had not flagged it. |
| `tests/domain.test.ts` | 156 | TS18048: `event.payload` possibly undefined; Core's `ClientGatewayRecordingEvent.payload` is optional | `event.payload?.visualTarget` |
| same | 246, 297 (2) | TS2345: `tags: ["generation"]` widens to `string[]`, but `AutomationStudioFlowInstruction.tags` is `AutomationStudioInstructionTag[]` | `"generation" as const`, the object's existing `as const` pattern. One edit fixes both calls, which spread the same input. |
| same | 272, 273 (2) | TS2322/TS2345: `evidenceCompletionSchema.properties.plan` was `unknown` (cast through `Record<string, unknown>`), so it was not `JsonObject` | Read `plan` through `JsonObject \| undefined`. `assert.ok(bootstrapPlanSchema !== undefined, "the bootstrap output schema defines plan")` narrows it. The schema is annotated `JsonObject`, with `import type { JsonObject } from "fluxiq/core"`. This adds one assertion: a missing `plan` now fails by name instead of silently becoming an `undefined` schema member. |

Source files changed for a type defect: none.

## Commands run and observed results

All were run from `F:\!FluxIQWebExtension` unless noted.

1. Baseline, before any edit:
   `DOMAIN_TEST_BUILD_LABEL=w1-domain-test-typecheck pnpm --filter @fluxiq-web-extension/domain test`
   exited 0 with `# tests 26`, `# pass 26`, `# fail 0` and
   `Web automation domain smoke test passed.`
2. Baseline: `pnpm --filter @fluxiq-web-extension/domain check`, then
   `tsc -p tsconfig.json --noEmit`, exited 0.
3. The new config before any fixes, run in `domain/`:
   `npx tsc -p tsconfig.test.json` exited 2 with 22 `error TS` lines,
   listed in the table above.
4. After the fixes: `pnpm --filter @fluxiq-web-extension/domain check`
   printed `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`
   and exited 0 with no diagnostics.
5. After the fixes, with my label's scratch directory deleted first:
   `DOMAIN_TEST_BUILD_LABEL=w1-domain-test-typecheck pnpm --filter @fluxiq-web-extension/domain test`
   exited 0 with `ok 1` … `ok 26`, `# tests 26`, `# pass 26`, `# fail 0`.
   It printed `Web automation domain smoke test passed.` and the four
   script-style `... tests passed.` lines. The moved safety tests ran as
   `ok 25` and `ok 26`.
6. Deliberate-error probe. I appended
   `const w1DomainTestTypecheckProbeOne: number = "not a number";` to
   `src/tests/safety.test.ts`, and the same with `...Two` to
   `src/recording/tests/web-state.test.ts`.
   - `npx tsc -p tsconfig.json --noEmit` exited 0, so the old check misses
     the error.
   - The new domain check exited 2 with
     `src/recording/tests/web-state.test.ts(166,7): error TS2322: Type 'string' is not assignable to type 'number'.`
     and `src/tests/safety.test.ts(44,7): error TS2322: ...`.
   - I restored both files from backups. The sha256 hashes matched (the
     script printed `REVERTED: hashes match`), grep found 0 probe lines,
     and the check exited 0 again.
7. `node scripts/structure-audit.mjs` exited 0 and printed
   `structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.`
   and `structure-audit: passed (27 warning(s), 19 baselined).`
   `--json` names the entry as
   `{"rule":"imports","key":"domain/src/client/index.ts","value":1,"recorded":2}`,
   with `failures: []`. This is the same entry w1-domain-registry reported,
   and my changes did not cause it. I did not run `pnpm structure:baseline`.

## Not verified

- I did not run root `pnpm check`, `pnpm test` or `pnpm build`. Other
  workers are editing other packages, and the brief names only the domain
  commands.
- The structure audit reads only tracked files, so it has not seen the
  untracked `domain/src/tests/safety.test.ts`. The supervisor audits it at
  integration.
- I did not run the unlabelled domain test, which writes the tracked
  `.test-build/`; that directory is off-limits to me.
- I did not check editor behaviour. Editors attach test files to the
  nearest `tsconfig.json`, which excludes them, so in-editor diagnostics for
  tests may use inferred defaults rather than `tsconfig.test.json`.

## Open questions or contradictions found

1. **Error count.** The brief cites 15 errors counted by w1-domain-mappings.
   Before any edit, I observed 22 with the new config (item 3). The
   difference may come from later edits by other workers or from a
   different way of counting. All 22 are fixed.
2. **The w1-domain-registry type-check was vacuous.** Its report says
   `npx tsc -p tsconfig.test.json --noEmit --allowImportingTsExtensions`
   gave 0 errors. The old `tsconfig.test.json` inherited the
   `src/**/tests/**` exclusion, so that command checked no tests and should
   not be counted as test type-check evidence.
3. **Stale tracked output.** The tracked `domain/.test-build/` holds
   tsc-emitted `.js` under paths like
   `domain/.test-build/!FluxIQ/packages/...`. It looks like output of the
   old emitting `tsconfig.test.json`, which is now `noEmit`, so nothing
   produces that tree any more. There is no stale
   `.test-build/actions/tests/` bundle. The supervisor may want to decide
   whether the tree should stay tracked. I did not touch it.
4. **Test filename.** The moved test keeps its name, `safety.test.ts`, as
   the brief states. There is no `src/safety.ts`, so a name such as
   `action-safety.test.ts` might read more clearly in `src/tests/`. The
   audit does not check test names.
5. **Existing formatting in `domain/src/tests/domain.test.ts`.** Two
   statements are joined on one line in two places:
   `...<= 3_000 * 4, true);const bootstrapHarnessInput = {` and
   `...includes("choose"), true);let incompleteProviderCalls = 0;`. These are
   not type errors, and I left them alone.
6. **Stale path references.** The working document's `Current State`
   ("Not done: ... move `domain/src/actions/tests/safety.test.ts`") and the
   w1-domain-registry report still name the old path. I did not edit either
   file, since both are shared documents.
