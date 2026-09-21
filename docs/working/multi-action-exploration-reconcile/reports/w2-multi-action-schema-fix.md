# w2-multi-action-schema-fix

## Outcome

Partial.

- **Medium finding: closed.** `evidence-batch/input-schema.ts` now checks the
  schema itself against the supported subset before it matches any value.
- **Low finding: not closed.** It cannot be fixed in the files this brief lets
  me own. The false sentence and the terminal stop are both outside
  `evidence-batch/`, and `stop.ts` plays no part in that path. The exact files
  and a one-line fix are under Open questions.

All changes are uncommitted in `F:\fxwork\t033\!FluxIQ` on
`task/t033-multi-action-reconcile`.

Core paths below are relative to
`packages/fluxiq/src/programs/automation-studio/runtime/`.

## What changed and why

### `llm/evidence-batch/input-schema.ts`

**The schema check the rereview asked for.**
`automationStudioLlmEvidenceInputMatchesSchema` now returns
`supportedSchema(schema, 0) && matches(input, schema, 0)`. The value matcher
runs only on a schema that passed.

`supportedSchema` walks the schema without looking at any value. It visits
every `oneOf`/`anyOf` branch, `items`, every `properties` value, and an object
`additionalProperties`. It refuses:

- unknown keywords;
- subschemas that are not objects: boolean `items`, boolean property schemas,
  and boolean `oneOf`/`anyOf` branches;
- tuple (array) `items`;
- an empty or non-array `oneOf`/`anyOf`, and a non-array `enum`;
- a `required` that is not an array of strings;
- a `type` that is not a known type name, or a non-empty array of them;
- length, item and property bounds that are not non-negative integers;
- `minimum`/`maximum` that are not finite numbers;
- a non-boolean `uniqueItems`;
- a `pattern` that is not a string or does not compile with the `u` flag;
- `additionalProperties` that is neither a boolean nor a supported schema;
- nesting deeper than 20 levels.

A key whose value is `undefined` counts as absent. JSON drops such a key, and
the matcher already skipped it.

**One source of truth for keywords.** The old `SUPPORTED_SCHEMA_KEYS` set is
replaced by a `SCHEMA_KEYWORDS` map from each keyword to the forms of it that
are allowed. The matcher's own key check reads the same map.

**Why this closes the `oneOf` turnaround.** A `oneOf` branch can now fail only
because the value does not match it, never because the matcher cannot read the
branch. The depth limit agrees too: a schema that passes is at most 20 levels
deep, so the matcher's `depth > 20` check can no longer reject a branch.

**Three more ways the same file failed open.** I found these while writing the
tests. All three are in the same file, so I fixed them too:

1. **`__proto__` got past `additionalProperties: false`.** `properties[key]`
   read inherited properties. So `JSON.parse('{"target":"x","__proto__":{}}')`
   found `Object.prototype` as the schema for `__proto__` and matched. This
   case can happen in practice. `decision.ts:80` calls `isInputValid` on the
   provider's parsed `call.input`, and `decision.ts:84` then `structuredClone`s
   it, which keeps the extra key. The matcher now reads only the schema's own
   properties (`Object.hasOwn`).
2. **`sameJson` said `-0` and `0` were different.** Inside `oneOf` this failed
   open: `oneOf: [{const: 0}, {type: "number"}]` accepted `-0`, although JSON
   Schema rejects it because both branches match. It is now `left === right`.
3. **String lengths were counted in UTF-16 code units.** This failed open for
   `minLength` 2 or more: one emoji passed `minLength: 2`. Inside `oneOf` it
   also failed open for `maxLength`. Lengths now count code points, as JSON
   Schema does.

### `llm/evidence-batch/tests/contract.test.ts`

The existing `describe` block is unchanged. A new block,
`"Automation Studio evidence input schema subset"`, adds 10 tests:

