# w2-recovery-tools-only: a runtime repair explores with the domain's declared recovery options only

Brief: Core defect — a recovery at `gather` was also offered the bound domain's
plain authoring tools; plus two domain tidy-ups (split the exploration terms out
of `vocabulary.ts`, export `WEB_RECOVERY_DETECT_OPTION_ID` from the barrel).

Source: `reports/w2-w3a-recovery-detection.md`, open questions 1-3.
Core `F:\!FluxIQ` at `b0f1407`; this repository at `5e583ef`. Nothing committed.

## Outcome

Done. All three items are built and validated.

1. A recovery now explores with exactly the options the bound domain declares.
   A tools-only domain is unchanged. Fixed at the recovery's own call site, not
   in the registry — see "Why the fix is where it is".
2. `webAutomationExplorationRefusalClassifier` and
   `webAutomationExplorationScope` moved to a new
   `harness-options/exploration-terms.ts`. `vocabulary.ts` is down to 7 exported
   values from 9, so the advisory finding is gone. No behaviour change.
3. `WEB_RECOVERY_DETECT_OPTION_ID` is exported from
   `harness-options/index.ts` beside the other five id constants.

The defect was reproduced before it was fixed: the new Core test failed with the
two authoring tools present in the offered list, and passed after the change.

## What changed and why

### Core (`F:\!FluxIQ`), 2 files

`AS/runtime/recovery/annotation/exploration.ts` — the registry the recovery
builds is now built from a narrowed binding:

```ts
const binding = explorationRegistryBinding(input.binding);
const registryLoop = automationStudioHarnessOptionRegistry({ binding }).evidenceLoopBinding(...);
const domainToolIds = new Set(binding.tools.map((tool) => tool.toolId));
if (binding.harnessOptions) for (const option of binding.harnessOptions.options) domainToolIds.add(option.toolId);
```

and the new `explorationRegistryBinding` returns the binding unchanged when the
domain declares no options, and otherwise a binding with `tools: []`:

```ts
function explorationRegistryBinding(binding: AutomationStudioLlmEvidenceRuntimeBinding): AutomationStudioLlmEvidenceRuntimeBinding {
  if (!binding.harnessOptions?.options.length) return binding;
  return {
    domainId: binding.domainId,
    deniedEvidenceKeys: binding.deniedEvidenceKeys,
    tools: [],
    harnessOptions: binding.harnessOptions,
    executeTool: (call) => binding.executeTool(call)
  };
}
```

Two deliberate differences from the diff proposed in the source report:

- **Written field by field, not `{ ...input.binding, tools: [] }`.** Not because
  of the contract-spread rule — `recovery/` is not a configured
  `contractSpreadPaths` prefix, and spreading a *named* value is allowed there
  anyway. The reason is different and worse: `executeTool` is a method on the
  binding, and a host is free to bind a class instance. A spread copies own
  enumerable properties only, so a prototype method would be dropped and the
  registry would be handed a binding it cannot execute with. Only the four
  fields the registry reads are carried; the exploration keeps reading
  `classifyRefusal` and `deniedEvidenceKeys` from the caller's own binding.
- **The narrowing is named, with the reason in a docstring**, rather than an
  inline ternary, because the "why" is a security argument that a reader of one
  line cannot reconstruct: an authoring tool binds its targets through the
  *authoring* packet map, so a handle taken from a `web.recovery.*` packet could
  resolve against an older authoring packet of the same Flow whenever the
  location and selector still matched.

`AS/runtime/recovery/annotation/tests/exploration.test.ts` — two tests added,
plus two test helpers (`plainTool`, `recordingProvider`; the latter wraps the
existing `sequenceProvider` and records `request.context.evidenceLoop.tools`,
which is what the model is actually shown):

- *offers exactly the domain's declared options, never its plain authoring
  tools* — a binding with two plain tools and two declared options. Every
  request's offered tool list must equal the declared option ids, and the plain
  slot's `executeTool` must never run.
- *still explores with a tools-only binding's plain tools* — a binding with one
  plain tool and no `harnessOptions` still offers it, runs it through
  `executeTool`, and returns its packet as `explored.1`.

### This repository, 5 files

- **New** `domain/src/runtime/llm-evidence/harness-options/exploration-terms.ts`
  — the two functions, moved verbatim with their docstrings; the file header
  says why they sit beside `vocabulary.ts` rather than in it.
- `harness-options/vocabulary.ts` — the two functions and the two imports they
  needed removed; header rewritten to describe what the file now is (the id
  list). 9 exported values -> 7.
