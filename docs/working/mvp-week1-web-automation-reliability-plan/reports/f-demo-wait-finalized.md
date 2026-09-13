# f-demo-wait-finalized — the demo waits for its recording to finalize

Worker `f-demo-wait-finalized`, 2026-09-13. Brief: "f-demo-wait-finalized" in `briefs/finish-week1.md`.
Source finding: `reports/i-demo-recording-finalize.md`, section 4.

## Outcome

**Done.** The demo's `waitForNewRecording` no longer hands on a recording Core is still writing.
It finds the one new recording through Core's cheap summary list, then waits for Core's own
`endedAt` through the Flow lane's `awaitFinalizedRecording`, all inside one named, injectable bound
(`DEMO_RECORDING_FINALIZE_TIMEOUT_MS`, default 90 s). At that bound it fails `recording.persistence`
with a message naming the recording id, the bound and the last observed entry count, and no page data.
Seven unit rows pass. The mutation back to "any new recording" fails rows 1, 2, 3 and 7, and the file was
restored byte-identical. No Lab or demo command was run; the live proof is listed under Not verified.

Re-verified at HEAD first: `control-waits.ts` was unmodified in `git status`, and still had the 10 s
deadline and the `status === "completed"` shortcut the finding describes (old `:28-42`).

## What changed and why

**`packages/test-runner/src/demo-workspace/control-waits.ts`** (+65 −15, now 131 lines):
- **The bound** (`:16`): `DEMO_RECORDING_FINALIZE_TIMEOUT_MS = 90_000`, with a 200 ms poll interval (`:17`),
  the same as the Flow lane's default. Callers inject both through an optional fourth parameter, `wait`, of
  type `FinalizedRecordingWait` (`timeoutMs`, `intervalMs`, `now`, `sleep`). Production passes nothing, so
  `workspace-lanes.ts:61` and `diagnosis-lanes.ts:77` are unchanged and still compile.
- **Why 90 s.** Taken from `i-demo-recording-finalize`, and a proposal, not a measurement:
  - Under load Core stored the demo's entries one append at a time, mostly 450-1000 ms apart. In attempt a1,
    26 chunks took about 21 s.
  - a1 was still storing entries made before Stop about 20 s after Stop. It never finished, because Core
    was stopped.
  - At about 0.8 s per entry, 90 s covers roughly 100 entries, more than three times a1's 29 or more.
  - The Flow lane's 30 s default is not shown to be enough for that.
  - A long bound costs time only on failure: a finalized recording returns as soon as Core stamps `endedAt`.
  - Neither caller wraps the wait in an outer timeout that would cut it short. I grepped
    `workspace-lanes.ts`, `diagnosis-lanes.ts`, `browser-session.ts` and `core-process.ts` for timeouts
    and found none around the call.
- **One bound for the whole wait** (`:45-74`). It runs from the call, which is right after the extension
  reports idle. It covers finding the recording and waiting for it to finalize. `awaitFinalizedRecording`
  gets the remaining time, but never less than one interval (`:64`). That way a recording first listed at
  the deadline still gets the confirming read Core's rule needs, and is not failed as "kept growing". The
  bound can therefore run over by about one interval plus a read.
- **Detection asks with `summaries: true`** (`newRecordingIds`, `:77-80`), through
  `automationStudioCall("list-recordings", …)`. The unsummarized `listRecordings` hydrated every entry on
  each poll. `i-demo-recording-finalize` measured 13-15 of those polls at 0.36-1.46 s each while Core was
  already slow.
- **"Exactly one new recording" is kept** and checked twice:
  - when the recording is first found, where two new recordings fail at once;
  - once more after it finalizes (`:69-72`), failing if Core then lists anything other than exactly that one.
    The old loop re-checked on every poll during its 10 s; the second check keeps that guarantee over the
    longer wait.
- **The failure** (`unfinalizedRecordingFailure`, `:83-93`) wraps `awaitFinalizedRecording`'s
  `recording.persistence` failure. Any other error passes through unchanged. An example message:
  `FluxIQ persisted demo recording <id> but did not finalize it within 90000 ms (DEMO_RECORDING_FINALIZE_TIMEOUT_MS): Core was still writing it; last observed entry count <n>`.
  - The middle clause is one of "Core stopped listing it", "Core was still writing it", or "its timeline
    kept growing after endedAt".
  - The details keep the inner wait's ids, counts and times: `recordingSeen`, `endedAt`, `entryCount`,
    `entriesAppendedWhileWaiting` and `polls`. To those it adds `bound`, plus `timeoutMs` and `waitedMs`
    for the whole wait. The original failure is kept as `cause`.
  - "No new recording" also names the bound: `FluxIQ did not persist a new demo recording within <ms> ms (DEMO_RECORDING_FINALIZE_TIMEOUT_MS)`.
- **The `status` shortcut is gone.** `RecordingListItem` and `recordingItems` (`:117-126`) now carry only
  `recordingId`. This route never returns `status`, and whether a recording is finished is now
  `awaitFinalizedRecording`'s question. A grep of `packages/test-runner/src` found no other reader of
  either field.

