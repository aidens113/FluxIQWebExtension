# First-Class Data Extraction Plan

Status: Active
Status detail: Planning; four read-only investigations are running before the phased plan is written.
Created: 2026-09-15
Last updated: 2026-09-15
Owner: Senior supervisor agent
Scope: Make structured data extraction a fundamental FluxIQ capability: Core owns generic datasets (schema, per-run persistence, preview, CSV/JSON export, iteration) and their UI; the web domain and extension own DOM extraction, element picking, repeating-structure and field detection, and pagination; extraction is recordable and compiles to ordinary Flow nodes; the Testing Lab measures FluxIQ's own extraction.
Paired document: `F:\!FluxIQ\docs\working\first-class-data-extraction-plan.md`
Related: [30-Day MVP plan](../../FluxIQ%20Web%20Extension%20%E2%80%94%2030-Day%20MVP%20Implementation%20Plan.md), [Week 1 plan](./mvp-week1-web-automation-reliability-plan.md), [LLM production automation plan](./llm-production-automation-plan.md), [web capabilities](../architecture/web-capabilities.md), [testing facility](../architecture/testing-facility.md)

---

## Current State

**Phase, as of 2026-09-15: planning.** The user decided that structured data
extraction is a fundamental part of FluxIQ, including Core, and asked for this
plan to be written quickly using subagents. Four read-only investigations are
running (see [Worker Briefs](#worker-briefs)); the phased plan is written from
their reports.

**What is true today** (supervisor reads, 2026-09-15):
- The extension executes `web.dom.extract` (one element) and
  `web.dom.extract_list` (item selector, field map, optional Next-button
  pagination capped at 50 pages). The web domain registers both as output nodes.
- Extracted records return inside the action result `extracted` and are visible
  only in Core's run detail for that attempt.
- The recorder captures no extraction intent, so recordings never produce an
  extract node. Core has no dataset concept, preview, export, or iteration over
  records, and there is no extraction UI.
- The Week 1 benchmark judged extraction only on the recording lane, through the
  runner's own Playwright reads; the Flow lane marks it `not_applicable`, and
  W04 and W08 have no Flow lane.
- The MVP plan schedules "First-Class Scraping UX" for Week 3, Phase 3.7.

**Decision:** build the extraction foundation at the start of Week 2, since
self-healing can only repair extraction once it is a real Flow capability, and
keep the full "Extract Data From This Page" experience for Week 3 on top of it.

**Next steps:** read the four reports, write the phases, design and validation
plan, edit the existing documents they name, regenerate both indexes, commit, and
push `dev` in both repositories.

**Blockers:** none.

---

## Objective

FluxIQ turns any page's structured content into a reusable, repairable dataset:
a user can show or tell FluxIQ what to extract, see the records, export them, and
run the same extraction again deterministically. Phase 3.7's product
requirements apply: an "Extract Data From This Page" entry point; select an
example element; detect repeating structures; infer, add, remove, and rename
fields; text, attribute, and link extraction; current page or all pages;
pagination and practical infinite scrolling; structured preview; CSV and JSON.
The hard requirement is that a scraper compiles into ordinary Flows and Subflows,
so runtime adaptation can repair it like any other automation.

Ownership follows `AGENTS.md`: domain-neutral dataset contracts, persistence,
preview, export, iteration, and their UI belong in FluxIQ Core; selectors, DOM
reading, element picking, repeating-structure detection, field inference, and
page pagination belong in this repository.

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

## Work Ledger

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

- Whether the extraction foundation runs before, or interleaved with, Week 2's
  self-healing phases 2.1-2.9. Owner: supervisor, decided when the plan is
  written.
