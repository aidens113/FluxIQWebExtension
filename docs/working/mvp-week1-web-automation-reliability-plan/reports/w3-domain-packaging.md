# Report: w3-domain-packaging

Worker: `w3-domain-packaging`. Wave 3, follow-up: make
`@fluxiq-web-extension/domain` consumable outside a bundler, then delete the
vocabulary `w3-runner-alignment` had to leave duplicated.

## Outcome

**Done.** `w3-runner-alignment`'s three failure modes were real, and I verified
each before changing anything. The domain now has a Node-resolvable entry, the
test runner imports the evidence vocabulary from it, and both restatements —
the one in `demo-llm-create-ui.ts` and the deliberate guard copy in its test —
are gone. Every gate in the definition of done was run and observed.

The dependency on the domain is now worth keeping (task 3): it is no longer
inert, so I did **not** recommend dropping it. Its cost is unchanged from what
`w3-runner-alignment` measured — `pnpm lab` and the `demo:*` scripts already
build the domain because of `--filter @fluxiq-web-extension/test-runner...` —
and it now buys the derivation the brief exists to get. It is already
committed (`ee25ac9`), so I changed neither `packages/test-runner/package.json`
nor `pnpm-lock.yaml`.

One residual, and it is not mine to fix: **`packages/test-runner`'s typecheck
now requires `domain/dist/index.d.ts` to exist**, so a tree where the domain
has never been built fails root `pnpm check` before `pnpm build` ever runs. It
does not fail here, and it is intrinsic to every remedy that does not edit
`domain/src`. Detail and the one-line fixes are in the open questions.

## What changed and why

### The decision: a built, Node-resolvable subpath

I verified all three of `w3-runner-alignment`'s findings rather than taking
them. The root cause is one property: `tsconfig.base.json` sets
`"moduleResolution": "Bundler"`, so all **329 relative specifiers across 95
files** in `domain/src` are extensionless, and `tsc` never rewrites a
specifier. Node ESM and TypeScript's `node16`/`nodenext` both refuse that, in
the source *and* in the emitted `dist`.

What I did:

1. **`domain/scripts/rewrite-dist-specifiers.mjs`** (new). After `tsc` emits,
   every relative specifier in `dist/**/*.js` and `dist/**/*.d.ts` is resolved
   against what was actually emitted and given its explicit path:
   `./constants` becomes `./constants.js`, `./output-nodes` becomes
   `./output-nodes/index.js`. An unresolvable specifier throws, so a
   half-rewritten `dist` fails the build instead of failing in a consumer.
   Observed: `335 specifier(s) in 103 file(s)`.
2. **`domain/scripts/clean-dist.mjs`** (new). Forced by a real defect I found
   while building: `tsc -p tsconfig.json` overwrites but never deletes, so
   **`dist/runtime/llm-evidence.js` from before `w3-llm-packet` split that
   module was still sitting beside the new `llm-evidence/index.js`**, and
   `dist/runtime/{commands,flow-runner}.*` had outlived their sources
   entirely. My first rewrite pass duly resolved `./llm-evidence` to the stale
   file — the built package was already wrong, silently, and nobody could see
   it because nobody loaded `dist`. The clean step removes only what `tsc`
   emits (`.js`, `.d.ts`, `.js.map`, `.d.ts.map`) and prunes emptied
   directories. It deliberately preserves `dist/host/web-panel-host.mjs`, the
   esbuild panel-host bundle, because `pnpm lab:interactive` runs `host:build`
   *before* the workspace build reaches this package; I confirmed after every
   build that the `.mjs` survived, and that it is the only non-`tsc` artifact
   in `dist`.
3. **`domain/package.json`**: `build` is now
   `node scripts/clean-dist.mjs && tsc -p tsconfig.json && node scripts/rewrite-dist-specifiers.mjs`,
   and `exports` gains one entry:

   ```json
   "./node": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
   ```

   `"."` and `"./client"` are **byte-for-byte unchanged**, so no existing
   consumer resolves anything different from what it resolved yesterday.

Core solves the same problem the same way one step earlier —
`F:\!FluxIQ\scripts\rewrite-declaration-imports.mjs`, run at the end of every
Core package build. Core's sources carry explicit `.ts` extensions, so its
rewrite is a substitution; mine has to resolve each specifier against the
emitted tree because the sources carry no extension at all. I did not touch the
Core script, and this is not the structure-audit case: it is this package's own
build, not mirrored framework behaviour.

#### Alternatives rejected