**`packages/test-runner/src/demo-workspace/tests/control-waits.test.ts`** (new, 107 lines, 7 rows). It uses an
injected virtual clock and a fake Core, like `flow-lane/tests/finalized-recording.test.ts`. On every call the
fake asserts the endpoint is `list-recordings` and the payload is exactly `{ projectId, summaries: true }`.
1. A new recording that Core finalizes after several polls resolves, only once `endedAt` is stamped. The row
   asserts the return came at 1500 ms or later, after at least five earlier reads. A recording already in
   the baseline is listed too, and is ignored.
2. One that never finalizes fails at the injected 1000 ms bound. The row checks:
   - the category is `recording.persistence`;
   - the message names `recording.new`, `within 1000 ms (DEMO_RECORDING_FINALIZE_TIMEOUT_MS)`,
     `Core was still writing it` and `last observed entry count 3`;
   - `details.entryCount` is 3, `bound` is set and `timeoutMs` is 1000;
   - the wait did not give up before 1000 ms;
   - a `title` field planted in the listing appears in neither the message nor the details.
3. The bound runs from the start of the wait, not from when the recording is first listed.
4. A recording first listed at the deadline still gets its confirming read and resolves.
5. No new recording fails as unpersisted, naming the bound.
6. Two new recordings fail at the first listing that shows both, at 200 ms, without waiting for either to finalize.
7. A second new recording listed while the first finalizes fails once the first is finished.

## Commands run and observed results

All from `F:\!FluxIQWebExtension` unless noted. Exit codes came from redirecting output to a scratch file and
reading `$LASTEXITCODE`, not from a pipe. No extension or domain tests ran, so no build label was needed.

1. `node scripts/structure-audit.mjs`, before any edit → `exit=0`, `structure-audit: passed (41 warning(s), 17 baselined).`
2. `pnpm --filter @fluxiq-web-extension/test-runner check` → `exit=0`, no `error TS` lines. Rerun on the final
   files at the end → `exit=0`, no `error TS` lines.
3. From `packages/test-runner`: `pnpm exec tsc -p tsconfig.json --outDir dist-f-demo-wait` → `exit=0`.
4. `node --test dist-f-demo-wait/demo-workspace/tests/control-waits.test.js` → first run `pass 6`, `fail 1`: row 6
   `not ok 6 … error: 'Missing expected rejection.'`.
   - **The defect was in my fixture, not the code.** `recording.one` was finalized at 0 ms, so the wait
     correctly accepted it at 100 ms, before `recording.two` was listed at 200 ms.
   - I changed the fixture to list both at 200 ms and added the 200 ms assertion.
   - Rebuilt (`exit=0`) and reran → `tests 7`, `pass 7`, `fail 0`.
5. Full suite over the private build: `node --test "dist-f-demo-wait/**/*.test.js"` → `exit=1`, `tests 554`,
   `pass 545`, `fail 9`. **All nine have one cause, outside this change:**
   `SyntaxError: The requested module '@fluxiq-web-extension/test-contracts' does not provide an export named 'flowLaneExclusion'`.
   - It is raised while loading `dist-f-demo-wait/bench/expand-corpus.js:1` or `dist-f-demo-wait/run-scenario.js:5`.
   - The failing test files are:
     - `bench/tests/run-bench`
     - `bench/tests/week1-corpus`
     - `run-evaluation/tests/bench-parity`
     - `run-evaluation/tests/runner-wiring`
     - `run-evaluation/tests/single-run-evaluation`
     - `tests/cli-llm`
     - `tests/scenario-assertions`
   - Two further subtests spawn `dist-f-demo-wait/cli.js` and fail the same way:
     - `auth-cli` "CLI auth status and clear need only existing origin and username";
     - `clone-cache` "clone-cache refresh reports invalidate-now and refresh-on-next-run semantics".
   - `flowLaneExclusion` is another worker's in-progress export: `git status` shows
     `packages/test-contracts/src/flow-lane-exclusion.ts` untracked, and `run-scenario.ts` and
     `bench/expand-corpus.ts` modified. The shared `test-contracts` dist does not have it yet, and this
     dispatch may not rebuild shared dist directories.
   - A grep of the failing test sources for `control-waits`, `demo-workspace` or `waitForNewRecording` found nothing.
   - Not rerun alone: this is a deterministic, explained module-link error, not the uniform or impossible
     shape the faulty RAM produces.
