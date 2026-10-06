# t264-s4-w8-amendment-answers: worker report

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t264/!FluxIQ` (branch `task/t264-core-integration-chain`, base `5613270d`).
R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

**Done, with one hunk left out.** Lane B's F5/F10 (cause 5 "bind of a press target", cause 6 "every refusal carries
`next`", cause 8 "moved act told") and lane A's w108 Cause 6 (`notRunYet`) are ported onto the t262 content. All checks
exit 0. The lane B hunk in `R/llm/evidence-loop-decision.ts` (bind narrowing in the decision instruction) is not
ported: that string is pinned word for word in `R/llm/deepseek/tests/system-prompt-pins.json`
(`evidence_tool_decision`), which I do not own. See Open questions.

## What changed and why

- **`R/flow-draft/act-claim.ts`** (B, cause 8): `automationStudioFlowDraftClaimAct` now returns the steps the act was
  taken off (`void` became `AutomationStudioFlowDraftStep[]`). Header comment ported.
- **`R/flow-draft/amendment.ts`** (B, causes 5 and 8):
  - The refusal type gains `control?: true`. `bindStep` passes the shown parameters (`step.input`) to
    `collectBindLeaves`. A `bind_new_key` whose key is shown but was not run with gets `control: true`.
  - `applyAutomationStudioFlowDraftAmendments` collects claims and returns `moved?: ActMove[]` through `movedActs`.
    `ActMove` is private, as on the lane.
  - Merged with t262: `unrepeat`, the `replayed` clearing and `DropReversals` are untouched. The claim stays before
    `DropReversals`, matching t262's order.
  - The schema's `bind` and `input` descriptions now say "a value a step typed, or a read's condition ... a press's
    control or option is never bound". This is B's text without its `once` and count sentences.
- **`R/flow-draft/entry.ts`** (B): the authored instruction's bind sentence is narrowed the same way.
- **`R/llm/draft-amendment-feedback.ts`** (B causes 5, 6 and 8; A Cause 6):
  - New `bind_new_key` reason text.
  - New `ACT_MOVED_CODE`, `MOVED_INSTRUCTION`, a `moved` input and output, and `onlyMoved` (`ok: true`).
  - New helpers `stillToDo`, `checklistLeft`, `movedNote` and `notRunYet`. `actDone` now uses `checklistLeft`, with
    the same strings.
  - The `next` chain is `nextStep ?? actDone ?? notRunYet ?? stillToDo`. t262's `nextStep` (the `unrepeat` quantity
    case) stays first.
  - **Merge decision:** `notRunYet` appends `checklistLeft` when `actsNotDone` is given, following B's rule that every
    refusal's `next` ends with the acts still to do. A's exact-string test has no checklist, so it holds unchanged. A
    new test pins the merged form.
- **`R/llm/decision-handlers/amendment.ts` and `types.ts`** (B, cause 8 wiring):
  - `tell` takes `moved`, and is called when anything moved.
  - `held.moved` is set only when amendments wait for a rerun. That is the only case where `tell` is deferred, because
    t262 builds `held` whenever a rerun replaces a step.
  - The settle path tells when `held.moved` is set.
  - New export `automationStudioLlmEvidenceClaimWrittenAct`, for a call put into the Flow with `act`. The t262 parts are
    kept: the rerun-inclusive `applied`, `tellRetained`, and the step-log `told`.
- **`R/llm/evidence-loop.ts`** (B): `draftRecord` calls `automationStudioLlmEvidenceClaimWrittenAct(handling, …)` after
  the push, and the unused `automationStudioFlowDraftClaimAct` import is removed. The file went from 798 to 796 lines.
- **Tests:**
  - `flow-draft/tests/act-claim.test.ts`: B, 3 new tests plus 1 edited.
  - `flow-draft/tests/amendment.test.ts`: B's control-bind test, plus its "what bind is said to be for" test without
    `once`.
  - `flow-draft/tests/entry.test.ts`: B's narrowing test.
  - `llm/tests/draft-amendment-feedback.test.ts`: B's musp4h2f block (4 tests), A's Cause 6 block (2 tests), and 1
    merge test.
  - `llm/decision-handlers/tests/moved-act-told.test.ts`: new, B's file verbatim, with LF endings.
- **Doc:** `docs/architecture/automation-studio/flow-authoring.md` has B's hunk for these units, plus a sentence on
  Cause 6. B's `llm-flow-bootstrap.md` hunks belong to other units (build-test `observed`, `judge_no_longer_refutes`,
  the not-finished ending, lasting acts by kind), so none were ported.

### Lane hunks accounted for

| Hunk | Disposition |
| --- | --- |
| B `act-claim.ts`, `amendment.ts` `control` / `moved` / bind comments, feedback `stillToDo` / `moved` / `bind_new_key` / `checklistLeft`, handler wiring, `types.ts` `moved`, `evidence-loop.ts` call | Ported, merged by hand onto t262 |
| B schema / `entry.ts` bind narrowing (run mustzxhi) | Ported (the `once` and count sentences dropped) |
| B `evidence-loop-decision.ts` instruction narrowing, and `authored-draft.test.ts` assertions for it | **Not ported**: the pinned prompt needs `system-prompt-pins.json` (not owned) |
| B `once` change, `count_not_a_repeat`, `stillRepeats`, `countIn` / `countedActs`, `countNext`, `repeatClear`, `evidence-loop-steps.ts` `count_not_a_repeat`, feedback mustzxhi tests | Superseded by t262's `unrepeat` and the quantity handling in `act_already_named` / `nextStep`; never ported |
| B `verify-only.ts` comment | Out of scope (F1 landed in S1) |
| B `amendment-memory.ts` / `stalled-amendments-replay.test.ts` | F11, landed in t263 |
| A `draft-amendment-feedback.ts` `notRunYet` and its tests | Ported, with the checklist suffix merge above |

`flow-bootstrap/evidence-loop-steps.ts` needed no change: B confirmed that it strips unknown fields, so `control` and
`moved` need no allowlist.

## Commands run and observed results

- Focused, from `packages/fluxiq`: `npx vitest run <act-claim, amendment, entry tests; draft-amendment-feedback test;
  llm/decision-handlers/tests; authored-draft test>` printed `Test Files 10 passed (10)` and
  `Tests 160 passed (160)`.
- The brief's set, from `packages/fluxiq`, printed `Test Files 302 passed (302)`, `Tests 3138 passed (3138)` and
  `Duration 159.09s`, exit 0:
  `npx vitest run --minWorkers=1 --maxWorkers=3 src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/tests/service-authoring/tests src/programs/automation-studio/runtime/tests/service-bootstrap/tests src/programs/automation-studio/runtime/tests/deepseek-bootstrap src/programs/automation-studio/runtime/conversations`
  - My first attempt used `--maxWorkers=3` alone. It failed before running any test with `RangeError:
    options.minThreads and options.maxThreads must not conflict`, a config clash, not a test failure.
- `node scripts/build-cache/cli.mjs fluxiq:check` exited 0 (`inputs changed: packages/fluxiq`).
- `node scripts/build-cache/cli.mjs structure-audit:check` printed
  `structure-audit: passed (249 warning(s), 349 baselined).` and exited 0.
- `pnpm.cmd build` exited 0, ending with the `web:build` step.
- Downstream:
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check` exited 0, after `core-build: ... is current with its
    source.`
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check` exited 0.
- Line endings, checked with node: every changed or new Core file has `crlf=0`. Line counts:
  - `amendment.ts` 658 (budget 800).
  - `evidence-loop.ts` 796 (it was 798).
  - `draft-amendment-feedback.ts` 369.
- Core `git status --short` lists only the 12 owned files and the new `moved-act-told.test.ts`.

## Not verified

- I did not watch the new tests fail before the port. They assert fields and strings (`control`, `moved`, `next`) that
  the base did not produce. The lane reports record the failing-first runs.
- No live run, Lab, browser or provider call.
- If a reversal drop (`DropReversals`) later takes out a step that a written act left, the `moved` note it was just told
  is stale. The lane has the same order, and the next draft entry shows the drop.

## Open questions or contradictions found

- **Decision-instruction narrowing (lane B, run mustzxhi) is still unported.** It needs
  `R/llm/evidence-loop-decision.ts` (owned) and `R/llm/deepseek/tests/system-prompt-pins.json`
  (`evidence_tool_decision`, not owned) to change together, plus the two `authored-draft.test.ts` assertions. The lane
  diff of both files has the exact text. The schema and draft entry already carry the narrowing, so the model is told it
  in two of the three places.
- The downstream tree shows `docs/working/mvp-final-month-plan/reports/t264-core-chain.md` modified. I did not touch it.
