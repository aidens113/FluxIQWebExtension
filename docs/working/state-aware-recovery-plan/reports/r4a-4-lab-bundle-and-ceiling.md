# R4a attempt 4 (run-mv4912r9-53b05a51): bundle, steps and cost ceiling

Investigation only. No source edited. No Lab or browser run.

## Outcome

Done. I found all three causes. Two of them come from one event: the sealed bundle's
directory rename failed on Windows. Defect 3 is not an enforcement failure. Core enforced
its ceilings as designed, but that design gives a Flow's creation and its repair separate
$0.10 allowances. Whether that matches the user's rule is an open question for the
supervisor.

## Defect 1: a finalized bundle never published, and the run was recorded as "killed"

**Cause.** `bundle.finalize` wrote `bundle.complete.json` and then failed to rename the
staging directory to its final name.

- The rename runs in `renameEvidenceBundleWithRetry`
  (`packages/test-evidence/src/bundle.ts:62-79`, called at `:280-285`). It retries only on
  EBUSY, EPERM and EACCES, with waits of 10, 25 and 50 ms (`bundle.ts:14-15`). That is
  about 85 ms in total, and then it throws the raw Node error.
- On Windows, renaming a directory fails with `EPERM` while any process holds a handle on
  any file inside it. A probe in my scratchpad confirmed this on this machine:
  "rename with open read handle: EPERM rename", then "rename after close: ok".
- The raw `EPERM` is not a `RunnerFailure`, so it reaches `runScenario`'s wrapper
  (`packages/test-runner/src/run-scenario.ts:102-108`).
- `classifyRunnerFailure` (`packages/test-runner/src/failure.ts:64-67`, `:89-93`) maps
  EPERM or EACCES to `path.denied`, which becomes `environment.missing`.
- `ProjectedFacilityError` (`projected-facility-error.ts:26-27`) keeps only the generic
  sentence for anything that is not a `RunnerFailure`. `cli.ts:149` prints it.
- The `facilityFailure` it builds (stage `bundle.publish`, reason `path.denied`, causeCode
  EPERM) is never persisted, because the bundle it belongs in was the one that failed to
  publish.

**Evidence that the rename was the throw.**
- Staging holds `bundle.complete.json`, `artifact-index.json`, `report.html`, `run.json`
  (`status: failed`, `finishedAt` 20:07:19.818) and `evaluation.json` (`verdict: failed`,
  `failureCategory: runtime.behavior`, `facilityFailure: null`).
- The final directory `run-mv4912r9-53b05a51` does not exist.
- The staging directory's modification time is 20:07:20.155 (the marker write). The
  lab-runs `entry.json` `finishedAt` is 20:07:20.281, written by the `finally` close at
  `run-scenario.ts:752` without a `bundlePath`.
- Nothing else in `finalize` after the marker can throw except the rename.
- The category rules out the other throws:
  - "Evidence bundle already exists" is a plain Error, which would print category `unknown`.
  - EBUSY is not in `RUNNER_CAUSE_CODES` (`failure.ts:61`), so it would also print `unknown`.
  - Only EPERM, EACCES or ENOENT print `environment.missing`, and ENOENT is impossible
    because the source directory exists.
- None of the bundle code involved changed after run-mv2pgqkj (2026-10-10), which
  published normally from the same directory. Run `git log` covered `test-evidence/src`,
  `run-scenario.ts`, `redaction-attestation` and `lab-runs`: the last change was 2026-10-09.
  So the lock was intermittent, not a regression.

**Who held the handle: not identified.**
- The Lab's own writers close their handles first:
  - the event journal is closed inside `finalize`;
  - process logs are copied in, not held open (`run-scenario.ts:784`);
  - the redaction scan closes its files (`secret-leak-attestation.ts:302-334`);
  - the UI review and lab-runs files live outside staging.
- That leaves an outside reader holding a handle at the moment of the rename. Candidates:
  - antivirus or the search indexer scanning the files written milliseconds before
    (report.html, the contact sheet, jpgs, index, marker);
  - an Explorer window on the folder;
  - a supervising agent tailing `events.ndjson` in staging.
