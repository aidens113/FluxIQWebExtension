# First-Class Data Extraction Plan

Status: Active
Status detail: Executing 2026-09-15; X0-X3, X4.1 and X5 contracts/measurement/fixtures are complete, verified, committed and pushed, and the picker (X4.2-X4.4) is now being built after the user gave the go.
Created: 2026-09-15
Last updated: 2026-09-15
Owner: Senior supervisor agent
Scope: Make structured data extraction a fundamental FluxIQ capability: Core owns generic datasets (schema, per-run persistence, preview, CSV/JSON export, iteration) and their UI; the web domain and extension own DOM extraction, element picking, repeating-structure and field detection, and pagination; extraction is recordable and compiles to ordinary Flow nodes; the Testing Lab measures FluxIQ's own extraction.
Paired document: `F:\!FluxIQ\docs\working\first-class-data-extraction-plan.md`
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md) (Phase 2.0), [Week 1 plan](./mvp-week1-web-automation-reliability-plan.md), [LLM production automation plan](./llm-production-automation-plan.md), [web capabilities](../architecture/web-capabilities.md), [testing facility](../architecture/testing-facility.md), [sensitive values](../architecture/sensitive-values.md)

---

## Current State

**Phase, as of 2026-09-15: X0-X3, X4.1 and X5's contracts, measurement and
fixtures are complete and verified, every worker has reported, and both
repositories are committed and pushed.** The user decided
that structured data extraction is a fundamental FluxIQ capability, Core
included, and asked for the plan quickly using subagents. Four read-only
investigations produced it: `ex-a-extension-domain`, `ex-c-plans-docs` and
`ex-d-test-facility` here, and `ex-b-core` in Core's paired folder. Per the
user's standing instruction, the recommendations below are decisions unless the
user overrides them.

**Done and verified in the working tree:** X0 (sensitive-control refusals in
every mode, empty lists, de-duplicated append pagination, the item cap, the
honoured `timeoutMs`, the Lab reader) and **five** sensitive-text leak fixes
(`x0-9` to `x0-12`), three of them beyond the original plan; X1's domain
contracts, page summary, output-node metadata, and the scenario-lab e2e type
check; X3-A's domain inference; and X3-B's page extraction engine — the field
kinds with `null` for an optional miss, and the `loadMore`, `scroll`, and
`numbered` pagination modes.

X3-C's inference is verified too, so picking one element now yields a proposal:
the repeating container, an item selector accepted only when it matches exactly
the run, the fields with their coverage, and the pagination style. The extension
suite is 578 tests passing.

X4.1 is verified: a recorded extraction becomes a real node, with the recorded
definition rebuilt field by field so no sample value and no unknown key survives
(D3). The domain suite is 472 tests passing, and its exit code is honest again
now that a hard-coded builtin-node count is derived rather than literal.

X5.1, X5.2, and X5.4 are complete and verified. The evaluation format is at
version 0.3, it reads 0.1 and 0.2 as 0.3 with no extraction measurement, and
`RunExtractionMeasurement` refuses any string member, so no extracted record
value can reach an evaluation or bench file. `measureExtraction` matches
positionally and matches `null` only against `null` (D16), and an expectation
nothing can judge is now **refused** rather than silently passing. The fixtures
across all six scenarios are 225 tests passing.

**In progress:** the picker — X4.2, X4.3 and X4.4, with one worker each for the
content picker, the background control, and the popup and side-panel UI.
Everything before it has reported and been verified by a run the supervisor
made itself.

**The content harness is green, and that claim is worth stating precisely.** It
ran to **267 passed, twice** (53.0s and 51.7s). It had been 261 passed with 6
failed; `x5l` fixed four real spec regressions, taking it to 265 with 2; the
last two were a teardown hang in the Lab's own HTTP `close()`, now fixed. The
earlier worry that a sensitive-text leak might have reopened is **resolved, not
outstanding**: the whole-wire secret scan passed, and the three identity rows
had failed *before evaluating any assertion*, on extraction refusing to read a
sensitive control — the feature D2 requires, working. Two assertions were
strengthened in the process and none weakened.

**Core is committed** on its `dev` branch as `0e5c447`, with `870643c` on top,
and all of its gates green: 172 test files and 1,381 tests, both package type
checks, the build, `docs:check`, and a structure audit that passes outright.
The second commit exists because of a trap this repository shares: the structure
audit takes its file list from `git ls-files`, so it cannot see **untracked**
files, and every new directory in the first commit was untracked when the
pre-commit audit ran. A real import violation therefore appeared only after
committing. **Stage this repository before believing its audit result** — all of
its new extension, domain and scenario-lab files are untracked right now, so its
audit is blind in exactly the same way.

