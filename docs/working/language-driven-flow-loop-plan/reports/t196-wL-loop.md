# t196-wL: no digest capture of its own, free answers from memory, and looks withdrawn after an ignored redirect

Worker wL, 2026-09-30.

- Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t196/!FluxIQ`, branch `task/t196-state-digest-cost`.
- Base: `f0dbbd6` plus the lead's uncommitted contract edits (`stateDigests` and `stateDigestsOnCalls`).
- R = `packages/fluxiq/src/programs/automation-studio/runtime`.
- Nothing was committed and the Core dist was not rebuilt.

## Outcome

**Done.** All four parts are implemented. The llm, flow-bootstrap, recovery and service suites pass, `tsc` is
clean, and the structure audit passes.

- **Digests.** When the service gets a `stateDigestsOnCalls` binding, it passes no digest hook. The loop then reads
  each call's before and after digests off `execution.stateDigests` and never takes a digest capture of its own.
  Other bindings keep the hook exactly as it works today.
- **Answers from memory.** An answer from memory never takes a capture. The first time a look is asked again in the
  same epoch, the loop runs it for real once and compares the digests. Every later ask in that epoch is answered from
  memory.
- **Ignored redirects.** If the model ignores a redirect, looks are withdrawn until an action runs:
  - The snapshot node is removed from `core.run_node`'s `node` enum.
  - Observe-only tools are no longer offered.
  - A withdrawn look asked for anyway is refused as `llm_evidence_loop.look_withdrawn`.
- **run-munneauy, rebuilt.**
  - Looks are withdrawn at decision 12, and decisions 12–15 are refused rather than answered.
  - The build ends at decision 15 instead of 18, with the same `repeat_without_progress`.
  - It makes 0 digest-hook calls, against 28 before.

## What changed and why

### 1. The loop reads digests off the call (`R/llm/evidence-loop.ts`, `R/service/flow-bootstrap-commands/state-digest.ts`)

- **`statesOf`.** When the loop was given a hook, a call's states come from the hook, taken before and after as
  today. Without a hook, they are `execution.stateDigests.before/after`. The two sources are never mixed, so no
  point in a step is digested twice.
  - This covers the free first look, every ordinary call, and reruns, which go through the ordinary call path.
  - A call that throws still gets only the hook's before-digest, as today.
- **Service hook.** `automationStudioBootstrapStateDigestHook` returns `undefined` when
  `binding.stateDigestsOnCalls === true`. The service wiring in `R/runtime/service.ts` passes `captureStateDigest`
  only when a hook exists, so that wiring needed no edit and `service.ts` was not touched.
- **`callStates`.** A new map on the handler context records the after-digest of every call that has one, including
  the initial look. The answer check compares against it.
  - This is needed because the initial look's draft step never recorded `stateAfter`.
- **Documentation.** `loop-configuration.ts` now documents the rule on `captureStateDigest`.

### 2. An answer from memory costs no capture (`R/llm/decision-handlers/answer-check.ts`, rewritten)

- **The check takes no digest.** `automationStudioLlmEvidenceAnswerCheck` is synchronous and returns one of two
  things:
  - `{kind: "verify", answeredByCallId, stateAfter}`: the first re-ask of a request signature, where the answering
    call was a look (`effect: "observe"`) with a recorded after-digest. The signature is added to `reaskedRequests`,
    which was renamed from `pageMovedReruns`.
  - `{kind: "answer"}`: every other case, with no capture.
- **The loop then runs the call for real.** A `stateDigestsOnCalls` binding costs the look's own one capture here.
  `automationStudioLlmEvidenceReaskOutcome` compares the new after-digest with the answering call's:
  - **Same digest: a verified repeat.** It counts as a step without progress, whatever the bytes were.
    `automationStudioLlmEvidenceShowVerifiedRepeat` removes the answering entry from the evidence, since the fresh
    result replaces it. It then pushes a `core.request_check` note with the new code
    `llm_evidence_loop.looked_again_unchanged`, `pageUnchanged: true`, `timesAsked`/`askedAt`, and the instruction
    "Core looked again just now and the page is exactly as before…".
  - **Different digest: the page moved by itself.** This is progress, unless the look refused itself.
  - **Refused, or no digest reported.** The call is judged like any other call.
- **Later asks.** The next and every later ask of that request in that epoch finds the signature in
  `reaskedRequests`. It is answered from memory with no capture.
- **No digest to compare.** If the answering call recorded no after-digest, the ask is answered from memory as
  before.
- **Handler parameter removed.** The answered-request handler lost its `pageUnchanged` parameter. It was never true
  any more, because Core no longer looks at answer time.

### 3. An ignored redirect withdraws looks (`R/llm/decision-handlers/look-withdrawal.ts`, new)

- **Trigger.** The no-progress `show` callback calls `redirectShown(iteration)`, and only for a redirect that was
  actually shown. A decision that asks again for what the loop holds then calls
  `automationStudioLlmEvidenceAskedAgain` before its own redirect. Two kinds of decision count:
  - an answer from memory, in the answered handler;
  - a verified repeat, in the loop.

  If the redirect was shown at `iteration - 1`, looks are withdrawn for the current `attemptEpoch`. A
  `{kind: "redirect", code: "llm_evidence_loop.looks_withdrawn"}` row goes on the decision history, so the history
  entry's `redirects` lists the withdrawal.
- **What is offered.** `looks.offer()` runs inside `eligibleTools`, so the existing "nothing to offer and no
  completion" ending still applies. While looks are withdrawn:
  - Observe-only tools are dropped.
  - A tool with `actionInputKey` gets that input's `enum` narrowed to exclude the actions this build saw report
    `effect: "observe"` and `proposes: false`. Those actions are recorded from real calls and from the initial look.
  - If nothing is left in the enum, the tool is dropped.
  - A key with no enum is left as it is, because a library of more than 400 nodes is not enumerated. The backstop
    still covers that case.
- **`actionInputKey`.**
  - **Declared.** It is a new optional field on `AutomationStudioLlmEvidenceTool` (`evidence-loop/tool.ts`), and
    `run-node.ts` sets it to `"node"`.
  - **Carried through.** It passes through `scopedOption` (`harness-options/binding.ts`) and
    `automationStudioHarnessOptionTool` (`harness-options/option.ts`).
  - **Validated.** It must be an identifier-shaped key. Invalid keys are rejected in `validTools` (making the tool
    configuration invalid) and in option issues (`harness_option.action_input_key_invalid`).
  - **Never sent.** `offer()` strips it from every offered tool, always. The DeepSeek preflight rejects any tool key
    it does not know (`deepseek/preflight.ts:119`), so sending it would fail every build request.
- **Backstop.** A tool call that `looks.refuses()` is refused before the answered-from-memory check, so it is never
  answered and never run. Reruns requested through `amend_draft` are exempt.
  - The refusal goes through the unusable-decision path, which was factored into a `refuseDecision` closure shared
    with the catch block.
  - The issue code is `llm_evidence_loop.look_withdrawn`. The feedback adds: "Looking is withdrawn … Looks return
    once an action runs: run an action the instruction needs, amend the draft, or complete." This text is added only
    when that code is present, so all other feedback is unchanged.
  - The decision's usage is kept on the row.
  - The issue set is registered first, so each withdrawn look counts as one more step of the current no-progress run.
    Without that, the unusable path's `restarted()` would reset the count to 1.
  - The withdrawn look that reaches the no-progress guard ends the loop as
    `llm_evidence_loop.repeat_without_progress`. It does not call `unusableDecisions.stalled`, which is the service's
    unusable-decision failure and incomplete-draft keeper.
- **Redirect text** (`evidence-loop/stall-redirect.ts`). Every no-progress redirect now says "Asking again for what
  you already hold withdraws looking until you run an action." While looks are withdrawn, it instead carries
  `looksWithdrawn: true` and says that looking is withdrawn and a look asked for will be refused.
- **Only loops that can refuse withdraw looks.** Withdrawal happens only when `unusableDecisions` is configured, as
  in builds. A loop without it could only end on a withdrawn look.
  - `lookWithdrawal: false` on the loop input turns withdrawal off. Only the recorded-run replay driver uses it.

### 4. Tests

- **`R/llm/decision-handlers/tests/state-digest-cost.test.ts` (new, 7 tests).** A scripted `core.run_node` build runs
  on a fake page in two modes:
  - `states_on_calls`: results carry `stateDigests` and there is no hook.
  - `digest_hook`: a legacy binding.

  The tests count `executeTool` and hook calls per decision type, cover the verified repeat, withdrawal and backstop,
  a page that moved by itself, and the run-munneauy rebuild. The file was placed here because `llm/tests/` is at its
  25-file audit limit. `decision-context-wiring.test.ts` beside it already drives the loop the same way.
- **`R/service/flow-bootstrap-commands/tests/state-digest.test.ts` (new, 2 tests).**
  - Without the flag, the hook tracks before and after sides.
  - With `stateDigestsOnCalls`, the hook is `undefined`. A loop wired the way the service wires it then makes 0
    `captureStateDigest` calls across a free look, a look, a verified re-ask and an answered re-ask (3 `executeTool`
    calls).
- **`decision-handlers/tests/decision-context-wiring.test.ts`.** The three old answer-check tests (fresh-digest
  match, page moved, digest throws) were replaced by tests of the new behaviour:
  - A re-ask with a hook is run once more (hook calls `call.1, call.1, call.2, call.2`) and replaces the old
    evidence entry.
  - A moved page is an ordinary look with `pageState: "changed"`, and the next ask is answered with no digest.
  - A call with no recorded digest is answered from memory.
- **`decision-context/tests/recorded-runs.ts` and `recorded-windows.test.ts`.** The t189 replays of the older logs
  (bigbox-run6, crossborder, everything-store-run4) no longer pass a digest hook, and they pass
  `lookWithdrawal: false`. The model's later decisions in those logs were made under neither behaviour, so the
  replays reproduce the logs exactly again.
  - One expectation changed: the answered note no longer carries `pageUnchanged: true`, and the test now asserts it
    is absent.

### Per-decision cost (printed by `state-digest-cost.test.ts`)

| Decision | `executeTool`, states on calls | Hook, states on calls | `executeTool`, legacy hook | Hook, legacy hook |
| --- | --- | --- | --- | --- |
| free first look | 1 | 0 | 1 | 2 |
| action | 1 | 0 | 1 | 2 |
| look | 1 | 0 | 1 | 2 |
| first re-ask (run once more, same page) | 1 | 0 | 1 | 2 |
| later re-ask (answered from memory) | 0 | 0 | 0 | 0 |
| later re-ask, redirect shown after it | 0 | 0 | 0 | 0 |
| later re-ask ignoring that redirect | 0 | 0 | 0 | 0 |
| withdrawn look (refused) | 0 | 0 | 0 | 0 |
| action (looks return) | 1 | 0 | 1 | 2 |
| look again | 1 | 0 | 1 | 2 |

Before this change, every answer from memory made 1 hook call.

### run-munneauy-de8663ed: before and after

The rebuild uses the shape of `build.evidenceLoop.steps` in `snapshots/flow-lane.json` and the service's limits for
a 48-call grant.

| | Decisions | Provider calls | `executeTool` | Digest-hook calls | Answered from memory | Ended |
| --- | --- | --- | --- | --- | --- | --- |
| before (recorded; hook count derived from f0dbbd6 code) | 18 | 18 | 9 | 28 | 9 | `repeat_without_progress` |
| after, `stateDigestsOnCalls` binding | 15 | 15 | 9 | **0** | 3 | `repeat_without_progress` |
| after, legacy hook binding | 15 | 15 | 9 | 18 | 3 | `repeat_without_progress` |

- Decisions 0–7 run as recorded.
- 8, the first re-ask, is run once more and finds the page as it was (a verified repeat).
- 9–11 are answered from memory with nothing run and no digest taken.
- The redirect shown after 10 (the second answer from one result) is ignored at 11. The history shows
  `looks_withdrawn: [11]`.
- From 12, `core.run_node` is offered without `web.output.dom-capture_snapshot`. The looks scripted at 12–15 are
  refused as `look_withdrawn` and never answered.
- The fifteenth decision reaches the no-progress guard and the build ends `repeat_without_progress`. That is 3
  provider calls fewer than recorded.

In the old code, hook calls came to 2 × 9 calls run, plus 10 answer checks (decisions 8–17), which is 28. The capture
count seen in the side panel falls by the same 28 when the binding reports states on calls.

## Commands run and observed results

All commands used `heavy.sh`, from `packages/fluxiq` unless noted.

- **Baseline, before any edit:**
  `npx vitest run src/programs/automation-studio/runtime/llm --maxWorkers=2 --minWorkers=1` →
  `Test Files 68 passed (68)`, `Tests 651 passed (651)`.
- **After the edits, the same command:** `Test Files 69 passed (69)`, `Tests 658 passed (658)`.
  - This run had the new test in `llm/tests/`.
  - The final run, after moving it to `decision-handlers/tests/`, is FINAL-LLM below.
- `npx vitest run <R>/flow-bootstrap <R>/recovery <R>/service <R>/tests/service-bootstrap/tests/state-digest-and-trace.test.ts --maxWorkers=2 --minWorkers=1`
  → `Test Files 109 passed (109)`, `Tests 1463 passed | 1 skipped (1464)`.
  - This includes `service/flow-bootstrap-commands/tests/state-digest.test.ts` (2 tests) and
    `tests/service-bootstrap/tests/state-digest-and-trace.test.ts` (3 tests).
- `npx tsc --noEmit -p tsconfig.json` → exit 0, 0 `error TS` lines. It was run after the move as well.
- **Structure audit, from the Core root:** `node scripts/structure-audit.mjs`.
  - First run: exit 1, `FAIL [directory-files] …/runtime/llm/tests/: 26 source files exceeds the 25-file limit`,
    caused by my new test. I moved the test.
  - Re-run: exit 0, `structure-audit: passed (195 warning(s), 354 baselined)`. The line
    "1 baseline entries can be lowered" was already present at baseline.
- **FINAL-LLM, after the move:**
  `npx vitest run src/programs/automation-studio/runtime/llm --maxWorkers=2 --minWorkers=1` →
  `Test Files 69 passed (69)`, `Tests 658 passed (658)`, including
  `llm/decision-handlers/tests/state-digest-cost.test.ts (7 tests)`.

## Not verified

- **No live build, Lab run or browser run.** This was out of scope by the brief.
- **Actual capture counts in the extension.** The counts above are `executeTool` and hook calls in Core. That each
  hook call was one `web.dom.capture_snapshot`, and that a look is one capture, comes from the earlier report, not
  from a measurement.
- **The real domain has not been exercised against these changes.** wD's domain work (filling `stateDigests`, the
  flag on the binding) was not present or run here. `stateDigestsOnCalls` is exercised only through the Core tests'
  fake bindings.
- **"Before" for run-munneauy is derived, not replayed.** It comes from the recorded steps plus the f0dbbd6 code
  rules (2 hook calls per call run, 1 per answer check). The old code was not re-run.
- **Choices in the rebuild.** The page never moving by itself and the per-click handles are choices. Because the page
  stays still, decision 10 does not run in the rebuild (it ran in the recorded build because the old answer check saw
  a digest move).
- **Core dist not rebuilt.** Other packages reading dist do not yet see these changes.

## Open questions or contradictions found

1. **The ending of a withdrawn-look stall.** When the guard is reached on a withdrawn look, it ends
   `repeat_without_progress`, deliberately bypassing `unusableDecisions.stalled`. If
   `unusableDecisions.maxInARow` is reached first, it ends through `stalled` like any unusable decision. That can
   happen when a different unusable issue has restarted the no-progress count. Say if the lead wants one ending.
2. **Reruns are exempt from the backstop.** A `rerun` amendment of a look step while looks are withdrawn still runs.
   The amendment path was left alone because it is already counted and exempt from the repeat policy.
3. **A node never seen as a look is not withheld.** If the model asks for a snapshot node that this build has never
   run, it runs, because Core cannot know before the call that it is a look.
4. **Libraries over 400 nodes are not narrowed.** The `node` enum of a library that large is not narrowed, and only
   the backstop applies.
5. **The initial look's draft step still carries no `stateBefore`/`stateAfter`.** Its digests go to `callStates` and
   the row's `pageState` only. Adding them to the draft would change what `flow-bootstrap/` reduction walks, which
   this brief does not own.
6. **Line endings.** Git warns "LF will be replaced by CRLF" on the files I rewrote with a script. `git diff --stat`
   shows only the intended changes (19 files, +362/−107, plus 3 new files).
