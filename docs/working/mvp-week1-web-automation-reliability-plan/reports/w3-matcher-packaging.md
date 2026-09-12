# Report: w3-matcher-packaging

Worker: `w3-matcher-packaging`. Wave 3 follow-up — unblocking Level 2 target
scoring, which `w3-resolver` stopped at rather than reimplement Core's matcher
downstream.

## Outcome

**Done.** Core's element matcher is published for a browser, the extension uses
it, and Level 2 selection is wired into both places an exact answer is not one.

- **Core** now publishes `fluxiq/automation-studio/fingerprinting`. It needed no
  restructuring: the directory already had its own barrel and the barrel's
  compiled graph already had zero runtime imports. Only the `exports` map, a
  version bump, a test that keeps the guarantee true, the release smoke list and
  two architecture pages changed. **Core's matcher implementation was not
  touched.**
- **The extension** scores candidates with that matcher through a new
  `content/identity/score.ts`, and `resolve-target.ts` calls it when a strategy
  ties and when every strategy misses. Confidence is Core's own measurement of
  the winning candidate.
- **The content bundle grew 18,974 bytes (8.5%)** and the number is attributed
  exactly, not inferred from two totals. Detail in
  [Bundle size](#bundle-size-measured-and-attributed).

**One line of the definition of done is not met as written, and cannot be.**
"Spec rows proving each `identity-drift` mode resolves to the intended control
above the floor" — all four modes do resolve to the intended control, and there
is a passing row for each, but every one of them resolves through a Level 1
*exact* strategy, so no score is involved and "above the floor" does not apply.
On that fixture, whenever Level 2 is reachable the best candidate scores below
any floor worth having, and whenever a candidate would score above the floor
Level 1 has already resolved it exactly. The measured numbers are in
[What the floor is worth](#what-the-floor-is-worth-measured) and the reason is
structural, not a threshold that needs tuning.

**One deliberate divergence from the brief:** no `paths` entry was added to
`apps/extension/tsconfig.json`. It is not needed and would be harmful. Proof and
reasoning in [Why there is no tsconfig paths entry](#why-there-is-no-tsconfig-paths-entry).

## What changed and why

### Core (`F:\!FluxIQ`)

**`packages/fluxiq/package.json`** — added

```json
"./automation-studio/fingerprinting": {
  "types": "./dist/programs/automation-studio/fingerprinting/index.d.ts",
  "import": "./dist/programs/automation-studio/fingerprinting/index.js"
}
```

placed with the other `automation-studio/*` subpaths, and bumped `fluxiq` from
`0.2.0` to `0.2.1`. The bump is Core's own written policy
(`docs/architecture/package-boundaries.md`: "compatible changes increment the
patch version"), and an additive export is a compatible change. Both lockfiles
record `fluxiq` as a `link:` with no version, so nothing else moves; the version
is exercised by `pnpm package:smoke`, which installs the packed tarball into a
clean consumer and reported `+ fluxiq 0.2.1`.

**D1's premise was wrong in one respect and right in another.** The plan says
Core's matcher "is public via `fluxiq/automation-studio`, has type-only imports,
and bundles under the existing esbuild `platform: browser` build". The middle
clause is true — `element-fingerprint.ts` and `contracts.ts` import only types,
from `core/index.ts` and `automation-studio/model/`, and compile to JavaScript
with no imports at all. The first and third are false, and only because of
*where* it was published: the `automation-studio` barrel also re-exports `dsl/`
and `testing/`, which reach `node:crypto` and `node:perf_hooks`, and esbuild
reports those as resolution errors before tree-shaking can drop them. So the
defect was packaging, exactly as `w3-resolver` diagnosed, and the fix is a
subpath rather than any change to the module.

**`packages/fluxiq/src/programs/automation-studio/fingerprinting/tests/index.test.ts`** (new)
— because "browser-safe" was already assumed once and the assumption is what
cost the wave a brief. Three assertions: the `exports` entry exists and points at
this barrel; the barrel's runtime closure (following only value imports) never
leaves the `fingerprinting/` directory; and no module in that closure imports a
Node built-in or has a runtime import of anything outside its directory. A value
import added anywhere in the closure fails the test, so the subpath cannot
quietly become Node-only again.

**`scripts/validate-packages.mjs`** — `automation-studio/fingerprinting` added to
the release runtime-smoke subpath list, so the packed tarball is proven to expose
it in a clean consumer install.

**`docs/architecture/package-boundaries.md`** — a paragraph on why one subpath of
a Node package is not Node-only, what the invariant is, and which test keeps it;
plus the version line. **`docs/architecture/automation-studio.md`** — the
`fingerprinting` ownership bullet now says it is the one Automation Studio folder
published as its own subpath, and why.

### Extension

**`apps/extension/scripts/build-extension.mjs`** — one `onResolve` entry mapping
`fluxiq/automation-studio/fingerprinting` to Core's source barrel, beside the
existing `fluxiq/client-gateway` alias, and a doc comment on the plugin
explaining that the two aliases exist for *different* reasons:

- `fluxiq/client-gateway` **must** be aliased: its published entry is the gateway
  service, which reaches Node built-ins.
- `fluxiq/automation-studio/fingerprinting` **need not** be. It resolves and
  bundles for a browser straight through the `exports` map — measured, see the
  commands table. It is aliased anyway so no extension bundle ever reads Core's
  `dist/`, which Core's own build deletes and rewrites (`tsc -b --clean && tsc
  -b`); a Core build running beside a content-harness run would otherwise fail
  the bundle or feed it half a directory. TypeScript still resolves the same
  specifier through the `exports` map, so the published subpath is exercised by
  `pnpm check` rather than taken on trust.

**`apps/extension/src/content/identity/score.ts`** (new, 165 lines). Delegates
every judgement Core owns and contributes only the three a browser host has to
make:

1. **Which recorded signals to compare.** The nine a live candidate can also
   produce: `visibleText`, `accessibleName`, `label`, `id`, `testId`, `tagName`,
   `role`, `selector`, `classNames`. The recorded descriptor also carries an
   xpath, an attribute map and capture-time viewport bounds;
   `candidateFingerprint` produces none of the first two, and its bounds are this
   instant's. Handing Core a signal no candidate can answer costs every candidate
   the same penalty — no discrimination, and it drags the whole pool under the
   floor. `role` falls back to `implicitRole`, matching how a candidate reports
   its own, so a page that writes no ARIA still compares like with like.
2. **The floor**, `TARGET_SCORE_FLOOR = 0.35` on Core's `normalizedScore`.
3. **The margin**, `TARGET_SCORE_MARGIN = 0.20`, between the winner and the
   runner-up.

Plus one guard: a fingerprint carrying only `tagName`/`role` has no identity in
it — every candidate in the pool was *selected* for sharing those — so it is
`unmatched` rather than a page-wide tie.

`scoreTargetCandidates` returns `resolved` / `ambiguous` / `unmatched` and always
carries the full ranking, so a refusal can report what it weighed and how close
the call was. Core's `minimumNormalizedScore` is passed as `-1` deliberately:
Core's default of `0` would silently drop the negatives a failure wants to name.

**`apps/extension/src/content/action-runtime/resolve-target.ts`** — Level 2 at
its two entry points:

- *A strategy tied.* Where the gated pool has several elements, the pool is
  described as candidates and scored. A winner resolves as
  `strategy: "scored-candidate"` with `bestScore`, `runnerUpScore` and Core's
  `confidence`; anything else throws TARGET_AMBIGUOUS as before, with each named
  candidate now carrying its score, because "they tied at 1.00" and "the best of
  them reached 0.12" are different problems.
- *Everything missed.* Same-family candidates are enumerated **once** (they were
  already being enumerated for the not-found candidate count) and scored. A
  winner resolves; several plausible ones throw TARGET_AMBIGUOUS naming the top
  of the ranking with scores; nothing plausible falls through to the unchanged
  TARGET_NOT_FOUND, whose message is still byte-for-byte the one the module
  shipped with.

One latent bug fixed while wiring: the family fallback was `target.role ??
target.implicitRole`, and the descriptor writes `""` rather than omitting an
absent role, so `??` never fell through. It is `||` now, in both the family and
the scored fingerprint.

**`apps/extension/src/content/identity/index.ts`** — exports `score.ts`.

### Tests and specs

**`apps/extension/src/content/identity/tests/score.test.ts`** (new, 6 tests).
Covers the selection policy only — the scoring itself is Core's and has Core's
tests; a second copy here would be the second scorer this whole change exists to
avoid. The import is itself part of the proof: the extension's test runner leaves
`fluxiq/*` external, so **Node resolves `fluxiq/automation-studio/fingerprinting`
through the `exports` map at run time**. Before this change the file could not
have loaded.

**`apps/extension/e2e/content/tests/identity-resolution.spec.ts`** — four new
rows in a new `scored selection` block, all passing in real Chromium:

| Row | Proves |
| --- | --- |
| the recorded **secondary** control wins the tie its selector could not break | `selector: "button"` matches both Continue buttons and the gate prefers neither; the recorded descriptor decides it. Was TARGET_AMBIGUOUS. |
| the recorded **primary** control wins the tie its selector could not break | The mirror, so the row is not passing because scoring happens to pick the second. |
| a descriptor that cannot tell the twins apart leaves them tied | `{tagName, visibleText}` scores both at 1.00; still TARGET_AMBIGUOUS, and the message now carries `(1.00)` beside each name. |
| a control whose every recorded signal has drifted is refused, not approximated | `identity-drift` in `selector-only` with the text taken away too. TARGET_NOT_FOUND, `candidateCount: 2`, `saveCount: 0`, `discardCount: 0`. |

That last row is the important one. The highest-scoring button on that page is
**Discard**, at −0.360, ahead of the real Save action at −0.375, on a shared
class prefix. A resolver without a floor would have clicked Discard. The floor is
what makes "deterministic fallback" mean refusal rather than a plausible guess.

## What the floor is worth (measured)

Every number below is Core's, produced by running `score.ts` against the
fixtures' actual markup. The floor is 0.35 and the margin 0.20.

`identity-drift`, baseline descriptor scored against each rendering's Save
action, with Discard as the only other candidate:

| Rendering | Outcome | Save action | Discard |
| --- | --- | --- | --- |
| `selector-only` | unmatched | 0.149 (confidence 0.140) | −0.360 |
| `selector-only` + text also drifted | unmatched | **−0.375 (second)** | **−0.360 (first)** |
| `text-only` | unmatched | 0.170 (confidence 0.150) | −0.360 |
| `moved` / `wrapped-aria` | **resolved** | 0.694 (confidence 0.694) | −0.360 |

`ambiguous-targets`, the two Continue buttons:

| Recorded descriptor | Outcome | Scores |
| --- | --- | --- |
| the secondary button | **resolved** | secondary 1.000 (confidence 1.000), primary 0.382 |
| `{tagName, visibleText}` only | ambiguous | both 1.000 |

The floor sits in the gap between 0.170 and 0.694, and the margin between 0.000
and 0.618. Neither was chosen to make a row pass: the `moved`/`wrapped-aria`
signature (everything agrees except a test id the page no longer writes) is the
weakest case that *should* resolve, and it clears the floor by twice the margin.

### Why "each drift mode above the floor" is unreachable, and it is not the floor's fault

Level 1's chain — selector, xpath, id, test id, authored name, class names, then
exact visible text — is thorough. On `identity-drift`:

- `text-only`, `moved` and `wrapped-aria` all keep `id="save-settings"`, so the
  recorded selector resolves exactly. Level 2 is never reached.
- `selector-only` changes the id, class and test id but keeps the text, so the
  text fallback resolves it exactly. Level 2 is never reached.
- Taking the text away as well is the only way to reach Level 2 — and at that
  point nothing the recording knew the control by survives, both candidates score
  negative, and the higher of the two is the wrong control.

So Level 2 is reachable on this fixture only in the case where it must refuse.
Core's matcher penalises a *missing* stable identifier at −0.55 × 26 for an id
and −0.55 × 28 for a test id, so a page that dropped both starts 30 points down
before any text is compared; that is Core's weighting and this brief must not
touch it. Level 2 earns its place elsewhere, on the tie-break, where it turns
what was a refusal into the right element.

**What would make the drift modes exercise scoring** is a fifth
`identity-drift` rendering that changes the text *and* keeps one strong signal —
say, `aria-label="Save changes"` on a button with a new id, no test id and new
text. That scores about 0.5 and would resolve. It is a fixture change
(`apps/scenario-lab/src/scenarios/identity-drift/`), outside this brief's Owns,
and worth one line of a later one.

## Bundle size, measured and attributed

Two raw measurements, both through `bundleExtensionEntry` into the scratchpad
(`build/` and `dist/` untouched, confirmed by `git status`):

| When | Content bundle |
| --- | --- |
| Before `score.ts` existed (alias already in place) | **200,598 bytes** |
| After | **221,995 bytes** |

**Do not read 21,397 as this change's cost.** The two runs are ~20 minutes apart
and other workers changed `content/actions/assert.ts` and `validation-outcome.ts`
in between; a later run measured 222,480. The exact figure comes from esbuild's
metafile for the content entry:

| Modules | Bytes in output |
| --- | --- |
| Core `automation-studio/fingerprinting` (2 modules) | **16,740** |
| `content/identity/score.ts` | **2,234** |
| **This change, total** | **18,974 (8.5% of the bundle)** |
| For comparison: `@fluxiq-web-extension/domain/client` (21 modules) | 33,768 |

Context the supervisor asked for: the tracked pre-Wave-3 `build/content/index.js`
is 133,020 bytes, so the content script has grown about 67% across the whole of
Wave 3. Of that growth, **the domain client barrel is the larger single cause at
33,768 bytes and remains unratified**; Core's matcher is 16,740. The matcher is
also the tighter of the two: it is two files with no dependencies, where the
domain client pulls 21 modules of schemas, capabilities, output nodes and
recording state to reach a table of failure codes.

**My reading, for the ratification decision.** 16.7 KB unminified, uncompressed,
for the capability an exit criterion names, in a script that is not fetched over
a network, seems worth it — and D1's documented fallback (the content script
returns candidates and Core scores them out of process) costs a round trip per
ambiguous action on the critical path of every click, which is a worse trade for
a page that is already moving. But the decision is the supervisor's and the
alternative is still open: `score.ts` is the only module that imports the
matcher, and `scoreTargetCandidates` is the only seam that would have to become
asynchronous.

## Why there is no tsconfig `paths` entry

The brief asked for one; it is not needed and would be actively harmful, and both
halves of that are measured rather than argued.

- **Not needed.** `apps/extension` depends on `fluxiq` as a `link:` to Core's
  package directory, so TypeScript resolves the specifier through Core's
  `exports` map. `pnpm --filter @fluxiq-web-extension/extension check` exits 0
  with no `paths` entry.
- **The `exports` entry is what makes that work**, so the Core half is not
  decorative. Removing the entry and re-running the extension's `tsc` produces
  `src/content/identity/score.ts(38,8): error TS2307: Cannot find module
  'fluxiq/automation-studio/fingerprinting'`. The entry was restored immediately
  and the manifest diff is two lines.
- **Harmful.** A `paths` entry could only point at Core source, and Core source
  imports with explicit `.ts` extensions — the extension would need
  `allowImportingTsExtensions`, and would then type-check Core's source under the
  extension's own compiler options. It would also contradict Core's package
  boundary rule that consumers must not depend on repository TypeScript sources.

The split that results is the one `fluxiq/client-gateway` already uses:
TypeScript through the published `exports` map, esbuild through a source alias.
Both halves are therefore exercised by a gate.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w3-matcher-packaging` was set for every extension
command. No `pnpm lab` run. Exit status was captured by redirecting to a file and
echoing `$?`, never through a pipe. Every file was written with the editing
tools, never a Bash heredoc.

### Core (`F:\!FluxIQ`)

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm structure:test` | **0** | `# fail 0` |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (copy of `.git/index` with the new test staged; the real index was never written) | **1** | One violation: `[working-docs] docs/working/README.md is out of date with the documents' header blocks.` **Pre-existing and not mine** — `git status docs/working` is empty, so the rule's inputs are byte-identical to HEAD, and the fix (`pnpm structure:baseline`) is forbidden by the wave's binding rules. No finding names a file this brief touched. |
| `pnpm -r check` | **0** | contracts, client-gateway-websocket, fluxiq, apps/web all `Done`. |
| `pnpm -r test -- --no-file-parallelism` | **0** | `packages/fluxiq: 129 test files passed`; `apps/web: 227 test files passed`; contracts and client-gateway-websocket 1 each. No worker loss. |
| `npx vitest run --no-file-parallelism .../fingerprinting/tests/index.test.ts` | **0** | `3 passed`. |
| `pnpm docs:check` | **0** | `Validated local links in 99 authored/reference Markdown files.` / `Deterministic framework reference is current.` |
| `pnpm package:lint` | **0** | publint + attw over all three packages; `fluxiq v0.2.1`, `node16 (from ESM) 🟢`, `bundler 🟢`. |
| `pnpm build` | **0** | contracts, fluxiq, client-gateway-websocket, web all built. |
| `pnpm package:smoke` (Git Bash) | **1** | **Environmental, pre-existing:** `tar -tf C:\...\fluxiq-contracts-0.2.0.tgz failed with exit code 128. tar: Cannot connect to C: resolve failed` — MSYS `tar` reading a Windows path as a remote host, on the *first* tarball, before anything of mine. |
| `pnpm package:smoke` (PowerShell) | **0** | `Packed-package validation passed.` with `+ fluxiq 0.2.1`. This is the run that proves the new subpath imports from a packed tarball in a clean consumer install. |

Core `pnpm check` as a single command therefore still exits 1, on the
pre-existing working-doc index staleness. Its three parts were run individually
and the two that are about code both pass.

### Extension (`F:\!FluxIQWebExtension`)

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter ...extension check` | **0** | `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no diagnostics. Run three times across the change, including after Core's rebuild. |
| `pnpm --filter ...extension test` | **0** | `# tests 215 / # pass 215 / # fail 0`, including the six new `score.test.ts` cases (subtests 121–126). |
| `playwright test -c e2e/playwright.content.config.ts content/tests/identity-resolution.spec.ts --workers=4` | **0** | `16 passed (5.6s)` — the four drift modes, the four new scored rows, the gate rows and the visual-target rows. |
| Full content harness, `--workers=4` (first run) | **0** | `185 passed (27.0s)`. |
| Full content harness, `--workers=4` (final run) | **1** | `184 passed, 1 failed`. The failure is `failures.spec.ts › on navigation › a post-condition that never appears is OUTPUT_NOT_OBSERVED` with `Tearing down "openHarness" exceeded the test timeout of 30000ms` — a harness teardown timeout, not an assertion, in a file this brief does not own. |
| `playwright test ... content/tests/failures.spec.ts --workers=4` (rerun of the above) | **0** | `10 passed (3.1s)`. Same file passed in the earlier full run too, so the single failure was load. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (the two new files staged; the real index never written) | **0** | Clean. The two violations `w3-resolver` reported here have since been fixed by others. |
| Bundle probe: all five entries through `bundleExtensionEntry` into the scratchpad | **0** | background 222,353 / content 222,480 / page-world 4,053 / popup 19,529 / sidepanel 19,529. `git status apps/extension/build apps/extension/dist` empty afterwards. |
| Bundle probe: the content bundle loaded in a bare V8 context | **0** | Parses and executes to `ReferenceError: window is not defined`, i.e. it runs until it reaches a browser API. Carries `DEFAULT_ELEMENT_FINGERPRINT_WEIGHTS`; matches no `"node:*"` specifier. |
| Subpath probe: esbuild `platform: "browser"` on `import { createAutomationStudioElementMatcher } from "fluxiq/automation-studio/fingerprinting"`, **with no alias**, then executed | **0** | Graph is exactly the three `dist/.../fingerprinting/*.js` files; 17,460 bytes; no `node:` specifier; ran and returned the expected winner and confidence. This is the run that proves the `exports` map alone is enough for a browser bundler. |
| `tsc -p tsconfig.json --noEmit` with the Core `exports` entry temporarily removed | **2** | `error TS2307: Cannot find module 'fluxiq/automation-studio/fingerprinting'`. Entry restored; `git diff` on the manifest shows only the version line and the new export. |

No `pnpm build` was run in this repository, per the wave's binding rules. No
domain file was touched, so no domain command was run.

## Not verified

- **No live browser validation of a real replay.** Everything ran in the content
  harness (the real content bundle, real Chromium, a Scenario Lab fixture) with
  no extension, no background worker and no gateway. What a Flow sees end to end
  was not exercised.
- **A successful resolution's `resolution` field still reaches nothing**, so none
  of the scored numbers are observable on a passing action. This is
  `w3-resolver`'s open question 2 and it is unchanged: `buildResult` fills
  `result.resolution` from `ActionResultEvidence.resolution`, no verb passes one,
  because `ContentActionDependencies.resolveTarget` is typed to return `Element`.
  Closing it means `content/actions/types.ts`, `execute-action.ts` and the nine
  verbs that resolve a target — none in this brief's Owns.
  `resolveTargetWithDiagnostics` is the adoption point and needs no further
  change. **Until that lands, `bestScore`, `runnerUpScore` and `confidence` reach
  a Flow only on the failure path**, which is why the scored-tie rows assert the
  element that was acted on rather than the numbers, and the numbers are pinned
  by the unit test instead.
- **The floor and the margin are calibrated against two fixtures**, not against
  a corpus of real pages. They are the honest reading of the measurements above,
  not a tuned result, and a wider corpus could move them.
- **`pnpm check` at either repository root was not run as a single command** —
  Core's fails on the pre-existing working-doc index and this repository's root
  check is not meaningful while other workers are mid-edit. The audit, which is
  the first thing each runs, was run directly in both.
- **`pnpm package:smoke` only passes under PowerShell here.** The Git Bash
  failure is an MSYS `tar` path defect that predates this change and hits the
  first tarball; it is worth someone's attention because it makes the release
  gate silently unrunnable from the shell most of this work uses.
- **The tree was not quiet.** The brief said it was. During this work other
  agents modified `background/connection.ts`,
  `background/connection/recording-evidence.ts`, `content/actions/assert.ts`,
  `content/action-runtime/validation-outcome.ts`, `domain/package.json` and
  `packages/test-runner/`, and added two report files. Nothing collided with this
  brief's Owns, but the bundle-size caveat above is a direct consequence.

## Open questions or contradictions found

1. **The identity-drift fixture cannot exercise Level 2's success path**, for the
   structural reason set out above. A fifth rendering that drifts the text while
   keeping one strong signal (an `aria-label`, say) would fix that and is one
   line of markup in `apps/scenario-lab/src/scenarios/identity-drift/`. Until
   then, Level 2's win is proven on `ambiguous-targets` and in the unit test, and
   its refusal is proven on `identity-drift`.
2. **`w3-resolver`'s note that the wire drops `implicitRole` is now out of date.**
   `domain/src/output-nodes/targets.ts` `elementFingerprint` currently keeps
   `role`, `implicitRole`, `testId`, `accessibleName` and `label` — all five of
   the signals it was said to drop. Every one of the nine signals `score.ts`
   compares therefore survives to a live replay, so the measured scores above
   transfer from the harness to a Flow. Worth confirming which brief widened it
   so the plan's note can be corrected.
3. **The `fluxiq` version bump is a release decision I made on Core's written
   policy.** `docs/architecture/package-boundaries.md` says a compatible change
   increments the patch version, so `0.2.0` → `0.2.1`. Nothing pins the version
   (both lockfiles record `link:` paths) and `package:smoke` passes against the
   packed `0.2.1`. If the supervisor would rather hold the version until a
   release, it is a one-line revert in `packages/fluxiq/package.json` plus the
   line in `package-boundaries.md`.
4. **The domain client barrel is the larger unratified bundle cost**, at 33,768
   bytes across 21 modules against the matcher's 16,740 across 2. A narrow
   `./failure` subpath on `@fluxiq-web-extension/domain` plus an alias in the
   esbuild plugin would remove most of it — `w3-resolver` said the same, and the
   ratification decision is now easier to take with both numbers side by side.
5. **`docs/working/README.md` is stale in Core** and fails the `working-docs`
   rule, so Core's `pnpm check` cannot exit 0 today. Regenerating it is the
   supervisor's (`pnpm structure:baseline` is forbidden to workers, and the index
   is a shared document).