- I could not read the Defender settings (the permission classifier denied
  `Get-MpPreference`).

**Why "killed".** `readRunOutcomes` (`scripts/lab/live-guards/run-outcomes.mjs:69-76`)
treats every `.staging-run-*` as a run that died before finalizing. `killedOutcome`
(`:101-115`) gives it `verdict: "killed"`, `killed: true` and null per-build fields, and
does not check for `bundle.complete.json`. The `unchanged` rule then skips it
(`rules/unchanged.mjs:16`, `entry.killed !== true`), so a real product failure
(`flow_lane.product_behavior`, `web.target.not_found`) does not count against the
unchanged source.

**Proposed general fix.** Tests go beside each file.

1. **`packages/test-evidence/src/bundle.ts`.** Give the publication rename a budget sized
   for Windows scanners: bounded exponential back-off to about 10-20 s in total for
   EPERM, EACCES and EBUSY, as graceful-fs does for rename on Windows. Once the budget is
   spent, throw a typed error that names the operation (`rename`), the code, the number of
   attempts and the staging path. Never throw the raw errno.
   - Test: extend the existing `renameDirectory` hook test in
     `packages/test-evidence/tests/evidence.test.mjs` (around line 293). Cover N EPERM
     failures followed by success, and a budget spent with a typed error. Use the `wait`
     hook so no real time passes.
2. **`packages/test-runner/src/run-scenario.ts` (publish step) and
   `facility-failure/projected-facility-error.ts`.** Wrap the finalize failure in a
   `RunnerFailure("environment.missing", "Evidence bundle could not be published: rename
   EPERM after N attempts; the sealed bundle stays at .staging-<runId>")`. The command
   line then prints the cause and the stage instead of the bare sentence.
   - Test: `facility-failure/tests/projected-facility-error.test.ts`.
3. **`scripts/lab/live-guards/run-outcomes.mjs`.** When a staging directory holds a
   `bundle.complete.json` whose hash matches `artifact-index.json`, read it as a finalized
   run that did not publish:
   - use the verdict from `run.json`, plus cost and per-build figures from
     `snapshots/live-llm.json` and the facility failure from `evaluation.json`;
   - add `unpublished: true` instead of `killed: true`.
   With that, the `unchanged` and `debug` rules treat it as the product failure it was.
   - Test: `scripts/lab/live-guards/tests/killed-run.test.mjs`, a sealed-but-unrenamed
     staging case next to the true-kill case.
4. **Optional, also in `run-scenario.ts`.** When finalize throws, retry the publication
   once more after the cleanup, or let the guard's step 3 handle it. In both cases call
   `labRun.close` with the staging path as the cost source (see defect 2).

## Defect 2: no `steps/` anywhere under the run directory

**Cause.** The steps were written, just not under the run directory. They are in the
machine-wide `lab-runs` folder.

- `LabRunRecord.open` (`packages/test-runner/src/lab-runs/lab-run-record.ts:56-75`)
  creates `~/FluxStuff/lab-runs/<local date>/<runId>/steps/`.
- Core is told that folder (`run-scenario.ts:158-159`, `:244` `stepLogDirectory`) and
  writes every model and tool step into it.
- `writePlaybackSteps` adds the playback into the same folder (`run-scenario.ts:663-666`).
- The bundle gets a `steps` junction to that folder only in `LabRunRecord.close` with a
  `bundlePath` (`lab-run-record.ts:100-112`). That call is at `run-scenario.ts:749`, after
  `finalize`, so the rename failure in defect 1 skipped it.
- The `finally` close at `:752` has no `bundlePath`. It recorded the verdict but no
  junction and no cost (`entry.json` shows `costUsd: null`).
- The launcher line at `run-scenario.ts:665` says "in steps/" without a path, which reads
  as the bundle's `steps/`.

**Evidence.**
- `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-11/run-mv4912r9-53b05a51/steps/` holds 184
  step folders plus `index.md`.
