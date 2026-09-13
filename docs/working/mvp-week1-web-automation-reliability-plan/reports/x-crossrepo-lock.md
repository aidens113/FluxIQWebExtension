# Report: x-crossrepo-lock

Worker `x-crossrepo-lock`. Three things: a cross-repository guard for FluxIQ
Core rebuilds, a bench report that names the cause of a failed run instead of
saying `unknown`, and `run-duration-p95` demoted from a gate that fired on
noise.

## Outcome

**Done.** All three changed, all three proved. Test-runner `check` and `test`
green (439/439), the Lab launcher's own tests green (15/15), structure audit
passes.

The guard was proved by driving it, not by a passing normal run: the launcher
was observed **blocking** on a busy Core, and observed **naming a Core rebuild
that landed mid-run**. The report fix was proved twice — by a unit test, and by
replaying the **real failed bench on disk** through the new code.

**And the race reproduced itself while I worked.** My first
`pnpm --filter test-runner test` failed seven test files with
`Cannot find module 'F:\!FluxIQWebExtension\packages\test-runner\node_modules\fluxiq\dist\programs\automation-studio\index.js'`.
Established by mtime, not assumed: that file existed again minutes later with
mtime `18:43`, and the newest file under Core's `packages/*/dist` was
`2026-09-13T01:43:12.021Z` — 24 seconds before I looked. Core was mid-rebuild.
I waited for quiet **using the new guard** and the same command then passed
439/439. So this is not a once-a-day hazard; it hit twice in one afternoon.

## 1. The cross-repository guard

### What was chosen, and what was rejected

A lock file in the Core checkout was rejected, and this is the load-bearing
judgement, so the reasoning is in the module header as well as here. It is the
only option that would *prevent* the race outright, and it is still the wrong
trade:

- A bench runs 30–120 minutes; a Core build takes 1–3. A Lab run holding a
  Core lock blocks a developer's build for the length of the bench.
- It only works if **Core's own build takes the lock**, which means changing a
  repository this one does not own, for a guard that repository gets nothing
  from.

Snapshotting or pinning what a run loads was rejected too. The run does not
load Core from `dist` alone: `prepareWebWorkspace` junctions
`F:\!FluxIQ\packages` into the isolated workspace and Next/Turbopack compiles
Core's **source**. Pinning therefore means copying the whole checkout per run,
and what it buys is a run that silently tests a stale Core — the same failure
the per-instance extension build reasoning already rejected.

**Chosen: check Core is quiescent before starting, and detect a mid-run change
afterwards.** It writes nothing into `F:\!FluxIQ` — the guard only reads it —
costs one directory walk (measured: 2144 files in 87 ms), and turns a silent
loss into either a short wait or a named cause.

It deliberately **does not refuse to run**. A developer editing Core would find
a Lab that refuses to start worse than the race. The requirement is that the
loss stop being silent, not that the run be forbidden. After a bounded wait it
proceeds and says loudly that it did.

### Files and behaviour

`scripts/lab/core-build-watch.mjs` (new, 180 lines):

- `coreRepositoryRoot(env, root)` — `FLUXIQ_CORE_ROOT`, else `../!FluxIQ`,
  resolved **exactly as `cli.ts:21` resolves it**, so the directory watched is
  the one the run will load. A test pins that.
- `scanCoreOutput(coreRoot)` — walks every `<core>/packages/<pkg>/dist`,
  returning file count, newest mtime and newest path. Sources and
  `node_modules` are not walked: Core's `@fluxiq/*` entries there link back
  into these same `dist` directories, and a developer editing a source file is
  a different hazard.
- `waitForQuietCoreOutput(...)` — polls until Core has been untouched for
  `quietMs`. Returns `quiet`, `absent` (no Core output found — fail open,
  never block), `disabled` (`quietMs` 0), or `timed-out`.
- `coreOutputChange(before, after)` — movement is **a newer mtime or a changed
  file count**. The count matters: a clean deletes before it emits, so a
  deletion moves no mtime at all and comparing timestamps alone would call it
  quiet.

`scripts/lab/run-lab.mjs` wires it in:

- Before the build phase (so the Core-dependent `tsc` build is covered too),
  and only for subcommands that actually load Core — `inspect`, `compare`,
  `auth`, `clone-cache` are skipped so a report read never waits.
