# t187 build cache: stamp-and-skip for every package build and check

## Outcome

Partial, because of one thing I don't own. The cache is built and wired into every package's `build` and `check`. A second `pnpm build` takes 10 s instead of 172 s, and a second `pnpm -r check` takes 8 s instead of 198 s. In both, every step was reused. A one-file edit to `domain/src/index.ts` rebuilt domain, extension and test-runner only. The coverage proof passes for all 33 projects.

Root `pnpm check` still exits 1. The cause is one structure-audit `imports` failure in `packages/test-runner/src/tests/cli-llm.test.ts` line 8, which imports `"../core-web-build/publication.js"` past the barrel. That file belongs to the worker editing test-runner, not to me. Every step before it in the chain passed: structure:test 182/182, lab:test 106/106, task:test 120/120 and build-cache:test 28/28.

## What changed and why

### `scripts/build-cache/` (new)

- **Top level**
  - `steps.mjs`: the registry.
  - `cli.mjs`
  - `prove-inputs.mjs`
  - `decide-step.mjs`, `run-step.mjs`, `fingerprint-step.mjs`
  - `run-command.mjs`, `touch-outputs.mjs`, `build-order.mjs`, `repository-root.mjs`
  - `index.mjs`: the barrel.
- **`fingerprint/`**: listing, hashing, stat cache, excluded names, `isInsideRoots`, output digest.
- **`stamp/`**: read, write, remove, `STAMP_VERSION`.
- **`workspace/`**:
  - workspace graph
  - transitive Core links
  - `resolveStep`
  - `tsconfigReferences`
- **`tests/`**: `stat-cache`, `list-and-digest`, `run-step` (a scratch workspace with a <- b plus an unrelated c), and `registry` (checks against the real repo).

I split the code into subdirectories because the flat directory reached the audit's 25-file limit.

### Design

- **Fingerprint.** A sha256 over two things:
  - Each input root's digest. That is a sha256 of (label, file sha256) pairs, sorted by label.
  - The step metadata: stamp version, step name, command, `process.version`, platform, the listed env vars and the output locations.
- **Input roots** (from `resolveStep`):
  - The package dir, minus the directories it generates and minus this step's outputs.
  - Every transitive workspace dependency, whole, including its outputs, plus any `reads` packages.
  - Linked Core packages, transitively through Core's own `workspace:` deps: `src`, `dist`, `package.json`, `tsconfig*.json`.
  - Core root: `package.json`, `tsconfig*.json`, `pnpm-lock.yaml`, `node_modules/.pnpm/lock.yaml`.
  - Repo root: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `node_modules/.pnpm/lock.yaml`.
  - The build-cache sources themselves, minus its tests.
- **Excluded directory names, at any depth:**
  - The brief's list: `node_modules`, `.lab-instances`, `.test-build`, `.script-build`, `.next`, `.tmp`, `test-runs`, `.fluxiq`.
  - Additional ones: `.git`, `.lab-locks`, `.test-build-scratch`, `.turbo`, `test-results`, `playwright-report`, `.playwright`, `.browser-profiles`, `.harness-build`, `.bundle-check`.
  - The proof checks that no compiled or bundled file lies under any of them.
- **Stat cache** at `<repo>/node_modules/.cache/fluxiq-build/stat-cache.json`:
  - A cached hash is reused only when size, mtime (ns, via bigint stat) and ino all match, and the mtime is at least 2 s before the moment that entry was hashed. Otherwise the file is read again.
  - Saves merge over what is on disk and are written atomically.
  - A torn cache file is treated as empty.
- **Stamp** at `<package>/node_modules/.cache/fluxiq-build/<build|check>[-<sha12 of output base>].json`, holding `{version, step, fingerprint, outputDigest, roots}`.
  - A step is reused only when all of these hold: the stamp version matches, the fingerprint matches, every required file exists, and the output digest matches.
  - On reuse, the output roots' and required files' mtimes are set to now.
  - On a build, the stamp is deleted, the command runs, and the fingerprint is taken again. The stamp is written only if the fingerprint is unchanged and every required file exists. A failed run leaves no stamp.
  - `FLUXIQ_BUILD_FORCE=1` always builds.
  - A check has no outputs, so it is stamped only when it passed.
  - Tests are never cached. Only the build steps in front of them are.
- **Lab env vars.** `FLUXIQ_LAB_EXTENSION_BUILD_ROOT` and `FLUXIQ_LAB_SCENARIO_OUT_DIR` only move where outputs go (confirmed by grepping the two build scripts). So the *resolved* output location is fingerprinted and names the stamp, not the raw value. The non-instanced Lab sets both variables to the default locations, so it shares the `pnpm build` stamps.
  - Exception: `extension:check` also fingerprints the raw `FLUXIQ_LAB_EXTENSION_BUILD_ROOT`, because importing `build-extension.mjs` throws on a root outside the repo.
  - `NODE_ENV` is fingerprinted for every step.
