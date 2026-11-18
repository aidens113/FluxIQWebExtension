
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
