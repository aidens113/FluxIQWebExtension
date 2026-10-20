# Report: t741-b2-sort (B2)

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime/`.
No commits, merges or pushes.

## Outcome

Done. All three parts are in place and their tests pass:

1. The format now names `extractList.sort`.
2. A test proves the parser carries it. No parser fix was needed.
3. The new refusal fires when it should and stays quiet when it should not.

The pinned contract tests are unchanged and pass.

## What changed and why

- **R `flow-bootstrap/plan/flow-script-format.ts`**: one sentence added to `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT`,
  directly after the `extractList.where` line. It says:
  - a `repeat over` visits its listing's rows in the listing's own order, so `repeat most: N` acts on the first N
    of that order;
  - to change the order, write `extractList.sort: [{"field": "due", "order": "asc", "as": "date"}]`, with
    `order` asc or desc and `as` number, date or text. This is the canonical shape that downstream
    `order-request.ts` reads, and `slot.ts` `LIST_KEYS` includes `sort`;
  - the example is "to pay the two oldest unpaid invoices", using `repeat most: 2`;
  - a sort or limit in `recordOutput.process` orders only the saved answer.

  I also added a t741 paragraph to the doc comment. The legacy `AUTOMATION_STUDIO_FLOW_SCRIPT_FORMAT` and its
  schema are untouched.
- **Parser**: no change was needed. Dotted keys are already carried. The new test was written first, and it passed
  before any source change.
- **New R `flow-bootstrap/script-statements/listing-order-in-repeat.ts`** (the check I chose):
  `automationStudioFlowPlanListingOrderInRepeatIssues` reads the assembled plan. For each For Each, it checks
  whether the For Each's body (the nodes on a cycle through it) holds a step that declares any lasting consequence.
  If it does, the listings that feed its `items` input are "walked".
  - A walked listing whose record output's `process` has `sort` or `limit` gets one error,
    `record_output.process_order_in_repeat`.
  - The error is placed at `...nodes.<listing>.parameters.recordOutput.process.sort` (or `.limit`).
  - It carries Core's fixed `message` and an `instead` sentence pointing to `extractList.sort`, `extractList.where`
    and `repeat most:`.
- **New R `script-statements/loop-body.ts`**: the cycle-through-a-loop-node reader. It was taken out of
  `record-replace-in-repeat.ts`, which now calls it, so both checks share one reader rather than a copy.
  - It is left out of the barrel, as `statement-refusal.ts` is.
  - The behaviour of `record-replace-in-repeat.ts` is unchanged, and its 3 tests pass.
- **R `script-statements/index.ts`**: exports the new check, with a comment. This was an additive edit; b1's
  `part-port-name.ts` line is kept.
- **R `llm/harness-options/bootstrap-completion.ts`**: this is the submission check I chose, because it is where
  `record-replace-in-repeat` already runs after registry validation.
  - The new check runs beside the replace check.
  - Its code is added to `PLAN_CHECK_CODES`, so Core's sentence reaches the model.
  - The header comment notes it.
  - I did not use `plan/validation.ts`, for two reasons:
    - `script-statements` imports values from `plan/index.ts`, so a call from `validation.ts` would close a module
      cycle;
    - `plan/` (25 files) and `plan/tests/` (25 files) are already at the 25-files-per-directory budget.
- **Tests**:
  - **New `script-statements/tests/listing-order-in-repeat.test.ts`** (5 tests):
    - a process sort plus a lasting act is refused at `process.sort`, with the message and `instead`;
    - a process limit alone is refused, for each of the five lasting classes;
    - a repeat with no lasting act is allowed (consequences absent or `[]`);
    - `extractList.sort` is allowed, and so is a process with only `where` or `columns`;
    - a listing that feeds no For Each is not touched.
  - **New `llm/harness-options/tests/listing-order-in-repeat-feedback.test.ts`** (3 tests) runs the real
    completion check on a written script:
    - the listing step is refused with `label: "invoices"` and `line: 5`, and the feedback carries the message and
      `instead`;
    - the same Flow with `extractList.sort` is accepted;
    - a process sort with `consequences: none` is accepted.
  - **`plan/tests/loop-format.test.ts`**: 2 new tests.
    - The sentence is present and carries its exact parts. It does not match
      `shop|store|cart|basket|feed|social|post|photo|\blike|heart|saved item|job|address|newest|friend|request`.
    - A script with `extractList.where` plus `extractList.sort` is accepted. The listing's `extractList` equals
      `{handle, where, sort: [{field: "due", order: "asc", as: "date"}], minItems: 0}`.
  - **R `flow-bootstrap/candidate/tests/refusal-locator-corpus.test.ts`**: one corpus case added. This file is
    **outside my explicit Owns list.** Its source scan fails on any new code raised under `script-statements/` that
    has no corpus case, so the new code needed one. I treated it as a test of the script-statements codes. The
    added case also proves that the candidate submission places the refusal on a line and a step.

## Commands run and observed results

All were run from `packages/fluxiq` with `pnpm exec vitest run <files>`.

- Before the fix, on the three new or edited test files:
  - "Test Files 3 failed, Tests 9 failed | 10 passed".
  - The parser-carry test was among the ones that passed: it already held.
  - The format sentence test failed ("expected undefined to be defined").
  - The check tests failed with "is not a function".
- After the fix, on `loop-format`, `listing-order-in-repeat`, `record-replace-in-repeat`,
  `listing-order-in-repeat-feedback` and `record-replace-in-repeat-feedback`: "Test Files 5 passed (5), Tests 25
  passed (25)".
- Contract tests and format consumers: `llm/deepseek/tests/system-prompt.test.ts` (38),
  `plan/tests/extraction-vocabulary.test.ts` (5), `plan/tests/issue-feedback.test.ts` (20),
  `plan/tests/flow-script-format.test.ts` (77), `plan/tests/condition-rules.test.ts` (3),
  `flow-bootstrap/tests/plan.test.ts` (24), `bootstrap-completion.test.ts` (37),
  `subflow-candidate/tests/builder-loop.test.ts` (11), `candidate-repeat-told` (3),
  `decision-context-wiring` (12) and `model-facing/tests/handle-only` (6) all passed.
  - In that run, `refusal-locator-corpus` failed: "uncovered" was the new code.
  - After the corpus case was added, `refusal-locator-corpus.test.ts` passed: "6 passed".
- The whole `script-statements/tests` directory, `bootstrap-completion*.test.ts` and
  `candidate/tests/submission-refusal.test.ts`: "Test Files 14 passed (14), Tests 193 passed (193)".
- Final rerun of the three new or edited test files after one type annotation: "3 passed, 19 passed".
- `system-prompt-pins.json` did not move. The loop format is in the tool description, not the system prompt.

## Not verified

- No typecheck, structure audit or build was run, per the shared rules; the lead runs those.
  - The new source and tests were written to type, including an explicit return type on the issue-producing
    `flatMap`, but tsc did not check them.
  - The audit was not run. Directory counts were checked by hand: `script-statements` now holds 20 files and
    `harness-options/tests` holds 25. Both are within the 25-file budget, but `harness-options/tests` is now full.
- No domain-side test was run. The test seam proposed in the debug note, that the content-side `order-rows.ts`
  sorts by `as: "date"` over prose text, belongs to c4-icons-sort, not to this brief.
- The new refusal runs only in the evidence completion and candidate submission path (`bootstrap-completion.ts`).
  The legacy JSON-plan path in `service.ts` (`validateAutomationStudioFlowBootstrapPlan` only) does not run it.
  That is the same reach as `record-replace-in-repeat`.
- No live run.

## Open questions or contradictions found

- **Two files outside the explicit Owns list.** The brief allowed "the one submission check you choose; name it".
  I named `llm/harness-options/bootstrap-completion.ts`, for the two reasons given above. The second file,
  `candidate/tests/refusal-locator-corpus.test.ts`, was forced by its coverage scan. The lead should confirm that
  no other worker touched either file.
- **Lasting classes.** The brief listed `create_new`, `modify_existing` and `delete`. The check counts all five of
  Core's lasting classes, adding `move_money` and `send_or_publish`. A process-ordered repeat that pays or sends
  acts on rows in page order just the same, so I widened it on purpose. Narrowing it back is one set.
- **"Refuse once"** is read as one issue per listing, raised on every submission while the shape holds. Nothing
  stateful lets a resubmission pass.
- The format's example uses "pay", but the check does not depend on the act.