- **`reads`** is a new registry field. `apps/extension/tsconfig.test.json` compiles `e2e/`, which imports scenario-lab sources and test-contracts by relative path without declaring them. The first proof run caught this (792 uncovered files); `extension:check` now declares `reads: ["apps/scenario-lab", "packages/test-contracts"]`.

### Wiring

- **Package scripts.** Every package's `build` and `check` runs `node <rel>/scripts/build-cache/cli.mjs <step> -- "<command>"`. The CLI refuses a command that differs from the registry's.
- **Nested `pnpm` calls replaced:**
  - extension: `test:e2e:build`, `test:e2e`, `test:content`
  - scenario-lab: `build`, whose inner test-contracts build is now a cached step; also `test`, `test:e2e`
  - test-matrix: `build:registry`, `test`
  - boundary-audit and real-site-policy: `test`, `audit`
  - test-runner: `domain:dist`, `clean`, `build`, `check`, `test`
- **New test-runner scripts:**
  - `packages/test-runner/scripts/domain-dist.mjs`: runs `domain:build` in-process through `runStep`, and only when `domain/dist/index.d.ts` is missing.
  - `packages/test-runner/scripts/clean-dist.mjs`
- **Incremental type checks.** Every `tsc --noEmit` check, and the extension build's type check, now passes `--incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/<name>.tsbuildinfo`. `check-extension.mjs` passes the same flags to its spawned tsc calls.
- **`build-extension.mjs`** now exports `EXTENSION_BUNDLE_SOURCES` (entry sources and alias targets), and its alias plugin reads from it. The registry test checks those paths against the fingerprints.
- **Root `package.json`:**
  - Adds `build-cache:test` (`node --test "scripts/build-cache/tests/*.test.mjs"`) and `build-cache:prove`.
  - `check` now runs `pnpm build-cache:test` after `task:test`.

## Registry

