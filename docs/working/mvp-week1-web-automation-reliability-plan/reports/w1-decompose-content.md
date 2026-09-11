# Report: w1-decompose-content

Brief: `briefs/wave-1.md`, section `Brief: w1-decompose-content` (Phase 1.1 step 1).

## Outcome

**Partial.** The decomposition is done and every moved body is proven unchanged
(44/44 AST checks; the emitted content-script bundle differs only in the
dispatcher). The structure audit passes, and so does the smoke test. Two items
in the definition of done are **blocked by another worker's in-flight edit, not
by this change**:

- `pnpm --filter @fluxiq-web-extension/extension check` fails.
- `pnpm --filter @fluxiq-web-extension/extension build` fails at its tsc step.

Both fail on one error, in `domain/src/client/gateway-mapping.ts`, which
`w1-domain-mappings` owns. I ran check three times over the session and got the
same error each time. The error is not in any content file. A tsc run scoped to
`src/content/**` passes (exit 0).

## What changed and why

Deleted `apps/extension/src/content/actions.ts` and
`apps/extension/src/content/action-runtime.ts`. Created the two directories
below. `message-handler.ts` is unchanged: `./action-runtime` now resolves to the
barrel, so no import line needed editing. `action-runtime/execute-action.ts`
imports `../actions`, which resolves to the `actions/` barrel.

### `content/actions/` (13 files)

| File | Holds | Old location (`actions.ts`) |
| --- | --- | --- |
| `index.ts` | Barrel. Same surface as before: type re-exports of `BrowserActionCommand`, `BrowserActionResult`, `DomElementDescriptor`, `DomSnapshot`, `RectDescriptor` (from `../types`), plus `ContentActionDependencies` and `executeContentAction` | 15-21 |
| `types.ts` | `ContentActionDependencies`, which every verb file shares | 23-35 |
| `execute.ts` | `executeContentAction` dispatcher. `startedAt`, try/catch, all ten `if` conditions including the legacy dotted aliases, and the unsupported-type throw are verbatim | 37-102 |
| `capture-snapshot.ts` | `captureSnapshotAction` | 40-42 body |
| `wait-for-selector.ts` | `waitForSelectorAction` (async) | 43-46 body |
| `wait-for-text.ts` | `waitForTextAction` (async) | 47-50 body |
| `extract.ts` | `extractAction` | 51-55 body |
| `click.ts` | `clickAction` | 56-61 body |
| `type.ts` | `typeAction` | 62-68 body |
| `clear.ts` | `clearAction` | 69-75 body |
| `select.ts` | `selectAction` | 76-82 body |
| `scroll.ts` | `scrollAction` | 83-90 body |
| `keypress.ts` | `keypressAction` | 91-97 body |

Each verb function has the signature
`(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number)`.
Its body is the old branch body, unchanged. The dispatcher calls it as
`return <verb>(action, deps, startedAt)`.

The two waits are called as `return await <verb>(…)`. This is load-bearing. The
old code awaited inside the try block, so a rejected wait reached the catch and
became `deps.failure(...)`. A returned-but-not-awaited promise would settle
after the try block exits, and the rejection would escape the catch. A comment
in `execute.ts` records this. The only cost is one or two extra microtask
ticks before the outer promise settles; the result value and `finishedAt` do
not change.

### `content/action-runtime/` (10 files)

| File | Holds | Old location (`action-runtime.ts`) |
| --- | --- | --- |
| `index.ts` | Barrel. Same surface as before: `captureSnapshotForResponse`, `executeAction`, `actionFailure` | n/a |
| `capture-snapshot-for-response.ts` | `captureSnapshotForResponse` | 24-28 |
| `execute-action.ts` | `executeAction` (the dependency wiring) | 30-44 |
| `results.ts` | `actionFailure` and `success`, a cohesive pair of result builders | 46-59, 107-130 |
| `resolve-target.ts` | `resolveTarget`, plus private `pointFromVisualTarget` and `centerPoint` | 61-105 |
| `waits.ts` | `waitForElement` and `waitForText`, a cohesive pair | 147-182 |
| `input-events.ts` | `dispatchInputEvents` | 142-145 |
| `set-element-value.ts` | `setElementValue` | 136-140 |
| `scroll-element-into-view.ts` | `scrollElementIntoView` | 132-134 |
| `extract.ts` | `extractElement` | 184-190 |

The brief suggested five names. I kept `resolve-target.ts`, `waits.ts`,
`results.ts`, `input-events.ts` and `extract.ts`, and added four files so that
each file exports one thing, or one cohesive group:
`capture-snapshot-for-response.ts`, `execute-action.ts`, `set-element-value.ts`
and `scroll-element-into-view.ts`. `setElementValue` did not go into
`input-events.ts` because it is not an event.

### Other notes

- **Exports.** The only code-level change to moved functions is an added
  `export` on helpers that were private and now live in their own sibling files.
  Neither barrel exports them; siblings import each other directly.
- **Header comments.** Rewritten to name the new paths. The old sentence on
  resolution order moved to `resolve-target.ts`.
- **Placement.** Both directories sit at depth 6. No filename prefix group
  reaches 3 (`wait-` has 2). There are 13 and 10 source files, both under the
  15-file advisory threshold. `content/` drops from 19 to 17 source files.

## Commands run and observed results

1. **Pre-edit audit.** `node scripts/structure-audit.mjs` printed
   `structure-audit: passed (27 warning(s), 19 baselined).` Nothing under
   `content/` is baselined.
2. **Package check.** `pnpm --filter @fluxiq-web-extension/extension check`,
   run three times, exited 2 each time with the single error
   `../../domain/src/client/gateway-mapping.ts(4,10): error TS2305: Module '"../io/input-model"' has no exported member 'webAutomationEventTypeForClientKind'.`
   Both files belong to `w1-domain-mappings`. There were no errors in any
   content file.
