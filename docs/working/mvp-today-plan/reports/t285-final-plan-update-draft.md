# t285 Final Plan Update Draft

Status: Copy-ready report only
Evidence basis: t258, t279, and t281–t284
Live boundary: **unchanged** — run 2 is the latest accepted measurement and the pass streak is 0.

## Required documentation repairs before validation resumes

These are t284's current structure-audit blockers and should be repaired separately from the state
updates below:

1. In `mvp-today-plan.md`, replace the directory-only worker-report link with a concrete target:

   ```md
   Related: [language-driven-flow-loop-plan.md](./language-driven-flow-loop-plan.md), [archived coordination](./mvp-today-plan/archive/2026-09-26-pre-run-and-run1-coordination.md), [final implementation report](./mvp-today-plan/reports/t258-grant-continuation-wiring.md)
   ```

2. In the archived coordination document, change the three sibling-plan targets from `./...` to
   `../../language-driven-flow-loop-plan.md`, `../../flow-authoring-and-defensive-runtime-plan.md`,
   and `../../fluxiq-conversations-plan.md`.
3. Regenerate `docs/working/README.md` through its owning working-document index workflow; do not
   hand-edit generated index content.

## `mvp-today-plan.md` Current State replacements

Keep the purpose, MVP criteria table, both live-run sections, accounting, t217 correction, and
run-2 evidence status unchanged. They are the live evidence boundary.

Replace the current `**Implemented.**` and `**Local validation.**` paragraphs with:

```md
**Implemented locally after run 2.** Core now separates setup from provider-request provenance,
retains the exact run-owned grant only for the private nested reauthor call, durably applies an
approved repair, continues that held grant against the authoritative applied binding, replays the
selected Subflow without a provider call, and recursively judges the replay. Public generation
cannot retain the grant. Post-apply binding or continuation failures remain truthfully
`applied:true`, close replay with `replayReady:false`, expose fixed typed provenance, and do not
publish raw errors.

**Final-tree Core validation.** The t258 focused set passed 135/135 across ten files; Core root
check, root build, structure audit, and diff check passed, and runtime/web outputs were newer than
the final production inputs. Independent reviews found the retention, privacy, internal ownership,
and package-export boundaries sound. The final-tree root `pnpm test` remains the minimum missing
Core test gate; it subsumes t270's entire 15-file matrix. Run the correctly targeted
`pnpm --filter fluxiq check` as the remaining literal direct-package gate.

**Downstream pre-live validation.** All six downstream owners rebuilt successfully against final
Core. Root `pnpm check` again stopped only at this machine's known `git worktree add` Exec-format
fixture boundary. The substitute structure tests passed 182/182 and Lab tests passed 96 with one
skip, but structure audit then found four broken documentation links and a stale generated working-
document index. Recursive package checks and rebuilt-output freshness were not reached.
```

Replace `**Next.**` and `**Blockers.**` with:

```md
**Next.** Repair the four documentation links, regenerate the working-document index, then rerun
structure audit, recursive downstream package checks, and strict rebuilt-output freshness. Run the
remaining Core root test and exact direct package check, refresh the settled-tree identity, repeat
the one-Lab gate, and run the unchanged zero-provider readiness command. Only then create the no-
hindsight pending debug and repeat the default-profile live scenario. A pass begins the streak at
one; another independent pass is still required.

**Blockers.** No known implementation defect remains from run 2, but the live gate is closed by
validation: authored-document structure failures, pending downstream package/freshness proof,
pending final-tree Core root test/direct check, and the provider-free readiness gate. The task-
fixture worktree spawn failure remains an environment limitation. The repaired path is not live-
proven; run 2 remains a failed product measurement and the streak remains 0.
```

Projected `Current State` length after these replacements: 78 lines, below the
150-line limit (current measured length: 66).

Append this ledger entry before `Open Questions`:

