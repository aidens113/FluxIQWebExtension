# First-Class Data Extraction Plan: archive

Superseded detail moved from [the plan](../../first-class-data-extraction-plan.md)
on 2026-09-15 to keep it under the 800-line compaction threshold: completed
worker briefs and earlier ledger entries. Their results are folded into that
document's Decisions, Design, and Execution partition.

## Planning-time findings

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

## Worker Briefs

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

### Brief: x0-domain
- Repository: this repository
- Task: the domain share of X0, combining workers W2-A and W3-A of
  `reports/x0-x1-execution.md` Part 4 so one worker owns the package: X0.2 (the
  wire guard in `webAutomationActionResultPayload`, the adapter's dispatch
  payload regardless of validation status, and the recording reducer), X0.3
  domain (`minItems` type, schema, and lift with whole refusals), and X0.5
  domain (`WEB_AUTOMATION_EXTRACT_MAX_ITEMS = 1_000`, schema maximum, lift
  clamp), with the tests and mutation targets those steps name, amended by D2,
  D4, and D14.
- Required reads: `AGENTS.md`; this document's D2, D4, and D14; the report's
  Part 2 X0.2, X0.3, X0.5, and Part 4 budget notes
- Owns (may edit): `domain/src/actions/{types,schemas}.ts`,
  `domain/src/actions/tests/schemas.test.ts`,
  `domain/src/client/{gateway-action-parameters,gateway-mapping}.ts`,
  `domain/src/client/tests/{gateway-command-parameters,gateway-mapping,gateway-mapping-redaction}.test.ts`,
  `domain/src/runtime/adapter.ts`, `domain/src/runtime/tests/adapter-redaction.test.ts`,
  `domain/src/recording/reducers.ts`, `domain/src/recording/tests/reducers.test.ts`
- Must not touch: the extension, test packages, every other file, tracked
  `domain/.test-build/` (always pass a build label)
- Validation, run alone and not in a loop:
  `pnpm --filter @fluxiq-web-extension/domain check`, then
  `DOMAIN_TEST_BUILD_LABEL=x0-domain pnpm --filter @fluxiq-web-extension/domain test`,
  then `node scripts/structure-audit.mjs`; apply each named mutation, observe
  its test fail, and revert. No extension build or content harness.
- Definition of done: check and tests pass; every mutation observed red and
  reverted; structure audit passes
- Report to: docs/working/first-class-data-extraction-plan/reports/x0-domain.md

### Brief: x1-test-contracts
- Repository: this repository
- Task: step X1.5's test-contracts changes in `reports/x0-x1-execution.md`
  Part 3: `ScenarioExtractPagination` as the `mode` union (D14),
  `ScenarioStep.minItems`, `ExpectedExtraction` `pages`, `optionalFields`,
  `truncated`, and nullable record values, the JSON Schema to match, and the
  validation rules including the D4 rule that a zero-record expectation needs
  `minItems: 0`. Add `minItems: 0` to product-catalog's
  `extract-search-results` step (`manifest.ts:84`) so the corpus stays valid.
  Hold `recordable-actions.ts`, `evaluation.ts`, and `bench-report.ts` (D14).
- Required reads: `AGENTS.md`; this document's D4 and D14; the report's X1.5
- Owns (may edit): `packages/test-contracts/src/{scenario,validation}.ts`,
  `packages/test-contracts/tests/scenario-validation.test.mjs`,
  `apps/scenario-lab/src/scenarios/product-catalog/manifest.ts`
- Must not touch: `packages/test-runner`, the domain, the extension, every
  other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/test-contracts test`,
  the scenario-lab package's unit test script, and
  `node scripts/structure-audit.mjs`; apply both named mutations, observe each
  test fail, and revert
- Definition of done: tests pass; mutations observed red and reverted;
  structure audit passes
- Report to: docs/working/first-class-data-extraction-plan/reports/x1-test-contracts.md

### Brief: x01-test-runner
- Repository: this repository
- Task: restore compilation broken by `x1-test-contracts`' nullable record
  values and pagination union, then X0.7. First the X1.5 follow-ups:
  `packages/test-runner/src/scenario-steps/extract-records.ts` reads pagination
  by `mode` (absent means `next`) and fails any other mode as `fixture.invalid`;
  `packages/test-runner/src/run-expectations/extraction.ts` widens record values
  to `string | null` (type errors at `extraction.ts:20` and
  `extract-records.ts:62,67`); a null guard at
  `apps/scenario-lab/src/scenarios/auth-gate/tests/scenario.test.ts:199`; and
  `apps/scenario-lab/e2e/product-catalog.spec.ts:155-156` type-checking against
  the union. Then X0.7 per `reports/x0-x1-execution.md` Part 2, with its tests
  and mutation target.
- Required reads: `AGENTS.md`; this document's D6 and D14; the report's X0.7
  and X1.5; `reports/x1-test-contracts.md`
- Owns (may edit): `packages/test-runner/src/scenario-steps/extract-records.ts`,
  `packages/test-runner/src/run-expectations/extraction.ts`, their tests,
  `packages/test-runner/src/flow-lane/{persisted-flow-run,expectations,run-flow-lane}.ts`,
  `packages/test-runner/src/flow-lane/tests/{persisted-flow-run,expectations,run-flow-lane,lane-observation}.test.ts`,
  `packages/test-runner/src/run-evaluation/tests/single-run-evaluation.test.ts`,
  `apps/scenario-lab/src/scenarios/auth-gate/tests/scenario.test.ts`,
  `apps/scenario-lab/e2e/product-catalog.spec.ts`
- Must not touch: test-contracts, the domain, the extension, every other file;
  no browser or Testing Lab run
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/test-runner build`
  and the report's X0.7 `node --test` command;
  `pnpm --filter @fluxiq-web-extension/scenario-lab test`;
  `node scripts/structure-audit.mjs`; the X0.7 mutation observed red and
  reverted
