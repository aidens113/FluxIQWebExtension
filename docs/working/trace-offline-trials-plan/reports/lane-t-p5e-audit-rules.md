# Lane T, P5e (t749): two mechanical structure-audit rules (D36)

## Progress log

### 2026-10-20: both rules built in Core, mirrored downstream, configured in each repository

Pre-check: `git -C .../t748/!FluxIQ status --short` and the same for `.../t748/!FluxIQWebExtension`.
Neither touches `scripts/structure-audit*` or `scripts/check/core-mirror/`. The t748 Core changes are
all in `packages/fluxiq/src/programs/automation-studio/...`; the t748 downstream changes are in
`apps/extension/e2e`, `domain/src/runtime/llm-evidence/plan-resolution` and docs. No overlap, so work went ahead.

Tests first. I wrote both test files, then ran them against stub rules whose `run()` returns `[]`:
`node --test scripts/structure-audit/rules/tests/package-exports.test.mjs scripts/structure-audit/rules/tests/module-reach.test.mjs`
printed `# pass 8` and `# fail 13`. Every refusal case failed, and every "passes" case passed. Before the stubs existed,
the run failed with `ERR_MODULE_NOT_FOUND` for `rules/module-reach.mjs`. I wrote the four binding-precision
tests for module-reach (described below) together with the binding walker, so they were not shown failing first.

## Outcome

