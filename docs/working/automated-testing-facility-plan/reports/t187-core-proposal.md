# t187-core-proposal: why Core's build and check are slow, and what to change

Worker report. Core was only read, at `C:/Users/osrs_/FluxStuff/!FluxIQ` HEAD `c4d6628`. The brief's baseline was measured at `af385f7`; the scripts and configs quoted below are the ones at `c4d6628`. Nothing in Core was edited, built, installed or profiled.

## Outcome

Partial. All four costs are explained from the source, and each has a concrete proposed change. The structure-audit CPU profile was **not** run: the brief allowed it only while `C:/Users/osrs_/FluxStuff/lab-slots/slot-1` was absent, and `ls` showed `slot-1` present. So the audit's hot spots below are worked out from reading the code, not measured.

## What changed and why

Only this report file was written.

### 1. `tsc -b tsconfig.build.json --clean && tsc -b tsconfig.build.json` (the three packages)

**Where it is.** The `build` script in `packages/{contracts,fluxiq,client-gateway-websocket}/package.json` is:
`tsc -b tsconfig.build.json --clean && tsc -b tsconfig.build.json && node ../../scripts/rewrite-declaration-imports.mjs dist`.
Each `tsconfig.build.json` sets `tsBuildInfoFile: "tsconfig.build.tsbuildinfo"`, which exists on disk and is covered by `.gitignore` `*.tsbuildinfo`.

**What it redoes needlessly.** `tsc -b` exists to skip a project that is already up to date, using its `.tsbuildinfo`, and to re-check and re-emit only the files a change affects. `--clean` deletes the outputs and the buildinfo first. Every build is therefore a full cold type-check and emit of the whole program. That is the `fluxiq` 21 s, plus about 3 s each for contracts and client-gateway-websocket, even when nothing changed.

**Why the clean was added.** No comment says. `git log -S'--clean'` on the three manifests finds one commit, `6368574` (2026-08-06, "Did first 4 points of refactoring plan. Save before continuing"). That commit also:
- switched `exports` from `src/*.ts` to `dist/*`;
- added `files: ["dist", ...]`;
- created `tsconfig.build.json`.

`docs/working/codebase-audit-remediation-plan.md` and `docs/architecture/package-boundaries.md` never mention `--clean` or stale output. The likely reason, which I inferred and did not find written anywhere: tsc never deletes the output of a source that was deleted, renamed, or newly excluded. Two cases matter here:
- `files: ["dist"]` would ship those orphaned `.js`/`.d.ts` files in the tarball.
- The `exclude` later changed from `src/**/*.test.ts` to `src/**/tests/**`, which would leave old test output behind in `dist`.

**Risk of dropping the clean.**
- (a) **Orphaned outputs.** They stay in `dist` after a delete or rename. `exports` names explicit subpaths only (there is no `"./*"`), so an orphan cannot be imported through the package map. But it is packed, and a relative import inside `dist` could still reach it.
- (b) **The post-emit rewrite.** `rewrite-declaration-imports.mjs` rewrites `.d.ts` files after tsc emits them. It is idempotent: it only turns `./x.ts"` into `./x.js"`, and it runs over the whole of `dist` every time. So an incremental emit of a few files ends in the same bytes as a clean emit. Whether TS 5.9.3's `tsc -b` up-to-date check is disturbed by the rewrite's mtime change is not verified (see Not verified).
- (c) **A missing `dist` with a surviving buildinfo** could make `tsc -b` say "up to date" with no output.

**Proposed change** (per package, same text in all three):

```json
"build": "node ../../scripts/prune-build-outputs.mjs --before && tsc -b tsconfig.build.json && node ../../scripts/rewrite-declaration-imports.mjs dist && node ../../scripts/prune-build-outputs.mjs --after",
"build:clean": "tsc -b tsconfig.build.json --clean && tsc -b tsconfig.build.json && node ../../scripts/rewrite-declaration-imports.mjs dist"
```

The new `scripts/prune-build-outputs.mjs`, about 40 lines, has two modes:
- `--before`: deletes `tsconfig.build.tsbuildinfo` when `dist/index.js` is missing. This closes risk (c).
- `--after`: deletes every `dist/**/*.{js,d.ts,js.map,d.ts.map}` with no matching `src/**/*.{ts,tsx}` that the project's `include`/`exclude` still covers. This closes risk (a). A cheaper equivalent is to delete any `dist` file that tsc's `--listEmittedFiles` did not account for, but that needs a full emit, so the source-mirror check is the right one.

Root `package:validate` calls `build:clean` through a new root `build:release` script, so the release gate stays cold-built exactly as today.

