# w1 auction-marketplace debug: run-mv6qrbgx-06151cdb

Breadth wave 1, task `auction-marketplace-kestrel-auctions`, $0.0100, verdict failed, no Flow created.
Pair: Core fbd06c77 / downstream 0f6246eb (lane C tree t451 = dev 58144440 merged in; its `domain/dist` was
built from that source, so no extract-list source is newer).

## Outcome

Done. Root cause: **two readers of one record output disagree** (the t489 class again). At submit, Core's plan
validation reads the record output **as the model wrote it**, so a schema field marked `handling: "exclude"` that
`process.sort` names is refused `record_output.process_excluded_field`. When the Flow runs, the domain's dispatch
**throws the model's schema away** and rebuilds it from the field map (`reconciled-record-output.ts`), which does
not exclude those fields. A dry dispatch of the exact 0022 and 0024 record outputs **accepts both**: every field is
stored, the sort is on `endsAt`/`ends`, and `columns` cuts the answer to 4 (probe below). Submit refused a plan the
runtime would have run. The refusal's advice, "Name a stored field id instead", pointed the model at the wrong fix,
and nothing told it that `exclude` means "never stored" while `process.columns` means "not in the answer". So it
switched the sort field from one excluded field to another until the same-reason guard ended the build.

## Timeline and each refusal's text (Q1)

Task in brief: Kestrel 35 auctions under £150, **soonest-ending first**, columns title, price, bids and postage.
The sort key is a column the answer must not show. That is the crux.

