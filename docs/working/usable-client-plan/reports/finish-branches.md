
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