**Both repositories are now committed and pushed.** This side landed as
`e458692`, with `7f1f888` and `a9df420` on top for the Week 2 plan reshape and
the excluded-column rule. Both `dev` branches are level with `origin/dev`, with
nothing ahead and nothing uncommitted, verified by `git status -sb` and
`git log origin/dev..dev` in each. `AGENTS.md` requires the two to move in the
same work unit when a change spans them, and they did.

**Not done:** X5.3 (the intent seam, which waits on X4-C), X5.5-X5.7 (Flow-lane
judging and bench), and X6 (with the Week 2 loop).

**Next steps:**
1. **The picker is being built.** The user gave the go on 2026-09-15 and asked
   for maximum parallelism, so X4-B, X4-C and X4-D run concurrently. The
   supervisor landed the picker's message names in
   `shared/extraction-messages.ts` first, as the seam all three share, so they
   did not have to run in a chain.
2. **X5-H is done and verified**: nine files replace the two oversized specs,
   the largest 292 lines, every one of the 45 test call sites preserved and all
   eight new files collected by the harness. New harness specs cannot go
   directly in `e2e/content/tests/` — that folder sits at the audit's hard
   25-file limit, so a new spec belongs in a subject subfolder's `tests/`.
   **Measure length with `wc -l`, never
   PowerShell's `Measure-Object -Line`** — the latter does not count blank
   lines, so it under-reported this document by about 60 lines all session and
   let it breach the limit three times while appearing to have headroom.
3. **Stage before believing an audit result.** The structure audit reads
   `git ls-files` and is blind to untracked files, which is what let a real
   import violation through on the Core side. The same applies to scanning a
   diff for secrets: scan what is staged.

**Settled since, and no longer held:**
- Whether a value *lifted out of* a dataset row may reach the saved trace. The
  user decided it on 2026-09-15: an excluded column is never recorded at all,
  the lifted-value path included, so that path is a **defect to close** rather
  than a limit to document. D12 carries the full rule and Core's paired plan
  carries the defect.
- X5-H, the spec split, is complete and supervisor-verified.

**Still open, and engineering judgement rather than product promise:**
- `x3c`'s four open design questions: sharing `ITEM_SELECTOR` through the
  evidence barrel, the invented `maxPages` default, the two-value refusal
  vocabulary, and frame routing for X4.
- `x5f`'s finding that a count-only entry scores a false 1.0 in a pooled rate,
  which X5.5 must settle before publishing an extraction accuracy number.

**Blockers:** none. Sensitive data in saved and exported datasets (E53) is
decided by D12.

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
  control or of an element inside one, in every mode (live value, attribute,
  HTML, and list fields), with
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
  **Absent means absent — not recorded at all (the user, 2026-09-15).** The
  value must appear in **no durable record FluxIQ writes**: not the dataset, the
  preview or an export, and **not the saved run trace** — including when a later
  step lifts the value *out of* a row instead of passing the row along whole.
  Identity markers cover only the whole-row case, so the lifted-value path is a
  **defect to close**, not a limit to document; Core's paired plan carries it.
  A value may still be **used** in memory during a run, since otherwise the
  option could not cover a password that has to be typed — but nothing FluxIQ
  persists may contain it. The one boundary to settle when this is built is how
  far a value is followed once the user deliberately transforms it before
  writing it somewhere else; that boundary must be **stated**, never assumed.
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
- **D16. Contract details settled by `x3-x5-execution`:**
  - record field keys match Core's id pattern (`^[A-Za-z0-9_-]{1,100}$`, never
    `__proto__`, `constructor`, or `prototype`) through one domain key function,
    and the picker keeps a separate human label; dataset ids match
    `^[A-Za-z0-9._:-]{1,200}$`, and a re-recorded extraction gets a new id;
  - an optional field the page cannot read is `null`; Core stores that as an
    absent key, and the Lab's dataset reader restores `null` for every schema
    field a row lacks;
  - X5's Flow-lane judging reads Core's run datasets (K5 and K8), with no
    interim reader;
  - Core's K7 lifts an optional candidate `timeoutMs` into
    `parameterValues.timeoutMs`, the only way D14's scaled timeout reaches a
    recorded node;
  - a recorded `extract_list` is executable through an object-parameter
    exception like `upload`'s, and extraction candidates carry no
    `expectedConfirmation`;
  - the picker captures its clicks on `window`, ahead of the recorder, and the
    recorder's mutation tally skips the picker overlay;
  - `scroll` de-duplicates by element and content together, so a virtualised
    list that recycles a node for a new record still reads it (E55 defect 1),
    measured on `admin-console` in X5;
  - new content-harness specs go in an `e2e/content/tests/extraction/`
    subdirectory, because `e2e/content/tests/` already holds 25 files;
  - column header labels in a recorded schema are page structure, not sample
    values, so D3 holds, and `sensitive-values.md` says so;
  - nested values (`extract-specs`) have no contract and move to Week 3's
    Phase 3.7;
  - more Flow-lane rows become judged (W05, W07, W09, W11, W15, and W18 beside
    W04 and W08), so new failures in the first A/B pair are measurements under D7.

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
  `web.data.extraction_defined`, and two inputs:
  `web.user.data_extraction_defined` maps to `web.dom.extract_list`, with
  `recordOutput` and a scaled `timeoutMs` on the mapper candidate;
  `web.user.value_extraction_defined` maps to `web.dom.extract` with a
  structured `extract: { mode, attribute? }` parameter and no `recordOutput`.
  Extraction candidates carry no `expectedConfirmation` (D16). The plug points
  are in `x3-x5-execution` Part 1.
