> Historical interrupted report. Superseded by `../../data-first-simplification-plan/reports/t976-permission.md` and the paired execution ledger.

# t976: one permission question per chat, never mid-build (F21)

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t976/!FluxIQ`, with the extension worktree beside it. Nothing is committed.

## Outcome

**Partial.** The fix is built in Core and in the Lab's person, and its own tests pass. But it adds one model call (the instruction read) at the start of every first attempt. That breaks about 35 existing answer-first tests whose scripts, request counts or tight test purses assumed no such call. Those tests need migrating, or the read needs paying for differently. That is a decision for the lead (see Open questions, item 1). The worktree is left with those failures in it.

## Why run 22 asked mid-build, and asked again

Run `run-mwounh32-24f9bc6b` (lab-runs/2026-11-20, social-network-feed delete-stranger-requests): step 0184, the first real Delete press (`call.delete.diego.1`, 85 decide steps in), holds a 1,025 ms `permission` span. No other step in the run waits on permission.

1. **Asked at the press.**
   - `runtime/flow-authoring/bootstrap/action-permissions.ts` `asking()` wraps every check the domain makes before a press.
   - The first press whose declared class the gate does not hold raises a request (`runtime/action-permission-requests/gate.ts` `checkFor`). It is asked at once through `runtime/parking/permission-ask.ts`.
   - The instruction's own `delete` never permits it: under the 2026-09-30 rule, money, delete and send always need a person.
2. **Asked again on the next attempt.**
   - Each answer-first attempt builds a fresh gate (`answer-first/attempt/run-attempt.ts`, `opened`).
   - That gate is seeded only from the request's `permittedConsequences`, which the chat sends empty.
   - A grant lived only in the gate's memory, so attempt 2's saved-Flow pre-run check (`answer-first/flow-run/permission.ts`, `planStep`) asked again.

## What changed and why

### Core

**`runtime/action-permission-requests/task-start.ts` (new): the task-start question**
- An ordinary permission request: same schema, parses with `parseAutomationStudioActionPermissionRequest`.
- Action is Core's own: `core.task_start` / `task.start`, kind `flow_step`, verb `do`. No control.
- Sentence uses Core's class phrases: "To do this task, FluxIQ needs to delete or remove something. Your answer holds for this whole chat, including when the task runs again."

**`runtime/action-permission-requests/gate.ts`**
- `raiseForTaskStart(classes)`: raises that request.
- `holdAnswer({granted, declined, requestId})`: takes the chat's answer.
- A "no" to a task-start question refuses the class on every control, unasked, `declined: true`, carrying the answered request.
- New getters `permittedClasses` and `declinedTaskClasses`.

**`runtime/flow-authoring/bootstrap/start-asking.ts` (new)**
- `start` hands over the held answer. It then takes the classes the chat kept, or makes the build's one instruction read, and puts the one question.
- Asking closes at the first `executeTool` call (`acting`) or at `close`.
- Once closed, a refused gated class is not asked about. The domain gets `requestId: null` ("nobody_to_ask"), the class goes to `unforeseen`, and a plain line is said once.
- Every answer goes to `heard`. A "no" heard during the start is held for the whole class.

**`runtime/flow-authoring/bootstrap/action-permissions.ts`**
- Wires that module in through `askAtStart` / `closeAsking`, with new optional inputs `heard` and `unforeseen`.
- A caller that never calls `askAtStart` (legacy, candidate and project builds) asks as before.
- The existing "unanswered act" line moved, unchanged, to `unanswered-said.ts`, to keep the file under the 800-line limit (it is now 774).
- New `unforeseen-said.ts`. The barrel exports all three new files.

**`answer-first/chat-permission/` (new: `chat.ts`, `instruction-key.ts`, `store.ts`, `store-of.ts`, `ground.ts`, `start.ts`, `index.ts`)**
- The chat's answer, kept beside the Flow in `chat-permission.json` (in memory when there is no data root).
- It holds granted classes, declined classes with their request id, and the classes each instruction needs, keyed by a sha256 of the folded words (never the words themselves).
- `ground.ts` writes answers and unforeseen classes as they happen.
- `start.ts` runs the start step.

**`answer-first/attempt/run-attempt.ts`**
- The gate gets the chat ground.
- `stagedThenRounds` runs the start step, then the flow stage, then `closeAsking()`, then the rounds.
- No question on a carried-on attempt.
- No read when a saved Flow runs first (`route.kind === "use"`): the Flow's own pre-run check names its classes with no model call. That check still counts as the start of a Flow.

**Test updates**
- `attempt/tests/caller-seams.test.ts`: the read now names the send act, so the question is asked at the start.
- `attempt/tests/caller-replay.test.ts`: purse widened to 0.21, with the reason written in the test.

### Lab (extension, `packages/test-runner`): needed, or the Lab's person would refuse every start question

Before, the Lab's person granted only when Core named the task's control. The start question names no control.

- `flow-lane/creation/permission-point.ts`:
  - `permissionQuestionOf` reads `taskStart` from `permissionRequest.action.id`.
  - The judgement gives `at_declared_point / control: "task"` when the question asks for exactly the task's declared class.
  - It gives `elsewhere / other_classes` when the question asks for that class plus any other.
- `person-simulation/asks.ts` and `permission-answer.ts`: carry `taskStart` and grant on `"task"`.
- `flow-lane/creation/lane.ts` and `run-evaluation/permission-stop/permission-stop-invariant.ts`: count or word `"task"`.
- New cases in `flow-lane/creation/tests/permission-point.test.ts` and `person-simulation/tests/simulation.test.ts`.
- The person still answers in the chat or through `answer-ask`, as today.

### What I chose for a class nobody foresaw (brief item 3)

Once asking has closed, a gated class the start did not cover is handled like this:
- It is refused unasked. The domain is told `requestId: null`, and the model routes around it as after any refusal.
- It is recorded in the chat's needs for that instruction.
- The thread gets one plain line naming it and saying the person will be asked when the task starts again.
- The next attempt (or Run again) includes it in its one question at the start.

Why this choice:
- The rule allows asking only when a Flow or chat starts.
- Granting without asking would break the 2026-09-30 rule.
- Ending the task would break the rule that a task ends only on its result or its budget.

The cost: an attempt whose read missed the class cannot do that act until the next attempt.

## Commands run and observed results

Everything ran through `cd C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots && node heavy-slot.mjs run t976-<step> -- …`, with Core vitest run from `packages/fluxiq` as `node ../../node_modules/vitest/vitest.mjs run …`.

**Type check and structure audits**
- `node <core>/node_modules/typescript/bin/tsc -p <scratch tsconfig.t976.json>`: a targeted check over 16 changed Core files (sources and tests) and their import graph. No output, exit 0.
- `node scripts/structure-audit.mjs` in Core: `structure-audit: passed (563 warning(s), 909 baselined)`. An earlier run failed on 4 violations I had introduced (file-lines, failure-as-empty, swallowed-failure, statement-packing); all four are fixed.
- `node scripts/structure-audit.mjs` in the extension: `structure-audit: passed (256 warning(s), 551 baselined)`.

**Targeted Core tests: 9 files, 109 tests passed**
- `task-start.test.ts`, `gate.test.ts`, `action-permissions-task-start.test.ts`, `action-permissions.test.ts`, `action-permissions-witness-notes.test.ts`
- `chat-permission/tests/one-question-per-chat.test.ts`, which covers:
  - one ask across 3 attempts, none mid-build
  - a held "no"
  - an unforeseen class asked at the next start
  - a carried-on attempt asks nothing
- `caller-seams.test.ts`, `caller-replay.test.ts`, `project-build-permissions.test.ts`

**Whole answer-first directory (153 files, 4 batches)**

| Batch | Files | Tests | Notes |
| --- | --- | --- | --- |
| 0 | 40 passed | 207 passed | after the two test updates |
| 1 | 39 passed, 1 failed | 4 failed, 247 passed | the failing file is pre-existing; see Open questions, item 2 |
| 2 | 36 passed, 4 failed | 10 failed, 357 passed | caused by this change |
| 3 | not recorded | 22 failed, 206 passed | caused by this change |

Batches 2 and 3 ran before the final refactor; the refactor did not change their behaviour.

The batch 2 and 3 failures are in:
- `tests/attempt.test.ts` (a), (d)
- `tests/carry-on.test.ts`: 6 tests
- `tests/acts-with-no-row.test.ts`
- `result-feed/tests/service.test.ts`
- `tests/interrupted.test.ts`
- `tests/reachable.test.ts`: 4 tests
- `tests/second-attempt-proof.test.ts`: 2 tests
- `tests/skipped-rows.test.ts`: 2 tests
- `tests/endings/tests/{balance-at-judge,budget,judge,person,saved-on-every-ending,stalls}.test.ts`

All of them fall into three causes:
1. **Old behaviour pinned.** Scripts expect the old mid-build permission ask and throw "The attempt never asked". Their harness answers the instruction read with nothing instructed, so no start question is asked and the press is refused unasked.
2. **Request counts.** Exact counts of model requests, or the first request taken as a decision, are off by one: the read.
3. **Tight purses.** Tests that price every call at $0.04 against $0.09–$0.12 lose a call to the read. The read's $0.04 projection also puts decision 1 into the wrap-up, which withholds tools. Before, decision 1 had no projection at all (`runtime/llm/loop-budget.ts` `worstCase`, `purse.lastProjectedCostUsd`).

**Lab tests**
- The scratch compile showed no type errors in any touched Lab file.
- `node --test` on the 3 compiled Lab tests: all 3 failed to load with `ERR_MODULE_NOT_FOUND` for `@fluxiq-web-extension/test-contracts/dist` and `@fluxiq-web-extension/domain/dist`. Those sibling packages are not built in this worktree. **So the Lab tests did not run.** The scratch build and tsconfig were removed afterwards.

## Not verified

- **No live run.** Not verified:
  - the start question in the real extension chat
  - the Lab answering it there
  - the real instruction read naming `delete` for these words
  - that delete-stranger-requests declares a `permissionPoint` with class `delete` (without one, the Lab refuses every permission ask; run 22's Delete went through, so it probably does)
- **Lab test-runner tests** did not run: sibling packages are not built.
- **The ~35 answer-first regressions** are not fixed.
- No full suite and no package typechecks were run (user rule).
- **Extension UI:** unchanged. The chat card shows the ask's own sentence with Allow / Don't allow (`ui-components/src/chat/conversation/ask-copy.ts`), so no extension UI tests were run.

## Open questions or contradictions found

### 1. Decision for the lead: how the start read is paid for

The fix needs the instruction's classes before anything acts. Today the only source is the build's instruction read. The chat's declared intent (t973) is only task or conversation, and extending it means editing `runtime/conversations/instructions/**`, which this brief excludes.

Options, in the order I recommend:

- **(a) Keep the read and migrate the ~35 tests** to the new behaviour:
  - harness reads that name the gated class
  - start-question expectations instead of mid-build asks
  - request counts that ignore `metadata.source === "instructionAuthority"`, as several tests already do
  - widened tight purses

  This is mechanical work for a worker, with the cause categories above as its brief.
- **(b) Also, or instead, stop counting a non-decision call's projection** as the next decision's worst case (`runtime/agents/budget/purse.ts` `lastProjectedCostUsd`, read in `runtime/llm/evidence-loop.ts`). This is a shared-runtime change: it fixes cause 3 in all loops, not only answer-first.
- **(c) Have the chat's interpretation declare the act classes** alongside its intent. That makes the read unnecessary for chat attempts, but needs the instructions owner to coordinate.

**Production cost of the read:** one small call per new instruction in a chat. Later attempts at the same words, and every saved-Flow replay, make none. In production a read's projected cost is far below a real purse, so I expect no wrap-up effect, but that is not measured.

### 2. Pre-existing, not caused by this change

`answer-first/flow-run/tests/steps-ran-interruption.test.ts`: 4 tests expect a replay that met a cleared check to not stand.
- Commit `4aba908a7` (t972, "a replay that met a cleared check can stand") changed that rule.
- The test imports only `replayStands` and `stepsRan`, neither of which I touched.
- It lives in `flow-run/**` (t974/t975 territory), so I left it.

### 3. Mid-Flow asks that remain, outside this brief

- `runtime/adaptation/recovery/runtime-exploration.ts`: a runtime repair of a failed Flow run still asks at a press.
- Legacy, candidate and project builds still ask at the press.
- `runtime/result-verification/**` was off-limits.
