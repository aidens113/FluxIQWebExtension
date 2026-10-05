# t263-domain report

## Outcome

Done. All four units are ported onto `fxwork/t263/!FluxIQWebExtension` (uncommitted). The changed tests pass, both domain typechecks pass, and the domain build exits 0.

## What changed and why

All paths are under `domain/src/runtime/llm-evidence/`.

- **A8 consent closer (t174).** `node-run/covered-target.ts` and its test. Neither file had changed since base `45bd6232`, so the lane diff applied as is. On a consent layer, the named closers are now the least-consent answers first, then plain closers, and never an accept/agree control. Other layers keep their existing behaviour.
- **C w86 `maxPages` beside `paginate` (t194).**
  - `plan-resolution/extraction/slot.ts` and its test applied cleanly (`liftedBounds`, `BOUND_INSIDE_PAGINATE`, and a refusal that carries `also` and `expected`).
  - `plan-resolution/resolve-plan-node.ts` had one 3-way conflict, in the `Resolved` type. I kept t262's `statePath?: string` and took the lane's wider `Refusal` comment.
  - The lane's two new issue codes, and the `fits: slot.expected` / `also` refusal push, merged cleanly. `resolve-plan-node.test.ts` merged cleanly.
- **C w75 one missing key (t194).**
  - `tool-rejection.ts` (doc comment) and `tests/tool-rejection-detail.test.ts`.
  - The behaviour itself is a one-line hunk in `node-run/run.ts`: `missing: ["consequences"]` on the unwritten-consequences refusal. Its test `node-run/tests/unwritten-consequences.test.ts` asserts `missing`.
  - The brief's owned files list `tool-rejection.ts` only, but `run.ts` is mine and that test is `run.ts`'s, so I ported both. The Lab recorder part was not touched.
- **B F8 own layers are not interruptions (t193).**
  - New module `node-run/own-layers/` (`index.ts`, `memory.ts`, `tests/memory.test.ts`), copied from t193. It is LF and new on `dev`.
  - Plus `press-effect/answered-layer.ts` (an optional `own` predicate) and its test, `node-run/context.ts` (a `layers` field on `WebNodeRun`), `node-run/index.ts` (export), and `tools.ts` (creates `createWebNodeOwnLayers()` and passes `layers`).
  - `node-run/tests/draft-control.test.ts` took the lane's added tests, merged cleanly onto t262's version.
  - `node-run/run.ts` had one conflict, on t262's toggle hunk. I kept t262's `written: undefined, toggle: webPressToggle(...)` and replaced the inline interruption expression with the lane's precomputed `interruption`, which excludes layers this build opened. The `run.layers.opening` and `run.layers.pressed` hunks merged cleanly.

`git apply --3way` staged the files it touched. I ran `git restore --staged` on my paths only, so the index is back to HEAD for my files.

## Commands run and observed results

- `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 1, but only from the Core freshness guard (`scripts/check/core-build.mjs`). Its message: "FluxIQ Core's build ... is 4 minute(s) behind its source. Stale: ...llm/node-tools/replay-span.ts". That file belongs to the t263-core worker, who is editing Core at the same time. My units touch no Core file, so I ran the same tsc steps directly:
  - `npx tsc -p tsconfig.json --noEmit` (in `domain`): exit 0.
  - `npx tsc -p tsconfig.test.json` (noEmit): exit 0.
- `node run-subset.mjs <domain> t263-domain` on the 8 changed test files, then `node --test`: tests 83, pass 83, fail 0.
- The same runner on every test in `node-run/tests` (except `replay.test.ts`, which the other worker owns), `node-run/press-effect/tests` and `plan-resolution/tests`: tests 270, pass 270, fail 0. This covers t262's `press-toggle` and `plan-step-permission` tests alongside the merged files.
- `pnpm.cmd --filter @fluxiq-web-extension/domain build`: exit 0 (`domain:build`, 55 s, "inputs changed: core:packages/fluxiq/src, domain").

## Not verified

- The full `domain check` script did not pass its guard. It needs to be re-run after Core is rebuilt once t263-core finishes.
- The typecheck and build ran against a tree that also holds the t263-tabs-assert worker's in-progress edits, and against Core's current (stale) dist.
- I did not run the structure audit, even though the new `own-layers/` directory has a barrel.
- None of this has been proven live: the A8 closer order, the F8 own-layer exemption and the w86 lift have no Lab or browser run.
- I did not run the tools.ts test suite as a whole. The tools.ts change only passes `layers` through.

## Open questions or contradictions found

- The brief scopes w75 as "`tool-rejection.ts` part only", but in t194 that file has only a doc comment. The behaviour lives in `node-run/run.ts` (owned), so I ported it there with its test `unwritten-consequences.test.ts`.
