# t970 phase 1: result processing stage (worker report)

## Outcome

Done for phase 1. Every check named in the brief ran and passed, apart from the failures listed below, which I fixed
and then re-ran until they passed.

- **Contracts.** The new operators are `anyOf`, `compare`, `derive`, and filters on columns that `columns` hides.
- **Store.** `setProcess` sets or changes a dataset's processing within a run, and a changed declaration no longer
  throws.
- **Tool.** `core.set_result_processing` exists, and the draft holds what it sets. At assembly the declaration is
  written onto each record output it applies to.
- **Guidance.** Changed in Core and in the domain, and the Core prompt is re-pinned.
- **Proof.** The provider-free proof over the three runs passes, and the promoted row drops.

The tool is not yet offered in a live attempt. Offering it, handing the held declaration to the completion, and
showing the judge the processing account are the phase 2 hooks inside t905's files.

## What changed and why

Design: `post-processing-stage-design.md` beside this report. Phase 1 is the part that does not overlap t905.
Nothing was committed. Every change sits in the working trees `fxwork/t970/!FluxIQ` (Core) and
`fxwork/t970/!FluxIQWebExtension`.

### 1. Contracts (`packages/contracts/src/record-sets/process/`)
- **Conditions on hidden columns.** `parse-processing.ts` no longer refuses `process_where_column_dropped`. A filter,
  sort or dedupe may read any stored field that `columns` leaves out. A column that is only used to filter by (a
  badge or label) is stored and kept out of the answer.
- **The invariant still holds, scoped to collected rows.** Processing the collected rows again gives the same answer.
  - The store always processes from the collected rows (`run-dataset-store.ts` `processDataset`).
  - `build-test/stores.ts` processes the rows its tests collected, never an answer.
  - `run-dataset-answer/answer.ts` filters the whole row and narrows the columns only after that.
  - The one path that processes an answer again is `answer-first/rows/row-sink.ts:409`, when the sink's held
    declaration differs from the one it sent. That is t905 territory and is left for phase 2 (see open questions).
- **`anyOf`** (`any-of.ts`): groups of conditions. A group keeps a row when any one of its conditions holds. This gives
  an OR across columns.
- **`compare`** (`field-comparison.ts`): compares two columns of the same row as numbers (the default) or as dates.
  If either side states no number or date, the comparison fails, whatever `not` says.
- **`derive`** (`derive.ts`): makes a column from the first group of `pattern` in a stored column (or from its whole
  text), read `as` text, number or date (a date is written back as ISO).
  - A derived column runs before the filters.
  - It may be filtered, compared, sorted and deduplicated by.
  - It is never stored and never shown. `columns` naming one is refused as `process_derived_column_shown`.
- **Accounts.** `anyOf` groups and `compare` entries are accounted on the new `account.filters`. Each entry has its
  kind, the fields it reads, its condition in words, `rejected`, `alone` and `leftOutOnlyByThis`, counted the same
  way as `where` conditions. The positions of `account.conditions` are unchanged.
- **New issue codes:** `process_invalid_derive`, `process_invalid_any_of`, `process_invalid_compare`,
  `process_derived_column_shown`.

### 2. Store (`packages/fluxiq/src/framework/persistence/automation/project/run-dataset-store.ts`)
- **A changed declaration no longer throws.** `appendBatch` with a different `process` used to throw "processing
  changed within one run". It now makes that declaration the dataset's own and keeps every collected row.
- **New `setProcess({runId, datasetId, process, now?})`.** It sets or clears the declaration without storing a row.
  - It refuses an invalid declaration and writes nothing.
  - It processes an already processed dataset again at once, from its collected rows.

### 3. Tool and draft (Core `packages/fluxiq`)
- **Draft.** `runtime/flow-authoring/draft/result-processing/held.ts` holds the declarations by dataset id, or under
  `result`, meaning every output that is not intermediate. `AutomationStudioFlowDraft` gains an optional `result`.
- **Projection at assembly.** `runtime/flow-authoring/bootstrap/authoring/result-processing/plan.ts` writes the held
  declaration onto each record output it applies to, once the plan is assembled.
  - It merges the declaration over the output's own processing.
  - It adds to the schema any field the declaration names that the node reads.
  - It defaults `columns` to the columns the output had before, so the added marks stay hidden.
  - An output it cannot apply to gets a warning (`result_processing.not_applicable`) and keeps its own processing.
- **Threading.** `assembleAutomationStudioFlowDraftPlan` takes the declarations as `resultProcessing`, and the
  bootstrap completion takes them as `draftResultProcessing`.
