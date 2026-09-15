# First-Class Data Extraction Plan

Status: Active
Status detail: Plan complete 2026-09-15 from four investigations; execution starts with phases X0 and X1 at the start of Week 2, and Core's design lives in the paired document.
Created: 2026-09-15
Last updated: 2026-09-15
Owner: Senior supervisor agent
Scope: Make structured data extraction a fundamental FluxIQ capability: Core owns generic datasets (schema, per-run persistence, preview, CSV/JSON export, iteration) and their UI; the web domain and extension own DOM extraction, element picking, repeating-structure and field detection, and pagination; extraction is recordable and compiles to ordinary Flow nodes; the Testing Lab measures FluxIQ's own extraction.
Paired document: `F:\!FluxIQ\docs\working\first-class-data-extraction-plan.md`
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Phase 2.0), [Week 1 plan](./mvp-week1-web-automation-reliability-plan.md), [LLM production automation plan](./llm-production-automation-plan.md), [web capabilities](../architecture/web-capabilities.md), [testing facility](../architecture/testing-facility.md), [sensitive values](../architecture/sensitive-values.md)

---

## Current State

**Phase, as of 2026-09-15: plan complete; no code changed.** The user decided
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
1. **Security:** `web.dom.extract` returns a sensitive control's live `.value`
   (`extract.ts:10`); `extracted` has no sensitivity guard on the wire or in
   recordings.
2. A list matching zero items passes, so a sign-in wall yields success with `[]`.
3. Virtualised lists under-read silently, 15 of 240 (open question E55).
4. Core trace withholding corrupts extracted strings that contain a run input.
5. "Load more" pagination duplicates records; `timeoutMs` is ignored; there is no
   item or byte cap; the Lab's Flow-run reader drops non-string values.

**Done:** all four investigations; this plan and Core's design (paired
document); Phase 2.0 in the MVP plan; the Week 1 plan closed and pointed here;
agent instructions, Priority 4, and open questions E2, E53, and E55 updated;
excluded dataset columns decided (D12); Encrypt column designed for Week 3 (D13).

**Not done:** every phase below.

**Next steps:**
1. Firm up Core's share from three investigations (Secret Keys derivation fix,
   encrypted fields, dataset execution detail), recorded in the paired document.
2. Run X0 (security and correctness) and X1 (contracts) with Core K0 (Secret
   Keys derivation) and K1 (record-set contracts), partitioned by file, beside
   Phases 2.1-2.3.
3. Settle Core's open questions 1-2 (dataset withholding, output references)
   before Core phase K4 persists rows.

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
- **D2. Sensitive controls:** extraction refuses a sensitive control's value with
  `blocked_by_capability_or_policy`, matching every other reader.
- **D3. Recordings carry no extracted sample values** by default; previews come
  from Core's dataset store once it exists.
- **D4. Empty lists:** `minItems` defaults to 1; a workflow where empty is valid
  (W06 `no-results`) declares `minItems: 0`. Otherwise zero items fail as
  `output_not_observed`.