- `harness-options/index.ts` — exports the two moved values from
  `./exploration-terms`, adds `WEB_RECOVERY_DETECT_OPTION_ID` to the
  `./vocabulary` list. Header corrected from "five actions" to six (the list has
  had six ids since the detect option landed) and a doubled word removed.
- `harness-options/execute.ts` — imports `webAutomationExplorationScope` from
  `./exploration-terms`.
- **New** `harness-options/tests/exploration-terms.test.ts` and
  `harness-options/tests/options.test.ts` — the two tests that assert only on
  the moved functions moved into a test file named for their subject, per the
  repository rule that `a/b.ts` is covered by `a/tests/b.test.ts`. The
  whole-seam test that *uses* the classifier as part of a real exploration run
  stays in `options.test.ts`. Both files import through the barrel, as before.

## Why the fix is where it is

The brief allowed fixing `harness-options/{binding,registry}.ts` if the fix
belonged there. It does not:

- `registry.ts` `stageAllows` is right as written — an option with no `stages`
  is offered at every stage, and the alternative (no stage means nowhere) would
  withhold Core's own unpinned options from every call that names a stage.
- `binding.ts` `scopedOption` could pin the plain tools to an authoring stage
  instead, but the only caller that authors a Flow —
  `AS/runtime/service.ts:1910`, the evidence-guided Flow bootstrap — passes no
  `stage` at all. Pinning there would withhold the plain tools from bootstrap
  and break it, and repairing that means editing `service.ts`, which is not
  mine and is a wider change than the defect warrants.

The recovery's own call site is the one place that knows it is a recovery, so
that is where the narrower set is chosen.

## Commands run and observed results

Another worker has uncommitted work in both repositories. Where its files fail,
I isolated my own and say so.

**Core**

- `FLUXIQ_TEST_ENV_FILES=none npx vitest run <...>/annotation/tests/exploration.test.ts --no-file-parallelism`
  *before the fix*: **1 failed, 6 passed**. The new test failed with exactly the
  defect: `expected [ 'test.authoring.inspect', 'test.authoring.navigate',
  'test.inspect', 'test.reveal' ] to deeply equal [ 'test.inspect',
  'test.reveal' ]`.
- `FLUXIQ_TEST_ENV_FILES=none npx vitest run AS/runtime/recovery/annotation AS/runtime/llm/harness-options --no-file-parallelism`
  *after the fix*: **11 files, 115 passed / 115**, exit 0.
