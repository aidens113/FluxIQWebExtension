# Audit briefs — dispatched 2026-09-11

Archived from the working document after all seven audits completed. Reports are under `../reports/`.

## Worker Briefs

All seven briefs share these rules: the task is read-only investigation;
every claim in the report cites a `path:line` or exported symbol; the report
follows the protocol report format; run only read-only commands (listing,
`--help`, grep, existing `dist` CLIs with list/inspect verbs). Do not run
`pnpm build`, the Testing Lab, or anything that starts a browser or the panel.

### Brief: audit-actions
- Repository: this repository
- Task: Produce the Phase 1.1/1.2 browser capability matrix. For each of the 24
  capabilities listed in the 30-day plan Phase 1.2 (Navigate, Click, Type text,
  Clear text, Keyboard input, Select/dropdown, Scroll, Wait, Extract text,
  Extract attributes, Structured extraction, Repeating/list elements,
  Pagination, Open tab, Switch tab, Close tab, Downloads, Basic file uploads,
  Form interaction, Dynamic elements, Modal/dialog interaction, URL checks,
  Element existence checks, Element nonexistence checks) record: how it is
  represented (action contract / output node / input name), where it executes
  in the extension (file:symbol), what browser state is observed after it, how
  its outcome is validated, and a classification of Fully supported /
  Partially supported / Unsupported / Unreliable with a one-line reason. Also
  list every action that exists but is not in that list, and any API that
  looks dead or superseded (unreferenced exports, `legacy`/`deprecated`
  markers, parallel implementations of one concept).
- Required reads: this document's Current State; `domain/src/actions/`,
  `domain/src/output-nodes/`, `domain/src/io/`, `domain/src/client/`,
  `apps/extension/src/runtime/`, `apps/extension/src/shared/`, and the
  action-execution files in `apps/extension/src/content/` (skip snapshot and
  evidence files; another worker owns them);
  `docs/architecture/extension-client.md`.
- Owns (may edit): the report file only.
- Must not touch: any source file; this working document.
- Definition of done: report contains the 24-row matrix, the extra-actions
  list, the dead/superseded list, and a "top five gaps for Week 1" section
  ranked by how much of the FluxBench category list each gap blocks.
- Report to: docs/working/mvp-week1-web-automation-reliability-plan/reports/audit-actions.md

### Brief: audit-recording
- Repository: this repository (grep-only in Core)
- Task: Verify Phase 1.1 step 3 — that recorded user actions map to executable
  outputs. Produce a table: recording event type → domain input → registered
  output / output node → executable (yes/no) → test coverage. Identify events
  that are captured but never mapped, mappings that exist without a capturing
  event, and any mapping that turns a passive/state input into an executable
  action (a boundary rule violation). Describe, with file:symbol, the full
  path Browser Event → Extension → Domain Input → Recording → Generated Node →
  Runtime Output → Browser Action. For the Core side, locate by grep only the
  entry point that turns a recording into a deterministic Subflow (the
  "Generate deterministic Subflow" path) and report its file path and the
  downstream contract it consumes; do not read Core broadly.
- Required reads: this document's Current State; `domain/src/recording/`,
  `domain/src/client/`, `domain/src/io/`, the recording-state files in
  `apps/extension/src/background/`, the recording-capture files in
  `apps/extension/src/content/`; `docs/architecture/extension-client.md`.
- Owns (may edit): the report file only.
- Must not touch: any source file; this working document.
- Definition of done: report contains the mapping table, the unmapped /
  orphaned / boundary-violation lists, the end-to-end path with symbols, and
  the Core entry-point location.
- Report to: docs/working/mvp-week1-web-automation-reliability-plan/reports/audit-recording.md

### Brief: audit-targeting
- Repository: this repository and FluxIQ Core (read-only)
- Task: Establish the current element-identity model for Phase 1.3. Report:
  (a) every piece of target evidence captured today, against the plan's list
  (stable selector, DOM id, role, accessible name, visible text, href,
  attributes, nearby label, parent/child, structural context, form context,
  previously observed evidence, historical identity) as present / partial /
  absent with file:symbol; (b) how a target is resolved at execution time —
  the ordered strategies, what counts as a match, what happens on zero and on
  multiple matches, and whether any fuzzy/evidence-weighted resolution exists;
  (c) which layer owns resolution (extension content script, domain, Core) and
  where Level 1 (exact) / Level 2 (evidence-based) / Level 3 (harness) of the
  plan's pipeline would live; (d) existing tests that exercise resolution;
  (e) the drift cases the Scenario Lab already has (`ambiguous-targets`,
  `llm-target-drift`) and what they prove.
