# First-Class Data Extraction Plan

Status: Active
Status detail: Executing 2026-09-15; X0 domain, X1.5, and X0.7 have landed locally, and the rest of X0-X5 with Core's K0-K10 and K12 finishes before the user's plan review (D15).
Created: 2026-09-15
Last updated: 2026-09-15
Owner: Senior supervisor agent
Scope: Make structured data extraction a fundamental FluxIQ capability: Core owns generic datasets (schema, per-run persistence, preview, CSV/JSON export, iteration) and their UI; the web domain and extension own DOM extraction, element picking, repeating-structure and field detection, and pagination; extraction is recordable and compiles to ordinary Flow nodes; the Testing Lab measures FluxIQ's own extraction.
Paired document: `F:\!FluxIQ\docs\working\first-class-data-extraction-plan.md`
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Phase 2.0), [Week 1 plan](./mvp-week1-web-automation-reliability-plan.md), [LLM production automation plan](./llm-production-automation-plan.md), [web capabilities](../architecture/web-capabilities.md), [testing facility](../architecture/testing-facility.md), [sensitive values](../architecture/sensitive-values.md)

---

## Current State

**Phase, as of 2026-09-15: executing; X0 domain guards, X1.5 scenario
contracts, and X0.7 landed locally in `13b0a0d`.** The user decided
that structured data extraction is a fundamental FluxIQ capability, Core
included, and asked for the plan quickly using subagents. Four read-only
investigations produced it: `ex-a-extension-domain`, `ex-c-plans-docs` and
`ex-d-test-facility` here, and `ex-b-core` in Core's paired folder. Per the
user's standing instruction, the recommendations below are decisions unless the
user overrides them.

**What is true today:**
- The extension runs `web.dom.extract` (one value) and `web.dom.extract_list`
  (item selector, a string field grammar of text, `@attribute` and
  `column:<header>`, Next-button pagination capped at 50 pages). Records are
  untyped strings.
- In Core, records are saved only inside the runtime session trace
  (`outputs.result`, read with `get-runtime-session`). Run-detail attempt records
  carry no outputs, and the saved trace replaces any run-typed value with
  `[withheld]`, even inside extracted text.
- Nothing records extraction; there is no picker, preview, export, dataset, or
  working iteration. Core's loop node keeps no counter or item, variables reset
  for every node, and `$state` paths cannot reach recorded nodes' outputs.
- FluxIQ's own extraction is judged on no Lab lane; six variant extraction
  claims have never been checked, and no evaluation or bench field measures it.

**Defects found (not fixed), in priority order:**
1. **Security:** `web.dom.extract` returns a sensitive control's live `.value`,
   its `value` attribute, and its HTML (`content/action-runtime/extract.ts:6-12`),
   and a list field `input@value` does the same (`list-extraction.ts:141`);
   neither the wire payload, the Core-side adapter, nor the recording reducer
   re-checks `extracted` (`x0-x1-execution` Part 1).
2. A list matching zero items passes, so a sign-in wall yields success with `[]`.
3. Virtualised lists under-read silently, 15 of 240 (open question E55).
4. Core trace withholding corrupts extracted strings that contain a run input.
5. "Load more" pagination duplicates records; `timeoutMs` is ignored; there is no
   item or byte cap; the Lab's Flow-run reader drops non-string values.

**Done:** all four investigations; this plan and Core's design (paired
document); Phase 2.0 in the MVP plan; the Week 1 plan closed and pointed here;
agent instructions, Priority 4, and open questions E2, E53, and E55 updated;
excluded dataset columns decided (D12); Encrypt column designed for Week 3 (D13);
X0 and X1 execution detail (`x0-x1-execution`, D14); Core's K0 and K11 designs.

**Not done:** every phase below.

**Next steps:**
1. Finish X0 (`x0-page`) and X1 (W2-B, W1-B, W3-B, X1.6); run root
   `pnpm check`, `pnpm test`, and `pnpm build` one at a time; push.
2. Detail X3-X5 (`x3-x5-execution`), then build them beside Core's K2-K10 and
   K12 (paired document).
3. Plan the rest of Week 2 in `mvp-week2-automation-loop-plan.md`, then stop
   for the user's review (D15).

**Blockers:** none. Sensitive data in saved and exported datasets (E53) is
decided by D12: a column set to "Exclude column" is never read into the output,
the saved table, or exports, and nothing guesses from content.

---

## Objective

FluxIQ turns any page's structured content into a reusable, repairable dataset:
a user can show or tell FluxIQ what to extract, see the records, export them, and
run the same extraction again deterministically. Phase 3.7's product
requirements apply: an "Extract Data From This Page" entry point; select an
example element; detect repeating structures; infer, add, remove, and rename
fields; text, attribute, and link extraction; current page or all pages;
pagination and practical infinite scrolling; structured preview; CSV and JSON.
A scraper must compile into ordinary Flows and Subflows, so runtime adaptation
can repair it like any other automation.

