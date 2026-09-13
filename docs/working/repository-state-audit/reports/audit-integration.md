# Report: audit-integration

## Outcome

Done. The cross-repository links and current compiled contracts are coherent, but the
pushed heads are not ready for Stage 4: the required load-bound and pairing diagnostics
change is absent. I also found one reproducibility gap in the final comparison tool and
stale authoritative state in both Week 1 documents.

## What changed and why

Only this report was added. No source, shared working document, generated output, Lab
worktree, run artifact, runtime state, commit, or remote was changed.

## Prioritized findings

### P0 — Stage 4 must not run at the current downstream head

All three requirements in the queued `f-lab-wait-bounds` brief are absent:

- `packages/test-runner/src/flow-lane/finalized-recording.ts:71` still sets
  `DEFAULT_TIMEOUT_MS = 30_000`, although the load investigation measured all five W10
  failures at that bound and justified 90 seconds
  (`docs/working/mvp-week1-web-automation-reliability-plan.md:748-756`).
- The thrown `recording.persistence` error already owns safe diagnostic details at
  `finalized-recording.ts:121-131`, but `run-scenario.ts:377` publishes
  `failureDetails` only for `recording.contract`. A Stage 4 recurrence would therefore
  still omit the bound, waited time, last entry count, and whether `endedAt` was seen.
- The common status poll at `run-scenario.ts:603` still has a 15-second bound and a
  generic `gateway.connection` message. `pairExtension` at `run-scenario.ts:512-517`
  does not retain the last extension status or identify whether it timed out before or
  after approval. That leaves the known W13 load failure unclassifiable again.

This is a campaign blocker, not merely missing observability. The Stage 4 brief requires
the concurrent bench pair to run only at a pin carrying this fix
(`briefs/finish-week1.md`, “Lab Stage 4”, order and pin rules), because the old 30-second
bound failed only under concurrent load. The current pushed head is `f3771ac`; Core is
`0a2dc53`; both equal `origin/dev`.

### P0 — The Week 1 result remains unverified by its own definition

The downstream Current State explicitly says no exit criterion is proven
(`mvp-week1-web-automation-reliability-plan.md:34`, and the table at `:104-115`). The
required live evidence-packet/provider-off/leak/demo proof, two complete `--repeat 3`
benches, comparison, ranking, and six ledger observations have not run. Current unit,
harness, type, build, and earlier partial-Lab evidence cannot close this gap under the
plan's stated rules. This is expected queued work, but it invalidates any claim that
Week 1 is complete at these heads.

### P1 — The final comparison procedure depends on an ephemeral Claude scratch file

The plan invokes `bench-compare.mjs` at
`mvp-week1-web-automation-reliability-plan.md:102,112` and the Stage 4 brief says the
supervisor uses it. No such script is tracked or present in the repository, including
ignored files. Its report points to a 49,262-byte untracked file under a specific Claude
temporary session directory
(`reports/i-bench-compare-prep.md:19-23,89-94`). That file exists on this machine now,
but its location is not durable second-brain state and will not survive ordinary temp
cleanup or a different machine/agent environment.

The tracked `lab compare` command exists (`packages/test-runner/src/cli.ts:44-46`) and
does the contract metric comparison, but the scratch script additionally renders the
six criterion counts and recording-discard diagnostics. Its own report says the real
`--repeat 3` and real discard paths have not yet been exercised
(`i-bench-compare-prep.md:250-260`). Before final close-out, either promote the script
to an owned tracked tool with tests, or amend the plan to a fully specified durable
procedure based on `lab compare` plus a tracked reader. This does not block
`l-final-proofs`, but it can block reproducible Phase 1.6b close-out.

### P1 — Both authoritative Week 1 Current States contain stale repository truth

- Downstream says stopped `f-lab-wait-bounds` partial edits are uncommitted
  (`mvp-week1-web-automation-reliability-plan.md:94-98`). No such edits exist at intake
  or now; only the supervisor's new audit documents/index edits are present.