- **C4 inference proposal** (new `domain/src/extraction/`):
  `{ container, item, itemCount, fields: [{ name, spec, coverage }], pagination?,
  confidence }`, seeded by `content/evidence/repeating.ts`, whose signature logic
  moves to a shared module.
- **C5 picker messages,** named in a new `shared/extraction-messages.ts`:
  content `extraction.pick_start|pick_cancel|preview|propose|record`; content to
  background `fluxiq.extractionPicked`; runtime
  `fluxiq.extractionStart|Confirm|Cancel`, `fluxiq.getExtractionSession`, and
  the control-page-only `fluxiq.test.defineExtraction` for X5's intent seam.
  The pick session lives in the background (Firefox popups close on page
  focus), picks are captured on `window` ahead of the recorder, and the overlay
  is excluded from the recorder's mutation tally (D16).

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
  attempts. The Flow-run reader reads Core's run datasets from K5's
  `runDetail.datasets` and K8's `get-run-dataset-page`, restoring `null` for
  fields a stored row lacks (D16). There is no interim reader, because
  `get-flow-run-detail` attempts have never carried records. It reports
  non-string values instead of dropping them.

## Phases

| Phase | Work | Owner area | Depends on |
| --- | --- | --- | --- |
| X0 | Security and correctness: refuse sensitive `.value` (D2); fail empty lists (D4); de-duplicate append pagination; item cap; honour `timeoutMs`; the Lab reader's silent drop; Core K0 raises Secret Keys' password-derivation cost and re-seals older keys | extension, domain, test-runner, Core | none |
| X1 | Contracts: C1, C2 (domain); Core K1 record-set contracts; test-contracts additions (steps X1.1-X1.5 in `reports/x0-x1-execution.md`) | domain, Core, test-contracts | none |
| X2 | Core datasets K2-K6 and K8-K9: store, capture, record-batch persistence, run detail, iteration, endpoints and export route, datasets panel | Core | X1 |
| X3 | Extraction engine: structured field specs and pagination modes, inference C4 (repair hooks moved to X6, D15) | extension, domain | X1 |
| X4 | Recordable extraction: picker and side-panel entry, recorded event and mapping C3, Core K7 mapper `recordOutput` lift | extension, domain, Core | X2, X3, Core K12d (record-output editor) |
| X5 | Lab measurement: extraction intent seam, `measureExtraction`, Flow-lane judging, bench metrics, fixtures (images, sparse fields, absolute links, numbered pages, load more, empty and large tables, frame extraction, sensitive text), W04/W08 Flow lanes | test-runner, test-contracts, scenario-lab | X1, X4; Flow-lane judging after Core K5 and K8 |
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

**X3-X5** follow `reports/x3-x5-execution.md` Parts 2-5 (workers X3-A to X5-D,
owned and serial files, order, Core dependencies, structure budgets, and manual
browser validation), amended by D16. Order: X3-A and X3-B after X1; then X3-C;
X4-A after X3-A and Core K7 (with `timeoutMs`); X4-B after X3-C; X4-C and X4-D
in parallel; manual Chrome side-panel and Firefox popup validation of the
picker; X5-A; then X5-B and the fixture workers, with X5-C once Core K5 and K8
land; X5-H; X5-D; then the Lab runs and the bench pair, one at a time.

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

