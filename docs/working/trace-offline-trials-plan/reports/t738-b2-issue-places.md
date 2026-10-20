# t738-b2-issue-places report

## Outcome

Done. All three defects are fixed and covered by tests. The tests beside the change, the three prompt contract tests and the Core structure audit pass for my files. The audit's remaining failures are all in other workers' files.

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t738/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`.

1. **Unconnected input placed at its own step** (`plan/validation.ts`).
   - The old `validateRequiredInputConnections` wrote `nodes.<key>.inputs.<port>`. I replaced it with a local `inputIssues` that writes `nodes.<index>.inputs.<port>`. The locator already reads that path, so the issue now lands at the node's own step and line. I chose to emit the index. I did not add a key map to `script-locator.ts`: `validation.ts` was the only place that built a key-named node path (checked by grep).
   - `bootstrap.required_input_unconnected` now carries an `instead`. It is a fixed sentence: no script line connects an input by name; a step is joined to the step written before it; a row loop's list comes from `repeat over: <label>`; otherwise use a node that takes the value in a parameter, with `$step.<label>.<output>`. `issue-feedback.ts` already passes `issue.instead` through unchanged.
2. **Repeat inside a repeat** (`authoring/draft-routing.ts`, `scriptSpan`).
   - `flow_script.repeat_body_is_routed` now uses the inner member's own `repeat` line as its path (`flow.line.<inner.line>`), not the outer head's.
   - When the inner repeat is `repeat over:`, the message adds `NO_ROW_LOOP_IN_PAGE_LOOP` and one generic clause: "A list that grows in place is loaded whole by its own step before the listing read, and the row loop runs once over that read."
   - The clause is written inline rather than as its own constant, to keep the file at its 800-line limit. It is now exactly 800 lines.
3. **Parameter standing in for a port** (`plan/validation.ts`, same `inputIssues`).
   - The rule: an input port that is not required, with a parameter of the same id, where neither the parameter (or its default) is given nor the port is connected. That raises `bootstrap.missing_parameter` at `nodes.<index>.parameters.<id>`.
   - The issue carries an `instead` that inserts only the parameter id: "Write `records:` on this step; ask core.describe_nodes for the shape it takes."
   - I reused `bootstrap.missing_parameter` so the existing activity wording and the `accepted` shape in issue feedback apply to it.

Placement: a new `plan/input-issues.ts` would have put `plan/` at 26 files, and the limit is 25. So the check is a non-exported function in `validation.ts` (now 587 lines). For the same reason its tests went into `plan/tests/validation.test.ts` (now 448 lines, an advisory warning only).

Tests:
- New `authoring/tests/locate-issue.test.ts` (a reading-list site). A script is accepted, validated against the registry, then placed with the acceptance's locator:
  - an unconnected required input on the last step is placed at `{ step: "tally the titles", line: 13 }` and carries `instead`;
  - a Write Records step with no rows is placed at its own step, line 13;
  - the same step with written rows passes validation.
- `plan/tests/validation.test.ts`, new describes:
  - the path uses the index (`nodes.2`) for a node keyed `s13`;
  - Write Records with no rows and no connection is refused at `parameters.records`;
  - written rows pass, and a connected input passes.
- `candidate/tests/refusal-locator-corpus.test.ts`, new describe for the case "a repeat inside a repeat": `line` equals the inner `repeat over: rows` line, `step` is "press buy", and the message carries both the row-in-page-loop words and the new clause.
- `authoring/tests/candidate-loops.test.ts`, new case: a reading-list page loop with a row loop inside it is refused at `flow.line.13`, the inner repeat line, with the new words.

## Commands run and observed results

- `npx vitest run <locate-issue, candidate-loops, script-locator, draft-routing, repeat-loop, written-rows, refusal-locator-corpus, submission-locator, plan/tests/, llm/deepseek/tests/system-prompt, activity/wording/tests/issue-words> --pool=forks --poolOptions.forks.singleFork` -> `Test Files 30 passed (30)`, `Tests 402 passed (402)`.
  - This was the final run. An earlier run that also included `llm/node-tools/tests/draft-from-flow.test.ts` gave 32 files and 439 tests passed.
  - The three contract tests (system-prompt, extraction-vocabulary, issue-feedback) are in this set and pass. No pin in `issue-feedback.test.ts` needed changing.
- `node scripts/structure-audit.mjs` -> 9 violations, none in my files:
  - `candidate/tests/` at 26 files, caused by another worker's untracked `trial-view-refused.test.ts`;
  - `activity/wording/act/*` and `service/project-build/ending/*` past the depth limit;
  - web-vocabulary in `candidate/trial-view.ts` and `subflow-candidate/builder-loop.ts`.
  - An earlier audit run flagged three violations of mine (`plan/` at 26 files, `plan/tests/` at 26 files, `draft-routing.ts` at 812 lines). All three are gone.

## Not verified

- No tsc or typecheck, as the brief instructed. The lead typechecks.
- No full suite. I have not run the other test files that validate plans holding Write Records: `executor/tests/node-execution`, `answerability/tests/check`, `reachability/tests/check`, `flow-change/tests/trial`, `llm/harness-options/tests/record-output-processing-feedback`, `result-verification/tests/repair-directive-do-only`, `authoring/tests/accept`. Any of them that validates a Write Records node with neither rows nor a connected `records` input will now get `bootstrap.missing_parameter`.

## Open questions or contradictions found

- `nodes/data/write-records.ts` notes that a node's inputs also carry bare run-state values, so an earlier listing's `records` can reach an unconnected Write Records at run time. A Flow that relied on that, with no rows parameter and no edge, is now refused at plan validation. The brief asked for exactly this, but the lead should confirm that is intended.
- The stand-in rule applies to any node with a non-required input port and a parameter of the same id. Write Records is the only such node I know of, but I did not list the whole registry.
- `plan/index.ts` shows as modified in `git status` with an empty diff. I edited its comment and then restored it, and only the line-ending stat changed.
