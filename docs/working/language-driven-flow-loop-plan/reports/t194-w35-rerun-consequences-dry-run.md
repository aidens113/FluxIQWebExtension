# t194-w35: a rerun refused for a `consequences: null` nobody wrote; a dry run that passes a read of nothing

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`, branch `task/t194-live-judge-answer`. Nothing committed.

## Outcome

Done. Both defects are fixed in the domain. 8 new tests and 1 corrected assertion pass on the new source and fail on `HEAD`. There is one deviation from the brief's file plan: the `permission.ts` test lives in `node-run/tests/`, because `llm-evidence/tests/` is at the audit's 25-file limit (see Open questions).

## What changed and why

### Task 1: `consequences: null` (run 11's 16 refused reruns)

- `domain/src/runtime/llm-evidence/node-run/run.ts`
  - **`nodeCall` (the source).** It now writes `consequences` only when the call carried one. It used to write `value.consequences ?? null`.
    - A `null` that arrives is also dropped. A call already stored with one therefore stops carrying it from its next run: the draft `input`/`ranWith` it returns has no key, and Core's `call-record.ts:52` takes that as the step's new input.
    - This covers every place `nodeCall` and `safeCall` feed: the look, a success, a refusal's `input`, and `standing`.
  - **Missing-declaration check (`:321`).** For a `mutate` node it now treats `null` the same as absent, so the refusal is `missing_input_keys` instead of `consequences_unreadable`. That refusal tells the model what to write.
- `domain/src/runtime/llm-evidence/permission.ts`
  - `declared === null` with `effect: "observe"` now answers `no_consequence` without asking Core. That is the same answer as an absent key.
  - **Deliberately narrower than "null = absent" for every action.** For `effect: "mutate"`, `null` stays `invalid`. The reason is `press.ts`: the recovery press tool checks only that the key is present (`harness-options/execute.ts:158`), and an absent declaration answers `no_consequence` without asking Core. If `null` meant absent there too, a press that sent `null` would be pressed without Core ever being asked. Stored data cannot need the wider reading: no `mutate` step was ever stored with `null`, because `run.ts` refused any `mutate` call that lacked a declaration before writing `ranWith`.
  - Effect on `replay.ts`: a replayed read stored with `null` now passes the permission check. Before, it answered `core.replay.failed`, because the same `invalid` came back.
- **Core `rerun-input.ts:30`: no change needed.**
  - The merge patch clones `previous` and drops a key only when the patch says `null`. So a stored `null` is carried forward, and the domain now reads it as "none declared".
  - The first rerun after this change writes the input back without the key, and from then on Core stores it without.
  - Optional hardening, not required: Core could drop `null`-valued keys from `previous`, since RFC 7386 treats `null` as "absent". I did not edit Core.

### Task 2: the dry run counted the longest array, not rows (`replay.ts`)

- New private `webNodeProduced(payload)`.
  - **List read:** when the payload carries `extraction.recordCount`, it returns the read's own account: `{ records: recordCount, itemsSeen?, unfiltered? }`, where `unfiltered` comes from `extraction.conditions.unfiltered`.
  - **Any other payload:** it falls back to `webNodeRecordCount` (the longest array), so every non-read node behaves as before.
- `webNodeReplayStatement` writes that as `produced`. Core carries `produced` as an opaque `JsonObject`: `evidence-loop-decision.ts:228-233` and `node-tools/replay.ts:113`.
- `replayStep` compares the recorded `produced` with `webNodeProduced(result.payload)` through `readChange`. It answers `core.replay.changed` in three cases:
  1. `records` went from more than 0 to 0. The message is the same as before.
  2. `itemsSeen` went from more than 0 to 0: "the step found no list where it found N items". This catches a list that vanished even when the build's conditions kept 0 rows.
  3. The build's `unfiltered` was `false` with `records > 0`, and the replay's is `true`.
- Fewer rows, another order, or a read that was unfiltered in both runs still answers `replayed`.
- `webNodeRecordCount` stays exported and unchanged.

### Tests

All test changes are under `domain/src/runtime/llm-evidence/node-run/tests/`.

- New `unwritten-consequences.test.ts`, 4 tests:
  1. A look and a read that declared nothing are written back with no `consequences` key.
  2. A rerun of a read carrying `consequences: null` (run 11's merged `rerun.9.2`) runs and stops carrying the `null`.
  3. A press with `null` is refused `missing_input_keys` and is not pressed.
  4. `webActionPermission`: `null` from a read is `no_consequence` and Core is not asked; `null` from an act is `invalid`, with or without a check; a non-list from a read is `invalid`.
- New `replay-read-account.test.ts`, 4 tests. They use a live-shaped `extract_list` payload: an `extraction` account with 6 `fieldNames` and a 5-entry `conditions.rejected`, plus a snapshot with 40 `interactiveElements`.
  1. The statement records the account's counts. A non-read payload still records the longest list.
  2. 12 rows then 0 answers `changed`.
  3. `itemsSeen` 11 then 0 answers `changed`.
  4. Filtered then unfiltered answers `changed`. Fewer rows, and unfiltered in both runs, answer `replayed`.
- `rejected-rows.test.ts:108` corrected. It asserted `produced.records === 2`, which was the length of `fieldNames` for a read whose `recordCount` is 1, so it had pinned the defect. It now asserts 1. The test's intent, that the replay never counts the 3-long sample list, still holds.

## Commands run and observed results

All were run from the tree root through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w35 ..."`.

