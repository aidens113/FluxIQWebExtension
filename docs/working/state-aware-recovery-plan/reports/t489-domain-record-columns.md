# t489 domain half: record columns, one truth

Worker report. Tree `C:/Users/osrs_/FluxStuff/fxwork/t489/!FluxIQWebExtension`, branch `task/t489-record-columns-one-truth`. Core was not edited. Nothing was committed.

## Outcome

**Done** for items 1, 2 and 4. **Done with a caveat** for item 3: the page is stated in the read account that a node run gives the model, and the page number is taken from the page's address. See "Open questions".

**Continuation (supervisor decisions a to c): Done.** One limit remains: at submit, the issue still crosses into Core as encoded strings. A Core file would have to change to carry objects there, and I did not edit Core. See below. Where this section differs from the original report further down, this section is current. In particular:
- The dispatch's `outputs.error.issues` is now a list of objects, not `["record_output.column_not_read"]`.
- The submit codes are now built from those objects, so their order is names first, then any other code, then the read's keys.

**Final step (Core now accepts `issues` on a refused answer): Done.** This section supersedes both earlier sections wherever they differ. In particular, the encoded codes `web.handle.unknown_field.name:<field>` and `web.handle.expected.read_column:<key>` are gone.

## Final step: issue objects across the submit boundary

### What changed

- **The refused answer carries issues.** `plan-resolution/resolve-plan-node.ts:refusal()` now puts `issues: [{code, field?, valid?}]` on the refused answer beside `issueCodes` (type `WebPlanRefusalIssue`). It only appears when at least one refusal carries issues.
  - For a column refusal, each issue is `{ code: "web.handle.unknown_field", field: <the unread name>, valid: <the read's column keys> }`, built from the same `webAutomationStoredColumnIssues` the dispatch emits at run time.
  - For any other dispatch refusal, the issue is the dispatch's own issue that carries a field or names, and the dispatch's Core codes stay in `issueCodes`.
- **The encoded codes are dropped.** No pinned contract needs them any more, now that Core reads `issues`.
  - `issueCodes` stays for compatibility: the reason, the shape hint, the positions, and for a non-column dispatch refusal its bare `record_output.*` codes.
  - The node-run readers (`node-run/run.ts`, `verify.ts`, `replay.ts`, and `tool-rejection.ts:webLlmHandleRejectionReason`) still read only `issueCodes`. For revision 4 they get the same reason they did before.
- **Core's bounds are held in the domain** (`plan-resolution/extraction/stored-columns.ts:bounded`), so Core drops nothing it is sent:
  - at most 16 issues;
  - each code matches `/^[a-z0-9_.:-]{1,100}$/i`;
  - `field` and each name in `valid` match `/^[A-Za-z0-9_.:-]{1,200}$/`;
  - `valid` is cut at 64 names.
- **The dry dispatch now runs for a Flow step only** (`scope.step`), not for a node a caller runs now (`gatedByCaller`, i.e. `core.run_node`).
  - That node's real dispatch runs a moment later. Its failure (`record_output.invalid`, with `{code, field, valid}` issues and `failure.actual` naming the field) says more than a resolver refusal would: the node-run path turns a resolver refusal into a handle refusal (`target_unobserved`) and reads only `issueCodes`.
  - This change was mine, not requested. It is tested.
- **Size.** `resolve-plan-node.ts` is now exactly 800 lines, the file-line limit. It passes, but there is no room left for the next change.

### Where the object crosses into Core

- On the domain side, it crosses through `resolveWebPlanNodeParameters`, passed through unchanged by the runtime binding's `resolvePlanNodeParameters` in `domain/src/runtime/llm-evidence/tools.ts`.
- On the Core side, `runtime/llm/harness-options/plan-parameter-resolution.ts` (`resolveNode`, then `refusalDetails` and `refusalIssues`) reads it. It attaches each detail to the first code it fits (here the reason `web.handle.unknown_field`) as `detail` with Core's sentence (`flow-bootstrap/plan/issue-feedback.ts:automationStudioFlowBootstrapIssueDetailSentence`).

### Tests

All of these are in `plan-resolution/extraction/tests/stored-columns.test.ts`.
- **Revision 4 at submit:**
  - `issueCodes` is exactly `[web.handle.unknown_field, web.handle.expected.extract_list.handle_fields, web.handle.unknown_field:recordOutput.schema.fields.1.id]`.
  - `issues` is exactly `[{code: "web.handle.unknown_field", field: "mutualFriends", valid: <the 7 detector keys>}]`.
  - The field and keys equal the dispatch's run-time issue.