- Defaults: 30 s of quiet required, 10 min cap on the wait, 2 s poll.
  `FLUXIQ_LAB_CORE_QUIET_MS` (0 disables the wait) and
  `FLUXIQ_LAB_CORE_WAIT_TIMEOUT_MS` override.
- After the runner exits, it rescans and, if Core moved, prints
  `changed-during-run` with both mtimes, both file counts, the offending path
  and the exit code. It prints this **whether the run passed or failed**: a run
  that overlapped a Core rebuild measured a moving target either way, and the
  wording differs by exit status.

### Proof that the guard engages

**It blocks on a busy Core.** A Core-shaped root whose newest file was written
"now", `quietMs` 45 s, killed by `timeout 8` while still waiting — exit 124,
and **no build child was ever spawned**:

```
{"lab":"core-build","state":"waiting","root":"...\fake-core","files":1,
 "newest":"2026-09-13T01:44:16.990Z","newestPath":"...\packages\contracts\dist\automation-studio.js",
 "quietMs":45000,"timeoutMs":300000,
 "why":"FluxIQ Core's build output was written moments ago; a rebuild underneath a run deletes modules the run imports"}
```

**It names a rebuild that lands mid-run.** Same launcher, Core quiet at start,
a file emitted into it 8 seconds in while the build ran:

```
{"lab":"core-build","state":"quiet","files":1,"newest":"2026-09-13T01:36:39.638Z","waitedMs":40}
{"status":"failed","category":"fixture.invalid","message":"Unknown bench corpus: does-not-exist. ..."}
{"lab":"core-build","state":"changed-during-run","newestBefore":"2026-09-13T01:36:39.638Z",
 "newestAfter":"2026-09-13T01:46:49.440Z","filesBefore":1,"filesAfter":2,"fileDelta":1,
 "newestPath":"...\packages\contracts\dist\emitted-mid-run.js","exitCode":1,
 "why":"FluxIQ Core was rebuilt while this run was in flight. A cross-repository build race is the first thing to rule out before treating this failure as a product defect."}
LAUNCHER_EXIT=1
```

`--corpus does-not-exist` was used so the CLI fails immediately after the build
and no browser is launched. Instance label `lab-crossrepo`; its build
directories were removed afterwards.

**It finds the real Core.** A read-only test scans the actual `F:\!FluxIQ` and
asserts it finds a real body of build output (2144 files) with a plausible
newest mtime. It skips, rather than passing vacuously, when Core is absent.

**It blocks and releases against a real filesystem.** A unit test drives an
emit burst with an injected clock: the wait is announced once (not per poll),
each poll re-scans, and it releases only once the clock is ≥ `quietMs` past the
newest write — so it tracks the build rather than sleeping a fixed time.

## 2. An infrastructure failure is now legible

### Why the bench said `unknown` with nothing in Problems

Traced to the mechanism, not guessed. `runScenario` **catches** the error that
kills a run, writes it to `events.ndjson` as an `error` event with the message
in `summary`, then finalizes the bundle and returns
`{ runId, verdict: "failed", path, failureCategory }` — `RunScenarioResult` has
no message field. Two independent gaps followed:

1. `classifyRunnerFailure` did not know `ERR_MODULE_NOT_FOUND`, so the category
   was `unknown`. Confirmed empirically: Node raises exactly that code for
   exactly that message shape.
2. `readRunBundle` already **parses that very line** — `closingSequences` read
   `event.sequence` off the `error` event and threw the `summary` away.

The on-disk evidence confirms both. `test-runs/instances/lab-smoke/bench/bench-mtz3zan8-d6ce4aae/runs.json`
has four records with `"failureCategory": "unknown"` and **no `problems` key at
all**, while `run-mtz3zand-d695bc89/events.ndjson` sequence 1 carries the full
message and `details.failureCategory: "unknown"`.

### The fix