Ownership follows `AGENTS.md`: domain-neutral dataset contracts, persistence,
preview, export, iteration, and their UI belong in FluxIQ Core; selectors, DOM
reading, element picking, repeating-structure detection, field inference, and
page pagination belong here. The MVP plan's Week 2 loop keeps priority
(MVP:654): this foundation is justified because Phase 2.4 validates expected
output and Phases 2.5-2.9 repair and reuse Flows, none of which can reach
extraction until it is a real, measured Flow capability.

## Decisions

- **D1. Sequencing:** X0-X2 run beside Phases 2.1-2.3; recordable extraction
  (X4) lands before Phase 2.4; X6 runs with Phases 2.6-2.9; the Phase 3.7 UX
  builds on it in Week 3. X0-X4 are timeboxed to about the first half of Week 2.
- **D2. Sensitive controls:** extraction refuses every read of a sensitive
  control, in every mode (live value, attribute, HTML, and list fields), with
  `web.action.rejected` / `blocked_by_capability_or_policy`, matching every
  other reader. A text read of a container skips the contents of sensitive
  controls inside it (a sensitive `<textarea>`'s text, a sensitive `<select>`'s
  option labels), and an HTML read of a container removes sensitive
  descendants' `value` attributes and contents. The wire payload, the Core-side adapter, and the recording
  reducer each drop `extracted` again for a sensitive element.
- **D3. Recordings carry no extracted sample values** by default; previews come
  from Core's dataset store once it exists.
- **D4. Empty lists:** `minItems` defaults to 1; a workflow where empty is valid
  (W06 `no-results`) declares `minItems: 0`. Otherwise zero items fail as
  `output_not_observed`, or as `auth_required` when the page is a sign-in gate.
  The test-contracts validator requires `minItems: 0` wherever a workflow
  expects zero records.
- **D5. A successful paginated read leaves the page on the last page read**, so
  the W05 and W07 final-state oracles stay valid. A read that times out reports
  `timed_out` with the records and page count it read, and makes no promise
  about which page is showing.
- **D6. Measurement is counts-only.** No page value or page field name enters an
  evaluation, bench report, or bundle snapshot.
- **D7. New baseline:** the week1 corpus grows from 63 to 67 runnable results and
  gains extraction metrics, so a fresh A/B pair becomes the baseline after X5;
  older reports stay readable with the new metrics absent.
- **D8. Not changed:** the LLM plan (1,577 lines) is not edited until its next
  compaction; the MVP plan's 10% scraping allocation stays.
- **D9. Extraction stays an ordinary `builtin.policy.action`** dispatching the
  domain output, with Core's additive `recordOutput` parameter and `records`
  port, so target resolution, transition checks, recovery, and adaptation keep
  working (`ex-b-core` section 6).
- **D10. Dataset rows are persisted from the executed result, not the saved
  trace**, so withholding cannot corrupt them; the saved trace keeps a summary.
- **D11. Versioning:** additive Core pieces ship first; run-scoped variables,
  output-reference resolution, and any withholding change ship as `fluxiq`
  0.5.0 with a Migration Notes entry.
- **D12. Excluded columns (E53, for datasets; the user's design):** extraction
  never judges content, which both misses and misfires. Each field has an
  **Exclude column** option. An excluded column is left out entirely, not
  masked: the page never reads its values, so it is absent from the extraction
  node's output, the saved table, the preview, and CSV/JSON exports. Excluding
  rather than deleting a column stops field detection from proposing it again.
  An info hover explains it: use it for private information such as passwords,
  card numbers, or personal details you don't want collected, saved, or
  exported. The picker pre-selects Exclude column when the
  element read, or its control, carries the sensitivity signature or
  `data-sensitive`; the user can change it. Recorder capture of unmarked form
  fields stays with E53 in the Week 1 open questions.
- **D13. Encrypt column, built in Week 3:** a third column option beside
  include and exclude, reserved in the X1 contracts and built with Phase 3.7's
  field editor; Core's design is its phase K11. The extension sends values as
  it does for include, and Core locks each value with the project's public key
  before it reaches any output, log, or saved file, so unattended runs never
  need a password. Every unlock asks for the account password at that moment
  and nothing stays unlocked for the login session: Reveal shows a value for 30
  seconds; CSV/JSON export leaves the column out unless the user confirms the
  password and chooses to include it in clear; a later run that uses the values
  needs a short-lived, password-confirmed grant, so an unattended run that needs
  them fails before it touches the browser. The project's private key is locked
  separately for each account allowed to read it and kept outside the project
  folder. Lookup attacks are closed by design: each value gets a fresh random
  key and IV and a padded length, so identical values never look alike; no hash
  or deterministic token of an encrypted value is stored, so encrypted columns
  cannot be sorted, de-duplicated, or used as a key; account keys are locked
  with a random salt and scrypt at no less than OWASP's minimum (N=2^17, r=8,
  p=1), with the parameters stored beside them. What remains is offline guessing
  of a weak account password by someone holding both the project and the key
  store; a forgotten password, or a project restored without its key store,
  loses the values. It protects copied project folders, backups, and shared
  projects, not a live, logged-in session.
