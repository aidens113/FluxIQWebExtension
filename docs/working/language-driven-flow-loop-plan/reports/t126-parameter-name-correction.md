# t126 — Parameter name correction in plan validation (Core, part 2 of 2)

## Outcome

Done, with one finding that decides whether the feature reaches live runs
(see *Open questions*, item 1: the authoring path refuses a near-miss
parameter key before validation ever sees it).

A parameter key the model wrote with a slip is now resolved against the
names its node declares, rewritten into the plan that is validated, laid
out, risked and returned, and recorded as an assumption. A key with no
plausible candidate is still refused as `bootstrap.unknown_parameter`, and
a corrected key faces every check a correctly written one faces.

## What changed and why

### New, in `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/`

- `name-correction.ts` — `correctAutomationStudioFlowBootstrapPlanNames({ plan, registry, resolution })`
  returns the plan with every parameter key resolved to a declared name, plus
  one assumption per resolution. It calls `automationStudioMatchName` from
  `nodes/name-match/` and contains no matching logic of its own: it decides
  only which candidates to offer and what shape the written value is.
  - **Candidates**: the node's declared parameters, each carrying `accepts`
    derived from its own `valueType` (`string`/`expression` → `text`,
    `array` → `list`, `object`/`json` → `record`, `number`, `boolean`, and
    `signal`/`policy`/`routine`/`any` → `unknown`, because a declaration that
    says nothing about shape must not read as a claim about it).
  - **`valueShape`**: derived from the value the model actually wrote — array
    → `list`, object → `record`, and so on. `null` and a state binding both
    report `unknown`, since neither says what the value is. That pairing is
    what makes the worked example work: two similarly spelled parameters, one
    a list, a list written under the name → the list one, assumed.
  - **A candidate already claimed is withdrawn.** A parameter written
    correctly, or resolved earlier on the same node, is removed from the next
    match, so a near miss can never displace a correctly written parameter and
    two misses cannot land on one name and lose a value between them.
  - **Nothing is copied when nothing is corrected.** A plan whose names were
    all written correctly comes back as the identical object.
- `name-correction-assumption.ts` — `AutomationStudioFlowBootstrapNameAssumption`:
  `kind: "parameter_name"`, `how: "normalized" | "nearest"`, `score`,
  `subflowKey`, `nodeKey`, `definitionId`, `parameterId`, `valueShape`, and
  `writtenName` only when the written key is identifier-shaped
  (`/^[A-Za-z0-9_.:-]{1,64}$/`). Every field is a closed code or an identifier
  the plan or the registry already holds, so an assumption can travel in a
  published record; there is no free text anywhere in it.

### Changed

- `plan/validation.ts` — the correction runs immediately after structural
  parsing and before any check, and **the corrected plan replaces `input.plan`
  throughout**: subflow and router validation, `automationStudioFlowBootstrapRouteIssues`,
  `layoutNodes`, `deriveRisk`, and the returned `validated.plan`. That is the
  difference between a validator that stops complaining and one that fixes the
  plan: `bootstrap-completion.ts` hands `validated.validated` on as
  `buildPlan`, so the corrected key is what is persisted and executed.
  `validated` gained an optional `assumptions` array, present only when
  something was assumed.
- `plan/index.ts` — publishes both new modules, with the reason: an assumption
  leaves validation on the accepted plan, so whatever records a run has to read
  the type, and a caller that builds a plan without validating it (a repair
  rewriting one node) should resolve names through the same pass.
- `plan/tests/issue-feedback.test.ts` — **a file the brief did not list as mine**;
  edited because the feature makes one of its rows assert the opposite of the
  required behaviour. The row "lists the parameters a node declares when the
  plan names one it does not" wrote `recordsOutput` for `recordOutput`, which
  is now corrected rather than refused, so the feedback was correctly empty and
  the test failed. The row now writes `screenshot`, which names nothing this
  node has, and a second row asserts that `recordsOutput` raises no issue at
  all. If the supervisor would rather this file were left alone, the change is
  four lines plus a comment and is easy to revert — but the suite is red
  without it.

### New tests — `plan/tests/name-correction.test.ts` (8 tests)

Fixture: `domain.demo.extract` with `items` (object, required), `maxRecords`
(number, `minimum: 1`), `filter-text` (string) and `filter-list` (array).
`filter-text` and `filter-list` are deliberately equidistant from the name the
tests write, `filter-rows` — they share one token with it and differ in the
other by four characters each — so every name signal scores them identically
and nothing but the value's shape can decide.

1. `maxRecord: 25` → the accepted plan carries `maxRecords: 25`, in both
   `validated.plan` and `validated.subflows` (the corrected key reaches what
   is built, not just what is judged).