## Work Ledger

### 2026-09-15 — Picker background control and panel UI landed
- Agent: supervisor; workers `x4c-background-control`, `x4d-picker-ui`
- Changed: `apps/extension/src/background/extraction/**`, `background/index.ts`,
  `background/connection/gateway-payloads.ts`; `popup/extraction/**`,
  `popup/index.{html,ts}`, `popup/styles.css`, `sidepanel/index.html`
- Why: X4.3 and X4.4 — the session state machine behind the picker, and the
  panel the user actually operates
- Validation: the supervisor ran `node apps/extension/scripts/test-extension.mjs`
  itself -> "# fail 0" over the full suite (619 rows after X4-C, 614 after X4-D
  alone). `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0
- Outcome: Accepted, with three follow-ups dispatched
- Follow-up (a), a real user-visible bug rather than tidiness: the extraction
  timeout was a flat 60 s in `confirm.ts`, because four domain functions are not
  re-exported to the extension. A read spanning more than about six pages would
  hit that ceiling and return truncated or failed with nothing in the UI saying
  why — on the feature's main path. Fixed by re-exporting the domain's
  `maxPages`-scaled value and importing it, not by reimplementing the scaling
- Follow-up (b): `isControlPage`, the predicate deciding which pages may drive
  extraction, was written twice. Two copies of a security check are how a hole
  appears — someone tightens one and nothing fails — so it moves to a single
  `background/control-page.ts`
- Follow-up (c): the confirm payload was declared twice after the two workers
  converged mid-flight. The panel's shape is canonical (written and tested
  first, and the origin check guarantees the sender is the user's own panel);
  the content-picker worker folds it into `shared/extraction-messages.ts`
- Note for whoever commits next: `apps/extension/build/` is tracked and is
  currently dirty with a worker's in-flight code, because building is how that
  directory is updated and a worker ran it mid-task. Regenerate it by running
  the build once every extension worker has finished; never commit it from an
  in-flight state

### 2026-09-15 — X5-H verified; picker implementation started
- Agent: supervisor; worker `x5h-spec-split`, then `x4b-content-picker`,
  `x4c-background-control`, `x4d-picker-ui`
- Changed: `apps/extension/e2e/content/tests/{evidence,extraction}/tests/`
  (nine files replacing two oversized specs); `shared/extraction-messages.ts`
  (the picker's message names, landed by the supervisor as the shared seam so
  the three X4 workers could run concurrently instead of in a chain)
- Why: the two specs stood at 790 and 782 lines against a hard 800-line limit,
  blocking extraction fixture rows; then the user gave the go for the picker
- Validation: `wc -l` -> largest resulting spec 292. Test call sites 15+30=45
  before; 48 after, minus the 3 in the untouched `inference.spec.ts` = 45,
  exactly preserved. `pnpm --filter @fluxiq-web-extension/extension check`
  -> EXIT 0, no diagnostics. `npx playwright test --config=
  e2e/playwright.content.config.ts --list` -> all eight new spec files
  collected by name, "Total: 267 tests in 31 files", unchanged from the
  pre-split baseline, which is what proves the nested paths are collected
- Outcome: Accepted
- Follow-up: the three X4 reports, then a harness run and manual browser
  validation of the picker in Chrome side panel and Firefox popup

### 2026-09-15 — Why one test file is stored as binary, checked not assumed
- Agent: supervisor
- Why: the pre-commit review found `domain/src/extraction/tests/label-key.test.ts`
  staged as a **binary** file, which for a TypeScript test means a NUL byte, an
  odd encoding, or memory corruption — and this machine can genuinely produce
  the third. It was diagnosed rather than waved through: the file is plain UTF-8
  with no BOM, 117 lines and 5,477 bytes, and contains **exactly one NUL**. That
  byte sits inside a run of deliberately hostile Unicode — accented Latin, a
  sharp s, a masculine ordinal, euro signs, CJK characters and an emoji — so it
  is an adversarial-input fixture for the label-to-key sanitiser, which is
  exactly what that test exists to cover. Git flags the file on that one byte;
  no `.gitattributes` rule is involved
- Validation: `head -c 16 | od -c` shows no BOM; `tr -dc '\000' | wc -c` → 1;
  `git check-attr -a` → nothing; and the file compiles and runs —
  `pnpm check` exits 0 and the domain suite is 472 passing
- Outcome: Accepted as correct content. The NUL stays: removing it to make git
  treat the file as text would weaken the test that motivated it
- Follow-up: none. Recorded so the next reviewer does not repeat the
  investigation, and so "binary" is not mistaken for corruption



### 2026-09-15 — The harness teardown hang was ours, and is fixed
- Agent: supervisor
- Changed: `apps/scenario-lab/src/server.ts` — the shared `close()` helper both
  the frame server and the main server use
- Why: `server.close()` stops a server accepting new connections but **waits for
  open ones to end**, and an idle HTTP keep-alive socket never ends by itself, so
  teardown hung until Playwright's 30-second timeout — always after the row's
  assertions had passed. It moved between rows and never repeated on the row it
  had just hit, which is the shape this machine's RAM fault produces, and it
  would have been easy and wrong to write it off that way. It is a race over
  whether a socket is still open, and product-catalog serving eight images made
  the race far easier to lose. `closeAllConnections()` destroys those sockets,
  which is what a fixture server torn down after its assertions wants
- Validation: `pnpm --filter @fluxiq-web-extension/scenario-lab check` → exit 0;
  `... test` → `# pass 225`, `# fail 0`; then the full harness **twice**, because
  one clean run cannot distinguish a fix from a flake that did not fire —
  `pnpm --filter @fluxiq-web-extension/extension test:content -- --workers=2`
  → **267 passed** in 53.0s, then **267 passed** in 51.7s, both exit 0. The
  arithmetic corroborates it rather than hiding it: the harness was 261 passed
  with 6 failed, then 265 with 2 after `x5l`, and is now 267 with none
