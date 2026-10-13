# t514 authoring-words-not-handles: worker report

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t514/!FluxIQ`, branch `task/t514-authoring-words-not-handles`. Nothing is committed.

## Outcome

Done. All five goals are implemented and covered by fail-first tests. The touched directories, the dependent test files, the Core typecheck and the structure audit pass.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

1. **A bare word is a handle only under a parameter that takes one** (`flow-bootstrap/authoring/values.ts`).
   - `objectValue` now takes the parameter. It reads a bare token as `{handle}` only when `automationStudioParameterTakesHandle(parameter)` is true. Under any other object parameter, the word is a value the parameter cannot read, so `bootstrap.invalid_parameter_value` names the parameter.
   - The pair reader is factored into `pairsValue`.
   - New export `authoringWrittenValue(text)` reads an unknown key's value for its shape: JSON, `a=b` pairs, or a nested value.
2. **New directory `flow-bootstrap/parameter-words/`** (index plus 3 files).
   - It sits directly under `flow-bootstrap/` because `plan/` and `authoring/` each hold 25 files, the audit's directory limit, and a subdirectory under `plan/` breaks the 9-segment depth limit.
   - `handle-parameter.ts` decides whether a parameter takes a handle: an object or json parameter, not a record output, whose declared example has a string `handle` field, or whose example fields are all strings.
     - The second case had to be added. Core's own script format writes `nextPage: extraction.1`, and the web domain has read that as the list since t489. The domain's `nextPage` example is `{list, control}`, not a `{handle}`.
     - Under the literal "example is a handle" rule, Core's own format examples failed to assemble.
   - `word-forms.ts` lists the script lines a node takes a word in, read only from declarations:
     - a parameter's `options`, which gives `param: word`
     - `enum`s in a JSON Schema published at `definition.metadata.parameterSchema`, which gives `param: word` or `param: field=word`
     - Hidden parameters are skipped.
   - `word-instead.ts` builds Core's sentence: "Write `wait: condition=absent` in place of `state: absent`: ...". It quotes only identifier-shaped keys and words.
3. **Name correction** (`flow-bootstrap/plan/name-correction.ts`).
   - New `takesWrittenValue` filter on candidates: a string value never matches an object or json parameter. The exceptions are a record output, which takes a dataset name, and a handle-shaped token under a parameter that takes handles.
   - `authoring/assemble.ts` now passes `authoringWrittenValue(text)` instead of raw text, so `wiat: condition=absent` still reads as an object.
   - `assemble.ts` stays at 799 lines: two `../plan/index.ts` imports were merged.
4. **The unknown-key refusal says what to write** (`authoring/assemble.ts`).
   - `bootstrap.unknown_parameter` for a single-segment key now carries `instead` from `automationStudioFlowBootstrapWordInstead`.
   - The issue contract gains an optional `instead?: string` (`plan/contracts.ts`).
5. **The unresolved refusal names the key** (`llm/harness-options/plan-parameter-resolution.ts`).
   - A node left naming a handle is refused at `...parameters.<key>` of the first leftover site, with Core's sentence naming the key and the token. It also points to `core.describe_nodes`.
   - Page facts keep the previous path and message.
6. **Feedback** (`plan/issue-feedback.ts`).
   - `bootstrap.handle_unresolved` is added to `AUTHORED_CODES`, so its message reaches the model.
   - An issue's own `instead` is passed through.
   - For `handle_unresolved`, the feedback derives `instead` from the leftover token and the node's schema.
   - `unknown_parameter`, `invalid_parameter_value` and `handle_unresolved` now carry `node: <definitionId>`.
7. **Repeat of a refused script** (`llm/repeat-guard/candidate-feedback.ts`).
   - When an identical refused `core.submit_candidate` is sent again, the instruction now repeats each issue's `instead` with its line and step.
   - It also points to `core.describe_nodes`, naming the node ids the issues carry, or giving a generic pointer when none do.
   - The existing "Change the lines those issues name" sentence is kept.
8. **Test fixtures**, updated to match the real domain.
   - The web-domain fixture's `target` has the example `{handle: "t5"}`.
   - The fixture's `extractList` example is led by `handle: "extraction.1"`. The obsolete `item` key was dropped to stay inside the 4,000-byte catalog-entry bound.
   - The 5 test-local `nextPage` definitions have the domain's example `{list: "extraction.1", control: "t9"}`.
   - Two `handle_unresolved` path expectations in `plan-parameter-resolution.test.ts` now include `.item`.
   - `issue-feedback.test.ts` expects the new `node` field.
9. **New tests.**
   - `authoring/tests/words-not-handles.test.ts`
   - `plan/tests/name-correction-value-shape.test.ts`
   - `plan/tests/issue-feedback-word-forms.test.ts`
   - `harness-options/tests/plan-parameter-unresolved.test.ts`
   - `repeat-guard/tests/candidate-repeat-fix.test.ts`
   - Shared fixture `plan/tests/wait-node-definition-fixture.ts`: a generic `domain.demo.wait` with `target`, hidden `selector`, `timeoutMs`, `wait`, `expectedState`, and `metadata.parameterSchema` declaring the `wait.condition` enum.

## Commands run and observed results

All vitest runs were made from `packages/fluxiq`.

- **Fail-first**: `npx vitest run` on the 5 new test files before any source change gave `Test Files 5 failed (5)`, `Tests 11 failed | 4 passed (15)`. The 4 that passed are the "still works" rows. The first authoring row failed with `expected true to be false`: the script `state: absent` was accepted as `expectedState: {handle: "absent"}`, which reproduces the defect.
- **New tests after the change**: `Test Files 4 passed (4)`, `Tests 13 passed (13)`. This run did not include the repeat-guard file; it passed in the runs below.
- **Touched directories plus flow-bootstrap**: `npx vitest run <runtime>/flow-bootstrap <runtime>/llm/harness-options <runtime>/llm/repeat-guard` gave `Test Files 170 passed | 1 skipped (171)`, `Tests 2252 passed | 2 skipped`.
- **Final run after moving `parameter-words/`**: the same three directories plus the 21 test files outside them that use the changed paths (activity/wording, executor, llm/decision-handlers, deepseek, evidence-loop, harness, node-tools, recovery, result-verification, service/flow-bootstrap-commands, runtime/tests) gave `Test Files 191 passed | 1 skipped (192)`, `Tests 2418 passed | 2 skipped (2420)`.
- **Typecheck**: `node scripts/build-cache/cli.mjs fluxiq:check` exited 0. An earlier run failed with TS2307 on a wrong relative path, which was fixed.
- **Structure audit**: `node scripts/structure-audit.mjs` exited 0 with `structure-audit: passed (341 warning(s), 1159 baselined)`. The one new warning is advisory: `plan/issue-feedback.ts` is 417 lines, past the 400-line threshold. An earlier run failed 4 depth violations for `plan/parameter-words/`, fixed by moving the directory up.

## Not verified

- No full suites, Lab runs or provider calls were made.
- The real web domain was not exercised end to end. The claim that `wait: condition=absent` is offered there rests on reading `domain/src/output-nodes/definitions.ts`, which publishes `metadata.parameterSchema` with `wait.condition`'s enum. The generic fixture mirrors that shape.
- Test files outside the selected set were not run. They were chosen by grep for the changed APIs, fixtures and codes.
- No architecture documentation was updated; it is outside this brief.

## Open questions or contradictions found

1. **Goal 1 says "only on a target parameter".** Taken literally (example is `{handle}`), it breaks `nextPage: extraction.1`, which Core's own format example teaches and the domain accepts since t489. I widened the rule to an example whose fields are all strings.
   - The weakness: a future settings-only example such as `{mode: "next"}` would also accept bare words as handles. That is the old behaviour, now with a named refusal.
   - The alternative is a domain change: lead `nextPage`'s example with `handle`, or give it a declared flag.
2. **Core now reads `definition.metadata.parameterSchema` as a JSON Schema of a node's parameters.** That is a new generic convention; the web domain already publishes it on every output node. If the supervisor prefers a first-class field on `AutomationNodeParameter`, that change is in `nodes/contracts.ts`, outside this brief.
3. **Item 4 wording lives in `llm/repeat-guard/candidate-feedback.ts`.** The brief's "the candidate submission-refusal wording" was read as this file, because it produces the text quoted in the debug ("change the lines those issues name"). `flow-bootstrap/candidate/submission-refusal.ts` was not changed.
4. **Line endings.** `plan/issue-feedback.ts` is stored in git with CRLF; a `sed -i` turned it to LF, and I restored CRLF. `git diff --stat` shows 38 lines for it.