2. The assumption is recorded exactly, field by field.
3. `maxRecord: 0` → `bootstrap.invalid_parameter_value` at
   `plan.subflows.0.nodes.0.parameters.maxRecords` — the correction moved the
   value into the slot and the slot's own `minimum: 1` then applied to it.
4. `{ items, item }` → `bootstrap.unknown_parameter` for `item`: `items` was
   written, so it is withdrawn and nothing is left that `item` plausibly names.
5. `filter-rows: ["red","blue"]` → `filter-list`; 6. `filter-rows: "red"` →
   `filter-text`. Same name, two values, two resolutions.
7. `banana: true` → `bootstrap.unknown_parameter`, `validated` undefined.
8. A correct plan: `result.validated.plan` is the same object
   (`toBe(plan)`), `assumptions` is absent, and `Object.keys(validated)` is
   exactly `["plan", "risk", "subflows"]`.

### Structural note — why there is no `plan/name-correction/` directory

The brief asked for a subdirectory. `scripts/structure-audit/rules/naming.mjs`
fails any non-test source file past `maxPathSegments: 9`, and
`.../flow-bootstrap/plan/<dir>/<file>.ts` is 10. The same rule's prefix-group
check has an explicit deadlock guard — `if (dir.split("/").length + 1 >= LIMITS.maxPathSegments) continue`
— which switches the "three files sharing a prefix must become a directory"
demand off for exactly this directory, because nesting it would be too deep.
So the repository's own configured answer here is flat files with a shared
prefix, and that is what I wrote: `name-correction.ts` and
`name-correction-assumption.ts` directly in `plan/`, published through the
directory's existing barrel. `node scripts/structure-audit.mjs` reports no
finding against either file.

## Commands run and observed results

```
cd F:\!FluxIQ\packages\fluxiq
npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/name-correction.test.ts
  ✓ .../plan/tests/name-correction.test.ts (8 tests) 11ms
  Test Files  1 passed (1)
       Tests  8 passed (8)
```

```
npx vitest run src/programs/automation-studio/runtime/flow-bootstrap
  Test Files  21 passed (21)
       Tests  278 passed (278)
  Duration  4.48s
```

(The first run of that suite had one failure —
`issue-feedback.test.ts > lists the parameters a node declares when the plan
names one it does not`, `expected [] to deeply equal [ { …(3) } ]` — which was
the behaviour change described above. Fixed as described; the 278-pass run is
after the fix.)

```
npx tsc --noEmit
  tsc: no errors
```

```
npx vitest run src/programs/automation-studio     # wider sweep, not required by the brief
  Test Files  2 failed | 331 passed (333)
       Tests  4 failed | 3014 passed | 1 skipped (3019)
```

Both failures are pre-existing on `dev` and unrelated to this work:

- `runtime/tests/deepseek-bootstrap-exploration.test.ts` (2 tests) — every
  evidence-trace row now carries an `at` timestamp the expectations do not
  list (`+ "at": 1790366532976`). The field is written by
  `runtime/service/flow-bootstrap-commands/evidence-trace.ts:81`, which
  `git diff HEAD` shows unmodified, and it arrived with commit `68422a1`
  "A refusal says which refusal it was, and every row says when". Nothing in
  this task touches evidence traces.
- `api/handlers/tests/flows.test.ts` — `SQLITE_CORRUPT: malformed database
  schema`. **Passes in isolation** (`4 passed`, re-run below), so it is
  contention in the parallel run, not a code failure.

```
npx vitest run src/programs/automation-studio/api/handlers/tests/flows.test.ts
  Test Files  1 passed (1)
       Tests  4 passed (4)
```

```
cd F:\!FluxIQ && node scripts/structure-audit.mjs
  FAIL  [file-lines] .../runtime/llm/evidence-loop.ts: 889 lines exceeds the 800-line limit.
  structure-audit: 1 violation(s) across 1 rule(s).
```

`evidence-loop.ts` is unmodified by this task (`git diff HEAD` empty), so
`pnpm check` is already red on `dev` for that reason. No finding against any
file in this task.