- **`packages/test-runner/src/failure.ts`** — module-resolution codes now
  classify as `environment.missing`: `ERR_MODULE_NOT_FOUND`, `MODULE_NOT_FOUND`,
  `ERR_PACKAGE_PATH_NOT_EXPORTED`, `ERR_PACKAGE_IMPORT_NOT_DEFINED`,
  `ERR_UNSUPPORTED_DIR_IMPORT`. **No new taxonomy.** Per that file's own header
  the whole `FailureCategory` set answers "why the *facility* could not produce
  a trustworthy run", and a dependency that vanished is precisely
  `environment.missing`. The export-map codes are in the list because a
  `package.json` caught half-written mid-rebuild raises those instead.
  This also retroactively covers the *other* incident of the same day —
  `Cannot find package '@fluxiq-web-extension/test-contracts'` in
  `L-lab-concurrency`, likewise recorded as `unknown`.
- **`bench/read-run-bundle.ts`** — returns `recordedFailure: { message,
  category }` from the last `error` event. Kept **separate from `problems`**,
  which still means "a bundle file the bench could not read or verify".
- **`bench/report-store.ts`** — `BenchRunRecord.failureCause?: string`.
- **`bench/failure-cause.ts`** (new) — `benchFailureCauses` groups a bench's
  failed runs by (category, message), most runs first.
- **`bench/run-bench.ts`** — sets `failureCause` on every failed run, from the
  runner's thrown error or from the bundle's recorded event, and adds
  `failureCauses` to `RunBenchOutcome`, which `cli.ts` prints verbatim. So the
  **terminal line itself** now names the cause.
- **`bench/render-markdown.ts`** — a `## Why the failed runs failed` table
  directly under the run counts, and the Runs table's `Problems` column becomes
  `Cause and problems` (the cause is not repeated when a problem already
  carries it).

A useful property, not designed but worth recording: the message comes from
`events.ndjson`, and `test-evidence`'s `bundle.ts` runs `redactStructured` plus
`assertNoSensitiveText` over every event before writing it. So the cause
surfaces only text the evidence bundle already judged safe to persist.

### Proof against the real incident

The four real bundles from the bench that died, replayed through the new
`readRunBundle` / `benchFailureCauses` / `renderBenchMarkdown`:

```
run-mtz3zand-d695bc89 -> {"message":"Cannot find module 'F:\!FluxIQ\packages\fluxiq\node_modules\@fluxiq\contracts\dist\automation-studio.js' imported from ...","category":"unknown"}
  (and the same for run-mtz3zc4m, run-mtz3zbpj, run-mtz3zcot)
```

and the top of the report a person would now read:

```
4 runs evaluated: 0 passed, 4 did not. ...

## Why the failed runs failed

**Every one of the 4 evaluated runs failed for the same reason**, so this bench
measures that reason and nothing else. No number below says anything about FluxIQ.

| Runs | Failure category | Cause |
| --- | --- | --- |
| 4 | environment.missing | Cannot find module 'F:\!FluxIQ\packages\fluxiq\node_modules\@fluxiq\contracts\dist\automation-studio.js' imported from ... |
```

**One honest seam in that replay.** The `category` read back off those bundles
is still `"unknown"`, because they were written by the old classifier; I
substituted `environment.missing` to show the end state. The message extraction
is proved on real data; the category upgrade is proved by the unit test on
`classifyRunnerFailure`. Only a future run exercises both at once.

## 3. `run-duration-p95` no longer gates on noise

### The numbers, recomputed rather than quoted

Read directly from the eight `test-runs/bench/*/report.json`:

| | values | range | ordered pairs breaching ±25% |
| --- | --- | --- | --- |
| `run-duration-p95` | 44364 56431 57213 61395 62678 67894 73898 91457 | **2.06x** | **24 / 56 (43%)** |
| `action-latency-p95:web.browser.navigate` | 1654–1798 | 1.09x | **0 / 56** |
| `action-latency-p95:web.dom.type` | 1397–1626 | 1.16x | **0 / 56** |

Every one has **4 samples**. Driving all 56 ordered pairs through
`summarizeBenchComparison`: under the old rule **14 of 56 (25%)** came out
`regressed` — one in four comparisons between the tool's own history failed its
own gate. Under the new rule: **0**.

### What changed, and the threshold's justification

`run-duration-p95` is **advisory below 20 samples** and gates at 20 and above.
The threshold is not invented: `benchDistribution` uses nearest-rank p95, index
`ceil(0.95n) - 1`, and `ceil(0.95n) < n` first holds at **n = 20**. Below that,
"p95" *is the maximum observation* — one worst run.