3. **Package build.** `pnpm --filter @fluxiq-web-extension/extension build`
   exited 2 at `tsc -p tsconfig.json --noEmit`, with the same error.
   `build-extension.mjs` never ran, so I did not regenerate the tracked
   `apps/extension/build/`.
4. **Smoke test.** `pnpm --filter @fluxiq-web-extension/extension test` printed
   `Extension smoke test passed.` and exited 0.
5. **Scoped tsc.** `apps/extension/node_modules/.bin/tsc -p <scratch>/tsconfig.content-only.json`
   exited 0. The config extends `apps/extension/tsconfig.json` and includes
   only `src/content/**/*.ts`. `--listFilesOnly` showed 40 non-library files,
   all under `src/content/`; content imports nothing outside itself.
6. **Audit, real index.** `node scripts/structure-audit.mjs` printed
   `passed (27 warning(s), 19 baselined)`. Its only content warning was
   `apps/extension/src/content/: 17 source files is past the 15-file advisory threshold`
   (it was 19 before the change).
7. **Audit, scratch index.** The audit reads `git ls-files`, so it cannot see
   untracked new files. I copied `.git/index` into my scratchpad, then used that
   copy as `GIT_INDEX_FILE` to `git add` both new directories and
   `git rm --cached` the two old files. The real index is untouched. The audit
   then printed the same `passed (27 warning(s), 19 baselined)`, with 40 content
   files tracked and **no finding for any file in `actions/` or
   `action-runtime/`**.
8. **Lowerable baseline entry (for the supervisor).** Both audit runs printed
   `1 baseline entries can be lowered`. From `--json`:
   `imports domain/src/client/index.ts recorded 2 -> now 1`. That comes from
   another worker's domain edit, not from this change. I did not run
   `pnpm structure:baseline`.
9. **Moved-body check.** `node <scratch>/verify-moved-bodies.mjs` compared the
   HEAD originals with the new files by TypeScript AST, whitespace-normalized.
   Result: **`44/44 checks SAME, 0 DIFF`**. It covered:
   - all 13 `action-runtime.ts` functions, identical once the leading `export`
     is stripped; none added or dropped;
   - both barrels' exported name and kind sets, equal to the old modules;
   - the `executeContentAction` signature, the `startedAt` statement, the catch
     clause, and the throw;
   - all 10 branch conditions, identical;
   - each branch body against its verb function body: identical, arguments
     exactly `action, deps, startedAt`, and async-ness and `await` matching the
     old body's use of `await`;
   - every verb dispatched exactly once;
   - the `ContentActionDependencies` text.

   The script also prints a line-by-line accounting. The only lines that differ
   are header comments, import paths (`./x` → `../x`), the added `export` on
   declaration lines, verb signatures, and the dispatcher's `return` calls.
10. **Bundle comparison.** `node <scratch>/compare-bundles.mjs` ran esbuild,
    with the options `build-extension.mjs` uses, on two scratch copies of
    `src/content`. The first is HEAD. The second is HEAD with only this change
    applied, so the other workers' in-flight `dom-events.ts` edits are excluded.
    - **Method check.** The HEAD-tree bundle matches the committed
      `build/content/index.js` except for its first line: `diff` printed only
      `1d0 < "use strict";`. The real build takes that line from the package
      tsconfig; the scratch tree has none, and the gap applies to both trees
      equally.
    - **Functions.** 89 top-level functions before, 99 after, with 88
      identical. The only new ones are the 10 verb functions. The only changed
      one is `executeContentAction`, whose inlined bodies became calls.
    - **Evaluation order.** The 30 non-function top-level statements, which
      carry module evaluation order and every module-level side effect, are in
      an **identical** sequence.

## Not verified

- Whether package-level `check` and `build` pass. Both are blocked by the domain
  error described above. The supervisor should rerun both once
  `w1-domain-mappings` has landed.
- The tracked `apps/extension/build/` output. I did not regenerate it, because
  the build stopped at tsc. The working tree already shows
  `apps/extension/build/*` modified by another worker's build.
- `test:e2e`, including `e2e/action.spec.ts`, which exercises
  `capture_snapshot`, `type` and `click` through the real content-script
  message path. It needs a full build, which is blocked, and it is not in my
  definition of done.
- Live browser behaviour in general.
- The microtask-timing note on `return await` is reasoned, not measured.

## Open questions or contradictions found

1. **Audit blind spot.** A plain `node scripts/structure-audit.mjs` cannot see
   untracked new files, so it cannot prove "no new finding" for a new directory
   until it is staged. The supervisor should rerun the audit after `git add`.
   The scratch-index run above is my substitute.
2. **Stale line anchors.** Working documents cite old line anchors:
   `content/actions.ts:NN` and `content/action-runtime.ts:NN` in the audit
   reports under this effort, in the plan itself, and in
   `docs/working/extension-runtime-capabilities-plan.md` and
   `docs/working/module-size-governance-plan/reports/ext-content.md`. The two
   tables above map old line ranges to new files for later briefs. I edited no
   shared document.
3. **Naming.** `actions/type.ts` (the type verb) sits next to `actions/types.ts`
   (the shared dependency type, placed by the rule that "types shared across a
   directory live in its `types.ts`"). If the adjacency reads badly,
   `types.ts` → `dependencies.ts` is a one-line barrel change.
4. **Environment note.** In this environment, Bash commands containing several
   heredocs failed at parse time with ``unexpected EOF while looking for matching `''``
   even though every single heredoc worked, so I wrote the new files with the
   Write tool.
