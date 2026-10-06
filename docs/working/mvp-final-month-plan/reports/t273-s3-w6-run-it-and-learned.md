# t273-s3-w6-run-it-and-learned: worker report

Worker: t273-s3-w6 (worker). Date: 2026-10-05. Tree: Core `fxwork/t273/!FluxIQ` (R = `packages/fluxiq/src/programs/automation-studio/runtime`, A = `.../automation-studio/api`). Brief: `t273-creation-wiring.md`, S3, "Brief: t273-s3-w6-run-it-and-learned".

## Outcome

Done. Items (1) to (4) are implemented, with tests that failed first. The tests in the brief's definition of done pass, `fluxiq:check` exits 0, and the structure audit passes. One deviation from the brief: the wording that says what a run learned is inlined in `run-flow.ts` instead of going into a new module. `commands/` is at its 25-file limit, and a new file there failed the structure audit (details below).

## What changed and why

Directories in the paths below: A/handlers = `api/handlers`, R/commands = `R/conversations/commands`.

1. **Billing (C2 for the chat's run).**
   - `R/commands/command.ts`: `AutomationStudioConversationCommandContext` gains a required `paired: boolean`.
   - `A/handlers/conversations.ts` `commandContext` sets `paired` from `caller.paired`.
   - `A/handlers/runtime-execution.ts` now removes `resultCheckCallerPays` from the payload before the payload is spread. Any value other than `"repair_checks"` is refused with "A run can only ask to pay for the result checks that judge a repair.", and nothing runs. The value applies only when `llmExecution` is set; the paired rule or the request, either one, gives `repair_checks`.
   - **A pre-existing leak, now closed.** Before this change, the field went into `service.runRuntimeSession` through the `...payload` spread. Any caller could pass any value, including `"every_run"`, even with no model intent.
   - Test context builders now carry `paired`: `R/commands/tests/execute.test.ts` (false) and `extension-chat.test.ts` (true).
2. **`R/commands/run-flow.ts` request.** The run is asked for with `runIntent: "explore_and_adapt"`, plus `resultCheckCallerPays: "repair_checks"` when `context.paired` is true.
3. **What the run learned.**
   - **When it runs.** The run must have ended `succeeded` (not `failed` or `cancelled`) and `createdAdaptationIds` must be non-empty. Each id is then read through `get-flow-adaptation`.
   - **What it says.** It names each change from fixed word tables in `run-flow.ts`, keyed by `patch[].kind`, or by `appliedTo[].kind` when no patch kind is known. An unknown kind is skipped. The lookup uses an own-property check, so a stored kind such as `constructor` cannot match an inherited key. Duplicate changes are said once.
   - **Applied or pending.** A change counts as applied when its stored `status` is `"applied"`. The thread then says "The next run starts with it." Otherwise it says the change waits for the person's review.
   - **A change that cannot be read** is called "it changed how it runs", and the run's `durableBehaviorChanged` decides whether it is described as applied.
   - **Today's wording is kept** when there are no changes.
   - The thread never quotes `diagnosis`, `summary`, page text, `targetId` or selectors. A test checks this with planted strings.
   - Example, one change: "The run run.7 ended succeeded. It learned something from this run: it now finds the control it presses a different way. The next run starts with it."
   - Example, several changes: "It learned 2 things from this run. It now finds …, and the next run starts with it. It changed what it waits to see after a step, which waits for your review before a run uses it."
4. **Stale result-check code on a re-run.**
   - `R/result-verification/run-outcome.ts`: the `rerunRepairedFlow` result type gains an optional `resultCheck`. Both re-run call sites now verify with `resultCheck: rerun.resultCheck ?? input.resultCheck`. The line count is unchanged at 796.
   - `R/service.ts` ~2545 returns the check it re-decided (`runResultCheck`) as `resultCheck` on the same line. The file stays at 4399 lines, which is its ratchet.

## Commands run and observed results

All runs were from `packages/fluxiq`. Line endings were checked with `file` on every changed file: all are CRLF.

1. **Fail-first, before any source edit.**
   - Command: `npx vitest run` on six files: `run-flow.test.ts` (new), `runtime-execution.test.ts`, `conversations.test.ts`, `run-outcome-repair.test.ts`, `caller-paid-result-check.test.ts` and `caller-paid-reauthor-check.test.ts`.
   - Result: `Test Files 6 failed (6)`, `Tests 13 failed | 37 passed (50)`.
   - The failures that matter:
     - `run-flow`: the payload had no `runIntent` and no caller-pays flag. The summary stayed "The run run.7 ended succeeded." where the learned sentence was expected.
     - Handler: `every_run` was answered `{ ok: true … }`. A run with no intent passed `resultCheckCallerPays` through.
     - `conversations`: both run payloads lacked `runIntent` and the flag.
     - `run-outcome-repair`: the recorded `resultCheck` kept the run's original code.
     - `caller-paid-reauthor-check`: the code was `initial_window`, where `after_repair` was expected.
     - The chat-run repair case: no `runtime_patch` call was made with a caller, because the run had no intent.
   - Two new cases passed before the change, and why:
     - "makes no routine result-check call on the person's key": with no intent, the old run asked no model at all. The companion repair case is the one that proves the intent arrives.
     - "lets a person's own session ask to pay only for repair checks": the old spread leaked the field through, as described in item 1.
2. **After the change**, the same six files: `Test Files 6 passed (6)`, `Tests 50 passed (50)`.
3. **First structure audit:** `node scripts/build-cache/cli.mjs structure-audit:check`, run from the Core root.
   - Result: `FAIL [directory-files] .../runtime/conversations/commands/: 26 source files exceeds the 25-file limit`, from my new `run-learned.ts`.
   - Fix: the module is inlined into `run-flow.ts` as private functions, and the file is deleted.
   - The rerun printed `structure-audit: passed (258 warning(s), 349 baselined)` and exited 0.
4. **`pnpm check` (fluxiq:check)**, final state: exit 0.
5. **Final suites:** `npx vitest run` on `R/conversations`, `A/handlers`, `R/result-verification`, `R/tests/service-adaptation` and also `R/tests/refuted-result`.
   - Result: `Test Files 95 passed (95)`, `Tests 709 passed (709)`.
   - This ran while w4 and w5 had uncommitted edits in `R/llm/**` and `R/flow-draft/**`. Nothing failed because of them.

## Not verified

- **Live behaviour.** There was no Lab, browser or provider run. The billing claim rests on the service-level test `caller-paid-result-check.test.ts`, "the chat's Run it, asked from a paired extension". It covers the real registry, real handlers and real service, with the command port built the way `commandContext` builds it.
- **The `paired` wiring end to end.** It is covered at the handler level in `conversations.test.ts`: a paired actor's chat "run it" reaches the endpoint as `session.unlocked` with `repair_checks`. No test goes from a paired actor through the real service run.
- **The applied/pending reading is taken from each adaptation's `status`.** The brief tied it to `durableBehaviorChanged`, which I use only as the fallback for a change that cannot be read. I chose this because the run's flag is run-wide and cannot tell, in a run with several changes, which one was applied.
  - Both readings come from the same apply. The judged promotion applies through `reviewFlowAdaptation` `apply`, which sets `status: "applied"`.
  - A live run did not confirm that the status is already `applied` when `run-runtime-session` answers.
- **Re-author changes.** A re-author (a Flow Bootstrap adaptation) does not appear to be listed in the run detail's `adaptationIds` (`service/runtime-adaptation/repair-rerun.ts` uses `adaptationIds: []` for a re-authored candidate). If that reading is right, the chat says nothing learned after a run whose only change was a re-author. The brief's example sentence, "it re-wrote the steps that read the results", is not produced by any path here. I did not confirm this further.

## Open questions or contradictions found

1. **Module placement.** The brief asked for "one focused new module beside run-flow.ts". The audit's 25-file directory limit forbids that. Options for the lead:
   - leave the wording inlined (current state, `run-flow.ts` at 132 lines);
   - or move it into a `commands/run/` subdirectory, which also means editing `catalog.ts`, outside my ownership.
2. **Behaviour change for web-panel chats.** A chat run from a person's own (non-paired) session used to run with no model. It now runs with `explore_and_adapt` on that person's key, and the person's key pays for every result check, as for any explicit person-session run. That is what the brief specified, and it matches the handler's existing rule for a person's own session; flagging it because it is a cost change for web-panel chats.
3. **Stale generated docs.** `packages/fluxiq/docs/reference/framework-reference.md:140` (and the root `docs/reference` copy) cites `run-flow.ts:18` for `AUTOMATION_STUDIO_CONVERSATION_RUN_FLOW`. The constant is now at line 31. This file is generated, so I did not regenerate it.
4. **No item-23 docs updated.** Architecture docs describing MVP item 23 or the chat's run were not updated; they are outside my ownership.