**Estimated saving.** When nothing changed: `fluxiq` 21 s to about 1-2 s (the buildinfo up-to-date check), and the other two 3 s to under 1 s each. That is about 22-24 s of the 162 s. When one file changed, only the affected files are re-checked and re-emitted, typically a few seconds.

**Why it stays as strict.** `tsc -b` re-checks any file whose content hash, or whose dependencies' declaration signature, changed. It keeps the semantic diagnostics of unchanged files and reports them again, so the error set is the same as a cold build. The prune step makes `dist` equal the set a clean build emits. The release path keeps the cold build.

### 2. `next build --turbopack` on every root `build` (98 s)

**Where it is.** Root `build` ends with `pnpm --filter @fluxiq/web build`, and `apps/web/package.json` has `"build": "next build --turbopack"`. Next is 15.5.24 (`apps/web/node_modules/next/package.json`). `apps/web/next.config.ts` is `{ transpilePackages: ["fluxiq"] }` and sets no build cache.

**What it redoes needlessly.** Nothing checks whether the web inputs changed. A no-op run still does a full production compile, and Next's own "checking validity of types" pass runs as well. That pass repeats `apps/web`'s `tsc --noEmit` from `pnpm check`. Through `tsconfig.base.json` `paths`, it also type-checks `packages/fluxiq/src` and `packages/contracts/src` again. The downstream Lab already avoids this. `packages/test-runner/src/core-web-build/` in fxwork/t187 builds its key from:
- the whole `apps/web` tree;
- `tsconfig.base.json` and `pnpm-lock.yaml`;
- each built package's `dist` and `package.json`;
- the generated `next.config` and the Next version (`BUILD_LAYOUT_VERSION = 2`, in `key.ts`/`inputs.ts`).

It reuses a published build when the key matches.

**Proposed change.**
- Root `build`: replace `pnpm --filter @fluxiq/web build` with `node scripts/build-cache/cli.mjs web:build -- next build --turbopack`, run in `apps/web`. Alternatively, add a small `scripts/web-build-stamp.mjs` wrapper.
- The key is a SHA-256 over:
  - every tracked or untracked-not-ignored file under `apps/web`, minus `e2e/` and `**/tests/**`;
  - `tsconfig.base.json`, `pnpm-lock.yaml` and `apps/web/node_modules/next/package.json` `version`;
  - `packages/fluxiq/src/**` and `packages/contracts/src/**`, because `paths` points the bundler at the sources;
  - `packages/*/package.json`;
  - `packages/client-gateway-websocket/dist/**`, which has no `paths` entry and so resolves through `node_modules` to `dist`;
  - `process.version`, `NODE_ENV` and every `NEXT_PUBLIC_*` variable.
- The stamp goes in `apps/web/.next/fluxiq-build-stamp.json`. The step is skipped only when the stamp key matches and `.next/BUILD_ID` exists. A failed build writes no stamp.

**Estimated saving.** About 97 of the 98 s when the web inputs are unchanged. Hashing about 17 MB takes roughly 0.3-1 s. A Core change that touches only docs, scripts or tests reuses the build.

**Why it stays as strict.** When any input byte differs, the full `next build` runs, including its type and lint pass. Skipping happens only for identical inputs, where the output and its diagnostics would be identical. The one way this could go wrong is an input the key does not list. Hashing whole trees, rather than a hand-picked list, is what makes that unlikely. The downstream key uses the same coarse approach and has a `prove-inputs.mjs` guard.

**Optional, separate decision.** `next.config.ts` could set `typescript: { ignoreBuildErrors: true }`, but only if every gate runs `pnpm check` before `pnpm build`. The `apps/web` `tsc --noEmit` check is the same check. I do **not** recommend it without that ordering guarantee, because `pnpm build` alone would then stop type-checking the web app.

### 3. `tsc --noEmit` checks without `--incremental`

**Where it is.** `check` is `tsc --noEmit` in all four packages. `packages/{fluxiq,contracts,client-gateway-websocket}/tsconfig.json` have no `incremental`. `apps/web/tsconfig.json` already has `"incremental": true`, and `apps/web/tsconfig.tsbuildinfo` exists, so the web check is already incremental.

**What it redoes needlessly.** The three package checks build and fully check the whole program every time. That is `fluxiq`'s 21 s.

**Proposed change.** Following the downstream `checkProject()` in `scripts/build-cache/steps.mjs`, with the buildinfo kept out of the source tree and away from the build's own buildinfo:

```json
"check": "tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/tsc/check.tsbuildinfo"
```

