# t758 prerequisite audit (read-only)

## Outcome
Done. t513, t514, t516, t517 are PRESENT on dev in the repos they touched. t518 is MISSING from dev in both repos, preserved only on unmerged branches/worktrees, and no gate site needs it for instruction-led runs. W5 is already resolved in code.

## Verdicts (evidence: `git log --all --oneline --grep=tNNN`, `git merge-base --is-ancestor <merge> dev`, grep on the t758 trees)
| Task | Downstream (WebExt) | Core | Verdict |
| --- | --- | --- | --- |
| t513 | 390a2ac7 "Merge task t513: certain-no-effect-repress" (feature dd1cd60b); `is-ancestor` -> "WE 390a2ac7 in dev" | no Core commit matches t513 (downstream-only task) | present |
| t514 | b32cf9fa "Merge task t514: authoring-words-not-handles"; in dev | b8a9a218 same title; "Core b8a9a218 in dev" | present |
| t516 | 88300455 "Merge task t516: guarded interruption learning and judged promotion"; in dev | 93867c7e same title; in dev (follow-up d6f6e88d "attribute completion learning to authoritative run proof") | present |
| t517 | acb36a5d "Merge task t517: certain no-effect retry and honest lasting-action failure"; in dev | c5570e0b same title; in dev (follow-ups 9108a48c, b824d1eb, 18ee3f60) | present |
| t518 | not in dev | not in dev | missing (unmerged) |

Key code spot-checks on the t758 trees (current dev):
- t513: `domain/src/runtime/llm-evidence/node-run/press-effect/certain-no-effect.ts` exists (last touched by dd1cd60b); `apps/extension/src/content/action-runtime/ignored-press/` has press-again.ts, settled-look.ts, ignored-press-watch.ts etc. Later commits c7f29cd9, d2302b5f (t743) modified that directory; they extended rather than removed it. `certain_no_effect` referenced in interference/press-ways-out.ts and recovery/record.ts.
- t514: Core `runtime/flow-bootstrap/authoring/tests/words-not-handles.test.ts` exists; `handle_unresolved` present in Core src (activity/wording/tests/reasons.test.ts and flow-bootstrap/authoring).
- t516: Core src has `automationStudioStepLearnInterruption` (executor/graph-run.ts, 3 src files), `AutomationStudioInterruptionLearningCallback` (executor/contracts.ts, 3 files), `bindAutomationStudioInRunRepair` (6 files, recovery/in-run-repair). Downstream `clearedLayers` present in domain/src/actions/types.ts, client/gateway-mapping.ts and client/tests/gateway-mapping-cleared-layers.test.ts.
- t517: Core src has `automationStudioNodeActLasts` (12 files, executor/defensive/assess.ts) and `certainNoEffect` in packages/contracts/src/failure/parse-record.ts:11. Downstream settled-look.ts present.
- No later task found that reverted any of the four. Plan line 22 records t516/t517/t519 pushed to both dev branches (downstream 7b416b99, Core 63692096).

## t518
Holders (`git for-each-ref`, `git worktree list`; `git branch` is hook-denied so ref listing was used):
- WebExt: branch `task/t518-recorded-recovery-state-routing` @ e84892b9; worktree `C:/Users/osrs_/FluxStuff/fxwork/t518/!FluxIQWebExtension`. `git rev-list --left-right --count dev...branch` -> `836 12` (12 ahead, 836 behind dev). Diff vs merge base: 101 files, +2750/-42.
- Core: branch same name @ 7cbe3497; worktree `.../fxwork/t518/!FluxIQ`. Counts `684 10` (10 ahead, 684 behind). 51 files, +930/-22.
- No remote t518 refs listed in either repo. Also stale worktrees exist for t513 (WE and Core), t514/t516/t517 (Core, detached); not t518 related.
- Branch-only commits (per `git log --right-only --cherry-pick`, each confirmed `NOT in dev` by is-ancestor):
  - WE: 04b77cd7 complete passive result evidence projection; 77717814 trusted terminal act role; 97d5793f stable passive result facts; 17808bf3 settled recording boundaries before stop; f45d6a50 complete historical controls while accepting additions; 4284baf1 pre-extraction state provenance; f90737b0 complete recording state for replay; plus merge commits. (The t516 grep hits for 04b77cd7/97d5793f/77717814 are the same unmerged t518 commits.)
  - Core: c94242f4 connect recorded captures to guarded state routing; e60bfbe0 long-path SQLite; e42b0b5a canonical route signature; 434c0d86, d35dab42 recorded sequence edges/typing; adb28600 guard recorded terminal recovery (settled provenance, strong effects); merges.