- **Give `domain/src` explicit `.js` specifiers** (the `packages/test-contracts`
  shape: `{"types": "./src/index.ts", "import": "./dist/index.js"}`). This is
  the *right* long-term answer, and it is the only one that also removes the
  build-ordering residual, because types would come from source. Rejected
  because `domain/src/**` is explicitly outside my ownership, it is a
  329-specifier edit across 95 files, and nine other Wave 3 workers were
  editing those files while I worked. Recommended as a follow-up below.
- **Make `"."` a conditional map** (`{"types": {"node": …, "default": …}, "node": …, "default": …}`).
  Tempting, because TypeScript's `Bundler` resolution does not set the `node`
  condition while `nodenext` does, so types would split correctly. Rejected on
  the runtime half: **esbuild with `platform: "node"` also sets the `node`
  condition**, so `domain/scripts/test-domain.mjs` and any future esbuild-node
  consumer of `"."` would silently switch from source to a possibly stale
  `dist`. Silent staleness is the worst failure this change could introduce, and
  no condition distinguishes real Node from esbuild-pretending-to-be-Node. An
  explicit subpath cannot be picked up by accident.
- **Point `"."`'s `types` at `dist`.** Would make `apps/extension`'s typecheck
  depend on a fresh domain build for its 30-odd `@fluxiq-web-extension/domain/client`
  imports. Rejected: far more consumers exposed to build order, for no gain.
- **Bundle just the vocabulary into a standalone `.mjs`** (`w3-runner-alignment`'s
  second option). Works for values; there is no tool in this repository that
  emits a flattened `.d.ts`, so the types would have to be hand-written — a
  restatement in a new costume.
- **Move the closed set to a third package.** Real ownership churn for one
  import, and it would put a domain contract outside the domain.

### `packages/test-runner/src/demo-llm-create-ui.ts`

The two hand-kept sets are one derived constant:

```ts
import { WEB_LLM_EVIDENCE_RESULT_CODES, WEB_LLM_EVIDENCE_TOOL_IDS } from "@fluxiq-web-extension/domain/node";
const WEB_EVIDENCE = Object.freeze({ toolIds: new Set<string>(WEB_LLM_EVIDENCE_TOOL_IDS), resultCodes: new Set<string>(WEB_LLM_EVIDENCE_RESULT_CODES) });
```

The file is **still exactly 837 lines**, its baselined value: the import costs
one line and folding two `const`s into one recovers it. No literal tool id or
result code remains anywhere in the module.

**I used the evidence-loop vocabulary, not the failure codes.** Both workers'
warning is correct and I checked it against the built package rather than the
source: `@fluxiq-web-extension/domain/node` exports
`WEB_AUTOMATION_FAILURE_CODES` (the closed browser-failure set) *and*
`WEB_LLM_EVIDENCE_RESULT_CODES`, and they are disjoint. The sanitizer filters
`web.inspect.succeeded`, `web.action.succeeded` and
`web.action.rejected.<reason>` × 6; the failure set carries the bare
`web.action.rejected`, which `llm-evidence` never emits. Deriving this
allowlist from the failure set would drop every step, exactly as
`w3-runner-alignment` predicted. Three axes, and the third is now importable by
name, which is the best defence against the conflation.

### `packages/test-runner/src/tests/demo-llm-create-ui.test.ts`

`DOMAIN_EVIDENCE_TOOL_IDS` and `DOMAIN_EVIDENCE_RESULT_CODES` are deleted, as
`w3-runner-alignment` asked. Two guards stand in their place:

- The existing behavioural test now drives the cross product from the domain's
  own exports. It fails if the sanitizer stops agreeing with the domain.
  Importing the package at module scope is itself an assertion: if the domain
  stops being consumable outside a bundler, the test file will not load.
- A new test, *"the sanitizer's allowlist is derived from the domain package,
  not restated beside it"*, reads `demo-llm-create-ui.ts` off disk, requires the
  import, and asserts that **no `"…"` or `'…'` literal in the module equals any
  domain tool id or result code**. A hand-kept copy that happens to be correct
  passes the first test and fails this one — which is the point, since the two
  copies that stood here drifted precisely because nothing forbade them.
  (Backticked mentions in prose are not matched, so the comment may still name
  a code.)

## Commands run and observed results

