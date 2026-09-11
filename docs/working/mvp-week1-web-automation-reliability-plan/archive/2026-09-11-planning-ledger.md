# Planning ledger — 2026-09-11

Ledger entries from the planning phase of the
[MVP Week 1 plan](../../mvp-week1-web-automation-reliability-plan.md), moved
here verbatim when Wave 1 was dispatched, to keep the plan under the
800-line compaction threshold. Their outcomes are folded into the plan's
`Current State` and `Decisions`.

### 2026-09-11 — Document created; audit workers dispatched
- Agent: supervisor
- Changed: this document; `docs/working/README.md` (index row);
  `docs/working/mvp-week1-web-automation-reliability-plan/reports/` created.
- Why: The user asked for an in-depth Week 1 working document that improves
  on the 30-day plan, fills its gaps from both repositories, and emphasises
  automated testing through the Testing Lab. Discovery across seven areas is
  delegated so the supervisor reads conclusions, not files.
- Validation: not validated — documentation only.
- Outcome: Accepted
- Follow-up: verify reports, write the executable phase plan.

### 2026-09-11 — Audits verified; executable plan written
- Agent: supervisor, with workers audit-actions, audit-recording,
  audit-targeting, audit-evidence, audit-failures, audit-testing-facility,
  audit-core-runtime
- Changed: this document (rewritten: decisions, proof method, phase plan,
  metrics, corpus, sequencing, audit summary); audit briefs moved to
  `archive/2026-09-11-audit-briefs.md`; seven reports under `reports/`.
- Why: The plan must be concrete enough for workers to execute without
  rediscovering the architecture, and every claim it rests on must be
  verified, not reported.
- Validation: supervisor re-read the cited source for every load-bearing
  claim — e.g. `expectation.ts:31-36` returns `passed: true`
  unconditionally; `adapter.ts:54` flattens status; `readElementValue` has
  no sensitivity guard and `capture-settings.ts:8` defaults `inputValues`
  to `true`; `io-policy.ts` returns `unresolved_no_candidates` with no
  downstream producer of `candidates`; `run-scenario.ts:358` asserts only
  `finalState`; `selector.ts` catalog lists 10 of 12. `node
  scripts/structure-audit.mjs` -> `passed (27 warning(s), 19 baselined)`.
- Outcome: Accepted
- Follow-up: fold in `audit-core-runtime`; dispatch Wave 1.

### 2026-09-11 — User decisions on Core scope and corpus
- Agent: supervisor
- Changed: this document — D9 and D10 added; Phase 1.4 step 7 (Core seam
  C3) and its proof added; paired Core document moved to Wave 3 dispatch;
  Phase 1.5 step 2 marks the minor bump accepted; corpus marked confirmed;
  sequencing and risks updated; three open questions closed.
- Why: The user, asked the three open questions, chose the recommended
  option for each: take the Core minor bump this week alongside D3; build
  the expectation-evaluator seam in Week 1 with Phase 1.4; accept the
  28-workflow corpus as proposed.
- Validation: `node scripts/structure-audit.mjs` after the edits —
  observed output recorded in the commit; documentation only.
- Outcome: Accepted
- Follow-up: dispatch Wave 1.
