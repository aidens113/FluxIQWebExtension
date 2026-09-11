# ext-demo-workspace — Phase 3, the two `test-runner` infrastructure files

## Outcome

**Partial.**

`packages/test-runner/src/demo-workspace.ts` is split: 3,855 lines became a
5-line facade over 23 collaborators plus a barrel under
`packages/test-runner/src/demo-workspace/`. Its 50-name export surface is
byte-identical before and after, all 19 importers are unchanged, `check` exits
0, and the audit reports no new violation.

Two things did not land, both for the same reason.

1. **`demo-llm-create-ui.ts` was not split.** It stays at 837 lines.
2. **The suite is three failures redder than baseline**, not the unchanged 19
   the brief set as the bar.

The cause is the same in both cases and is the brief's one material omission:
**`demo-workspace.ts` is read as source text by four tests, not one.** The
brief named `tests/demo-llm-prepare.test.ts`, which I own and have repointed.
The other three live in files the brief lists under "Must not touch", so I did
not edit them. I have verified the exact repoint each one needs — every
assertion passes against the split modules, none weakened — and the patches are
below, ready to apply.

## What changed and why

### The split

`demo-workspace.ts` is now:

```ts
export * from "./demo-workspace/index.js";
```

`demo-workspace/index.ts` is the barrel and re-exports exactly the 50 names the
original exported, grouped by owning module. Nothing else in the directory is
public, so the collaborators' internals stay internal while still being
reachable from each other (the audit's `imports` rule exempts a module reaching
the files of a directory it lives inside).

Grouping is by the lane or concern each function serves, not by the `demo-`
filename convention:

| Module | Lines | Holds |
| --- | --- | --- |
| `configuration.ts` | 108 | the config shape, its resolution from the environment, the validators |
| `workspace-state.ts` | 74 | the recorded workspace's persisted identity, its legacy migration, the lock |
| `preparation-state.ts` | 94 | the prepared-diagnosis identity and the checks that keep secrets out of it |
| `flow-document.ts` | 210 | document construction, graph reconciliation, the document assertions |
| `provisioning.ts` | 233 | the Flow profile, `provisionDemoFlow`, the Subflow generated from a recording |
| `scenario-lab.ts` | 106 | the persistent scenario lab process, its port, its URL |
| `browser-session.ts` | 339 | the extension and panel browser contexts, pairing, runtime messaging |
| `selectors.ts` | 14 | text → safe selector or pattern fragment |
| `panel-navigation.ts` | 207 | Studio, project, Flow, Subflow, connected clients |
| `subflow-authoring.ts` | 244 | the Subflows folder, Subflow creation, nodes and Router editors |
| `panel-run.ts` | 125 | running a Flow from the panel and waiting on what it produces |
| `control-waits.ts` | 93 | waits against the control client until the runtime catches up |
| `core-process.ts` | 191 | the persistent core, its gateway, the authenticated control client |
| `diagnosis-ui.ts` | 256 | the drift-diagnosis fixture identity and its panel UI |
| `adaptation-ui.ts` | 188 | reviewing, applying and running an adaptation through the panel |
| `workspace-lanes.ts` | 122 | the baseline lanes: key setup, record, replay |
| `blank-preparation.ts` | 62 | the provider-free instruction-only preparation lane, alone |
| `diagnosis-lanes.ts` | 162 | diagnosis preparation and the diagnosis run |
| `creation-lanes.ts` | 329 | the creation probes and the first-live creation run |
| `exploration-adaptation.ts` | 280 | exploration adaptation readiness, proposal, apply, validation, revert, reject |
| `exploration-checkpoints.ts` | 301 | the baseline probe and the proposal and apply checkpoints |
| `bound-exploration.ts` | 194 | the bound run and its stage-tagged failures |
| `adaptation-lane.ts` | 184 | the first-live adaptation run, its inspection, the prepared-target control |
| `index.ts` | 16 | the barrel |

Largest file is 339 lines, well under both the 800-line limit and the 400-line
advisory line.

