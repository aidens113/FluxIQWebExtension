# t193-1002m-w8: consequences written inside parameters

## Outcome

Done. A `core.run_node` call that writes its `consequences` inside `parameters`, and has no top-level value, now runs as if it had written them beside the parameters.

## What changed and why

Cause R2-C1 (`run-murzln6g-11debe1d`, steps 0011/0034/0043): three presses were refused `invalid_input` / `missing_input_keys` because the declaration was one level too deep. Each resend cost a paid decision.

- New `domain/src/runtime/llm-evidence/node-run/nested-consequences.ts` exports `webNodeCallWithDeclarationBeside(value, node)`. It changes the call only when all four of these hold:
  - the top-level `consequences` is undefined or null;
  - `parameters` is a record with its own `consequences` key;
  - the node's `definition.parameters` declares no parameter with id `consequences`;
  - then the key is moved out of `parameters` to the top level.
  Otherwise it returns the call unchanged. The header names the run and the three wasted decisions, and says it forgives where a declaration is written, never whether one is.
- `run.ts` (+3 lines, 795 of the 800-line limit): `value` is now `let`, and it is normalized once, right after the catalog resolves the node and before `record`, `parameters`, the CALL_KEYS check, the observation path, the missing-declaration refusal, `webActionPermission({declared})`, `safeCall`/`nodeCall` (`input`, `ranWith`, `standing`) and every `refusal(...record)`. All readers below therefore see the same call. Replay calls (Core's) return before this point and are untouched.
- Tests went into the existing `node-run/tests/unwritten-consequences.test.ts`, because that `tests/` folder is already at the 25-file limit. There are 4 new tests: nested `[]` (accepted; the click command's parameters lack `consequences`; `input` and `ranWith` carry `[]` at the top level with the parameters stripped); nested `["modify_existing"]` (the permission check receives `["modify_existing"]`); nothing anywhere (still `missing_input_keys`, no click); top-level `[]` plus nested `["modify_existing"]` (the check receives `[]`).

## Commands run and observed results

Failing first, before the fix: `node <scratchpad>/t193-1002m-w8-scoped-tests.mjs . src/runtime/llm-evidence/node-run/tests/unwritten-consequences.test.ts` (cwd `domain`):
```
not ok 5 - a press declaring [] inside its parameters runs, recorded with [] beside the parameters
  expected: 'web.action.succeeded'
  actual: 'web.action.rejected.invalid_input'
not ok 6 - a nested ["modify_existing"] reaches the permission check as the call's declaration
# pass 6
# fail 2
```
Tests 7 and 8 passed before the fix too. They guard behaviour that must not change.

After the fix (cwd `domain` unless noted):
- `npx tsc -p tsconfig.json --noEmit` -> exit 0
- `npx tsc -p tsconfig.test.json --noEmit` -> exit 0. The first attempt failed because `parameterSchema` does not exist on `AutomationStudioNodeDefinition`. Fixed to read `definition.parameters[].id`.
- `node <scratchpad>/t193-1002m-w8-scoped-tests.mjs . src/runtime/llm-evidence/node-run src/runtime/llm-evidence/tests` -> `running 53 test files`, `# tests 365`, `# pass 365`, `# fail 0`
- `node scripts/structure-audit.mjs` (repository root) -> `structure-audit: passed (159 warning(s), 118 baselined).`

## Not verified

- No test covers a node that really has a `consequences` parameter, because no web node declares one. That branch is covered only by reading the code.
- When a top-level value is present, a nested `consequences` stays in `parameters` as written and is sent to the node. This matches the behaviour before the change, and the brief asked only that the top-level value wins.
- No live run. Core's `ranWith` reader was not run.

## Open questions or contradictions found

- `run.ts` is at 795 of the 800-line limit. The next addition to it will need an extraction first.
- The working tree holds other workers' uncommitted changes (extension, test-runner, failure codes, `replay-ambiguous-target.test.ts`, `page-refusal.test.ts`). None of them are mine.
