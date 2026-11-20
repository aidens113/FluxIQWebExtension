# t905 continuation proof: cause, fix, proofs

Worker: finish-branches/t905-continuation. Trees: Core `fxwork/t905/!FluxIQ` (task/t905-result-ledger), extension `fxwork/t905/!FluxIQWebExtension`. Nothing committed.

## Outcome

Done. Both provider-free proofs return `status: passed`. Every attempt's answer is right, and every later attempt's continuation is proven by digest.

## Cause (evidence)

- In run-mwop7kt3, attempt 1's `get-task-attempt` `saved` is `notes_only / unproven / why: not_assembled`, with no `flowId` and no `stepsDigest`. Attempts 2-4 ran the kept steps (`startedFrom.route: use`, digest `9301879b…`). The test-runner reader is correct, and all three refusals (`first_saved_nothing`, `second_found_something_else`, `second_ran_another_flow`) follow from `saved` having no `flowId`/`stepsDigest` (`continuation.ts` 20-24).
- Step notes 0021/0034/0047/0060 say: "The draft was refused and kept as steps only: answer_first.output_step_version_not_saved. The Flow's read of step 9 is not v1". Assembly passed; the output-step save check refused it afterwards. run-mwdbj3vf had the same refusal (mvp-launch-plan.md 2026-11-12).
- Root cause: Core commit 280c4bdad changed `result/output-saved.ts` to compare `version(step.ranWith)`, treated as "the recorded resolution", whole against the assembled node. For a list read, the web domain never records the resolution in `ranWith`. Its `node-run/node-call.ts` `webNodeFlowParameters` keeps the steps "resolved, except for the list an extraction reads... the handle is what is written down, and it is resolved again when the plan is assembled". `ranWith.extractList` is the written read (`fields: {title: "div_css-…"}`, `where: [{field: "span_css-1r8u2lx", …}]`) plus `extractionBinding`. The node holds the resolver's request (`item`, column specs, `where: [{read: {...}, is, not}]`). The two sides are in different vocabularies, so every handle-based list read was refused and no Flow was ever saved. 280c4bdad's test faked `ranWith` in the resolved form, a shape the domain never produces. Core's own contract also says `ranWith` is opaque to Core (`runtime/flow-authoring/draft/step.ts`).

## Fix (Core, answer-first/result and attempt only)

- `result/output-saved.ts`: the check now compares three reads, and each comparison stays within one vocabulary:
  - `written` is `input`, in the ledger's words.
  - `recorded` is `ranWith ?? input`, what the assembly was handed (`runtime/llm/node-tools/draft-step.ts:58`).
  - `saved` is the plan node.
- The ledger must equal `written` exactly. Then one of these must hold:
  - (1) `recorded` equals `saved` exactly: the domain recorded the read already resolved, and the plan kept it.
  - (2) `recorded` equals `written` exactly: the plan is the domain's resolution of the answer's own read. The plan must then keep every authored column key and the same number of distinct conditions. The domain resolves conditions 1:1 (`keptWebExtractionConditions`) and keeps each column under the plan's key.
- New exported type `AutomationStudioAnswerFirstResultSavedRead` (field `resolved` renamed `recorded`). The header explains both runs.
- `attempt/draft-save.ts`: `savedReads` uses the renamed field and type. No other behaviour changes.
- Kept refusals: a stale authored version, a plan that dropped a condition or column, a changed resolved condition or selector when the read was recorded resolved, and a recorded read that is not the answer's version.

## Tests

- `attempt/tests/draft-save.test.ts`, new "a list read recorded as written and resolved again at assembly". It uses the web shape, with `ranWith` = written `extractList` + `extractionBinding` and the plan holding the resolved request:
  - The Flow saves. This failed before the fix (`kept/not_assembled`, as live) and passes after.
  - It is refused for a lost condition, a lost column, a stale recorded `where`, or stale recorded fields.
- `result/tests/save-checks.test.ts`: helper renamed to `recorded`. The old assertion "`saved(resolved, written)` is refused" encoded the false premise; it is replaced by a test that holds the recorded-as-written read and refuses a lost condition or column and stale recorded versions.