### The hazard the brief named

`tests/demo-llm-prepare.test.ts` no longer slices. `prepareDemoLlmBlankWorkspace`
now has a module to itself, so the whole file is the lane:

```ts
const lane = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-workspace/blank-preparation.ts"), "utf8");
assert.match(lane, /export async function prepareDemoLlmBlankWorkspace/u);
```

The index-slicing is gone and the ten required identifiers, the two `match`
assertions and the six-way `doesNotMatch` are unchanged. As the brief predicted,
the negative assertion is now strictly stronger: it holds over every line of the
module — including its import list — rather than over the span between two
neighbouring declarations. Nothing was weakened; the test passes (`ok 150`).

The module contains no `Start recording`, `Stop recording`,
`generateDemoSubflowFromRecording`, `runDemoFlowFromPanel`, `DEEPSEEK_API_KEY`
or `runDemoLlmDiagnosis`, in body or in imports. That is now a property of the
file's whole existence rather than of where two declarations happen to sit.

### What blocked the rest

Three more tests read `demo-workspace.ts` as text. All three are in files the
brief lists as "Must not touch: every other file in `packages/test-runner/src`",
so I left them alone and they now fail:

| Test file | Line | What it does | Now fails |
| --- | --- | --- | --- |
| `tests/demo-llm-setup-script.test.ts` | 27 | slices `setupDemoWorkspaceDeepSeekKey` → `recordDemoWorkspace` | `persistent setup composes the existing lock, Core, auth, browser evidence, and in-memory redaction seams` |
| `tests/demo-llm-live.test.ts` | 63 | slices `runDemoLlmDiagnosis` → `runDemoWorkspaceFlow` | `live command is real-UI, credential-boundary safe, and provider-secret free` |
| `tests/demo-llm-create-ui.test.ts` | 42 | reads the whole file | `proposal-only exploration launcher and UI driver stop before review mutation` |

`demo-llm-create-ui.ts` was not split for the same reason, only worse.
`tests/demo-llm-create-ui.test.ts` makes roughly 33 source-text assertions
against it: about 20 against `src/demo-llm-create-ui.ts` (line 45) and about 13
against the **compiled** `dist/demo-llm-create-ui.js` (line 136,
`new URL("../demo-llm-create-ui.js", import.meta.url)`). A facade empties both.
Those assertions are spread across `configureCreationLimitsViaUi`,
`buildApproveApplyCreationAfterReadiness`, `proposeEvidenceGuidedCreationViaUi`,
`waitForExplorationTerminal` and `exactVirtualizedHierarchyObject` — that is,
across most of the file — and several are real guards (no `DEEPSEEK_API_KEY`,
no `rawPrompt`/`rawResponse`, exact UI seams, ordering of the readiness gate).
Re-homing them is design work on a file I do not own, and starting the split
without it would only have added failures I could not repair. So I stopped and
left the file at 837 lines rather than half-do it.

## The three repoints, verified

Each was replicated assertion-for-assertion against the split modules in a
scratch harness; all three pass with no assertion weakened. Two are a path
change only.

**`tests/demo-llm-setup-script.test.ts:27`** — the two functions stayed adjacent
and in order in `workspace-lanes.ts`, so only the path changes:

```diff
-  const source = await readFile(repositoryFile("packages/test-runner/src/demo-workspace.ts"), "utf8");
+  const source = await readFile(repositoryFile("packages/test-runner/src/demo-workspace/workspace-lanes.ts"), "utf8");
```

**`tests/demo-llm-create-ui.test.ts:42`** — both assertions target code that now
lives in `exploration-checkpoints.ts`:

```diff
-  const workspace = await readFile(path.join(root, "packages", "test-runner", "src", "demo-workspace.ts"), "utf8");
+  const workspace = await readFile(path.join(root, "packages", "test-runner", "src", "demo-workspace", "exploration-checkpoints.ts"), "utf8");
```