- `npx tsc --noEmit -p packages/fluxiq`: exit 0, no output. This covers the
  other worker's uncommitted Core files too, which also type-check.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (156 warning(s),
  354 baselined)`, exit 0.
- `FLUXIQ_TEST_ENV_FILES=none npx vitest run AS/runtime --no-file-parallelism`
  (wider than the brief asked, to catch a regression outside the two suites):
  **148 files, 145 passed / 3 failed; 1589 tests, 1585 passed / 3 failed / 1
  skipped**, 451s. It finished after I had written the first version of this
  report, which is why the note above it was rewritten.
  - The one failure whose detail survived in the captured output is
    `runtime/tests/service-flows/tests/representation.test.ts:392`, *seeds a
    rerun from the failed attempt as the run executed it...*: it expected
    `runtimePatchAttempts` with `traceStatus: "succeeded"` and got
    `traceStatus: "not-run"`, `preflightOk: false`, and the issue *"The recovery
    plan allows no wait retry for this failure."* That is the other worker's
    `recovery/plan.ts` and live-patch work — a patch the recovery plan now
    refuses to allow — and nothing in it touches the exploration's tool list.
  - **A second wide run, taken to attribute the rest, disagreed with the
    first: 5 failed across 4 files, not 3 across 3.** That disagreement is
    itself the finding. The four extra failures were bare `Error: Test timed
    out in 5000ms.` with no assertion diff, in
    `service-adaptation/tests/failed-start.test.ts` (2),
    `service-flows/tests/flow-map.test.ts` and
    `service-flows/tests/instruction-readiness.test.ts` — none of which touches
    harness options or the recovery exploration.
  - **Rerun quietly, three of those four pass**: `failed-start.test.ts` 8/8 and
    `flow-map.test.ts` 2/2. That is the machine's known fault plus load from
    another worker, not a defect.
  - `instruction-readiness.test.ts` also passes alone, in **4591ms against a
    5000ms budget**. It is a committed file nobody has modified; it simply has
    ~400ms of headroom and loses it whenever the machine is busy. Worth
    resizing, by whoever owns it.
  - `representation.test.ts` **reproduces on a quiet rerun**, so it is real and
    it is the other worker's. Not mine, and not related: the exploration's
    offered tool list appears nowhere in it.
  - Net: **no failure in either wide run is attributable to this change**, and
    the two suites that cover it are 115/115.

**This repository**

- `pnpm --filter @fluxiq-web-extension/domain check`: **exit 2**. Every error is
  in another worker's files — `src/runtime/llm-evidence/target-equivalence.ts`
  (untracked, never committed) and `src/runtime/llm-evidence/target-override.ts`
  (modified, named in my brief as not mine). Confirmed by listing the distinct
  files named in the error output: those two and nothing else.
  - To show my files are clean rather than merely unmentioned, I copied
    `domain/src` to a scratch directory, reverted every file that
    `git status --porcelain domain/src` reported and that is not one of my six
    (restoring tracked ones from `HEAD`, deleting untracked ones), and ran both
    halves of the package's `check` against the copy:
    `tsc -p <src-only>` **exit 0** and `tsc -p <with tests>` **exit 0**, no
    output from either. That second project is the one that type-checks test
    files, so it covers my new test file and the edited `options.test.ts`.
    Scratch directory deleted afterwards; `git status` shows nothing stray.
  - Worth knowing for whoever runs the gate next: that worker is still editing.
    Between my first and second isolation runs it also modified
    `tests/renamed-save-override.test.ts` and `tests/repair-proposal.test.ts`,
    which is why the file list above is computed from `git status` rather than
    hard-coded.
- `DOMAIN_TEST_BUILD_LABEL=w2-recovery-tools-only pnpm --filter @fluxiq-web-extension/domain test`:
  **650 tests, 629 pass, 21 fail**, exit 1. The failures are the same worker's
  target-override / target-equivalence work (repair target overrides, selector
  hints from explored packets, recorded-click repair proposals).
  - Same isolation: a scratch copy of the package with those two files restored
    to `HEAD` ran **636 tests, 636 pass, 0 fail**, exit 0 — including my moved
    file, my new test file and the barrel change.
  - The new test file was run explicitly and passed: *translates only the
    terminal refusals into Core's stop reasons*, *tells Core where it is in
    Core's own terms, which are opaque strings*.
  - The label sent the bundles to the ignored scratch build directory, so the
    tracked `domain/.test-build/` was not touched and shows no diff.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (61 warning(s),
  122 baselined)`, exit 0. No finding names `harness-options` or
  `exploration-terms`: the 9-exported-values advisory on `vocabulary.ts` is
  cleared and the new file raises none.

## Not verified

- **No live run**, as the brief required. Nothing here is demonstrated against
  the real provider.
- **The domain tests do not exercise my Core change.** The domain resolves
  `fluxiq` to Core's `dist`, last built 2026-09-16 17:38 — before today's edit.
  So the domain suite says nothing about the narrowed tool list either way, and
  the Core change is covered only by Core's own tests.
- **The full `pnpm check` / `pnpm test` / `pnpm build` in either repository.**
  Both trees hold another worker's in-flight edits, and this repository's domain
  package does not currently type-check because of them, so a whole-repository
  gate would report their state, not mine. The gates must be rerun once that
  worker's changes land.
- **What the live web domain now sees.** The Core fix removes
  `web.inspect_current_page`, `web.navigate_same_origin`, `web.reveal_safe` and
  `web.detect_repeating_structure` from a recovery's offered list by
  construction, and that is asserted on a synthetic binding. I did not run a
  recovery with the real web binding to watch the list shrink, and did not
  measure the input-byte saving their descriptions cost.
- **The free first look survives, by inspection not by a new test.** The
  `initialObservation` that gives the model one look before the first decision
  is declared on `web.recovery.inspect`
  (`harness-options/options.ts:71`), a declared recovery option, so dropping the
  plain tools does not remove it. The existing options test still asserts
  `observedActions: 1`.

## Open questions or contradictions found

1. **The same hole is still open on any other path that builds a registry from a
   binding.** The narrowing is the recovery's decision, made at the recovery's
   call site, so a future caller that explores at `gather` and forgets it will
   inherit the old behaviour. A stricter shape — a domain's plain `tools`
   carrying an authoring stage, with Flow bootstrap saying which stage it is in —
   would make it structural instead of conventional, and would need a
   `service.ts` change. Not mine; recorded rather than done.
2. **`vocabulary.ts` is now an id list with no behaviour**, which is what the
   split leaves. If a later change gives it functions again, the 8-value
   advisory is the thing that will notice, not a reviewer.
3. **Open questions 4-6 of the source report are untouched** and still open:
   plan resolution not seeing recovery packets, the thin token headroom on the
   evidence-decision budget test, and whether a detection packet should be
   skipped when Core packs the patch's explored-evidence slot.
