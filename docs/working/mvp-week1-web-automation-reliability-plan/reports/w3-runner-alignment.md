# Report: w3-runner-alignment

Worker: `w3-runner-alignment`. Wave 3, parallel: Phase 1.5 step 5 — stop the
test runner from keeping a private copy of the domain's vocabularies.

## Outcome

**Partial.** Two of the three tasks are done and verified, and both turned out
to be hiding real bugs. The third — deriving the allowlist from the domain code
set — **cannot be done from this package**, and not for a reason the brief could
have known: `@fluxiq-web-extension/domain` is a bundler-only package that
`packages/test-runner` cannot consume at all, at runtime or for types. I proved
that with four probes rather than assuming it; the commands and their exact
output are below. Adding the `workspace:*` dependency, as the brief's second
correction instructs, is necessary but nowhere near sufficient.

What landed:

- `runnerFailureCategories` is gone, with no reference left anywhere but the
  planning documents.
- The evidence-step sanitizer's two allowlists in `demo-llm-create-ui.ts` were
  **both wrong**, and both are corrected and covered by a test with a verified
  negative control. This was silently discarding real evidence.
- `bench/evaluate-run.ts`: the coercion the brief asked me to align is already
  on the right axis, and I have pinned that with a test rather than changed it.

`pnpm --filter @fluxiq-web-extension/test-runner check` and `test` both pass
(394 tests, 0 failures). The structure audit reports no finding against any file
I own.

## The blocker, with evidence

The brief says: add `@fluxiq-web-extension/domain` as a `workspace:*` dependency
"and import the set from its runtime barrel". The dependency resolves; the
import does not. `packages/test-runner` is a plain `tsc` + `node --test` package
on `"moduleResolution": "NodeNext"`. The domain package is built for a bundler
and for nothing else:

1. **Node cannot load it.** `domain/package.json` maps `"."` to
   `./src/index.ts`, a TypeScript file:
   `ERR_UNKNOWN_FILE_EXTENSION Unknown file extension ".ts" for F:\!FluxIQWebExtension\domain\src\index.ts`.
2. **Node cannot load its build either.** `domain/dist/index.js` carries
   `export * from "./constants";` — tsc never rewrites specifiers, and the
   domain compiles under `"moduleResolution": "Bundler"`
   (`tsconfig.base.json`), so nothing in `dist` has the `.js` extensions Node
   ESM requires:
   `ERR_MODULE_NOT_FOUND Cannot find module '...\domain\dist\constants' imported from ...\domain\dist\index.js`.
3. **TypeScript cannot read its types either**, so even a type-only derivation
   is out. A one-line probe importing `WebAutomationFailureCode` produced 16
   errors from the domain's own source plus the two that matter:
   `error TS2835: Relative import paths need explicit file extensions ... Did you mean './constants.js'?` (×16, in `domain/src/index.ts`) and
   `error TS2305: Module '"@fluxiq-web-extension/domain"' has no exported member 'WebAutomationFailureCode'`.
   `domain/dist/index.d.ts` has the same extensionless re-exports, so pointing
   the map at the build would not fix it.
4. **Every existing consumer bundles.** `apps/extension` goes through esbuild,
   and the domain's own tests go through `domain/scripts/test-domain.mjs`, which
   esbuilds each test file. There is no precedent for consuming this package
   without a bundler because there has never been a consumer that had to.

So the file the brief should have included is **`domain/package.json`** — and
one line there is not enough either. Making the code set importable needs one of:

- **Give the domain a Node-consumable build.** `exports` gains a dual condition
  in the shape `packages/test-contracts` already uses
  (`{"types": "./src/index.ts", "import": "./dist/index.js"}`), which requires
  the domain's relative specifiers to carry `.js`. That is a repository-wide
  edit to `domain/src`, not a Wave 3 brief.
- **Bundle just the vocabulary.** The domain already has esbuild and a
  `host:build` script that emits a self-contained `.mjs`. A second entry
  emitting `dist/node/failure.mjs` plus a matching subpath export would work
  for values; the types would still need a flattened `.d.ts`.
- **Move the closed set to a package both sides can consume.** It is a product
  contract shared by the extension, the domain and the test rig, and today no
  package in this repository has that shape for it.