The per-action latencies keep gating on the same tolerance and the same eight
reports, because there they discriminate perfectly. The difference is what each
number contains: a run's duration is browser launch, Turbopack compile, Core
boot, the scenario and teardown on a machine shared with other Lab instances;
an action's latency is dispatch to settle. Only the second is about the product.

This narrows the **verdict**, never the measurement. The metric is still
compared, still carries its own `outcome`, still appears in `metrics`, and the
new `advisory: string[]` field names what was set aside — so nothing is hidden
and the eight baselines stay comparable.

Implemented in `bench/compare-reports.ts` (`summarizeBenchComparison`), which
this task owns. `compareBenchReports` in `test-contracts` — the per-metric
tolerance itself — was **not** touched.

### Proof on the pair that actually fired

The bench's only `regressed` verdict, run through the real CLI:

```
node packages/test-runner/dist/cli.js compare \
  test-runs/bench/bench-mtxju6eb-7aacdf7a/report.json \
  test-runs/instances/lab-smoke/bench/bench-mtz3dnux-d8f9e7f1/report.json
COMPARE_EXIT=0        (was 1)
outcome  : equivalent
advisory : ["run-duration-p95"]
   equivalent  rate:initialExecutionSuccess          {"baseline":1,"candidate":0.5,"tolerance":0.5}
   equivalent  rate:deterministicReplaySuccess       {"baseline":1,"candidate":0.5,"tolerance":0.5}
   equivalent  rate:falseFailure                     {"baseline":0,"candidate":0,"tolerance":1}
   equivalent  rate:harnessActivation                {"baseline":0,"candidate":0,"tolerance":0.5}
   equivalent  action-latency-p95:web.browser.navigate {"baseline":1674,"candidate":1865,"tolerance":418.5}
   equivalent  action-latency-p95:web.dom.type      {"baseline":1397,"candidate":1660,"tolerance":349.25}
   regressed   run-duration-p95                      {"baseline":44364,"candidate":69871,"tolerance":11091}
```

`run-duration-p95` was the **only** metric marked regressed, it is still
reported as regressed, and the tool now exits 0.

## Commands run and observed results

Every exit status captured by redirect to a file, never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `node --test "scripts/lab/tests/*.test.mjs"` | **0** | `# tests 15 # pass 15 # fail 0 # skipped 0` |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | **0** | `tsc --noEmit` clean |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | **0** | `# tests 439 # pass 439 # fail 0 # skipped 0` |
| `node scripts/structure-audit.mjs` | **0** | `structure-audit: passed (33 warning(s), 17 baselined)` |
| launcher, busy fake Core, `timeout 8` | 124 | `state:"waiting"`, no build child spawned |
| launcher, quiet fake Core, mutated at 8 s | 1 | `state:"quiet"` then `state:"changed-during-run"` |
| `cli.js compare` on the real regressed pair | **0** | `equivalent`, `advisory:["run-duration-p95"]` |

Earlier, before Core went quiet: `pnpm --filter test-runner test` **exit 1**,
7 files failing with `ERR_MODULE_NOT_FOUND` on Core's
`fluxiq/dist/programs/automation-studio/index.js`. Diagnosed by mtime, waited
out with the new guard, then 439/439. Recorded because it is the defect, live.