- Core says the branch is three commits ahead and not pushed
  (`F:/!FluxIQ/docs/working/mvp-week1-web-automation-reliability-plan.md:23-24`) and
  repeats “push” as its next step at `:109-110`, while the same Current State says both
  branches are pushed at `:67-68`. Git confirms `0a2dc53 == origin/dev`.

These do not change runtime behavior, but they violate the working-document rule that
Current State is authoritative and can misdirect Claude or another supervisor.

## Integration and build-freshness observations

- Downstream `domain` and `test-runner` resolve `fluxiq` through junctions to
  `F:/!FluxIQ/packages/fluxiq`, exactly matching their `link:` manifests and lockfile.
  Imports use declared public exports (`fluxiq/core`, `fluxiq/automation-studio`, and
  `fluxiq/automation-studio/nodes`); the current downstream type checks passed against
  Core's built declarations.
- Core `dist` is newer than the latest Core source edits and visibly contains
  `allowLlmDiagnosis`; Core has no code changes after `e5c9828`, only the plan commit
  `0a2dc53`. The recorded full sequential suites, `pnpm build`, and package lint therefore
  cover the current Core code tree.
- Downstream generated inputs used by consumers are fresh at intake:
  `packages/test-contracts/dist` is newer than its latest source commit; `domain/dist`
  is newer than `domain/src`; `test-runner/dist` is newer than its latest source; the
  tracked extension build commit `d639415` follows the last extension-source commit
  `f41072e`; and tracked `domain/.test-build` was refreshed at `d268a1f` after the last
  domain-source commit `d69aa09`.
- The workspace `domain/dist/host/web-panel-host.mjs` predates the latest host source,
  but it is intentionally untracked and is rebuilt by isolated Lab startup
  (`packages/test-runner/src/coordinator.ts:80-90`) and by both demo lanes
  (`demo-workspace/core-process.ts:52-60`). It is not a Stage 4 freshness defect as long
  as the documented launchers are used; running that file directly would be stale.
- Downstream's last root `check`/`test`/`build` was recorded on `4fe671e`; commits after
  it change only working documentation and regenerated tracked domain tests. Thus it
  covers current source, but the planned wait-bounds source change will require a new
  gate before Stage 4 pins are declared. Core's full gate/build is recorded on its last
  code commit `e5c9828`.

## Commands run and observed results

- `git status --short --branch; git rev-parse HEAD; git rev-parse origin/dev` in both
  repositories -> downstream `f3771ac` and Core `0a2dc53`, each equal to `origin/dev`;
  only the supervisor's in-progress paired audit documents/index edits were present.
- `pnpm check` in `domain` -> exit 0 (`tsc --noEmit` for source and tests).
- `pnpm check` in `packages/test-runner` -> exit 0; its domain-dist guard found the
  existing declarations and did not rebuild them.
- Manifest, lockfile, junction, git-log, file-time, and generated-file inspections ->
  link targets and freshness observations above; no files changed.
- `Test-Path <Claude temp>/scratchpad/bench-compare.mjs` -> `True`; repository-wide
  `rg --files -uu` found no repository copy.

## Not verified

- No unit suite, root gate, build, package lint, browser, Lab, demo, bench, mutation, or
  comparison run was executed; this brief is read-only and Stage 4 is not authorized.
- No Lab worktree, prior run bundle, runtime storage, SQLite file, or secret-bearing
  state was opened.
- File modification times plus recorded gates establish practical build freshness, not
  byte-for-byte equivalence to a clean rebuild. The supported Stage 4 launchers rebuild
  the only visibly stale generated host bundle before loading it.

## Open questions or contradictions found

1. Should the 49 KB comparison script become a tracked test-runner/reporting tool, or
   should the Stage 4 close-out be rewritten around the narrower tracked `lab compare`?
2. W13's pairing failure remains an unverified load risk until the new diagnostics are
   present and the concurrent bench pair either passes or records where pairing stopped.