Which of the three is right is an architecture decision, so I have not taken it.
I have left the dependency declared, because the brief instructed it and every
remedy needs it — but see the cost in the open questions.

## What changed and why

### `packages/test-runner/src/failure.ts`

`runnerFailureCategories` removed. It was dead (no importer in `src`; the only
other hits were the stale `dist/failure.d.ts` and the audit reports) and wrong
(10 of the contract's 17 categories, omitting `fixture.invalid`,
`extension.worker` and `security.redaction`, all of which the runner produces —
`reports/audit-failures.md` item 4). `RunnerFailureCategory`, `RunnerFailure`
and `classifyRunnerFailure` are untouched; roughly fifty modules import them.

In its place the file carries a header stating the two-axis rule the brief
warns about — the test-rig taxonomy is why the *facility* could not produce a
trustworthy run, the domain's `web.*` codes are how the *automation* failed —
and the exact reason the domain set cannot be derived here, so the next agent
does not spend the afternoon rediscovering it.

### `packages/test-runner/src/demo-llm-create-ui.ts`

The brief names one allowlist; the sanitizer has two adjacent ones, feeding the
same function, and **both had drifted from the domain**. Fixing only the one
named would have left the sanitizer still dropping real evidence, so I fixed
both and said so here rather than shipping a half-fix quietly.

`WEB_EVIDENCE_TOOL_IDS` allowed `web.inspect_current_page`,
`web.navigate_same_origin`, `web.click_safe`, `web.fill_safe` and
`web.select_safe`. The domain's `getEvidenceTools()` offers exactly three:
`web.inspect_current_page`, `web.navigate_same_origin` and **`web.reveal_safe`**
(`domain/src/runtime/llm-evidence.ts:8-10`). The other three exist only in
Core's own test fixtures (`flow-bootstrap/tests/generation-failure.test.ts`,
`llm/tests/evidence-loop-provider.test.ts`) — the list was copied from there.
Consequence: **every `web.reveal_safe` step was silently dropped** from the
sanitized diagnostic, and three tool ids no host offers were admitted.

`WEB_EVIDENCE_RESULT_CODES` listed the two success codes and five of the six
rejections, omitting `web.action.rejected.no_progress`. `WebLlmToolRejectionCode`
has six members and `no_progress` is produced on two paths
(`llm-evidence.ts:177` and the reveal path), so those steps were dropped too.

Both lists now match what the domain emits, and the rejection codes are built
from the six leaf codes with the `web.action.rejected.` prefix applied once, so
the prefix at least cannot drift. The file is **still exactly 837 lines**, its
baselined value: I converted the blank line above the two constants into the
comment naming the domain module as the source of truth, so the fix cost no
line. This is a corrected mirror, not a derivation — the honest description.

### `packages/test-runner/src/bench/evaluate-run.ts`

**The coercion the brief asked me to align is already correct, and I did not
change its behaviour.** `testRigCategory` maps anything outside
`failureCategories` to `unknown`, and that is right: the value it coerces is
`RunScenarioResult.failureCategory`, whose only producer is
`classifyRunnerFailure` (`run-scenario.ts:318,343`), which returns a
`RunnerFailureCategory` — that is, a test-rig `FailureCategory`. The domain axis
never arrives there. It arrives on `automationFailureReported`, which the same
file builds from `manifest.automationFailure` in `reportedOutcome`, and which is
validated by Core's own class list in `test-contracts`.

I read the brief's second correction ("Do not conflate it with
`failureCategories`... that is the test-rig evaluation taxonomy, a different
axis") as settling this: the alignment is to *keep* the axes apart, not to widen
the list. I have documented both functions to that effect and added a test that
fails if a Core class or a domain code ever starts coercing to something other
than `unknown` here.

What I could not do is validate `automationFailureReported.code` against the
closed domain set — that needs the import that does not exist. Writing a second
copy of the set here to check against would be the very drift this brief exists
to remove, so I did not. It is documented in place.

### Tests

- `src/tests/demo-llm-create-ui.test.ts`: a new test pushes all three domain
  tool ids and all eight domain result codes through the public
  `readSanitizedGenerationFailure` seam and asserts every step survives, then
  pushes the three phantom tool ids and two well-formed-but-unlisted result
  codes and asserts every one is dropped. The domain vocabulary is restated at
  the top of the test with a comment naming its source, so the guard is
  greppable from either side. Core caps `steps` at 16, so the admitted set is
  11 steps rather than the full 3×8 cross product.