- Required reads: this document's Current State; target/fingerprint files in
  `apps/extension/src/content/` (grep `target`, `fingerprint`, `resolve`,
  `locate`); `domain/src` files referencing `WebAutomationActionVisualTarget`
  or `fingerprint`; the `Current State` sections only of Core
  `docs/working/automation-studio-element-target-fingerprints-plan.md` and
  `docs/working/action-visual-entity-target-plan.md`; Core code only by grep
  for the fingerprint/target contract types those documents name.
- Owns (may edit): the report file only.
- Must not touch: any source file; this working document.
- Definition of done: sections (a)–(e) present; a closing "what Level 2 needs
  that does not exist" list.
- Report to: docs/working/mvp-week1-web-automation-reliability-plan/reports/audit-targeting.md

### Brief: audit-evidence
- Repository: this repository and FluxIQ Core (read-only)
- Task: Establish the current browser state/evidence model for Phase 1.4.
  Report, for each of the plan's 16 evidence items (interactive elements,
  visible text, forms, current URL, page title, navigation state,
  dialogs/modals, relevant page regions, repeating structures, selected
  elements, recently interacted elements, changed elements, relevant
  attributes, loading state, blocking overlays, expected-state evidence):
  present / partial / absent, the producing file:symbol, the consuming side
  (deterministic comparison, harness/LLM prompt, UI, or nothing), and any
  size cap. Describe the snapshot pipeline end to end: capture in the content
  script → wire message → domain state conversion → Core state/evidence
  contract, naming the DTO types at each hop. Report the `web-llm-evidence.v1`
  sanitization and its 12 KB / 40-element cap, and the snapshot filter that
  retains empty identified controls. State how "expected state" is
  represented and compared today for a node's output.
- Required reads: this document's Current State; snapshot/evidence files in
  `apps/extension/src/content/`; `domain/src/recording/` (web state
  conversion); `domain/src/runtime/reusable-evidence.ts`; grep
  `web-llm-evidence` across `domain/src`; Core `packages/contracts/src` by
  grep for `evidence`/`state` DTOs; Core
  `docs/working/node-state-evidence-view-plan.md` Current State only.
- Owns (may edit): the report file only.
- Must not touch: any source file; this working document.
- Definition of done: the 16-row table, the pipeline description with DTO
  names, the expected-state section, and a "compactness" note giving the
  current byte size of a representative snapshot if a fixture or test
  reveals it.
- Report to: docs/working/mvp-week1-web-automation-reliability-plan/reports/audit-evidence.md

### Brief: audit-failures
- Repository: this repository and FluxIQ Core (read-only)
- Task: Establish the current failure model for Phase 1.5. Report how an
  action or node failure is represented at each layer — extension action
  result → wire message → domain runtime trace/attempt → Core run/attempt
  record → harness intervention DTO / UI — naming types and file:symbol at
  each hop. Map every existing failure kind, code, or category (both
  repositories) onto the plan's 11 categories (TARGET_NOT_FOUND,
  TARGET_AMBIGUOUS, STATE_MISMATCH, NAVIGATION_UNEXPECTED,
  OUTPUT_NOT_OBSERVED, ACTION_REJECTED, TIMEOUT, PAGE_CHANGED, AUTH_REQUIRED,
  USER_INTERVENTION_REQUIRED, UNKNOWN); mark categories with no producer.
  For the plan's 13 capture-with-failure items (current node, subflow,
  expected state, actual state, previous state, failed action, failed target,
  URL, recent events, retry history, browser evidence, timing, previous
  adaptations) mark present / partial / absent and where. Report the
  `failureEvidence` packet (3,000-byte ceiling) and the closed
  stage-indexed reason taxonomy named in `llm-production-automation-plan.md`.
  Recommend, with reasons, which part of the taxonomy is domain-neutral
  (Core) and which is browser-specific (domain).
- Required reads: this document's Current State; `apps/extension/src/shared/`
  and `apps/extension/src/runtime/` result types; `domain/src/runtime/`
  (traces, failure, failureEvidence); `packages/test-runner/src/failure.ts`;
  Core `packages/contracts/src` and `packages/fluxiq/src/runtime` by grep
  for failure/attempt/intervention types; Core
  `docs/architecture/runtime-kernel.md`.