- Symbol checks on dev (t758 trees):
  - Long-path SQLite open: present in another form. `path.toNamespacedPath` at Core packages/fluxiq/src/programs/database-manager/storage/sqlite-repository.ts:125, automation-studio/storage/project/database.ts:362, framework/storage-migration.ts:401 (comment "(t568)"). Superseded by t568; e60bfbe0 not needed.
  - Settled recording boundary / terminal signer: `closed_settled` has zero matches in Core packages; `runtime/recording-boundary/` and `model/recording-boundary/` directories do not exist. Missing.
  - Passive-fact projection, producer-clock linking, complete packed control proofs: greps for `closed_settled|passive-facts|passiveFact|producerClock|producer_clock` over downstream apps/domain returned no source files. Missing.
- Recommendation: leave (do not merge). All of its pieces serve recorded-Flow replay routing ("recorded recovery state routing", terminal signer for recorded effects), which the plan says is retired (adaptation-and-breadth-plan.md:22, :26: "no more standalone recording controls"; "extract any generic t518 fix only if independently needed"). No adaptation-gate site on instruction-led create-flow runs consumes recording boundaries or passive-fact signing. Only generic piece, the long-path SQLite fix, already landed as t568. If the branches are to be cleaned up, abandon via `pnpm task abandon` (it refuses if commits never reached dev, so the supervisor must decide to discard). I found no gate site that needs t518.

## W5 (automation-project-agents-plan.md:470-480) -- answered from code in the t758 tree
- Live `diagnose`/`repair`/`adapt` on `lab run` are deliberately not launchable: `packages/test-runner/src/live-llm/live-llm-plan.ts:244-246` (`assertLiveLlmLaunchable`) throws `recording.contract` with `automation.instruction_led_authoring_required` and names the replacement command (`create-flow --instruction-task <task> ... --replays 1`, then `lab replay`). Commit 380be235 "retire live diagnose, repair and adapt; drop the dead recorded-Flow checks". So W5's "give them an instruction-led launch" was resolved by retirement, with the repair done inside the create-flow run.
- The listed dead items are gone: `flowLaneExclusion` and `discardWindowUntil` appear in test-runner src only as negative assertions (`run-evaluation/tests/runner-wiring.test.ts:220,358`); `bench/run-bench.ts` has no `flow: true`. I did not re-check testing-facility.md:2521 text (line 1352 now describes bare `--flow` refusing).
- create-flow with `--replays` still runs the repair lane when the variant is armed after build: `run-scenario.ts:293-296` (`unarmedBuild = moment === "build" && creation?.task.variantArmedAfterBuild === true`, so the build is explored unarmed and the playback meets the variant); `run-scenario.ts:405-436` runs `runCreatedFlowLane` and on judged failure calls `proveRepair(... "instruction", laneFailure)` (defined at run-scenario.ts:350, calling `runLiveRepairLane` with `replays: options.replays`); `flow-lane/repair/run-repair-lane.ts:139` proceeds only if `replays !== undefined && live.repairsFlow`; `live-llm/live-llm-run.ts:261-262,275-277` makes `repairsFlow` true for create-flow via `CREATED_FLOW_REPAIR_PURPOSE` (`explore_and_adapt`). `commands.ts:316-320` requires `--llm-task create-flow` for `--replays`. Static reading only; no run executed.

## Not verified
Did not run any tests or typechecks; did not diff t518 symbol-by-symbol against dev beyond the greps above (greps may miss renamed equivalents); did not read testing-facility.md:2521; remote branches not queried (only local refs); did not confirm whether dev has any other, differently named, settled-boundary mechanism.

## Open questions
- Whether the user wants the t518 branches/worktrees abandoned now or kept as archive (plan line 22 says "preserved separately").