6. **Mutation proof.**
   - SHA256 of `control-waits.ts` before: `2DB7EFE49177086DEB80F4CED8AA8A24675A7FBE1509B6DEC43E8D715F69A1E0`.
   - The mutation: insert `return recordingId;` immediately after detection, before `awaitFinalizedRecording`.
     That is the "any new recording" behaviour.
   - Rebuild → `build exit=2`. The mutation itself caused the type errors: TS2322 and TS2345 at `:65`, `:68`
     and `:74`, and TS18046 at `:67`. Code after the new `return` is unreachable, so narrowing is lost.
     `tsc` still emitted the mutated JS, since `noEmitOnError` is not set.
   - Test → `exit=1`, `pass 3`, `fail 4`:
     - row 1: `not ok 1 - a new recording Core finalizes after several polls resolves, and only once Core has stamped endedAt`, `error: 'returned at 0 ms, before Core finalized the recording at 1500 ms'`;
     - rows 2, 3 and 7: `error: 'Missing expected rejection.'`.
   - Restored with Edit. SHA256 after: the same hash, `identical=True`.
   - Rebuild → `exit=0`. Test → `tests 7`, `pass 7`, `fail 0`.
7. **Structure audit with the new test indexed.**
   - Method: copied `.git/index` into a scratch file set as `GIT_INDEX_FILE`, then ran `git add` on
     `demo-workspace/tests/control-waits.test.ts` and `core-process.test.ts`. Both are untracked; the second
     is awaiting commit. The real index was not touched.
   - First post-edit run → `exit=0`, `passed (41 warning(s), 17 baselined).`
   - Final run, after the fixture fix and the restore → `exit=0`, `passed (42 warning(s), 17 baselined).`
   - A comparison keyed on rule and path shows exactly one added warning:
     `file-lines apps/extension/e2e/content/tests/evidence.spec.ts` (520 lines). It appeared between two
     runs that both already held my change. `f-evidence-items-harness` owns that file.
   - No warning names `control-waits` or `demo-workspace/tests`.
8. `Remove-Item -Recurse -Force packages/test-runner/dist-f-demo-wait` → `exists=False`.

## Not verified

- **Live behaviour. No Lab or demo command was run.** A Lab run must show all of the following:
  - `demo:record`, and then `demo:run`, run alone and again beside a bench, both exit 0.
  - In the recording lane, `waitForNewRecording` returns only after Core has stamped the new recording's
    `endedAt`, inside 90 s.
  - Core's log shows `review-recording-flow-proposal` after the wait.
  - `workspace.json` gains `latestRecordingId`.
  - The same holds for the diagnosis lane's call (`diagnosis-lanes.ts:77`).
  - If the bound trips, the lane's error reads
    `FluxIQ persisted demo recording <id> but did not finalize it within 90000 ms (DEMO_RECORDING_FINALIZE_TIMEOUT_MS): …; last observed entry count <n>`,
    not `EBUSY`. That also needs `f-demo-cleanup-error`'s `core-process.ts` fix to have landed.
  - Subflow generation and playback after the wait have never been reached live, so they may fail next.
- **The 90 s default is not measured.** How long Core would have needed to finish a1 or a2 is unknown,
  because Core was stopped first.
- **Summary mode and the callers' baseline agreeing.** The callers still take their baseline with the
  unsummarized `listRecordings`, and detection now reads the summary index. `i-demo-recording-finalize`
  shows a not-yet-finalized recording is present in that index, and the Flow lane already reads summaries
  for a known id. But I did not check against Core that both forms list the same set of older recordings.
- **`waitedMs` on success is not recorded anywhere.** The function still returns only the id, as its
  callers expect. See open question 3.
- **The nine load-failing test files** above never ran their assertions in this build. None of them
  touches `control-waits`.
- Core source was not read by this worker. Everything about Core here comes from `i-demo-recording-finalize`.

## Open questions or contradictions found

1. **Baseline and detection read different forms of `list-recordings`.** If Core's summary index ever
   lists an older recording that the unsummarized list omits, the wait would count it as new. It would
   then fail as "more than one recording", or pick the wrong id. Closing this fully means the callers take
   their baseline in summary mode too. That needs `workspace-lanes.ts` and `diagnosis-lanes.ts` in a brief's
   Owns, plus an exported summary-baseline helper here. I did not widen scope to do it.
2. **Category change on transport failure during detection.** An HTTP failure while finding the recording now
   reports `environment.missing` (`automationStudioCall`, `existing-fluxiq-control.ts:64-65`), not
   `recording.persistence`. The Flow lane's `awaitFinalizedRecording` already behaves this way. A failure to
   finalize is still `recording.persistence`.
3. **`i-demo-recording-finalize` wanted `waitedMs` recorded on a successful wait.** Recording it needs
   callers I do not own to accept a richer return, or an evidence hook. The brief's Owns would need
   `workspace-lanes.ts` and `diagnosis-lanes.ts`.
4. **Shared `test-contracts` dist.** Until the supervisor rebuilds it with `flowLaneExclusion`, nine
   test-runner test files fail to load against any fresh test-runner build. This is not caused by this change.
5. **Not investigated:** other demo lanes that compare recording ids before and after may carry the same
   finalize race under load. These are `creation-lanes.ts`, `exploration-adaptation.ts`,
   `exploration-checkpoints.ts`, `bound-exploration.ts` and `adaptation-lane.ts`.