| Step | Package | Command (after the CLI) | Outputs / required |
| --- | --- | --- | --- |
| domain:build | domain | `node scripts/clean-dist.mjs && tsc -p tsconfig.json && node scripts/rewrite-dist-specifiers.mjs` | dist (tsc emit only; dist/host kept out) / dist/index.js, index.d.ts |
| domain:check | domain | tsc tsconfig.json --noEmit + tsconfig.test.json, incremental | — |
| extension:build | apps/extension | incremental `tsc --noEmit` && `node scripts/build-extension.mjs` | build, dist under `FLUXIQ_LAB_EXTENSION_BUILD_ROOT` / background+content bundles, 3 manifests, e2e background |
| extension:check | apps/extension | `node scripts/check-extension.mjs` (reads scenario-lab, test-contracts) | — |
| scenario-lab:build | apps/scenario-lab | `node scripts/build-scenario-lab.mjs` | `FLUXIQ_LAB_SCENARIO_OUT_DIR` or dist / server.js, registry.js |
| scenario-lab:check | apps/scenario-lab | tsc tsconfig.json --noEmit + tsconfig.e2e.json, incremental | — |
| agent-orchestrator, boundary-audit, real-site-policy, test-contracts, test-evidence, test-matrix :build | packages/* | `tsc -p tsconfig.json` | dist / index (+cli or d.ts) |
| same six :check | packages/* | `tsc -p tsconfig.json --noEmit` incremental | — |
| test-runner:build | packages/test-runner | `node scripts/clean-dist.mjs && tsc -p tsconfig.json` | dist / index.js, cli.js |
| test-runner:check | packages/test-runner | `tsc --noEmit` incremental | — |

## Coverage proof

`node scripts/build-cache/prove-inputs.mjs` runs `tsc -p <cfg> --listFilesOnly` for every registered project, using each package's pinned compiler. It also runs esbuild with its metafile and `write: false` for all 5 extension entries under both extension steps.

Every listed file must be inside the step's input roots, or under a `node_modules` that a fingerprinted lockfile covers (this repo's or the linked Core's).

- **First run:** failed on extension:check `tsconfig.test.json`, with 792 files outside its roots (764 in apps/scenario-lab, 28 in packages/test-contracts). I fixed this with `reads`.
- **Final run:** `inputs proved complete for 33 project(s)`, exit 0. Examples:
  - extension:check tsconfig.test.json: 2595 files, 2403 fingerprinted, 192 under node_modules (178 repo, 14 Core).
  - test-runner: 1822 files, 1633 fingerprinted, 189 under node_modules.
  - domain:check test project: 1309 files, 1131 fingerprinted, 178 under node_modules.
  - Esbuild entries: 281, 342, 3, 295 and 295 files, all fingerprinted.

`tests/registry.test.mjs` is the cheap static check and runs in `pnpm check`. It parses `extends`, `include`/`files` (up to the first glob segment), `references`, `paths`, `baseUrl`, `rootDir` and `typeRoots` of every registered tsconfig, following `extends` (89 references in all), and holds each one against the step's roots. It also checks:

- esbuild entries and alias targets;
- that every `tsc -p` in a command appears in the step's `tsconfigs`;
- that every package `build`/`check` uses the CLI with the registered command and contains no `pnpm`;
- that every CLI call names a known step.

## Commands run and observed results

- `node --test "scripts/build-cache/tests/*.test.mjs"` → `# pass 28 # fail 0`, both before and after the restructure.
- `pnpm build` twice under build slot b2: `BUILD1 exit=0 seconds=172`, with every step `"build","no stamp"`. `BUILD2 exit=0 seconds=10`, with all 12 CLI lines `"reuse"`, each 0.15–1.4 s.
- `pnpm check` twice: `CHECK1 exit=1 seconds=78` and `CHECK2 exit=1 seconds=104`. Both stopped at the structure-audit FAIL in cli-llm.test.ts. The test prefix (≈80–100 s) always runs.
- `pnpm -r check` twice: `RCHECK1 exit=0 seconds=198`, with 10 × `"build","no stamp"`. `RCHECK2 exit=0 seconds=8`, with 10 × `"reuse"`.
- Appended a comment to `domain/src/index.ts`, then `pnpm build`: `EDITED exit=0 seconds=172`.
  - Rebuilt: domain:build, extension:build and test-runner:build, each `"inputs changed: domain"`.
  - Reused: the other 9.
- Restored the file from a copy (`git diff --stat` empty), then `pnpm build`: `REVERTED exit=0 seconds=63`. The same three rebuilt and the rest were reused.
- `node scripts/structure-audit.mjs` → `structure-audit: 1 violation(s) across 1 rule(s)`, the cli-llm.test.ts import above. My files produce no finding.
- `node scripts/build-cache/prove-inputs.mjs` → exit 0, 33 projects.

The machine was under heavy load throughout (CPU at 100%, with other workers in b1). Absolute times are noisy; the reuse/build decisions are not.

## API for the Lab prelude

```js
import { buildOrder, decideStep, fingerprintStep, runStep, STEPS } from "../build-cache/index.mjs";

// runStep(stepName, { env?, stdio?, repoRoot? }) -> { result: "reuse"|"build", step, reason, ms, exitCode }
//   Never throws for a failing command; check exitCode (non-zero = failed, not stamped).
// decideStep(stepName, { env?, repoRoot? }) -> { decision, reason, step, resolved, fingerprint, roots } (no build)
// fingerprintStep(stepName, { statCache, env? }) -> { fingerprint, roots }
// buildOrder("test-runner:build") -> registered build steps, dependencies first
//   (replaces `pnpm --filter <pkg>... build`)

for (const step of [...buildOrder("scenario-lab:build"), "extension:build", ...buildOrder("test-runner:build")]) {
  const outcome = await runStep(step, { env: buildEnvironment });   // pass FLUXIQ_LAB_* in env
  note({ "build-cache": outcome.result, step, reason: outcome.reason, ms: outcome.ms });
  if (outcome.exitCode !== 0) throw new Error(`${step} failed (${outcome.reason})`);
}
```

Running a step twice in one prelude is cheap: the second call is a reuse.

`buildOrder("extension:build")` returns `["domain:build", "extension:build"]`. Today's `test:e2e:build` builds only the extension. Run order does not change what the extension build produces, since it reads domain/src directly.

## Not verified

- **Lab prelude and `pnpm task start/finish`.** Neither was run. The prelude is another worker's file. Task start and finish go through `pnpm build` and `pnpm check`, so they inherit the cache. A fresh worktree has no outputs and no stamps, so `task start --worktree` still builds everything, which is correct.
- **Instanced (`.lab-instances`) builds.** I did not exercise the extension and scenario-lab builds under the Lab env vars in the real repo. Only the scratch-workspace tests cover redirected output bases.
- **Root `pnpm check` exit 0.** Not reached, for the reason under Outcome.
- **Concurrent writers.** Two processes writing the stat cache at the same time were not stress-tested. Losing a write only costs a re-read.
- **Unreadable files.** A file whose content changes while its size, mtime and inode stay the same (mtime deliberately restored) would be missed. The racy rule does not cover that. It is git's known limit too.

## Open questions or contradictions found

- **Core location.** The brief says Core is `C:/Users/osrs_/FluxStuff/!FluxIQ`, but this worktree's `link:` specs resolve to the sibling `fxwork/t187/!FluxIQ`. The cache follows the links, so it fingerprints whichever Core is actually linked, and it wrote nothing to either Core.
- **Stale-build guard for the non-instanced extension.** In `scripts/lab/domain-build-staleness.mjs`, the output root is the whole `apps/extension`, and it scans `src` too. The guard therefore never fires there. The touch-on-reuse works for domain regardless.
- **Proof cost.** The proof is not in `pnpm check` because it takes about 1m45s under load. Run `pnpm build-cache:prove` whenever a project's import shape changes. The static test cannot see relative imports that cross packages; the `reads` gap it missed shows why.
