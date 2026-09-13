# g-core-withholding-execution — execution uses real values; the saved copy is withheld

Worker report for `g-core-withholding-execution` in the twenty-ninth dispatch of
[finish-week1.md](../briefs/finish-week1.md). FluxIQ Core `F:\!FluxIQ`, branch
`dev`, at `240c73e`, uncommitted. Written 2026-09-13. It builds on the uncommitted
diffs from `g-core-input-withholding` and `g-core-attempt-withholding`, which are
kept.

## Outcome

**Done.** All five tasks are built and tested, and every guard has a mutation
proof. All gates the brief names pass: the seventeen-file vitest run, Core
`pnpm check`, `pnpm docs:reference` and `pnpm docs:check`.

- **Live-patch reruns** are seeded from the failed attempt as the run executed
  it, on both service paths. The saved trace still reads `[withheld]`.
- **A Call Flow parent** builds its outputs, and a bound error message, from the
  trace its child executed. The child trace its attempt keeps is withheld.
- **One text rule** in a new framework file, `runtime/text-withholding.ts`, is
  used by both `trace-withholding.ts` and the runtime service.
- **Migration Notes** in the 0.4.0 entry now carry:
  - the attempt-withholding paragraph as built;
  - "Execution is unchanged";
  - the new export and parameters;
  - `g-core-bridge-order`'s arrival-order line, as the coordinator asked.
- **Both architecture pages** state the run-input rule.

**Beyond the brief's letter, for the supervisor to confirm (Open question 1).**
Reading real child values would have opened a new leak into the parent's saved
trace, so a parent also withholds every value its Call Flow child withheld.

## What changed and why