Not run: `pnpm --filter fluxiq build`, as the brief instructed (a live run is
reading Core's `dist`). **Nothing in this task is in `dist` yet.**

## Not verified

- **No live provider run.** Nothing here was exercised against a real model or
  a real Flow creation; the evidence is unit-level.
- **The assumption's onward journey.** It is attached to `validated` and
  therefore to `buildPlan`, and I confirmed by reading that
  `harness-options/bootstrap-completion.ts` passes `validated.validated`
  straight through as `buildPlan`. I did not trace it further into the run
  record, and **nothing currently reads `assumptions`** — no persistence, no
  evidence row, no model feedback. Making a run's record say a name was
  assumed is a follow-up someone has to do deliberately.
- **Node ids and output ids.** Out of scope for this half. The sibling added
  `AutomationStudioNodeRegistry.matchDefinition`, but `validation.ts` still
  resolves a node with `registry.get`, so a near-miss *definition* id is still
  `bootstrap.definition_unavailable`. If that is wired up later, the parameter
  correction must run against the definition that was matched, not the one
  that was named.
- **The `flow-bootstrap` suite is green, and the wider automation-studio sweep
  is green apart from the two pre-existing failures above.** I did not run the
  repository-wide `pnpm test` or `pnpm check`.

## Open questions or contradictions found

### 1. The authoring path refuses a near-miss key before validation sees it — so the feature does not reach the live creation path as it stands

Both acceptance routes normalise parameters through
`authoring/normalise.ts`, which raises `bootstrap.unknown_parameter` itself at
line 55 when `matchAuthoringParameter` finds nothing:

```ts
if (!inside) {
  issues.push(authoringError("bootstrap.unknown_parameter", "Node parameter is not declared by its definition.", `${input.path}.parameters.${key}`));
  continue;
}
```

`matchAuthoringParameter` matches a key exactly against an id, exactly against
a label, or through a fixed synonym table, all folded through `authoringKey`
(lower case, letters and digits only). So it already absorbs `dataset_id` ≈
`datasetId`, but a typo — `maxRecord` for `maxRecords` — finds nothing and is
refused at acceptance. `json-plan.ts` states in its own header that every
parameter still goes through `normaliseAuthoringNodeParameters`, so the JSON
route refuses it too. The existing tests confirm the behaviour:
`authoring/tests/accept.test.ts` "still refuses a key that names no parameter".

**Consequence**: validation's correction fires only for a caller that
validates a plan directly. A live build that writes a Flow script — the main
path — still dies on the slip the task exists to remove.

**Recommendation** (one file, small): give `matchAuthoringParameter` a final
fallback to `automationStudioMatchName` over the node's declared parameters,
with `valueShape` derived from the written value exactly as
`name-correction.ts` does, and return the resolved parameter. Validation's pass
then stays as the backstop it is, and both halves use one matcher. The piece
that needs a decision is where the authoring-stage assumption is recorded, since
`normaliseAuthoringNodeParameters` returns `{ parameters, issues }` and has no
channel for one; the cheapest answer is to let authoring rewrite the key and
leave validation to notice nothing, accepting that the assumption is lost, or
to widen that return by one field. I did not make this change: `authoring/` is
not in my brief's owned paths.

### 2. The matcher's score floor cannot admit a near miss that shares no whole token

Measured against the real matcher with a realistic parameter set
(`target`, `text`, `timeoutMs`, `maxRecords`, `recordOutput`, `extractList`):

```
targe          -> undefined
tagret         -> undefined
maxrecords     -> undefined
maxRecord      -> {"id":"maxRecords","how":"nearest","score":0.602}
recordsOutput  -> {"id":"recordOutput","how":"nearest","score":0.607}
record_output  -> {"id":"recordOutput","how":"normalized","score":1}
extract_list   -> {"id":"extractList","how":"normalized","score":1}
extractLists   -> {"id":"extractList","how":"nearest","score":0.606}
timeout        -> {"id":"timeoutMs","how":"nearest","score":0.825}
banana         -> undefined
screenshot     -> undefined
fields         -> undefined
```

The absent names are correctly rejected and the multi-token misses are all
comfortably above the 0.25 floor. But where the two names share no *whole*
token, containment and Dice are both 0 and only the edit term contributes, at
weight 0.25 — so the score is at most `0.25 × (1 − distance/maxLen)`, which
**can never reach the 0.25 floor**. That is precisely the case the brief opens
with: `targe` for `target` is not corrected, nor is the transposition
`tagret`, nor the run-together `maxrecords` for `maxRecords` — all three are
things a model plausibly writes, and all three still fail the whole build.

The floor was calibrated on node ids (`web.output.dom-*`, `builtin.*`), which
are always multi-token, so the two bands it measured do not describe parameter
ids, which are frequently one token. `nodes/name-match/` is the sibling's, so I
changed nothing; the fix is theirs to judge. The shape of it, if it is wanted:
let the edit term carry a name on its own when both names are single tokens —
for instance, score a single-token pair by edit similarity alone against a
higher floor (`targe`/`target` is 0.833, `banana`/`target` is 0.167, so the
bands are still wide apart) — rather than lowering the global floor, which
would start admitting genuine nonsense.

### 3. Nothing consumes `assumptions` yet

The type is published and the data is attached to the accepted plan, as the
brief asked. Making a run's evidence actually *say* "this name was assumed"
needs a reader: a field on the stored build, an evidence row, or a line in the
summary the model sees. Worth a follow-up task, otherwise the record exists and
nobody looks at it.
