# t502 fields-refusal-names-columns: worker report

## Outcome

Done. If a name in a read's `fields` matches none of the columns, the refusal now carries
`{code: "web.handle.unknown_field", field, valid}`, the same shape conditions already used.
Core's advice now lists the valid names. When the refusal shows the detection is out of date,
Core says to detect the list again and no longer says the handle is right.

## What changed and why

Domain (`domain/src/runtime/llm-evidence/plan-resolution/extraction/`):

- **New `unknown-column-issues.ts`.** `webPlanUnknownColumnIssues(named, valid, detected)` builds the issues
  for a name that matches no column. It is shared by `fields` and by `where`.
  - It always returns the `unknown_field` issue, carrying the name as written and the names the step can use.
  - It adds `{code: "web.handle.columns_changed", field}` only when there is evidence the detection is out of
    date: the written name is one of the detected columns with one part swapped
    (`webExtractionNameSwapsPart`, the t497 matcher rule). That is the shape of a key taken from the same item
    after an act gave it a new column, which is D1's case.
  - That issue has no `valid`, because Core reads `valid` as "write one of these", and the column it resembles
    is exactly the one not to write.
  - Everything goes through `webPlanBoundedIssues`, so Core's bounds apply. A written value that is not an
    identifier, such as `Card 4111`, is still left out and never quoted.
- **`columns.ts`.** The failure type now has an optional `issues`. In the second pass, when an entry still
  matches no column, `unknownColumn()` builds the refusal through `present()`. Its `issues` are built from the
  entry's written name (`nameWritten()`/`objectName()`, which follow how `readColumn` reads the name, before any
  `@attribute`) and every detected column. An entry that wrote no single name is refused by position alone, as
  before.
- **`slot.ts`.** The `fields` and `where` failures both go through a new `refusedWith()` helper, which uses
  `present<Refused>` with no conditional spreads. Its header comment is updated.
- **`slot-refusal.ts`** was already passing `issues` through, so it is unchanged.
- **`conditions.ts`.** `unknownColumn` now calls `webPlanUnknownColumnIssues`, so a swapped condition also
  carries `columns_changed`. Its import and header comment are updated.

Core (`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/candidate/submission-refusal.ts`):

- `handleAdvice` now gathers each reason's `field` and `valid` names from the issues, keeping only
  identifier-shaped names, and passes every advice function `{reasons, fields, valid}`.
- **`unknown_field` advice** quotes "The names this step can use there are …", capped at 24 names with a count
  of the rest.
  - **When a `columns_changed` issue is present:** it drops "The list X is right, so changing its handle will not
    help" and the condition sentence. It lists the old columns instead, as "the columns the list had when it was
    detected".
- **New `columns_changed` advice.** It names the written key and the list, and says the items have changed since
  the detection. It ends with "Detect the list again on the page as it is when the step runs, then name the list
  by the handle that detection prints and the column by a key it prints."
- The decision depends only on an issue in the refusal; nothing is inferred. The header has a new t502
  paragraph.

Tests, all with generic names and written fail-first:

- New `extraction/tests/fields-refusal.test.ts`, 3 tests. All failed before the fix.
- New Core tests in `submission-refusal.test.ts`:
  - `columns_changed` was added to the `ADVICE_WORDS` exclusivity loop.
  - A test for the valid names, which must appear once each.
  - A test for the stale-detection advice.
  - An end-to-end test: a domain refused answer goes through Core's controller, parameter resolution and issue
    feedback, and the resulting `next` is checked.
  - The first three failed before the fix.
- Updated expectations that used to assert there were no issues:
  - `column-match.test.ts`, through a new `unknownAt` helper;
  - `slot.test.ts`, in two places, written without spreads to satisfy `contract-spread`;
  - `swapped-condition.test.ts`, which now expects `columns_changed`.

## Commands run and observed results

- **Before the fix:**
  - `DOMAIN_TEST_BUILD_LABEL=t502 node scripts/test-domain.mjs extraction/tests/fields-refusal` gave `# pass 0`,
    `# fail 3`.
  - Core `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate` gave 3 failed and 133
    passed.
- **Domain typechecks.** `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit`, both
  run in `domain`, printed nothing and exited 0.
- **Domain tests.** `DOMAIN_TEST_BUILD_LABEL=t502 node scripts/test-domain.mjs runtime/llm-evidence output-nodes`
  gave `# tests 1260`, `# pass 1260`, `# fail 0`. The first run after the change had 7 failures; all were the old
  "no issues" expectations, which I then updated.
- **Core tests.** `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate`, run in
  `packages/fluxiq`, gave 16 test files passed and 137 tests passed.
- **Core typecheck.** `npx tsc --noEmit`, run in `packages/fluxiq`, printed nothing and exited 0.
- **Structure audits.**
  - Downstream `node scripts/structure-audit.mjs` first failed `contract-spread` in `slot.test.ts` at lines
    354 and 414. After the fix it printed `structure-audit: passed (190 warning(s), 646 baselined)`.
    `slot.test.ts` was already over 400 lines, and that warning is advisory only.
  - Core `node scripts/structure-audit.mjs` printed `passed (340 warning(s), 1159 baselined)`. It also says that
    2 baseline entries could be lowered; those are not mine.

## Not verified

- No live, Lab or provider run. Whether the model now detects again in the D1 situation has not been tested.
- The domain-to-Core hop was tested with a stub binding in Core's controller test. It was not tested with the
  real domain runtime feeding Core in a single process.
- Whether `web.handle.columns_changed` fires on real round-16 keys has not been checked against the captured
  run. It is covered only by generic keys of the same shape.

## Open questions or contradictions found

- **New code with no registry entry.** `web.handle.columns_changed` is a detail-only issue code. It is not in
  `WEB_PLAN_HANDLE_ISSUE_CODES` (`resolve-plan-node.ts`, which this brief did not let me edit).
  - Core keeps an unmatched detail as an issue of its own, so it reaches the model with its own message and
    handles. This also enters the refusal-run digest.
  - If the supervisor wants the code declared beside the others, that needs `resolve-plan-node.ts` and its
    code-list test.
- **When the stale advice fires.** The evidence is "the name is a sibling of a detected column". A
  hand-invented sibling name, such as `record_outcome` against `record_label`, also gets the advice to detect
  again. The advice still lists the old columns, so the model has both ways out.
- **Quoting what the model wrote.** As with t489/t497, a written name made only of identifier characters is
  quoted back as `field`; anything else is left out.
