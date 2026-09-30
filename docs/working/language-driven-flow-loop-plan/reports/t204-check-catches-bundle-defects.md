# t204: make the checks catch bundle defects before a Lab run does

Worker report. Trees: `fxwork/t204/!FluxIQWebExtension` and `fxwork/t204/!FluxIQ`, both on `task/t204-check-catches-bundle-defects`. Nothing committed. No Lab or browser run.

## Outcome

Done.

Ready to commit.

**Core** (`fxwork/t204/!FluxIQ`):
- `scripts/structure-audit/config.mjs`
- `scripts/structure-audit/browser-graph/{index,specifiers,resolve,walk}.mjs`
- `scripts/structure-audit/rules/browser-imports.mjs`
- `scripts/structure-audit/rules/tests/browser-imports.test.mjs`
- `docs/architecture/code-structure.md`

**Downstream** (`fxwork/t204/!FluxIQWebExtension`):
- `package.json`
- `scripts/check/core-build.mjs`
- `scripts/check/core-build/{index,freshness}.mjs`
- `scripts/check/core-build/tests/freshness.test.mjs`
- `scripts/build-cache/tests/check-prefix.test.mjs`
- `scripts/structure-audit/config.mjs`
- the mirrored `scripts/structure-audit/browser-graph/*`, `rules/browser-imports.mjs` and `rules/tests/browser-imports.test.mjs`
- `apps/extension/scripts/browser-entries.mjs`
- `apps/extension/scripts/tests/browser-entries.test.mjs`
- `apps/extension/scripts/build-extension.mjs`
- `apps/extension/scripts/check-extension.mjs`
- `docs/architecture/repository-layout.md`
- this report

**Validation:**
- `pnpm check` with a fresh Core: exit 0.
- `pnpm check` after touching a Core source file: exit 1. It named the file and the rebuild command.
- In Core, `node --test` over the structure-audit tests: 192 pass, 0 fail.
- In Core, `node scripts/structure-audit.mjs`: passed.

## What changed and why

### 1. Downstream: `pnpm check` refuses a stale Core (refuse, not build)

- A new gate, `node scripts/check/core-build.mjs`, runs in the root `check` after the structure audit and before `pnpm -r check`.
- It reuses the Lab's modules through `scripts/lab/core/index.mjs`: `scanCoreBuildEntries`, `coreBuildMissing`, `scanCoreSources`, `scanCoreOutput`, `coreBuildStaleness` and `coreRepositoryRoot`. It does not add a second scanner.
- Only the wording is its own (`scripts/check/core-build/freshness.mjs`). It names:
  - the newest source file;
  - the newest built file;
  - `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build (in <core>)`, built from `CORE_PACKAGES` in `scripts/worktree`.
- An unbuilt Core is refused with the Lab's own `coreBuildMissing` message.
- It runs outside the build cache, so a cached `extension:check` cannot skip it. It costs about 2.5 s.
- **Why refuse rather than build:**
  - `pnpm check` should stay read-only.
  - The Core beside a task worktree is usually the shared, read-only Core that sibling tasks and running Labs import. A rebuild there deletes modules under them (see `scripts/lab/core/build/watch.mjs`).
  - The rebuild it asks for is cheap anyway. I observed that Core's build cache answers a touched-only source with "reuse ... 2 required output(s) touched" in under 1 s per package.
- There is no override variable.
- `check:test` was added as a suite, and `check-prefix.test.mjs` now expects the new glob and the new gate in the `check` chain.

### 2. Core: the `browser-imports` structure-audit rule, mirrored exactly downstream

**What the rule does:**
- `browser-graph/` walks the import graph from `CONFIG.browserBundles.entries`. It follows only the imports a bundler keeps:
  - skipped: `import type`, `export type`, and an import whose every named binding is `type`;
  - followed: `import "x"`, `export *`, and dynamic `import()`.
- Relative specifiers resolve to source files (`.js` becomes `.ts`, and a directory becomes its index). Workspace packages are followed through their `exports` into `src`.
- It fails, never ratcheted, on:
  - any Node built-in, either `node:x` or the bare name;
  - any third-party package not listed in `browserPackages`;
  - any import it cannot follow;
  - an entry that is no longer a file.
- `ownedElsewhere` hands `fluxiq`/`@fluxiq/*` to Core's own copy of the rule. It is used only downstream.

**Where the entries come from (the real bundle, not a hand list):**
- I bundled all five extension entries with esbuild's metafile. The bundle enters Core through:
  - `automation-studio/nodes` (and from there `nodes/routine/approval` → `runtime/parking`);
  - `fingerprinting` and `client-gateway/contracts.ts`, both aliased to source;
  - `@fluxiq/client-gateway-websocket`.
