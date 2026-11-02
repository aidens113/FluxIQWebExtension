# Extension and runner sweep acceptance

Source frozen after fixture-only corrections in paired downstream t843. All ten
extension failures reproduced against unchanged pre-refactor t844 production;
the runner's exact failing case reproduced there after its authorized dependency
artifacts were restored. No production defect was demonstrated by these failures.
Final normal t843 acceptance passed after the lead's post-R5/R7/A1 Core build:
extension source/test typechecks and all five browser entries, extension build,
the runner's four-package dependency build/check, 159 extension tests and 26
runner tests. Every normal Core currency guard passed. No additional source
correction was needed. SOURCE FROZEN.

## Owned changes and causes

| Changed authored file | Verified cause and correction |
| --- | --- |
| `apps/extension/src/background/tests/recording-evidence-pipeline.test.ts` | A seeded frame snapshot cannot attest to topology before that capture. The merge correctly adds literal all-frame coverage with `enumeration: unavailable`, ids `[0]` and captured ids `[0]`. The expected local recording event now carries this explicitly asserted coverage. Full JSON-byte equality remains, covering every other original event field and order. |
| `apps/extension/src/content/action-runtime/tests/pass-row-own-run.test.ts` | The icon fixture asserted the impossible `landmark: dialog`. Capture reports a dialog separately, and the admission gate correctly refused the false landmark. Fixture now uses `dialog: Recipe` and asserts capture's separate dialog/landmark fields. Original row values and exact Keep-element oracle remain. |
| `apps/extension/src/runtime/tests/action-results.test.ts` | Its target-not-found expected whole record omitted authoritative `effect: unacted`. Added the literal field, retaining all original record fields and parser checks. |
| `apps/extension/src/runtime/tests/action-runner.test.ts` | Four expected pre-dispatch refusal records omitted `effect: unacted`; the ambiguous-frame case also expected obsolete `retryable: false`. Updated literal authoritative fields. No-command/no-ping, exact frame, ambiguity and URL-redaction oracles remain. |
| `apps/extension/src/runtime/tests/browser-tab.test.ts` | Its missing-tab expected whole record omitted `effect: unacted`. Added that literal without changing the expected target or observed result. |
| `apps/extension/src/runtime/tests/frame-address.test.ts` | Two expected whole records omitted `effect: unacted`; ambiguous frame expected obsolete retryability. Literal current contract fields replace those stale expectations; ties remain refused and token/origin redaction remains asserted. |
| `packages/test-runner/src/live-llm/tests/live-llm-run.test.ts` | A test assumed configuring Core's ceiling to three times the Lab's ceiling would raise the profile's declared allowance. The planner correctly clamps downward and refuses chat before execution when the declared allowance cannot bind its Flow. Successful case now uses a lower configured Core ceiling; new negative case proves a higher Core ceiling cannot raise the declared whole-build cap. |

The failure table explicitly states that target-not-found and target-ambiguous
are retryable pre-dispatch refusals with `effect: unacted`; retrying never
authorizes selecting a tied candidate. Expected records remain literal, rather
than being rebuilt by the producer being tested. Eight exact whole-record
expectations changed across the four runtime test files.

The Claude default remains $5 for the whole build, with explicit lower limits
preserved. The negative unit fixture configures an unreachable higher ceiling
only to prove refusal; it never authorizes a larger allowance or starts a run.
Production budget, model/provider, identity scoring, dispatch, capture and
privacy behavior are unchanged.

## Final normal t843 acceptance after R5/R7/A1

All final commands used the current paired t843 checkout and the lead's final
normal three-library Core build. Normal build-cache inputs detected the new
Core source/dist and executed the extension and four dependency package
build/check stages. Nested runner domain preparation reused the newly matching
domain build stamp. Tests used current normal package outputs and the normal
targeted extension bundler; no historical overlay or additional source alias
was introduced.

From the downstream repository root:

```text
pnpm.cmd --filter @fluxiq-web-extension/test-runner... build
-> Exit 0. Domain, test-contracts, test-evidence and test-runner built successfully; each normal Core guard passed.

pnpm.cmd --filter @fluxiq-web-extension/test-runner... check
-> Exit 0. All four package checks passed, including actual domain source/test compilation.

pnpm.cmd --filter @fluxiq-web-extension/extension check
-> Exit 0. Both source/test TypeScript projects and all five browser entry bundles passed.

pnpm.cmd --filter @fluxiq-web-extension/extension build
-> Exit 0. All five entries built; Chrome, Firefox and E2E Chromium each verified 22 files.

node scripts/check/core-build.mjs
-> Exit 0. Final sibling t843 Core build is current with its source.
node --test packages/test-runner/dist/live-llm/tests/live-llm-run.test.js
-> Exit 0. 26 tests passed, 0 failed, 0 skipped; 9.19s.
```

