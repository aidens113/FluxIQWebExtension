# t344 — Run-4 documentation branch map

Status: **Prepared without opening run-4 artifacts.** Apply exactly one branch only after the run-4 capture, integrity, redaction, and bounded evidence reviews settle.

## Common evidence and debug update

Before either plan changes, resolve a bounded fact sheet: safe run id (if any), closed CLI and artifact verdicts, measurement class, highest completed stage, Flow-created state, exact oracle result, judgement/repair/persistence/replay facts, and separately labelled accounting representations. Missing or unsafe evidence is `NO EVIDENCE:`; null/missing never becomes false or zero.

For `docs/working/language-driven-flow-loop-plan/debugs/pending-t331-run-4.md`:

1. Preserve Stage 1 byte-for-byte. Never revise its hypotheses, oracle, stop rule, or pass threshold from the result.
2. If the capture supplies a safe run id and the destination is unused, rename the pending file to `<run-id>.md` before semantic inspection. If no safe id exists, do not invent one or overwrite another debug; retain the pending identity and record the invalid attempt only from safe command-level facts.
3. Fill the Header's pending fields only from accepted sanitized evidence. Append post-run stages in measured order, separating build/main, runtime, repair, verification, and evaluation accounting unless typed evidence proves disjointness.
4. Record integrity/redaction state and every material `NO EVIDENCE` boundary. Do not claim terminal grant revocation, repair persistence, phase-labelled verification, or deterministic replay without the exact bounded properties.
5. End with the branch-specific disposition below. A malformed, no-id, facility, integrity, or redaction outcome still consumes the single authorized invocation; never silently relaunch.

## Branch A — complete pass

Use this branch only if the finalized integrity-valid bundle meets every t331 threshold: `verdict: passed`, Flow created, exact ordered 13-record oracle and fields passed, reported verdict passed, affirmative result verification, and one replay with zero provider/model/harness calls. If repair occurred, applied and persisted adaptation plus selected-Subflow replay and post-replay judgement are additionally required.

- Debug disposition: accepted passing product measurement. Record only the stages actually exercised; a pass whose first answer was correct does **not** prove self-repair.
- `mvp-today-plan.md` Current State: add/replace with a compact `Live run 4`, accounting/evidence-status, `Next`, and `Blockers` block. Update each of the four criterion rows only with closed evidence. Set streak to **1**. `Next` is one further independent unchanged-profile run of the same scenario; the rung remains open. `Blockers` is the missing second consecutive pass plus any unexercised repair, phase-labelled judgement, or revocation evidence.
- `mvp-today-plan.md` Active Order: replace the completed run-4 launch/inspection items with documentation settlement, second-pass no-hindsight/readiness gates, then exactly one independent same-scenario pass; keep later nine-lane work behind two consecutive passes.
- Loop Current State: attempts **18**, built Flows **12**, pre-Flow failures **6**, latest accepted becomes run 4, streak **1**. Replace the latest-measurement/accounting and proven/next/blockers anchors in place. Do not append a subsection.
- Ledger: append one accepted run-4 pass entry to each plan, with exact run id, inspect/integrity result, highest stage, oracle/verification/replay closure, material gaps, and follow-up for pass two. `Outcome: Accepted` describes both trustworthy measurement and a passing product verdict here.

## Branch B — repeated Stage-2 exhaustion

Use this branch only for an integrity-valid accepted product failure that again stops before proposal with the same Stage-2 family: `flow_bootstrap.evidence_unusable_decision` and `bootstrap.cannot_answer_instruction`.

- Debug disposition: accepted failed product measurement; record the exact safe build accounting and no later-stage evidence. Do not infer semantic rerun identity from counts.
- `mvp-today-plan.md` Current State: make run 4 the latest measurement, streak **0**, and update criterion rows only for anything actually newly proved. `Next` is a fix-before-retry investigation using privacy-safe stable draft/step identity or a deterministic scripted reproduction, followed by a measured source change and validation. `Blockers` names repeated creation non-convergence and every unmeasured later MVP stage.
- Active Order: replace all unchanged-retry language with deterministic diagnosis, evidence-backed fix, narrow-to-full validation, fresh no-hindsight gate, and only then a newly authorized same-scenario measurement. State explicitly: **no run 5 unchanged retry**.
- Loop Current State: attempts **18**, built Flows **11**, pre-Flow failures **7**, latest accepted becomes run 4, streak **0**. Replace the existing latest/accounting/outcome block in place; the hard stop supersedes the current “one controlled retry” next action.
- Ledger: append one accepted failed-measurement entry to each plan, naming the repeated family and hard stop. `Outcome: Accepted failed product measurement`; follow-up is fix-before-retry, not another uncontrolled provider call.