- **D5. Pagination leaves the page on the last page read**, so the W05 and W07
  final-state oracles stay valid.
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
  field editor. A run seals each value with the project's public key, so
  unattended runs never need the user's password. Viewing, exporting, or using
  the values in a later run needs the private key, which is sealed with the
  user's FluxIQ account password in the pattern of Core's Secret Keys program
  and never stored in the project folder. The table shows a masked cell with
  Reveal, which asks for the password again; CSV/JSON export leaves the column
  out unless the user confirms the password and chooses to include it in clear.
  Lookup attacks are closed by design: each value gets a fresh random key and
  IV, so identical values never look alike; no hash or deterministic token of an
  encrypted value is stored, so encrypted columns cannot be sorted,
  de-duplicated, or used as a key; and the password-sealed private key uses a
  random salt and scrypt at no less than OWASP's minimum (N=2^17, r=8, p=1),
  with its parameters stored beside it so they can be raised. What remains is
  offline guessing of a weak account password by someone holding the files, and
  a forgotten password loses the values. It protects copied project folders,
  backups, and shared projects, not a logged-in, unlocked session.

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
  - `paginate` becomes a union of `next` (today's shape), `loadMore`, `scroll`,
    and `numbered`, de-duplicating append modes by element identity;
  - `timeoutMs` honoured by the page.
- **C2 result summary:** keep `extracted: records[]`; add a closed
  `extraction: { recordCount, pagesRead, truncated, missingFields, fieldNames }`;
  move dialog evidence off `extracted`. The domain output definition declares
  the default `recordsPath` (`extracted`) and a record-schema hint for Core.
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
  attempts. The Flow-run reader reads Core's run datasets once K5 lands; until
  then only `session.trace.attempts[].outputs.result` carries records, subject to
  withholding. It reports non-string values instead of dropping them.

## Phases

| Phase | Work | Owner area | Depends on |
| --- | --- | --- | --- |
| X0 | Security and correctness: refuse sensitive `.value` (D2); fail empty lists (D4); de-duplicate append pagination; item cap; honour `timeoutMs`; the Lab reader's silent drop; Core K0 raises Secret Keys' password-derivation cost and re-seals older keys | extension, domain, test-runner, Core | none |
| X1 | Contracts: C1, C2 (domain); Core K1 record-set contracts; test-contracts additions | domain, Core, test-contracts | none |
| X2 | Core datasets K2-K6 and K8-K9: store, capture, record-batch persistence, run detail, iteration, endpoints and export route, datasets panel | Core | X1 |
| X3 | Extraction engine: structured field specs and pagination modes, inference C4, repair hooks (needs the collection-target contract) | extension, domain | X1 |
| X4 | Recordable extraction: picker and side-panel entry, recorded event and mapping C3, Core K7 mapper `recordOutput` lift | extension, domain, Core | X2, X3 |
| X5 | Lab measurement: extraction intent seam, `measureExtraction`, Flow-lane judging, bench metrics, fixtures (images, sparse fields, absolute links, numbered pages, load more, empty and large tables, frame extraction, sensitive text), W04/W08 Flow lanes | test-runner, test-contracts, scenario-lab | X1, X4 |
| X6 | Loop integration with Phases 2.4-2.9: extraction drift variants (W04 `text-variant`, W08 `column-reorder`, a new item-selector drift) through adaptation; E2 decided with extract targets in view; Phase 2.9's reuse proof includes an extraction workflow; minimal exported-data review (MVP 4.4, E53); cost measured on `member-directory` (E57, E58) | all | X4, X5 |

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

Recorded at dispatch on 2026-09-15; the full dispatched text asked for file:line
evidence throughout.

### Brief: ex-a-extension-domain
- Repository: this repository
- Task: document the current `web.dom.extract` and `web.dom.extract_list`
  contracts, result transport and redaction, the recorder pipeline and where a
  recorded extract event would plug in, `content/evidence/repeating.ts`, the
  side-panel UI placement for an extraction entry and element picker, and
  existing extraction tests; recommend the extension/domain design with files,
  ordered steps, and tests.
- Required reads: `domain/src`, `apps/extension/src`,
  `docs/architecture/web-capabilities.md`, `docs/architecture/sensitive-values.md`
- Owns (may edit): its report only
- Must not touch: all source and documents
- Definition of done: report answers every question with file:line
- Report to: docs/working/first-class-data-extraction-plan/reports/ex-a-extension-domain.md

### Brief: ex-b-core
- Repository: FluxIQ Core
- Task: document how node outputs persist per run, any existing dataset,
  variable, or state concept, iteration and data-passing nodes, the recording
  proposal pipeline for a domain-proposed extract node, import/export and
  storage infrastructure, and web-panel surfaces and domain view contributions;
  recommend the minimal generic Core design with files, steps, tests, and
  compatibility impact.
- Required reads: `packages/fluxiq/src`, `apps/web/src`, `docs/architecture`
- Owns (may edit): its report only
- Must not touch: all source and documents
- Definition of done: report answers every question with file:line
- Report to: `F:\!FluxIQ\docs\working\first-class-data-extraction-plan\reports\ex-b-core.md`

### Brief: ex-c-plans-docs
- Repository: this repository (plus Core's working-document index)
- Task: inventory every existing statement about extraction and Week 2/3
  sequencing, produce an exact edit list for existing documents, the protocol
  requirements for this document and its Core pair, and a sequencing
  recommendation.
- Required reads: the MVP plan and agent instructions, `docs/working` indexes
  and the Week 1, LLM, and testing-facility plans, open questions, the extraction
  passages in architecture pages, the protocol
- Owns (may edit): its report only
- Must not touch: all documents
- Definition of done: report lists statements, edits, protocol rules, sequence
- Report to: docs/working/first-class-data-extraction-plan/reports/ex-c-plans-docs.md

### Brief: ex-d-test-facility
- Repository: this repository
- Task: document what each extraction row judges on each lane today, the
  contract changes needed so FluxIQ's own extraction is measured, fixture
  coverage gaps, new metrics, and file-partitioned implementation steps with
  tests and mutation targets.
- Required reads: `packages/test-runner/src`, `packages/test-contracts/src`,
  `apps/scenario-lab/src`, `docs/architecture/testing-facility.md`
- Owns (may edit): its report only
- Must not touch: all source and documents
- Definition of done: report answers every question with file:line
- Report to: docs/working/first-class-data-extraction-plan/reports/ex-d-test-facility.md

### Brief: x0-x1-execution
- Repository: this repository, read-only
- Task: turn X0 and X1 into executable steps. Verify
  `reports/ex-a-extension-domain.md`, `reports/ex-d-test-facility.md`, and this
  document's Design (C1, C2) and decisions D2, D4, D12, D13 against code, then
  give per step: files to create or change with the function or type touched
  (file:line); test files (a `tests/` folder or the content e2e harness) with
  cases; the acceptance command; mutation targets. X0: refuse a sensitive
  control's value in `web.dom.extract` and on the `extracted` wire and
  recording paths; `minItems` default 1 failing as `output_not_observed`, and
  every scenario or test relying on an empty list passing (W06 `no-results`
  declares `minItems: 0`); de-duplicated append pagination; an item cap;
  honoured `timeoutMs`; the Lab Flow-run reader's silent drop of non-string
  values. X1: C1 v2 (field specs with `handling: include|exclude|encrypt`,
  `encrypt` refused until built; `itemElement`; the paginate union), C2, schemas
  and gateway parameter mapping, and test-contracts additions, keeping today's
  string field grammar valid. Give a worker partition: files each worker owns,
  serial files, and order, within the structure audit budgets.
- Required reads: `AGENTS.md`; this document; the two reports and the files
  they name; `docs/architecture/sensitive-values.md`
- Owns (may edit): its report only
- Must not touch: all source and documents
- Definition of done: X0 and X1 executable without rediscovery
- Report to: docs/working/first-class-data-extraction-plan/reports/x0-x1-execution.md

## Work Ledger

### 2026-09-15 — Firming the plan for execution; investigations dispatched
- Agent: supervisor; workers `x0-x1-execution` here, and `k0-secret-keys-kdf`,
  `k11-encrypted-fields`, `k-datasets-execution` in the paired document
- Changed: this document (Current State next steps, X0 row, Week 3 note,
  Worker Briefs)
- Why: the user asked for the Secret Keys fix and the Encrypt column in the
  plan and for Core's data share to be firmed up before work starts
- Validation: not validated; planning documents only, no code changed
- Outcome: Partial
- Follow-up: write the four reports' results into both documents

### 2026-09-15 — D13 hardened against lookup attacks
- Agent: supervisor
- Changed: this document (D13); the Core pair (open questions 5 and 6)
- Why: the user asked whether a rainbow table could reverse an encrypted column
- Validation: not validated; planning documents only, no code changed
- Outcome: Accepted
- Follow-up: Core open question 6 (Secret Keys' scrypt cost) sits outside this
  plan's phases

### 2026-09-15 — Encrypt column designed (D13)
- Agent: supervisor
- Changed: this document (D13, C1 `handling`, Week 3 note, Current State); the
  Core pair (record schema `handling`, open question 5)
- Why: the user asked whether an encrypted column would be practical and
  secure; Core's Secret Keys program and project-content protection
  (`F:\!FluxIQ\docs\architecture\automation-studio\persistence.md:180-198`)
  show it is, provided the key stays outside the project
- Validation: not validated; planning documents only, no code changed
- Outcome: Accepted
- Follow-up: X1 and K1 reserve `encrypt`; Phase 3.7 builds it

### 2026-09-15 — D12 revised: Exclude column instead of a withheld marker
- Agent: supervisor
- Changed: this document (D12, C1 `excluded`, Current State, risks, E53); the
  Core pair (record schema `excluded`, capture, open question 1); Week 1 open
  question E53
- Why: the user judged a column nobody can see no better than no column, and
  asked for an "Exclude column" option, with an info hover, that leaves the
  column out of the output entirely
- Validation: not validated; planning documents only, no code changed
- Outcome: Accepted
- Follow-up: X1 and K1 carry the field; Phase 3.7's field editor shows the
  option and its hover

### 2026-09-15 — Sensitive dataset columns decided (D12)
- Agent: supervisor
- Changed: this document (D12, C1 `sensitive`, Current State, risks, E53); the
  Core pair (record schema `sensitive`, capture, open question 1); Week 1 open
  question E53
- Why: the user asked what the dataset redaction question meant; under their
  standing instruction the recommendation became the decision
- Validation: not validated; planning documents only, no code changed
- Outcome: Accepted
- Follow-up: X1 and K1 carry the `sensitive` field

### 2026-09-15 — Core design merged; plan complete
- Agent: supervisor; worker `ex-b-core`
- Changed: this document (Core findings, D9-D11, Lab reader, phases, risks); the
  Core pair (design, phases K1-K10, open questions)
- Why: Core's investigation corrected where records live and supplied the
  generic dataset design
- Validation: not validated; planning documents only, no code changed. Findings
  are code reads with file:line in the four reports.
- Outcome: Accepted
- Follow-up: execute X0 and X1 at the start of Week 2

### 2026-09-15 — Plan written from three investigations; existing plans updated
- Agent: supervisor; workers `ex-a-extension-domain`, `ex-c-plans-docs`,
  `ex-d-test-facility`
- Changed: this document; MVP plan (Phase 2.0, loop note, Phase 3.7 notes,
  Priority 4); `MVP_AGENT_INSTRUCTIONS.md` (Week 2, Week 3, Priority 4); Week 1
  plan (Status `Complete`, next steps); Week 1 open questions E2 and E55
- Why: turn the user's extraction decision into an executable, sequenced plan
- Validation: not validated; planning documents only, no code changed
- Outcome: Partial
- Follow-up: merge `ex-b-core`; regenerate indexes; commit and push

### 2026-09-15 — Plan created; read-only investigations dispatched
- Agent: supervisor; workers `ex-a-extension-domain`, `ex-b-core`,
  `ex-c-plans-docs`, `ex-d-test-facility`
- Changed: this document and its Core pair
- Why: the user decided extraction is a fundamental FluxIQ capability and asked
  for a fast plan using subagents
- Validation: not validated; planning documents only, no code changed
- Outcome: Partial
- Follow-up: write the phased plan from the four reports

## Open Questions

- **E53 redaction for datasets and export.** Decided 2026-09-15 as D12; the
  user chose excluding a column outright over masking its values.
- **Collection-target repair contract.** The shape Core gives list targets so
  adaptation can repair `extract_list` (today `elementTarget` means one
  element). Owner: senior supervisor agent, decided with E2 before X3's repair
  hooks.
- Core's own questions (dataset-row withholding, output-reference withholding,
  side-effect class for read-only extraction, default `recordsPath`) are owned by
  the paired document.