The same text goes in all three packages. Adding `"incremental": true` plus `"tsBuildInfoFile"` to each `tsconfig.json` would also work, but `tsconfig.build.json` extends `tsconfig.json`, so that would leak into the build. The flag form avoids that.

**Estimated saving.** `fluxiq` check 21 s to about 2-3 s when nothing changed, and a few seconds after a small edit. Contracts and client-gateway-websocket save about 2 s each. Roughly 20-25 s of the 45-90 s.

**Why it stays as strict.** An incremental `--noEmit` program stores each file's semantic diagnostics keyed by file version. It re-checks a file whenever the file, or a dependency's signature, changes, and it re-reports the diagnostics it kept. The buildinfo records the TS version and the compiler options, and a change to either discards it. Program `.d.ts` files, including those in `node_modules`, are versioned too. The set of errors is the same as a cold run.

### 4. The structure audit (8.5 s idle, 43 s under load)

**How it runs** (read, not profiled):
- There is **one** git spawn in total: `git ls-files -z --cached --others --exclude-standard` in `repository-files.mjs`. It returns 2,875 paths. No rule spawns git.
- Then one `statSync` per path, 2,875 synchronous stats, which are slow on Windows while antivirus is scanning.
- `createContext` caches every read and every parse. `ctx.read` and `ctx.parse` memoize by path, so no file is read or parsed twice.
- The parse is `ts.createSourceFile(..., setParentNodes = true)`. It runs over about 2,598 script files totalling about 16.7 MB. Parent nodes are needed, because `failure-as-empty` walks `clause.parent`.
- Eight rules each do their own full AST walk of the files they audit: class-methods, contract-spread, exported-values, facade-dispatch, failure-as-empty, imports, swallowed-failure and web-vocabulary. facade-dispatch walks up to three times.
- For each facade, facade-dispatch re-scans the whole `ctx.scriptFiles` list twice with `startsWith`. That is O(facades × files) string work over cached parses: cheap, but wasted.
- web-vocabulary runs `termsIn()`, which splits a word and loops over all terms, for every identifier and string-literal key under `packages/`.
- `swallowed-failure.hasMarker` re-walks each candidate handler.
- Everything is synchronous and single-threaded.

**What dominates** (inferred): the TypeScript parse of 16.7 MB plus about ten full AST traversals. Both are pure CPU on one core, which explains why the run goes from 8.5 s to 43 s when the machine is contended. The `typescript` module load (about 0.5 s) and the stats (about 0.3-1 s) come next. Every run redoes all of it, even when no audited file changed.

**Proposed change, in order of payoff.**

**(a) Whole-run result cache** in `scripts/structure-audit.mjs`, check mode only, not `--update`, `--adopt` or `--list`.
- The key is a SHA-256 over:
  - the sorted `ctx.files` list, since cross-file rules depend on the file set;
  - the bytes of every listed file, which costs about 0.2 s to read and hash against several seconds to parse;
  - every file under `scripts/structure-audit/**` and `scripts/structure-audit.mjs`;
  - `.structure-baseline.json`, `process.version` and the `typescript` version;
  - the argv rule selection.
- The cache stores the `applyRatchet` result under `node_modules/.cache/structure-audit/<key>.json`, and **only when the run passed**.
- On a hit, it prints the same warnings and the pass line.

**(b) Per-file findings cache** for the rules that are purely per-file: class-methods, exported-values, file-lines, swallowed-failure, failure-as-empty and web-vocabulary. It is keyed by file content hash plus rule-source hash, so after an edit only the changed files are parsed. Cross-file rules still run on everything: imports, naming, directory-files, docs-links, facade-dispatch, test-placement, working-docs and contract-spread. Those can reuse (a) until their inputs change.

**(c) Cheap wins.**
- Build a `dir -> files` index once in the context, instead of facade-dispatch's two full scans per facade.
- Replace `statSync` per path with `git ls-files`' own knowledge. `--cached` paths that are deleted can be found with `git ls-files --deleted`, which is one more spawn in place of 2,875 stats.

**(d) The self-tests.** Put `structure:test` (3.3 s) and `task:test` in `pnpm check` behind the same stamp, keyed on `scripts/structure-audit/**` or `scripts/task/**` respectively. They test only those scripts.

**Estimated saving.** A check with no audited change drops from 8.5-43 s to about 0.5-1 s: the git spawn, the hash, and the module load, which can itself be skipped on a hit by importing `typescript` lazily. An edit to a few files, with (b), costs about 2-4 s idle. `structure:test` and `task:test` go from 3.3 s plus task:test to about 0.2 s when those scripts are unchanged.