- **D14. Contract details settled by `x0-x1-execution`:**
  - the pagination discriminator is `mode` (`next` when absent, `loadMore`,
    `scroll`, `numbered`) in the domain and test-contracts alike;
  - the request gains no `timeoutMs`: the command's existing `timeoutMs` is
    honoured by the page, the `extract_list` node declares a `timeoutMs`
    parameter, and a recorded node scales it by `maxPages`, since Core's
    5,000 ms default would otherwise cut paginated reads short;
  - `WEB_AUTOMATION_EXTRACT_MAX_ITEMS` is 1,000, mirrored by the page with an
    agreement test until X3 imports it; `minItems` above the cap is refused
    whole, and its schema gains the same maximum in X1.4;
  - a `handling: encrypt` field is refused at dispatch with
    `web.action.not_implemented` until K11, and a spec-form field or non-`next`
    pagination is refused by the page until X3;
  - `recordableActionTypes`, evaluation schema 0.3, and the bench report change
    in X5, not X1, so W04 and W08 do not reach the Flow lane before an extract
    node exists.

- **D15. Scope of this push (the user, 2026-09-15):** finish Week 2's
  extraction foundation (X0-X5 here; K0-K10 and K12 in Core) and the security
  fixes, plan the rest of Week 2, then stop for the user's review. K11 and
  Phase 3.7 stay in Week 3. Repair hooks for extract nodes move from X3 to X6,
  where the collection-target repair contract is decided with E2 beside loop
  Phases 2.5-2.7.

## Design

### Web domain and extension contracts (owned here)