## Branch C — other valid product failure

Use this branch when integrity/redaction are valid and the run closes as a product failure outside Branch B.

- Debug disposition: accepted failed product measurement. Identify the highest completed stage and earliest evidence-backed defect; later stages remain absent or `NO EVIDENCE`.
- `mvp-today-plan.md` Current State: make run 4 latest, keep/reset streak **0**, and update criterion rows only with capability proved before failure. `Next` is full debug, evidence-backed fix when one is identified, affected validation, and a newly authorized same-scenario rerun. `Blockers` names the earliest defect and downstream unmeasured stages. No automatic relaunch follows this one-invocation authorization.
- Active Order: replace launch steps with debug/root-cause, disposition, fix if justified, validation, and fresh authorization. Preserve the same-scenario-before-new-scenario rule.
- Loop counters: attempts **18**. If Flow creation is safely proved, built Flows **12** and pre-Flow failures **6**; if it safely failed before Flow creation, built Flows **11** and pre-Flow failures **7**. Latest accepted becomes run 4 and streak stays **0**. Replace, do not append, the latest/accounting/outcome anchors.
- Ledger: append an accepted failed-product-measurement entry to each plan with exact stage/defect/gaps and the debug/fix/rerun gate.

## Branch D — invalid or inconclusive measurement

Use this branch for malformed/no-id output, facility failure, identity/integrity failure, unsafe redaction, or any outcome whose product result cannot be trusted.

- Debug disposition: not an accepted product measurement. Record only safe facts from the layer that closed; all unavailable bundle facts are `NO EVIDENCE`. Do not use artifact presence to infer stage, Flow creation, or counters.
- `mvp-today-plan.md` Current State: retain run 3 as latest accepted product measurement and streak **0**. Add a compact run-4 attempt sentence naming only the safe measurement failure. `Next`/`Blockers` require restoring trustworthy capture/facility/integrity/redaction and obtaining a fresh explicit disposition; the consumed one-run authorization does not permit automatic retry.
- Active Order: measurement-system diagnosis and trustworthy-evidence restoration first, then a new authorization decision. Do not schedule a product fix from an invalid result.
- Loop Current State: retain run 3 as latest accepted and streak **0**. If the invocation itself is safely established, attempts become **18**, but do not change the 11-built/6-pre-Flow split without trustworthy Flow-state evidence; state that the unaccepted attempt is excluded from that split. If even invocation identity is unsafe, leave counters unchanged and state the accounting gap in the ledger.
- Ledger: append `Outcome: Partial — not an acceptable product measurement`, the exact safe failure, and the evidence-restoration/new-disposition follow-up. Never label it Accepted.

## Exact anchor and line-budget discipline

In `mvp-today-plan.md`, edit the four criterion rows, the `Live run 3`/accounting area by adding or folding a compact run-4 latest block, `Next`, `Blockers`, `Active Order Of Work`, and append one ledger entry immediately before `Open Questions`. Preserve run 2/run 3 as historical evidence and keep authorized ceilings distinct from spend.

The loop plan's Current State is currently **146 lines including its closing separator**, leaving only **3 lines** below the 150-line limit. Therefore:

- replace the `Where rung 1 actually is` paragraph in place;
- replace the `Latest accepted rung-1 measurement` plus accounting paragraphs in place;
- replace `What is proven working, live` through `Blockers` as one compact block;
- do **not** append a run-4 Current State subsection;
- if a replacement grows, compact superseded run-3 wording into a pointer to its existing debug/ledger before adding new lines;
- recount and require Current State at most 149 lines. The whole loop plan is 720 lines and its ledger has five entries, so ordinary run-4 ledger addition does not trigger the 800-line/20-entry archive thresholds.

For every branch, preserve the historic ten-row table and prior ledger entries. Regenerate/check the working-document index only after the debug and both plans settle; that action is outside this report.

## Scope

I read only t321, t324, t327, t331 and the current plan anchors. I did not open run-4 artifacts or `test-runs`, run tests/builds/live/provider/browser commands, edit either shared plan/debug/index, or commit. This report is the only file written.