Paths are under `F:\!FluxIQ\packages\fluxiq\src\` unless absolute.

### Getting the executed trace to a caller

`runAutomationStudioGraph` still returns the saved trace, the one that gets
persisted. There was no way for a caller to reach the trace the run executed
with, so there is now an explicit one.

- **`programs/automation-studio/runtime/executor/graph-run.ts`**
  - **New optional third parameter** (`:42`): `onExecutedTrace?(executed, saved)`.
    It is called once, after the saved trace is built (`:56`). Its comment says
    the executed trace is for executing with only, never to be persisted or
    published.
  - **Why a positional parameter.**
    - The executor barrel `executor/index.ts` re-exports `runAutomationStudioGraph`
      by name, and I do not own it. A parameter needs no barrel change.
    - An `options` field would need `executor/contracts.ts`, which I do not own.
    - An `options` field would also be copied into every child run and rerun,
      because the composite and live-patch code spread `options`.
  - **The `withholdRunInputs` comment** now gives the real reason for withholding
    by position. Withholding by value would make the saved trace misreport a
    computed value such as 5 + 0. It also names the known gap (open question 3).
- **`programs/automation-studio/runtime/composite-executor.ts`**
  - **Pairing** (`:28-29`): a local `WeakMap` pairs each saved trace a graph run
    returned with its executed trace, filled through the new callback (`:75`).
  - **Why pairing by identity.** When `runChildWithBounds` returns a deadline,
    cancellation or cycle trace, that trace has no entry and is read as it is. A
    late-finishing child can never be mistaken for the returned trace.
  - **The parent reads the executed child** (`:66`): `executedChild` feeds the
    interface outputs, the output bindings, and the bound error message. The
    attempt still gets the saved `childTrace`.
  - **New optional fifth parameter**, `onExecutedTrace` (`:17`). It hands on the
    root's executed trace (`:82`), and is not called when composition or regions
    are invalid.

### Task 1: live-patch reruns

- **`programs/automation-studio/runtime/service.ts`, the live-patch rerun inputs
  only, still 6807 lines (its baseline).**
  - **Routed path.**
    - `:3488` declares `let routedFailedTraceAttempt`.
    - The `runCanonicalAutomationStudioFlow` call at `:3490` sets it from the
      executed trace.
    - The old line that read it from the saved `trace` (was `:3528`) is deleted.
  - **Direct (legacy single graph) path.**
    - `:3557` declares `let failedTraceAttempt`.
    - The `runCanonicalAutomationStudioFlow` call at `:3571` sets it.
    - The old line (was `:3583`) is deleted.
  - **The plain `runAutomationStudioGraph` branch** takes no callback. It runs
    only when there is no canonical Flow, and then `adaptationContext` is `null`,
    so no live patch ever reads the attempt.
  - **Imports.** The executor import widened by `type AutomationStudioNodeAttemptTrace`.
  - **Where the executed attempt goes.** `maybeAnnotateRunDetailWithRuntimeLlm`
    uses it only as `patchInput.failedAttempt` and `expectedComparison`
    (`:3097-3098`). What the service saves from a patch is:
    - `runtimePatchAttempts`: status fields only;
    - the adaptation: the attempt's ids, status and route;
    - the change proposal: no attempt data.

    The new service rows also assert that no file under the data directory holds
    the run's input.
- **`programs/automation-studio/runtime/live-patch.ts`**
  - A comment on `failedAttempt` (`:51`): a rerun is seeded from its `inputs`, so
    it must be the attempt as executed.
  - No code change: `:182` still reruns with `inputs: input.failedAttempt.inputs`.

### Task 2: Call Flow, and the parent's saved copy

- **Composite.** Above.
- **`graph-run.ts`, a parent withholds what its child withheld.**
  - **Record** (`:20`): a module-private `WeakMap` keyed by each saved trace this
    module returns holds that run's withheld values, set at `:55`.
  - **Merge** (`:50-52`): before the rewrite, each attempt with a `childTrace`
    feeds that child's values into the parent's withholding, through a new
    `include` method.
  - **Nesting.** A grandchild's values reach the parent through the child's own
    merge.
- **`trace-withholding.ts`, new method `include(values)`** (`:93`, `:113`). It
  adds another run's withheld texts and numbers, skipping empty texts and
  non-finite numbers.

### Task 3: one replacement rule

- **`runtime/text-withholding.ts`** (new, 56 lines). It exports
  `fluxiqRuntimeTextWithholding(texts): (text) => string` (`:25`), built once per
  set of texts.
  - **The rule.** Every stretch of the string covered by an occurrence of a
    withheld text becomes `FLUXIQ_RUNTIME_WITHHELD_VALUE`, and overlapping
    occurrences share one marker.
    - A text that contains another, or overlaps it, is replaced whole and leaves
      no fragment, which is what "longest first" was for.
    - Occurrences that only touch stay separate markers, as `split`/`join` gave.
  - **Idempotence.** Occurrences are found in the string as given, and one that
    lies inside a `[withheld]` already present is skipped. A marker is therefore
    never rewritten, and withholding a string twice gives the same result. This
    matters because a parent's rewrite now walks its child's saved trace. See
    open question 2 for why this differs from a sequential longest-first rule.
- **`runtime/index.ts`** gains `export * from "./text-withholding.ts";`.
- **`runtime/service.ts`** (now 454 lines, down from 459)
  - The lookup is `{ text, numbers }`, built from the helper (`:413-416`).
  - `withheldJson` and `withheldResult` call `withheld.text`.
  - The private sort and `withheldText` are removed.
- **`trace-withholding.ts`**
  - `apply` builds the helper once per call (`:122`).
  - The walk takes `{ text, numbers }`, and the private `withheldText` is removed.
  - The header comment names the shared rule.

### Tests

- **`programs/automation-studio/runtime/tests/composite-executor.test.ts`**, two
  new rows.
  - **`:51`, the brief's composite row.**
    - Setup: a child with authored defaults `left` 5 and `right` 0, and a
      `builtin.math.add` node. Output `result` is bound to `total`.
    - Asserts that the parent sees `total === 5`, and that the child's saved
      trace has `left` and `right` withheld in `values` and in every attempt's
      `inputs`.
    - **Why it adds a pass-through output.** The child also declares `left` as an
      output, bound to `first`. Under the positional rule the computed `result`
      is never withheld, so `total` alone would pass even if the parent read the
      saved child trace. `first` reads a withheld position, and catches that
      (M1).
  - **`:85`, the parent's saved copy.**
    - Setup: a child whose `builtin.data.constant` resolves `note` through
      `$state` and hands it back as `value`, bound to `echoed`.
    - Asserts that the executed root trace (through the new fifth parameter)
      holds the value at `echoed`, while the saved parent trace holds it nowhere.
- **`programs/automation-studio/runtime/tests/service-flow-representation.test.ts`**,
  a new `describe` (`:351`) with one row per service path (`:377`): routed, and
  legacy single graph.
  - **Setup.** An adaptive Flow with a mock LLM provider that returns one
    `temporary_wait_retry` patch targeting `divide`. `gate` fails because nothing
    answers its binding, so its attempt's inputs are the run inputs
    `{ left: 6, right: 3, note }`.
  - **What tells the two apart.** The rerun starts at `divide`: 6 / 3 succeeds,
    while `[withheld]` reads as 0 and fails the division.
  - **Asserts:**
    - `runtimePatchAttempts` shows `traceStatus: "succeeded"` and
      `restoredExpectedState: true`;
    - the saved `gate` attempt holds `[withheld]` for all three inputs;
    - no file under the data directory holds the synthetic `note`;
    - the legacy row also asserts `flow.legacy_single_graph_execution`, which
      proves it took the direct path.
  - **Why this file.** `runtime/tests` is at its 25-file limit, and
    `runtime/tests/service.test.ts` is at its 4787-line baseline.
- **`programs/automation-studio/runtime/executor/tests/trace-withholding.test.ts:164`.**
  - Setup: a node binds `hint` (an inner value, resolved first) and `text` (an
    outer value containing it), and fails quoting the outer value.
  - Asserts that neither synthetic prefix appears anywhere in the saved trace,
    and that the message reads `Could not type [withheld] into #password.`.
