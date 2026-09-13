# g-target-resolution-union: the Flow lane keeps Core's no-candidates record

Worker report, 2026-09-13. This repository at `1d7d1ab` (uncommitted; other
workers editing in parallel). Core read at `0e6d3ac`, nothing edited there.

## Outcome

**Done.** The Flow lane keeps Core's `unresolved_no_candidates` record again. It
is read the way Core's union now defines it: `status` plus `candidateCount: 0`,
and no confidence floor. Scored records keep their floor, `confidence` and
`normalizedScore`. A record with an unknown status, or missing a field its
variant needs, is still dropped. A probe row failed before the fix. Three
mutations each broke the right row and were restored byte-identical.
Test-runner `pnpm check` exit 0. The persisted-flow-run tests pass 10/10.

The full test-runner suite did not come back clean. The failures are in other
workers' files, and they moved between two runs while my files did not change
(see Commands).

## What changed and why

**The problem.** Since `0e6d3ac`, Core's `AutomationNodeTargetResolution`
(`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\nodes\contracts.ts:123-134`)
is a union:
- `{ status: "unresolved_no_candidates"; candidateCount: 0 }`, with no floor;
- `{ status: "matched" | "no_match" | "below_confidence"; candidateCount; minimumConfidence; candidateId?; confidence?; normalizedScore?; matchedSignals?; failedSignals? }`.

The old reader required a finite `minimumConfidence` for every status. So every
no-candidates record was silently dropped, and that is every web dispatch today.

**`packages/test-runner/src/flow-lane/persisted-flow-run.ts`**
- `PersistedTargetResolution` is now a two-variant union that copies Core's
  source. The first variant is `{ status: "unresolved_no_candidates";
  candidateCount: 0 }`. The second has a status from
  `SCORED_TARGET_RESOLUTION_STATUSES` (`matched`, `no_match`,
  `below_confidence`), `candidateCount`, `minimumConfidence`, and optional
  `confidence` and `normalizedScore`. The old `TARGET_RESOLUTION_STATUSES`
  constant is replaced by the scored-status list.
- `targetResolutionOf` reads each variant field by field.
  - **No-candidates:** returns a fresh `{ status, candidateCount: 0 }` only when
    `candidateCount === 0`, which is Core's literal. Any other count is dropped
    as not a record Core writes.
  - **Scored:** the same checks as before (known status, finite count, finite
    floor), with the optional numbers added only when finite.
  - The metadata and record guards now use the file's existing `optionalRecord`.
    Behaviour is unchanged for arrays and non-objects.
- **One behaviour choice to review.** A no-candidates record that still carries
  a `minimumConfidence`, as Core wrote before `0e6d3ac`, is kept, but the floor
  is not copied. That is what reading field by field means here, as with
  `candidateId`, and it keeps a Lab run against an older Core from losing the
  record. The alternative, dropping it, is a one-line change.
- The two doc comments now describe the per-variant rule.
- **No other file needed changing.** `run-flow-lane.ts:158` passes the typed
  record on unchanged and compiles. `tests/run-flow-lane.test.ts:226` uses the
  scored shape and compiles. Nothing in `domain/src`, `apps/extension/src`,
  the bench, `scripts/` (JS), or `docs/architecture` reads `targetResolution`
  or `minimumConfidence`.

**Why the type is not imported from Core.** Test-runner resolves `fluxiq`
through Core's built `dist`. `F:\!FluxIQ\packages\fluxiq\dist\programs\automation-studio\nodes\contracts.d.ts`
is dated 2026-09-12 18:43, before `0e6d3ac` (2026-09-13 00:53), and still
declares the old single-record type with `minimumConfidence` required. Tying the
local type to it would check against the wrong shape, and rebuilding Core is
outside this brief.

**`packages/test-runner/src/flow-lane/tests/persisted-flow-run.test.ts`**
- **"Core's target resolution travels with the attempt, rebuilt from its closed fields only":**
  - The no-candidates record is now Core's new shape, with `candidateId` and
    the signal lists beside it. It must arrive as exactly
    `{ status: "unresolved_no_candidates", candidateCount: 0 }`, and nothing
    else may travel.
  - A new row checks that the same record with a leftover `minimumConfidence:
    0.55` also arrives without the floor.
  - The scored row is now a loop over `matched` (keeps `confidence` and
    `normalizedScore`) and `below_confidence` (keeps `confidence`).
- **"an attempt with no target resolution, or one Core does not write, carries none":**
  two new dropped cases. One is a `matched` record without its floor. The other
  is a no-candidates record with `candidateCount: 2`. The unknown status
  `guessed` row is kept.

## Commands run and observed results

All from `packages/test-runner` with `EXTENSION_TEST_BUILD_LABEL` and
`DOMAIN_TEST_BUILD_LABEL` set to `g-target-resolution-union`. Builds went to a
private `dist-gtru` (and `dist-gtru-m` for mutations), both at `dist`'s depth,
and both were removed at the end. Outputs are in the scratchpad as `gtru-*.txt`.
Node v22.11.0.

1. **Probe:** new tests, old source.
   `npx tsc -p tsconfig.json --outDir dist-gtru` exited 0. Then
   `node --test dist-gtru/flow-lane/tests/persisted-flow-run.test.js` exited 1
   with "# pass 9 / # fail 1": "not ok 7 - Core's target resolution travels with
   the attempt ...", `+ undefined` against
   `- { candidateCount: 0, status: 'unresolved_no_candidates' }`. This confirms
   the defect at HEAD. Row 8 passed on the old source; its new cases were also
   dropped by the old reader.
