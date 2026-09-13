# p-demo-module — giving the create-UI module its own directory

## Outcome

**Done.** `packages/test-runner/src/demo-llm-create-ui.ts` (837 lines) is now
`packages/test-runner/src/demo-llm-create-ui/` — 14 source files behind a
barrel — with `p-test-split`'s five test files beneath it in
`demo-llm-create-ui/tests/`. The wall is gone: `node scripts/structure-audit.mjs`
exited **0** with everything staged, where it exited 1 before.

**Read "A new, unrelated audit failure appeared while I was finishing" before
you act on a red audit.** Minutes after my acceptance run, another worker
added `domain/src/runtime/llm-evidence` to `contractSpreadPaths` in
`scripts/structure-audit/config.mjs`, and that path is not clean yet, so the
audit is red again for six `contract-spread` findings — every one of them in
`domain/`, none in any path I touched, and not one of them a
`directory-files` finding.

Test totals are equal before and after: **435 tests, 435 pass, 0 fail** in
both runs, and each of the twenty rows `p-test-split` moved is present exactly
once in each run.

`.structure-baseline.json` was **not** edited. See "The baseline, deliberately
left alone".

## What changed and why

### The move

`demo-llm-create-ui.ts` carried three of the repository's own recorded
violations at once — 837 lines against an 800-line hard limit, 21 exported
values against a 15-value limit, and one seventeenth of the `demo-` prefix
group at `packages/test-runner/src`. All three are the same finding said three
ways: the file was a directory that had not been made yet.

| new file | lines | what it owns |
| --- | --- | --- |
| `limits.ts` | 27 | The frozen LLM profiles, the derived command timeout, and the Settings field table built from them. |
| `creation-outcomes.ts` | 22 | The three result shapes a completed run reports: proposal checkpoint, paid-call accounting, applied topology. |
| `runner-fail.ts` | 8 | The two ways this module refuses, both through `RunnerFailure`. |
| `json-shapes.ts` | 18 | Narrowing an untrusted JSON body without keeping any of it. |
| `panel-interaction.ts` | 61 | Every Playwright seam: the unambiguous-locator guard, the virtualized hierarchy scroller, the review dialog driver. |
| `settings-save-failure.ts` | 66 | What a rejected Flow Settings save is allowed to keep. |
| `generation-failure.ts` | 124 | What a failed generation is allowed to keep, and the domain-derived evidence-step allowlists. |
| `generation-readiness.ts` | 100 | The provider-free GET gate in front of the one paid call. |
| `flow-settings-ui.ts` | 96 | Installing the bounded limits through the real Settings form and reading them back. |
| `adaptation-lifecycle.ts` | 88 | Control-client-only: clear the stale proposal, inspect what applying one built, parse the apply digest. |
| `build-flow-ui.ts` | 104 | The one paid Flow bootstrap call, session sync through approve-and-apply. |
| `apply-proposal-ui.ts` | 70 | Approving and applying a proposal that already exists. |
| `explore-proposal-ui.ts` | 187 | The proposal-only exploration, its terminal classifier, and its proposal parser. |
| `index.ts` | 18 | The barrel. Exactly the names `demo-llm-create-ui.ts` exported. |

15 files including the barrel, one under the 15-file advisory threshold, so
the new directory produces no warning of its own. Largest file 187 lines
against a 400-line advisory. No two members share a filename prefix three
times over, so the split does not create the very finding it resolves
(`generation-` is the largest group, at two).

### The move was mechanical, and checked as one

Nothing was retyped. Every line came out of the original by `sed` line range.
Normalising both sides identically — drop blank lines, drop top-level `import`
lines, drop top-level `//` comment lines, strip a leading `export `, sort —
the original's 795 body lines and the thirteen non-barrel new files' 796
differ by exactly **one line**, a bare `//` paragraph separator in a header
comment I wrote. `diff` reported nothing else.

Three things are genuinely new rather than moved, all of them forced by the
directory boundary: `export` was added to `CreationSettingsLimits` and
`BuildApproveApplyCreationInput` (both were file-local types that two files
now share), `export` was added to the file-local helpers that other members
now call, and each file got a header comment plus its own import block.

**The public surface is byte-identical.** Importing the built barrel in Node
and listing its keys gives exactly the 21 value exports the old module had —
no name missing, no name added. That is why `src/index.ts`'s `export * from`
still produces the same package surface.