Done, with two results that differ from what the brief expected. Both are reported below and neither is fixed:
- Core does not pass. The new `package-exports` rule finds 5 Core files outside `scripts/structure-audit/`.
- Downstream fails `package-exports` on 97 files, not 2.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t749/!FluxIQ`). The same files were copied byte for byte downstream; `config.mjs` is not mirrored.

- `scripts/structure-audit/rules/package-exports.mjs` (new rule `package-exports`, ratcheted, one finding per
  file with the value counting its sites). It refuses three things:
  - a specifier `<linked package>/<subpath>` whose subpath the package's `exports` does not name. This covers static
    imports (type-only ones too), `export from`, `import x = require`, dynamic `import()`, `require`/`require.resolve`,
    a `createRequire(...)` require called directly or through a bound name, and `import.meta.resolve`;
  - `new URL(<literal>, import.meta.resolve("<linked package>"))` anywhere, and a load whose built argument combines
    `import.meta.resolve(<linked package>)` with another literal;
  - a load of a path literal into another package's `dist/` or `src/`. The path can be relative, or written from a
    repository root. For a linked external package that is its own repository's root, so `path.join(coreRoot,
    "packages/fluxiq/dist/...")` is refused. Template-literal text counts.
  Only import and load expressions are read. A build path held in an ordinary string (a freshness check) passes, and a
  test covers that. A package with no `exports` field, and third-party packages, are not checked.
- `scripts/structure-audit/package-exports/` (new helper directory and barrel):
  - `linked-packages.mjs` lists the workspace packages plus `link:`/`file:` dependencies, reading each external
    manifest through `ctx.read`. An unreadable linked manifest throws; it is never skipped silently. The root package
    never shadows a workspace package of the same name (Core's root and `packages/fluxiq` are both `fluxiq`).
  - `exported-subpath.mjs` applies Node's `exports` semantics: exact keys, `*` patterns, `null` targets, string
    and condition-object forms.
  - `load-sites.mjs` finds the import and load expressions in a file.
  - `package-path.mjs` decides whether a path lands in another package's `dist/` or `src/`.
- `scripts/structure-audit/rules/module-reach.mjs` (new rule `module-reach`, never ratcheted). It is driven by
  `CONFIG.reachBoundaries` entries of the form `{ name, from, to, reason, remedy }`. A prefix that ends in `/` names a
  directory; anything else names one file. Each non-test script under `from` is walked, and the rule fails if it
  reaches anything under `to`. The message prints the shortest chain. A `from` entry that names no audited script also
  fails, so the list cannot rot. A `to` entry may name a directory that does not exist yet.
- `scripts/structure-audit/import-graph/binding-reach.mjs` and `module-bindings.mjs` are new and exported from the
  `import-graph/index.mjs` barrel. They follow imports binding by binding. **This departs from the brief's preference
  for the existing import graph.** I first built the rule on module-level reachability, and Core then failed 6 of its
  12 guidance entries. Every failure came only through a barrel: for example, `model/index.ts` has
  `export * from "./offline-trial/index.ts"`, so anything that touched `model/index.ts` "reached" the offline-trial
  modules. Through barrels nearly every module loads nearly every other, which makes that check meaningless. The
  binding walker works differently:
  - `{ a }` from a barrel leads to the module that declares `a`, and the re-export hops it passes through count;
  - a module reached for one binding is followed through all of its value imports;
  - namespace imports, literal dynamic `import()`, `export * as`, and the starting module itself are walked whole;
  - type-only imports are not followed.
  A probe confirmed the walker is selective, not blind:
  - `runtime/parking/conversation-port.ts` reaches `runtime/gateway-trace/installation.ts`;
  - `runtime/service.ts` reaches `gateway-trace/wiring/index.ts`;
  - `conversations/instructions/prompt.ts` and `activity/ask/resolution.ts` reach nothing.
- Core `scripts/structure-audit/config.mjs` gains `reachBoundaries` with the entry "trace-free model guidance":
  - from: AS `runtime/llm/model-facing/`, `llm/deepseek/system-prompt.ts`, `llm/domain-instructions/`,
    `llm/diagnosis-instructions.ts`, `llm/stages/instructions.ts`, `llm/node-tools/node-descriptions.ts`,
    `flow-bootstrap/plan/catalog.ts`, `catalog-names.ts`, `flow-script-format.ts`,
    `project-agents/supervisor/system-instructions.ts`, `guidance.ts`, and `conversations/instructions/prompt.ts`;
  - to: `client-gateway/trace/`, `trace-replay/`, `trace-matcher/`, AS `runtime/gateway-trace/`,
    `runtime/service/offline-trial/`, `model/offline-trial/`, and `storage/project/gateway-trace{,-chunk-codec,-chunk-rows,-rekey,-schema}/`.
- Downstream `scripts/structure-audit/config.mjs` gains the same rule:
  - from: `domain/src/runtime/llm-evidence/system-instructions/`, `llm-evidence/tools.ts`, and
    `output-nodes/{extract,extract-list,next-page}/catalog-text.ts`;
  - to: `domain/src/runtime/offline-reads/`, `packages/test-runner/src/offline-trial-experiment/`, and
    `packages/test-runner/src/offline-snapshot-page/`.
- `scripts/check/core-mirror/mirrors.mjs` is unchanged. Its `structure-audit` set already covers all of
  `scripts/structure-audit/`, so the new files are compared automatically (58 files before, 69 after).

## Commands run and observed results

- Core: `node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"` printed
  `# tests 290`, `# pass 290`, `# fail 0`.
- Downstream: `node --test scripts/structure-audit/rules/tests/package-exports.test.mjs scripts/structure-audit/rules/tests/module-reach.test.mjs`
  printed `# tests 25`, `# pass 25`, `# fail 0`.
- Core `node scripts/structure-audit.mjs` exits 1 with `structure-audit: 5 violation(s) across 1 rule(s).`, all from
  `package-exports`. Everything else passes, `module-reach` included. Before my change the same command printed
  `passed (436 warning(s), 1152 baselined)`. The 5 Core findings:
  - `apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract-world.ts` lines 22-25:
    `../../../../../../../../packages/fluxiq/src/programs/_shared/api.ts`, `.../automation-studio/api/handlers/index.ts`,
    `.../automation-studio/runtime/index.ts`, `.../automation-studio/nodes/index.ts`, all relative imports into `fluxiq`'s `src/`;
  - `apps/web/.../capabilities/tests/core-contract.test.ts` line 27: the same `_shared/api.ts` path;
  - `scripts/automation-studio-scale-baseline.mjs` line 6 and `scripts/automation-studio-scale-certification.mjs` line 7:
    `../packages/fluxiq/dist/programs/automation-studio/testing/index.js`;
  - `scripts/flow-compiler.mjs` line 4: `../packages/fluxiq/dist/programs/automation-studio/dsl/index.js`.