- All 75 provider calls have folders. 1 chat, 53 explore decides, 2 judges, 1 diagnose,
  1 repair and 17 repair-phase decides add up to 75, which matches the
  `evaluation.json` `llm.calls` of 75.
  - Decide folders hold `request.json` and `.txt`, `response.json` and `.txt`,
    `decision.json` and `meta.json`.
  - Tool folders hold `call.json`, `result.json`, `page.txt` and `screenshot.jpg`.
- The 10 playback steps are `0052-run-web.browser.navigate` through
  `0061-run-web.dom.check`.
- The brief's statement that the build and repair calls have no per-step files is
  therefore not correct. They exist, but they are not linked from the bundle.

**Proposed general fix.**
1. **`run-scenario.ts:665`.** Print the absolute folder:
   `[lab] the Flow's playback is in <labRun.stepsDirectory> as N step(s)`.
2. **`lab-run-record.ts`.** Let `close` take the sealed staging path when publication
   failed: read the cost and copy the key files from it, and write `entry.json` with
   `bundlePath` set to where the bundle actually is. Call it from the publish catch in
   `run-scenario.ts`.
   - Test: `lab-runs/tests/lab-run-record.test.ts` (or the existing test beside it), with
     a close given a staging path.
3. **`scripts/lab/run-lab.mjs`.** Have the launcher's final line always name the lab-runs
   run folder, so steps can be found when no bundle exists.

## Defect 3: $0.1203 spent against a $0.10 ceiling

**The figures** (staging `snapshots/live-llm.json`, `runSpend` and `perBuild`, and the
step-log sum):