- **`programs/automation-studio/runtime/executor/tests/graph-run.test.ts:55`.**
  - Asserts the callback is called once with the returned trace as `saved`.
  - Asserts `executed` holds the real input in `values` and in the attempt's
    `inputs`, while the saved trace holds it nowhere.
- **`runtime/tests/text-withholding.test.ts`** (new), five rows:
  - containment, in both orders;
  - overlap;
  - touching occurrences;
  - a marker is never rewritten, and a second pass is identical;
  - empty or absent texts.

### Documentation

- **`F:\!FluxIQ\docs\architecture\automation-studio.md`**, the paragraph that was
  `:407-418`. It is now three bullets:
  - resolved values;
  - run inputs by position, with the known gap;
  - a Call Flow child's withheld values.

  It then covers inputs withheld at rest in the session record and the
  run-summary envelope, and says that execution reads real values: the run
  itself, a Call Flow parent, and a live-patch rerun.
- **`F:\!FluxIQ\docs\architecture\automation-studio-native-nodes.md`**, section
  "A resolved value never reaches the persisted trace". The intro now covers run
  inputs. New bullets:
  - every run input withheld where the trace saves it, with the known gap;
  - one text rule;
  - a Call Flow child's withheld values stay withheld in its parent.

  "Execution is untouched" now covers Call Flow parents, live-patch reruns and
  `onExecutedTrace`. The anchor the other page links to is unchanged.
- **`F:\!FluxIQ\docs\architecture\package-boundaries.md`**, the unreleased 0.4.0
  entry only:
  - **Intro bullet** (`:110`): "reads saved command attempts or run inputs back".
  - **`g-core-bridge-order`'s line** (`:140`), as the bullet **Arrival order.**
    under "A client-started recording is ordered with what follows it". It is
    taken from that worker's report. "can differ from 0.4.0" became "can differ
    from earlier releases", because the line now sits inside 0.4.0's own note.
  - **The attempt-withholding paragraph as built** (`:184`), placed after the
    run-input paragraph that was already there. It is the redispatch report's
    text with three changes:
    - "still executes the unwithheld command" moved into the execution paragraph;
    - the Run inputs bullet names the known gap;
    - a **Call Flow** bullet was added.
  - **"Execution is unchanged; only saved copies are withheld."** (`:215`), with
    the two new optional parameters.
  - **"One text rule withholds inside strings."** (`:229`), with the new export.