- **New cross-boundary test:**
  - Revision 4 runs through Core's own `resolveAutomationStudioFlowBootstrapPlanParameters`, with this domain runtime as its binding, as a one-node plan.
  - Then `automationStudioFlowBootstrapIssueFeedback`.
  - The model-facing message of the `web.handle.unknown_field` entry contains `"mutualFriends"` and every one of the 7 column keys, quoted.
  - It contains none of the detection's page-text labels ("Tom Becker", "1 mutual friend", "Confirm", "Delete"). For this, the fixture now carries step 0032's real labels.
  - Both Core functions come from the rebuilt `fluxiq/automation-studio`.
- **Agreement table.** All 8 pinned outcomes still hold. For each refused case, every field the dispatch's issues name now appears among the submit answer's `issues[].field`.
- **New bounds test.** A literal read of 70 columns with a record output naming `zzz` gives one issue whose `valid` is exactly the first 64 keys.
- **New node-run test.** A `gatedByCaller` resolution of revision 4 resolves, and its dispatch refuses with `failure.actual` naming `mutualFriends`.

### Commands run for the final step

- `cd domain && npx tsc -p tsconfig.json --noEmit` gave `src=0`.
- `cd domain && npx tsc -p tsconfig.test.json --noEmit` gave `test=0`, with no output.
- `DOMAIN_TEST_BUILD_LABEL=t489-domain node scripts/test-domain.mjs plan-resolution/extraction/tests/stored-columns` gave `# tests 7 # pass 7 # fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=t489-domain node scripts/test-domain.mjs output-nodes/extract-list/tests plan-resolution/tests plan-resolution/extraction/tests node-run/tests output-nodes/tests llm-evidence/tests/` gave `# tests 800 # pass 800 # fail 0 # cancelled 0`.
- `node scripts/structure-audit.mjs` gave `structure-audit: passed (188 warning(s), 646 baselined)`, plus "1 baseline entries can be lowered" (not updated, because the baseline is a shared file).

### Not verified in the final step

- I did not print the exact Core sentence. Its form, from Core's source, is: `The domain that runs this step refused it (web.handle.unknown_field). It names "mutualFriends", which the step cannot use there. The names it can use there are "<key>", …: write one of those instead.` The test asserts the field and every key appear in it.
- No Lab, provider or browser run.

## Continuation: decisions a to c

### (a) Rule for what a refusal may name

The header of `plan-resolution/issue-position.ts` now states the rule:
- A refusal may name a field the model itself wrote, and may list a read's column keys. Both are structure.
- It never carries a cell value, a sample, a label's page text, or any other text the page holds.

### (b) One issue shape

**The shared type and function.** `output-nodes/extract-list/stored-columns.ts` adds:
- the type `WebAutomationRecordOutputIssue = { code: string; field?: string; valid?: string[] }`;
- the function `webAutomationStoredColumnIssues(unread, columns)`. For each unread name it returns `{ code: "record_output.column_not_read", field: <name>, valid: <the read's column keys> }`. A name written in a `process` also gets `{ code: "record_output.process_unknown_field", field: <name> }`.

**At run time** (`output-nodes/extract-list/dispatch.ts`):
- The column refusal's `outputs.error.issues` is exactly that function's result.
- Core-parser refusals (`recordOutputRefusal`) now emit `{ code }` objects instead of bare strings, so every issue the node emits has the one shape.
- Core's reader is the Core half's `packages/fluxiq/src/programs/automation-studio/runtime/service/candidate-trial/step-issues.ts`, which is in the Core worktree and not yet built into what this tree links. It accepts strings or `{code, field?, valid?}`, with field and valid names matching `/^[A-Za-z0-9_.:-]+$/` and at most 120 characters. The detector keys and the model's names pass that check, and a test asserts they do.
- In the domain, the only reader of `outputs.error.issues` was my own dry-dispatch reader. It now accepts both objects and strings (`issueOf`). The one other domain consumer, the assertion in `one-page-read.test.ts`, was updated.

**At submit: stopped at a Core file.**
- A resolver answer crosses into Core through `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/plan-parameter-resolution.ts` (`resolveNode`).
- It accepts a refusal only as `exactKeys(answer, ["status", "issueCodes"])`, keeps only string codes matching `ISSUE_CODE = /^[a-z0-9_.:-]{1,100}$/i`, and caps them at `MAX_REFUSAL_CODES = 16`. The binding's answer type is `{ status: "refused"; issueCodes: string[] }` in the same file.
- The Core half has not changed this file (`git diff --stat -- llm/harness-options/` is empty in `../!FluxIQ`). An object there would refuse the whole node as `bootstrap.parameter_resolution_invalid`.