From `apps/extension`, the targeted test command ran only after its normal Core
guard succeeded:

```text
node ../../scripts/check/core-build.mjs
-> Exit 0. Final sibling t843 Core build is current with its source.
$env:EXTENSION_TEST_BUILD_LABEL='t843-extension-final-built'; node scripts/test-extension.mjs background/tests/recording-evidence-pipeline.test.ts content/action-runtime/tests/pass-row-own-run.test.ts runtime/tests/action-results.test.ts runtime/tests/action-runner.test.ts runtime/tests/browser-tab.test.ts runtime/tests/frame-address.test.ts background/connection/tests/dom-snapshot.test.ts content/identity/tests/context.test.ts content/identity/tests/record-veto.test.ts content/identity/tests/record-repeated-row.test.ts content/action-runtime/tests/pass-row-resolution.test.ts content/action-runtime/tests/resolve-target-landmark.test.ts
-> Exit 0. Exact twelve-file selection: 159 tests passed, 0 failed, 0 skipped; 27.85s.
```

The five entries are background, content, page-world, popup and sidepanel.
Firefox target verification emitted the existing placeholder `gecko.id` warning
and passed. No unexpected source issue appeared. The $5 whole-Claude-build
default and explicit lower limits retain their existing provider-free unit
oracles; no provider was contacted.

Ignored final evidence:
`.fluxiq/runtime-refactor-sweep/final-extension-acceptance/{runner-closure-build,runner-closure-check,extension-check,extension-build,extension-159,runner-26}.log`.
The foundations acceptance worker was released immediately after the shared
dependency build/check completed, including the domain incremental writes.
Its separate domain31/52 runs are outside this report's claimed test results.

All final commands completed. The lead was notified that the last guarded test
command had finished; no shared output write remains from this worker. Only this
owned report and ignored validation artifacts changed during final acceptance.
Core and downstream source remain frozen for the checkpoint commit.

## Earlier normal t843 acceptance

These earlier commands ran in the paired t843 checkout before the final
R5/R7/A1 source batch, against its then-current sibling Core build. No historical overlays or additional
Core/domain source aliases were used. This acceptance update changes this
report only; all seven previously corrected fixture files remained frozen.

From the repository root:

```text
pnpm.cmd --filter @fluxiq-web-extension/test-runner... build
-> Exit 0. Domain, test-contracts, test-evidence and test-runner all built successfully; current Core currency guards passed.

pnpm.cmd --filter @fluxiq-web-extension/extension check
-> Exit 0. Both source/test TypeScript projects and all five browser entry bundles passed.

pnpm.cmd --filter @fluxiq-web-extension/extension build
-> Exit 0. Source typecheck and all five entry builds passed; Chrome, Firefox and E2E Chromium each verified 22 files.

pnpm.cmd --filter @fluxiq-web-extension/test-runner... check
-> Exit 0. All four dependency-closure package checks passed, including the domain source/test projects.

node --test packages/test-runner/dist/live-llm/tests/live-llm-run.test.js
-> Exit 0. 26 tests passed, 0 failed, 0 skipped; 6.57s.
```

From `apps/extension`:

```text
$env:EXTENSION_TEST_BUILD_LABEL='t843-extension-current'; node scripts/test-extension.mjs background/tests/recording-evidence-pipeline.test.ts content/action-runtime/tests/pass-row-own-run.test.ts runtime/tests/action-results.test.ts runtime/tests/action-runner.test.ts runtime/tests/browser-tab.test.ts runtime/tests/frame-address.test.ts background/connection/tests/dom-snapshot.test.ts content/identity/tests/context.test.ts content/identity/tests/record-veto.test.ts content/identity/tests/record-repeated-row.test.ts content/action-runtime/tests/pass-row-resolution.test.ts content/action-runtime/tests/resolve-target-landmark.test.ts
-> Exit 0. Exact twelve-file safety selection: 159 tests passed, 0 failed, 0 skipped; 25.55s.
```

