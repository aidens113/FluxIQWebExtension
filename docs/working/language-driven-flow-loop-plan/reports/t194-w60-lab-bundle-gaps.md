# t194-w60: Lab bundle gaps (worker report)

## Outcome

Partial.

- Gaps 1 and 2 (changed paths, starting command): the producers, the Lab pass-through and their tests are done. They
  are **not yet written into `run.json`**. The run manifest contract rejects unknown keys
  (`packages/test-contracts/src/run-validation.ts:12` for a repository record, `:33` for the top level), and
  `packages/test-contracts/**` is outside my ownership. Adding the fields without the contract change would fail
  `assertRunManifest` and `parseRunManifestJson` (bench reads), so I did not wire them. The exact edits needed are
  under "Open questions".
- Gap 3 (why each re-author round stopped): **Core does not record it** anywhere the Lab reads, so there is nothing
  for the Lab to copy. I made no Lab change beyond a guard test, and did not edit Core. The Core sites that would
  have to emit it are listed below.

## What changed and why

| File | Change |
| --- | --- |
| `packages/test-runner/src/run-manifest/repository-changes.ts` (new) | `repositoryChanges(root)` runs `git status --porcelain=v1 -z --untracked-files=all`. `parsePorcelainChanges` turns the output into `{ status: "XY", path, from? }`: paths and status letters only, never content or a diff. It is capped at 200 entries and records `changesOmitted` past that. |
| `packages/test-runner/src/run-manifest/run-invocation.ts` (new) | `runInvocation(env, argv)` reads the Lab's `FLUXIQ_LAB_INVOCATION` record. Without one, it uses the runner's own argv and FLUXIQ_ names. It never reads a variable's value. It screens arguments in four ways: the value of a secret-named flag (`--token=`, `--api-key v`, `--password v`, ...), provider keys (`sk-`, `ghp_`, ...), `Bearer`, JWTs, hex runs of 32+ characters, mixed-case key runs of 32+ characters, and `token=`/`key=`-style values. Everything goes through `redactText` too. A record it cannot parse is reported as `labInvocation: "unreadable"`. |
| `packages/test-runner/src/run-manifest/index.ts` | Barrel exports both new modules. |
| `packages/test-runner/src/run-manifest/tests/repository-changes.test.ts` (new) | Covers parsing (including renames), the bound, and a real temporary git checkout. That test proves file content never appears. |
| `packages/test-runner/src/run-manifest/tests/run-invocation.test.ts` (new) | Covers a Lab record, the runner fallback, screening, an unreadable record, and name filtering. |
| `scripts/lab/lab-invocation.mjs` (new) | `labInvocationEnvironment(args, env)` builds `FLUXIQ_LAB_INVOCATION` = `{ script, args, environment: [FLUXIQ_ names] }` from the Lab's own environment, before the Lab adds its own variables. |
| `scripts/lab/run-lab.mjs` | Imports it and spreads it into `runEnvironment`, so the runner child receives it. That is the only pass-through. |
| `scripts/lab/tests/lab-invocation.test.mjs` (new) | Covers names-only and that an inherited record is not listed as a variable the person set. |
| `packages/test-runner/src/run-scenario/decision-trace/tests/publishable-tree.test.ts` | Guard test. A future round stop word under `stopped` or `noRoute.kind` would travel through `publishableTree`. One named `stopReason` would be dropped, because `CONTENT_FIELD` matches `reason$`. Core must not name it that way. |

I did not touch `run-scenario.ts`, `live-llm/**`, the lab-runs writers, `domain/**`, `apps/**` or Core.

## Gap 3: Core does not record why a round stopped

What the run's records carry (checked in `test-runs/instances/t194-slot-3/run-muqk713g-d08ad3dc/snapshots/decision-trace.json`
and `lab-runs/.../steps/*/meta.json`):

- `resultReauthor` (top level and `attempts[0]`) carries the build's final `code: flow_bootstrap.not_doable`, `stage`,
  `degraded`, `purse` and `brief`. It has no per-round stop and no no-route kind.