- `src/bench/tests/evaluate-run.test.ts`: a new test pins the axis separation
  (three foreign values coerce to `unknown`; a run carrying both a test-rig
  category and an automation failure keeps them apart). I also changed the
  existing fixture's invented code `E_TARGET` to the real `web.target.not_found`,
  so the test stops teaching a code that is not in the closed set.

### `packages/test-runner/package.json` and `pnpm-lock.yaml`

`"@fluxiq-web-extension/domain": "workspace:*"` added to `dependencies`, as
instructed. `pnpm-lock.yaml` gained the three-line importer entry; that file is
not in my Owns, but a dependency cannot be added without it.

## Commands run and observed results

Exit status was captured by redirecting to a file and echoing `$?`, never
through a pipe. No `pnpm build`, no `pnpm lab`, no `pnpm structure:baseline`.
The test-runner has no build-label variable; its harness writes to its own
`dist/`, which no other Wave 3 brief touches.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | 0 | `tsc -p tsconfig.json --noEmit`, no diagnostics. Run again after the negative control was reverted: 0. |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | 0 | `# tests 394 / # pass 394 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0`. Both new tests present and passing: `ok 10 - the test-rig category and the automation's own failure stay on separate axes`, `ok 203 - the evidence-step sanitizer admits exactly the tools and result codes the domain produces`. |
| Negative control: `web.reveal_safe` and `no_progress` removed from the allowlist, then `build` + `node --test dist/tests/demo-llm-create-ui.test.js` | 1 | `not ok 19 - the evidence-step sanitizer admits exactly the tools and result codes the domain produces`, `# fail 1`. The guard is real, not vacuous. Reverted from a scratch copy; the file is byte-identical and still 837 lines. |
| `node scripts/structure-audit.mjs` (twice) | 1 | Both runs: 27 warnings and exactly one `FAIL` — `[working-docs] docs/working/README.md is out of date with the documents' header blocks`. **Not mine**: I touched no document but this report, `README.md` was already modified before I started, and other Wave 3 workers are writing reports into the same tree. Every `packages/test-runner` finding is a `warn`, all pre-existing and none ratcheted. `demo-llm-create-ui.ts` does not appear — it is baselined at 837 and did not grow. |
| `pnpm install --filter @fluxiq-web-extension/test-runner --prefer-offline` | 0 | `Lockfile only installation`, `Done in 1.1s`. `packages/test-runner/node_modules/@fluxiq-web-extension/domain` now exists; `apps/extension/node_modules` unchanged at 7 entries; `git diff --stat pnpm-lock.yaml` → `1 file changed, 3 insertions(+)`. |
| `pnpm install --frozen-lockfile --filter @fluxiq-web-extension/test-runner` | 0 | `Lockfile is up to date, resolution step is skipped`. The lockfile matches the manifest. |
| Probe: `node -e "import('@fluxiq-web-extension/domain')"` from `apps/extension` | — | `ERR ERR_UNKNOWN_FILE_EXTENSION Unknown file extension ".ts" for F:\!FluxIQWebExtension\domain\src\index.ts` |
| Probe: `node -e "import('.../domain/dist/index.js')"` | — | `ERR ERR_MODULE_NOT_FOUND Cannot find module '...\domain\dist\constants' imported from ...\domain\dist\index.js` |
| Probe: a four-line `src/w3-probe-resolution.ts` importing two domain types, then `tsc -p tsconfig.json --noEmit` | 2 | 16 × `TS2835` inside `domain/src/index.ts`, plus `TS2305: Module '"@fluxiq-web-extension/domain"' has no exported member 'WebAutomationFailureCode'` and the same for `WebLlmToolRejectionCode`. Probe file deleted. |
| `pnpm ls -r --depth -1 --filter "@fluxiq-web-extension/test-runner..."` | 0 | Now selects `domain` alongside `test-contracts` and `test-evidence`. |
| `grep -rn "runnerFailureCategories"` across `*.ts,*.mjs,*.js,*.json,*.md` minus `node_modules` and `dist` | — | Five hits, all in planning documents. No code reference remains. |
| `git status --short` | — | Only the six files I own plus `pnpm-lock.yaml`. |

## Not verified

