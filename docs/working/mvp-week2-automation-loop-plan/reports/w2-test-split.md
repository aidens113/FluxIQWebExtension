# W2 — Splitting the automation-studio runtime tests

Worker report. Repository: `F:\!FluxIQ` (FluxIQ Core). No commit, no push, no
working document edited.

## Outcome

**Done.** `AS/runtime/tests/` can take new tests again. The directory went from
25 source files (at its hard 25-file budget) to 19, the two oversized files are
gone, and the largest file that came out of them is 391 lines against a hard
limit of 800. No baseline and no budget was raised; the audit passes with zero
failures. The sorted test-name list is byte-identical before and after
(726 names, empty diff), and the test total is unchanged at 726.

One real finding, reported rather than fixed because fixing it needs a config
change my brief forbids: the split raises file-level parallelism from 61 test
files to 84, and under that load the single heaviest test intermittently
exceeds the suite's 15-second per-test timeout. Details in *Open questions*.

## What changed and why

### The two oversized files, split by subject

`service.test.ts` (4787 lines, at its exact ratcheted baseline) and
`service-flow-bootstrap-generation.test.ts` (1004 lines, over a hard limit of
800 and shaved twice rather than fixed) are deleted. Their contents moved
verbatim into subject files.

The split was done by a script that parses each file with the TypeScript
compiler, takes each `it(...)` statement as an exact source slice (including
its leading comments), and asserts that every statement is claimed by exactly
one output group. Nothing was retyped. No assertion, expectation, timeout or
test name was changed; every `describe` title was carried through unchanged,
which is why the full-name list is identical.

Shared helpers were lifted into non-`.test` support modules, as Core's code
structure allows inside a `tests/` folder. The per-file lifecycle
(`let tempRoot`, `const services`, `createService`, `beforeEach`, `afterEach`)
was deliberately *duplicated* into each output file rather than shared, so
that every test body still refers to a bare `tempRoot` identifier and the body
text stays byte-identical to the original.

### The 25-file directory budget, relieved by subject subfolders

I followed the precedent the downstream repository set in `1b32273`
(`e2e/content/tests/evidence/tests/…`): when the parent `tests/` folder is at
the hard 25-file limit, a split lands in a subject subfolder's own `tests/`.
That shape is required, not cosmetic — the audit's `test-placement` rule fails
any `*.test.ts` whose immediate parent directory is not named `tests` or `e2e`,
so `tests/<subject>/x.test.ts` would fail outright and `tests/<subject>/tests/x.test.ts`
is the only legal nesting.

Four subject subfolders now exist under `AS/runtime/tests/`:

| Folder | Files | Holds |
| --- | --- | --- |
| `service-recordings/tests/` | 6 | recording storage and timelines, state image assets and deletion, recording state indexes, mapper/proposal generation, proposal approval, task proposals from mined evidence |
| `service-adaptation/tests/` | 7 | adaptation and training modes, LLM diagnosis, execution grants, runtime patches, the adaptive loop, durable patches, adaptation subflows |
| `service-flows/tests/` | 11 | Flow creation, Flow Map and router writes, subflows, 10k-scale pages, runtime runs and run detail, canonical persistence, execution digest, change feed, instruction readiness, Flow representation, subflow pagination |
| `service-bootstrap/tests/` | 7 | bootstrap generation, pre-provider rejections, failure accounting, catalog and capability binding, bootstrap adaptations, the bootstrap harness |

Five further files moved whole (content unchanged apart from relative-import
depth) so that the subject grouping is coherent rather than half-done:

- `service-flow-bootstrap-adaptation.test.ts` → `service-bootstrap/tests/adaptation.test.ts`
- `flow-bootstrap-harness.test.ts` → `service-bootstrap/tests/harness.test.ts`
- `service-flow-representation.test.ts` → `service-flows/tests/representation.test.ts`
- `service-subflow-pagination.test.ts` → `service-flows/tests/subflow-pagination.test.ts`
- `service-adaptation-subflow.test.ts` → `service-adaptation/tests/subflow.test.ts`

Each dropped the now-redundant `service-`/`flow-bootstrap-` prefix, which is
what the shared-prefix rule asks for once the prefix has become a directory.

### Why I stopped at 19 files rather than going under the 15-file advisory

`AS/runtime/tests/` still warns (19 files, advisory threshold 15). I left it
there on purpose. Every one of the 18 remaining test files is the one-to-one
test for a source file that sits directly in `AS/runtime/` — `io-policy.test.ts`
for `io-policy.ts`, `executor.test.ts` for `executor.ts`, and so on. Core's
code structure says the test for `<dir>/<name>.ts` is `<dir>/tests/<name>.test.ts`,
one step from its subject; moving any of them into a subfolder would *break*
that rule to buy a smaller number. `AS/runtime/` itself holds 23 source files
and carries its own 15-file advisory warning, so the only correct way to get
`AS/runtime/tests/` under 15 is to split `AS/runtime/` — a source change my
brief forbids.