```md
### 2026-09-26 — Run-2 repair path closed locally; pre-live validation remains open
- Agent: supervisor with t233–t285
- Changed: Core failure provenance, exact grant retention/continuation, repair replay and verification wiring, privacy regressions, internal module ownership, downstream rebuilt outputs, and evidence reports
- Why: Carry run 2's correct refutation through durable repair and provider-free replay without widening authority or exposing raw failures.
- Validation: final Core focused set 135/135; Core root check/build and structure passed; independent retention/privacy/export reviews -> GO; all six downstream builds passed; substitute structure tests 182/182 and Lab tests 96 passed with one skip; downstream structure audit -> failed on four authored-document links plus stale generated index, so recursive checks/freshness and dry/live gates were not reached.
- Outcome: Accepted
- Follow-up: repair authored docs/index, close Core root-test/direct-check and downstream package/freshness gates, run zero-provider readiness, then repeat the unchanged default-profile live scenario; streak remains 0.
```

## `language-driven-flow-loop-plan.md` Current State replacements

Do not change the attempt count, run table, latest accepted measurement, accounting, run IDs, or
the statement that repair persistence/replay are not proven live.

Replace `**What is proven working, live, that this document once recorded as broken.**` through the
current `**Blockers:**` paragraph with:

```md
**What is proven working, live, that this document once recorded as broken.** Multi-node created
Flows can reach playback, exact extraction comparison, and model-backed self-judgement; run 2's
five-node Flow returned a measurable 12-of-13 result and the judge refuted it rather than reporting
success. Wrong-answer recovery and reauthoring route, but no current run proves repair persistence
or deterministic replay. The gate is open; the full self-repair cycle remains unproven.

**What is implemented but not live-proven.** The final local Core path now retains only the exact
run-owned grant for nested reauthoring, durably applies the approved repair, continues the same held
grant against the applied binding, replays the selected Subflow without a provider call, and judges
the replay. Closed post-apply failures preserve applied state without replay or raw error leakage.
Focused 135/135 plus Core check/build passed; this changes no live result or streak.

**The next action** is to repair the four authored-document links and generated working-document
index, close the remaining Core root-test/direct-check and downstream package/freshness gates, then
run the unchanged zero-provider readiness check. After the no-hindsight pending debug exists and the
one-Lab gate is clear, repeat `everything-store-plus-earbuds-under-50` under the default 26-call
profile. Debug it before another provider call. A pass starts the streak at one; leave the rung only
after two consecutive independent passes.

**Blockers:** the live gate is closed by validation, not by a newly identified implementation
defect: four documentation-link failures, a stale generated working-document index, pending
downstream recursive checks/freshness, the final-tree Core root test/direct check, and provider-free
readiness. The worktree spawn limitation remains operational. Run 2 is still the latest accepted
failed measurement and the consecutive-pass streak remains 0.
```

Projected `Current State` length after this replacement: approximately 147 lines, below the
150-line limit (current measured length: 137). Keep the wrapping above when applying it.

Append this ledger entry before `Open Questions`:

```md
### 2026-09-26 — Run-2 repair completed locally; the live loop remains at streak zero
- Agent: supervisor with t233 to t285
- Changed: Core repair/continuation/replay wiring, final regressions and reviews, downstream rebuilt outputs, and pre-live evidence reports
- Why: Correct the Stage-6 reauthor failure without turning local implementation proof into live success evidence.
- Validation: Core focused 135/135 and root check/build passed; independent retention/privacy/export reviews returned GO; six downstream builds passed; substitute structure tests 182/182 and Lab tests 96 passed with one skip; downstream structure audit failed on four documentation links and a stale generated index, so package/freshness/dry/live gates remain pending.
- Outcome: Accepted
- Follow-up: repair documentation structure, close remaining serial gates, then repeat rung 1 under the unchanged default profile; run 2 remains latest and streak remains 0.
```

## Truthfulness constraints for application

- Do not change sixteen attempts, eleven built Flows, five pre-Flow failures, either run ID, or the
  run-2 accounting representations.
- Do not claim a repaired Flow, persistence, provider-free replay, or recursive fourth judgement as
  live evidence; those are locally tested implementation behaviors only.
- Do not call downstream validation green: builds are green, but authored-document structure is red
  and recursive checks/freshness were not reached.
- Do not call the root task-fixture failure a product defect; keep it separate from t284's real
  authored-document failure.
- Do not advance the consecutive-pass streak from 0.