- **`npx tsc -p domain/tsconfig.json --noEmit`:** exit 0, no output.
- **`npx tsc -p domain/tsconfig.test.json --noEmit`:** one error, and it is not in my changes.
  - The error is `domain/src/runtime/llm-evidence/node-run/tests/covered-press.test.ts(51,9): error TS2322`, a `kind: string | undefined` inside a `JsonObject` literal.
  - That file is untouched (last commit `46cf82c2`), and the error is self-contained in its fixture, so it predates this work.
- **Narrow tests:** `node .../t194s5/narrow-tests.mjs <abs domain> t194-w35 runtime/llm-evidence/node-run runtime/llm-evidence/tests`.
  - Final run: `narrow: 44 test files`, `# tests 297`, `# pass 297`, `# fail 0`.
  - I checked first that `runtime/llm-evidence/tests` holds no test of `permission.ts`. There was none, which is why a new test was needed.
- **Fail-on-old-source check.**
  - Setup: I copied `domain/package.json` and `domain/src` to `domain/.test-build-scratch/t194-w35-oldroot`, overwrote `run.ts`, `replay.ts` and `permission.ts` there with `git show HEAD:` copies, and ran the same runner on that root.
  - Result: `# tests 297`, `# pass 288`, `# fail 9`. The 9 failures are exactly the 8 new tests and the corrected `rejected-rows` test.
  - Test 104 (the rerun) failed on the old source with `{"code":"invalid_input","detail":{"reason":"consequences_unreadable"}}`, which is run 11's refusal.
  - The scratch root was deleted afterwards. The live tree was not touched.
- **`node scripts/structure-audit.mjs`:** `structure-audit: passed (154 warning(s), 118 baselined)`.
  - An earlier run failed on two violations of mine, both now fixed:
    - `contract-spread`: spreads in my test fixture.
    - `directory-files`: `llm-evidence/tests/` reached 26 files.
  - The remaining warning on my files is `[file-lines] node-run/run.ts: 796 lines`. That advisory predates this change: the file was 785 lines at `HEAD`, and I added 11 lines of comment.

## Not verified

- No Lab run or live browser run, as the brief required. I did not check whether run 11's re-author would now succeed end to end. Its `where` rejected every row (cause 5 in the debug), and this change does not touch that.
- **Whether the `unfiltered` rule would have caught run 11's duplicate read.** The rule fires only when the build's own run of the step recorded `unfiltered: false` with rows.
  - The debug says the exploration run of that step was "also page 5 with 11 rows". If that run was unfiltered too, the dry run still answers `replayed`. NO EVIDENCE either way: the build's `produced` for it was the longest-array 638/643.
  - Flagging every unfiltered replay would judge the build's own read rather than a change, so I did not.
- `extraction.itemsSeen` is optional in the summary contract (`actions/extraction/summary.ts:45`). A page build that does not send it gets only the `records` rule.
- A draft statement recorded before this change carries a longest-array `records`. Replayed after it, that could answer `changed` for a read that also read 0 rows while exploring. This only arises for a resumed build whose steps were recorded on the old domain. Not exercised.
- No package `build`, `pnpm check` or `pnpm test`, as the brief required.

## Open questions or contradictions found

- **Test placement.** The brief asked for `permission.ts`'s test beside it. `llm-evidence/tests/` held exactly 25 files, so adding one fails the audit's `directory-files` rule. Regrouping that directory means moving files I do not own.
  - What I did: the assertions are in `node-run/tests/unwritten-consequences.test.ts`, with a comment saying why. The file already exercises `permission.ts` through `run.ts`.
  - Supervisor's call: regroup `llm-evidence/tests/` by feature, or accept this placement.
- **`null` for acting nodes stays unreadable in `permission.ts`.** This is a deliberate narrowing of the brief's "null = absent", explained under Task 1. `run.ts` still treats it as absent for the library verb, as `missing_input_keys`.
- **Other workers are editing this tree at the same time.** `git status` showed edits to `domain/src/runtime/llm-evidence/tools.ts`, `tests/tools.test.ts` and `packages/test-runner/...`, none of them mine. My narrow run included `llm-evidence/tests/tools.test.ts` in whatever state it was in, and it passed.