Two files I did not move for a concrete mechanical reason:
`llm-deepseek-flow-bootstrap.test.ts` and `state-linker.test.ts` each carry a
ratcheted `imports` baseline entry keyed by their path. Moving either would
change the key, leave the finding with no entry, and fail the audit outright.

### New support modules

- `AS/runtime/tests/service-fixtures.ts` (115 lines, 6 exports) — the flow and
  state fixtures shared by the three `service-*` subject folders. It sits in
  the flat `tests/` folder because that is the nearest directory containing
  everything it serves.
- `AS/runtime/tests/service-bootstrap/tests/fixtures.ts` (154 lines, 8 exports)
  — used only by the bootstrap folder, so it lives there.

### One thing I did not do

The coordinator's first message asked me to add `deniedEvidenceKeys` to a
fixture in `service.test.ts`. The follow-up withdrew it: the edit had already
been made and committed in `802215b`. I verified it is present and carried it
through the split unchanged — it is now at
`service-adaptation/tests/llm-diagnosis.test.ts`, inside the test
"stops before provider invocation when applicable failure evidence is malformed",
with the list exactly as specified (`snapshot` absent, `selector` present).

## Commands run and observed results

All commands run in `F:\!FluxIQ`. New files were `git add`-ed (not committed)
because the structure audit reads `git ls-files` and cannot see untracked work.

### Suite before the split, at the committed HEAD `802215b`

```
npx vitest run src/programs/automation-studio/runtime
 Test Files  61 passed (61)
      Tests  726 passed (726)
   Duration  178.19s
```

(An earlier run at the pre-`802215b` tree showed `1 failed | 725 passed` — the
`deniedEvidenceKeys` failure the coordinator described. It is green at HEAD, so
HEAD is the baseline I compared against.)

### Suite after the split

```
npx vitest run src/programs/automation-studio/runtime
 FAIL  .../service-flows/tests/scale-pages.test.ts > AutomationStudioService recording persistence > keeps large project summary pages free of hydrated detail payloads
Error: Test timed out in 15000ms.
 Test Files  1 failed | 83 passed (84)
      Tests  1 failed | 725 passed (726)
   Duration  91.12s
```

### The failure, rerun alone

```
npx vitest run src/programs/automation-studio/runtime/tests/service-flows/tests/scale-pages.test.ts
 ✓ keeps large project summary pages free of hydrated detail payloads 8610ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

8610 ms alone, against 8841 ms for the same test in the pre-split baseline run
— unchanged work, so the failure is contention, not the split changing what the
test does. An earlier post-split run timed out on four tests
(`scale-pages`, `instruction-readiness`, `proposals`, bootstrap `adaptation`);
all four passed when rerun together with `--no-file-parallelism`:

```
npx vitest run <those four files> --no-file-parallelism
 Test Files  4 passed (4)
      Tests  23 passed (23)
```

### Test-name proof (the point of the exercise)

Sorted `ancestorTitles > title` extracted from the vitest JSON reporter, before
and after:

```
before: 726  after: 726
diff before-names.txt after2-names.txt
TEST-NAME DIFF: EMPTY
```

The diff is empty — not merely equal counts. Both totals are 726.

### Type check

```
cd packages/fluxiq && npx tsc --noEmit
TSC EXIT:0
```

### Structure audit

```
node scripts/structure-audit.mjs
structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.
structure-audit: passed (139 warning(s), 254 baselined).
```

`--json` confirms `failures: 0`. The single lowerable entry is
`AS/runtime/service.ts 6757 < 6758` — the coordinator's own Phase S edit, not
mine, and not a file I may touch. I did not run `pnpm structure:baseline`:
`.structure-baseline.json` is outside my owned paths, and the two stale
`file-lines` entries my split leaves behind (`service.test.ts: 4787`,
`service-flow-bootstrap-generation.test.ts: 1004`) are harmless — a baseline
entry for a path that no longer reports a finding neither fails nor suppresses
anything. The supervisor can prune them with `pnpm structure:baseline`, which
only ever lowers and removes.

`AS/runtime/tests/` reports `19 source files is past the 15-file advisory
threshold` — a warning, not a failure, and down from 25.

### `wc -l` on every resulting file

`AS/runtime/tests/` — 19 files (was 25):

```
   15 intervention-mode.test.ts          115 service-fixtures.ts
   22 completed-llm-evidence.test.ts     119 native-node-runtime.test.ts
   40 pipeline-model.test.ts             120 router-runtime.test.ts
   60 reusable-llm-context.test.ts       149 composite-executor.test.ts
   64 policy-model.test.ts               180 adaptive-orchestrator.test.ts
   86 state-linker.test.ts               257 training-modes.test.ts
   92 region-compiler.test.ts            300 llm-deepseek-flow-bootstrap.test.ts
  107 reusable-llm-context-service.ts    306 io-policy.test.ts
                                         339 io-bridge.test.ts
                                         403 executor.test.ts
                                         625 live-patch.test.ts