The structure audit's warning count went 32 → 33; the diff of the warning lists
shows the new one is `domain/src/actions/types.ts` (another worker's file).
**None of my files produce a warning.** The audit also reports "3 baseline
entries can be lowered" — I did **not** run `pnpm structure:baseline`, because
`.structure-baseline.json` is shared and several workers are mid-flight.

New files were `git add -N`'d so the audit, which reads `git ls-files`,
actually audits them. Nothing was committed.

## Files changed

Owned, all within the brief:

- `scripts/lab/core-build-watch.mjs` (new, 180), `scripts/lab/run-lab.mjs`,
  `scripts/lab/tests/core-build-watch.test.mjs` (new, 165)
- `packages/test-runner/src/bench/`: `failure-cause.ts` (new, 40),
  `read-run-bundle.ts`, `run-bench.ts`, `report-store.ts`,
  `render-markdown.ts`, `compare-reports.ts`, `index.ts`,
  `tests/run-bench.test.ts`, `tests/compare-reports.test.ts`
- `packages/test-runner/src/failure.ts`, `packages/test-runner/src/tests/failure.test.ts`

Not touched: `flow-lane/`, `run-scenario.ts`, `apps/`, `domain/`, and
**nothing inside `F:\!FluxIQ` was written** — the guard only reads it.

`packages/test-runner/src/bench/evaluate-run.ts` shows as modified in
`git status`; that is **another worker's** uncommitted refactor moving
`RunEvaluationIdentity` and `RunOutcome` into `run-evaluation/`. Confirmed by
reading the diff. Likewise the staged one-line comment change in `failure.ts`
(`demo-llm-create-ui.ts` → `demo-llm-create-ui/`) predates me; my change sits on
top of it, unstaged. `apps/extension/build/content/index.js` is modified with
mtime **17:35:48**, before my first command — not mine either.

## Not verified

- **A real FluxIQ Core rebuild triggering the wait.** Forcing it means writing
  into `F:\!FluxIQ`, which the brief forbids. The wait was proved against a
  real filesystem with a Core-shaped root, and a read-only test proves the
  probe finds the real Core's 2144 files. The *live* combination — real Core,
  real rebuild, real wait — is reasoned, not observed.
- **No Lab run was completed.** No `pnpm lab run`, `bench`, or `matrix` reached
  a browser. The launcher was exercised through the guard and the build phase
  only, deliberately, because other instances were live. So the guard's effect
  on a real bench, and the new `report.md` produced by a real bench, are
  **not** observed end to end — the report fix was proved on the real bundles
  of the bench that died, replayed through the new code, plus unit tests.
- **The classifier and the reporting have not been observed working together.**
  `classifyRunnerFailure` runs inside `run-scenario.ts`, which I must not touch
  and cannot drive without a browser. Each half is tested; the join is not.
- **`pnpm check`, `pnpm test`, `pnpm build` at the workspace root** were not
  run. Several workers are mid-edit and the result would not have been about
  this change. Test-runner `check` and `test`, `lab:test`, and the structure
  audit were.
- **The 20-sample gating threshold has never been exercised on real data.**
  Every bench on disk has 4 samples. The threshold follows from the estimator
  (`ceil(0.95n) < n` first at n = 20) and is unit-tested; no 20-repeat bench
  exists to confirm it discriminates there.
- **Whether `quietMs` 30 s is long enough.** The observed emit burst spanned
  10 s, so 30 s clears it. A Core build spends minutes in `tsc` before emitting
  and writes nothing to `dist` during that phase, so a run started then can
  still be caught — which is exactly why the post-run detection exists rather
  than the wait alone.

## Open questions and things for the supervisor

1. **Documentation is owed and I did not write it.**
   `docs/architecture/repository-layout.md` gained a "Running Several Labs At
   Once" section today and should now also describe the Core quiescence guard,
   its two environment knobs, and the `changed-during-run` line. That file is
   outside my ownership and another worker edited it today, so I left it alone
   rather than risk a conflict. **This is a real documentation debt, not a
   nicety.**
2. **The guard only covers `pnpm lab`.** My own `pnpm --filter test-runner test`
   was killed by this race and the guard did not protect it, because it does
   not go through the launcher. Anything that imports Core — the demo scripts,
   a direct `node packages/test-runner/dist/cli.js`, `pnpm -r test` — is still
   exposed. Worth deciding whether the guard belongs in a shared place the
   package scripts can call.
3. **`lab compare`'s exit code changed.** Comparisons that used to exit 1 on
   run duration alone now exit 0. Anything scripted against that exit status
   should be re-read. `advisory` in the JSON says when it applied.
4. **The eight baselines were measured under the old `initialExecutionSuccess`
   definition** — `L-smoke`'s open question, still open, and unaffected by this
   work.
5. **`.structure-baseline.json` can be tightened** ("3 baseline entries can be
   lowered"); a worker must not run `pnpm structure:baseline` on a shared file
   while others are mid-flight.

Nothing was committed. No pairing token, bearer token, recorded page content,
`.fluxiq` material, or browser profile appears in this report or in any file I
wrote.