- Definition of done: test-runner builds; the named and scenario-lab tests
  pass; mutation observed; audit passes
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x01-test-runner.md`

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

### Brief: x0-10-accessible-name-sensitive
- Repository: this repository
- Task: close the leak `x0-9-snapshot-sensitive-text` found (D2): the
  snapshot's forms evidence names controls through `accessibleNameFor` without
  filtering (`apps/extension/src/content/evidence/forms.ts:83`), so an
  `aria-labelledby` or label reference to a sensitive `<textarea>` or `<select>`
  carries its contents. Filter inside
  `apps/extension/src/content/identity/accessible-name.ts`, so every caller is
  covered, using `x0-9`'s `content/sensitive-text.ts` helper, and make
  `content/action-runtime/extract.ts` reuse that helper instead of its own copy.
  Tests: unit cases for `aria-labelledby` to a sensitive textarea and select and
  for a label wrapping a sensitive control; a content-harness case scanning the
  whole reply and snapshot for the fixture's synthetic values; mutation
  targets. Update `docs/architecture/sensitive-values.md` where its
  accessible-name statement changes.
- Required reads: `AGENTS.md`; this document's D2;
  `reports/x0-9-snapshot-sensitive-text.md`; `docs/architecture/sensitive-values.md`
- Owns (may edit): `apps/extension/src/content/identity/accessible-name.ts` and
  its tests, `apps/extension/src/content/sensitive-text.ts` and its test,
  `apps/extension/src/content/action-runtime/extract.ts`,
  `apps/extension/src/content/evidence/forms.ts` only if the filter cannot live
  in the accessible-name module, `apps/extension/e2e/content/tests/evidence.spec.ts`
  (520 lines; stay under 800), and `docs/architecture/sensitive-values.md`
- Must not touch: the domain, test packages, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/extension check`;
  `EXTENSION_TEST_BUILD_LABEL=x0-10 node apps/extension/scripts/test-extension.mjs`;
  the content harness for `evidence`, `actions`, and `extract-list` with
  `--workers=1`; structure audit; mutations observed red and reverted (on a
  scratch copy if real source is refused)
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x0-10-accessible-name-sensitive.md`

### Brief: x1-page-b
- Repository: this repository
- Task: worker W1 part B of `reports/x0-x1-execution.md`, after
  `x1-domain-contracts` and `x0-9-snapshot-sensitive-text`: X1.2's page guard
  (a spec-form field or a non-`next` pagination mode fails with
  `web.action.not_implemented` naming the feature, until X3) and X1.3's page
  share (`ActionResultEvidence` and `buildResult` carry `extraction` and
  `dialog`; `extract-list.ts` passes the summary with excluded fields left out
  of `fieldNames`; `dialog.ts` moves its evidence from `extracted` to
  `dialog`), with the report's tests and mutation targets. This also restores
  the extension type check, which `x1-domain-contracts` left failing at
  `list-extraction.ts:117,119,147,155,167`. Determine whether `dialog.promptText`
  is the page's message or the value the automation answered with: if it is an
  answer value, withhold it the way typed values are (D2) and test that; if it
  is page text, say so in the report.
- Required reads: `AGENTS.md`; this document's D2, D12, D14, and D16; the
  report's X1.2, X1.3, and Part 4; `reports/x0-page.md`;
  `reports/x1-domain-contracts.md`
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

### Brief: x0-11-identity-sensitive-text
- Repository: this repository
- Task: close the remaining sensitive-text paths `x0-10-accessible-name-sensitive`
  found (D2): `apps/extension/src/content/identity/context.ts:129-131` puts a
  landmark reference's raw text into `context.landmarkName`;
  `identity/label.ts` handles marked non-controls without the sensitivity
  filter; `web.dom.extract` still reads a target inside a sensitive control in
  attribute and HTML modes (`content/action-runtime/extract.ts`). Apply
  `content/sensitive-text.ts` in each so no descriptor, identity context, or
  extract reply carries a sensitive control's contents, and refuse an extract
  target inside a sensitive control as one that is one. Remove
  `describe-element.ts`'s now-redundant name post-filter, and restore the
  whole-reply scans narrowed at `apps/extension/e2e/content/tests/actions.spec.ts:319-327`
  and in `evidence.spec.ts`. Unit and content-harness cases, mutation targets,
  and the statement in `docs/architecture/sensitive-values.md`.
- Required reads: `AGENTS.md`; this document's D2; the reports
  `x0-9-snapshot-sensitive-text` and `x0-10-accessible-name-sensitive`;
  `docs/architecture/sensitive-values.md`
- Owns (may edit): `apps/extension/src/content/identity/{context,label}.ts` and
  their tests, `content/action-runtime/extract.ts`, `content/describe-element.ts`
  and its test, `content/sensitive-text.ts` and its test,
  `apps/extension/e2e/content/tests/{actions,evidence}.spec.ts`, and
  `docs/architecture/sensitive-values.md`
- Must not touch: `content/action-runtime/list-extraction.ts`,
  `content/actions/**`, `extract-list.spec.ts`, `upload-dialog.spec.ts` (all
  `x1-page-b`'s), the domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/extension check`;
  `EXTENSION_TEST_BUILD_LABEL=x0-11 node apps/extension/scripts/test-extension.mjs`;
  the content harness for `actions`, `evidence`, and `identity-resolution`
  with `--workers=1`; structure audit; mutations observed red and reverted (on
  a scratch copy if real source is refused). A failure only in `x1-page-b`'s
  files is rerun once later and reported.
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x0-11-identity-sensitive-text.md`

### Brief: x3a-domain-inference
- Repository: this repository
- Task: X3.3's domain share per `reports/x3-x5-execution.md` Part 2 X3.3
  ("Domain files"), with D3 and D16: a new `domain/src/extraction/` holding
  `proposal.ts` (`WebAutomationExtractionProposal`: selectors, names, and
  counts only, never page values), `dataset-id.ts` (`webAutomationDatasetId`),
  `signature.ts` (`webAutomationItemSignature` and
  `webAutomationIdentifierShape`, the pure half of
  `apps/extension/src/content/evidence/repeating.ts:68-77`), and a barrel
  re-exported from `domain/src/client/index.ts` and `domain/src/index.ts`, with
  the report's tests and mutation targets. Keep one field-key function: reuse
  `x1-domain-contracts`' `domain/src/actions/extraction/field-key.ts`, or move
  it here with its importers, rather than writing a second one. Do not edit
  `repeating.ts`; X3-C imports the domain functions later.
- Required reads: `AGENTS.md`; this document's D3 and D16; the report's X3.3;
  `reports/x1-domain-contracts.md`
- Owns (may edit): `domain/src/extraction/**` (new) and its tests; one export
  line each in `domain/src/client/index.ts` and `domain/src/index.ts`;
  `domain/src/actions/extraction/field-key.ts`, its barrel line, and its
  importers only if the key function moves
- Must not touch: `domain/src/output-nodes/**`, the extension, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/domain check`;
  `DOMAIN_TEST_BUILD_LABEL=x3a pnpm --filter @fluxiq-web-extension/domain test`;
  structure audit; mutations observed red and reverted (on a scratch copy if
  real source is refused). A failure only in another worker's files is rerun
  once later and reported.
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x3a-domain-inference.md`

## Work Ledger

### 2026-09-15 — x1-output-nodes done and verified
- Agent: supervisor; worker `x1-output-nodes`
- Changed: `domain/src/output-nodes/definitions.ts` and its test, and
  `domain/src/io/manifest-definitions.ts` and its test (uncommitted); the report
- Why: the `extract_list` node declares `timeoutMs` (D14), and the output
  definition Core reads through `io.getOutput(...).definition.metadata` carries
  `metadata.recordsPath: "extracted"`, copied from the node (CD19). The first
  pass put the path only on the node, which Core does not read. One io test
  narrows from "no metadata" to "no elementTarget". The request schema lists no
  `timeoutMs`, as D14 intends
- Validation: `pnpm --filter @fluxiq-web-extension/domain check` → exit 0;
  `DOMAIN_TEST_BUILD_LABEL=supervisor-x1-nodes pnpm --filter @fluxiq-web-extension/domain test`
  → `# tests 440`, `# pass 437`, `# fail 3`; the three failures are
  `x3a-domain-inference`'s in-progress signature tests (`not ok 47-49`), none in
  output nodes or io. Mutation proofs not rerun by the supervisor.
- Outcome: Accepted
- Follow-up: rerun the domain tests once `x3a-domain-inference` lands; commit
  with the X0 and X1 group

### 2026-09-15 — x1-6 done and verified; X3-B and X5-A1 dispatched
- Agent: supervisor; worker `x1-6-e2e-typecheck`
- Changed: new `apps/scenario-lab/tsconfig.e2e.json`, the scenario-lab `check`
  script, and `apps/scenario-lab/e2e/member-directory.spec.ts` (uncommitted);
  the report
- Why: `pnpm check` now type-checks the Lab's e2e specs with DOM types, while
  `src` stays checked without them; the two literal-widening errors are fixed
  with `satisfies Partial<MemberDirectoryState>`.
  `docs/architecture/repository-layout.md` gains a line at commit time. The
  compaction of this document before the crash lost nothing: of 184 removed
  lines, the 3 not found in the plan or archive are lines the supervisor
  reworded
- Validation: `pnpm --filter @fluxiq-web-extension/scenario-lab check` →
  `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.e2e.json`, exit 0. The
  deliberate-error proof ran on a scratch spec and was not rerun by the
  supervisor.
- Outcome: Accepted
- Follow-up: commit with the X0 and X1 group

### 2026-09-15 — x1-page-b done; X3-B and X5-A1 briefed
- Agent: supervisor; worker `x1-page-b`
- Changed: `apps/extension/src/content/action-runtime/{list-extraction,results}.ts`,
  `action-runtime/tests/list-extraction.test.ts`,
  `content/actions/{extract-list,dialog}.ts`, new
  `actions/tests/{extract-list,dialog}.test.ts`, and
  `e2e/content/tests/{extract-list,upload-dialog}.spec.ts` (uncommitted); the
  report; this document (briefs `x3b-page-engine` and `x5a-evaluation-contracts`)
- Why: X1.2's page guard and X1.3's page summary, which restore the extension
  type check. `dialog.promptText` is the prompt's answer, so it now carries only
  "a withheld value of N characters" (D2). The sensitive-ancestor refusal walks
  every ancestor, so a `data-sensitive` wrapper refuses its contents; kept
- Validation: not yet verified by the supervisor. The worker's unit run failed
  only in `x0-11`'s in-progress files, so the combined extension check, unit
  tests, and full content harness run after `x0-11` lands
- Outcome: Partial
- Follow-up: dispatch X3-B and X5-A1; combined verification after `x0-11`

### 2026-09-15 — Crash recovery; concurrency cap lifted; next wave dispatched
- Agent: supervisor; workers `x1-page-b` and `x0-11-identity-sensitive-text`
  (resumed), `x1-output-nodes`, `x1-6-e2e-typecheck`; brief
  `x3a-domain-inference` recorded
- Changed: this document (brief `x3a-domain-inference`)
- Why: Claude Code crashed with four workers mid-task, and they resume from
  their transcripts. The user asked for as many parallel agents as possible,
  so the supervisor's four-worker cap is lifted and every file-disjoint step is
  dispatched. While the session was down, this document was compacted into
  `archive/2026-09-15-completed-briefs-and-ledger.md` by someone other than the
  supervisor, against the protocol; the move looks intact by diff stat, and the
  supervisor confirms it before the next commit
- Validation: not validated; dispatch only
- Outcome: Partial
- Follow-up: verify each worker; confirm the compaction lost nothing

### 2026-09-15 — x0-10 done; three more sensitive-text paths taken in as x0-11
- Agent: supervisor; worker `x0-10-accessible-name-sensitive`
- Changed: `apps/extension/src/content/identity/accessible-name.ts`, new
  `identity/tests/accessible-name.test.ts`, `content/action-runtime/extract.ts`,
  `content/sensitive-text.ts` (comment), `e2e/content/tests/evidence.spec.ts`,
  and `docs/architecture/sensitive-values.md` (uncommitted); the report; this
  document (D2, brief `x0-11-identity-sensitive-text`)
- Why: accessible names no longer carry a sensitive control's contents. The
  worker found three more paths: a landmark reference's raw text in
  `context.landmarkName`, `label.ts`'s marked non-controls, and an extract
  target inside a sensitive control in attribute and HTML modes. All three are
  taken in as `x0-11`, D2 now covers elements inside a sensitive control, and
  `x1-page-b` applies the same rule to list fields
- Validation: not yet verified by the supervisor; the extension check and the
  extract-list harness are blocked by `x1-page-b`'s in-progress
  `list-extraction.ts`, so the combined run follows its landing
- Outcome: Partial
- Follow-up: dispatch `x0-11`; one extension check and full content harness
  after `x1-page-b` and `x0-11`

### 2026-09-15 — x1-domain-contracts done and verified; x1-page-b dispatched
- Agent: supervisor; worker `x1-domain-contracts`
- Changed: `domain/src/actions/{types,schemas}.ts`, new
  `domain/src/actions/extraction/{request,summary,schema,field-key,index}.ts`,
  `domain/src/actions/tests/schemas.test.ts`,
  `domain/src/client/{gateway-action-parameters,gateway-mapping}.ts`, and their
  tests (uncommitted); the report; this document (`x1-page-b` brief amended)
- Why: X1.1-X1.4's domain share. The lift also checks D16's key pattern,
  refuses `attribute` or `header` on the wrong kind and other modes' pagination
  keys, and describes the field spec under `fields.metadata.fieldSpec`; all
  kept. The extension type check fails until `x1-page-b` lands, and
  `dialog.promptText` goes to `x1-page-b` to decide whether it is withheld
- Validation: supervisor runs, alone:
  `pnpm --filter @fluxiq-web-extension/domain check` → exit 0;
  `DOMAIN_TEST_BUILD_LABEL=supervisor-x1-domain pnpm --filter @fluxiq-web-extension/domain test`
  → `# tests 413`, `# pass 413`, `# fail 0`. Mutation proofs not rerun by the
  supervisor.
- Outcome: Accepted
- Follow-up: commit with `x1-page-b` once the extension type-checks; then
  `x1-output-nodes`

### 2026-09-15 — x0-9 done; accessible-name leak taken in as x0-10
- Agent: supervisor; worker `x0-9-snapshot-sensitive-text`
- Changed: `apps/extension/src/content/describe-element.ts`, new
  `content/sensitive-text.ts`, `content/tests/{describe-element,sensitive-text}.test.ts`,
  new `content/tests/stub-page.ts`, `e2e/content/tests/{actions,extract-list}.spec.ts`,
  and `docs/architecture/sensitive-values.md` (uncommitted); the report; this
  document (brief `x0-10-accessible-name-sensitive`)
- Why: page snapshots leaked sensitive `<textarea>` and `<select>` contents; a
  sensitive control known only by its contents is no longer listed in the
  snapshot. The worker found forms evidence naming controls through an
  unfiltered accessible name, taken in as `x0-10`
- Validation: not yet verified by the supervisor; the full content harness runs
  once after `x0-10` and `x1-domain-contracts` land, because every page's
  snapshot text changed
- Outcome: Partial
- Follow-up: dispatch `x0-10`; verify both with the full content harness

### 2026-09-15 — X3-X5 made executable; D16 decided
- Agent: supervisor; worker `x3-x5-execution`
- Changed: this document (Current State, D16, C3, C5, the Lab reader, the X5
  row, the execution partition); the paired document's CD19 and K7; the report
- Why: the report found that the Lab's Flow-run reader reads a place Core never
  fills, that D14's scaled timeout could not reach a recorded node, and Core
  contract constraints on keys, ids, and nulls; its recommendations became
  decisions, and the virtualised-list recycling risk was taken into `scroll`'s
  de-duplication rather than left open
- Validation: not validated; planning documents only
- Outcome: Accepted
- Follow-up: brief X3-A and X3-B once X1 lands

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

### 2026-09-15 — Execution started: x0-domain and x1-test-contracts dispatched
- Agent: supervisor; workers `x0-domain`, `x1-test-contracts`, with Core's
  `k0-1-password-kdf` and `k0-4-database-manager-recheck`
- Changed: this document (Worker Briefs)
- Why: X0 and X1 are executable and independent of Core's pending dataset
  detail; W2-A and W3-A are combined so one worker owns the domain package, and
  at most four code workers run at once on this machine
- Validation: not validated; dispatch only, no code changed yet
- Outcome: Partial
- Follow-up: verify both reports; then W1-A (after x0-domain) and W4 (after
  x1-test-contracts)

### 2026-09-15 — X0 and X1 made executable; Core K0 and K11 designs merged
- Agent: supervisor; workers `x0-x1-execution` here, `k0-secret-keys-kdf` and
  `k11-encrypted-fields` in the paired document
- Changed: this document (Status detail, Current State, defect 1, D2, D4, D5,
  D13, D14, C1, X1 row, execution partition, open questions)
- Why: the reports corrected the leak's width, settled contract details, and
  gave file-level steps; their recommendations became decisions under the
  user's standing instruction, and the container-text gap was taken into D2
  rather than parked
- Validation: not validated; planning documents only, no code changed
- Outcome: Accepted
- Follow-up: merge Core's `k-datasets-execution`; start X0, X1, K0, and K1

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

## 2026-09-15 compaction: completed X-phase briefs and settled ledger entries

### Brief: x3b-page-engine
- Repository: this repository
- Task: X3.1 then X3.2 per `reports/x3-x5-execution.md` Part 2, with D2, D5,
  D12, D14, and D16: a new `apps/extension/src/content/extraction/`
  (`field-spec.ts`, `field-reader.ts`, `pagination.ts`, `list-reader.ts`, and a
  barrel) replacing `content/action-runtime/list-extraction.ts` and its test,
  which are deleted with their importers updated; the field kinds text,
  attribute, link, value, and column, with `null` for an optional miss; the
  domain bounds imported instead of mirrored; X1.2's page guard removed; and the
  `loadMore`, `scroll`, and `numbered` modes, with `scroll` de-duplicating by
  element and content together (D16). Keep `x1-page-b`'s sensitive-ancestor
  refusal, and use `isWithinSensitiveControl` from `content/sensitive-text.ts`
  once `x0-11` exports it (rerun if it has not yet). Tests and mutation targets
  from the report, including the Firefox content config run for the modes.
- Required reads: `AGENTS.md`; this document's D2, D5, D12, D14, and D16; the
  report's Part 2 (X3.1, X3.2) and Part 5; `reports/x1-page-b.md`
- Owns (may edit): `apps/extension/src/content/extraction/{field-spec,field-reader,pagination,list-reader,index}.ts`
  and `content/extraction/tests/**` (all new); deleting
  `content/action-runtime/list-extraction.ts` and
  `content/action-runtime/tests/list-extraction.test.ts`;
  `content/action-runtime/{index,execute-action}.ts`;
  `content/actions/{types,extract-list}.ts` and `actions/tests/extract-list.test.ts`;
  `apps/extension/e2e/content/tests/extract-list.spec.ts`
- Must not touch: `content/sensitive-text.ts`, `content/action-runtime/extract.ts`,
  `content/identity/**`, `content/describe-element.ts`, `actions.spec.ts`, and
  `evidence.spec.ts` (all `x0-11`'s), the domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/extension check`;
  `EXTENSION_TEST_BUILD_LABEL=x3b node apps/extension/scripts/test-extension.mjs`;
  the content harness for `extract-list` with `--workers=1` under Chromium and
  under `apps/extension/e2e/playwright.content.firefox.config.ts`; structure
  audit; mutations observed red and reverted (on a scratch copy if real source
  is refused). A failure only in another worker's files is rerun once later and
  reported.
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x3b-page-engine.md`

### Brief: x5a-evaluation-contracts
- Repository: this repository
- Task: X5.1's evaluation and bench-report contracts per
  `reports/x3-x5-execution.md` Part 4 X5.1, with D6 and D7, but not
  `recordable-actions.ts` or `flow-lane-exclusion.ts`, which change with X5.3
  (D14): `evaluation.ts` at version 0.3 with
  `RunEvaluation.extraction: RunExtractionMeasurement[] | null` (numbers and
  booleans only); `evaluation-validation.ts` accepting 0.3, reading 0.1 and 0.2
  as 0.3 with `extraction: null`, refusing any string member, and enforcing the
  count bounds; `bench-report.ts`'s optional `extractionByLane` with the listed
  rates, distributions, comparison ids, and tolerances; and
  `bench-report-validation.ts`. Tests and mutation targets from the report,
  except its `recordable-actions` rows. If the test-runner build then fails
  because a producer does not set `extraction`, set `extraction: null` in those
  producers and name each line in the report.
- Required reads: `AGENTS.md`; this document's D6, D7, and D14; the report's
  X5.1
- Owns (may edit): `packages/test-contracts/src/{evaluation,evaluation-validation,bench-report,bench-report-validation}.ts`,
  `packages/test-contracts/tests/{evaluation-contracts,bench-report-contracts}.test.mjs`,
  and only the `extraction: null` lines in test-runner producers if needed
- Must not touch: `recordable-actions.ts`, `flow-lane-exclusion.ts`, every
  other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/test-contracts test`;
  `pnpm --filter @fluxiq-web-extension/test-runner build`; structure audit;
  mutations observed red and reverted
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5a-evaluation-contracts.md`

### Brief: x0-12-descriptor-marked-state
- Repository: this repository
- Task: `x0-11-identity-sensitive-text` applied its inside-a-marked-element rule
  to descriptor checked state and select options without tests
  (`apps/extension/src/content/describe-element.ts`). Add unit tests and a
  content-harness case showing that a checkbox inside a `data-sensitive`
  element and a select inside one carry no checked state, option labels, or
  selected value in the descriptor or the snapshot, while the same controls
  outside a marked element still do. Also test whether the recorder's input and
  change events on a control inside a marked element carry its value, and fix
  that within the owned files if they do (D2). Mutation targets for each rule.
- Required reads: `AGENTS.md`; this document's D2;
  `reports/x0-11-identity-sensitive-text.md`; `docs/architecture/sensitive-values.md`
- Owns (may edit): `apps/extension/src/content/describe-element.ts` and
  `content/tests/describe-element.test.ts`,
  `apps/extension/e2e/content/tests/evidence.spec.ts`, and, only if a recorder
  leak appears, `apps/extension/src/content/{recorder,dom-events}.ts` and their
  tests
- Must not touch: `content/extraction/**`, `content/action-runtime/**`,
  `content/actions/**`, `extract-list.spec.ts` (all `x3b-page-engine`'s), the
  domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/extension check`;
  `EXTENSION_TEST_BUILD_LABEL=x0-12 node apps/extension/scripts/test-extension.mjs`;
  the content harness for `evidence` (and the recorder spec if touched) with
  `--workers=1`; structure audit; mutations observed red and reverted (on a
  scratch copy if real source is refused). A failure only in another worker's
  files is rerun once later and reported.
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x0-12-descriptor-marked-state.md`

### Brief: x5b-measure-extraction
- Repository: this repository
- Task: X5.2 per `reports/x3-x5-execution.md` Part 4 X5.2, with D6 and D14. Add
  `measureExtraction(entry, records, observed)` to
  `run-expectations/extraction.ts`, matching positionally as the existing
  `:31-34` does, leaving optional fields out of `expectedFields`, and rebuild
  `assertExtraction` (`:14-29`) on it so it also asserts `pages` against
  `pagesRead`, asserts `truncated`, and fails when a field outside
  `optionalFields` is absent. A `null` expectation matches only `null` (D16).
  The measurement is counts and booleans only — never a record value — because
  `RunExtractionMeasurement` is already constrained that way in
  `packages/test-contracts/src/evaluation.ts` at version 0.3.
- Required reads: `AGENTS.md`; this document's D6, D14, and D16; the report's
  Part 4 X5.2; `packages/test-contracts/src/evaluation.ts`
- Owns (may edit): `packages/test-runner/src/run-expectations/extraction.ts`
  and `run-expectations/tests/extraction.test.ts`
- Must not touch: `scenario-steps/**`, `flow-lane/**`, `bench/**`,
  `run-evaluation/**`, `run-scenario.ts`, `apps/scenario-lab/**`, the
  extension, the domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/test-runner build`,
  then `node --test packages/test-runner/dist/run-expectations/tests/extraction.test.js`,
  then `pnpm --filter @fluxiq-web-extension/test-runner test`; structure audit;
  the report's two mutations observed red and reverted (compare as a set, and
  dropping the key-length check at `:33`)
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5b-measure-extraction.md`

### Brief: x5d-fixtures-catalog
- Repository: this repository
- Task: the **product-catalog** and **admin-console** halves of X5.4 per
  `reports/x3-x5-execution.md` Part 4 X5.4, with D6, D7, and D16. Source and
  unit tests only: do **not** run or add Playwright e2e specs, and do not add
  content-harness rows — the supervisor runs those once X3-B's page engine
  lands. For product-catalog: `pages: 3` on W05 and W07 (`:63,119`);
  `web.dom.extract_list` added to `expected.actions` on W04, W05, and W07; the
  variants `with-images`, `sparse-cards`, `absolute-links`, and
  `link-pagination`; and the workflow `numbered-pages` (count 23, `pages: 3`).
  Resolve the report's open question about `testid:` prefix targets by using a
  plain CSS target for the numbered pagination rather than inventing a prefix
  grammar, and say so in the report. `extract-specs` stays deferred. For
  admin-console, delete the stale comment at `manifest.ts:143`.
- Required reads: `AGENTS.md`; this document's D6, D7, and D16; the report's
  Part 4 X5.4; `packages/test-contracts/src/scenario.ts`
- Owns (may edit): `apps/scenario-lab/src/scenarios/product-catalog/**` and
  `apps/scenario-lab/src/scenarios/admin-console/**`
- Must not touch: every other scenario directory, `apps/scenario-lab/e2e/**`,
  `packages/test-runner/**`, `packages/test-contracts/**`, the extension, the
  domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/scenario-lab check`
  and `pnpm --filter @fluxiq-web-extension/scenario-lab test`; structure audit;
  per-fixture mutation (arm a variant with its distinguishing change removed and
  observe that fixture's unit row fail), then reverted
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5d-fixtures-catalog.md`

### Brief: x5e-fixtures-tables-feed
- Repository: this repository
- Task: the **data-table**, **infinite-feed**, **iframe-checkout**, and
  **sensitive-input** halves of X5.4 per `reports/x3-x5-execution.md` Part 4
  X5.4, with D2, D6, D12, and D16. Source and unit tests only: do **not** run or
  add Playwright e2e specs, and do not add content-harness rows. data-table
  gains `empty-table` (`minItems: 0`, count 0) and `large-table` (2,000 rows,
  expected count 1,000, `truncated: true`). infinite-feed gains records for W11,
  the workflow `extract-until-end` (`{ mode: "scroll", maxScrolls: 20 }`), the
  `load-more-button` variant (`{ mode: "loadMore", control: "testid:load-more", maxPages: 10 }`),
  and the comment at `:50` deleted. iframe-checkout gains the workflow
  `extract-order-lines` reading the same-origin frame. sensitive-input gains a
  workflow (not a new registry entry) whose items hold visible card text and a
  password input: a `value` field on the password control expects failure
  `blocked_by_capability_or_policy`, and an excluded-column variant succeeds
  with no planted string anywhere in the bundle.
- Required reads: `AGENTS.md`; this document's D2, D6, D12, and D16; the
  report's Part 4 X5.4; `docs/architecture/sensitive-values.md`
- Owns (may edit): `apps/scenario-lab/src/scenarios/{data-table,infinite-feed,iframe-checkout,sensitive-input}/**`
- Must not touch: `product-catalog/**` and `admin-console/**` (both
  `x5d-fixtures-catalog`'s), `apps/scenario-lab/e2e/**`,
  `packages/test-runner/**`, `packages/test-contracts/**`, the extension, the
  domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/scenario-lab check`
  and `pnpm --filter @fluxiq-web-extension/scenario-lab test`; structure audit;
  per-fixture mutation (arm a variant with its distinguishing change removed and
  observe that fixture's unit row fail), then reverted
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5e-fixtures-tables-feed.md`

### Brief: x3c-page-inference
- Repository: this repository
- Task: X3.3's extension share and X3.4 per `reports/x3-x5-execution.md` Part 2,
  with D2, D3, D12, and D16. `x3a-domain-inference` already landed the domain
  half, so **import it, never re-derive it** — and note that its key file is
  `label-key.ts`, not the report's `field-key.ts`. Add to
  `content/extraction/`: `infer-list.ts` (walk ancestors, group siblings by the
  domain signature, take the nearest run of at least 3), `item-selector.ts`
  (exact shared test id, then a test-id shape, then `<container> > tag.class`,
  then role — accepting a candidate **only** when `document.querySelectorAll`
  returns exactly the run), `infer-fields.ts` (test ids, `a[href]` as `link`,
  `img` as `attribute` `src`/`alt`, header-backed table cells as `column`,
  remaining text leaves as `text`, with coverage per field), and
  `detect-pagination.ts` (`next`, `loadMore`, `numbered`, else nothing; scroll
  is only ever user-chosen). A field whose element is a sensitive control by
  `isSensitiveFormControl` is pre-selected `handling: "exclude"` — that is D12's
  pre-selection and it must not be reachable to turn off by inference. Import
  the two domain functions into `content/evidence/repeating.ts:68-77` and delete
  the local copies. Handle a new `extraction.propose { selector }` content
  message in `content/message-handler.ts:48-76`, with its types in a new
  `shared/extraction-messages.ts` (`shared/protocol.ts` is already 449 lines).
  Then X3.4: update `docs/architecture/web-capabilities.md:114-118` and
  `docs/architecture/sensitive-values.md:230-239`.
- Write `e2e/content/tests/extraction-inference.spec.ts` with the report's three
  cases, but **do not run the content harness**: fixture workers are editing
  `apps/scenario-lab/src/scenarios/` concurrently and the harness loads those
  sources at start-up, so the supervisor runs it. Say in your report that it is
  unrun.
- Required reads: `AGENTS.md`; this document's D2, D3, D12, and D16; the
  report's Part 2 X3.3 and X3.4; `reports/x3a-domain-inference.md`;
  `reports/x3b-page-engine.md`
- Owns (may edit): `apps/extension/src/content/extraction/{infer-list,item-selector,infer-fields,detect-pagination}.ts`
  and their tests, `content/evidence/repeating.ts`,
  `content/message-handler.ts`, new `apps/extension/src/shared/extraction-messages.ts`,
  new `e2e/content/tests/extraction-inference.spec.ts`, and the two docs files
- Must not touch: `content/extraction/{field-spec,field-reader,pagination,list-reader,index}.ts`
  beyond adding barrel exports, `content/action-runtime/**`,
  `content/describe-element.ts` and `content/identity/**`, `shared/protocol.ts`,
  the whole `domain/` package, `apps/scenario-lab/**`, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/extension check`;
  `EXTENSION_TEST_BUILD_LABEL=x3c node apps/extension/scripts/test-extension.mjs`;
  structure audit; the report's three mutations observed red and reverted (on a
  scratch copy if real source is refused)
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x3c-page-inference.md`

### Brief: x4a-domain-recorded-extraction
- Repository: this repository
- Task: X4.1 per `reports/x3-x5-execution.md` Part 3, with D3, D12, D14, and
  D16. Core's K7 has landed with both `recordOutput` and `timeoutMs` on the
  candidate types, and `fluxiq` has been rebuilt, so the domain now compiles
  against them. Add `dataExtractionDefined` to `domain/src/constants.ts:4-21`;
  the recorded event and its `extraction` payload field in
  `domain/src/recording/events.ts`; new
  `domain/src/actions/extraction/recorded-definition.ts` whose reader builds its
  copy **field by field, so no sample value and no unknown key survives** (D3),
  checking every field key against the domain key pattern and the dataset id
  against Core's; new `domain/src/actions/extraction/read-request.ts` holding
  the three readers moved out of `client/gateway-action-parameters.ts:184-221`
  (moved because `io/input-model.ts` needs them and importing `client` from
  `io` would make a cycle); `WEB_AUTOMATION_EXTRACT_PAGE_TIMEOUT_MS = 10_000`
  and `webAutomationExtractListTimeoutMs` in `actions/extraction/request.ts`;
  the `io/input-model.ts` changes including `isExecutableRequiredParameter`
  treating `extractList` as executable exactly when the reader reads it;
  `output-nodes/payloads.ts` and the `timeoutMs` parameter on `extract_list` in
  `output-nodes/definitions.ts:141`; the structured `extract` read on
  `web.dom.extract` across `actions/{schemas,types}.ts`,
  `client/gateway-action-parameters.ts:49`, and `output-nodes/definitions.ts:146`;
  new `domain/src/recording/proposals/record-output.ts`, whose schema covers
  **every** request field including excluded ones, because an exclusion must
  persist so inference does not propose the field again (D12) and Core is what
  drops them from storage; and `web-panel-host.ts`'s `extractionCandidate`,
  which carries action-role `sourceInputIds`, **no** `expectedConfirmation`,
  `recordOutput` for the list form only, and `timeoutMs`.
- Required reads: `AGENTS.md`; this document's D3, D12, D14, and D16; the
  report's Part 3 X4.1 and its corrections 2, 3, and 7;
  `reports/x1-domain-contracts.md`; `reports/x3a-domain-inference.md`
- Owns (may edit): `domain/src/constants.ts`, `domain/src/recording/**`,
  `domain/src/actions/extraction/**`, `domain/src/actions/{schemas,types}.ts`,
  `domain/src/io/input-model.ts`, `domain/src/output-nodes/{payloads,definitions}.ts`,
  `domain/src/client/{gateway-action-parameters,gateway-mapping}.ts`,
  `domain/src/web-panel-host.ts`, the barrels, and all of their tests
- Must not touch: `apps/extension/**` (X3-C's and X4.2's),
  `apps/scenario-lab/**`, `packages/**`, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/domain check`;
  `DOMAIN_TEST_BUILD_LABEL=x4a pnpm --filter @fluxiq-web-extension/domain test`;
  structure audit; the report's mutations observed red and reverted. If a Core
  type looks wrong, report it — `k7b-recorded-node-ports` is editing Core's
  candidate types concurrently; do not edit Core yourself
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x4a-domain-recorded-extraction.md`

### Brief: x5f-refuse-unjudgeable-expectations
- Repository: this repository
- Task: close the defect `x5b-measure-extraction` surfaced. `measureExtraction`
  takes `observed` as an optional fourth parameter, because
  `run-scenario.ts:310` and `flow-lane/expectations.ts:104` are pinned and
  `runner-wiring.test.ts:228` asserts the exact three-argument call text. The
  consequence is that a fixture declaring `pages` or `truncated` is **silently
  not judged** until X5.3 passes `observed` — the expectation reads as passing
  while nothing checks it, which is worse than having no expectation at all.
  Make `assertExtraction` **refuse** an expectation it cannot judge: when an
  entry declares `pages` or `truncated` and no `observed` was supplied, throw an
  error naming the entry and the unjudgeable field, rather than returning a
  pass. Add a test for the refusal, and a second test proving that the same
  entry passes once `observed` is supplied. Do **not** relax any pinned call
  site to route around this.
- Then report, without changing them, exactly which fixture entries in
  `apps/scenario-lab/src/scenarios/` now fail because of the refusal, and which
  lane each runs on. The supervisor decides whether those fixtures hold their
  `pages` expectations until X5.3 or drop them; do not edit any fixture.
- Also answer, in the report only: `x5b` made a count-only entry report
  `matchedRecords = min(expected, observed)`, so it pools to 1.0 when the count
  is right rather than a false 0. Say whether that can mask a real failure in
  the bench's pooled rate, given `RunExtractionMeasurement` is counts-only and
  `reports/ex-d-test-facility.md:223` wants count-only and record entries in
  different rates. Recommend, do not implement — X5.5 owns that.
- Required reads: `AGENTS.md`; this document's D6, D7, and D16;
  `reports/x5b-measure-extraction.md`; `reports/x3-x5-execution.md` Part 4 X5.2
  and X5.5; `reports/ex-d-test-facility.md:210-240`
- Owns (may edit): `packages/test-runner/src/run-expectations/extraction.ts`
  and `run-expectations/tests/extraction.test.ts`
- Must not touch: `run-scenario.ts`, `flow-lane/**`, `bench/**`,
  `run-evaluation/**`, `scenario-steps/**`, `apps/scenario-lab/**`,
  `packages/test-contracts/**`, the extension, the domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/test-runner build`,
  then `node --test packages/test-runner/dist/run-expectations/tests/extraction.test.js`,
  then `pnpm --filter @fluxiq-web-extension/test-runner test` (it was 857 passed
  before your change; report the new number and name every newly failing test)
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5f-refuse-unjudgeable-expectations.md`

### Brief: x5g-recordable-actions-contract
- Repository: this repository
- Task: X5.1's remaining contract half, per `reports/x3-x5-execution.md` Part 4
  X5.1 at `:770-773` — the part deliberately excluded from
  `x5a-evaluation-contracts` on the grounds that it changed with X5.3. That was
  wrong: it blocks X5.4 now. Set
  `packages/test-contracts/src/recordable-actions.ts:55` to
  `extract: ["web.dom.extract_list", "web.dom.extract"]`, delete the
  paginated-click branch at `:67-68` and its comment at `:22-26`, and update the
  comment at `flow-lane-exclusion.ts:12-15`. Until this lands, any fixture naming
  `web.dom.extract_list` in `expected.actions` throws `ContractValidationError`
  at module load and takes the whole fixture out of the corpus, which is what
  `x5d-fixtures-catalog` hit and proved.
- Tests per the report: in `tests/flow-lane-exclusion.test.mjs:9-15,19-24`, W04's
  and W08's shapes keep a Flow lane, and a paginated extract now yields
  `web.dom.extract_list` rather than a click.
- Required reads: `AGENTS.md`; this document's D6, D7, and D14; the report's
  Part 4 X5.1; `reports/x5a-evaluation-contracts.md`;
  `reports/x5d-fixtures-catalog.md` (for the blocked case it proved)
- Owns (may edit): `packages/test-contracts/src/{recordable-actions,flow-lane-exclusion}.ts`
  and `packages/test-contracts/tests/flow-lane-exclusion.test.mjs`
- Must not touch: `evaluation*.ts` and `bench-report*.ts` (already landed),
  `scenario.ts`, `validation.ts`, `packages/test-runner/**` (`x5f`'s),
  `apps/scenario-lab/**` (the fixture workers'), the extension, the domain,
  every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/test-contracts test`
  (it was 89 passed before your change; report the new number);
  `pnpm --filter @fluxiq-web-extension/test-runner build`; structure audit; the
  report's mutation — revert `extract` to `[]` and observe the W04 row fail —
  then reverted
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5g-recordable-actions-contract.md`

### 2026-09-15 — X5.4's catalog fixtures partial; blocked by a brief omission
- Agent: supervisor; worker `x5d-fixtures-catalog`
- Changed: `apps/scenario-lab/src/scenarios/product-catalog/{manifest,markup,format,types,route,client-script}.ts`
  and its `tests/scenario.test.ts`; the stale comment at
  `admin-console/manifest.ts:143` deleted (all uncommitted)
- Why (blocked item): the three `web.dom.extract_list` entries in `expected.actions`
  on W04, W05, and W07 cannot be added yet. Adding one throws
  `ContractValidationError` at module load, taking the whole fixture out, because
  `packages/test-contracts/src/recordable-actions.ts:55` still reads
  `extract: []`. That file was excluded from `x5a-evaluation-contracts`' brief on
  the grounds that it changes with X5.3 — **that was the supervisor's error**, not
  the worker's: the fixtures need it now. It is taken in as
  `x5g-recordable-actions-contract`, after which the three `actions:` lines are
  one edit each
- Why (accepted deviation): `with-images` **cannot** be a variant, because
  `ScenarioVariant` carries no `recordingScript` and `resolveScenarioWorkflow`
  merges only `expected`, so a variant cannot change a step's `fields`. The
  worker kept the substance (`image@src`, `image@alt`, lazy `data-src`) and built
  it as a workflow with a `lazy-images` variant; the other three are genuine
  variants. Numbered pagination uses a plain CSS target,
  `[data-testid^="pagination-page-"]`, with no new prefix grammar
- Validation: the worker observed
  `pnpm --filter @fluxiq-web-extension/scenario-lab check` → exit 0, its two
  fixtures in isolation at 27 passed, and four mutations each caught and
  restored by content rather than line count. The package-wide run showed one
  unrelated failure, `load-more mode replaces the sentinel`, in
  `infinite-feed/tests` — `x5e-fixtures-tables-feed`'s directory, which was
  mid-edit. The supervisor's own run waits for `x5e`
- Outcome: Partial
- Follow-up: `x5g`, then resume `x5d` for the three `actions:` lines

### 2026-09-15 — Finding: a fixture e2e spec has a hidden broken assertion
- Agent: supervisor, from `x5d-fixtures-catalog`'s finding
- Why: `apps/scenario-lab/e2e/product-catalog.spec.ts:50` asserts a hand-written
  runs table equals the manifest enumeration, and the manifest went from 7 runs
  to 13. The spec still **type-checks**, so `pnpm check` stays green and the
  breakage is invisible until somebody runs Playwright. The worker's brief
  forbade that file while the execution report's own partition at `:1060`
  assigns it to this worker — a contradiction the supervisor introduced. It also
  needs `numbered` support in its local extract helper
- Validation: not yet reproduced; no Playwright run has happened, which is
  precisely why it is invisible
- Outcome: Open
- Follow-up: give the file an owner in the same pass that adds the fixture e2e
  specs, before any Lab run is treated as evidence

### 2026-09-15 — X5.2 landed; a silently-unjudged expectation is being closed
- Agent: supervisor; worker `x5b-measure-extraction`
- Changed: `packages/test-runner/src/run-expectations/extraction.ts` and
  `run-expectations/tests/extraction.test.ts` (both uncommitted)
- Why: `measureExtraction` with positional matching, optional fields left out of
  `expectedFields`, `null` matching only `null` (D16), and `assertExtraction`
  rebuilt on it sharing one `matchesRecord` helper so the two can never
  disagree. Field counts follow `ex-d-test-facility.md:224` exactly
- Why (the defect): `observed` had to be optional, because `run-scenario.ts:310`
  and `flow-lane/expectations.ts:104` are pinned and `runner-wiring.test.ts:228`
  asserts the exact three-argument call text. So `pages` and `truncated` are
  judged **only when reported**, and `x5d-fixtures-catalog`'s `pages: 3` on W05
  and W07 would sit unasserted until X5.3 — passing while nothing checks it.
  That is taken in as `x5f-refuse-unjudgeable-expectations`, which makes such an
  entry throw rather than pass, per the standing rule that a standard is
  enforced by a check that fails rather than by a note
- Validation: in `F:\!FluxIQWebExtension`,
  `pnpm --filter @fluxiq-web-extension/test-runner build` → exit 0, then
  `pnpm --filter @fluxiq-web-extension/test-runner test` → `# tests 857`,
  `# pass 857`, `# fail 0`, exit 0 (849 before X5.2). The worker's two mutations
  were observed red (the order row, and the two extra-field rows) and restored
  with an identical source hash. Its own first suite attempt failed with about
  40 `Cannot find module 'fluxiq'` errors from the Core sibling-checkout rebuild
  race documented at `failure.ts:44-50`, not from its change; the supervisor's
  rerun above was clean with Core's `dist` present
- Outcome: Accepted, with the defect taken in
- Follow-up: X5.5 must confirm or replace `x5b`'s choice to report
  `matchedRecords = min(expected, observed)` for a count-only entry, which pools
  to 1.0 when the count is right; `x5f` reports on whether that can mask a
  failure

### 2026-09-15 — X0.12 done, and a fifth sensitive-text leak found and closed
- Agent: supervisor; worker `x0-12-descriptor-marked-state`
- Changed: `apps/extension/src/content/{describe-element,dom-events}.ts`,
  `content/tests/describe-element.test.ts`, and
  `e2e/content/tests/evidence.spec.ts` (all uncommitted)
- Why: `x0-11` had applied its inside-a-marked-element rule to descriptor
  checked state and select options without tests; those now exist as two unit
  tests and two harness rows, with `checkedState` and `selectState` extracted so
  each rule is testable on its own. The brief's recorder question is answered
  **no** for input and change events, which `x0-11`'s value reader already
  covered — but a third route did leak and is now closed: a printable key
  pressed in an **ordinary** field inside a `data-sensitive` group was recorded
  one character per `dom.keydown`, in order, reconstructing the typed text.
  `recordableKey` asked only whether the control itself was marked, and now asks
  `isWithinSensitiveControl`. That makes five sensitive-text leak paths found
  and closed in this effort, three of them beyond the original plan
- Validation: in `F:\!FluxIQWebExtension`,
  `pnpm --filter @fluxiq-web-extension/extension check` → exit 0, then
  `EXTENSION_TEST_BUILD_LABEL=supervisor-x0-12 node apps/extension/scripts/test-extension.mjs`
  → `# fail 0`, exit 0, this run covering `x3b-page-engine` and
  `x0-12-descriptor-marked-state` together. The worker observed the keydown leak
  red in a new harness row **before** the fix rather than inferring it, and its
  two mutations red on both the unit and harness rows, restored byte-identical
- Outcome: Accepted
- Follow-up: `evidence.spec.ts` is 776 lines against the 800-line hard limit and
  wants splitting alongside `extract-list.spec.ts` in X5-H;
  `describe-element.ts` now warns at 10 exported values (advisory, fails at 15).
  `docs/architecture/sensitive-values.md` needs one sentence for the new keydown
  rule, which `x3c-page-inference` now owns as part of X3.4

### 2026-09-15 — Coordination defect: the content harness is not fixture-disjoint
- Agent: supervisor
- Why: the supervisor ran the full content harness while `x5d-fixtures-catalog`
  was mid-edit in `apps/scenario-lab/src/scenarios/product-catalog/manifest.ts`.
  The run died evaluating that manifest at `:161` inside `cardRecords`, then
  reported "No tests found". The harness loads the scenario-lab fixture sources
  at start-up, so it is **not** file-disjoint from the fixture workers even
  though the extension and scenario-lab packages are separate. The execution
  partition above treats them as independent, which is what allowed this
  - Rule going forward: the content harness, `lab run`, and the bench may only
    run when no worker owns a file under `apps/scenario-lab/src/scenarios/`
- Validation: `pnpm --filter @fluxiq-web-extension/extension test:content -- --workers=1`
  → exit 1, the failure inside `product-catalog/manifest.ts:161`, with no
  extension test executed. This is not evidence about X3-B, whose own
  `extract-list` harness runs were green before the fixture workers started
- Outcome: Accepted as a scheduling error, not a code defect
- Follow-up: rerun the full harness once `x5d-fixtures-catalog` and
  `x5e-fixtures-tables-feed` report, and only then judge the fixtures; if the
  same failure survives with no worker editing, it is a real fixture defect

### 2026-09-15 — X3-B landed: the page extraction engine, with two latent fixes
- Agent: supervisor; worker `x3b-page-engine`
- Changed: new `apps/extension/src/content/extraction/{field-spec,field-reader,pagination,list-reader,index}.ts`
  with three test files; deleted `content/action-runtime/list-extraction.ts`
  and its test; edited `action-runtime/{index,execute-action}.ts`,
  `actions/{types,extract-list}.ts` and its test, and
  `e2e/content/tests/extract-list.spec.ts` (all uncommitted)
- Why: X3.1 and X3.2 — the field kinds, `null` for an optional miss, and the
  `loadMore`, `scroll`, and `numbered` modes with D16's element-and-content
  de-duplication. The worker fixed two latent defects it found on the way: a
  `NaN` `maxPages` or `maxItems` surviving the lift previously made a read
  unbounded, and `missingFields` now names required fields only
- Why (deviations, all accepted): text reads `textOutsideSensitiveControls` and
  repeats the collapse rather than importing `readableText`, because reaching
  past `action-runtime`'s barrel is an audit violation and exporting it there
  would make the two directories import each other; `advancePage` gained a
  fourth outcome, `truncated`; and a column spec ignores a selector sent with it
- Validation: in `F:\!FluxIQWebExtension`,
  `pnpm --filter @fluxiq-web-extension/extension check` → exit 0; then
  `EXTENSION_TEST_BUILD_LABEL=supervisor-x3b node apps/extension/scripts/test-extension.mjs`
  → `# pass 559`, `# fail 0`, exit 0, covering `x3b-page-engine` and the earlier
  `x0-9` to `x0-11` work together. The worker's own runs also observed the
  `extract-list` content harness at 30 passed under Chromium and 30 under the
  Firefox content config, and six mutations red and reverted byte-identical; the
  supervisor's full content-harness rerun is the next gate
- Outcome: Accepted
- Follow-up: `e2e/content/tests/extract-list.spec.ts` is now 782 lines against
  the 800 hard limit, so X5-H splits it into `e2e/content/tests/extraction/`
  rather than adding rows — the fixture content-harness rows in X5.4 must wait
  for that split. Firefox ran on a mismatched Playwright build revision
  (wants firefox-1475, machine has firefox-1538, worked around with
  `FLUXIQ_FIREFOX_EXECUTABLE`), so that pass is weaker evidence than Chromium's.
  D16's de-duplication is still unproven against real node recycling, because
  there is no virtualised-list fixture; X5 measures it

### 2026-09-15 — X5.1 verified complete; X5.2 and the fixtures dispatched
- Agent: supervisor; worker `x5a-evaluation-contracts` (resumed)
- Changed: `packages/test-contracts/src/{evaluation,evaluation-validation,bench-report,bench-report-validation}.ts`
  and three test files; `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts`,
  `flow-lane/tests/lane-observation.test.ts`, and six bench test files (all
  uncommitted); the report; this document (briefs `x5b-measure-extraction`,
  `x5d-fixtures-catalog`, `x5e-fixtures-tables-feed`)
- Why: the seven fixtures pinned to evaluation `"0.2"` were the supervisor's
  brief omission; the resumed worker moved them to `"0.3"` with
  `extraction: null` and changed nothing else about them, which cleared both
  failures. `RunExtractionMeasurement` carries numbers and booleans only and
  refuses any string member, so a record value cannot reach an evaluation file
- Validation: in `F:\!FluxIQWebExtension`,
  `pnpm --filter @fluxiq-web-extension/test-contracts test` → `# tests 89`,
  `# pass 89`, `# fail 0`, exit 0;
  `pnpm --filter @fluxiq-web-extension/test-runner build` → exit 0;
  `pnpm --filter @fluxiq-web-extension/test-runner test` → `# tests 849`,
  `# pass 849`, `# fail 0`, exit 0
- Outcome: Accepted
- Follow-up: X5.3's seam waits on X4-C's `background/extraction/control.ts`;
  the fixture e2e specs and the `extract-list` content-harness rows are the
  supervisor's, serial after X3-B

### 2026-09-15 — x5a partial; evaluation 0.3 landed; Current State refreshed
- Agent: supervisor; worker `x5a-evaluation-contracts`
- Changed: `packages/test-contracts/src/{evaluation,evaluation-validation,bench-report,bench-report-validation}.ts`
  and their tests, plus `extraction: null` in two test-runner files
  (uncommitted); the report; this document (Current State rewritten; the
  planning-time findings, the completed briefs, and older ledger entries moved
  to the archive)
- Why: X5.1's contract half, leaving `recordable-actions.ts` and
  `flow-lane-exclusion.ts` to X5.3 (D14). Seven fixtures hard-code the 0.2
  evaluation version, which the brief did not allow the worker to touch; that
  was the supervisor's omission, and the worker is resumed with those seven
  named. Its tolerance reading is confirmed: record, count, and pagination
  accuracy within one record of the population; exact and false success on the
  workflow rate tolerance; extraction distributions reported, not compared
- Validation: not yet verified by the supervisor; the amendment's rerun of the
  test-contracts tests and the test-runner build is the gate
- Outcome: Partial
- Follow-up: verify after the amendment; then X5.2 and the fixtures

### 2026-09-15 — x3a and x0-11 done; domain verified clean; x0-12 dispatched
- Agent: supervisor; workers `x3a-domain-inference`, `x0-11-identity-sensitive-text`
- Changed: new `domain/src/extraction/{index,signature,label-key,dataset-id,proposal}.ts`
  and their tests, with one export line each in `domain/src/client/index.ts`
  and `domain/src/index.ts`; `apps/extension/src/content/{sensitive-text,describe-element}.ts`,
  `content/identity/{context,label}.ts`, `content/action-runtime/extract.ts`,
  their tests, `e2e/content/tests/{actions,evidence}.spec.ts`, and
  `docs/architecture/sensitive-values.md` (all uncommitted); both reports; this
  document (brief `x0-12-descriptor-marked-state`)
- Why: X3.3's domain share, reusing `x1-domain-contracts`' key check (the new
  file is `label-key.ts`, so there are never two `field-key.ts` files). A
  proposal's field spec carries no element fingerprint, because the fingerprint
  holds page text (D3); X4 attaches it at record time. `x0-11` closes the
  landmark-name, marked-label, and inside-a-control extract paths, and found and
  fixed a fourth: a span inside a marked editable region leaked its words as the
  descriptor's `value`. It applied the same rule to checked state and select
  options without tests, so `x0-12` adds them and checks the recorder's input
  events. The three domain failures the supervisor saw earlier came from
  `x3a`'s mutations on shared source
- Validation: `pnpm --filter @fluxiq-web-extension/domain check` → exit 0;
  `DOMAIN_TEST_BUILD_LABEL=supervisor-x3a pnpm --filter @fluxiq-web-extension/domain test`
  → `# tests 440`, `# pass 440`, `# fail 0`, covering `x1-domain-contracts`,
  `x1-output-nodes`, and `x3a`. `x0-11`'s extension checks are not yet rerun by
  the supervisor; the combined extension check, unit tests, and full content
  harness run after `x3b-page-engine` lands.
- Outcome: Partial
- Follow-up: the combined extension verification and X0/X1 commit after X3-B

This file is the archive; nothing is earlier than what is here. The live
document is the
[first-class data extraction plan](../../first-class-data-extraction-plan.md).

## 2026-09-15 second compaction: completed cleanup briefs and settled entries

### Brief: x5i-contract-fallout
- Repository: this repository
- Task: `x5g-recordable-actions-contract` made `web.dom.extract_list` and
  `web.dom.extract` recordable and deleted the paginated-click branch. Several
  assertions and comments elsewhere still encode the **old** contract and now
  state the opposite of the truth. Fix them, taking the exact line list from
  `reports/x5g-recordable-actions-contract.md`:
  - `packages/test-contracts/tests/scenario-validation.test.mjs` — two failing
    assertions around `:189` and `:211`, whose expectations at `:205` and `:227`
    are that `web.dom.extract` is still refused and that a paginated extract
    still yields `web.dom.click`. The report names the four exact line fixes.
  - `packages/test-runner/src/.../week1-corpus.test.ts:74`, where
    `NO_FLOW_LANE_ROWS = new Set(["W04", "W08"])` is now inverted by the change.
    The worker predicted this by inspection without observing it, so **run it
    and report what you actually see** before changing anything.
  - Three stale comments that now describe the reversed contract:
    `packages/test-contracts/src/validation.ts:234-236`,
    `packages/test-contracts/src/scenario.ts:22-27`, and
    `apps/scenario-lab/src/scenarios/admin-console/tests/scenario.test.ts:232`.
- Change only what the reversed contract requires. If an assertion looks wrong
  for a reason other than this change, report it rather than editing it.
- Required reads: `AGENTS.md`; this document's D6, D7, and D14;
  `reports/x5g-recordable-actions-contract.md`; the plan's Part 4 X5.1
- Owns (may edit): `packages/test-contracts/tests/scenario-validation.test.mjs`,
  `packages/test-contracts/src/{validation,scenario}.ts` (comments only),
  `packages/test-runner/src/**/week1-corpus.test.ts`, and
  `apps/scenario-lab/src/scenarios/admin-console/tests/scenario.test.ts`
  (comment only)
- Must not touch: `recordable-actions.ts` and `flow-lane-exclusion.ts` (just
  landed), `run-expectations/**`, `apps/scenario-lab/e2e/**` (`x5j`'s),
  `apps/scenario-lab/src/scenarios/product-catalog/**` (`x5d` is resumed there),
  the extension, the domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/test-contracts test`
  (it is 91 tests with 2 failing right now; it must reach 91 passing) and
  `pnpm --filter @fluxiq-web-extension/test-runner test`; structure audit
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5i-contract-fallout.md`

### Brief: x5j-fixture-e2e-specs
- Repository: this repository
- Task: take ownership of `apps/scenario-lab/e2e/**`, which three fixture
  workers were forbidden to touch while the execution report's own partition
  assigned those files to them — the supervisor's contradiction. Three specs are
  broken in a way `pnpm check` cannot see, because each still **type-checks**
  and only fails when Playwright runs:
  - `product-catalog.spec.ts:50` asserts a hand-written runs table equals the
    manifest enumeration, which went from 7 runs to 13. It also needs `numbered`
    support in its local extract helper.
  - `infinite-feed.spec.ts:85,144` assert `toEqual([{ step, count }])` exactly,
    which `x5e`'s added records for W11 now break.
  - `data-table.spec.ts:43-50` ignores `pages` and `truncated`, the same silent
    pass X5-F just removed from the runner — make it judge them, or state in the
    report why it cannot yet.
- Decide the `infinite-feed` seed question and say why: records are written for
  the scenario's declared seed 116, while the spec pins `labSeed: 42` and
  derives its own. Either move the spec to 116 or make the feed content
  seed-independent as `data-table`'s fixed catalog is. Prefer the option that
  makes the fixture deterministic without pinning a seed in two places.
- Required reads: `AGENTS.md`; this document's D6, D7, and D16;
  `reports/x5d-fixtures-catalog.md`, `reports/x5e-fixtures-tables-feed.md`, and
  `reports/x5f-refuse-unjudgeable-expectations.md`
- Owns (may edit): `apps/scenario-lab/e2e/**`
- Must not touch: `apps/scenario-lab/src/**` (the fixture workers'),
  `packages/test-runner/**`, `packages/test-contracts/**`, the extension, the
  domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/scenario-lab check`,
  then `pnpm --filter @fluxiq-web-extension/scenario-lab test:e2e` for each
  affected scenario, **one at a time** — this machine has a RAM fault, so a lone
  non-reproducible failure is retried once before it is believed. Report the
  observed output of every run, including any that still fails
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5j-fixture-e2e-specs.md`

### 2026-09-15 — This document compacted to fit its own budget
- Agent: supervisor
- Changed: this document and
  [the archive](./2026-09-15-completed-briefs-and-ledger.md)
- Why: the document had reached 1,301 lines against the 800-line budget its own
  `working-docs` audit rule enforces, which fails the structure gate and so
  would have blocked the commit. Ten completed worker briefs and nine settled
  ledger entries moved to the archive; the two running briefs and the entries
  covering still-open findings stayed
- Validation: the move was scripted rather than hand-edited, and the script
  reported `19/19` sections matched with none unmatched — so no heading was
  silently missed. 1,301 → 732 lines, and the archive grew from 48,952 to
  87,708 bytes, which accounts for the removed text. `node scripts/structure-audit.mjs`
  → 1 violation, down from 2: only `docs/working/README.md` being out of date
  remains, and `pnpm structure:baseline` regenerates that at commit time
- Outcome: Accepted
- Follow-up: none; the archived entries stay in git and are linked from here

### 2026-09-15 — An unjudgeable expectation now fails loudly (X5-F)
- Agent: supervisor; worker `x5f-refuse-unjudgeable-expectations`
- Changed: `packages/test-runner/src/run-expectations/extraction.ts` and
  `run-expectations/tests/extraction.test.ts` (both uncommitted)
- Why: `assertExtraction` now throws `fixture.invalid` — deliberately **not**
  `runtime.behavior`, which would blame FluxIQ for the runner's missing
  observation and corrupt the bench's category accuracy — naming the step and
  every unjudgeable field, before any content assertion. `measureExtraction` and
  its optional `observed` parameter are untouched, so both pinned call sites
  still compile unchanged
- Why (the decision): six fixture entries are affected and none was edited. W05
  `paginated-extraction` and W07 `in-stock-only` (`pages: 3`) now fail **today**
  on the recording lane; `short-catalog`, `link-pagination`, `numbered-pages`,
  and `large-table` do not, because variants are Flow-lane only and
  `assertFlowExtraction` returns `not_applicable` until X4 makes extraction
  recordable. The supervisor accepts the worker's recommendation: **hold the
  expectations and let W05 and W07 fail loudly until X5.3 wires `observed`**. A
  red run that names the gap is the point; softening it would restore exactly
  the silent pass this change exists to remove
- Validation: the worker observed
  `pnpm --filter @fluxiq-web-extension/test-runner test` → 859 passed (857
  before), with no newly failing unit test. Its mutation proof was **refused by
  the permission system** ("Security Test Removal") when it disabled the guard
  to watch the tests redden; it restored the file immediately, confirmed it
  byte-identical by hash, and did not work around the refusal, which is the
  correct response. The supervisor read the new tests instead: `:88-92` asserts
  that `pages` is checked against what the step read and that an expectation
  with nothing to read it is refused with "declares pages, which nothing
  reported", and `:94` asserts the `fixture.invalid` refusal names the entry and
  every unjudgeable field. The behaviour is therefore directly asserted by
  passing tests, even though "the tests redden without the guard" stays reasoned
- Outcome: Accepted
- Follow-up: the supervisor's own suite rerun failed once and is under
  investigation — `x5g-recordable-actions-contract` was mid-edit in
  `packages/test-contracts`, which `test-runner`'s build depends on, so this may
  be the same not-disjoint mistake as the content harness

### 2026-09-15 — Finding: a second fixture e2e spec has the same silent pass
- Agent: supervisor, from `x5f`'s and `x5e`'s findings
- Why: `apps/scenario-lab/e2e/data-table.spec.ts:43-50` ignores `pages` and
  `truncated` exactly as the runner did before X5-F, so it passes without
  judging them. Separately `e2e/infinite-feed.spec.ts:85,144` assert
  `toEqual([{ step, count }])` exactly and now fail at runtime after `x5e` added
  records for W11, and `e2e/product-catalog.spec.ts:50` is broken the same way.
  **None of these is a type error**, so `pnpm check` stays green and all three
  stay invisible until Playwright actually runs. Three specs, one cause: the
  briefs forbade `e2e/**` while the execution report's own partition assigned
  those files to the fixture workers — the supervisor's contradiction
- Validation: read from source by two workers; no Playwright run has happened
- Outcome: Open
- Follow-up: one worker owns `apps/scenario-lab/e2e/**` and fixes all three,
  before any Lab or bench run is treated as evidence

### 2026-09-15 — X5.4's table, feed, frame, and sensitive fixtures landed
- Agent: supervisor; worker `x5e-fixtures-tables-feed`
- Changed: `apps/scenario-lab/src/scenarios/` — `data-table/`, `infinite-feed/`,
  the new `iframe-checkout/order-lines.ts`, and the new
  `sensitive-input/saved-cards.ts`, with their scenarios, barrels, and tests
  (all uncommitted)
- Why: `empty-table` and `large-table` with the 1,000 cap and `truncated`;
  W11's records, `extract-until-end` by scroll, and a `load-more-button`
  variant; a frame-qualified `extract-order-lines`; and a saved-cards workflow
  whose password `value` field expects `blocked_by_capability_or_policy` while
  its excluded variant succeeds with no planted string in the bundle. As in
  `x5d`, the excluded-column case had to be a sibling **workflow**, not a
  variant: a variant cannot change a step's `fields`, and the contract's
  `fields` map cannot express D12's `handling: "exclude"`
- Validation: the worker observed
  `pnpm --filter @fluxiq-web-extension/scenario-lab check` → exit 0 and
  `... test` → 225 passed, 0 failed, with four mutations caught and reverted.
  Its first run was 224/1 on its own assertion, which could not tell the
  sentinel element from the client script searching for that same selector —
  found and fixed by the worker. The supervisor's own run waits until every
  scenario worker has released the directory
- Outcome: Accepted
- Follow-up: **the two new paginated workflows cannot run at all yet** — the
  Lab's reader follows only `next` pagination and throws `fixture.invalid`
  otherwise (`test-runner/scenario-steps/extract-records.ts`), so scroll and
  loadMore must be taught to it before these fixtures measure anything. The
  1,000 cap and `truncated` are declared, not observed. `x5e` also asks whether
  `infinite-feed`'s spec should move to the scenario's declared seed 116 or the
  feed content should be made seed-independent like `data-table`'s fixed
  catalog; the e2e owner decides that with the three broken specs

Earlier entries, and the completed worker briefs, are in the
[archive](./2026-09-15-completed-briefs-and-ledger.md).

## 2026-09-15 third compaction: settled entries and the completed x5k brief

### Brief: x5k-test-runner-fallout
- Repository: this repository
- Task: `x5i-contract-fallout` ran the predicted failure instead of assuming it,
  and found **three** test-runner consequences rather than one. Two remain,
  both outside what `x5i` owned, plus a stale comment. Fix all three:
  1. `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts:245`
     expects `fixture.invalid` and now gets `environment.missing`, because W04
     is no longer a no-action workflow once `web.dom.extract_list` is
     recordable, so no Week 1 fixture is an example of one any more. Keep what
     the test was actually proving — find or construct a genuine no-action case.
     **Do not weaken the assertion to make it pass**, and if the case no longer
     exists at all, say so in the report rather than deleting the coverage.
  2. `packages/test-runner/src/run-expectations/tests/recording-event-types.test.ts`
     fails for an unrelated reason: the domain already maps `data.extract` to
     `web.data.extraction_defined` (`domain/src/constants.ts:18`,
     `io/input-model.ts:70`) from X4.1, and test-runner's **mirror** of those
     event types lacks the row. Add it — and say in the report whether the
     mirror could be derived from the domain instead of hand-copied, since a
     mirror that drifts silently is what produced this failure.
  3. `packages/test-runner/src/bench/corpus/week1.ts:19-21` still says 63
     runnable and 4 skipped. The measured truth is 67 runnable — 23 recording
     and 44 flow, of which 23 are unarmed and 21 are variants — and 0 skipped.
- Required reads: `AGENTS.md`; this document's D6, D7, D14, and D16;
  `reports/x5i-contract-fallout.md`; `reports/x5g-recordable-actions-contract.md`
- Owns (may edit): `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`,
  `packages/test-runner/src/run-expectations/**`, and
  `packages/test-runner/src/bench/corpus/week1.ts`
- Must not touch: `packages/test-contracts/**`, `apps/scenario-lab/**`
  (`x5j` is in its `e2e/`), `run-expectations/extraction.ts`'s refusal
  behaviour, the extension, the domain, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/test-runner build`,
  then `pnpm --filter @fluxiq-web-extension/test-runner test` — it is 859 tests
  with 2 failing right now, and must reach 859 passing. Report the observed
  numbers and name anything still failing; structure audit
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5k-test-runner-fallout.md`

### 2026-09-15 — X5-I: running the prediction found three breaks, not one
- Agent: supervisor; worker `x5i-contract-fallout`
- Changed: `packages/test-contracts/tests/scenario-validation.test.mjs`,
  comments in `packages/test-contracts/src/{validation,scenario}.ts`,
  `packages/test-runner/src/bench/corpus/tests/week1-corpus.test.ts`, and a
  comment in `apps/scenario-lab/src/scenarios/admin-console/tests/scenario.test.ts`
  (all uncommitted)
- Why: `x5g` predicted by inspection that one test-runner assertion would
  invert. The brief required running it rather than assuming, and that was the
  right call — there were **three** consequences, not one. The worker's own
  (the Week 1 corpus going from 63 to 67 runnable, matching D7 exactly) is
  fixed; the other two were outside what it owned and became
  `x5k-test-runner-fallout`
- Why (a regression it caught in its own work): its first pass pushed
  `scenario-validation.test.mjs` from 399 to 405 lines, crossing the 400-line
  audit threshold. It trimmed its own comments back to 399 with every assertion
  intact, rather than leaving a new violation behind
- Validation: `pnpm --filter @fluxiq-web-extension/test-contracts test` →
  91 tests, 91 passing, exit 0, up from 89 passing with 2 failing — the
  acceptance condition met. `pnpm --filter @fluxiq-web-extension/test-runner test`
  → 859 tests, 857 passing, 2 failing, which is the honest state and is what
  `x5k` closes. Not reverified by the supervisor yet; the downstream gates after
  `x5k` are that check
- Outcome: Partial, by design — the remaining two failures were never this
  worker's to fix
- Follow-up: `x5k`, then the downstream gates. One of the two, the recording
  event-type mirror, is not fallout from the contract change at all: the domain
  gained `data.extract → web.data.extraction_defined` in X4.1 and test-runner's
  hand-copied mirror never gained the row, so a mirror drifted silently — worth
  deriving rather than copying

### 2026-09-15 — Three invisible e2e breaks fixed, and a fourth found
- Agent: supervisor; worker `x5j-fixture-e2e-specs`
- Changed: `apps/scenario-lab/e2e/{product-catalog,infinite-feed,data-table}.spec.ts`
  (all uncommitted)
- Why: all three specs type-checked, so `pnpm check` stayed green while they
  were broken — only Playwright could see it. The worker took a **baseline run
  first** and observed each break rather than assuming it: product-catalog
  failed with the enumeration missing exactly the six predicted keys,
  infinite-feed failed twice on `toEqual([{ step, count }])` with a diff showing
  seed-116 content against a seed-42 spec, and data-table passed while judging
  nothing. Afterwards: 15, 4, and 4 passing. No run failed non-reproducibly, so
  the RAM-fault retry was never needed
- Why (a fourth break, beyond the brief): the catalog reader flattened an absent
  field to `""`, so the `sparse-cards` and `with-images` fixtures' `null`
  records could never have matched — the fixtures would have looked correct and
  measured nothing. `data-table` now **refuses** `pages` and `truncated` rather
  than judging them, with a test proving the refusal fires, which matches X5-F's
  rule that an unjudgeable expectation must fail rather than pass
- Why (the seed decision): the spec now reads `infiniteFeedScenario.seed` rather
  than pinning a literal, so the seed exists in exactly one place. Making the
  feed content seed-independent would need `src/**`, which this worker did not
  own
- Validation: the worker observed
  `pnpm --filter @fluxiq-web-extension/scenario-lab check` → exit 0, and the
  three Playwright runs above. The supervisor's own rerun comes with the
  downstream gates
- Outcome: Accepted
- Follow-up: its recommendation is taken — `data-table` and `infinite-feed`
  should gain product-catalog's enumeration guard, because its **absence** is
  exactly why `x5e` could add five fixtures with nothing going red. None of
  these specs exercise FluxIQ's extractor; they drive scripts with plain
  Playwright and prove only that a fixture matches its manifest. `large-table`,
  `empty-table`, and infinite-feed's three paginated entries still have no e2e
  coverage at all

### 2026-09-15 — X3.3 and X3.4 landed: FluxIQ can now infer a list from a click
- Agent: supervisor; worker `x3c-page-inference`
- Changed: new `apps/extension/src/content/extraction/{infer-list,item-selector,infer-fields,detect-pagination}.ts`
  with four test files and barrel lines; new
  `apps/extension/src/shared/extraction-messages.ts`;
  `content/message-handler.ts` (the `extraction.propose` message);
  `content/evidence/repeating.ts` (the domain signature imported and the local
  copies deleted); new `e2e/content/tests/extraction/inference.spec.ts`;
  `docs/architecture/{web-capabilities,sensitive-values}.md` (all uncommitted)
- Why: picking one element now yields a proposal — the repeating container, an
  item selector accepted only when it matches exactly the run, the fields with
  their coverage, and the pagination style. This is the inference half of the
  picker; the picker UI itself is X4.2-X4.4 and is not started
- Why (two judgement calls, both accepted): D12's pre-selection uses
  `isWithinSensitiveControl` rather than `isSensitiveFormControl`, because the
  field reader refuses the whole read for anything inside a marked element, so
  proposing `include` there would build a request that refuses itself — the
  wider check is also the safer one. And "a `<td>` or `<th>` is never the
  record", without which the data-table case cannot pass, since a row's four
  cells are a nearer run of three-or-more than the twelve rows are
- Why (an accepted deviation): the new spec went to
  `e2e/content/tests/extraction/` rather than the flat directory, because that
  directory holds exactly 25 files — the audit's hard limit with no baseline
  entry — so a 26th file would fail `pnpm check`. D16 already directs new specs
  there. The worker also fixed three stale pointers to the file `x3b` deleted
- Validation: in `F:\!FluxIQWebExtension`,
  `pnpm --filter @fluxiq-web-extension/extension check` → exit 0, then
  `EXTENSION_TEST_BUILD_LABEL=supervisor-x3c node apps/extension/scripts/test-extension.mjs`
  → `# pass 578`, `# fail 0`, exit 0 (559 before X3-C). The worker's four
  mutations were each observed red — the exclude pre-selection, a superset item
  selector, a cell treated as a record, and the Next label — and restored
  byte-identical, with `git diff --stat` on the tracked build outputs empty
- Outcome: Accepted
- Follow-up: **the harness spec is unrun**, on the supervisor's instruction, so
  all three of its cases are unproven and the two harness-level mutations were
  observed only at unit level. The filter is `extraction/inference`, not
  `extraction-inference`. Its report leaves four design questions open — sharing
  `ITEM_SELECTOR` through the evidence barrel, the invented `maxPages` default,
  the two-value refusal vocabulary, and frame routing for X4 — which belong in
  the plan review rather than being settled silently here

### 2026-09-15 — X4.1 landed; Core's growth broke a hard-coded domain count
- Agent: supervisor; worker `x4a-domain-recorded-extraction`
- Changed: `domain/src/constants.ts`, `recording/events.ts`, new
  `recording/proposals/record-output.ts`, new `actions/extraction/{request,read-request,recorded-definition,index}.ts`,
  `actions/{schemas,types}.ts`, `io/input-model.ts`,
  `output-nodes/{payloads,definitions}.ts`,
  `client/{gateway-action-parameters,gateway-mapping}.ts`, `web-panel-host.ts`,
  and seven test files; plus `domain/src/tests/domain.test.ts` by the supervisor
  (all uncommitted)
- Why: a recorded extraction now becomes a real node. D3 is enforced by
  rebuilding the definition field by field, so no sample value and no unknown
  key survives; `fieldLabels` deliberately carries column headers, which is page
  **structure** under D16 rather than page content
- Why (a test defect the worker found in its own work): its planted sentinel was
  made only of A-Z and `-`, which is a **valid** field key, so the reader was
  right to accept it and the red was the test's fault, not the code's. The
  lesson is recorded in its report: the D16 key rule proves "this could be a
  Core column id", never "this did not come from the page"
- Why (the supervisor's own fix): `domain/src/tests/domain.test.ts:173-174`
  hard-coded 39 and 57 builtin nodes. Core's K6 added `builtin.control.for-each`
  and `builtin.data.write-records`, so the count is now 41 and the **whole file
  failed to load**, taking the domain suite's exit code to 1 while every one of
  its 472 tests passed. A literal that must be edited whenever Core grows is not
  a check, it is a trip wire, so both literals are now derived: the registered
  count must exceed the builtin count by exactly the number of output nodes this
  domain registers
- Validation: in `F:\!FluxIQWebExtension`, after the supervisor's fix,
  `pnpm --filter @fluxiq-web-extension/domain check` → exit 0, and
  `DOMAIN_TEST_BUILD_LABEL=supervisor-x4a pnpm --filter @fluxiq-web-extension/domain test`
  → `# pass 472`, `# fail 0`, **exit 0** — the load failure is gone and the
  suite's exit code is honest again. The report's five mutation targets were
  **not** applied by the worker, so they remain unproven
- Outcome: Accepted, with the mutation proofs outstanding
- Follow-up: `docs/architecture/sensitive-values.md` should record that
  `fieldLabels` carries column headers by design; `x3c-page-inference` owns that
  file for X3.4

## 2026-09-15 fourth compaction: settled cleanup briefs and entries

### Brief: x4b-fingerprint-directory
- Repository: this repository
- Task: `domain/src/actions/extraction/read-request.ts:23` imports
  `elementFingerprint` from `../../output-nodes/targets`, reaching past that
  directory's barrel, which the `imports` rule fails. **Three ways out are
  already ruled out, so do not retry them:** importing the `output-nodes` barrel
  closes a real runtime cycle (`output-nodes/index` re-exports `./definitions`;
  `definitions.ts:5` imports `webAutomationActionDefinitions` from
  `../actions/schemas` as a value; `schemas.ts:2` imports the `./extraction`
  barrel as a value, which re-exports `read-request`); `import type` is
  unavailable because `elementFingerprint` is **called** at
  `read-request.ts:191`; and the baseline refuses to record it —
  `--update` never adds a new entry, by design.
- The fix is structural: give the fingerprint normalizer its own directory with
  its own barrel, so no importer has to reach past one. Move
  `domain/src/output-nodes/targets.ts` to its own directory (for example
  `domain/src/element-targets/`, with `index.ts` as its barrel), keep its
  `tests/` beside it per this repository's placement rule, and update **every**
  importer to the new barrel. Confirm first that the moved file still imports
  nothing from `actions/` except types — if it imports a value from `actions/`,
  stop and report, because the move would only relocate the cycle.
- Facts the supervisor already established, so you need not rederive them:
  `targets.ts` imports **only types** from `../actions/types` (`import type` at
  line 2) and nothing else from `actions/`, so moving it relocates no cycle —
  verified by reading, not by trusting the file's comment. Its importers are
  `output-nodes/{payloads,recorded-element-key,secret-binding,upload-binding}.ts`
  and `output-nodes/tests/targets.test.ts`, all **inside** `output-nodes/` and
  therefore exempt from the rule today, plus the one outside importer that
  fails, `actions/extraction/read-request.ts`. So the move is for the sake of a
  single outside importer while five siblings must be repointed: weigh that, and
  if you find a smaller change that satisfies the rule without relocating a
  shared module, propose it in the report **before** doing the move.
- `output-nodes/tests/targets.test.ts` moves with it, into the new directory's
  own `tests/`.
- Judge the directory name against `docs/architecture/code-structure.md`'s
  ownership/layer/feature/kind rule rather than inventing one; say in the report
  why you chose it.
- Required reads: `AGENTS.md`; `docs/architecture/code-structure.md`;
  `scripts/structure-audit/rules/imports.mjs` (the rule you must satisfy, in
  particular why a nested importer is exempt and a barrelled directory is not);
  `reports/x4a-domain-recorded-extraction.md`
- Owns (may edit): `domain/src/output-nodes/**`, the new directory and its
  tests, `domain/src/actions/extraction/read-request.ts`, `domain/src/index.ts`
  and `domain/src/client/index.ts` barrels, and any importer the move requires
- Must not touch: `apps/extension/**`, `apps/scenario-lab/**`, `packages/**`,
  `scripts/structure-audit/**` (the config is mirrored from Core and must change
  there first), `.structure-baseline.json`, every other file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/domain check`;
  `DOMAIN_TEST_BUILD_LABEL=x4b pnpm --filter @fluxiq-web-extension/domain test`
  (it was 472 passing, exit 0 — report the new number);
  `node scripts/structure-audit.mjs` after `git add -A`, which **must** no
  longer report the `[imports]` failure. Staging first is not optional: the
  audit reads `git ls-files` and is blind to untracked files
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x4b-fingerprint-directory.md`

### Brief: x5l-harness-fixture-regressions
- Repository: this repository
- Task: the full content harness is **6 failed, 261 passed**. The six group into
  two sets, and both sets sit on fixtures `x5e-fixtures-tables-feed` changed:
  `evidence.spec.ts:535`, `identity.spec.ts:187`, and
  `identity-signals.spec.ts:90,96` all concern `sensitive-input`, while
  `scroll.spec.ts:129,148` concern `infinite-feed`. **Establish the cause before
  changing anything** and put it in the report: for each failure, say whether the
  fixture's page changed under an assertion that was still correct, or whether
  the assertion itself is now wrong.
- **The security rule for this task, which overrides convenience:** three of
  these assert that a sensitive control's contents, state, or value never reach
  page evidence or identity. If any of them fails because a leak has genuinely
  been reintroduced, that is a security regression — fix the **extension**, and
  never the assertion. Only a failure proven to come from the fixture's markup
  changing may be fixed in the fixture or the spec. If you cannot tell which it
  is, stop and report rather than guessing.
- Required reads: `AGENTS.md`; this document's D2 and D12;
  `docs/architecture/sensitive-values.md`;
  `reports/x5e-fixtures-tables-feed.md`; `reports/x0-12-descriptor-marked-state.md`
- Owns (may edit): `apps/extension/e2e/content/tests/{evidence,identity,identity-signals,scroll}.spec.ts`
  and `apps/scenario-lab/src/scenarios/{sensitive-input,infinite-feed}/**`; and,
  **only** where you have proven a real leak, the extension source that leaks it
  plus its unit test — report that case prominently
- Must not touch: `domain/**` (`x4b-fingerprint-directory` is working there),
  `packages/**`, `apps/extension/e2e/content/tests/extraction/**`, every other
  file
- Validation, run alone: `pnpm --filter @fluxiq-web-extension/extension check`;
  `EXTENSION_TEST_BUILD_LABEL=x5l node apps/extension/scripts/test-extension.mjs`;
  then `pnpm --filter @fluxiq-web-extension/extension test:content -- --workers=2`,
  which must reach 0 failed. Report the observed counts, and name anything still
  failing rather than rounding it off. This machine has a RAM fault, so retry a
  lone non-reproducible failure once before believing it — but six named
  failures in two coherent groups are not that
- Report to: `F:\!FluxIQWebExtension\docs\working\first-class-data-extraction-plan\reports\x5l-harness-fixture-regressions.md`

### 2026-09-15 — X5-L: no leak was reintroduced, and the brief was wrong twice
- Agent: supervisor; worker `x5l-harness-fixture-regressions`
- Changed: `apps/extension/e2e/content/tests/{evidence,identity,identity-signals}.spec.ts`
  only. No extension source, no fixture, and `scroll.spec.ts` untouched
- Why (**the security determination, which was the point**): no leak was
  reintroduced. On `evidence.spec.ts:535` the whole-wire secret scan **passed**;
  the failure was sixteen lines later, comparing a landmark name and receiving
  `"Saved cards"` — the `aria-label` `x5e` added, page chrome rather than a
  secret. The three identity rows failed **before evaluating any assertion**,
  on `Action rejected: the target is a sensitive control, so its value is never
  read`. That refusal **is** the feature D2 requires: those specs had been using
  the read verb merely as a way to fetch a descriptor. The fix changed the
  route — reading the same `describeElement` output from the snapshot, as
  `redaction.spec.ts:461` already does — and never an assertion
- Why (assertions strengthened, none weakened): `evidence.spec.ts` now also
  scans the snapshot and reply for the unlock code `x5e` planted in each saved
  card's password control, and it passes; `identity.spec.ts` now asserts the
  password descriptor carries no `value` property at all, replacing a comment
  that had deferred exactly that check
- Why (**the supervisor's brief was wrong twice**): `scroll.spec.ts:129,148`
  never failed — they passed in every run, and the `infinite-feed` baseline page
  is byte-identical after `x5e`, whose diff only adds the `load-more` branch.
  The real second failure is a teardown hang the brief never named:
  `Tearing down "openHarness" exceeded the test timeout of 30000ms`, five times
  across five runs on three different rows, never reproducing on the row it had
  just hit, always after that row's assertions passed
- Validation: the supervisor's own reruns are in the entry above. The worker
  observed `check` → exit 0, unit tests → 578 passing, the targeted
  `evidence identity` harness → 83 passed and 0 failed, and the full harness →
  265 passed with 2 failed, **explicitly not claiming zero**: zero assertion
  failures, two teardown timeouts
- Outcome: Accepted
- Follow-up: two decisions it surfaced. `evidence.spec.ts` is now 790 lines, ten
  from the hard 800 failure, so X5-H's split is effectively forced and the four
  `sensitive-input` rows are the natural extraction. And `describe()` in
  `identity-fixtures.ts` still routes through the read verb, which six specs
  import, so any future row describing a sensitive control hits the same wall —
  `describeInSnapshot` is duplicated in two specs until that helper is hoisted

### 2026-09-15 — X4-B satisfied the rule by its own stated remedy
- Agent: supervisor; worker `x4b-fingerprint-directory`
- Changed: `domain/src/output-nodes/targets.ts` → `output-nodes/targets/targets.ts`
  and its test into `targets/tests/`, both as git renames; a new
  `output-nodes/targets/index.ts` barrel; a comment in
  `actions/extraction/read-request.ts`. **Zero import specifiers changed
  anywhere in the repository**
- Why: the brief proposed relocating the file to a new top-level directory. The
  worker did the smaller thing the brief invited instead, and it is better:
  making `targets` a **directory with its own barrel** means the existing
  `../../output-nodes/targets` specifier now names a directory entry point,
  which `imports.mjs:113-114` exempts because it "already goes through that
  directory's entry point". That is the rule's own remedy, not a way around it.
  It also confirmed the neighbouring exemption is by rule rather than luck:
  `domain/src/actions/` has no `index.ts`, so the type-only `../actions/types`
  import cannot trip the same check, and neither file carries a baseline key
- Why (**the supervisor's estimate was wrong, by about three times**): the brief
  said the move touched six files — five siblings plus one outside importer.
  The worker counted sixteen: seven more files reach these symbols through the
  `output-nodes` barrel (`client/gateway-mapping.ts`,
  `io/gateway-output-dispatcher.ts`, `runtime/adapter.ts` and four tests), plus
  an extension e2e spec through `domain/client`. Had it followed the brief, it
  would have repointed sixteen files to fix one import
- Validation: in `F:\!FluxIQWebExtension`,
  `pnpm --filter @fluxiq-web-extension/domain check` → exit 0;
  `DOMAIN_TEST_BUILD_LABEL=supervisor-x4b pnpm --filter @fluxiq-web-extension/domain test`
  → `# pass 472`, `# fail 0`, exit 0; then `git add -A` followed by
  `node scripts/structure-audit.mjs` → **1 violation**, and it is only
  `docs/working/README.md` being out of date. The `[imports]` failure is gone
  rather than relocated. The staged form is the only one that means anything
  here, because the audit reads `git ls-files` and cannot see untracked files
- Outcome: Accepted
- Follow-up: the worker's real finding is one for the plan review, not for now.
  `targets.ts` is three things at once — the shared `elementFingerprint`,
  `outputTargetFromPayload` which genuinely belongs to output-nodes, and four
  generic JSON readers — so the relocation the brief asked for would have
  mislabelled two of them. A cohesion split is the actual fix, and now that the
  barrel exists it would change no importer

### 2026-09-15 — The content harness is 6 failed, 261 passed
- Agent: supervisor
- Why: the first full harness run since the fixture work. The six failures are
  **not** the uniform, impossible-looking shape this machine's RAM fault
  produces — they are six named specs in two coherent groups, both landing on
  fixtures `x5e` changed: four on `sensitive-input` (page evidence quoting a
  sensitive control's contents, a sensitive checkbox described without its
  state, and value presence reported without the value) and two on
  `infinite-feed` (`untilStable` loading every post, and the `maxScrolls` cap
  reporting the document still growing). The working hypothesis is that adding
  fixtures changed the pages older specs assert against
- Why (what makes this urgent rather than cosmetic): three of the four
  `sensitive-input` rows are leak assertions. Until the cause is established,
  it is **not** known whether a fixture moved or whether one of the five
  sensitive-text leaks closed earlier in this effort has been reopened. The
  brief above forbids fixing any of them by relaxing the assertion
- Validation: `pnpm --filter @fluxiq-web-extension/extension test:content -- --workers=2`
  → `6 failed`, `261 passed (1.5m)`, exit 1
- Outcome: Open, dispatched as `x5l-harness-fixture-regressions`
- Follow-up: this blocks the downstream commit. `x5j` recommended giving
  `data-table` and `infinite-feed` the enumeration guard `product-catalog` has,
  precisely because its absence let fixtures change with nothing going red — the
  harness going red here is that same gap caught one layer further out

### 2026-09-15 — Staging exposed two violations; one is a real exception
- Agent: supervisor
- Changed: `apps/extension/e2e/content/tests/extraction/inference.spec.ts` moved
  to `.../extraction/tests/inference.spec.ts`; the filter note above
- Why (how they were found): the structure audit reads `git ls-files`, so it
  never saw any of this effort's new files. Staging the repository first — the
  lesson Core's second commit paid for — turned a passing audit into two
  failures, both in new files
- Why (**the import is a genuine exception, not a shortcut**):
  `domain/src/actions/extraction/read-request.ts:23` reaches
  `../../output-nodes/targets` rather than the barrel. The supervisor traced the
  chain rather than trusting the file's own comment, and the comment is right:
  `output-nodes/index` re-exports `./definitions`, `definitions.ts:5` imports
  `webAutomationActionDefinitions` from `../actions/schemas` as a **value**, and
  `schemas.ts:2` imports the extraction barrel as a value, which re-exports
  `read-request`. Importing the barrel would close a runtime cycle. Unlike
  Core's equivalent, where the barrel omission proved accidental and the type
  check showed no cycle, complying here would be strictly worse. This one earns
  a baseline entry, which is what a baseline is **for** — a disclosed,
  justified exception, not a way to silence a finding
- Why (the test placement): `testRootDirNames` is `["tests", "e2e"]` and a test
  file must sit directly inside one, so the new `extraction/` directory failed.
  `e2e/content/tests/` holds exactly 25 files, its hard cap, which is why `x3c`
  created the subdirectory in the first place, and the audit config is mirrored
  from Core and may not be edited here first. Moving the spec one level deeper
  satisfies the rule without touching shared config, and leaves
  `extraction/tests/` with its own 25-file budget for X5-H to split
  `extract-list.spec.ts` and `evidence.spec.ts` into. Playwright still finds it:
  `testDir` is `./content/tests` with no `testMatch`, so the default glob
  recurses
- Validation: recorded with the rerun in the entry above this one
- Outcome: Accepted
- Follow-up: baseline the import **after** the move, so the ratchet absorbs only
  the justified exception and not the placement failure

### 2026-09-15 — X5-K closed the last two failures without relaxing either
- Agent: supervisor; worker `x5k-test-runner-fallout`
- Changed: `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`,
  `packages/test-runner/src/run-expectations/recording-event-types.ts`, and
  `packages/test-runner/src/bench/corpus/week1.ts` (all uncommitted)
- Why (item 1, the one that mattered): the failing test proved a live contract,
  but **no Lab fixture demonstrates it any more** — measured over the built
  registry, 0 of 46 workflows across 25 scenarios is now a no-action workflow,
  because making extraction recordable removed the last example. The brief
  forbade reaching green by relaxing the assertion, and the worker did not: it
  constructed the case through a temporary scenario registry loaded via
  `FLUXIQ_LAB_SCENARIO_ENTRYPOINT`, still driving a real `runScenario`. Every
  original assertion survives, and it **added** one — a cause-message assertion,
  because a constructed fixture could otherwise pass on an unrelated
  `fixture.invalid` — plus a recording-lane control. It then proved the test is
  not green by construction: adding a single click step flips the result from
  `fixture.invalid` with no bundle to `environment.missing` with a staged bundle
- Why (item 2, a comment that caused the drift): the recording event-type mirror
  **can** be derived. The file's own comment claimed test-runner had no domain
  dependency, and that claim was simply false — the package already depends on
  `@fluxiq-web-extension/domain` and eight modules import `domain/node`. That
  false comment is how the row drifted out of date in the first place. Deriving
  it would delete both the table and its mirror test; left as a recommendation
  because it removes a barrel export
- Why (item 3): `week1.ts` now states 67 runnable, 23 recording, 44 flow (23
  unarmed, 21 variants), 0 skipped — taken from the corpus test's own diagnostic
  output rather than from the worker's arithmetic
- Validation: the worker observed
  `pnpm --filter @fluxiq-web-extension/test-runner test` → 860 tests, 860
  passing, 0 failing, exit 0, against a measured baseline of 859 with exactly
  the two named failures; 860 rather than 859 because it added a test. The
  supervisor's own rerun is in the entry above
- Outcome: Accepted
- Follow-up: none for the worker. The derivation recommendation belongs with the
  other mirror-drift findings at the plan review