- **`docs/reference/framework-reference.md` and
  `packages/fluxiq/docs/reference/framework-reference.md`.** Regenerated by
  `pnpm docs:reference`. It regenerates from the whole tree, so other workers'
  uncommitted changes are included too, as expected.

## Commands run and observed results

Output went to `gcwe/*.out` files in my scratchpad, with each exit code echoed.

- **Starting tree.** `git log --oneline -3` printed `240c73e`, `5845f5d`,
  `187f40d`. `git status --short` listed the earlier workers' uncommitted files.
- **Narrowing probe (scratch file).** It checked that a `let` assigned inside a
  callback is not narrowed to `never`. `npx tsc --noEmit --strict --exactOptionalPropertyTypes --skipLibCheck ...`
  printed `exit=0`. The first attempt, without `--skipLibCheck`, failed only on
  `@types/qrcode` DOM names, which is unrelated.
- **Type check.** `npx tsc --noEmit` in `packages/fluxiq`: `exit=0`.
- **Line counts.** `wc -l` printed:
  - `6807` for `automation-studio/runtime/service.ts` (baseline 6807);
  - `454` for `runtime/service.ts`;
  - `56` for `runtime/text-withholding.ts`;
  - `270` for `graph-run.ts`, `200` for `trace-withholding.ts`, `97` for
    `composite-executor.ts`, `376` for `live-patch.ts`.
- **First test run** (seven files, `--no-file-parallelism`): `exit=1`,
  `Tests 2 failed | 56 passed (58)`.
  - Both new service rows failed with
    `expected { attemptId: 'start.attempt.1', …(10) } to match object { nodeId: 'gate', …(2) }`.
  - This was a real defect in my test: `attempts[0]` is the start node.
  - Their `runtimePatchAttempts` assertion, on the line before, had already
    passed.
  - I fixed the lookup to find the `gate` attempt.
- **Rerun of that file.** `exit=0`, `Tests 10 passed (10)`.
- **Structure audit with the new files.**
  - Method: `.git/index` copied to a scratch `GIT_INDEX_FILE`, then `git add` of
    `runtime/text-withholding.ts`, its test and `executor/tests/graph-run.test.ts`,
    then `node scripts/structure-audit.mjs`.
  - Result: `exit=0`, `structure-audit: passed (122 warning(s), 256 baselined).`
  - One advisory warning is new:
    `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-flow-representation.test.ts: 498 lines is past the 400-line advisory threshold.`
    The file is 499 lines after the last assertion.
- **Mutations.** Scratch script `gcwe-mutate.mjs`. For each mutation it:
  - checks the original text occurs exactly once;
  - writes the mutation and runs the owning test file, with `-t` where given;
  - restores the original bytes in `finally`;
  - compares SHA-256.

  Every mutation was caught, and every restore printed `byte-identical=true`.

  | Mutation | Test | Observed failure |
  | --- | --- | --- |
  | M1 `composite-executor.ts`: `executedChild = childTrace` | composite `:51` | `expected '[withheld]' to be 5` |
  | M2 `composite-executor.ts`: the attempt keeps `childTrace: executedChild` | composite `:51` | `expected { left: 5, right: +0, …(8) } to match object { left: '[withheld]', …(2) }` |
  | M3 `graph-run.ts`: `withholding.include(childWithheld)` becomes `void childWithheld` | composite `:85` | `expected '{"status":"succeeded",…' not to contain 'synthetic-call-flow-value-that-must-n…'` |
  | M4 `service.ts:3490`: callback reads `saved.attempts` | service rows, routed | `expected [ { …(8) } ] to deeply equal [ ObjectContaining{…} ]` (the `runtimePatchAttempts` row) |
  | M5 `service.ts:3571`: callback reads `saved.attempts` | service rows, legacy single graph | the same |
  | M6 `trace-withholding.ts`: the old rule, replacing in recorded order | trace-withholding `:164` | `expected '{"status":"failed",…' not to contain 'synthetic-outer'` |
  | M7 `text-withholding.ts`: `Math.max` becomes `Math.min` (overlaps not merged) | text-withholding | `2 failed`: `'a [withheld]-lap-synthetic-right b'`, and `'[withheld]ld [withheld] [withheld]'` |
  | M8 `text-withholding.ts`: no marker filter | text-withholding | `expected '[withheld] [withheld] [with[withheld]]' to be '[withheld] [withheld] [withheld]'` |
  | M9 `runtime/service.ts`: text rule becomes identity | runtime `service.test.ts` | `expected '{\n  "attempt": …' not to contain 'synthetic-runtime-value-that-must-nev…'` |
  | M10 `graph-run.ts`: `onExecutedTrace?.(saved, saved)` | graph-run `:55` | `expected '[withheld]' to be 'synthetic-run-input-that-must-never-b…'` |