| Step | What happened | Refusal text the model got | Actionable? |
| --- | --- | --- | --- |
| 0004 | click t114 "Reject all" (consent) | `target_covered`, detail `{reason: covered_by_layer, target: t114, instead: [t100], closeWith: [t109], next: "Nothing was done. The layer in instead covers the target: press one of closeWith to close it, then make this same call again, unchanged."}`. Page: `COVERING t100 covers 37 close t109 "Not now"`, `DIALOG t101 "Bid on the go" modal` | Yes. Correct and acted on: 0006 pressed t109, 0008 retried t114 and it worked |
| 0014 | detect_repeating_structure t213 again | `llm_evidence_loop.already_answered`, `answeredByCallId: detect-list-1`, "This request was already answered and was not run again ... Use the existing evidence and correct any submission issues, then submit the whole candidate ..." | Yes (cheap, nothing run) |
| 0018 | same a third time | `already_answered` (timesAsked 3) **plus** `no_progress`: "... Take a route not yet tried: a control on the current page you have not used ... a page search with other or fewer words, or going back to a listing ..." | Partly. already_answered is right. The no_progress text pushes exploration when the evidence was complete and the right move was to submit. The model submitted anyway |
| 0020 | submit 1, with `recordOutput.columns: [title,price,bids,postage]` and `recordOutput.process: {"sort":[{"field":"endsAt","direction":"asc"}]}` | refusal `evidence_completion_parameters_unresolved`. Issues: `web.handle.malformed` (with `handles:[{handle:"extraction.1"}]`), `web.handle.malformed:recordOutput` (with `accepted` = the whole record-output contract text), `record_output.invalid`, `record_output.process_invalid_sort`. **None has a `message`**. next: "Something the step wrote where a handle, or a list's column or condition, belongs is not in a shape it takes ..." | Weak. Codes only. Nothing says the sort key used `direction` where `order` belongs; the model had to find `order:asc|desc` in the contract text, which it did. The top-level `web.handle.malformed` listing `extraction.1` suggests a handle fault that does not exist (the domain's dry dispatch refused at path `recordOutput`; `plan-resolution/extraction/stored-columns.ts` `webPlanUndispatchable`) |
| 0022 | submit 2: full schema, helpers `condition, ends, endsAt, pounds, bin, ad` all `handling: "exclude"`, `process: {sort:[{field:endsAt, order:asc}], columns:[title,price,bids,postage]}` | `record_output.process_excluded_field`, message: **"process names "endsAt", which schema.fields marks handling "exclude", so it is never stored. The schema stores "title", "price", "bids", "postage". Name a stored field id instead."** plus `accepted` (contract text) | Names the field and the stored ids, but the **remedy is wrong for this case**: no stored field can express "soonest ending". The real fix (stop excluding `endsAt`; `process.columns` already hides it) is not said |
| 0024 | submit 3: identical except the sort is now on `ends` (also excluded). Summary: "sort field corrected to a stored column" | same code. Message: "process names "ends", which schema.fields marks handling "exclude" ... Name a stored field id instead." | Same as 0022 |
| 0026 | submit 4: drops the `endsAt` and `bin` fields, still sorts on excluded `ends` | identical to 0024. Third same-reason refusal, so the build ended | Same |

**Did `process_excluded_field` carry `{code, field, valid}`?** Only in prose. The field and the stored ids are in
`message`, written by Core's `automationStudioFlowBootstrapRecordOutputIssueMessage`
(`!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/record-output-contract.ts:128-131`,
called from `plan/validation.ts:284-286`). The issue has no structured `detail: {field, valid}`, although
`AutomationStudioFlowBootstrapIssue.detail` exists (`plan/contracts.ts:306-310`). The code itself comes from the
contracts parser (`!FluxIQ/packages/contracts/src/record-sets/process/parse-processing.ts:90`, codes only). What it
must carry: `detail: {field: "<excluded id>", valid: [stored ids]}`, and a remedy that matches how the field is used
(see F2).

## What the model changed, and was each change right? (Q2)

- 0020 to 0022: `direction` became `order` (**right**). The `recordOutput.columns` shorthand was rewritten as a full
  record output with every helper marked `handling: "exclude"` and the answer columns in `process.columns`. The
  structure was right; the `exclude` on `endsAt` was **wrong**. It was trying to say "not in the answer", which
  `process.columns` already said.
- 0022 to 0024: sort `endsAt` became `ends` (**wrong**). Both were excluded, so nothing changed for the validator.
  `ends` ("1d 0h left") is also a worse key: Core reads it as the number 1, so "5h 12m left" (read as 5) sorts after
  "1d 0h left" (probe below).
- 0024 to 0026: dropped the `endsAt` and `bin` fields entirely (**wrong / no-op**): still sorting on excluded `ends`.
- The model never touched `handling`, the one change that would have passed.

**What "excluded" means here.** It is neither a column that `fields` dropped nor anything the record output did on
its own. It is the model's own `schema.fields[].handling: "exclude"` on columns the read does read. In the record-set
contract, `exclude` means **never stored** (decision D12: sensitive data, never read), not "left out of the answer".
The contract text gives `handling include|exclude` with no meaning, so the model took it for the latter.

## Is the rule right? (Q3)

Yes as Core states it: a sort, dedupe or where key must be **stored**, because processing runs over stored rows at
run end. Sorting by a column that `process.columns` leaves out is allowed, and stays sound when the answer is
processed again. `process-rows.ts` says the sort is stable, and only a `where` over a dropped column is refused
(`process_where_column_dropped`). What refused something reasonable is not the rule but:

1. **Submit applied the rule to a schema the runtime never uses.** The dispatch keeps the field map's `handling` and
   ignores the authored schema's (`domain/src/output-nodes/extract-list/record-output.ts`,
   `reconciled-record-output.ts:77-89`). The resolver at submit replaces `extractList` only and leaves `recordOutput`
   as written (`domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts:549-566`), so Core validates
   the authored value.
2. **The taught shorthand cannot express "sort by a hidden column".** The script guidance teaches
   `recordOutput.columns: [...]` and says `recordOutput.process` works "over the columns `recordOutput.columns`
   saves" (`!FluxIQ/.../plan/flow-script-format.ts:391,401`). Core's normaliser maps `columns` to `schema`
   (`authoring/record-output.ts:37`). The domain then treats every other field as a helper and drops it, because
   `declared-columns.ts:438` keeps only helpers that **`extractList.sort`** names, not `recordOutput.process.sort`.
   So the 0020 script with only `direction` fixed is still refused (`process_unknown_field`, codes only; probe
   below).

## Was 0004 the t507 defect? (Q4)