1. `oneOf` with an unsupported branch (the rereview's example): `4` is
   rejected.
2. An unsupported keyword that no value reaches:
   - in an `anyOf` branch that is never evaluated;
   - in an unused property;
   - nested inside `items`.
3. Tuple `items`, `items: false` and `items: true` reject every input,
   including `{}`.
4. Property schemas `false` and `true` reject every input.
5. 17 malformed shapes reject `{}`:
   - `required`, `properties` and `additionalProperties`;
   - property counts;
   - `maxLength`, `pattern` (both a non-string and one that does not compile)
     and `minimum`;
   - `type` (both an unknown name and `[]`);
   - `maxItems` and `uniqueItems`;
   - `enum`, `oneOf` and `anyOf`.
6. Depth: a value 20 levels deep matches its schema. One level deeper is
   refused.
7. JSON semantics:
   - `-0` is in `enum: [0]`;
   - `oneOf` with `const: 0` and `type: "number"` rejects `-0`;
   - `[0, -0]` is not unique;
   - two objects that differ only in key order are not unique;
   - one emoji passes `maxLength: 1` and fails `minLength: 2`;
   - a `oneOf` whose branches both match an emoji rejects it.
8. Own properties only: a `__proto__` key is rejected, and so is
   `constructor`.
9. The keyword forms today's tools use still behave as before:
   - the press schema's pattern, `uniqueItems` and enum `items`;
   - wait's integer `minimum`/`maximum`;
   - navigate's `minLength`/`maxLength`;
   - an empty closed object.
10. Exact `oneOf`, `anyOf`, `const`, type lists, schema-valued
    `additionalProperties`, and an `undefined` keyword read as absent.

### Behaviour kept

- **Singleton and default-one.** Nothing outside the matcher changed.
  Singletons never reach the matcher, and the default of one never builds a
  list, so neither behaves any differently.
- **Every schema offered today** passes the new check. These are the Core
  builtins in `llm/harness-options/builtin.ts` and the downstream
  `harness-options/options.ts` and `llm-evidence/tools.ts`, which I read.
  Test 9 passed against both the old and the new matcher.
- **One narrow change for current tools, in list mode only.** A `value` or
  `url` containing astral characters (emoji, for example) is now measured in
  code points against its `maxLength`. The old matcher counted those
  characters as two, so it rejected some strings the provider and JSON Schema
  both allow. Those strings are now accepted. Singletons already passed such
  strings straight to the executor, so this makes list items behave like
  singletons. `minLength: 1` gives the same result either way.

## Commands run and observed results

All run from `F:\fxwork\t033\!FluxIQ\packages\fluxiq` unless noted.

1. **Baseline, before any edit.**
   `npx vitest run .../evidence-batch/tests/contract.test.ts .../llm/tests/evidence-loop.test.ts`
   printed `Test Files 2 passed (2)`, `Tests 44 passed (44)`.
2. **New tests against the old matcher.** Same file, with the new tests added
   and `input-schema.ts` unchanged, printed `Tests 8 failed | 8 passed (16)`.
   - The failures were the 8 fail-open tests (1–8 above), each
     `expected true to be false`, except the JSON-semantics test's
     `expected false to be true`.
   - The two tests for behaviour kept (9 and 10) passed.
3. **After the fix.** Command 1 again printed `Test Files 2 passed (2)`,
   `Tests 54 passed (54)`: 16 contract tests and 38 evidence-loop tests.
4. **Wider regression set.** Every test file that mentions `tool_calls` or
   `maxActionsPerDecision`, plus all of `llm/tests`, `llm/harness/tests` and
   `loop-limits/tests`, printed `Test Files 35 passed (35)`,
   `Tests 407 passed (407)`. That covers:
   - `api/handlers/tests/llm-generation`;
   - `flow-bootstrap/tests/action-permissions`;
   - `recovery/tests/runtime-exploration` and `runtime-exploration-permission`;
   - `recovery/exploration-state/tests/state-record`;
   - `tests/service-bootstrap/tests/generation`.
5. **Type check.** `npx tsc --noEmit -p tsconfig.json` exited `0` with no
   output.
6. **Structure audit.** `node scripts/structure-audit.mjs` (from the Core
   root) printed `structure-audit: 1 violation(s) across 1 rule(s).` and
   exited 1. The one violation is
   `FAIL [file-lines] .../runtime/llm/evidence-loop.ts: 810 lines exceeds the 800-line limit`.
   - It was already there before my change:
     `git show HEAD:.../llm/evidence-loop.ts | wc -l` printed `810`, and I did
     not touch that file.
   - The audit reported nothing for `evidence-batch/`.
7. **Worktree state.** `git status --short` lists only my two files as
   modified: `evidence-batch/input-schema.ts` and
   `evidence-batch/tests/contract.test.ts`. `git diff --stat` printed
   `2 files changed, 226 insertions(+), 13 deletions(-)`.

## Not verified

- No live, provider, browser or panel run, as the brief says.
- I did not run the full Core `pnpm test`, `pnpm check` or build. I ran only
  the 35 files above, plus `tsc` and the structure audit.
- I did not trace whether any downstream executor measures `value`/`url`
  length in code units. If one does, a list item with astral characters near
  its bound is now refused by the executor instead of at parse. That is what a
  singleton already gets.

## Open questions or contradictions found

- **Low finding: needs files outside my ownership.**
  - The terminal stop is `recovery/exploration-budget.ts:306`:
    `if (this.actionCount + signatures.length > this.budget.maxActions) return this.stop("action_limit");`.
  - The false sentence is `recovery/runtime-exploration.ts:450`:
    `action_limit: "The exploration used every action it was allowed before it reached an answer."`.
  - `evidence-batch/stop.ts` only decides which item stops a list after that
    item has run. It is never consulted for the preflight.
  - **Smallest truthful fix:** change the sentence at `:450` to something
    true of both a singleton at the limit and an over-long list. For example:
    "The exploration asked for more actions than it had left before it reached
    an answer." The sentence appears once in `src`, and no test asserts it.
  - **The behavioural alternative:** cap the list schema's `maxItems` at the
    actions left. That touches `llm/evidence-loop.ts`, which builds the list
    schema once at `:594`, and that file is already over its line limit.
- **`pnpm check` will fail on t033 as it stands**, whatever this change does.
  Core's `llm/evidence-loop.ts` is 810 lines at `1433d90`, past the 800-line
  limit.
- **The rereview's remediation claim, updated.** "Rejects every schema keyword
  outside its explicit supported set" is now true everywhere:
  - inside `oneOf`;
  - in every form of a supported keyword the matcher does not implement;
  - in branches no value reaches.
