# W17 report: pace in draft

## Brief

### Brief: t378-w17-pace-in-draft (worker)
- Repository: FluxIQ Core. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378` (on `task/t378-candidate-feedback`). R = `T/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime`.
- Context: a saved Flow node's pace is `metadata.paceMs` (`R/executor/pacing/pace-metadata.ts`, `automationStudioAuthoredPaceMs`); a plan node carries it as `paceMs` (W8). Reading a saved Flow back as a draft (`R/llm/node-tools/draft-from-flow.ts`, used by repair and extension) drops it, so a repaired Flow loses the pace a trial learned. W15's report gives the exact edits (`w15-ending-steps-and-pace-draft.md`, "Open questions", task 3).
- Task:
  1. `paceMs?: number` on `AutomationStudioFlowDraftStep`; seed it in `draft-from-flow.ts`; carry it through `assemble-draft.ts` and `draft-routing.ts` so the plan node, and the saved Flow node, keep it. Fail-first test: a Flow with `metadata.paceMs` 6000 read back as a draft and assembled keeps 6000 on the same node.
  2. `R/service/candidate-failure/refusal-codes.ts`: trim a too-long place to its node path (`plan.subflows.S.nodes.M`) instead of dropping it. Test beside it.
  3. `R/activity/call-context.ts:37`: correct the out-of-date `describeCall` comment.
- Owns: `R/flow-draft/step.ts`, `R/flow-bootstrap/authoring/assemble-draft.ts`, `R/flow-bootstrap/authoring/draft-routing.ts`, `R/llm/node-tools/draft-from-flow.ts`, `R/service/candidate-failure/refusal-codes.ts`, `R/activity/call-context.ts` (comment only), and the tests beside them.
- Definition of done: vitest on `R/flow-draft`, `R/flow-bootstrap/authoring`, `R/llm/node-tools`, `R/service/candidate-failure`, `R/conversations/commands/tests` passes; `tsc --noEmit` clean; structure audit clean in owned files.

## Outcome

Partial. Tasks 1 and 3 are done. Task 2 was implemented and then reverted, because it breaks `conversations/commands/tests/candidate-endings.test.ts` ("lane D, with the refused step's own words"), and the fix for that is in a file this brief does not own (see Open questions).

## What changed and why

- `R/flow-draft/step.ts`: `paceMs?: number` on `AutomationStudioFlowDraftStep`, with a doc comment.
- `R/llm/node-tools/draft-from-flow.ts`: the seeded step takes `paceMs` from `automationStudioAuthoredPaceMs(node)`, imported from `../../executor/pacing/index.ts`, through a new private helper `paceOf`. A missing or invalid pace (not a positive whole number) carries nothing.
- `R/flow-bootstrap/authoring/assemble-draft.ts`: the routed step gets `step.paceMs`, next to `routeSignatures` and `nodeLabel`.
- `R/flow-bootstrap/authoring/draft-routing.ts`: `paceMs?: number` on `AutomationStudioFlowDraftRoutedStep`. `scriptStep` copies it onto the `AutomationStudioFlowScriptStep`, and `assemble.ts:426` then puts it on the plan node. `adaptation.ts` writes it to `metadata.paceMs` when the Flow is saved.
- `R/llm/node-tools/tests/draft-from-flow.test.ts`: two new tests in "a re-authored Flow keeps the routing it inherited":
  - "keeps a node's authored pace on the same node once the draft is assembled": `node.s3` has `metadata.paceMs` 6000, and the seed, the assembled plan, and `draftStepIdByNodeKey` with `nodeIdByStepId` all lead back to `node.s3` with 6000.
  - "carries no pace that is not a positive whole number of milliseconds".
- `R/activity/call-context.ts`: the comment now says the candidate loop *then* had no `describeCall`, and has one since t378 W15 (`../service.ts`). I confirmed it at `service.ts:1565`, `:1595` and `:1642`.
- `R/service/candidate-failure/refusal-codes.ts`: back to its original content, so no net change. The trimmed version and its test are saved in my scratchpad as `w17-refusal-codes.trimmed.ts` and `w17-refusal-codes.test.ts`, and the edit is described below.

## Commands run and observed results

- Fail-first test before the fix: `npx vitest run .../llm/node-tools/tests/draft-from-flow.test.ts` -> 1 failed, 33 passed. The seed had `null` where 6000 was expected.
- The same file after the fix -> 34 passed.
- Brief suites with task 2 applied: `npx vitest run R/flow-draft R/flow-bootstrap/authoring R/llm/node-tools R/service/candidate-failure R/conversations/commands/tests` -> 1 failed file of 85. In `candidate-endings.test.ts`, it expected "the step 'keep requests with 5 or more mutual friends' was given a setting..." and got "a step was given a setting...".
- The same suites after reverting task 2 -> `Test Files 84 passed (84)`.
- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` -> no output, exit 0.
- `node scripts/structure-audit.mjs`:
  - The first run gave 1 violation, `[as-never]` from my test cast. I removed the cast.
  - Rerun -> `structure-audit: passed (293 warning(s), 708 baselined)`.

## Not verified

- No live run, build or provider call, as the brief says.
- I did not exercise the extension path that reads a Flow back as a draft beyond these unit tests.
- A pace above the plan limit (600000 ms) saved on a node would now be carried and refused by plan parsing (`bootstrap.invalid_pace`). Promotion already holds learned paces to that limit, so this should not happen, but I added no clamp.

## Open questions or contradictions found

- **Task 2 needs a reader edit outside this brief.**
  - `R/activity/wording/refused-step-issues.ts` matches an issue to its refused step only by exact `path`. It falls back to matching by code only when the issue has no place at all.
  - With the place trimmed to `plan.subflows.0.nodes.8`, the issue now has a path that equals no step's full path (`...nodes.8.parameters.minimumMutualFriendsCount`). So the step's words are lost, which is a regression against the code fallback that works today.
  - The fix is one serial brief owning both files:
    - In `refusal-codes.ts` `encodeIssue`, try the full place, then `NODE_PATH.exec(place)?.[0]` with `NODE_PATH = /^plan\.subflows\.\d+\.nodes\.\d+(?=\.|$)/u`, then fall back to bare.
    - In `refused-step-issues.ts` path branch, match `step.path === issue.path || (step.path?.startsWith(`${issue.path}.`) && step.code === issue.code.split(":")[0])`.
  - The scratchpad test covers: trimmed to the node; a path that fits stays whole; a long non-node place is dropped; `nodes.12x` is not read as node 12.
- **A rerun loses the pace.** `R/llm/evidence-loop/rerun-replacement.ts:86` copies `routeSignatures` from a replaced carried step onto the rerun that takes its place, but not `paceMs`. So a repair that reruns a paced node loses its pace. That is a one-line addition there, and the file is not mine.
- `R/flow-draft/scheduled-candidate/candidate.ts:39` fingerprints a step without `paceMs`. That looks right, since the pace is not part of the configuration that was run, but it is noted in case the supervisor wants otherwise.