No. In auction 0004 a real modal ("Bid on the go", `DIALOG t101 modal`, layer t100) was stacked over the cookie
banner. The refusal named the layer and its way out (`closeWith: [t109]` "Not now"), and the model followed it
successfully (0006, then 0008). That is correct behaviour. In company-website `run-mv6qrcln-2e194a12` step 0008, the
target t317 sits **inside** the modal consent dialog (`DIALOG t312 "Your privacy choices" modal consent`) and was
reported covered by t319, the chat bubble ("Kes from Kestrel Lane ... covers 3"). There was no `closeWith`, and
repeat refusals followed. That is t507's false cover. They differ in kind. One residue here: the submitted Flow
orders "close the cookie consent" (t114) **before** "close the app prompt" (t109), but the evidence showed the app
prompt covering the consent. Whether playback's state routing covers this was not verified.

## Proposed general fixes, ranked (Q5)

**F1: one reader for the record output, at submit and at dispatch (domain; root cause).**
- `domain/src/output-nodes/extract-list/declared-columns.ts`: (a) read an authored schema field marked
  `handling: "exclude"` that the read reads as **not declared** (a helper), not as a declared column; (b) add the
  fields named by the authored `recordOutput.process` (`sort[].field`, `dedupe.by`) to `ordering` beside
  `request.sort`, so such a helper stays read and stored; (c) when a helper is kept only for processing and the
  author wrote no `process.columns`, write `process.columns` = the declared columns, so the helper is stored but not
  shown. A `process.where` over a helper belongs on `extractList.where`; say so rather than auto-write columns,
  because Core refuses `process_where_column_dropped`.
- `domain/src/runtime/llm-evidence/plan-resolution/resolve-plan-node.ts` (extractList branch) and
  `extraction/stored-columns.ts`: write the dispatch's reconciled `recordOutput` into the plan at submit, so Core's
  `plan/validation.ts` checks, and the Flow saves, exactly what runs.
- Fail-first tests: `domain/src/output-nodes/extract-list/tests/declared-columns.test.ts` (or the dispatch test
  there). (i) Schema `title,price,bids,postage` plus helper `due` marked exclude, `process.sort` on `due`: the
  payload stores `due` and `process.columns` is the four. (ii) Shorthand schema of four, `process.sort` on a read
  helper, no columns: accepted with columns written (today: refused `process_unknown_field`). In
  `plan-resolution/tests/`: the same step at submit resolves with `recordOutput` replaced, and
  `automationStudioFlowBootstrapRecordOutputIssues` on it is `[]`. Use a non-Lab site (e.g. tasks sorted by a due
  date that is not shown).

**F2: the refusal names the fix that fits the use (Core).**
- `!FluxIQ/.../flow-bootstrap/plan/record-output-contract.ts` (`...RecordOutputIssueMessage`): when an excluded or
  unknown field is named by `sort`, `dedupe` or `where`, say: "To order or filter by a column the answer should not
  show, store it (remove `handling: "exclude"`, or add it to schema.fields) and list the answer's columns in
  `process.columns`, which applies last." Keep "Name a stored field id instead" only for `columns`.
- `plan/validation.ts:284-286`: attach `detail: {field, valid: <stored ids>}` to these processing issues, the same
  shape as t489/t502.
- Fail-first: extend `plan/tests/validation.test.ts:302` ("names a field the schema excludes"): expect the message
  to contain `process.columns` and `detail` to equal `{field: "secret", valid: ["name"]}`; add the
  `process_unknown_field` sort case to `plan/tests/record-output-contract.test.ts`.

**F3: guidance says what `exclude` and `columns` mean (Core).**
- `record-output-contract.ts:168,201`: "handling exclude: never stored (for sensitive values), not 'left out of the
  answer'; process.columns picks the answer's columns; sort/dedupe may name any stored column, including one columns
  leaves out."
- `flow-script-format.ts:391`: drop "over the columns `recordOutput.columns` saves", and give one example on a
  non-Lab site that sorts by a column the answer does not show.
- Fail-first: a text assertion in `plan/tests/record-output-contract.test.ts` and the script-format test that the
  sentence is present and that the example parses and validates. This needs F1 for the shorthand example.