### The five test files

Moved to `demo-llm-create-ui/tests/` and renamed with the now-redundant prefix
stripped, which is what the prefix rule asks for:

| was | is |
| --- | --- |
| `src/tests/demo-llm-create-ui-adaptation-lifecycle.test.ts` | `tests/adaptation-lifecycle.test.ts` |
| `src/tests/demo-llm-create-ui-exploration.test.ts` | `tests/exploration.test.ts` |
| `src/tests/demo-llm-create-ui-failure-sanitizer.test.ts` | `tests/failure-sanitizer.test.ts` |
| `src/tests/demo-llm-create-ui-provider-free-commands.test.ts` | `tests/provider-free-commands.test.ts` |
| `src/tests/demo-llm-create-ui-readiness-gate.test.ts` | `tests/readiness-gate.test.ts` |

No assertion was changed. What changed is where four of them look:

- import specifiers `../demo-llm-create-ui.js` to `../index.js`, and
  `../secret-keys-ui.js` to `../../secret-keys-ui.js`;
- `const root` climbs five levels instead of four, since the tests now compile
  one directory deeper;
- three rows read the module's own text. They now read **every file in the
  directory, concatenated in a stable order**, through a new support module
  `tests/module-source.ts`. Reading one file would have silently stopped
  covering whatever moved to a sibling — and a `doesNotMatch` row that reads
  less text is a row that stopped failing. Two readings are offered because
  the rows wanted two different things: `readCreateUiSource()` returns the
  `.ts` files (what `exploration` and `failure-sanitizer` read), and
  `readCreateUiBuildOutput()` returns the compiled `.js` files beside the
  tests in `dist` (what `readiness-gate` read, via
  `new URL("../demo-llm-create-ui.js", import.meta.url)`).

I verified those rows still bite rather than passing vacuously: the
`if (exactFlowName)` to `} else {` slice is a real 1,260-character branch that
correctly excludes `search.fill("Settings")`, and the four ordering markers in
`readiness-gate` are found at increasing offsets 12291 < 12693 < 13320 < 14283
of the concatenated compiled output.

### Every importer updated

Eight files imported the module; all eight now name the barrel. None of them
is a file this brief put out of bounds — `run-scenario.ts` and `flow-lane/**`
do not import it.

`demo-llm-exploration-request.ts`, `index.ts`, `tests/demo-llm-creation.test.ts`,
and `demo-workspace/{adaptation-ui,bound-exploration,creation-lanes,diagnosis-ui,exploration-checkpoints,panel-run}.ts`.

One more, outside the eight: `failure.ts:16` had a prose reference to
`demo-llm-create-ui.ts` in a comment explaining why the evidence allowlist
derives from the domain. Changed to `demo-llm-create-ui/`. A comment is not an
importer, but a stale path in a comment is the same defect one release later.

### How far I took the 17-member `demo-` group, and why

**One member, not all seventeen.** The rule's own remedy is "create `src/demo/`
and strip the prefix", which would relocate sixteen more modules and the
24-file `demo-workspace/` directory beside them, rewriting import specifiers in
**34 files** — including `commands.ts`, `cli.ts`, `coordinator.ts`,
`interactive-session.ts`, `scenarios.ts` and seventeen `src/tests/demo-*.test.ts`
files, several of which other workers are editing right now.

Moving this one member is not an arbitrary seventeenth of that job:

- It is the only member of the group carrying hard-limit violations of its own
  (837/800 lines, 21/15 exported values). The other sixteen are within every
  per-file budget; they are a naming problem, not a size problem.
- It is the member whose tests were the wall. Nothing else in the group was
  blocking anything.
- Moving it lowers the group 17 to 16 rather than dissolving it, which is the
  ratchet working as intended: the next worker to touch a `demo-*` module
  inherits a tighter budget, and the directory now standing beside them
  demonstrates the shape the remaining sixteen should take. It is the same
  shape `demo-workspace/` already has.

A wholesale reorganisation is real work that deserves its own brief and a
quiet tree. Doing it here would have meant editing files this brief forbids.

### The inherited index

