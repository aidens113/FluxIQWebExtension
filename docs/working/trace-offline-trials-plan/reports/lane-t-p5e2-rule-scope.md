# Lane T, P5e2 (t749): package-exports narrowed to its purpose (D38)

## Progress log

### 2026-10-20: tests first

I added five test cases to Core `scripts/structure-audit/rules/tests/package-exports.test.mjs`. The fixture gained:
- a runner `tsconfig.json` (include `src/**/*.ts`, exclude `src/**/tests/**`);
- a `tsconfig.test.json` with a comment, extending the first, that takes in `src/**/*.ts` and `e2e/**/*.ts`;
- a package that builds to `build/` (set by its tsconfig `outDir`);
- a package whose export target is `./out/index.js`.

I also removed the old assertion that a static relative import of `../../lib/src/index.ts` is refused.

Run against the unchanged rule, `node --test scripts/structure-audit/rules/tests/package-exports.test.mjs` printed `# tests 18`, `# pass 15`, `# fail 3`. The three failures were the new behaviour:
- `not ok 10 - any path into a package linked from outside the repository is refused, whatever it names and however it is loaded`
- `not ok 11 - a load of another workspace package's build output is refused wherever its build writes`
- `not ok 12 - a static import of a sibling workspace package's TypeScript source from a type-checked file passes`