- Outcome: Accepted
- Follow-up: none. The gate is deterministic again, which is what made it usable
  as a commit gate at all

### 2026-09-15 — X5.4's catalog fixtures complete; the Flow lane widens
- Agent: supervisor; worker `x5d-fixtures-catalog` (resumed)
- Changed: three entries in
  `apps/scenario-lab/src/scenarios/product-catalog/manifest.ts`, at `:67` (W04),
  `:111` (W05 `paginated-extraction`), and `:179` (W07 `in-stock-only`), on top
  of its earlier fixture work (all uncommitted)
- Why: `x5g` landed the contract, so the three `web.dom.extract_list`
  expectations that were refused at module load now validate. The worker
  verified the upstream change itself rather than trusting the hand-off, and
  confirmed that nothing of its own depended on the deleted paginated-click
  branch: product-catalog declared no `actions` at all before, and
  admin-console's four entries all come from real type, click, press, and scroll
  steps
- Validation: the worker observed
  `pnpm --filter @fluxiq-web-extension/scenario-lab check` → exit 0 and
  `... test` → 225 passed, 0 failed — the whole package is green, and the
  `infinite-feed` failure seen earlier is gone now that `x5e` has landed, which
  confirms it was the mid-edit collision it looked like. It also ran a **negative
  probe** rather than only a positive one: swapping an entry for
  `web.dom.bogus_action` produced "names web.dom.bogus_action, which no step of
  this workflow's recordingScript records" and 1 failure, then reverted clean.
  That proves the entries are enforced, not merely accepted
- Outcome: Accepted
- Follow-up: **the Flow lane widens as a side effect.** Because `extract` now
  yields action types, a script that is only an extract plus a checkpoint is no
  longer empty under `recordableActionTypes`, so `flowLaneExclusion` stops
  excluding it. Product-catalog W04 and admin-console's `extract-customer-list`
  therefore reach the Flow lane for the first time. D16 intends this, but it
  means the next A/B pair gains Flow-lane rows that did not exist before, and
  D7 counts those as new measurements rather than regressions — whoever reads
  that comparison must be told, or the corpus will look like it degraded

### 2026-09-15 — Finding: a count-only entry can score a false 1.0
- Agent: supervisor, from `x5f-refuse-unjudgeable-expectations`'s finding
- Why: `x5b` made a count-only entry report
  `matchedRecords = min(expected, observed)`, so pooled record accuracy scores
  it 1.0 with **zero values actually compared**. `large-table`'s 1,000 records
  would then swamp Week 1's roughly one-in-68 tolerance, so a real extraction
  regression could sit inside a green bench number. A counts-only
  `comparedRecords` discriminator would separate "counted right" from "compared
  right"
- Validation: reasoned from the contract, which is counts-only, and from
  `reports/ex-d-test-facility.md:223` wanting count-only and record entries in
  different rates; not yet measured against a real bench run
- Outcome: Open
- Follow-up: X5.5 owns it, and must not publish a pooled extraction accuracy
  number until it is settled

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