`p-test-split` left a staged deletion of
`src/tests/demo-llm-create-ui.test.ts` in the shared index and could not undo
it. I completed the picture rather than leaving half of a move staged: the
index now carries the whole change — the new directory added, the old module
deleted, every importer updated — and nothing else of mine. `git diff --cached`
lists 32 paths, all of them this task's.

**One caveat the supervisor should know.** One of those 32,
`packages/test-runner/src/index.ts`, also carried another worker's unstaged
edit (`export * from "./lab-instance/index.js"`). Staging my one-line change to
that file necessarily staged theirs too. I judged that better than the
alternative: leaving it out would have staged a move whose barrel still points
at a deleted file, which does not compile. Their line is complete and the
`lab-instance/` files it names exist in the tree.

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=p-demo-module` was exported for every command.
No `pnpm lab` command and no `pnpm build` was run. Exit statuses were captured
by redirect, never by pipe.

| command | exit | observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (before, 1st) | 1 | `# tests 399 / # pass 392 / # fail 7`. Not a real result — see "Not verified". |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (**before**) | 0 | `# tests 435 / # pass 435 / # fail 0` |
| `node scripts/structure-audit.mjs` (before, real index) | 0 | `passed (31 warning(s), 19 baselined)` plus `1 baseline entries can be lowered` |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` (before, five split files staged) | **1** | `FAIL [directory-files] packages/test-runner/src/tests/: 55 source files exceeds the 25-file limit … Baseline for this entry is 51` |
| `pnpm --filter @fluxiq-web-extension/test-runner run check` (after, 1st) | 2 | `readiness-gate.test.ts(14,47): error TS2307: Cannot find module '../secret-keys-ui.js'` — the test moved one level deeper. Fixed. |
| `pnpm --filter @fluxiq-web-extension/test-runner run check` (**after**) | 0 | `tsc -p tsconfig.json --noEmit`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (**after**) | 0 | `# tests 435 / # pass 435 / # fail 0` |
| `node scripts/structure-audit.mjs` (**after**, move staged) | **0** | `passed (30 warning(s), 17 baselined)` plus `3 baseline entries can be lowered` |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` (**after**) | **0** | identical: `passed (30 warning(s), 17 baselined)` |
| `node scripts/structure-audit.mjs --json` (after) | 0 | `failures: []` |
| barrel export surface, via `import()` of the built `index.js` | — | 21 keys, `missing: []`, `extra: []` |
| `node scripts/structure-audit.mjs` (**re-check, minutes later**) | 1 | `6 violation(s) across 1 rule(s)`, all `contract-spread`, all under `domain/src/runtime/llm-evidence/`. Not mine — see below. |
| `node scripts/structure-audit.mjs --json` (re-check) | 1 | `rules: ['contract-spread']`; `paths outside domain/: []`; `any failure under packages/test-runner: false`; `any directory-files failure: false` |

### A new, unrelated audit failure appeared while I was finishing

Between my acceptance run and my last re-check, another worker added a fourth
entry to `contractSpreadPaths` in `scripts/structure-audit/config.mjs`:

```
path: "domain/src/runtime/llm-evidence",
```

That directory has 53 spread properties across six files and has not been
converted to `present<T>()` yet, so the audit is red again. The config file's
own comment says a path should be "configured only once it is clean", which
suggests the conversion is still in flight beside it.

**None of it is mine, and it does not change my result.** Machine-checked
against the audit's own JSON: 6 failures, one rule (`contract-spread`), zero
outside `domain/`, zero under `packages/test-runner`, and **zero
`directory-files` findings of any kind** — which is the rule that was the wall.
The supervisor should attribute a red audit to that worker's path, not to this
move, and should re-check with `--json` rather than by exit code alone while
the two changes are in the tree together.

### The counts, before and after

**435 before, 435 after.** The totals are equal, and the sorted list of
subtest names is *identical* between the two runs — `comm -3` on them printed
nothing at all. Each of the twenty titles `p-test-split` moved appears exactly
once in each run (checked one by one; zero mismatches).

### What the audit says now

The three entries the brief predicted, and only those:

| rule | key | recorded | now |
| --- | --- | --- | --- |
| `directory-files` | `packages/test-runner/src/tests` | 51 | **50** |
| `directory-files` | `packages/test-runner/src` | 50 | **49** |
| `naming` | `packages/test-runner/src::demo` | 17 | **16** |

Two further entries no longer match anything at all, because their subject no
longer exists: `file-lines packages/test-runner/src/demo-llm-create-ui.ts`
(837) and `exported-values …::values` (21). That is the whole of the drop from
19 baselined findings to 17.

### The baseline, deliberately left alone

I did not run `pnpm structure:baseline` and I did not hand-edit
`.structure-baseline.json`, for three reasons:

1. **It is not needed.** The audit already exits 0. Lowering is an
   improvement, not a fix.
2. **The brief said to stop and say so.** It did.
3. **It would be actively risky right now.** `src` is at 49 against a recorded
   50 and `src/tests` at 50 against 51 — exactly one file of headroom each.
   Recording those values while other workers are still adding files to
   `packages/test-runner/src` would hand the next worker the same wall this
   task existed to move, one file lower. `pnpm structure:baseline` belongs
   after the parallel wave has landed, run once, by the supervisor.

## Not verified

- **No browser or live validation.** These are `node:test` rows over pure
  functions, source text and stubbed clients. The moved module is a Playwright
  driver for the FluxIQ panel; nothing here drove a real panel, a real
  browser, or a real provider. A move cannot change UI behaviour, but it can
  change which module a selector lives in, and only a live creation run would
  prove the drivers still work end to end.
- **Root `pnpm check`, `pnpm test` and `pnpm build` were not run.** `build` is
  forbidden by the brief; the other two would not have been attributable to me
  with this many workers editing the tree. I ran the test-runner package's own
  `check` and `test` and the structure audit against both indexes.
- **The first `test` run of the session is not a real failure.** Seven files
  failed with `ERR_MODULE_NOT_FOUND` on `domain/dist/index.js`; `domain/dist`
  was mid-rebuild by another worker at 17:58–17:59 and `index.js` had not been
  emitted yet. It appeared a minute later and the re-run was clean. I did not
  cause it and did not fix it.
- **The package `check` rebuilt `domain/dist`** (its `domain:dist` guard found
  `domain/dist/index.d.ts` absent, again mid-rebuild). `domain/dist` is
  gitignored, so nothing tracked changed, but it is shared output another
  worker may have been part-way through.
- **Stale `dist` artifacts have to be deleted by hand, and I saw them come
  back.** `tsc` does not clean `dist`, so the compiled copies of the old module
  and the five old test paths survived their sources. I deleted them; a
  concurrent build by another worker recreated
  `dist/demo-llm-create-ui.{js,d.ts}` once, from a source file I had already
  removed, and I deleted them again before the measured run. The final run's
  output mentions `demo-llm-create-ui` zero times, so nothing stale executed —
  but any worker deleting or moving a source file in this package must do this
  by hand, and nothing in the build enforces it. This is the second worker in
  a row to hit it.
- **The audit did not stay green, for a reason outside this task.** It went
  red again within minutes on six `contract-spread` findings in `domain/`,
  from another worker's edit to `scripts/structure-audit/config.mjs`. I
  verified by rule and by path that none of it is mine, but I could not verify
  the repository is green overall at hand-off, because it is not.
- **Both directory entries now sit exactly one file below their recorded
  value** (`src` 49/50, `src/tests` 50/51). One more tracked file in either
  directory puts it back at its baseline, and a second one fails the audit.

## Open questions or contradictions found

1. **The brief's two instructions about `.structure-baseline.json` point
   opposite ways.** Ownership grants it "only to lower entries your move
   genuinely lowers"; the warning says "if you believe a baseline update is
   needed at the end, stop and say so instead". I followed the warning, since
   no update is needed for the acceptance test. Three entries are lowerable
   and two are dead; the arithmetic is in the table above if the supervisor
   wants them recorded.
2. **Nothing in the moved code looked wrong.** I was told not to improve logic
   while relocating it, and found nothing I was tempted to change. The one
   thing worth flagging as an observation rather than a defect:
   `readiness-gate.test.ts` reads the compiled output while its two siblings
   read the TypeScript source. Both work; I preserved the distinction rather
   than unifying it, because unifying it would change what those rows actually
   inspect.
3. **The `demo-` group is still 13 members over its limit.** 16 against a
   limit of 3, held only by a baseline. The remedy is a real piece of work —
   34 files' import specifiers — and it wants its own brief and a tree that is
   not full of in-flight edits.