- Those modules are Core's entries. I also added the two published browser `client` subpaths: action-permissions and panel-capabilities.

**How the entries are kept true:**
- `check-extension.mjs` now collects each entry's metafile, through a new `metafiles` option on `bundleExtensionEntry`. It fails on either of these (`browser-entries.mjs`):
  - the bundle enters Core through a module missing from Core's `browserBundles.entries`;
  - downstream's own entries differ from the bundled entry sources.
- So neither list can fall behind the bundle.

**What it walks today:**
- Core: 125 modules, 8 of them in `parking`.
- Downstream: 480 modules from the 5 extension entries, 80 of them in `domain`.

## Commands run and observed results

**Core tests and audit**
- `node --test scripts/structure-audit/rules/tests/browser-imports.test.mjs` (Core): 10 pass, 0 fail.
- Core, `node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"`: 192 pass, 0 fail.
- Core, `node scripts/structure-audit.mjs`: `passed (199 warning(s), 354 baselined)`, exit 0.
  - It also printed "1 baseline entries can be lowered". That line was not caused by this rule, which has no baseline, and I did not touch the baseline.

**Real-tree probe of the rule**
- I prepended `import { randomUUID } from "node:crypto"` to the real `runtime/parking/person-needed-tool-calls.ts`.
- `node scripts/structure-audit.mjs --rule browser-imports` then printed `FAIL [browser-imports] ...person-needed-tool-calls.ts:1: imports the Node built-in "node:crypto"`, exit 1.
- The chain it printed:
  - `nodes/index.ts`
  - → `nodes/registry.ts`
  - → `nodes/routine/index.ts`
  - → `nodes/routine/approval.ts`
  - → `runtime/parking/index.ts`
  - → `person-needed-tool-calls.ts`
- I restored the file from a copy. `git status` shows no `packages/` change.

**Downstream audit and gate**
- Downstream `node scripts/structure-audit.mjs`: `passed (132 warning(s), 120 baselined)`.
- The mirror is byte-identical ignoring CR: `diff -r --strip-trailing-cr -x config.mjs` over `scripts/structure-audit` printed nothing, and so did the diff of `structure-audit.mjs`.
- `node --test "scripts/check/**/tests/*.test.mjs"`: 4 pass, 0 fail.
- `node --test apps/extension/scripts/tests/browser-entries.test.mjs`: 5 pass, 0 fail. The full `node scripts/test-extension.mjs` (label t204) also ran: 1492 pass, 0 fail.
- `node scripts/check/core-build.mjs` right after the probe restore: exit 1, "12 minute(s) behind ... Stale: ...person-needed-tool-calls.ts".
  - The restore had refreshed that file's modification time.
  - After `heavy.sh ... pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in the t204 Core (all three steps reused from the cache), the gate exited 0.

**Entry-drift check**
- `pnpm --filter @fluxiq-web-extension/extension check` (heavy.sh): exit 0 (`extension:check` build, 65.8 s).
- Drift probe: I deleted the `nodes/index.ts` entry from Core's config and ran `node scripts/check-extension.mjs` directly. It printed "the extension bundle enters FluxIQ Core through packages/fluxiq/src/programs/automation-studio/nodes/index.ts (imported by domain/src/actions/extraction/field-match.ts), which Core's ... does not list", exit 1. I restored the config from its backup.

**Full `pnpm check`**
- Fresh Core: `heavy.sh "t204 pnpm check fresh" pnpm check` gave exit 0. It showed `# pass 526 # fail 0`, the audit passed, `core-build: ... current with its source`, and every package check was built, including `extension:check`.
  - The first attempt failed `check-prefix.test.mjs`, which pins the `check` script, and then the imports-barrel rule. I fixed both and reran.
- Stale Core: I touched `runtime/parking/index.ts` and ran `heavy.sh "t204 pnpm check stale" pnpm check`. Exit 1, printing:
  - "pnpm check: FluxIQ Core's build ... is 11 minute(s) behind its source."
  - "Stale: ...parking\index.ts is newer than anything in Core's dist (newest built file: ...fluxiq\dist\index.d.ts)."
  - "Rebuild Core's libraries, then run pnpm check again: pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build (in ...)".
  - `ELIFECYCLE`.
- I restored that file's modification time. The gate then exited 0.

## Not verified