**`tests/demo-llm-live.test.ts:63`** — the sliced span became two modules: the
lane is in `diagnosis-lanes.ts`, the UI it drives (`configureFirstLiveDiagnosisViaUi`,
`runDiagnosisFromPanel`, `restoreDiagnosisScenario`) in `diagnosis-ui.ts`:

```diff
-  const source = await readFile(path.join(root, "packages/test-runner/src/demo-workspace.ts"), "utf8");
-  const start = source.indexOf("export async function runDemoLlmDiagnosis");
-  const end = source.indexOf("export async function runDemoWorkspaceFlow", start);
-  const lane = source.slice(start, end);
+  const laneModule = await readFile(path.join(root, "packages/test-runner/src/demo-workspace/diagnosis-lanes.ts"), "utf8");
+  const uiModule = await readFile(path.join(root, "packages/test-runner/src/demo-workspace/diagnosis-ui.ts"), "utf8");
+  const lane = `${laneModule.slice(laneModule.indexOf("export async function runDemoLlmDiagnosis"))}\n${uiModule}`;
```

and, further down, the nested slice loses its end bound because
`runDiagnosisFromPanel` is now last in what it reads:

```diff
-  const runtimeStart = lane.indexOf("async function runDiagnosisFromPanel");
-  const runtimeEnd = lane.indexOf("export async function runDemoWorkspaceFlow", runtimeStart);
-  const runtime = lane.slice(runtimeStart, runtimeEnd);
+  const runtimeStart = lane.indexOf("export async function runDiagnosisFromPanel");
+  const runtime = lane.slice(runtimeStart);
```

One detail worth keeping: the `slice(indexOf("export async function runDemoLlmDiagnosis"))`
is load-bearing, not cosmetic. Read whole, `diagnosis-lanes.ts` begins with an
alphabetically sorted import line naming `restoreDiagnosisScenario` before
`runDiagnosisFromPanel`, which inverts the test's
`indexOf("runDiagnosisFromPanel") < indexOf("restoreDiagnosisScenario")`
ordering assertion. Skipping the import header restores it. I hit this exact
failure on the first attempt; it is the kind of thing that looks like a passing
repoint until the ordering assertion is read carefully.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`, `dist` removed before each measurement.

```
pnpm --filter @fluxiq-web-extension/test-runner check
  -> tsc -p tsconfig.json --noEmit; exit 0
```

```
rm -rf dist && tsc -p tsconfig.json && node --test "dist/**/*.test.js"
  before: # tests 266  # pass 247  # fail 19
  after:  # tests 266  # pass 244  # fail 22
  diff of the sorted failing-test names: three additions, no removals
    + live command is real-UI, credential-boundary safe, and provider-secret free
    + persistent setup composes the existing lock, Core, auth, browser evidence, and in-memory redaction seams
    + proposal-only exploration launcher and UI driver stop before review mutation
  ok 150 - demo:llm:prepare is a provider-free real-UI blank Flow lane
```

The 19 baseline failures are unchanged by name, and the three additions are
exactly the three un-owned text readers above.

```
node scripts/structure-audit.mjs   (after git add -N on the new files)
  before: FAIL [working-docs] docs/working/README.md is out of date. 1 violation across 1 rule.
  after:  FAIL [working-docs] docs/working/README.md is out of date. 1 violation across 1 rule.
```

Identical — the one failure is pre-existing and is the README regeneration the
supervisor owns. New advisory warnings only, none failing:
`directory-files packages/test-runner/src/demo-workspace/: 24 source files`
(the same shape as the existing `background/connection/` at 19), and
`exported-values` past the 8-value advisory line on `flow-document.ts` (12),
`diagnosis-ui.ts` (12), `adaptation-ui.ts` (10), `panel-navigation.ts` (10) and
`preparation-state.ts` (10). `demo-workspace.ts` has dropped out of the
`file-lines` and `exported-values` warnings entirely.

Two baseline entries are now stale and will be lowered by the supervisor's
`pnpm structure:baseline`: `file-lines packages/test-runner/src/demo-workspace.ts: 3855`
and `exported-values packages/test-runner/src/demo-workspace.ts::values: 43`.
I did not run `structure:baseline`, as instructed.

### Export-surface and text-preservation evidence

```
TypeScript checker, exports of src/demo-workspace.ts before vs after:
  diff -> no output; 50 names identical, types still types, values still values
