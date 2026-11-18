
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
