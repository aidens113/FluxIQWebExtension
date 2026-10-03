# t194-w62: record why each build round stopped

## Outcome

Done. The build's ending now records why each round stopped and, for a not-doable ending, which no-route case ended it. Both are closed words. The re-author attempt on the run now carries the ending's closed facts. Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`. Nothing is committed.

**One file is outside the owned paths:** `flow-bootstrap/generation-failure/build-ending.ts` and its test. The ending's `tried` type and its exact-key parser live there. The brief asked for the no-route kind on "the not-doable ending's `tried`", and that cannot be done without this file. Without the parser change, the diagnostic parser rejects the whole ending. The failure then falls back to a pre-provider code, which the failing-first port test showed. The file is not on the must-not-touch list, and git status showed no other worker editing it.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

| File | Change |
| --- | --- |
| `flow-bootstrap/generation-failure/build-ending.ts` | `tried` gains two optional members. `stops?: Array<{ round, stopped }>` uses the new closed type `AutomationStudioFlowBootstrapRoundStopped`: `iterations`, `tool_calls`, `unusable_decisions`, `repeat_without_progress`, `judged_wrong` or `budget`. `noRoute?: { kind: "no_progress" \| "repeated_unchanged" }` is allowed on `not_doable` only. The parser accepts both with exact keys. It caps `stops` at `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ROUNDS`, reading it at parse time so the import cycle is safe. Any other word or any extra key is refused. Both are optional, so older records still parse. |
| `flow-bootstrap/unfinished-build/tried.ts` (new, exported from the barrel) | `automationStudioFlowBootstrapTried` builds `tried` once for all four endings: rounds, decisions, stepsInFlow, tested, `stops` when there are any, and `noRoute: { kind }`. The no-route `before` judgement is never copied. |
| `flow-bootstrap/unfinished-build/phases.ts` | A `stops` list gets `{ round, stopped }` pushed for every round that reaches phase 2. It is passed through `told` to every ending. Previously the stop lived only in locals at :318 and :337. |
| `not-doable.ts`, `budget-exhausted.ts`, `replies-unreadable.ts`, `provider-unavailable.ts` | Each accepts an optional `stops` and builds `tried` through `tried.ts`. `not-doable.ts` already received `noRoute`, which now also reaches `tried.noRoute`. |
| `recovery/refuted-result/reauthor.ts` | `AutomationStudioRefutedResultFailure` gains `ending?: JsonObject`. The attempt builder copies it onto `attempts[]`. |
| `service/runtime-adaptation/reauthor-build.ts` | `automationStudioRefutedResultFailureOf` now carries `diagnostic.ending` through `closedEnding`. It keeps `kind`, `bound`, `notDone[].{id, todo}` and `tried` (with `stops` and `noRoute`). It drops `message` and each `quote`, which hold the person's words. |
| Tests | `unfinished-build/tests/repair-rounds.test.ts` gains a describe block "each round's stop, recorded on the ending" with 3 tests: a repeat_without_progress round with `repeated_unchanged`, judged_wrong rounds with `no_progress`, and a bound ending with no `noRoute`. `generation-failure/tests/build-ending.test.ts` gains 1 test: round-trip, refusal of unknown words and keys, the cap, and `noRoute` refused on a budget ending. `service/runtime-adaptation/tests/refuted-result-port.test.ts` gains 1 test: a not-doable re-author records the closed ending on the attempt, and the run JSON does not contain the quoted words. |

## Sample of the recorded shape

This is what `metadata.resultReauthor.attempts[n].ending` looks like, from the port test:

```json
{
  "kind": "not_doable",
  "notDone": [{ "id": "a2", "todo": "no_step_added" }],
  "tried": {
    "rounds": 2, "decisions": 13, "stepsInFlow": 2, "tested": "replayed_clean",
    "stops": [{ "round": 0, "stopped": "iterations" }, { "round": 1, "stopped": "repeat_without_progress" }],
    "noRoute": { "kind": "repeated_unchanged" }
  }
}
```

A budget ending has the same shape with `"kind": "budget_exhausted"` and `"bound": "rounds"` (or `cost`, `tokens` and so on), and no `noRoute`. No member name ends in `reason`, `message` or `label`, so the Lab's `publishableTree` keeps all of it.

## Commands run and observed results

- Failing first, before the implementation: `npx vitest run .../unfinished-build/tests/repair-rounds.test.ts` gave `3 failed | 12 passed`. `npx vitest run .../build-ending.test.ts .../refuted-result-port.test.ts` gave `2 failed | 23 passed`. The port test's attempt code was not `flow_bootstrap.not_doable`, because the parser rejected the ending.
- After the change: those files plus `recovery/refuted-result` gave `Tests 62 passed (62)` and `21 passed (21)`. After the backup restore below, a rerun of the 4 touched test files gave `4 passed (4)` files and `58 passed (58)` tests.
- I ran `heavy.sh "t194-w62 vitest" npx vitest run R/flow-bootstrap R/service/runtime-adaptation R/recovery` plus 6 service-level tests that pin `tried`: answerability, exploration, plan-parameters, provider-unavailable, unfinished-build and unreadable-replies. The result was `Test Files 1 failed | 114 passed (115)` and `Tests 2 failed | 1613 passed (1615)`. Both failures are in `service/runtime-adaptation/tests/repair-rerun.test.ts` ("a repaired re-run of an optional press whose target is gone"). They expect node ids `[search, check, check, check, join, read]` and receive `[search, check, join, read]`.
  - **These failures were already there.** I copied my 13 files to scratch, restored them to HEAD and deleted `tried.ts`. The same 2 tests still failed (`2 failed | 5 passed`). I then restored my files, confirmed 13 changed paths, and reran my tests (above). The test has no reference to ending, re-author or not_doable. It covers executor/route retry behaviour, which comes from HEAD or from other workers' uncommitted changes in this tree.
- `heavy.sh "t194-w62 pnpm check" pnpm check` in packages/fluxiq: rc 0 (`tsc --noEmit`, build-cache step `fluxiq:check`).
- `node scripts/structure-audit.mjs` at the Core root: rc 0, `structure-audit: passed (218 warning(s), 349 baselined)`. My files appear in only one warning: `phases.ts` has 530 lines against the 400-line advisory. It was already about 527 lines before; my change added 3.

## Not verified

- No live run and no Lab run. I did not check that the Lab's decision-trace output for a real run now shows `ending.tried.stops`. That rests on w60's guard test.
- A build that finishes after a round stopped short records no stops. Only an ending carries them, and a finished build has no failure attempt.
- The first build's adaptation record (as opposed to a re-author) carries `stops` only through its diagnostic's `ending`. I did not trace the downstream readers of that diagnostic.

## Open questions or contradictions found

- The brief named the ending's `tried` as the place to record this, but its type and parser are in `generation-failure/build-ending.ts`, which the brief did not list as owned. I edited it; the supervisor should accept that or reassign it.
- `repair-rerun.test.ts` fails 2 tests on this tree without my change. Its owner (executor/route-state lane, or the uncommitted llm/result-verification changes) should check it.

## Commit message (for the supervisor)

```
Core: record why each build round stopped and which no-route case ended it, and carry the ending onto the re-author attempt (t194-w62)

The ending's `tried` gains `stops: [{ round, stopped }]` (closed words:
iterations, tool_calls, unusable_decisions, repeat_without_progress,
judged_wrong, budget) and, on not_doable, `noRoute: { kind }`
(no_progress | repeated_unchanged). phases.ts collects them for every
round; all four endings build `tried` through unfinished-build/tried.ts;
build-ending.ts parses both, optional and bounded by the round backstop.
reauthor-build.ts no longer drops the build's ending: the re-author
attempt records its closed facts (kind, bound, notDone ids and codes,
tried), never its message or the person's quoted words. Live run
muqk713g, Stage 6.

Task: t194
Worker: t194-w62

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```