Cases 13 (an unchecked source load is refused) and 14 (an address built beside a workspace package's entry is refused) passed before the change. They are guards that keep the narrowing from going too far. I added a 19th case later, for an unparsable tsconfig, together with its code.

### 2026-10-20: rule narrowed, mirrored, audits run

All edits are in Core under `scripts/structure-audit/` and were copied byte for byte downstream (`diff -r` and `cmp` printed nothing; the shell printed `identical`).

- `rules/package-exports.mjs`: I rewrote the header to state D38's three held cases, what is not held and why, and the two additions described in the open questions. The rule now does three new things:
  - it builds the tsconfig set, the set of type-checked files and each package's build directories once per run;
  - it reports a path site by area: `outside`, `build`, or `source`;
  - it exempts a `source` site when that site is an `import`/`export ... from` declaration in a type-checked file.
- `package-exports/package-path.mjs`:
  - for a package linked from outside the repository, any path into it is held (it used to be only `dist/` or `src/`);
  - for a workspace package, a path into any of its build directories is held, and so is a path into `src/`;
  - every other path is not reported.
- `package-exports/load-sites.mjs`: sites from import and export declarations are marked `declaration: true`.
- New `package-exports/tsconfigs.mjs`:
  - reads every `tsconfig*.json` with `ts.parseConfigFileTextToJson`, so comments are allowed;
  - follows a relative `extends` inside the repository, resolving each field against the config that wrote it;
  - throws on an unparsable config.
- New `package-exports/type-checked-files.mjs`: the `.ts`, `.tsx`, `.mts` and `.cts` files (not `.d.ts`) that some project takes in. It follows tsc's rules for `include`, `exclude` and `files`, including tsc's default exclude list.
- New `package-exports/build-directories.mjs`: `dist`; each tsconfig `outDir` inside the package; and the top directory, other than `src`, of every built `.js`, `.mjs`, `.cjs` or `.d.ts` file the manifest names. Downstream this adds `apps/extension/build`.
- `package-exports/index.mjs`: the barrel exports the three new helpers.

UNIT READY:
- Core: `scripts/structure-audit/rules/package-exports.mjs`, `scripts/structure-audit/rules/tests/package-exports.test.mjs`, `scripts/structure-audit/package-exports/{build-directories,exported-subpath,index,linked-packages,load-sites,package-path,tsconfigs,type-checked-files}.mjs`
- Downstream: the same paths.

The P5e files in this list are untracked, so they go in the same commit.

## Outcome

Done. Core is down from 5 package-exports findings to 3, and downstream from 97 to 35. Every remaining finding is in a file this task has not touched. P5d's offline-reads harness and spec are no longer held. The two experiment files are already deleted by W6, so the audit no longer lists them.

## Commands run and observed results

- Core `node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"`: `# tests 296`, `# pass 296`, `# fail 0`.
- Downstream, the same command: `# tests 296`, `# pass 296`, `# fail 0`.
- Core `node scripts/structure-audit.mjs`: exit 1. It printed `structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.` and `structure-audit: 3 violation(s) across 1 rule(s).` All 3 are package-exports. I did not identify which entry can be lowered; it is not package-exports, which has no baseline.
- Downstream `node scripts/structure-audit.mjs`:
  - The first run crashed with ENOENT in `as-never` reading `.../rebuild/core-authoring.ts`. W6 deleted the file while the run was in progress; the audit drops files that are already missing when it lists them.
  - The rerun exited 1 with `structure-audit: 36 violation(s) across 2 rule(s).`:
    - 35 are package-exports;
    - 1 is `import-cycles` in `domain/src/runtime/llm-evidence/plan-resolution/index.ts` (a cycle of 31 modules), which is another worker's file.
- Downstream `node scripts/check/core-mirror.mjs`: `core-mirror: 1 mirror set(s) match FluxIQ Core at C:\Users\osrs_\FluxStuff\fxwork\t749\!FluxIQ: structure-audit (72 files).` exit 0.
- To decide whether each finding is new, I ran `git diff --stat dev...` and `git status --short` in both trees. No file in the table below appears in either; the downstream task changes under `scripts/` are only in `scripts/structure-audit/`. In Core, `scripts/flow-compiler.mjs` was last changed on dev in `9f6d8ca1`.

## Remaining package-exports findings

| Repository | File | Line(s) | Sites | Held as | Before t749? |
| --- | --- | --- | --- | --- | --- |
| Core | `scripts/automation-studio-scale-baseline.mjs` | 6 | 1 | (3) `../packages/fluxiq/dist/.../testing/index.js` | yes |
| Core | `scripts/automation-studio-scale-certification.mjs` | 7 | 1 | (3) same | yes |
| Core | `scripts/flow-compiler.mjs` | 4 | 1 | (3) `../packages/fluxiq/dist/.../dsl/index.js` | yes |
| Downstream | `domain/src/runtime/llm-evidence/node-run/tests/arrival.test.ts` | 331 | 1 | (2) address built beside `fluxiq/automation-studio` | yes |
| Downstream | 32 root scripts loading `packages/test-runner/dist/` (listed below) | first site shown | 1-5 each, 69 total | (3) build output | yes |
| Downstream | `scripts/lab/live-campaign/selection.mjs` | 1 | 1 | source load from JavaScript: `../../../packages/test-runner/src/realistic-scenarios/index.ts` | yes |
| Downstream | `scripts/lab/scenario-guard/lab-scenario-refusal.mjs` | 9 | 1 | the same | yes |

Totals: Core has 3 files with 3 sites. Downstream has 35 files with 72 sites: 69 build-output sites in 32 scripts, 1 beside-entry site, and 2 source-from-JavaScript sites.

The 32 downstream build-output scripts are listed below with the count of sites in each and the line of the first site. Every site loads `../packages/test-runner/dist/target-config.js` unless noted.
- `scripts/` (root):
  - `apply-demo-llm-exploration-adaptation.mjs` 2 (L15), `apply-demo-llm-exploration-proposal.mjs` 2 (L16), `apply-demo-llm-exploration-request.mjs` 2 (L14)
  - `control-demo-llm-adaptation.mjs` 2 (L17)
  - `inspect-demo-llm-adaptation-readiness.mjs` 3 (L16), `inspect-demo-llm-adaptation-run.mjs` 2 (L14), `inspect-demo-llm-applied-creation.mjs` 2 (L14), `inspect-demo-llm-exploration-adaptation-readiness.mjs` 2 (L16), `inspect-demo-llm-exploration-request.mjs` 2 (L9), `inspect-demo-llm-pending-creation.mjs` 2 (L14)
  - `prepare-demo-llm-workspace.mjs` 3 (L25), `record-demo-workspace.mjs` 2 (L2)
  - `reject-demo-llm-exploration-adaptation.mjs` 2 (L13), `revert-demo-llm-applied-creation.mjs` 2 (L14), `revert-demo-llm-exploration-adaptation.mjs` 2 (L13)
  - `run-demo-llm-adaptation.mjs` 2 (L24), `run-demo-llm-applied-replay.mjs` 2 (L14), `run-demo-llm-creation-readiness.mjs` 2 (L22), `run-demo-llm-creation-settings.mjs` 2 (L22), `run-demo-llm-creation.mjs` 2 (L23), `run-demo-llm-diagnosis.mjs` 2 (L22)
  - `run-demo-llm-exploration-adaptation.mjs` 2 (L16), `run-demo-llm-exploration-baseline.mjs` 2 (L16), `run-demo-llm-exploration-request-flow.mjs` 2 (L14), `run-demo-llm-exploration.mjs` 3 (L17), `run-demo-workspace-flow.mjs` 2 (L2)
  - `setup-demo-llm-key.mjs` 3 (L21), `setup-demo-local-env.mjs` 1 (L5, loads `dist/windows-acl.js`)
  - `validate-demo-llm-exploration-adaptation.mjs` 2 (L15)
- `scripts/demo/launcher-failure.mjs` 1 (L16, loads `dist/demo-workspace/launcher/index.js`)
- `scripts/run/panel-golden-path.mjs` 5 (L14)
- `scripts/run/ui-e2e.mjs` 2 (L19)

What is no longer held:
- In Core: `apps/web/.../capabilities/tests/core-contract-world.ts` and `core-contract.test.ts`. These are static TypeScript imports of `packages/fluxiq/src`, taken in by apps/web's tsconfig.
- Downstream, 60 files:
  - all 57 `apps/extension/e2e/**` files, including `offline-reads/tests/harness-content-code.ts` and `offline-reads.spec.ts`;
  - the 3 `apps/scenario-lab/e2e/**` files.
  These are taken in by `tsconfig.test.json` and `tsconfig.e2e.json`.
- Downstream `packages/test-runner/src/offline-trial-experiment/{rebuild/core-authoring.ts,run/core-trial-seams.ts}`: these were deleted by W6, not exempted. The rule would still hold them under case (2).

## Not verified

- I did not check whether the tsconfigs the rule finds are the ones a check script actually runs. Any tsconfig in the repository counts as type-checking the files it takes in.
- `extends` that names a package (rather than a relative path) contributes nothing. Neither repository uses one for `include` or `outDir` today.
- I did not run `pnpm check` or any typecheck, because no TypeScript changed. I did not adopt a baseline, as the brief said.

## Open questions or contradictions found

1. D38 lists exactly three held cases. It then exempts only *static declarations from type-checked files*. I held loads of another workspace package's `src/` that tsc does not check: a dynamic import or require, or any load from JavaScript or from a file no tsconfig takes in. The exemption's wording and the rule's purpose ("nothing checks that dependency") point that way. This holds 2 downstream lab scripts that do `import(".../test-runner/src/realistic-scenarios/index.ts")` from `.mjs`. If D38 is meant as an exhaustive list, the change is to drop the `source` area in `package-path.mjs`; test 13 encodes the current choice.
2. A bare specifier `<package>/<subpath>` that a workspace package's exports do not name is still held, for every linked package, not only for packages linked from outside the repository. Node refuses such a specifier at run time with `ERR_PACKAGE_PATH_NOT_EXPORTED`. It currently produces no finding in either repository.
3. Core's audit prints "1 baseline entries can be lowered". This is not from package-exports; I did not run `pnpm structure:baseline`.