2. **After the fix:** the same build exited 0. The same test exited 0 with
   "# tests 10 / # pass 10 / # fail 0".
3. **Mutations**, run by a scratch script (`gtru-mutate.mjs`). Each one mutates
   the source, builds into `dist-gtru-m` (tsc exit 0 every time), runs the
   test file, restores the file from a snapshot taken before any mutation, and
   compares bytes.

| Mutation | Result |
| --- | --- |
| M1: no-candidates branch removed, so the reader requires a floor again | exit 1, only "not ok 7", `+ undefined` against `- { candidateCount: 0, status: 'unresolved_no_candidates' }`. Restored byte-identical: true |
| M2: zero-count check dropped | exit 1, only "not ok 8", `+ { candidateCount: 0, status: 'unresolved_no_candidates' }` against `- undefined` (the `candidateCount: 2` case) |
| M3: no-candidates record copied whole | exit 1, only "not ok 7", `+ candidateId: 'email-address', + failedSignals: [...], + matchedSignals: [...]`. Restored byte-identical: true |

   After the script, `cmp` printed "source identical to snapshot" and "test
   identical to snapshot".
4. **`pnpm check`** (domain dist present, then `tsc -p tsconfig.json --noEmit`)
   exited 0.
5. **Full suite, first run:** `node --test "dist-gtru/**/*.test.js"` exited 1,
   "# tests 496 / # pass 495 / # fail 1". The failure was "not ok 166 - Core's
   discard audit is read a second time ..." (`run-evaluation/tests/runner-wiring.test.ts`),
   "read and published while Core, whose audit is in memory, is still running".
6. **Rerun**, after a fresh build from the restored, unchanged source.
   - `runner-wiring.test.js` alone exited 1, "# pass 5 / # fail 1", but now on
     "not ok 3 - the redaction attestation scans once Core has stopped ...".
   - The full suite exited 1, "# tests 496 / # pass 493 / # fail 3":
     - not ok 109, `flow-lane/tests/recording-discards.test.ts`;
     - not ok 148, `redaction-attestation/tests/attest-run-redaction.test.ts`;
     - not ok 164, `runner-wiring.test.ts`.
   - Test 166 passed this time. Tests 109, 148 and 164 had passed in run 5.
   - **Why these are not mine:**
     - My two files were byte-identical across runs 5 and 6.
     - None of the failing test files imports `persisted-flow-run`.
     - `git status` shows other workers modifying `run-scenario.ts`,
       `recording-discards.ts`, `attest-run-redaction.ts`,
       `run-redaction-scopes.ts` and `runner-wiring.test.ts` in this window.
     - Every importer of `persisted-flow-run` passed in both runs:
       `persisted-flow-run.test`, `expectations.test` and
       `lane-observation.test`. Rows 99 and 100 (mine) were "ok" both times.
7. **`node scripts/structure-audit.mjs`** (root) exited 1, on `working-docs`
   rules only:
   - a Work Ledger entry "2026-09-13 — l-stage1 ..." has no "- Validation:"
     bullet;
   - the plan is at "801 lines exceeds the 800-line compaction threshold";
   - `docs/working/README.md` is out of date.

   No line names either of my files. Neither is baselined, and both are well
   under the 400-line warning.

## Not verified

- **Lab: what a Flow-lane run should show.** Run the Lab against Core at
  `0e6d3ac` or later.
  - `flow-lane.json` should carry `targetResolution` on each web action as
    exactly `{"status":"unresolved_no_candidates","candidateCount":0}`, with no
    `minimumConfidence`, `candidateId`, `matchedSignals` or `failedSignals`.
  - Before this change the key was absent from those actions.
  - A scored record is not expected today, because web supplies no candidates.
- **Against a Core older than `0e6d3ac`:** the same record should appear without
  its floor. Read, and covered by a unit row; not run.
- **Not run:** root `pnpm check`, root `pnpm test`, the package's own
  `pnpm test`, and `pnpm build` (forbidden by the brief). The package's `pnpm
  test` would build into the shared `dist`, so the private `--outDir` was used
  instead.
- **A clean full test-runner suite** was not observed, because of the parallel
  edits above. It needs a rerun once those workers settle.
- **Single observations:** each run was observed once. The mutations were
  observed once each.

## Open questions or contradictions found

1. **Core's `dist` is stale.** It predates `0e6d3ac` and still declares the old
   type. This repository's compile of anything importing Core's types therefore
   checks against the pre-union shape until Core is rebuilt. Once it is, an
   optional follow-up could add a compile-time tie between
   `PersistedTargetResolution` and `AutomationNodeTargetResolution` (from
   `fluxiq/automation-studio/nodes`), so drift fails the build.
2. **The leftover-floor choice** (What changed, "one behaviour choice to review")
   is the supervisor's to accept or reject.
3. **Parallel failures.** Tests 109, 148, 164 and 166 belong to the workers who
   own `recording-discards`, `attest-run-redaction` / `run-redaction-scopes`,
   and `run-scenario.ts` / `runner-wiring.test.ts`. Rerun them once those
   workers are done.
4. **Structure audit.** The three `working-docs` failures in item 7 are
   supervisor-owned. No baseline entry should change for this brief.
5. **This fixes open question 2 of `reports/g-core-target-gate.md`.** No
   authored doc in this repository describes the record's fields, so no doc
   change was needed here.