Every exit status captured by redirecting to a file and echoing `$?`, never
through a pipe. `DOMAIN_TEST_BUILD_LABEL=w3-domain-packaging` and
`EXTENSION_TEST_BUILD_LABEL=w3-domain-packaging` set. No root `pnpm build`, no
`pnpm lab`, no `pnpm structure:baseline`.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain build` | 0 | `clean-dist: removed 234 emitted file(s)`, then `rewrite-dist-specifiers: 335 specifier(s) in 103 file(s)`. Run three times in total; idempotent. `dist/host/web-panel-host.mjs` present after each. |
| `pnpm --filter @fluxiq-web-extension/domain check` | 0 | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. |
| `pnpm --filter @fluxiq-web-extension/domain test` | 0 | `# tests 245 / # pass 245 / # fail 0`. |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | 0 | No diagnostics. This is the check that produced 16 × `TS2835` + `TS2305` for `w3-runner-alignment`. |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | 0 | `# tests 395 / # pass 395 / # fail 0` (394 before; one new test). `ok 203 - the evidence-step sanitizer admits exactly the tools and result codes the domain produces`, `ok 204 - the sanitizer's allowlist is derived from the domain package, not restated beside it`. Run again as the closing gate after the final domain build: same. |
| **Negative control**: allowlist reverted to the historical stale copy (`web.reveal_safe` and every rejection code dropped), then `test` | 1 | `# pass 393 / # fail 2`. `not ok 203` (`+ resultCode: 'web.inspect.succeeded'` … missing from the kept steps) and `not ok 204` (`+ ['web.inspect_current_page', 'web.navigate_same_origin', 'web.inspect.succeeded', 'web.action.succeeded']` restated, expected `[]`). Both guards are real. Restored from a scratch copy; the file is byte-identical and still 837 lines, and the suite is back to 395/395. |
| **Node ESM probe**: `node -e "import('./dist/index.js')"` | 0 | `OK 601 ms; exports: 116`, and the three tool ids, eight result codes and six rejection codes printed correctly. The whole domain index loads in plain Node — Core's `fluxiq` import chain included, so `sqlite3` is not a problem. |
| **Subpath probe**: `node -e "import('@fluxiq-web-extension/domain/node')"` | 0 | `subpath OK; tools 3 codes 8 failureCodes WEB_AUTOMATION_FAILURE_CODES,WEB_AUTOMATION_FAILURE_CODE_DEFINITIONS`. |
| **Build-order probe**: `domain/dist/index.d.ts` renamed aside, then test-runner `check` | 2 | `TS7016: Could not find a declaration file for module '@fluxiq-web-extension/domain/node'`. Restored immediately and re-verified. This is the residual in the open questions, observed rather than assumed. |
| `pnpm --filter @fluxiq-web-extension/extension check` | 0 | Clean on the third run. The first two failed with four errors in `resolve-target.ts` against `../identity` (`scoreTargetCandidates`, `CandidateSelection`) — `w3-resolver` mid-write; `score.ts` was untracked and the barrel already exported both by the time I looked. Not caused by this change, which touches no extension file and leaves `"."` and `"./client"` unchanged. |
| `pnpm --filter @fluxiq-web-extension/extension test` | 0 | `# tests 203 / # pass 203 / # fail 0`. |
| `pnpm --filter @fluxiq-web-extension/extension test:content --workers=4` | 1, then 0 | **180 passed, 1 failed**: `evidence.spec.ts:241 infinite-feed: forms are not invented where the page has none`, failing in teardown — `Tearing down "openHarness" exceeded the test timeout`, `tracing.stopChunk: ENOENT … .playwright-artifacts-2`. Re-ran that spec file alone: `19 passed (4.7s)`, the same row `ok 11 … (388ms)`. Playwright artifact contention under four workers, in a spec `w3-evidence` owns. **This is the real proof the esbuild bundler consumer still works**: the content harness bundles the extension against `@fluxiq-web-extension/domain/client` source. |
| `node scripts/structure-audit.mjs` with both new scripts staged in a scratch `GIT_INDEX_FILE` | 0 | `structure-audit: passed (28 warning(s), 19 baselined)`. No finding names `domain/scripts/` or `demo-llm-create-ui.ts`. |
| `pnpm check` (root), same scratch index | 0 | `structure-audit: passed (28 warning(s), 19 baselined)`, then every package. `domain check: Done` precedes `packages/test-runner check: Done`, consistent with pnpm's topological ordering. |
| `git status --short` | — | Exactly five paths mine: `domain/package.json`, the two new `domain/scripts/*.mjs`, and the two `packages/test-runner` files. `packages/test-runner/package.json` and `pnpm-lock.yaml` needed no change — `ee25ac9` already carries the dependency. |

## Not verified

- **No live browser validation beyond the content harness, and no `pnpm build`,
  `pnpm lab` or `pnpm demo:*` run.** In particular `pnpm lab:interactive`, the
  one flow where the new `clean-dist` step could have destroyed the panel-host
  bundle, was not executed. I proved the preservation directly instead — the
  `.mjs` survives every build, and it is the only non-`tsc` file in `dist` —
  but the Lab is serialized and not mine to run.