- `attempts[0].evidenceLoop` carries counts and decision rows. A round boundary shows only as an `iteration: 0`
  opening look. The rows end on `llm_evidence_loop.draft_unchanged`; there is no `repeat_without_progress` row.
- Step `meta.json` has `round` and `phase` (`explore`/`repair`) but no stop.
- The first build's adaptation `evidenceLoop` has counts and `toolIds`, and no rounds.

Where Core computes the stop and drops it (Core tree `fxwork/t194/!FluxIQ` at `2bc0baac`; paths under
`packages/fluxiq/src/programs/automation-studio/runtime/`):

1. `flow-bootstrap/unfinished-build/phases.ts:287`: `const ending = automationStudioFlowBootstrapRoundEnding(outcome)`.
   `:318` sets `stopped: "judged_wrong"` and `:320`/`:337` set `stopped`: one of `repeat_without_progress`,
   `iterations`, `tool_calls`, `unusable_decisions` or `budget`. Each round's value lives only in locals. The
   function would have to push `{ round, stopped }` onto a per-round list and return it on the outcome (the
   `rounds`/`trace` it already returns at `:300`, `:344-361`).
2. `phases.ts:388` (`repeated_unchanged`) and `:390` (`no_progress`): the no-route kind is passed into
   `automationStudioFlowBootstrapNotDoable` (`:349`). There it reaches only the message sentence
   (`unfinished-build/not-doable.ts:52`). The structured `tried` at `not-doable.ts:60` would need it.
3. `service/runtime-adaptation/reauthor-build.ts:135-148` (`automationStudioRefutedResultFailureOf`) copies `code`,
   `stage`, `accounting` and `evidenceLoop` from the diagnostic and drops `diagnostic.ending` (and with it `tried`).
   So even the build's ending kind never reaches `resultReauthor.attempts[]`. Fixing that also needs the
   `AutomationStudioRefutedResultFailure` type (`recovery/refuted-result/reauthor.ts:282-290`) and the attempt
   builder (`reauthor.ts:220-227`) to carry it.

Once Core writes, for example, `rounds: [{ round, stopped, noRoute: { kind } }]` on the failure's `evidenceLoop` or
the attempt, the Lab's decision trace copies it with no Lab change: the guard test pins this. One requirement: the
member must not end in `reason`, `message`, `label` and so on, or `publishableTree` drops it.

## Commands run and observed results

- Failing first:
  - `node --test scripts/lab/tests/lab-invocation.test.mjs` printed `# pass 0`, `# fail 1`, with
    `ERR_MODULE_NOT_FOUND ... scripts\lab\lab-invocation.mjs`.
  - `npx tsc --noEmit -p packages/test-runner/tsconfig.json` printed
    `repository-changes.test.ts(7,82): error TS2307: Cannot find module '../repository-changes.js'` and
    `run-invocation.test.ts(3,75): error TS2307: Cannot find module '../run-invocation.js'`.
- After implementation:
  - `npx tsc --noEmit -p packages/test-runner/tsconfig.json`: rc 0, no output.
  - `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w60 test-runner build" pnpm run build` (in
    `packages/test-runner`): rc 0, `test-runner:build ... stored in the shared store (1560 file(s), 5609238 bytes)`.
  - `node --test "dist/run-manifest/tests/*.test.js"`: `# tests 20`, `# pass 20`, `# fail 0`. Tests 13-20 are new.
  - `node --test "dist/run-scenario/decision-trace/tests/*.test.js"`: `# tests 8`, `# pass 8`, `# fail 0`.
  - `node --test scripts/lab/tests/lab-invocation.test.mjs`: `# tests 2`, `# pass 2`, `# fail 0`.
  - `node --check scripts/lab/run-lab.mjs`: ok.
- `node scripts/structure-audit.mjs`: first run `FAIL [failure-as-empty] run-invocation.ts ... line 60` (a JSON-parse
  catch returned `undefined`). I fixed it to return a named `"unreadable"`. Second run:
  `structure-audit: passed (159 warning(s), 118 baselined).`

## Samples of each new field (produced from the built dist on this tree)