- Downstream `node scripts/structure-audit.mjs` exits 1 with `structure-audit: 101 violation(s) across 5 rule(s).`
  Before my change it printed `passed (218 warning(s), 618 baselined)`.
  - `module-reach`: no findings.
  - `package-exports`: 97 files. The two expected ones:
    - `packages/test-runner/src/offline-trial-experiment/rebuild/core-authoring.ts`
      - line 61: `const core = new URL("./", import.meta.resolve("fluxiq/automation-studio"));`
      - line 62: `const domain = new URL("./", import.meta.resolve("@fluxiq-web-extension/domain/node"));`
    - `packages/test-runner/src/offline-trial-experiment/run/core-trial-seams.ts`
      - line 56: `const core = new URL("./", import.meta.resolve("fluxiq/automation-studio"));`
      - line 57: `const domain = new URL("./", import.meta.resolve("@fluxiq-web-extension/domain/node"));`
  - The 95 others were already there before this task. All are true positives under the rule as briefed:
    - 34 root `scripts/**/*.mjs` (demo, `run/`, `lab/`) that `import("../packages/test-runner/dist/<x>.js")`, or
      that load `packages/test-runner/src/realistic-scenarios/index.ts`;
    - 60 `apps/extension/e2e/**` (57) and `apps/scenario-lab/e2e/**` (3) specs and harnesses that import
      `../../scenario-lab/src/<x>.js` or `packages/test-runner/src/realistic-scenarios/index.js` by relative path;
    - `domain/src/runtime/llm-evidence/node-run/tests/arrival.test.ts` line 331:
      `new URL("./runtime/llm/harness-options/evidence-build-scope.js?copy=panel", import.meta.resolve("fluxiq/automation-studio"))`.
    The full list is in the audit output.
  - The other 4 failures come from other workers' files still being written: `as-never`, `failure-as-empty` and
    `naming` in `packages/test-runner/src/offline-snapshot-page/`, and `statement-packing` in
    `domain/src/runtime/offline-reads/tests/reevaluator.test.ts` line 206. None is from my rules.
- Downstream `node scripts/check/core-mirror.mjs` printed `core-mirror: 1 mirror set(s) match FluxIQ Core at ...\t749\!FluxIQ: structure-audit (69 files).` and exited 0.

## Not verified

- `pnpm check` in either repository; not run, since a full suite is outside the brief.
- Whether `package-exports` produces false positives in unusual load shapes not present in either repository today,
  such as a loader called through an alias other than a `createRequire` binding.
- `module-reach` does not follow a value reached through a type-position-only `import { a }` that the code uses only as
  a type. That import is conservatively followed. Not seen causing a finding.

## Open questions or contradictions found

1. The brief says Core must pass, but 5 Core files outside `scripts/structure-audit/` violate `package-exports`.
   Fixing them is outside what I own. The supervisor's options: fix those 5 (export `dsl` and `testing` from
   `fluxiq`, or import by package name), or run `pnpm structure:baseline --adopt package-exports` in Core, which
   writes `.structure-baseline.json`. The rule is ratcheted, so adoption is possible.
2. The brief expected downstream to fail only on the two offline-trial files. It fails on 97. The same choice
   applies: fix them, or `--adopt package-exports` downstream. Adopting now would also baseline the two target
   files; fixing them first and then adopting keeps them refused.
3. `module-reach` follows imports binding by binding rather than through the existing module-level graph, because the
   module-level version failed through barrels alone (6 of 12 Core entries, every chain through a `model/index.ts`-style
   barrel). If the supervisor wants module-level strictness instead, the chains are in this report's history.
   Switching would make Core fail on those 6 entries until its barrels are split.
4. Core's documentation of audit rules (for example `docs/architecture/code-structure.md`) is not updated; it is
   outside what I own.