- **The sanitizer is still exercised only through its parser seam** with
  synthetic Core diagnostics. No real Flow Bootstrap generation failure has
  gone through the corrected allowlist, so the `web.reveal_safe` path that
  `w3-runner-alignment` unblocked has still never run for real.
- **The two new build scripts have no unit test.** They are exercised by every
  domain build, and the stale-`llm-evidence.js` case proved the resolver picks
  a real file rather than guessing, but nothing pins their behaviour if someone
  edits them. `domain/scripts/` has no test root today.
- **Source maps drift by a few columns** on rewritten import lines in
  `dist/**/*.js`, since the rewrite adds characters after `tsc` wrote the
  mappings. Nothing consumes those maps today.
- **Extension `check` failed twice before passing**, and I attributed that to
  `w3-resolver`'s in-flight edit from the error text and the untracked
  `score.ts`. I did not stash the tree to prove it independently.
- **I did not run the audit or any gate against a clean clone**, so the
  build-order residual is proven only by the `index.d.ts` rename probe above.

## Open questions or contradictions found

1. **Typechecking `packages/test-runner` now requires the domain to have been
   built, and root `pnpm check` does not build it.** `pnpm -r check` runs
   topologically, so the *order* is right, but `check` is `--noEmit`
   everywhere, so on a tree where `domain/dist` has never been produced the
   root check fails with `TS7016` before `pnpm build` gets a chance. Three
   fixes, none of them cleanly mine:
   - Root `package.json`: `"check": "pnpm structure:test && node scripts/structure-audit.mjs && pnpm -r build && pnpm -r check"`, or a narrower domain build in front. **Not in my Owns.**
   - Domain `check` emits instead of `--noEmit`. I own that line and
     deliberately did not take it: `check` would then *delete and rewrite*
     `dist` on every run, which races the ten concurrent domain checks in this
     wave and, worse, could wipe the panel-host bundle or a `dist` a Lab run is
     loading. A gate should not mutate a shared build output.
   - Give `domain/src` explicit `.js` specifiers (below), after which types
     come from source and the requirement disappears.
   Until one lands, the rule is: **build the domain once after a fresh clone.**
2. **The durable fix is a codemod on `domain/src`.** 329 relative specifiers in
   95 files, mechanical, and `moduleResolution: "Bundler"` accepts explicit
   `.js` (that is exactly how `packages/test-contracts` is written today).
   Afterwards `"."` can take the `test-contracts` shape, `./node` can be folded
   away or kept as an alias, and item 1 evaporates. It needs to be one worker
   owning `domain/src/**` alone, so it cannot happen during a parallel wave.
3. **Two comments in files I do not own are now false, and one names a
   capability that is now available.** `packages/test-runner/src/failure.ts`
   lines 13–19 state that "the runner cannot derive anything from the domain's
   closed code set today" and that the package "is a bundler-only package" —
   both were true when written and are not any more.
   `packages/test-runner/src/bench/evaluate-run.ts` lines 122–123 say
   `automationFailureReported.code` "is not checked against that closed set:
   the domain package cannot be imported here". It can now:
   `WEB_AUTOMATION_FAILURE_CODES` is exported from
   `@fluxiq-web-extension/domain/node`, and validating the reported code
   against it is the *correct* use of the failure axis — the opposite of the
   evidence allowlist, which must never touch it. Both files were `w3-runner-alignment`'s
   Owns, not mine; this is the ownership-around-the-file defect the wave brief
   warns about, one hop downstream.
4. **`docs/architecture/repository-layout.md:63` documents `domain/dist/` and
   needs a line.** It should record the `./node` export, that `build` is now
   clean + compile + rewrite, and that `dist/host/web-panel-host.mjs` is
   deliberately preserved by the clean step. Documentation is not in my Owns,
   and AGENTS.md calls build-layout changes substantial, so this is a real gap
   for the supervisor to close.
5. **The domain's `dist` had been stale for at least two days and nobody could
   tell.** `runtime/{commands,flow-runner}.*` outlived their sources and
   `runtime/llm-evidence.js` outlived its split. Nothing consumed `dist` except
   the separately-built panel host, so the rot was invisible. It is fixed by
   the clean step, but it argues for `dist` being loaded by *something* in the
   default gates — the test-runner suite now does exactly that, which is a
   quiet second benefit of this change.
6. **The dependency question the brief asked me to keep open is closed.** Keep
   `@fluxiq-web-extension/domain` in `packages/test-runner`. It is imported,
   the import is load-bearing, and two tests fail without it. Its only cost is
   the Lab build graph, which already built the domain for the extension.
