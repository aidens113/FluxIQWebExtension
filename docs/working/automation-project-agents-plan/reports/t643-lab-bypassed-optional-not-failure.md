# t643 report: a bypassed optional step is not the run's failure

Worker report. Worktree `C:/Users/osrs_/FluxStuff/fxwork/t643/!FluxIQWebExtension`, branch
`task/t643-lab-bypassed-optional-not-failure`. This is Lab code only. Nothing was committed, and no live run was made.

## Outcome

Done. A failed optional step that Core went on past by its own rule no longer becomes the run's failure. It is
kept as a note: `optionalBypass` on the attempt, and `bypassedOptionalFailures` in the outcome and the snapshots.
The verdict follows Core's playback status, its result check and the oracle. A failed judgement in the repair lane
now names its real reason, and says `oracle_failed` only when the oracle failed.

## What changed and why

- **Reading Core's record of the bypass (new `packages/test-runner/src/flow-lane/optional-bypass/`).**
  - `attempt-bypass.ts` exports `optionalBypassesOf(attempts)` and `CORE_OPTIONAL_WAY_ON_LABEL`. A failed attempt
    counts as bypassed only when both of these hold:
    - Core's selected ladder candidate on that attempt (`metadata.recoverySelected`, projected in Core's
      `service/summaries/conversions.ts`) is `deterministic_path` with Core's label "Go on past the optional step".
    - The run's next attempt that names a node is on that candidate's `targetNodeId`. A refuted result's attempt is
      skipped when looking for it.
  - Why the attempt's own mark and not `runDetail.recoveryAttempts`: Core builds those from the root trace only,
    and a build puts its optional steps inside called subflows, whose attempt ids are their own frame's.
  - Why the predicate is read from Core's record and not copied: Core does not export
    `automationStudioOptionalStepWayOn`.
  - `bypassed-by-node.ts` exports `bypassedByNode`, which groups attempts by node the same way `recoveredByNode`
    does. Every attempt of a node whose last attempt was bypassed is marked.
- **`persisted-flow-run.ts`.**
  - A new attempt field `optionalBypass?: { toNodeId }`.
  - The outcome's `failure` now skips failures on bypassed nodes. Those failures go to a new outcome field,
    `bypassedOptionalFailures?: { nodeId, failure }[]`.
  - The file was at 797 of its 800-line budget. To make room, the evidence-packet reader (`PersistedEvidencePacket`,
    `evidencePacketsOf`, `serializedBytes`) moved whole into `persisted-attempt.ts`, the sibling attempt-metadata
    reader. It is still exported from the barrel. The file is now 770 lines.
- **`lane-observation.ts` `reportedVerdict`.** Attempts on bypassed nodes are left out of the success test. Core's
  `status !== "succeeded"` still fails the run first, and `run.failure` is still checked.
- **Evidence.**
  - `run-flow-lane.ts` `flowActionsSnapshot` carries `optionalBypass` beside the attempt's failure.
  - `flowLaneSnapshot` and `creation/snapshot.ts` carry `bypassedOptionalFailures`.
- **Repair-lane gate.**
  - `run-evaluation/adaptation/gate.ts`:
    - The input `laneFailed: boolean` is replaced by `laneFailure: "oracle_failed" | "flow_reported_failure" |
      "judgement_failed" | null`. The two new reasons are added to `ADAPTATION_GATE_REASONS`.
    - A new function, `adaptationGateLaneFailure(observation)`, picks the reason. It returns `oracle_failed` only when
      `oracleVerdict === "failed"`, `flow_reported_failure` when `reportedVerdict === "failed"`, and
      `judgement_failed` otherwise.
  - `flow-lane/repair/run-repair-lane.ts` reads `input.lane.observation`. The created lane already passes its whole
    evidence as `lane`, so `run-scenario.ts` did not change.
- **Docs.** `docs/architecture/testing-facility.md` gained a paragraph on the gate reasons under "How the created
  Flow's playback adapts", and a new subsection, "A failed optional step Core went on past".
- **Tests.**
  - New: `flow-lane/optional-bypass/tests/attempt-bypass.test.ts` (3 tests) and
    `flow-lane/tests/optional-bypass-verdict.test.ts` (5 tests). Together they check that:
    - a run whose only failure is a bypassed optional step reads passed and keeps the note;
    - a retried and then bypassed node keeps both failures as notes;
    - a required step that took `Follow failed route` to a Merge still fails;
    - an optional step whose way-on was not taken, or that had no selection, still fails;
    - a run Core failed stays failed.
  - Updated: `gate.test.ts`, plus a new reason test, and `run-repair-lane.test.ts`, plus a test that an oracle
    `passed` with the run reported `failed` gives `flow_reported_failure`.

## Commands run and observed results

- `pnpm run check` in `packages/test-runner` printed `test-runner:check` "build", exit 0, with no tsc errors. I ran it
  twice: before and after converting the line endings back to LF.
- `node ../../scripts/build-cache/cli.mjs test-runner:build` completed.
- `node --test` over `dist/flow-lane/{optional-bypass/tests,tests,repair/tests,creation/tests}`,
  `dist/run-evaluation/adaptation/tests` and `dist/run-evaluation/tests` printed `# tests 561`, `# pass 561`,
  `# fail 0`.
- `pnpm structure:check` at the repository root printed `structure-audit: passed (195 warning(s), 639 baselined).`

## Not verified

- **That Core's real run detail for `run-mv9v3u68` carries `metadata.recoverySelected` with the way-on label on the
  `add_napkins.s2` attempt.**
  - I inferred it from Core's source: `conversions.ts` projects `recoveryDecision.selected` for every placed attempt,
    child frames included, and in `recovery-ladder.ts` the way-on has priority 5, ahead of the LLM rung at 8.
  - The Lab bundle keeps no raw run detail, so I could not check it on the run itself.
  - The fixtures in the new tests are built to match Core's shape. No live run was made, as the brief says.
- **The whole test-runner suite.** I did not run it. Only the touched directories' tests ran, as the brief asks.

## Open questions or contradictions found

- The way-on is identified by Core's candidate label, a fixed literal in `recovery-ladder.ts`. If Core renames it,
  bypasses stop being recognised and such runs fail again: they become stricter, never falsely passed. The robust
  fix is in Core: export the predicate, or mark the attempt (for example `route: "optional_way_on"`). The A8 debug
  recommends the same.
- When both the oracle and the reported verdict failed, the gate says `oracle_failed`, even though the lane throws
  on the product's failure first. Both statements are true. The brief only rules out `oracle_failed` when the oracle
  passed.
- `node-recovery.ts` `endedWell` is unchanged. `replay-repair.ts`, `stopped-without-failed-attempt.ts` and
  `terminal-run-wait.ts` therefore still treat a bypassed node as not ended well, which only matters for a run Core
  failed or one still awaiting recovery. I left this outside the brief's two paths.