- **The brief's test gate, run alone.** `npx vitest run` over seventeen files
  with `--no-file-parallelism`: `exit=0`, `Test Files 17 passed (17)`,
  `Tests 251 passed (251)`, `Duration 120.95s`.
  - **The redispatch's fifteen:**
    - framework `runtime/tests/service.test.ts`;
    - executor `node-execution`, `trace-withholding`, `attempt-trace`,
      `transition-comparison` and `graph-run`;
    - `io-policy`, `io-bridge`, `composite-executor` and `region-compiler`;
    - `nodes/tests/parameter-bindings`, `runtime/tests/executor` and
      `native-node-runtime`;
    - `service-flow-representation`, and Automation Studio `service.test.ts`
      (108 tests).
  - **Plus two:** `runtime/tests/text-withholding.test.ts` and
    `runtime/tests/live-patch.test.ts`.
- **`pnpm docs:reference`.** `exit=0`,
  `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (1577 public declarations).`
  - New row: `fluxiqRuntimeTextWithholding` (`runtime/text-withholding.ts:25`).
  - Moved rows: `runAutomationStudioGraph` `:25` to `:42`,
    `runCanonicalAutomationStudioFlow` `:7` to `:17`, and the `live-patch.ts`
    rows by +5.
  - `git diff --stat` against HEAD is 95 lines per copy, including the other
    workers' rows.
- **`pnpm docs:check`.** `exit=0`,
  `Validated local links in 101 authored/reference Markdown files.` and
  `Deterministic framework reference is current.`
- **Core `pnpm check`, run alone.** `exit=0`:
  - `# fail 0` in the structure tests;
  - `structure-audit: passed (122 warning(s), 256 baselined).`;
  - `packages/contracts check: Done`, `packages/client-gateway-websocket check: Done`,
    `packages/fluxiq check: Done`, `apps/web check: Done`.
- **Final tree.** `git status --short` lists:
  - **Mine:** the files above, plus untracked `runtime/text-withholding.ts` and
    its test.
  - **The earlier withholding workers':** `executor/contracts.ts`,
    `node-execution.ts` and its test, `io-policy.ts` and its test,
    `runtime/contracts.ts`, the runtime-stream-store pair, `runtime-kernel.md`,
    and untracked `graph-run.test.ts`, which I extended.
  - **Client Gateway workers', untouched by me:**
    - `client-gateway/bridge.ts` and its test;
    - untracked `client-recording-write-order.ts` and its test;
    - untracked `bridge-restart.test.ts`;
    - `src/client-gateway/service/inbound.ts` and its test;
    - `client-gateway.md`.
- **Not run.** No Core `pnpm build`, root `pnpm test` or Lab command, per the
  brief. Nothing committed.

## Not verified