| Part | Spend | Calls | Ceiling | Result |
| --- | --- | --- | --- | --- |
| Creation build, judge included (Core's creation purse) | $0.04248 | 1 chat + 53 decides + 2 judge | $0.10 | Never near it; the build was proposed and judged yes |
| In-run repair: runtime diagnosis + patch (ladder) | $0.00424 | 2 | Its own authorization, `maxTotalEstimatedCostUsd` 0.1 | — |
| Step-failure re-author (`reauthor`, rounds 0 and 1) | $0.07345 | 46 decides | Handed $0.10 − $0.00424 = $0.0958 | Ended `budget_exhausted`, bound `calls` (46 of 48: `flow_bootstrap.run_budget_calls_exhausted`) |
| **Run total** | **$0.12033** | **75** | — | — |

The bundle's own `perBuild` reads `ceilingUsd: 0.1`, `maxBuildCostUsd: 0.0734` and
`overCeiling: 0`. The ledger shows `buildCeilingUsd: null` only because the guard took the
killed path (defect 1).

**Was it enforced?** Yes, per part, as designed. No purse was crossed.

- **Creation purse.** `runtime/service.ts:1551` opens `AutomationStudioLlmBuildPurse`
  through `service/flow-bootstrap-commands/creation-purse.ts:47-61`. It holds one purse
  per Flow creation, carried across builds, with a ceiling of
  `bootstrapLoopLimits.loop.budget.maxCostUsd ?? automationStudioLlmRunCostCeilingUsd()`.
- **The repair is outside it by design.** `creation-purse.ts:9-10` says: "A refuted-result
  repair keeps its own ceiling, never reads or writes that record, and carries nothing."
  In code, `repair` sets `creation = undefined` and carried spend to 0 (`:59-61`).
- **The repair has its own purse.** `runtime/recovery/refuted-result/purse.ts:78-101` opens
  one per run. `step-failure-port.ts:49` charges it with the in-run ladder's spend, and
  `reauthor-build.ts:113` hands the re-author what is left.
- **Core's own statement of the rule** (`refuted-result/purse.ts:7-9`): "The user's rule is
  that a build, and its repair, each spend at most the run cost ceiling in total."
- **The result check is a third, separately capped cost** (`purse.ts:38-41`).
- So one Flow's creation plus one failed run's repair may spend up to about $0.20 under
  the current design, plus the result check.
- Separately, `--llm-max-calls 48` is applied per part (the creation's and the
  re-author's `maxCalls`), which is how the run made 75 calls.

**Estimated or billed?** Billed. Each call's `estimatedCostUsd` is computed by
`runtime/llm/deepseek/pricing.ts:107-139` from the provider's reported usage:

- cache-miss input at $0.30 per million tokens;
- cache-hit input at $0.006 per million;
- output at $1.20 per million;
- multiplied by 0.5 off-peak.

Check against step 0063: (15651 × 0.3 + 640 × 0.006 + 318 × 1.2) / 1e6 × 0.5 =
$0.00254037, exactly the logged `costUsd`. The holds before each call use the uncached
worst case (`build-purse/purse.ts:14-31`). What a call is charged once settled is the
billed figure. The ledger's `totalEstimatedCostUsd` (0.120331128) equals the step-log sum
to the nanodollar.

**Proposed general fix: only if the user's rule is $0.10 per Flow in total.** If so,
Core's split is the defect, not the Lab.

1. **Core:** make the repair purse carry the Flow's creation spend while the creation
   record is still open. A simpler rule would be one per-run purse that the creation,
   ladder and re-author all draw from. Files:
   - `runtime/service/flow-bootstrap-commands/creation-purse.ts` (stop zeroing carried
     spend for `repair`);
   - `runtime/recovery/refuted-result/purse.ts` (open with the run's build spend);
   - `runtime/service/runtime-adaptation/step-failure-port.ts` and
     `refuted-result-port.ts`.
   Tests in their `tests/` folders: a repair after a $0.06 build is handed $0.04 and is
   refused at the ceiling.
2. **Lab:** `scripts/lab/live-campaign/row` `perBuildSpend` (used by `run-outcomes.mjs`)
   currently judges "runtime" and "reauthor" as separate builds. Sum them as one repair,
   or report a run total against the ceiling. Test beside it in `live-campaign/row/tests/`.

If the user's rule is "each build and each repair at most $0.10", nothing needs fixing in
Core. In that case, record the rule as the user's own words in `AGENTS.md`.

## Commands run and observed results

- Read the staging bundle (`bundle.complete.json`, `evaluation.json`, `run.json`, the
  `events.ndjson` tail, file times, and `snapshots/live-llm.json` sections). Results are
  as quoted above.
- `ls ~/FluxStuff/lab-runs/2026-10-11/run-mv4912r9-53b05a51/steps` showed 184 folders and
  `index.md`. A node summary of every `meta.json` printed "calls 75 total 0.120331", with
  phases explore 53 ($0.0849), repair decide 17 ($0.0293), judge 2, diagnose 1, repair 1
  and chat 1.
- A `find` for other `.staging-run-*/bundle.complete.json` under `test-runs` and `fxwork`
  found only this run. `.staging-run-mv35459z` has no marker; it was the deliberate stop.
- A Node probe (scratchpad `r4a4-rename-probe.mjs`) printed "rename with open read handle:
  EPERM rename" and then "rename after close: ok".
- `git log --since=2026-10-09` on the bundle and run-scenario paths showed the last change
  was f643838e on 2026-10-09.
- `Get-MpPreference` was denied by the permission classifier.

## Not verified

- Which process held the handle in staging at about 20:07:20.16. The raw errno was not
  printed or persisted; EPERM or EACCES is inferred from the printed category.
- Whether DeepSeek's actual invoice matches the computed billed figures.
- The proposed fixes are not implemented or tested.

## Open questions or contradictions found

1. The brief says the build and repair calls have no step files. All 75 do, in
   `lab-runs/2026-10-11/run-mv4912r9-53b05a51/steps/`.
2. The user's ceiling rule: is it $0.10 per Flow across creation and repair, or per build
   and per repair? Core's comment (`refuted-result/purse.ts:7-9`) attributes the
   per-part reading to the user. The supervisor should confirm the user actually said it
   before choosing a fix.
3. Was anything (an agent's tail or Monitor, Explorer) reading the staging folder at
   20:07:20? If yes, the bundle fix is still needed, because any reader can do this, but
   the trigger is explained.