- **The tool.** `runtime/llm/node-tools/result/` adds `core.set_result_processing` (effect `observe`).
  - `automationStudioLlmSetResultProcessing` parses the declaration against the rows' schema with the contract parser
    and runs `processAutomationStudioRecordRows`.
  - It answers with the counts, each condition's left-out labels, and every kept row.
  - An invalid declaration is refused and the earlier declaration stays.
  - `clear: true` removes the declaration. A declaration given before any row is read is held as written.
- **The model's contract text.** `bootstrap/plan/record-output-contract.ts` now describes `derive`, `anyOf` and
  `compare`, and that a filter may read a stored field `columns` leaves out. `processFields` names the new keys.
- **Default columns.** `record-defaults/process-defaults.ts` now declares the part's columns even when a `where` tests
  a field they leave out.
- **Stored fields.** `record-defaults/process-fields.ts` lists the fields read by `anyOf`, by `compare` and as
  `derive` sources, so they are stored.

### 4. Guidance (generic; no site, task or answer is named)
- **Core.** `runtime/llm/evidence-loop-decision.ts` gets two sentences after the site-filter sentence:
  - When the condition is printed on each item, read it as a column, mark included, and filter the rows already read
    with `core.set_result_processing` where it is offered.
  - Use a site's filter only when it cuts the pages to read by a lot.
  - Rows a later step acts on are still narrowed by the read's where.
- **Re-pin.** `evidence_tool_decision` in `deepseek/tests/system-prompt-pins.json` is re-pinned by exactly those two
  sentences, with a note in the test header.
- **Domain read tool.** `domain/src/runtime/llm-evidence/tools.ts` changes two pieces of text (1,796 of the 1,800
  characters asserted):
  - "Narrow the page first for a partial list" became "Narrow on the page only where it cuts reading a lot; else filter
    rows read with core.set_result_processing where offered".
  - "never a mark used only to filter" became "and a mark core.set_result_processing filters by".
- **Domain declared columns.** `output-nodes/extract-list/declared-columns.ts` no longer shows `where` helpers in the
  `columns` it writes; Core no longer requires them. It also stores the helpers read by `anyOf`, by `compare` and as
  `derive` sources.
- **Domain field names.** `stored-columns.ts` and `process-issues.ts` look up the new keys' fields and skip derived
  ids, which are never a read's columns.

### 5. Proof (provider-free)
`runtime/llm/node-tools/result/tests/recorded-runs.test.ts` runs the tool over the rows the three runs recorded. The
fixtures sit beside the test as `recorded-run-*.json`. The expected rows were copied from the scenarios' expected
datasets.
- **mwocg0zw.** Pages 1 to 3, read whole, with the plus and sponsored marks. One declaration gives the 11 expected rows
  those pages hold, and the marks are hidden.
- **mwodpw10.** The 16 stored rows become the 13 expected rows in order: 2 accessories are dropped and 1 page repeat
  is folded.
- **mwojyaub.** Of 34 rows, the promoted card and the suggestions row are dropped. The 32 rows left are exactly the
  expected 32 as a set. The order is the run's own, because it read page 4 first; that is asserted and reported, not
  repaired.

## Commands run and observed results

Every test run went through `node heavy-slot.mjs run t970-<step> -- ...` in `fxwork/.heavy-slots`. No package-wide
typecheck was run, per the user rule.

**Typechecks and audits**
- **Core, targeted typecheck.** `tsc -p <scratchpad>/tsconfig.fluxiq.json`, over the changed Core sources and tests,
  exited 0 with no output. It ran last after every edit.
- **Domain, targeted typecheck.** `tsc -p <scratchpad>/tsconfig.domain.json`, over the changed domain sources and
  tests, exited 0.
- **Core structure audit.** `node scripts/structure-audit.mjs` printed "passed (557 warning(s), 911 baselined)".
  - Its first run failed with 3 `directory-files` violations: `authoring/`, `authoring/tests/` and `draft/` each held
    26 files.
  - I moved the new modules into `result-processing/` folders, each with its own barrel and `tests/`, and the audit
    then passed.
- **Extension structure audit.** `node scripts/structure-audit.mjs` printed "passed (254 warning(s), 551 baselined)".

**Core tests (vitest)**
- **`t970-contracts`** (vitest over `packages/contracts` `src/record-sets`): 20 files passed, 279 tests passed. This
  includes the new `result-operators.test.ts`.