**Why it stays as strict.** The cache is reused only when every input byte is identical: the file set, the contents, the rules, the config and the baseline. A deterministic, pure audit (the context.mjs contract says rules are "pure with respect to the repository") must then give the same result. A failed run is never cached. `--update` and `--adopt` always run cold. `docs:check` and `--rule` include the selection in the key.

Since `scripts/structure-audit.mjs` is mirrored into this repository, this change must land in Core first, per `AGENTS.md`.

### The downstream cache Core could adopt

The downstream repository now has a content-fingerprint stamp-and-skip cache in `scripts/build-cache/` (fxwork/t187). As its `steps.mjs` header describes it, each step declares only what cannot be derived:
- `package`, `kind`, `command`, `generated`, `outputs`/`match`, `required`, `tsconfigs`, `reads`, `bundles`, `env` and `unreadByDependants`.

From that, the inputs are derived:
- the package directory and its transitive workspace dependencies, outputs included;
- the linked Core packages;
- the root lockfiles and configs;
- the cache's own sources, `process.version`, the command, and the named environment variables.

A build is stamped on success, and a check only when it passed. `checkProject()` already produces the item 3 command shape: `tsc -p <p> --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/<name>.tsbuildinfo`.

It has no browser or DOM concepts. Core could take it over as the mechanism for items 1, 2 and 4(d), with steps for contracts, fluxiq, client-gateway-websocket and web builds and checks. It would then be mirrored back, like the structure audit, instead of both repositories keeping separate caches.

### Combined estimate (no-change run, from the brief's numbers)

| Command | Now | After items 1-4 | Main saving |
| --- | --- | --- | --- |
| `pnpm build` | 162 s | about 5-8 s | Web 98 s to about 1 s; packages 27 s to about 3 s; the rest is pnpm process start-up |
| `pnpm check` | 45-90 s | about 8-15 s | fluxiq check 21 s to about 3 s; audit 8.5-43 s to about 1 s; self-tests 3.3 s to about 0.2 s; the web check is already incremental |

`pnpm test` (about 450 s) was outside this brief. Vitest has no equivalent up-to-date skip, and its timeouts under load are a contention problem, not a problem of redoing work.

## Commands run and observed results

- `git rev-parse --short HEAD` (Core) printed `c4d6628`.
- `cat package.json` plus a per-package `scripts` dump: the scripts quoted above.
- `cat packages/*/tsconfig*.json apps/web/tsconfig.json tsconfig.base.json apps/web/next.config.ts`: the contents described above. Only `apps/web` has `incremental: true`.
- `git log -S'--clean' -- packages/*/package.json` printed only `6368574 2026-08-06 Did first 4 points of refactoring plan. Save before continuing`.
- `grep` of `docs/` for a reason behind `--clean` or stale output found nothing.
- The TS version is 5.9.3 and the Next version is 15.5.24, read from `package.json` files.
- `git ls-files --cached --others --exclude-standard | wc -l` printed `2875`. Filtered to audited script extensions, it printed `2598`, with 16,685,952 bytes.
- `ls C:/Users/osrs_/FluxStuff/lab-slots/` printed `slot-1`, so the CPU-profile run was **not** started.

## Not verified

- The audit's top self-time functions. No `--cpu-prof` run was made because slot-1 was held. The ranking in item 4 comes from reading the code.
- Whether TS 5.9.3 `tsc -b` counts a project as up to date after `rewrite-declaration-imports.mjs` changes `.d.ts` mtimes. Check it with `tsc -b tsconfig.build.json --verbose` run twice.
- Whether Next 15.5's turbopack build resolves `fluxiq` through `tsconfig` `paths` to `src` or through `node_modules` to `dist`. The proposed key hashes both to be safe.
- Every saving figure is an estimate from the brief's numbers. None was measured.

## Open questions or contradictions found

- The brief says the baseline was measured at `af385f7`, but Core's checkout is now at `c4d6628`. The scripts and configs quoted here are from `c4d6628`.
- `fluxiq`'s source is type-checked four times across `check` plus `build`:
  - its own `check`;
  - its `tsc -b` build, which uses a different program (NodeNext, no `paths`, no tests);
  - `apps/web`'s `tsc --noEmit`, through `paths`;
  - `next build`'s type pass.

  Only the last is truly redundant, and only when `check` is guaranteed to run first. That is a separate decision for the supervisor or user.
- Whether the downstream build cache should be promoted to Core is a boundary question. It is generic, and the structure audit sets the precedent, but it needs the Core-first rule applied.
