
## Phase 2: t933 and t935 ready for the lead (2026-11-17, evening)

- **t933 finish-t885** (`fxwork/t933-finish-t885`, 8 files uncommitted): `9e49d0db4` ported exactly. Dev's four source files were
  byte-identical to its pre-image, and the changed lines are identical to the original's. Red 23 pass, 5 fail (as originally recorded),
  green 584/584 in `node-run`, domain check exit 0 (fresh build), structure audit passed. **`b5278e377` dropped**: it edits the unmerged
  WIP group walk from `8af850680`, and t905 carries both unchanged, so they land with t905. Details: `finish-branches/t933-port.md`.
- **t935 draft-callid** (`fxwork/t935/!FluxIQ`, 3 files uncommitted): `entry.ts` change identical to t905 `280c4bdad`. Worker results:
  red 1 fail, green entry.test 36/36, fluxiq check exit 0, audit passed. My re-run after its expectation fix: wider set (draft,
  dropped-act, refuted-result, stalled-amendments-replay, rerun-check, automation-activity) 111 files and 1027 tests passed. Downstream
  extension tests read step fields by name (`step.inResult`, `step.written`), so the added field cannot break them. Details:
  `finish-branches/t935-draft-callid.md`.
- Port 4000 check: the Lab gets its ports from the OS (`listen(0)`, `allocateLoopbackPort`), and Windows hands those out only in 49152-65535
  (`netsh int ipv4 show dynamicport tcp`). No fixed 4000 in `packages/test-runner/src`.
- The heavy-slot queue was long and free memory fell to 0.3 GB while waiting. Each task's checks ran in a single slot hold.

## Phase 2: t893 ready for the lead (2026-11-18)

- Merge conflicts (3 files, t926 tab gate) resolved by me, keeping the gate; merge `2de097511` concluded by the lead.
- Setup fixes in the t893 worktree, all non-git: built the shared Core's new `@fluxiq/cloud` package (its build guard
  refused without it; t940 on dev since relaxes that guard); ran `pnpm install --frozen-lockfile` (the worktree lacked dev's new
  `fake-indexeddb` and the `browser-host` link); built `browser-host`.
- Checks on fresh builds against Core e60e82631: extension build exit 0; extension check exit 0; test-runner build exit 0;
  readiness tests 72/72; structure audit passed.
- First proof `run-mwlxtalc-4297736d` failed. An Opus worker traced it to the professional-network script (cause (a)), not the
  readiness change. The script sent a `take` amendment that exists only on unmerged t905, repeated the wrong press when the
  fixture's timed conversation card opened, and allowed too few judges. It fixed only the script and its test (2 files,
  +65/-14; test 21/21). Details: `finish-branches/t893-proof-debug.md`.
