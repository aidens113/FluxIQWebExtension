# Report: S2 the loop (Core's do-while repeat)

Lead report for "S2 The loop" in `docs/working/mvp-final-month-plan.md` ("Briefs: read-list redesign stages S1, S2,
S4+S5"). Design: `read-list-collect-design.md` sections (1.7), (4), (7) row S2. Core tree
`C:/Users/osrs_/FluxStuff/fxwork/t283/!FluxIQ` (branch `task/t283-read-list-s2-loop`, base `ee7ba0f3`). No commits.

`R` = `packages/fluxiq/src/programs/automation-studio/runtime`, `N` = `.../automation-studio/nodes`.

## Current State

Done, not committed. S2 is implemented in Core tree `fxwork/t283/!FluxIQ` as row S2 names it, plus three changes
outside the row's file list that the loop needs to work end to end (see "Beyond the row"). Final gates on the
integrated tree: `fluxiq:check` exit 0, Core structure audit exit 0, Core `pnpm.cmd build` exit 0, and 156 owning test
files with 1,979 tests passed. No downstream source changed. No Lab, browser or provider call.

## Contract (fixed by the lead; workers build on it, never change it)

**C1 Routing.** `R/flow-draft/routing.ts` `AutomationStudioFlowDraftStepRouting` has two repeat shapes:
- `{ kind: "repeat"; through; over }` -- unchanged meaning (a list, or a check before the span);
- `{ kind: "repeat"; through; while; most? }` -- the do-while: run the span (this step through `through`), then again
  while its last step succeeds. `while === through` always. `most` is the most passes (1..500); absent means the
  Repeat node's default (50). The span runs at least once.
- Helpers: `automationStudioFlowDraftRepeatIsWhile(routing)`, types `AutomationStudioFlowDraftRepeatOverRouting`,
  `AutomationStudioFlowDraftRepeatWhileRouting`. On the do-while shape `over` is absent; readers that need a listing
  treat a do-while as having none.

**C2 Amendment.** `AutomationStudioFlowDraftAmendment` gains `while?: number` and `most?: number` (positions, as shown).
`{"step": <read>, "change": "repeat", "while": <next page>, "most"?: n}`; `through` defaults to `while`. Read as
malformed and dropped at parse (`R/llm/evidence-loop-decision.ts` `readAmendment`): `while` with `over`; `most`
without `while`; `most` not an integer 1..500; `through` and `while` both given and different.

**C3 Repeat node.** `N/control-flow/repeat.ts`, id `builtin.control.repeat`, registered in `controlFlowNodes`.
Inputs: none declared (the builtin control `in` is added). Outputs: `body` (branch), `done` (branch), `pass` (number,
data). Parameters: `most` (default 50, 1..500, integer), `maxStepsPerIteration` (default 50, not state-bindable).
State through `context.iteration` as `{ items: [], index: <passes begun> }`. Each arrival: while fewer than `most`
passes have begun, route `body` with `{ pass: n }`; else clear the state and route `done` with `{ pass: <passes begun> }`
(which is `most`) and a message. Both are `success`. A loop left by its last step's `ended` keeps its count; only state
routing back into the same loop would see it.

**C4 Graph (assembly, `R/flow-bootstrap/authoring/draft-routing.ts`).** For `[... prev, first (repeat while last),
..., last, after ...]`:
- `prev.success -> loopK(Merge).branches`; `loopK -> passK(Repeat)`; `passK.body -> first`; members in order;
- `last.success -> loopK.branches` (the back edge); every output of `last`'s node whose role is `branch` (for the
  next-page node: `ended`) `-> exitK(Merge).branches`; `passK.done -> exitK.branches`; `exitK` falls into `after`;
- `most` is written as the Repeat step's `most` entry only when the routing carries it;
- the library check requires Merge and Repeat;
- no other member may carry routing (existing rule); a do-while whose `last` declares no `branch` output and that
  carries no `most` is refused (`flow_draft.repeat_while_never_ends`): it could end only by failing or at the Repeat's
  default bound (read from its definition, not restated);