**F4: the dispatch's processing refusals carry `{code, field, valid}` (domain).** `dispatch.ts:143,262`
(`recordOutputRefusal(parsed.issues)`) passes Core's bare codes. Add the field and stored ids for
`process_unknown_field` / `process_excluded_field` / `process_invalid_sort`, as `stored-columns.ts` does for
`column_not_read`. Fail-first in `output-nodes/extract-list/tests/`.

**F5: `process_invalid_sort` says which key is wrong (Core, low).** Name the stray key ("sort[0] has `direction`;
a sort key takes field, order (asc|desc), as"). It needs a message case in `record-output-contract.ts`. Fail-first
in `record-output-contract.test.ts`. The model fixed this one unaided, so it is low.

**F6: date and duration reading for sort keys (Core contracts, needed for this task's answer to be right).** Probe:
`readAutomationStudioRecordDate("(Tue 22 Sep, 14:00)")` and `"(Tue 22 Sep, 08:00)"` both give
2026-09-22T00:00Z. The time of day is dropped, so same-day auctions keep capture order. "1d 0h left" reads as the
number 1 (auto kind `number`), and "5h 12m left" as 5. The fix is to read the time of day, and "Nd Nh left" as
now plus that duration, in `!FluxIQ/packages/contracts/src/record-sets/process/read-date.ts` / `sort-value.ts`,
with cases in `value-reading-cases.ts` (kept equal to the domain's sort). Fail-first: those reading cases.

## Commands run and observed results

- Read the run's `steps/0001..0026` (call, result and response JSON) with python; read `summary.json` and the tail
  of the launcher log. Observed: verdict failed, `totalEstimatedCostUsd 0.010023624`, issue codes and messages as
  quoted above. `steps/0023-decide/request.txt` contains the 0022 message verbatim, so the model was shown it.
- Dry dispatch probe (`scratchpad/w1auc/probe.mjs`, `node`), calling the domain's built
  `webAutomationExtractListDispatch` with a stand-in field map of the run's 10 keys:
  - 0022 record output: `OK; stored fields: title,...,condition,ends,endsAt,pounds,bin,ad; process: {"sort":[{"field":"endsAt","order":"asc"}],"columns":["title","price","bids","postage"]}`
  - 0024 record output: `OK` (sort on `ends`), the same stored fields
  - shorthand (schema of 4, sort `endsAt`, no columns): `REFUSED {"code":"record_output.invalid",...} [{"code":"record_output.process_unknown_field"}]`
  - correct form (`endsAt` stored, columns 4): `OK`
- Date probe (`scratchpad/w1auc-date.mts`, `node --experimental-strip-types` against Core source): the outputs
  quoted under F6.

## Not verified

- The probe used a stand-in `extractList` (`item` and plain selectors), not the resolver's real request for
  `extraction.1`. The record-output path does not depend on the selectors, but the whole resolve, then validate,
  then dispatch chain was not replayed.
- That F1's write-back at submit leaves Core's other submit checks (dataset id, labels) unchanged.
- The playback order of the two optional dismiss steps (consent before app prompt).
- Whether the trial would have passed had the record output been accepted. See the open questions: the Flow had
  latent answer errors.
- No tests were run, and no Lab or provider calls were made.

## Open questions or contradictions found

- **Latent model errors in the submitted Flow** (not the build-ending cause): `extractList.where pounds lessThan 150`
  is on a column with coverage 0.27 (only listings priced in another currency show "approx. £"). Pound-priced
  listings have no value, so the condition fails and every pound-priced auction would be dropped. The condition
  grammar has no "this column, or that one when absent" form, so "price in pounds, or the pound estimate for other
  currencies" may not be expressible as one read. That is a possible grammar gap to confirm. The title exclusion
  regex (`box`, `lens`, `case` ...) would also drop a Kestrel 35 sold "boxed, with lenses".
- The site has its own `Sort: Best Match` control (t202), which likely offers ending-soonest. Using it avoids the
  date reading in F6 entirely. Nothing in the guidance nudges toward a site's own ordering over `process.sort`.
- The `exclude` the dispatch drops silently is itself a quiet override. If an author excludes a column for privacy,
  the runtime stores it anyway. F1(a) makes that explicit, but a field-map column the model wants never stored
  (true D12) then needs `extractList.fields.<key>.handling`, not the schema. Decide which one is authoritative.