- Owns (may edit): the report file only.
- Must not touch: any source file; this working document.
- Definition of done: the layer table, the 11-category mapping, the 13-item
  capture table, and the ownership recommendation.
- Report to: docs/working/mvp-week1-web-automation-reliability-plan/reports/audit-failures.md

### Brief: audit-testing-facility
- Repository: this repository
- Task: Describe the Testing Lab precisely enough that a later worker can add
  a scenario and a benchmark lane from the report alone. Report: (a) for each
  of the 12 scenarios under `apps/scenario-lab/src/scenarios/`, its purpose,
  fixture pages, state-store behaviour, registered oracle/final-state
  predicate, and which of the plan's 18 FluxBench categories (simple
  extraction, paginated extraction, table extraction, search, multi-page
  navigation, forms, dynamic interfaces, modals, infinite scrolling,
  downloads, multiple tabs, conditional behavior, authentication-compatible,
  changed selectors, changed text, moved elements, unexpected popup,
  unexpected intermediate state) it covers; produce the coverage matrix and
  the uncovered list; (b) the exact files touched to add a scenario, and the
  contract in `packages/test-contracts/src/scenario.ts`; (c) how a run
  executes: `run`, `matrix`, `inspect`, `compare`, `interactive` verbs, the
  topology targets, what each asserts, and where results and evidence land;
  (d) what evaluation/metric contracts exist (`evaluation.ts`, `run.ts`,
  `test-matrix`, `test-evidence` report) and whether any repeat-run
  aggregation or comparison across runs exists; (e) how a scenario drives the
  extension — the Playwright fixture, how actions are issued
  (`execute-client-action`, persisted Flow, recording), and whether a scenario
  can run a Flow provider-free end to end; (f) exact commands, build
  prerequisites, and which lanes are headless-capable versus Windows-headed.
- Required reads: this document's Current State;
  `docs/architecture/testing-facility.md`; `apps/scenario-lab/src/`
  (registry, server, state-store, each scenario's index);
  `packages/test-contracts/src/scenario.ts`, `evaluation.ts`, `run.ts`;
  `packages/test-runner/src/` cli, run-scenario, scenarios,
  scenario-assertions, interactive-session, inspect, commands, coordinator;
  `packages/test-matrix/src/`; `packages/test-evidence/src/report.ts`;
  `apps/extension/e2e/`. Read `packages/test-runner/src/demo-*` only by
  listing and one-line purpose.
- Owns (may edit): the report file only.
- Must not touch: any source file; this working document.
- Definition of done: sections (a)–(f) with the coverage matrix, plus a
  closing "what FluxBench needs that the facility lacks" list.
- Report to: docs/working/mvp-week1-web-automation-reliability-plan/reports/audit-testing-facility.md

### Brief: audit-core-runtime
- Repository: FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: Establish what Core already provides for Week 1 and what it lacks.
  Read Core's `AGENTS.md` first. Report: (a) the runtime contracts a domain
  plugs into — action attempt, output node execution, state/evidence
  provider, expected-state validation, target identity, node/subflow/router
  context — with file:symbol; (b) the adaptation lifecycle entry points and
  the harness context contract (what a domain must supply for Week 2 to
  consume); (c) which Week 1 needs already have a generic Core seam, and
  which would need one (a failure category enum, a target-resolution
  outcome, an evidence DTO), each with a one-line ownership judgement;
  (d) functionality duplicated between Core and this repository (grep both
  for parallel implementations of snapshot, fingerprint, evidence,
  selector, and failure concepts), and (e) dead or superseded APIs in either
  repository that touch the MVP loop (grep `deprecated`, `legacy`,
  `TODO(remove`, unreferenced exports in `domain/src` and
  `apps/extension/src`).
- Required reads: this document's Current State; Core `AGENTS.md`,
  `docs/architecture/current-system.md`, `runtime-kernel.md`,
  `package-boundaries.md`, `automation-studio-native-nodes.md`; the
  `Current State` sections only of Core `docs/working/runtime-kernel-plan.md`,
  `adaptive-flow-training-roadmap.md`,
  `llm-assisted-deterministic-automation-expansion-plan.md`,
  `recording-proposal-generator-plan.md`; Core source by grep from those
  documents' named types outward, not by directory walk.
- Owns (may edit): the report file only.
- Must not touch: any source file in either repository; this working document.
- Definition of done: sections (a)–(e); every "needs a Core seam" item has a
  proposed owning package and a compatibility note.
- Report to: docs/working/mvp-week1-web-automation-reliability-plan/reports/audit-core-runtime.md