`repositoryChanges(<t194 tree>)`. The tree has 50 entries, which belong to another worker's uncommitted
domain/extension edits, not mine. First four:

```json
{"changes":[{"status":" M","path":"apps/extension/src/content/actions/extract-list.ts"},{"status":" M","path":"apps/extension/src/content/actions/tests/extract-list-paging-account.test.ts"},{"status":" M","path":"apps/extension/src/content/extraction/list-reader.ts"},{"status":" M","path":"apps/extension/src/content/extraction/tests/list-reader.test.ts"}]}
```

`runInvocation(labInvocationEnvironment(["live","--scenario","everything-store","--workflow","plus-under-fifty","--token=abc"], {FLUXIQ_LAB_INSTANCE, FLUXIQ_TEST_RUNS_DIR, DEEPSEEK_API_KEY}), [])`:

```json
{"via":"run-lab","script":"scripts/lab/run-lab.mjs","args":["live","--scenario","everything-store","--workflow","plus-under-fifty","--token=[screened]"],"fluxiqEnvironment":["FLUXIQ_LAB_INSTANCE","FLUXIQ_TEST_RUNS_DIR"]}
```

## Not verified

- No live run and no Lab run: nothing was spawned through `run-lab.mjs`, so the pass-through was checked by unit test
  and `node --check` only.
- The fields do not reach `run.json` yet (contract; see below), so no bundle contains them.
- The full `pnpm test` / `pnpm check` suites were not run, per the narrow-check rule.

## Open questions or contradictions found

1. **Contract ownership (blocks wiring gaps 1 and 2).** The brief asks for the fields in the manifest, but the
   manifest contract is strict and is in `packages/test-contracts`, which I do not own. To finish (about 15 lines):
   - `packages/test-contracts/src/run.ts:6`: change `RepositoryRevision` to
     `{ path; commit; dirty; changes?: Array<{ status: string; path: string; from?: string }>; changesOmitted?: number }`.
     Add `invocation?: { via: "run-lab" | "test-runner"; script?: string; labInvocation?: "unreadable"; args: string[]; fluxiqEnvironment: string[] }`
     to `RunManifest`.
   - `packages/test-contracts/src/run-validation.ts:12`: add `"changes", "changesOmitted"` to the `keys` list, with
     array and string checks. At `:33`, add `"invocation"` with a check: `via` enumerated, `args` and
     `fluxiqEnvironment` string arrays, names matching `^FLUXIQ_[A-Z0-9_]+$`.
   - `packages/test-runner/src/run-manifest/create-run-manifest.ts` (mine): in `revision()`, call
     `repositoryChanges(root)` in place of the `status --porcelain` call. Set `dirty` to `changes.length > 0 || changesOmitted`
     and spread `changes`/`changesOmitted` into the record. Add `invocation: input.invocation ?? runInvocation()` to the
     returned object, plus an optional `invocation` input so `create-run-manifest.test.ts` can pin it.
   Either widen my ownership to the two contract files and re-dispatch, or apply the contract edits and I or the
   supervisor add the two wiring lines.
2. `LAB_INVOCATION_VARIABLE` is declared in both `scripts/lab/lab-invocation.mjs` and `run-invocation.ts`, because a
   script cannot import TS source. Each file's comment names the other. No test cross-checks them.
3. Gap 3 needs a Core change (above). The brief forbade Core edits, so it remains open.

## Commit message (for the supervisor)

```
Lab: name a run's uncommitted paths and its starting command, ready for the manifest (t194-w60)

repository-changes.ts lists git status --porcelain=v1 -z paths and status
letters (no content, bounded at 200); run-invocation.ts records the Lab's
argv and FLUXIQ_ variable names, screened, passed from run-lab.mjs as
FLUXIQ_LAB_INVOCATION. Not yet in run.json: the run contract in
packages/test-contracts rejects unknown keys. A guard test pins that a
Core round stop word under `stopped`/`noRoute.kind` would reach the
decision trace; Core records none today (phases.ts:287-390,
reauthor-build.ts:135-148).

Task: t194
Worker: t194-w60

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