- **No live browser validation, no `pnpm build`, no `pnpm lab` run.** All three
  are the supervisor's. The evidence-step sanitizer is exercised only through
  its parser seam with synthetic Core diagnostics, never against a real Flow
  Bootstrap generation failure. The corrected tool-id list changes what a real
  `web.reveal_safe` step does, and that path has not run.
- **`domain` and `extension` package checks were not run.** I own no file in
  either and touched neither.
- **The new Lab build coupling was not exercised.** `pnpm lab`, `pnpm demo:run`
  and `pnpm demo:record` all use `--filter @fluxiq-web-extension/test-runner...`,
  so they now build `domain` as well. I confirmed the selection with `pnpm ls`
  but did not run any of them, since the Lab is serialized and not mine.
- **The stale `packages/test-runner/dist/` is from my last build**, which
  included the negative-control edit for one run before I reverted and rebuilt.
  The final `test` run rebuilt from the restored source, so `dist` matches, but
  `dist` is gitignored and the supervisor's `pnpm build` will overwrite it.
- **Whether the three phantom tool ids were ever load-bearing.** They appear
  only in Core test fixtures and no host in either repository offers them, but I
  did not search Core's git history for a provider that has since been removed.

## Open questions or contradictions found

1. **The dependency currently costs something and buys nothing.** Nothing
   imports `@fluxiq-web-extension/domain`, and it cannot be imported, but its
   presence adds `domain` to the Lab's build graph — so `pnpm lab` now fails if
   the domain does not compile. I kept it because the brief and the dispatch
   both instructed it and every remedy needs it, but if the supervisor is not
   taking one of the three remedies in this wave, the honest move is to drop the
   dependency and the lockfile line until the domain is consumable. I have not
   done that on my own judgement.
2. **This is the wave's ownership defect again, one layer deeper than usual.**
   The brief's Owns is drawn correctly around the *runner*, but the change needs
   the *domain* to be publishable to a non-bundler consumer. That is not a
   missing barrel line — it is a property of how `domain/` is compiled, and it
   affects any future consumer outside the extension bundle. Worth recording in
   `Current State` rather than in this report alone.
3. **A second copy of the vocabulary now exists in the test, deliberately.**
   `DOMAIN_EVIDENCE_TOOL_IDS` and `DOMAIN_EVIDENCE_RESULT_CODES` in
   `src/tests/demo-llm-create-ui.test.ts` restate the domain's list so the
   sanitizer has something to be checked against. That is the same duplication
   the brief is trying to kill, moved from source to test where at least a
   divergence fails loudly rather than dropping evidence silently. It should be
   deleted the moment the import works.
4. **The LLM evidence result codes are a third vocabulary, and the plan conflates
   them with the second.** Phase 1.5 step 3 says "the test-runner's allowlist
   derives from" the closed set in `codes.ts`. It cannot: the allowlist in
   `demo-llm-create-ui.ts` holds evidence-loop *result* codes
   (`web.inspect.succeeded`, `web.action.rejected.<reason>`), which
   `llm-evidence.ts` produces and which are not failure records at all. Deriving
   it from `WEB_AUTOMATION_FAILURE_CODES` would drop both success codes and
   replace five reason-suffixed rejections with the single `web.action.rejected`
   that `llm-evidence.ts` never emits — that is, it would drop *every* step. So
   there are three axes here, not two: the test-rig taxonomy
   (`failureCategories`), the browser-path failure codes (`codes.ts`) and the
   evidence-loop result codes (`llm-evidence.ts`). The plan text and the brief
   should name the third.
5. **`llm-evidence.ts` should export its own vocabulary as runtime values.**
   `WebLlmToolRejectionCode` is a type with no runtime counterpart, and the two
   success codes are bare string literals inside `toolExecution`. Even once the
   import works, only the rejection codes could be derived exhaustively. A
   `WEB_LLM_EVIDENCE_RESULT_CODES` const, and a const tuple plus union type for
   the three tool ids, would make the whole set derivable. `w3-llm-packet` owns
   that file and is splitting it in this wave, so this is a natural follow-up
   for whoever integrates that split.
6. **`RunEvaluation` still has no producer outside the bench**, per
   `reports/audit-failures.md` item 5. Nothing in this brief changes that, and
   the classification-accuracy metric that would settle whether the reported
   codes are right depends on it.