So the encoded strings stay **only at submit**, because this pinned Core contract still requires them. They are no longer composed separately: `plan-resolution/extraction/stored-columns.ts:webPlanIssueCodes` builds them from the same `WebAutomationRecordOutputIssue[]` the dispatch emits, as follows:
- a column issue becomes `web.handle.unknown_field.name:<field>` plus `web.handle.expected.read_column:<key>` for each key in `valid`;
- any other issue becomes its bare code;
- names come first, then other codes, then keys, so Core's 16-code cap cuts keys before it cuts a name.

To carry the object at submit, `plan-parameter-resolution.ts` would need to accept an `issues: {code, field?, valid?}[]` beside `issueCodes` on a refused answer and pass it to the bootstrap issue. When it does, the change on the domain side is to put the same `WebAutomationRecordOutputIssue[]` on the refused answer in `resolve-plan-node.ts:refusal()`.

### (c) Flows saved before t489

The loud failure is kept unchanged: `record_output.invalid` with `column_not_read` issues that name the field and the valid keys.

### Tests changed

- **`output-nodes/extract-list/tests/stored-columns.test.ts`**:
  - The dispatch issue is asserted as `[{ code: "record_output.column_not_read", field: "mutualFriends", valid: <7 keys> }]`.
  - Every name in it is asserted to pass Core's identifier check.
  - A new test covers a name written only in a `process`, which gives `column_not_read` plus `{ code: "record_output.process_unknown_field", field }`.
- **`plan-resolution/extraction/tests/stored-columns.test.ts`**:
  - The revision-4 test now also asserts that submit's detail codes are exactly the encoding of the dispatch's issue objects.
  - The 8-case agreement table still pins every outcome: revisions 4, 5, 7 and 8 are refused; the detector keys throughout, `fields: {name, mutualFriends}`, `name` alone and no record output resolve.
  - For each refused case, the table also asserts that every `field` the dispatch's issues name appears at submit as `web.handle.unknown_field.name:<field>`.
- **`output-nodes/extract-list/tests/one-page-read.test.ts`**: the issue assertion reads `{code}` objects.

### Commands run for the continuation

- `cd domain && npx tsc -p tsconfig.json --noEmit` gave `src=0`.
- `cd domain && npx tsc -p tsconfig.test.json --noEmit` gave `test=0`, with no output.
- `DOMAIN_TEST_BUILD_LABEL=t489-domain node scripts/test-domain.mjs output-nodes/extract-list/tests plan-resolution/tests plan-resolution/extraction/tests node-run/tests output-nodes/tests llm-evidence/tests/` gave `# tests 797 # pass 797 # fail 0 # cancelled 0`.
- `node scripts/structure-audit.mjs` gave `structure-audit: passed (188 warning(s), 646 baselined)`, plus "1 baseline entries can be lowered". I did not run the baseline update.

### Not verified for the continuation

- The Core reader `step-issues.ts` was not run against these issues. The Core worktree's change is not built into the linked `fluxiq` package here, so the shape compatibility was checked by reading its source and by the identifier-pattern assertion only.
- The submit-side object shape needs a Core change, which I did not make.

## What changed and why

### Items 1 and 2: one function decides the stored columns

- **New `domain/src/output-nodes/extract-list/stored-columns.ts`, `webAutomationStoredColumns(recordOutput, request)`.** This is the one decision. It collects every name the record output writes for a column, in this order: `schema.fields[].id`, then `process.columns`, `process.where[].field`, `process.sort[].field` and `process.dedupe.by`. Each name is then looked up among the read's own columns:
  - A field key is that column.
  - Any other name goes through the existing column matcher, strict readings first and guesses second, and a guess is made only among columns that no exact name took. The matched column is renamed in the read to the author's name. The rename covers the field map and the read's own `where`, `sort` and `dedupe`, which is exactly what `fields: {name: "<key>"}` would have said.
  - A name that no column answers to, or that could not be a field key, comes back as `unread`, together with the read's columns.
- **The column matcher moved** from `runtime/llm-evidence/plan-resolution/extraction/column-match.ts` to `output-nodes/extract-list/column-match.ts`, unchanged apart from its header and imports. Without the move, the dispatch (in `output-nodes`) would have had to import upward from `runtime/llm-evidence`. The resolver-only type `WebExtractionColumnAssumption` moved into `plan-resolution/extraction/columns.ts`. `columns.ts`, `conditions.ts`, `slot.ts` and the `extraction` barrel now import from those places.
- **Dispatch (`output-nodes/extract-list/dispatch.ts`)** now calls `webAutomationStoredColumns` before anything else.
  - **Unread names:** the node fails before the page is read, with `record_output.invalid` and issues `["record_output.column_not_read"]`. When a `process` path is among the unread names, `record_output.process_unknown_field` is added. `failure.expected` lists the read's columns and `failure.actual` lists the unread names; both are bounded at 900 characters.
  - **Renamed read:** that read is what is sent and what the schema is reconciled against. This removes the silent "store under the raw keys" path.