- a do-while on the Flow's first step is refused `flow_draft.repeat_not_after_its_source`: the head Merge would be
  the only way in and it carries the back edge, so no run could start.

**C5 Dispatched route (Flow runs).** A web action answers a route by putting `route: "<output id>"` in its result
payload. `R/io-policy.ts` (both dispatchers) lifts a non-empty string `payload.route` other than `success`/`failed`
onto the success result's `route`. `R/executor/node-execution.ts` keeps a dispatched success `route` only when the
node's definition declares an output with that id whose role is `branch`; otherwise the route stays the node's own
(`success`). A failed dispatch is `failed` whatever it says. The executor then follows that port's edge: no ladder,
no state routing (a success). `graph-run.ts`'s step allowance and `state-routing/progress-guard.ts`'s progress mark
count Repeat `body` passes as they count For Each's. An importer node's definition (the web next-page node's) is held
only by the native runtime, never by the builtin library the executor reads, so `R/native-node-runtime.ts` returns the
bound definition's output ports as `declaredOutputs` beside its result, `R/executor/contracts.ts` `nativeNodeExecutor`
carries them, and node-execution gates on them. `R/service.ts` (S1's) passes that result through unchanged and was
not edited.

**C6 Replay answer (build test).** The domain's replay of a node that took its `ended` route answers
`resultCode: "core.replay.ended"` (constant beside `AUTOMATION_STUDIO_NODE_REPLAY_RESULT_CODES` in
`R/llm/node-tools/replay.ts`). It maps to status `failed` anywhere but as the last member of a do-while span, where
it is that pass passing and the loop ending (`R/llm/node-tools/replay-span.ts`).

**C7 Read-back (`R/llm/node-tools/{seeded-loops,draft-from-flow}.ts`).** Exactly C4's shape reads back as
`{ kind: "repeat", through: last, while: last, most? }` on the first body step, with the Repeat and both Merges as
framing; anything else falls back as today.

## What S4 and S5 need from S2 (the route contract to stub against)

- The next-page node definition declares an output `{ id: "ended", label: "Ended", valueType: "any", role: "branch" }`
  beside `success` and `failed`. Role `branch` is what the assembler wires to the loop's exit and what the executor
  accepts as a dispatched route; any other role is ignored.
- Flow runs: the next-page action's result payload carries `route: "ended"` when there is no further page (C5). It
  travels in the payload: no new field on Core's runtime command result or IO dispatch result, and no adapter lifting.
- Build test: the domain's next-page replay answers `resultCode: "core.replay.ended"` (C6), and any other answer as
  today (`core.replay.replayed` for a page moved).
- The model amends `{"step": <read>, "change": "repeat", "while": <next page>, "most"?: n}` (C2); `web-5` instructions
  should teach that shape. Core's own words already say it generically (`s2-words.md`).

## What S3 needs from S2

- Judge and summary words: `R/result-verification/build-test/summary.ts` now only describes a do-while routing as
  `{kind, through, while, most?}` (a type fix); the pass accounts (one read with N attempts, stop `ended`) are S3's.
- Activity words (`R/activity/**`, `src/ui/activity-action/**`, deferred to S3 by the plan): `activity/decision-answer/
  edit-words.ts` `case "repeat"` words a do-while amendment as "repeat over" the step before it; it should say "repeat
  through <while> while it works" when `amendment.while` is set. `ui/activity-action/action-of.ts` maps For Each and
  Loop to `repeat` but has no entry for `builtin.control.repeat`. The Repeat node's `pass` output is the pass number a
  "Reading page 3" card needs; `activity/step/numbers.ts` numbers the Repeat like For Each (only Merge is skipped).
- `R/llm/evidence-loop/rerun-input.ts` and `R/recovery/refuted-result/brief.ts` paging words are untouched (S3's row).

## Beyond the row

1. `R/llm/evidence-loop-decision.ts` `readAmendment`: its exact key list would have dropped any amendment carrying
   `while` or `most`, so the model could never state the loop. Edited `readAmendment` only (lane A, t281, may touch
   other parts of this file).
2. `R/native-node-runtime.ts` and `R/executor/contracts.ts`: the importer-route defect under C5. Fail-first test in
   `R/flow-bootstrap/authoring/tests/repeat-loop.test.ts` ("leaves on Next's ended when the dispatch answers it"):
   before the fix the run read 50 pages to the bound; after, 3, with Next's routes `success, success, ended` and the
   read's dispatched `records` route ignored.
3. `R/llm/node-tools/{seeded-loops,draft-from-flow}.ts`: reading a stored do-while Flow back as a draft (C7). Without
   it the Repeat came back as a plain step, which the completion check refuses, so a stored paging Flow could not be
   repaired. Plus compile fixes in readers of `routing.over` outside the row: `checklist.ts`, `rerun-replacement.ts`,
   `repeat-suggestion.ts`, `span-rows.ts`, `summary.ts`, `draft-amendment-feedback.ts`, and the exempt-set helper
   (work log, last entry) in `step-place.ts`, `sometimes-present.ts`, `dry-run-gate.ts`.

`R/flow-draft/amendment/apply.ts` was not edited. `R/flow-draft/amendment/types.ts` changed only in the `while`/`most`
fields (after `over?`) and one doc line on `over`, both away from the reason union lane A edits.

## Not verified

- No round trip of assembly into read-back in one test: read-back was tested on a hand-built Flow in C4's shape, and
  the assembler's tests pin that shape; the tests folder that could hold both (`R/tests`) is over its file budget.
- `R/io-policy.ts`'s payload lift and node-execution's gate are tested separately (`R/tests/io-policy.test.ts`,
  `repeat-loop.test.ts`), never through a real runtime adapter; the domain side does not exist yet (S4).
- No live, Lab, browser or provider run; no downstream build or check (no downstream source changed).
- The whole Core suite was not run (narrow checks only, per AGENTS.md).

## Work log

Only the lead edits this file; each worker writes `s2-<part>.md` beside it.

- 2026-10-06 lead: wrote C1 (routing union, helpers), C2 (amendment fields) and C3 (`N/control-flow/repeat.ts`,
  `index.ts`). `npx vitest run` on `nodes/tests/{canonical-registry,registry}.test.ts` and
  `nodes/control-flow/tests/for-each.test.ts`: 3 files, 30 tests passed. `fluxiq:check` exit 2, 16 errors, every one a
  reader of `routing.over` as a string: `draft-routing.ts` (5), `repeat-revalidation.ts` (2), `entry.ts`, `routing.ts`,
  `checklist.ts`, `rerun-replacement.ts` (2), `repeat-suggestion.ts`, `span-rows.ts`, `summary.ts` (2). Each is in a
  worker's partition below.
- Six workers, in parallel, foreground, disjoint files; each wrote its own report beside this one and each reported
  its fail-first tests failing before and passing after: `s2-amend.md` (worker-high: parse, route, routing semantics,
  revalidation, bind, reader type fixes), `s2-words.md` (worker: schema, entry, dry-run words; answerability draft
  4,992 of 5,000 bytes), `s2-runtime.md` (worker: io-policy, node-execution, allowance, progress mark, Repeat tests),
  `s2-assembly.md` (worker-high: C4 in `draft-routing.ts`), `s2-walker.md` (worker-high: C6, the do-while plan, the
  while plan needing its check to hold, the check excuse, parity), `s2-readback.md` (worker: C7).
- Lead verification of the integrated tree: `fluxiq:check` exit 2, one error (`draft-routing.test.ts:609`, the test
  handed the router value-shaped entries); structure audit exit 1, one violation (`llm/tests/
  draft-amendment-feedback.test.ts` 804 lines, limit 800). Lead fixed both (entries mapped to script lines as
  `assemble-draft.ts` does; the new test written in 6 lines instead of 12).
- Lead found the runtime worker's reported gap was a real defect: node-execution read declared routes from the builtin
  library only, so an importer node's `ended` was ignored. Wrote the dispatch-path test in `repeat-loop.test.ts`
  first: `npx vitest run .../authoring/tests/repeat-loop.test.ts` -> 1 failed, "expected [ 'success', 'success',
  ...(48) ] to deeply equal [ 'success', 'success', 'success' ]" (50 reads to the bound). Fixed through
  `native-node-runtime.ts` `declaredOutputs` and the executor contract; the same run -> 9 passed.
- Lead review edits: the never-ends refusal named "the next page" (a web word in a Core message the model reads) and
  hard-coded 50; now generic and reading the Repeat's default. `DRAFT_INSTRUCTION` (no byte budget) gets back "and the
  Flow does the rest", which the words worker had cut, so "never act on the others yourself" keeps its reason.
- Lead closed the walker's open item: four places rebuilt the verdict's exempt set by hand and two of them
  (`step-place.ts`, `sometimes-present.ts`) missed the new `check` excuse, so a while-check excused for not holding
  could be made optional by the test, after which the assembler refuses its loop. Fail-first in
  `flow-draft/tests/sometimes-present.test.ts`: "expected [ 'd3' ] to deeply equal []". Added
  `automationStudioFlowDraftExemptStepIds` in `flow-draft/excused.ts` and used it in all five sites (`replay-draft.ts`,
  `dry-run-gate.ts` twice, `step-place.ts`, `sometimes-present.ts`); then 32 files, 361 tests passed.
- Final gates, from `fxwork/t283/!FluxIQ`: `node scripts/build-cache/cli.mjs fluxiq:check` exit 0;
  `node scripts/build-cache/cli.mjs structure-audit:check` exit 0; `pnpm.cmd build` exit 0 (7m28s). From
  `packages/fluxiq`, `npx vitest run` on `R/flow-draft/tests/`, `R/flow-draft/amendment/tests/`,
  `R/flow-bootstrap/authoring/tests/`, `N/control-flow/tests/`, `N/tests/` -> 38 files, 457 tests passed;
  `R/executor/tests/`, `R/executor/state-routing/tests/`, `R/tests/io-policy.test.ts` -> 32 files, 362 passed;
  `R/llm/node-tools/tests/`, `R/llm/evidence-loop/tests/`, `R/llm/tests/{evidence-loop,draft-amendment-feedback}.test.ts`,
  `R/llm/harness-options/tests/`, `R/flow-bootstrap/instructed-acts/tests/`, `R/result-verification/build-test/tests/`,
  `R/tests/deepseek-bootstrap/tests/answerability.test.ts` -> 86 files, 1,160 passed. One comment-only line in
  `amendment/types.ts` followed the gates.
- A first 52-file run of every native-runtime test had 4 service tests time out at 15 s under load; run with fewer
  files, 3 passed, and the fourth (`service-recordings/tests/proposals.test.ts`) passed alone in 3.1 s.
- After the supervisor committed S2 (Core `9af71ceb`) and merged dev (t287 group 1) and S1 (`5cf49477`) into t283
  (`370ed11e`), the lead finished two things, uncommitted:
  1. `R/llm/decision-handlers/tests/refusal-way-out.test.ts`: `settings_rewrite_run` added to the exhaustive reason map,
     plus an expectation that its way out names the step and the rerun (`13 passed`).
  2. `replay-parity.test.ts` failed 3 of 3: S1 assembly now writes a per-step `recordOutput` on every read, and the
     walker sent none, since `replay.ts`'s step and verify calls take the node definition and nothing passed one.
     Added `AutomationStudioFlowDraftReplayDefinitionOf` (`replay-span.ts`). It is threaded beside `nodeOf` through
     `replay-span.ts`, `replay-draft.ts`, `dry-run-gate.ts`, `run-flow.ts`, `run-flow-part.ts`, `loop-configuration.ts`
     and `evidence-loop.ts`. `service.ts` passes `definitionOf: (id) => registry.get(id, resolution)` at both build-loop
     sites. `nodeOf` stays the catalog entry the model is shown. A temporary assertion proved the walker's calls now
     equal the stored Flow's; the test's expected lists gain the read's `recordOutput`, and `recordOutput` leaves
     `DEFAULTS_ASSEMBLY_WRITES` (it is never the default now). Result: 3 passed.
- Gates after that round: `contracts:check` 0, `fluxiq:check` 0, `structure-audit:check` 0, `pnpm.cmd build` 0
  (6m31s). `npx vitest run`: `packages/contracts` `src/record-sets/{tests,process/tests}` 11 files / 118 tests passed;
  flow-draft, amendment, authoring, `nodes/{control-flow/tests,tests}`, `storage/project/tests`,
  `service/datasets/tests`: 71 files, 684 passed and 2 timed out (`runtime-stream-store` at 60 s and `adaptation-store`
  at 15 s; neither file changed since `ee7ba0f3`; together alone, 2 files / 32 passed); executor, state-routing and
  io-policy: 32 files / 364 passed; `llm/{node-tools,harness-options,decision-handlers,evidence-loop}/tests`, the
  evidence-loop and feedback tests, instructed-acts, build-test and answerability: 94 files / 1,214 passed;
  `tests/service-authoring/tests`: 4 files / 7 passed. Before the build, 9 S1 storage and service tests failed with
  "processAutomationStudioRecordRows is not a function". Cause: `packages/contracts/dist` predated S1, and fluxiq
  resolves `@fluxiq/contracts` from `dist`. After the build all 9 passed.
- Follow-ups on t283 at dev (Core `0b323ebd`, after S1+S2 landed as `c7094301`), uncommitted:
  1. W22 (`run-mut4fvkm-e2fc03e6`, cause in `mvp-final-month-plan/reports/fix-lab-process/e-mut4fvkm-terminal.md`).
     `executor/graph-navigation.ts` `hasUnvisitedAutomationStudioNodes` now counts as visited every node on an edge
     path between a forward state-routed attempt's node and its `skipped.toNodeId`. A node off every such path still
     fails a run with no End node. Fail-first in `executor/tests/state-routing-run.test.ts`, the W22 shape (s6 routed
     forward to s9 past a sometimes-present s7 and its join m8, no End node): "expected 'failed' to be 'succeeded'".
     A guard case (s5's untaken recovery step) stays `failed` with the unvisited message. After: 31 executor test
     files, 345 passed.
  2. R3-U-12: a Flow node is labelled with its draft step's `does.target` (the step's `words.target`). Path:
     `authoring/assemble-draft.ts` -> `draft-routing.ts` (`nodeLabel`) -> `assemble.ts` (plan node `label`) ->
     `plan/{contracts,parsing}.ts` (bounded text) -> `adaptation.ts` (Flow node `label`, which the run's step card
     reads). Members of a repeat over an earlier step get none, since their words name the one row explored;
     do-while members keep theirs. Fail-first `flow-bootstrap/tests/node-label.test.ts` (new): 3 failed, then 3
     passed.
  3. `flow-draft/amendment/schema.ts` `input`: "a key left out is kept, except in an object you write out again,
     repeating more of it than you leave out: that drops the keys you were shown and left out, and keeps keys
     withheld from you" (t287's restated-object rule). The only pin is hand-written, in
     `llm/evidence-loop/tests/rerun-input.test.ts`; there is no regeneration script. It was changed first and
     observed failing, then passed.
  Gates: `fluxiq:check` 0, `structure-audit:check` 0, `pnpm.cmd build` 0 (5m39s). vitest: `llm/deepseek/tests`,
  `flow-bootstrap/{tests,plan/tests,authoring/tests}`, `flow-draft/tests`: 67 files / 709 passed;
  `llm/evidence-loop/tests`, `llm/node-tools/tests`, `tests/service-authoring/tests`, `tests/service-flows/tests`,
  `activity/`: 90 files / 843 passed; `flow-draft/amendment/tests`, `rerun-input.test.ts`,
  `tests/deepseek-bootstrap/tests`: 8 files / 103 passed.