- **A Lab run.** It needs a Core build. An `auth-gate --flow` run with a kept
  workspace must show:
  - the password node still reports `web.dom.type:succeeded`;
  - the leak check reads 0 for traces, session records and command-attempt
    files;
  - every message or failure text reads `[withheld]` with no fragment of the
    declared value.

  The Week 1 bench is provider-free, so no Lab row exercises a live-patch rerun
  or a Call Flow.
- **A live-patch rerun with a real LLM provider**, and the `diagnose_and_adapt`
  proposal-only path. Both service rows use a mock provider and a
  `temporary_wait_retry` patch.
- **A Call Flow error binding.** `executedChild.message` feeds a bound error
  output, but no test exercises it. The M3 row covers the parent withholding a
  child's value in an output, not in a bound message.
- **The rest of Core's suites.** Root `pnpm test` did not run. The seventeen
  files, `pnpm check` and the two docs gates did.
- **`retryRuntimeSessionAfterAutoAppliedPatch`.** It still reruns with
  `graphOptions`, which hold the real inputs. It was exercised only incidentally,
  by the auto-applied rows.
- **Every result is a single observation.** Each test, mutation and gate ran
  once, apart from the one rerun after my test fix. No failure looked
  environmental.

## Open questions or contradictions found

1. **Built beyond the brief's letter: a parent withholds what its Call Flow child
   withheld.**
   - **Why.** Once the parent reads its child's executed values, a value the child
     resolved and handed back, or quoted in a failure message the parent binds,
     would sit in clear in the parent's saved trace. The committed code handed
     the parent `[withheld]` instead. So Task 2 alone would have opened a new
     leak path.
   - **Built.** A module-private registry in `graph-run.ts` and
     `AutomationStudioTraceWithholding.include`, both owned files, proved by M3.
     No contract or barrel changed.
   - **What is still in clear.** A child's run inputs are withheld by position,
     not by value, so they are not carried to the parent. A pass-through of a
     child input, such as `first === 5` in the composite row, stays in clear in
     the parent's saved trace. That belongs to open question 3's class.
2. **The text rule is spans, not a sequence of longest-first replacements.** The
   brief decided "longest text first". I built the rule that gives that result
   more strongly, because the sequential form has two defects:
   - **Overlap.** Two withheld texts that only overlap still leave a fragment.
   - **Rewriting markers.** Each pass rewrites the markers earlier passes wrote.
     A one-character resolved value such as `e` turns `[withheld]` into
     `[withh[withheld]ld]`, and several short values multiply a string's length
     pass after pass. This is also true of the rule `runtime/service.ts` had.

   One visible difference: overlapping occurrences of one text, such as `aa` in
   `aaa`, now become one marker, where `split`/`join` gave the marker followed by
   `a`. If the supervisor wants the literal sequential rule, M6-M8 show what each
   part guards.
3. **The known gap stands, as decided.** An input no binding reads, copied by a
   node into an output under another key, stays in clear at that copy. It is now
   stated in `graph-run.ts`, both architecture pages and the migration note.
4. **New public API in unreleased 0.4.0**, all additive:
   - the `fluxiqRuntimeTextWithholding` export;
   - `runAutomationStudioGraph`'s third parameter;
   - `runCanonicalAutomationStudioFlow`'s fifth parameter;
   - `AutomationStudioTraceWithholding.include`, which is not exported from the
     executor barrel.
5. **Ownership, reported rather than widened.**
   - The live-patch fix needed the service's two run call sites, not only the
     lines that pick the failed attempt. I treated them as part of "the live-patch
     rerun inputs" and kept the file at its baseline.
   - The service-level rows needed `service-flow-representation.test.ts`, the
     service test with headroom. It is now past the 400-line advisory threshold,
     which is a warning, not a failure. A split of `runtime/tests` would give
     these rows, and the run-input rows beside them, their own file.
6. **`docs/architecture/runtime-kernel.md` is not mine.** A search finds no
   "longest" in it. Its "Persistence" text about withheld texts is still
   accurate, but it does not name the shared helper.
7. **The regenerated references include other workers' uncommitted changes.** If
   the work is committed in separate units, rerun `pnpm docs:reference` at each
   commit.