- **Submit (`plan-resolution/resolve-plan-node.ts`):**
  - For a resolved `extractList` slot, `webPlanStoredColumns` writes the renamed read into the Flow. Its guesses are reported as assumptions at `recordOutput.…`.
  - When there are no other refusals, every extraction node is put through `webPlanUndispatchable`, which is a dry run of the node's own dispatch. Both functions are in the new `plan-resolution/extraction/stored-columns.ts`.
  - Unread names are refused with these codes:
    - the reason `web.handle.unknown_field`, plus the existing hint `web.handle.expected.extract_list.handle_fields`;
    - `web.handle.unknown_field:recordOutput.schema.fields.1.id`, one per name;
    - `web.handle.unknown_field.name:<name>`;
    - `web.handle.expected.read_column:<key>`, one per read column.
  - Any other dispatch refusal is refused as `web.handle.malformed:recordOutput`, carrying the dispatch's own Core codes (for example `record_output.process_invalid_limit`).
  - `refusal()` now appends `details` after the positions, still capped at 16 codes.
- **`issue-position.ts`** quotes `schema`, `process` and `id` as grammar keys.
- **`resolve-plan-node.ts`** is now 796 lines; the limit is 800. I shortened two comment paragraphs to make room.

### Item 3: the read says which page it read

- **New `node-run/shown-rows/read-page.ts`.** `account.ts` adds `page` to a list read's account, ahead of `origin` and `firstRows`. It is one sentence:
  - with a number: "This read read page 2 of the list by its address, <url>; pagesRead (1) counts the pages this one read went through, not which page it was."
  - without one: "…the page at <url>, whose address states no page number".
- The number is read only from the query parameters `page`, `pg`, `paged`, `pageNumber` and `page_number`, or from a `/page/<n>` path segment. `p` is deliberately not read. A read that is not a list gets no `page`.

### Item 4: a bare `extraction.N` for `nextPage`

- **`next-page-slot.ts`** reads a lone extraction handle, whether bare or written `{handle, location?}` (which is the shape the script format turns `nextPage: extraction.1` into), as `{list: …}`.
- A lone target handle is still refused as `web.handle.malformed`, beside `web.handle.expected.next_page.list_control`.

### Tests

New:
- `output-nodes/extract-list/tests/stored-columns.test.ts`
- `plan-resolution/extraction/tests/stored-columns.test.ts`

Rows were added to:
- `plan-resolution/tests/next-page.test.ts`: the row `["extraction.1", "nextPage"]` moved from "malformed" to "accepted", and a new test was added.
- `node-run/tests/shown-rows.test.ts`: the key order now includes `page`, and a new test was added.

`declared-columns.test.ts` was updated because the behaviour changed on purpose: a schema naming `link` now renames the url column to `link` instead of leaving the read as written.

## Commands run and observed results

- **Fail-first.** I backed up `domain/src` to the scratchpad, restored every changed source file from `HEAD` while keeping the new tests, and ran:
  `DOMAIN_TEST_BUILD_LABEL=t489-failfirst node scripts/test-domain.mjs plan-resolution/tests/stored-columns plan-resolution/tests/next-page node-run/tests/shown-rows`
  - Result: `# tests 19 # pass 12 # fail 7`.
  - The failures were the run-mv66sc3c replay (at HEAD, revision 4 came back `{"status":"resolved",…}`, which is the bug), the agreement table, the rename, the dry-dispatch refusal, the bare `nextPage` test and both read-page tests.
  - The `output-nodes` new test imports the new module, so it cannot build at HEAD.
  - The backup was then restored, and `git status` matched the pre-check state.
- `cd domain && npx tsc -p tsconfig.json --noEmit` printed nothing, `exit=0`.
- `cd domain && npx tsc -p tsconfig.test.json --noEmit` gave `exit=0` after one fix: a detail-code type that I widened to include `record_output.${string}`.
- `node scripts/structure-audit.mjs` gave `structure-audit: passed (188 warning(s), 646 baselined)`, plus "1 baseline entries can be lowered".
  - The first run had 4 findings, all in my files: `as-never` twice, one `contract-spread`, and `plan-resolution/tests/` at 26 files. I fixed all four; the submit test moved to `plan-resolution/extraction/tests/`.