- **C1 `WebAutomationExtractListRequest` v2** (`domain/src/actions/types.ts`,
  `schemas.ts`, `client/gateway-action-parameters.ts`):
  - a field value is the existing string grammar or a spec
    `{ kind: text|attribute|link|value|column, selector?, attribute?, header?,
    required?, handling?: include|exclude|encrypt, element? }`, where `link`
    resolves against the document base, `exclude` follows D12, and `encrypt`
    follows D13 and is refused until built;
  - `itemElement` fingerprint for repair; `minItems` (D4); a hard
    `WEB_AUTOMATION_EXTRACT_MAX_ITEMS`;
  - `paginate` becomes a union on `mode` of `next` (today's shape), `loadMore`,
    `scroll`, and `numbered`, de-duplicating append modes by element identity;
  - the command's `timeoutMs` honoured by the page (D14).
- **C2 result summary:** keep `extracted: records[]`; add a closed
  `extraction: { recordCount, pagesRead, truncated, missingFields, fieldNames }`;
  move dialog evidence off `extracted`. The domain output definition declares
  `metadata.recordsPath: "extracted"`, which Core reads when it lifts a
  recording proposal (paired CD19).
- **C3 recorded extraction event:** kind `data.extract`, event
  `web.data.extraction_defined`, input `web.user.data_extraction_defined`, output
  `web.dom.extract_list` with a `recordOutput` on the mapper candidate; a
  single-field form maps to `web.dom.extract` with a structured
  `extract: { mode, attribute? }` parameter. The plug points are the eleven
  listed in `ex-a` section 3.
- **C4 inference proposal** (new `domain/src/extraction/`):
  `{ container, item, itemCount, fields: [{ name, spec, coverage }], pagination?,
  confidence }`, seeded by `content/evidence/repeating.ts`, whose signature logic
  moves to a shared module.
- **C5 picker messages:** content `extraction.pick_start|pick_cancel|preview`;
  runtime `fluxiq.extractionStart|Confirm|Cancel`,
  `fluxiq.getExtractionSession`. The pick session lives in the background
  (Firefox popups close on page focus) and suppresses its clicks from the
  recorder.

### Core share (owned by the paired document)

Core's contracts, persistence, iteration, API, UI, phases K1-K10, and its open
questions are recorded in
`F:\!FluxIQ\docs\working\first-class-data-extraction-plan.md` and not restated
here. In short: record-set contracts in `@fluxiq/contracts`; per-run dataset
tables in project SQLite fed by an executor record-batch hook; `recordOutput` and
a `records` port on the policy action; `for-each` and `write-records` nodes with
run-scoped variables and output references; mapper candidates carrying
`recordOutput`; dataset endpoints and a streaming CSV/JSON route; a datasets
panel beside Runtime Debug's Export Audit.

### Testing Lab contracts (owned here)

- `ExpectedExtraction` gains `pages`, `optionalFields` (a subset of the step's
  fields), `truncated`, and nullable values; `[]` stays "no extraction
  expected", and `{ count: 0, records: [] }` means "ran and found nothing".
- The scenario `extract` step becomes an extraction intent dispatched through an
  injected seam, so the recording lane records FluxIQ's extraction and the
  runner no longer clicks Next itself; `recordableActionTypes` maps `extract` to
  the extract outputs, giving W04 and W08 a Flow lane.
- `RunEvaluation.extraction` (schema 0.3, counts-only per step) and a
  `BenchReport` `extractionByLane` block: `extractionRecordAccuracy`,
  `extractionFieldCompleteness`, `paginationAccuracy`, `extractionDurationMs`,
  `extractionFalseSuccess`, each shown with its coverage.
- The Flow-lane judge fails a missing extract node as `recording.contract`,
  pairs attempts with steps by candidate order, and concatenates per-page
  attempts. Once Core's K4 lands the saved trace carries `$dataset` markers
  instead of rows (paired CD14), so the Flow-run reader reads Core's run
  datasets (`list-run-datasets`, `get-run-dataset-page`); until then only
  `session.trace.attempts[].outputs.result` carries records, subject to
  withholding. It reports non-string values instead of dropping them.

## Phases

| Phase | Work | Owner area | Depends on |
| --- | --- | --- | --- |
| X0 | Security and correctness: refuse sensitive `.value` (D2); fail empty lists (D4); de-duplicate append pagination; item cap; honour `timeoutMs`; the Lab reader's silent drop; Core K0 raises Secret Keys' password-derivation cost and re-seals older keys | extension, domain, test-runner, Core | none |
| X1 | Contracts: C1, C2 (domain); Core K1 record-set contracts; test-contracts additions (steps X1.1-X1.5 in `reports/x0-x1-execution.md`) | domain, Core, test-contracts | none |
| X2 | Core datasets K2-K6 and K8-K9: store, capture, record-batch persistence, run detail, iteration, endpoints and export route, datasets panel | Core | X1 |
| X3 | Extraction engine: structured field specs and pagination modes, inference C4 (repair hooks moved to X6, D15) | extension, domain | X1 |
| X4 | Recordable extraction: picker and side-panel entry, recorded event and mapping C3, Core K7 mapper `recordOutput` lift | extension, domain, Core | X2, X3, Core K12d (record-output editor) |
| X5 | Lab measurement: extraction intent seam, `measureExtraction`, Flow-lane judging, bench metrics, fixtures (images, sparse fields, absolute links, numbered pages, load more, empty and large tables, frame extraction, sensitive text), W04/W08 Flow lanes | test-runner, test-contracts, scenario-lab | X1, X4 |
| X6 | Loop integration with Phases 2.4-2.9: extract-node repair hooks on the collection-target contract (with E2); extraction drift variants (W04 `text-variant`, W08 `column-reorder`, a new item-selector drift) through adaptation; E2 decided with extract targets in view; Phase 2.9's reuse proof includes an extraction workflow; minimal exported-data review (MVP 4.4, E53); cost measured on `member-directory` (E57, E58) | all | X4, X5 |

Week 3's Phase 3.7 then builds the Simple Mode entry, field editing, and the
all-pages choice on X2-X4, plus Encrypt column (D13) with its Core share (Core K11).

## Validation

- Every guard gets a unit test beside its subject and a mutation proof, rerun by
  the supervisor before its ledger entry.
- Extension: content harness `extract-list.spec.ts`, `actions.spec.ts`, a new
  `extraction-inference.spec.ts`, and manual Chrome side-panel and Firefox popup
  validation of the picker.
- Core: focused vitest with `--no-file-parallelism` (the parallel suite is
  unsound on this machine), `pnpm check`, `pnpm docs:check`, `pnpm build`,
  `pnpm package:validate`.
- Lab: `pnpm lab run product-catalog --flow` (W04 no longer refused),
  `pnpm lab run data-table --flow --variant column-reorder`,
  `pnpm lab run product-catalog --workflow paginated-extraction --flow`, then a
  week1 A/B pair on the production-Core topology and `lab compare` (D7).
- Root `pnpm check`, `pnpm test`, `pnpm build` at each phase close, one at a time.

## Execution partition

Workers own disjoint files; a file two phases need is serial.

**X0 and X1** follow `reports/x0-x1-execution.md` Parts 2-4, which name every
file, test case, acceptance command, and mutation target, amended by D2's
container-text rule and D14:
- W1 extension page: `content/action-runtime/{extract,list-extraction,results,index}.ts`,
  `content/actions/{extract,extract-list,types,dialog}.ts`, their tests, and
  `e2e/content/tests/{actions,extract-list,upload-dialog}.spec.ts`.
- W2 domain contracts: `domain/src/actions/{types,schemas}.ts` and
  `actions/extraction/**` (new), `client/gateway-action-parameters.ts`,
  `client/gateway-mapping.ts`, and their tests.
- W3 domain readers: `runtime/adapter.ts`, `recording/reducers.ts`, later
  `output-nodes/definitions.ts`, and their tests.
- W4 Lab reader: `packages/test-runner/src/flow-lane/{persisted-flow-run,expectations,run-flow-lane}.ts`
  and the four flow-lane and evaluation test files.
- W5 test-contracts: `packages/test-contracts/src/{scenario,validation}.ts` and
  `tests/scenario-validation.test.mjs`.
- W6 corpus follow-up: product-catalog manifest and its test,
  `scenario-steps/extract-records.ts`, `run-expectations/extraction.ts`.
- W7 docs: `sensitive-values.md`, `web-capabilities.md`, `extension-client.md`,
  `testing-facility.md`.

Order: W2-A, W3-A, W4, and W5 in parallel; W1-A after W2-A; W2-B after W1-A and
W2-A; W1-B and W3-B after W2-B (W3-B also after Core K1 names the records path);
W6 after W4 and W5; W7 last; then root `pnpm check`, `pnpm test`, `pnpm build`,
one at a time. `content/actions/` gains no source file (the `extract-*` prefix
rule). W4 and W6 ran as one worker, `x01-test-runner`.

**Found during X0 and X1, taken in rather than parked:**
- X1.6: nothing type-checks `apps/scenario-lab/e2e`, and
  `member-directory.spec.ts:27-28` already has two type errors; wire that
  directory into the scenario-lab `check` so `pnpm check` fails on it, and fix
  the two errors.
- X5: an expected `null` record value cannot pass on either lane yet (the
  recording reader leaves the field out; the Flow reader drops it and now fails
  the run); X5's extraction intent and dataset reader must carry nulls.

**Later phases:**
- Extension X0/X3: `apps/extension/src/content/action-runtime/**`,
  `content/actions/extract*.ts`, `content/extraction/**` (new).
- Extension X4 UI: `content/picker/**` (new), `background/extraction/**` (new),
  `popup/**`, `sidepanel/**`, `content/message-handler.ts`,
  `background/index.ts`, `shared/constants.ts`.
- Domain: `domain/src/actions/**`, `client/gateway-*.ts`, `output-nodes/**`,
  `io/input-model.ts`, `recording/events.ts`, `extraction/**` (new). The
  recording mapping files are serial with X4.
- Lab: `packages/test-contracts/src/**` (serial within the package), then
  `packages/test-runner/src/{run-expectations,scenario-steps,flow-lane,bench}/**`,
  then one worker per fixture in `apps/scenario-lab/src/scenarios/<id>/`.
- Core: owned by the paired document; its executor, `io-policy.ts`, and
  recording-proposal files are serial.

## Risks

- Changing the corpus and evaluation schema breaks comparability with Week 1
  reports; mitigated by D7 and schema-versioned readers.
- Core behaviour changes (run-scoped variables, output references) touch every
  Flow; they ship as `fluxiq` 0.5.0 (D11) with full Core and downstream gates.
- W05 `short-catalog` (Week 2 rank W2-2) replays Next clicks against a page with
  no Next; recordable extraction replaces those clicks, so re-measure before
  treating it as fixed.
- Datasets and export widen what page data leaves the browser; D12 protects
  excluded columns only, so private data in a column nobody excluded is still
  saved and exported.
- Large pages: `web.dom.extract` took 3,503 ms on 5,000 elements (E57); caps and
  item-selector generation must be measured on `member-directory`.
- Picker clicks can be recorded as `dom.click` unless suppressed; Firefox popup
  lifetime is unverified.

## Worker Briefs

Recorded at dispatch on 2026-09-15. Completed briefs are in the
[archive](./first-class-data-extraction-plan/archive/2026-09-15-completed-briefs-and-ledger.md).

### Brief: x0-page
- Repository: this repository
- Task: worker W1 part A of `reports/x0-x1-execution.md` Part 4, on the landed
  `x0-domain` work: X0.1, the page side of X0.3 and X0.5, X0.4, and X0.6, with
  the tests and mutation targets Part 2 names, amended by D2: a text read of a
  container skips the contents of sensitive controls inside it, and an HTML
  read of a container removes sensitive descendants' `value` attributes and
  contents, each with a content-harness case (the sensitive-input fixture, or
  markup injected with `page.evaluate`).
- Required reads: `AGENTS.md`; this document's D2, D4, D5, and D14; the
  report's Part 2 X0.1 and X0.3-X0.6 and Part 4; `reports/x0-domain.md`
- Owns (may edit): `apps/extension/src/content/action-runtime/{extract,list-extraction,results,index}.ts`,
  `apps/extension/src/content/action-runtime/tests/list-extraction.test.ts`,
  `apps/extension/src/content/actions/{extract,extract-list,types}.ts`,
  `apps/extension/src/content/actions/tests/{extract,execute}.test.ts`,
  `apps/extension/e2e/content/tests/{actions,extract-list}.spec.ts`
- Must not touch: the domain, test packages, `content/actions/dialog.ts`, every
  other file, tracked `apps/extension/build/` (always pass a build label)
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/extension check`;
  `EXTENSION_TEST_BUILD_LABEL=x0-page node apps/extension/scripts/test-extension.mjs`;
  the content harness for `actions` and `extract-list` with `--workers=1`, at
  most once per iteration; each mutation target with a `--grep` for its case;
  `node scripts/structure-audit.mjs`. A mutation edit refused by the permission
  classifier is reported, never worked around.
- Definition of done: check, unit tests, and harness cases pass; mutations
  observed red and reverted, or reported as refused; audit passes
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x0-page.md`

### Brief: x3-x5-execution
- Repository: this repository, with FluxIQ Core read where X4 meets K7, read-only
- Task: turn X3, X4, and X5 into executable steps in the shape of
  `reports/x0-x1-execution.md`. Verify `reports/ex-a-extension-domain.md` and
  `reports/ex-d-test-facility.md` against the code as it stands after X0 and
  X1 (commit `13b0a0d`; `x0-page` is in progress), then give per step: files
  with the function or type touched (file:line), new exports, tests with
  cases, the acceptance command, and mutation targets. X3: structured field
  specs and the `loadMore`, `scroll`, and `numbered` pagination modes on the
  page, replacing X1's page guard; inference C4 in `domain/src/extraction/`
  seeded by `content/evidence/repeating.ts`; D2's sensitive-control rules kept;
  no repair hooks (D15). X4: the picker and extraction entry in the Chrome side
  panel and Firefox popup (background-owned pick session, picker clicks kept
  out of the recording), picker messages C5, the recorded event and mapping C3
  with `recordOutput` on the mapper candidate matching Core's K7 contract
  (`metadata.recordsPath`, required `recordsPath`), and `timeoutMs` scaled by
  `maxPages` (D14). X5: the extraction intent seam, `measureExtraction`,
  Flow-lane judging, evaluation schema 0.3 and bench metrics,
  `recordableActionTypes`, fixture additions, W04 and W08 Flow lanes, nullable
  values, and reading Core's run datasets once K5 and K8 land. Give a worker
  partition (owned files, serial files, order, dependencies on Core phases,
  structure budgets) and name the steps that need manual browser validation.
- Required reads: `AGENTS.md`; this document's Decisions, Design, Phases, and
  Execution partition; the two reports named; `reports/x0-x1-execution.md`
  Part 4; CD13-CD20 and K7-K8 in
  `F:\!FluxIQ\docs\working\first-class-data-extraction-plan.md`
- Owns (may edit): its report only
- Must not touch: all source and documents; no builds, tests, Lab runs, or
  browsers
- Definition of done: X3, X4, and X5 executable without rediscovery
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x3-x5-execution.md`

### Brief: x0-9-snapshot-sensitive-text
- Repository: this repository
- Task: close the leak `x0-page` found (D2): element descriptors in the page
  snapshot every reply carries include a sensitive `<textarea>`'s or
  `<select>`'s contents through `text`, `visibleText`, and `accessibleName`
  (`apps/extension/src/content/describe-element.ts:50-54,75-76`, per
  `reports/x0-page.md`). A sensitive control's descriptor carries no string
  derived from its contents; a container's text excludes the contents of
  sensitive controls inside it, reusing `x0-page`'s helper where one exists.
  Restore whole-reply secret scans in the specs `x0-page` narrowed, add unit
  and content-harness cases on the sensitive-input fixture, and update the
  page-text bullet in `docs/architecture/sensitive-values.md`.
- Required reads: `AGENTS.md`; this document's D2; `reports/x0-page.md`;
  `docs/architecture/sensitive-values.md`
- Owns (may edit): `apps/extension/src/content/describe-element.ts`, a helper
  beside it if needed, their unit tests, the specs `x0-page` narrowed, and
  `docs/architecture/sensitive-values.md`
- Must not touch: the domain, `content/action-runtime/**`, `content/actions/**`,
  every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/extension check`;
  `EXTENSION_TEST_BUILD_LABEL=x0-9 node apps/extension/scripts/test-extension.mjs`;
  the content harness for the affected specs with `--workers=1`;
  `node scripts/structure-audit.mjs`; mutations observed red and reverted (on a
  scratch copy outside the repository if the classifier refuses real source)
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x0-9-snapshot-sensitive-text.md`

### Brief: x1-domain-contracts
- Repository: this repository
- Task: worker W2 part B of `reports/x0-x1-execution.md` Parts 3-4: X1.1 (new
  `domain/src/actions/extraction/` with `request.ts`, `summary.ts`, `schema.ts`,
  and a barrel, re-exported from `types.ts`; `WebAutomationActionResult`
  gains `extraction` and `dialog`), X1.2's domain share (the lift for field
  specs, `itemElement`, the `mode` pagination union, and the all-excluded
  refusal; `encrypt` refused with `web.action.not_implemented` in
  `gateway-mapping.ts`), X1.3's payload copy of `extraction` and `dialog`, and
  X1.4's schemas with a `minItems` maximum at the item cap (D14), each with the
  report's tests and mutation targets. Core K1 answered that `oneOf` is not
  accepted, so `fields` stays `type: "object"`.
- Required reads: `AGENTS.md`; this document's D2, D12-D14; the report's Parts
  3-4; `reports/x0-domain.md`
- Owns (may edit): `domain/src/actions/{types,schemas}.ts`,
  `domain/src/actions/extraction/**`, `domain/src/actions/tests/schemas.test.ts`,
  `domain/src/client/{gateway-action-parameters,gateway-mapping}.ts`,
  `domain/src/client/tests/{gateway-command-parameters,gateway-mapping}.test.ts`
- Must not touch: the extension, `domain/src/output-nodes/**`, other domain
  directories, other packages
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/domain check`;
  `DOMAIN_TEST_BUILD_LABEL=x1-domain pnpm --filter @fluxiq-web-extension/domain test`;
  `node scripts/structure-audit.mjs`; mutations observed red and reverted
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x1-domain-contracts.md`

### Brief: x1-page-b
- Repository: this repository
- Task: worker W1 part B of `reports/x0-x1-execution.md`, after
  `x1-domain-contracts` and `x0-9-snapshot-sensitive-text`: X1.2's page guard
  (a spec-form field or a non-`next` pagination mode fails with
  `web.action.not_implemented` naming the feature, until X3) and X1.3's page
  share (`ActionResultEvidence` and `buildResult` carry `extraction` and
  `dialog`; `extract-list.ts` passes the summary with excluded fields left out
  of `fieldNames`; `dialog.ts` moves its evidence from `extracted` to
  `dialog`), with the report's tests and mutation targets.
- Required reads: `AGENTS.md`; this document's D12 and D14; the report's X1.2,
  X1.3, and Part 4; `reports/x0-page.md`; `reports/x1-domain-contracts.md`
- Owns (may edit): `apps/extension/src/content/action-runtime/{list-extraction,results}.ts`,
  `apps/extension/src/content/actions/{extract-list,dialog}.ts`, their unit
  tests, `apps/extension/e2e/content/tests/{extract-list,upload-dialog}.spec.ts`
- Must not touch: the domain, `describe-element.ts`, every other file
- Validation, run alone: extension check; unit tests with
  `EXTENSION_TEST_BUILD_LABEL=x1-page-b`; the content harness for
  `extract-list` and `upload-dialog` with `--workers=1`; structure audit;
  mutations observed red and reverted
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x1-page-b.md`

### Brief: x1-output-nodes
- Repository: this repository
- Task: after `x1-domain-contracts`, give the `extract_list` output definition
  `metadata.recordsPath: "extracted"` (Core CD19, read from the output
  definition's `metadata` as `packages/fluxiq/src/domains/index.ts:43-49`
  shows) and declare a `timeoutMs` parameter (D14), in
  `domain/src/output-nodes/definitions.ts`, with tests and a mutation.
- Required reads: `AGENTS.md`; this document's D14; the report's X1.3; the Core
  file named
- Owns (may edit): `domain/src/output-nodes/definitions.ts`,
  `domain/src/output-nodes/tests/definitions.test.ts`
- Must not touch: every other file
- Validation, run alone: domain check; `DOMAIN_TEST_BUILD_LABEL=x1-nodes`
  domain test; structure audit; dropping `recordsPath` observed red and reverted
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x1-output-nodes.md`

### Brief: x1-6-e2e-typecheck
- Repository: this repository
- Task: X1.6: nothing type-checks `apps/scenario-lab/e2e`. Wire it into the
  scenario-lab package's `check` script (a DOM-typed tsconfig for `e2e`,
  following how `apps/extension/e2e` is checked if it is) so root `pnpm check`
  fails on an e2e type error, and fix the two existing errors at
  `apps/scenario-lab/e2e/member-directory.spec.ts:27-28` without changing what
  the test does. Report, rather than fix, any other e2e errors that appear.
- Required reads: `AGENTS.md`; `reports/x01-test-runner.md`; the scenario-lab
  and extension package manifests and tsconfigs
- Owns (may edit): `apps/scenario-lab/package.json` (the `check` script only),
  a new e2e tsconfig under `apps/scenario-lab/`,
  `apps/scenario-lab/e2e/member-directory.spec.ts`
- Must not touch: every other file; no browser or Lab run
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/scenario-lab check`
  passes; a deliberate type error in a scratch copy of an e2e spec makes it
  fail; structure audit
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x1-6-e2e-typecheck.md`

## Work Ledger

### 2026-09-15 — x0-page done and verified; snapshot leak taken in; X1 briefs recorded
- Agent: supervisor; worker `x0-page`
- Changed: the extension files named in `reports/x0-page.md` (uncommitted);
  this document (briefs for `x0-9-snapshot-sensitive-text`,
  `x1-domain-contracts`, `x1-page-b`, `x1-output-nodes`, `x1-6-e2e-typecheck`);
  completed briefs and older ledger entries moved to the archive
- Why: X0's page share (sensitive refusals in every mode, the container text and
  HTML rules, `minItems` and sign-in gates, de-duplicated append pagination, the
  item cap, honoured `timeoutMs`). The worker found page snapshots leaking
  sensitive `<textarea>` and `<select>` contents, taken in as `x0-9`
- Validation: supervisor runs, alone and in order:
  `pnpm --filter @fluxiq-web-extension/extension check` → exit 0;
  `EXTENSION_TEST_BUILD_LABEL=supervisor-x0-page node apps/extension/scripts/test-extension.mjs`
  → `# tests 516`, `# pass 516`, `# fail 0`;
  `pnpm --filter @fluxiq-web-extension/extension test:content -- actions extract-list --workers=1`
  → `34 passed`. Mutation proofs not rerun by the supervisor.
- Outcome: Accepted
- Follow-up: commit; root gates, then push; dispatch `x0-9` and
  `x1-domain-contracts` as slots free, then `x1-page-b`, `x1-output-nodes`, and
  `x1-6-e2e-typecheck`

### 2026-09-15 — Scope set for this push; X3-X5 detail dispatched
- Agent: supervisor; worker `x3-x5-execution`
- Changed: this document (Status detail, Current State, D15, X3 and X6 rows,
  Worker Briefs)
- Why: the user asked to finish the extraction work in Core and the
  extension, the security fixes, and planning for the rest of Week 2, then stop
  for review; X3-X5 had no file-level detail
- Validation: not validated; planning document only
- Outcome: Partial
- Follow-up: build X1's remainder now; X3-X5 once detailed

### 2026-09-15 — x01-test-runner done; X0 domain, X1.5, and X0.7 verified together
- Agent: supervisor; worker `x01-test-runner`
- Changed: the test-runner and scenario-lab files named in its report
  (uncommitted); this document (execution notes, open questions)
- Why: restore the compilation `x1-test-contracts` broke and land X0.7; Core K1
  answered the parameter-schema union question
- Validation: supervisor runs, alone and in order:
  `pnpm --filter @fluxiq-web-extension/test-runner build` → exit 0; `node --test`
  over the seven flow-lane, extract-records, extraction, and single-run
  evaluation test files → `# tests 73`, `# pass 73`, `# fail 0`;
  `pnpm --filter @fluxiq-web-extension/scenario-lab test` → `# tests 205`,
  `# pass 205`, `# fail 0`. The domain and test-contracts runs are in the entry
  below. Mutation proofs not rerun by the supervisor.
- Outcome: Accepted
- Follow-up: commit this group with X0 domain and X1.5; X1.6 and the X5 null
  note are recorded under Execution partition

### 2026-09-15 — x0-domain done; x1-test-contracts partial; two briefs recorded
- Agent: supervisor; workers `x0-domain`, `x1-test-contracts`
- Changed: the domain X0 files and the test-contracts X1.5 files named in the
  two reports (uncommitted); this document (D2, D14, Worker Briefs)
- Why: `x1-test-contracts` left the scenario-lab test build and the test-runner
  type check failing on nullable record values until its follow-ups land, so
  W4 and W6 combine into `x01-test-runner`, which fixes compilation first; D2's
  container rule now covers HTML reads; `minItems` gains a schema maximum
- Validation: supervisor runs, alone and in order:
  `pnpm --filter @fluxiq-web-extension/domain check` → exit 0;
  `DOMAIN_TEST_BUILD_LABEL=supervisor-x0 pnpm --filter @fluxiq-web-extension/domain test`
  → `# tests 412`, `# pass 412`, `# fail 0`;
  `pnpm --filter @fluxiq-web-extension/test-contracts test` → `# tests 81`,
  `# pass 81`, `# fail 0`. Mutation proofs not rerun by the supervisor. The
  scenario-lab test build and the test-runner type check are known broken until
  `x01-test-runner` lands.
- Outcome: Partial
- Follow-up: `x0-page` and `x01-test-runner` dispatched; commit X0 domain and
  X1.5 together once the test-runner and scenario-lab builds are green

### 2026-09-15 — Core K1-K10 decided; records path and Lab reader updated
- Agent: supervisor; Core worker `k-datasets-execution`
- Changed: this document (C2 records path, Lab Flow-run reader, open questions)
- Why: Core decided that the domain output declares `metadata.recordsPath` and
  that saved traces carry dataset markers instead of rows
- Validation: not validated; planning documents only
- Outcome: Accepted
- Follow-up: X5's reader uses Core's dataset endpoints

Earlier entries are in the
[archive](./first-class-data-extraction-plan/archive/2026-09-15-completed-briefs-and-ledger.md).

## Open Questions

- **E53 redaction for datasets and export.** Decided 2026-09-15 as D12; the
  user chose excluding a column outright over masking its values.
- **Collection-target repair contract.** The shape Core gives list targets so
  adaptation can repair `extract_list` (today `elementTarget` means one
  element). Owner: senior supervisor agent, decided with E2 before X3's repair
  hooks.
- Core's own questions (dataset-row withholding, output-reference withholding,
  side-effect class, default `recordsPath`, key custody, derivation cost) are
  decided in the paired document as CD1-CD20.
- **Core parameter-schema unions.** Answered 2026-09-15 by Core K1: node
  parameters are not JSON Schema and a domain output's schema is only compared
  for equality (`packages/fluxiq/src/programs/automation-studio/nodes/contracts.ts:40-64`,
  `packages/fluxiq/src/io/index.ts:511,517`), so `fields` stays
  `type: "object"` and the gateway lift enforces the unions (X1.4).