## Proofs (heavy-slot ordinary slots, provider `scripted`, model none, 0 real provider calls)

Proof 1, run-mwor31fc-9ada97a9 (crossborder free-hubs, Core rebuilt first in the same job). Status `passed`. Continuations 1→2, 2→3, 3→4 held.

| Attempt | Path | Flow | Model calls | Time |
| --- | --- | --- | --- | --- |
| 1 | explore | flow.fe5b5062-1d7a-4b5d-bd2d-41df3a6b9641 | 12 (interp 1, judge 1, decisions 10) | 23.0 s |
| 2 | run_flow | same Flow | 1 (judge 1) | 17.5 s |
| 3 | run_flow | same Flow | 1 (judge 1) | 18.0 s |
| 4 | run_flow | same Flow | 1 (judge 1) | 18.8 s |

Proof 2, run-mworcm4i-076e33b1 (professional-network accept-messaged, `FLUXIQ_ATTEMPT_SCRIPT_FORM=notes-back`). Status `passed`. All continuations held.

| Attempt | Path | Flow | Model calls | Time |
| --- | --- | --- | --- | --- |
| 1 | explore | flow.df51d0f2-73a3-43f8-9b57-d258abee4b03 | 15 (interp 1, judge 1, decisions 13) | 14.0 s |
| 2 | run_flow_then_repair | same Flow | 7 (judge 2, decisions 5) | 8.6 s |
| 3 | run_flow | same Flow | 1 (judge 1) | 6.3 s |
| 4 | run_flow | same Flow | 0 | 6.0 s |

## Commands and exit codes

- Core `pnpm.cmd exec vitest run …/attempt/tests/draft-save.test.ts`, with the new test and before the fix: exit 1. 1 failed (the new save case), 9 passed.
- Core `pnpm.cmd exec vitest run …/attempt/tests/draft-save.test.ts …/answer-first/result/tests`, after the fix: exit 0. 11 files, 73 tests passed.
- Core `vitest related --run output-saved.ts draft-save.ts --dir src/framework` under my own `timeout 1500`: exit 124. I cut it off after 473 passed and 0 failed, so it is not counted.
- The same `vitest related`, uncapped, through `heavy-slot run t905c-related`, `NODE_OPTIONS=--max-old-space-size=4096`: exit 0. 272 files, 1720 tests passed, 1980 s.
- Core `node scripts/structure-audit.mjs`: exit 0, "passed (559 warning(s), 909 baselined)". It warns on none of my files, and I made no rebaseline.
- `heavy-slot run t905c-proof1 -- bash t905c-proof1.sh`: the Core build (contracts, sdk, fluxiq, client-gateway-websocket, ui-components) exited 0, then the Lab proof 1 exited 0. Overall exit 0.
- `heavy-slot run t905c-proof2 -- bash t905c-proof2.sh`: Lab proof 2 exited 0.

## Not verified

- No runtime/src related run: no runtime source changed. No package typecheck (user rule). Extension unchanged, so no node --test.
- Branch (2) cannot see a changed selector or column inside the domain's resolution; Core has no record to compare it with. That is the domain's trusted resolution, as plan resolution already trusts it.

## Open questions and contradictions

- The 2026-11-12 acceptance demanded "assembly-to-recorded-resolution equality". Core never keeps a recorded resolution for a list read, so that requirement cannot be met as written. This fix replaces it with exact recorded-read equality plus structural preservation. The lead should confirm.
- Proof 1's replays each make one judge call, reported as `flow_not_proven` and then `check_cleared`. As the 11-12 notes found, this comes from the person-cleared traffic screens (`completion/replay-stands.ts`), not from saving. Proof 2's attempt-2 repair is the script's designed notes-back path (`NOTES_BACK_JUDGES = 4`).
- An untracked `runtime/result-verification/flow-less/tests/window-fitting-order.test.ts` is in the Core tree. It was there before I started and is not mine.