```

```
node -e "import('./dist/demo-workspace.js')"
  loaded, runtime value exports: 43
  undefined bindings (TDZ/cycle symptom): none
```

43 matches the `exported-values` baseline for the original file, and no binding
resolves to `undefined`, so the collaborator graph has no initialisation cycle.

```
line-level preservation, original body (everything after the import block) vs
the 23 collaborators:
  original body lines: 3647 | emitted body lines: 3647 | missing: 0
  lines not found verbatim in the original: 0
```

Every non-blank line of the original moved verbatim. The only new text is each
module's regenerated import list and its header comment; the only edit to
existing lines is an `export` keyword prefixed to declarations that were
file-private and are now reached from a sibling.

## Not verified

- **Nothing was run in a browser.** No lane was executed: no recording, no
  pairing, no panel navigation, no action execution, no adaptation, no
  exploration. The 22-test suite is unit and source-text assertions only, and
  every one of the 23 collaborators exists to drive a live browser against a
  live core. Compilation, an identical export surface and verbatim line
  preservation are strong evidence that no behaviour moved, but they are not
  evidence that the lanes still work.
- **Module-evaluation order beyond the import probe.** `import()` of the facade
  resolves every binding, which rules out a cycle that would leave a binding
  `undefined`. It does not rule out an ordering change inside a lane at call
  time.
- **The three repoint patches were verified in a scratch harness, not in the
  repository.** I replicated each test's assertions against the split modules
  and all pass; I did not apply them to the test files, so they have not been
  observed passing under `node --test`.
- **`demo-llm-create-ui.ts` is untouched and unmeasured.** I read its
  declaration outline and the parts of `tests/demo-llm-create-ui.test.ts` that
  assert against it, enough to conclude the split is blocked; I did not design
  the grouping or estimate how the 33 assertions would re-home.

## Open questions or contradictions found

**The brief's ownership boundary and its definition of done cannot both be
satisfied.** The brief says "Must not touch: every other file in
`packages/test-runner/src`" and also requires "the same 266 tests with the same
19 failures by name". Three of the four text readers of `demo-workspace.ts` are
in that must-not-touch set, so any split of the file breaks them, and no split
can meet the failure-count bar without editing files the brief forbids. I
honoured the boundary and left the three failing. The supervisor needs to
either apply the three patches above, or re-dispatch with
`tests/demo-llm-setup-script.test.ts`, `tests/demo-llm-live.test.ts` and
`tests/demo-llm-create-ui.test.ts` added to the owned set.

**The brief's hazard note found one of four readers.** The note is exactly right
about the mechanism and about the fix — repoint at the new module, delete the
slicing, do not weaken — but it located only `tests/demo-llm-prepare.test.ts`.
The generalisable finding is that this package asserts on source text routinely:
`grep -rln "readFile.*src/demo" packages/test-runner/src/tests` is the check
that should precede any future move in `packages/test-runner/src`, and it should
include the compiled `dist/` reads, which a source-only grep misses.

**`demo-llm-create-ui.ts` needs its test file in the same brief.** Splitting it
means re-homing about 33 source-text assertions, 13 of them against the compiled
output, across whatever modules the split creates. That is not a mechanical
repoint like the three above; it is a decision about which module owns which
guard. It should be one brief that owns both `demo-llm-create-ui.ts` and
`tests/demo-llm-create-ui.test.ts`.

**A smaller observation for the ratchet.** `tests/demo-llm-create-ui.test.ts` is
itself 561 lines and already past the advisory line. Whoever splits
`demo-llm-create-ui.ts` will likely want to split its test alongside it, one
test module per source module, which would also stop the next mover from having
to read 561 lines to find out what the file asserts about source text.
