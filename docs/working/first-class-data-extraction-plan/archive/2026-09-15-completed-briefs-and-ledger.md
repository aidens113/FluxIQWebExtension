# First-Class Data Extraction Plan: archive

Superseded detail moved from [the plan](../../first-class-data-extraction-plan.md)
on 2026-09-15 to keep it under the 800-line compaction threshold: completed
worker briefs and earlier ledger entries. Their results are folded into that
document's Decisions, Design, and Execution partition.

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

## Work Ledger

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