The five browser entries are background, content, page-world, popup and
sidepanel. The current build script assembles three distributables from them:
Chrome, Firefox and E2E Chromium. Firefox verification emitted its existing
placeholder `gecko.id` warning and still passed; no browser was opened.

Ignored evidence lives in
`.fluxiq/runtime-refactor-sweep/current-extension-acceptance/`:

- `runner-closure-build.log`
- `extension-check.log`
- `extension-build.log`
- `runner-closure-check.log`
- `extension-159.log`
- `runner-26.log`

Domain compiled outputs were stable before releasing the foundations worker's
normal domain acceptance, and its shared check output was released after the
domain source/test check completed. The last Core-guarded command was the
successful runner closure check; the lead was notified before making any queued
Core tooling changes. No further command is pending from this acceptance task.

## Baseline comparison

Commands ran in t844 unless an explicit t843 probe path is shown. Baseline
production and test sources were never edited; generated test/build artifacts
were the only baseline writes. There were zero provider calls and no browser.

```text
$env:EXTENSION_TEST_BUILD_LABEL='t843-extension-baseline'; node scripts/test-extension.mjs background/tests/recording-evidence-pipeline.test.ts content/action-runtime/tests/pass-row-own-run.test.ts runtime/tests/action-results.test.ts runtime/tests/action-runner.test.ts runtime/tests/browser-tab.test.ts runtime/tests/frame-address.test.ts
-> From t844 apps/extension: 87 tests, 77 passed, 10 failed, matching the sweep; 26.62s.

pnpm.cmd --filter @fluxiq-web-extension/test-runner... build
-> Authorized baseline artifact restore/build: all four packages passed; Core build currency verified; no source change.

node --test --test-reporter=spec --test-name-pattern "a chat build passes at whatever ceiling" packages/test-runner/dist/live-llm/tests/live-llm-run.test.js
-> Exact runner case failed on t844: configured ceiling $15, declared/effective whole-build cap $5; refused before execution.
```

A preliminary in-memory fixture probe passed 86 of 87 extension tests. Its
remaining browser-tab failure came from the probe's omission of enum-valued
code syntax, leaving that expected record untouched. The authored fixture was
then corrected literally, and the complete final overlay selection passed.

## Authored fixture validation over unchanged baseline production

Ignored probes in t843 overlay only the six owned extension test files and the
one runner test file. Imports and production implementation dependencies resolve
from t844 using its existing compiled Core packages. No Core/domain runtime
source alias was added. The original baseline source remains unchanged.

```text
node .fluxiq/runtime-refactor-sweep/extension-fixture-overlay.cjs --authored --safety
-> 159 tests passed, 0 failed, 0 skipped; 19.21s.

node .fluxiq/runtime-refactor-sweep/runner-fixture-overlay.cjs
-> 26 tests passed, 0 failed, 0 skipped; 7.67s.

node .fluxiq/runtime-refactor-sweep/fixture-typecheck.cjs
-> 6 extension fixtures and 1 runner fixture: 0 type errors against baseline dependencies.
```

The six additional extension safety subjects are:

- `background/connection/tests/dom-snapshot.test.ts`
- `content/identity/tests/context.test.ts`
- `content/identity/tests/record-veto.test.ts`
- `content/identity/tests/record-repeated-row.test.ts`
- `content/action-runtime/tests/pass-row-resolution.test.ts`
- `content/action-runtime/tests/resolve-target-landmark.test.ts`

Evidence logs are ignored task artifacts:
`.fluxiq/runtime-refactor-sweep/extension-authored-fixtures.log` and
`.fluxiq/runtime-refactor-sweep/runner-authored-fixtures.log`. Unit tests use
synthetic page/credential fixtures and fake Core collaborators; none contacts
a model service.

The first type-probe attempt resolved Node's type library from the tool's root
directory and reported TS2688. Supplying each baseline config filename and its
package working directory corrected the probe; all seven final owned-file
diagnostic checks passed without changing source or compiler configuration.

## Integration limits

No Core, domain runtime, extension production, runner production, test helper,
package/config/audit, shared documentation or other worker report was edited.
No whole suite, browser/panel, provider, git command or agent spawn ran.

Final normal t843 acceptance is verified above. No whole downstream/Core
suite, live browser/panel, provider-backed test, store submission or release was
run by this worker. The tests used synthetic fixtures and fake collaborators;
there were zero provider calls. The $5 default remains the whole Claude build's
allowance. Core and downstream source remain frozen; only this owned report and
ignored validation artifacts changed during current acceptance.