- Core's full `pnpm check` and `pnpm test` were not run. Only its structure-audit tests and the audit itself were.
- Downstream `pnpm test` and `pnpm build` were not run as a whole. Only the extension's unit and script tests (1492 pass) and the checks above were.
- The Core `dist` mapping in `browser-entries.mjs` (`packages/<p>/dist/x.js` → `src/x.ts`) assumes `.ts` sources. That holds for today's Core, but a `.tsx` entry would read as drift.

## Open questions or contradictions found

- **Two cache gaps in `extension:check`.** Its build-cache fingerprint covers Core's `src` and `dist`, but not either repository's `scripts/structure-audit/config.mjs`.
  - A change to only an entry list does not rerun the cached drift check.
  - The drift check reruns on the next extension, domain or Core change.
  - The structure audit still fails at once on an entry that no longer exists.
  - Adding both config files to the step's inputs is a small follow-up in `scripts/build-cache/workspace/resolve-step.mjs`. I did not take it, because it is outside this brief.
- **The rule counts some imports a bundler drops.** It follows a value binding that is used only as a type, which is the conservative choice. No such case fails today.
- **Two Lab messages point elsewhere.** The Lab's own staleness refusal (`run-lab.mjs`) still says `pnpm --filter fluxiq build`, and its unbuilt refusal says `pnpm build`. The new gate names all three libraries. I left the Lab wording unchanged.

## Follow-up: the cached `extension:check` reruns on structure-audit changes

The coordinator asked for the cache gap named above to be closed.

**Outcome:** Done. Ready to commit, all downstream:
- `scripts/build-cache/workspace/resolve-step.mjs`
- `scripts/build-cache/steps.mjs`
- `scripts/build-cache/tests/structure-audit-inputs.test.mjs`
- `docs/architecture/repository-layout.md`
- this report

**Validation:**
- `node --test "scripts/build-cache/tests/*.test.mjs"`: 53 pass, 0 fail.
- The cache decision for the real `extension:check` changes to `build` after a one-line edit to either repository's `config.mjs`, and returns to `reuse` once the edit is reverted.

### What changed and why

- **A new step flag.** A registry step may set `structureAudit: true`. Its fingerprint then also hashes:
  - `scripts/structure-audit/` in this repository, labelled `scripts/structure-audit`;
  - `scripts/structure-audit/` in every Core the step links, labelled `core:scripts/structure-audit`.
- **Tests are left out.** Both `tests/` and `rules/tests/` are excluded, so editing a rule's test does not rerun the step.
- **`extension:check` is marked.** Its drift check (`browser-entries.mjs`) reads both repositories' `config.mjs`.
- **Nothing else needed the flag:**
  - No other downstream cached step reads the audit. The downstream audit itself runs uncached in `pnpm check`.
  - Core's `structure-audit:check` already fingerprints the whole repository (`inputs: "repository"`).
  - Core's build cache is a separate implementation, not a mirror of this one, so I left it unchanged.

### Commands run and observed results

**The new test**
- `node --test scripts/build-cache/tests/structure-audit-inputs.test.mjs`: 5 pass. It covers:
  - an edit to this repository's config, which reruns the step with reason `scripts/structure-audit`;
  - an edit to the linked Core's config, which reruns it with reason `core:scripts/structure-audit`;
  - an edit to a rule file, which reruns it, while an edit to a rule's test is reused;
  - an unmarked step, which ignores the audit;
  - the registry, which marks `extension:check`.
- The same test against the committed, unfixed `resolve-step.mjs` (from `git show HEAD:`): 3 fail, 2 pass. The failures are exactly the three rerun cases. I restored the fixed file afterwards.

**Build-cache suite**
- `node --test "scripts/build-cache/tests/*.test.mjs"`: 53 pass, 0 fail. This includes the registry's no-absolute-path label check.

**Real tree**
- `heavy.sh ... pnpm --filter @fluxiq-web-extension/extension check`: `"build" ... "inputs changed: core:scripts/structure-audit, scripts/build-cache, scripts/structure-audit"`, exit 0, 59 s.
- Then `decideStep("extension:check")` gave, in order:
  - `reuse`;
  - after appending a comment to Core's `config.mjs`: `build` ("inputs changed: core:scripts/structure-audit");
  - after restoring it: `reuse`;
  - after appending a comment to the downstream `config.mjs`: `build` ("inputs changed: scripts/structure-audit");
  - after restoring it: `reuse`.
- `git status` in both trees shows only the intended files.

**Audit**
- `node scripts/structure-audit.mjs`: passed.

### Not verified

- Full `pnpm check` was not rerun after this follow-up. Only the build-cache suite, the audit, the docs-links rule and the extension check ran.
- `pnpm build-cache:prove` was not run. The change only adds roots, so coverage can only grow.