- Final proof `run-mwm3xdhv-216b9033` (worker-run, Core 7431351c0): exit 0, status passed. I checked `attempt.json`: 4/4
  `achieved`, verdict `right`, provider `scripted`, continuations held by digest, Lab port 53970 (OS-assigned). Calls per attempt:
  15, 7 (run the Flow then explore, the notes-back form's path), 1 judge (`flow_not_proven`, by design), 1 judge (`step_failed`).
- Open Core defect, not fixed: a repeat over zero rows is marked `not_reached` (`flow-run/steps-ran.ts:139`), so
  `replay-stands.ts:55` reports `step_failed` and attempt 4 spends a judge call it should not. The script's `NOTES_BACK_JUDGES = 4`
  absorbs that call although its own comment says attempt 4 asks none. Drop it to 3 when Core is fixed.
- One intermediate proof (`run-mwm2glmb`, failed) ran with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` because the shared Core was then 5 Core
  commits behind. The final run did not need it.

## Phase 2: t905 stage A (2026-11-18)

- Core merge conflicts (3) resolved by me: wait reasons follow dev (stuck_in_a_loop kept, model_key_locked dropped); entry.test
  field order. The lead committed the merge as f16e969b9. Extension side merged cleanly.
- Captured-row identity guard (Opus, `t905-captured-row-guard.md`): red reproduced. Under an accepting authority the child echoed
  copies, and the parent's saved trace lost its dataset markers; no raw-text leak was observed. The guard checks originals against
  the live run's own record map, by identity only, before any copy. Captured or unanswerable inputs go to the child uncopied, with
  unknown input use. The stage-B provenance gap for root and external inputs remains, as specified.
- Regressions t905 brought to dev's own answer-first tests: 38 failures in 10 files. I proved the same files pass on Core dev
  (147/147). An Opus worker fixed 36 at their causes, all in t905's unvalidated WIP: a publication clashed with the store's
  fixed-per-run schema; a hand fix's rows dropped out of the feed; t905's own tests had stale paths; the fake domain never reported
  a read's place (`t905-answer-first-regressions.md`). Decisions I made on the last two (`t905-result-datasets.md`):
  - `keep.test:51` follows D1 (a look is never the result: collected 3, duplicates 0).
  - A superseded result publication is retired, so Data/export lists the current result plus the per-call capture datasets.
  - Capture datasets stay, because every run's rows are collected.
- Closed-store regression (service-wiring 2/7; dev 7/7): t905 `280c4bdad` had removed `saveTyped`'s fallback for a store that
  fails to open. Restored narrowly for an unavailable store only; every other open failure still propagates
  (`t905-closed-store.md`, `t905-closed-store-fix.md`).
- Open, for separate tasks:
  - In `service.ts` and `generation-catch.ts`, a throw after model calls is labelled a pre-model refusal and shown as a setup step,
    which hid the store clash above. This is dev code.
  - Retiring a publication writes an actor-less `deleted` audit event through `deleteRunDatasets`. A dedicated "superseded"
    method would read more honestly.

## Phase 2: t905 stage B (2026-11-18/19, in progress)

- Read-vocabulary gaps: already closed by t905's p2 work (`t905-result-ledger/p2-read-gaps.md`). `read-vocabulary.test.ts`
  passed whole in my stage-A domain run.
- Unit B (Opus, `t905-unit-b.md`): root inputs seal only through the service's durable input owner, and only when every
  assembled layer has an authenticated origin (the run's own request, or a current revision of an earlier run under the same
  project, task and principal). Anything else stays unknown, with codes origin_unverified, stale, active_secrets,
  resume_state_unverified, unverified_frame and fork_unverified. The seam is `AutomationStudioInputUseExecutions.of(service)`,
  because service.ts may not grow past its baseline. The native-dispatch fifth argument is forwarded for C1/C2.
- `vitest related` found 4 failures outside B's folders. I proved all 4 pass on Core dev (34/34) and fail on t905. A11 needs a
  dev merge (255d606ab). Opus fixes (`t905-related-fixes.md`):
  - The stream store wrote a run's events as one chunk (over 2,000 refused), read at most 5,000, and paged by stream sequence.
    It now writes in chunks, reads every event, and pages by each attempt's own order. Its fixture was also fixed.
  - Answer-first output group: the answer is every draft read appending to the same record output, as the saved Flow fills it.
    Dev's fluxnode "declared type" test now has its scripted model drop its probe read.
  - `keep` processes datasets before writing a waiting row (a race that `keep.test` exposed under load).
  - B switched on in `flow-stage.ts`, with its scope from authenticated owners only.
- Machine: OneDrive.Sync.Service committed about 21.6 GB on 11-19, leaving about 1.1 GB of commit free and failing shell forks.
  Reported to the lead; not restarted (standing rule: ask first).
- Gate after the 11-19 restart (on the current tree, all through slots):
  - Folder run (answer-first, datasets, summaries, input-basis, runtime-session, fluxnode, service-flows, fluxnode-api,
    project persistence, runtime/input-basis): 319 files / 2153 tests passed (2 files and 4 tests skipped).
  - `vitest related --dir src/framework` on all 33 changed sources: 4371 passed, 1 failed (A11, fixed on dev by 255d606ab;
    needs a dev merge).
  - `vitest related --dir src/server` on keep.ts: 44/44. fluxiq check exit 0. Audit passed (554 warnings, 909 baselined).
  - I stopped the `runtime` related run (30 min) and an all-`src` related run (90 min of import-graph walking, no test
    started), because they held a slot while the campaign waited. The worker had run related for runtime, programs,
    platform, flows, tests, engine and client-gateway before its last two edits; those were not repeated.
- Unit J (judge trail and instructions) moved to t963 by the lead.
- Lead's dev merge b2625910d; A11 and the earlier failures now pass (6 files, 40/40).
- C1 (Opus, `t905-c1.md`) finished an interrupted, unattributed WIP found after the 11-19 power loss. The worker kept most of it
  and fixed 5 points: the one-seam call form, a stale graph entry voiding node seals, labels fixed at event start,
  cancellation during the check, and an audit import rule. Each real callback (builtin, native, composite, Call Subflow helper)
  now gets exactly the authority's leased copy, or the original values when the proof is unknown. The no-port path is a
  synchronous pass-through on the original objects (I checked `NodeUse.invoke` and `withParameters` identity). Uncovered:
  C2 (native port filtering, effects, child entry) and C3 (live state). In production every node event is
  authority_unavailable until the service gains a node producer.
  - Checks (worker, ordinary slots, no typecheck by rule): 5 folders, 44 files, 463/463; related engine 636/636; related
    framework 4136 passed, 1 skipped; audit passed (559 warnings, 909 baselined).
- Dev merge with t963, t964 and t965 (MERGE_HEAD 71d25f484). An Opus worker resolved 10 files and 16 conflict blocks
  (`t905-merge-judge.md`): the judge summary carries both t963's trail (how the result was got, never capped) and t905's
  resultEvidence (which pages make up the result, with coverage). The trail sits right after the question, per t965's
  cache rule. When a request does not fit, window fitting summarises resultEvidence before the trail. The new-evidence
  digest still leaves the trail out. Checks: folder run over result-verification and answer-first 375 files / 2783 passed;
  related runtime 1224 passed; related framework 3026 passed, 1 skipped; markers none; audit passed. I corrected the stale
  "latest few" comment on `looked` in flow-less/types.ts (looks are never cut).