- **`t970-fluxiq-1`**: 30 files. 27 passed and 3 failed (4 tests). All four failures were real, and I fixed each:
  - `stages/tests/registry.test.ts`: Core's stage prose must not contain browser nouns, and my sentence said "page".
    I reworded it to "no step and no second read" and "cuts what must be read by a lot".
  - `plan/tests/record-output-contract.test.ts`: it pinned the old phrase "a sort or dedupe key may be a stored field
    columns leaves out". I updated it to the new contract phrase.
  - `recorded-runs.test.ts` (two tests): my first declaration, `name not contains "charging case"`, also dropped 3 real
    pairs whose names say "...Wireless Charging Case". It now uses `name not startsWith ["replacement","charging
    case"]`.
  - `recorded-runs.test.ts` (mwodpw10): that run read the same link relative on page 1 and absolute on page 2, so the
    page repeat did not fold. It now folds by a derived `path` column.
- **`t970-fluxiq-2`** (six files, re-run after the fixes): 5 passed. `recorded-runs` still failed, on the absolute
  link.
- **`t970-fluxiq-3`** (`node-tools/result/tests/`): 2 files passed, 8 tests passed.

**Domain tests**
- **`t970-core-build-domain`** (Core library build, then the domain tests): the first two attempts stopped at the
  `core-build` gate with "fluxiq:build no stamp", because I edited a Core file while it was building.
- **Third attempt:** Core was rebuilt and the gate printed "current with its source". The domain tests then reported
  "tests 116, pass 115, fail 1": the `derive` case of my new declared-columns test. The domain's `stored-columns.ts`
  and `process-issues.ts` read the derived column `year` as a column the read does not read. I fixed both, so they
  skip derived ids and name the fields read by `anyOf`, by `compare` and as `derive` sources.
- **`t970-domain-4`**: the domain tests under `output-nodes/extract-list/tests/`,
  `runtime/llm-evidence/tests/tools.test` and `runtime/llm-evidence/plan-resolution/extraction/tests/` reported
  "tests 191, pass 191, fail 0" and exit 0.

## Not verified

- **No live or Lab run.** The tool is not offered in an attempt until phase 2, so the time and model-call measurement
  in the design is still to run.
- **No full suites.** `pnpm check`, `pnpm test` and Core's whole vitest were not run, per the twice-a-day rule. Other
  importers of `AutomationStudioRecordProcessing` and of the account outside the batches above were not run. The
  changes to them are additive and optional.
- **Domain tests ran against an older Core build for one test.** The Core build the domain tests used came from the
  tree before my last `recorded-runs.test.ts` edit, which touches no domain code.
- **The completion path is not exercised end to end.** `bootstrap-completion.ts` threads `draftResultProcessing`, but
  no caller passes it yet; phase 2 wires it. The projection is covered by `result-processing/tests/plan.test.ts`.
- **Architecture docs not updated.** Core's `docs/architecture/automation-studio-native-nodes.md` and
  `package-boundaries.md`, which describe `process`, are not updated for the new keys or the hidden-column rule.

## Open questions or contradictions found

**Phase 2 hooks (t905 files, not touched):**
- **Offer the tool.** In `answer-first/attempt/run-attempt.ts`, offer `core.set_result_processing`. Its `rowsOf` is
  the sink's held rows and schema, before processing. Its held declaration goes to the completion as
  `draftResultProcessing` and to the store through `setProcess`.
- **Stop the sink processing an answer again.** `answer-first/rows/row-sink.ts:293-295,331,408-409` re-processes the
  store's answer rows when its held declaration differs from the one it sent. With hidden filter columns, that path
  must process the collected rows instead: call `setProcess` and read the store's answer. The sink's `askedColumns`
  still keeps `where` helpers shown (`row-sink.ts:102,432`), and that rule should go too.
- **Give the judge the processing.** In `answer-first/completion/check.ts` `summaryOf`, add the declaration and account
  to the summary. `processed-rows.ts` throws the account away today.

**Other findings:**
- **`process_where_column_dropped` is no longer produced.** Code that still names it is now dead but harmless:
  `bootstrap/plan/issue-feedback.ts:275`, `record-output-contract.ts` `PROCESS_FIELD_CODES`, and the domain's
  `process-issues.ts`. Remove it in a cleanup.
- **The proof shows why the judge must see what was left out.** A plausible condition (`not contains "charging case"`)
  silently dropped 3 correct rows. The tool's answer names each condition's left-out rows; phase 2 must give the judge
  the same list.
- **The mwojyaub order defect is out of scope.** That run read page 4 first. Processing drops the promoted and
  suggestions rows, but cannot restore site order.