```

`service-recordings/tests/` — 6 files, 1796 lines:

```
190 proposal-approval  238 assets  286 storage  330 state-index  361 task-proposals  391 proposals
```

`service-adaptation/tests/` — 7 files, 1800 lines:

```
190 adaptive-loop  215 modes  243 durable-patches  258 runtime-patches
280 subflow (moved)  302 llm-diagnosis  312 llm-grants
```

`service-flows/tests/` — 11 files, 2687 lines:

```
 39 instruction-readiness   96 change-feed  180 flow-map  198 creation
221 subflows  246 canonical-persistence  254 subflow-pagination (moved)
292 scale-pages  324 runs  330 execution-digest  507 representation (moved)
```

`service-bootstrap/tests/` — 7 files, 1844 lines:

```
131 harness (moved)  154 fixtures  166 catalog  255 generation
288 rejections  295 accounting  555 adaptation (moved)
```

Every file is under the 800-line hard limit. The largest file produced *by the
split* is 391 lines. The two files over the 400-line advisory
(`adaptation.test.ts` 555, `representation.test.ts` 507) are pre-existing files
moved unchanged; splitting them was not in my brief and they are well inside
the hard limit.

## Not verified

- **The suite is not reliably green on this machine under default
  parallelism.** I ran the full `automation-studio/runtime` suite twice after
  the split: once with four timeouts, once with one. Each failing test passed
  when rerun alone or with `--no-file-parallelism`. I did not run it enough
  times to characterise the rate, and I did not run `pnpm check`, `pnpm test`,
  or `pnpm build` at the repository level — only the runtime suite, Core's
  `tsc --noEmit`, and the structure audit my brief named.
- **I did not read every one of the 108 moved test bodies.** The guarantee is
  mechanical: exact source slices, a parser-enforced "every statement claimed
  exactly once" check, and an empty test-name diff over a real run. That proves
  no test was lost or renamed; it does not prove I would have spotted a wrong
  assertion, and I did not look for one.
- **No live browser or panel validation.** Not applicable to this change.
- `biome check` does not cover this tree (`No files were processed` — the tests
  directory is ignored by `biome.json`), so the new files were not linted.

## Open questions or contradictions found

**1. The split makes the suite's slowest test fall off a timeout cliff, and I
may not fix it.** This is the one thing the supervisor should decide on.

Before the split, `AS/runtime` was 61 test files; it is now 84. Wall-clock time
dropped from 178 s to 91 s because more files run in parallel, but per-test
contention rose sharply (vitest's reported cumulative test time went from 455 s
to 646 s). The test `keeps large project summary pages free of hydrated detail
payloads` builds a 10,000-item project fixture; it took 8.8 s in the pre-split
baseline, against a 15 s `testTimeout` in `packages/fluxiq/vitest.config.ts`.
It was already using 59% of its budget. Under the new parallelism it measured
15.2 s and failed.

I changed no timeout, per the brief. Nothing inside `runtime/tests/**` can fix
this — it is contention between files, not anything about the tests' contents.
The options all lie outside my owned paths, and I am not recommending one
without the supervisor's view of the wider suite:

- raise `testTimeout` in `packages/fluxiq/vitest.config.ts` (config change);
- cap `maxWorkers`/`poolOptions` so the heavy files do not all land at once;
- accept it as a known flake and always rerun failures alone.

Worth knowing: this is not new behaviour that the split invented, only behaviour
it made more likely. Core's own `docs/working/module-size-governance-plan/reports/core-automation-studio-facade.md`
already records `service-subflow-pagination.test.ts` and `service.test.ts` as
load-dependent failures across rounds 6 through 9, with the same
"passes alone, fails under load" signature. The machine's known faulty RAM is a
separate, additive hazard; these particular failures are ordinary timeouts with
a clear load correlation and a clean rerun, so I am attributing them to
contention rather than hardware, and saying so because a single observation
either way would not settle it.

**2. `tests/<subject>/tests/` reads oddly, and I believe it is nonetheless
correct.** Core's code structure says "every directory that contains source
files owns a `tests/` subdirectory". `AS/runtime/tests/service-recordings/`
contains no source files at all — only a `tests/` folder. That is a shape the
document does not describe. I used it anyway because the audit leaves no
alternative (`test-placement` fails any test file whose parent is not `tests`
or `e2e`), because it is exactly the shape the downstream repository adopted in
`1b32273` for the same reason, and because the only structurally "purer"
alternative — putting these tests in `AS/runtime/service/<collaborator>/tests/`
next to the collaborators they exercise, which is what
`service/datasets/tests/service-wiring.test.ts` already does — would have put
me outside the paths my brief gave me exclusively, in a tree another worker is
active in. If the supervisor wants that second shape instead, the move is
mechanical from here and I can do it in one pass.

**3. No budget looked wrong to me.** The brief asked me to say so if one did.
Neither the 800-line file limit nor the 25-file directory limit was the problem;
both were doing exactly what they exist to do. The 1004-line file had been
shaved twice to fit under a number, which is the failure the ratchet is meant
to force out into the open, and it split cleanly at its own seams into four
files of 166–295 lines with no test touched.