- `DOMAIN_TEST_BUILD_LABEL=t489-domain node scripts/test-domain.mjs output-nodes/extract-list/tests plan-resolution/tests plan-resolution/extraction/tests node-run/tests output-nodes/tests llm-evidence/tests/` gave `# tests 796 # pass 796 # fail 0 # cancelled 0`.

What the run-mv66sc3c replay shows, through the real runtime and the real dispatch:
- **Revision 4** (schema and process `name`, `mutualFriends` over `extraction.4`):
  - Submit refuses it with exactly `web.handle.unknown_field`, `…handle_fields`, `web.handle.unknown_field:recordOutput.schema.fields.1.id`, `web.handle.unknown_field.name:mutualFriends`, then the seven `web.handle.expected.read_column:<detector key>` codes.
  - The dispatch refuses the same record output over the same read.
  - `name` resolves to the name column through the matcher's meaning fallback, a text column whose selector goes through a link.
- **The agreement table** has eight cases with the outcome pinned for each:
  - Refused: revisions 4, 5, 7 and 8.
  - Resolved: the detector keys throughout, `fields: {name, mutualFriends}`, `name` alone, and no record output.
  - Every resolved plan dispatches with `ok: true`, and every refused one is refused by the dispatch too.

## Not verified

- No Lab run, provider call, extension build or browser run (none were allowed).
- I did not run full suites. Tests outside the directories listed above, which reach the resolver or dispatch indirectly (for example `harness-options`, the node-run replay paths outside `node-run/tests`, and `apps/extension`), were not run.
- I did not check whether Core's own submit check (`record-output-contract.ts`) agrees with the rename. Core still checks the authored record output on its own. A record output that our function accepts by renaming, for example a `process` on `name` with a schema of `name`, also passes Core because the authored ids are consistent. But a Core change by the other worker could still diverge from it.
- How the model reads the new detail codes in Core's submit feedback. Core passes each code with the generic message "A node's parameters were not accepted by the domain that runs it."

## Open questions or contradictions found

1. **The lane C debug note is missing.** No note for run-mv66s8yl-fbbfa221 exists in the t275 tree or any `fxwork` tree I searched, so I could not read the "section 9" that item 4 cites. I worked from the run's step logs instead:
   - revision 2 wrote `nextPage: extraction.1` and was refused `web.handle.misplaced`;
   - revision 3 wrote `nextPage.list: extraction.1` and passed;
   - steps 0015 to 0027 read page 2 while calling it page 1, and the result said "21 records from 1 page" with `url …&page=2`.

   If section 9 asks for something else, items 3 and 4 may need adjusting.
2. **Item 3 is a domain-side statement only.**
   - The "21 records from 1 page" text comes from `apps/extension/src/content/actions/extract-list.ts`, which I do not own and did not change.
   - Core's trial read account (`read-account/pages-clause.ts`) is Core's to change.
   - A page ordinal, meaning the Nth pass of the list in a run, is known only to Core.
   - The domain cannot know the number generically, so it reads it from common address forms and otherwise says the address states none.
3. **A policy reversal that needs ratifying.** The brief asks that a refusal name the field and list the columns. That reverses the existing rule in `plan-resolution/issue-position.ts` and the `conditions.ts` header ("a refusal quotes structure only … the name itself is not spelled back"). I followed the brief and documented the reasoning in `plan-resolution/extraction/stored-columns.ts`. The column keys quoted are the detection's own keys, which the model was already shown.
4. **New codes the Core half may want to describe:**
   - `web.handle.unknown_field.name:<name>`
   - `web.handle.expected.read_column:<key>`
   - the dispatch issue `record_output.column_not_read`, under the failure code `record_output.invalid`, whose `failure.expected`/`failure.actual` name the read's columns and the unread names.

   `web.handle.unknown_field` already maps to `column_not_in_detected_list` in `tool-rejection.ts`, so no reason table had to change.
5. **This changes the dispatch for Flows saved before t489.** A saved Flow whose schema ids name no read column used to store the read's raw keys silently. It now either renames (when the ids match a column) or fails with `record_output.invalid` and names the columns. The brief asked for this, but it is a run-time change for existing Flows.
6. **Baseline and git index.** The audit says one baseline entry can be lowered, which comes from the `as never` cast I removed from `declared-columns.test.ts`. I did not run `pnpm structure:baseline`, because `.structure-baseline.json` is shared. The matcher move was done with `git mv`, and the new files are marked intent-to-add (`git add -N`), so the index shows the rename; nothing was committed.
