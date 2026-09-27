# t264 — Post-gate documentation integration audit

Status: **Complete audit; integration remains conditional because no final t258 report existed at review time**

## Decision boundary

Run 2 remains the latest accepted live measurement and the pass streak remains **0**. The local
post-run-2 correction chain must not be described as live-proven. At review time there was no
`t258...md` final report, so the accepted t258 ledger entry, final validation wording, pending
run-3 debug, and provider run remain **NO-GO**. Apply the map below only after t258 is final and
green and the independent integrated review has no unresolved finding. If a t258 gate fails, retain
the current live-evidence statements, record `Outcome: Partial`, name the failed gate, and keep run
3 at NO-GO.

The t261 snapshot is historical: it found a free Lab slot, but stale Core outputs and absent final
implementation/review evidence. Do not copy its timestamps or provisional freshness result into
either active plan as current state. Re-run those gates on the settled tree. T262 is preparation for
the future pending debug, not evidence for either plan.

## Exact integration map — `mvp-today-plan.md`

1. **Header.** Replace `Status detail` because it still says the next work is t229's boundary fix.
   Use: `Run 2 remains the latest accepted live failure and the pass streak is 0; the post-run-2
   repair/continuation/replay chain is locally corrected subject to final gates, and run 3 is the
   next live measurement.` Do not change the status from `Active`.
2. **Current State.** After **t217 correction**, insert t260's two-paragraph
   **Post-run-2 fixes, locally proven only** block verbatim, but only after the final t258 report
   supports every claimed success and failure-path result. This is the smallest addition that
   distinguishes local composition evidence from run 2's live evidence.
3. **Next / Blockers.** Replace the existing `Next` and `Blockers` paragraphs with t260's copy-ready
   replacements. Keep the four-row MVP table, run-1/run-2 descriptions, run-2 accounting, t217
   measurement caveat, and run-2 evidence-status paragraph unchanged.
4. **Active Order Of Work.** Replace stale items 1 and 2 (which still ask to complete run 2's
   Stage 1 and then repeat the scenario) with:
   1. `Finish the final t255/t258-tree validation, independent review, ordered build/freshness,
      downstream compatibility, one-Lab, and zero-provider readiness gates.`
   2. `Create run 3's no-hindsight pending debug, then run the unchanged default-profile hard
      scenario exactly once and inspect its finalized bundle.`
   Leave items 3–6 unchanged.
5. **Ledger.** Append t260's complete t255 entry now or with the same integration edit. Append its
   t258 entry only after the final report exists. Replace the bracketed validation clause with the
   final report's exact commands/counts/results; do not infer them from the provisional 2/2 result.
   `Outcome: Accepted` is permitted only if every stated final-tree gate passed.

Do not paste t249's command matrix, t261's snapshot, or t262's Stage 1 into this plan. The plan
needs the gate requirement and evidence boundary, while those reports retain operational detail.

## Exact integration map — `language-driven-flow-loop-plan.md`

1. Leave the header's `Status detail` unchanged: it explicitly describes the latest accepted live
   run and remains true. Do not rewrite the sixteen-attempt table or earlier historical findings.
2. After the **Latest accepted rung-1 measurement** paragraph and its accounting paragraph, insert
   t260's two-paragraph **The run-2 repair chain is now locally closed, not live-proven** block
   verbatim, conditional on the final t258 report.
3. Replace **The next action** and **Blockers** with t260's copy-ready replacements. Preserve the
   `What is proven working, live` paragraph because it accurately limits live proof to playback,
   exact comparison, judgement, and recovery routing.
4. Append one concise ledger entry after the run-2 entry, only when t258 is final:

```markdown
### 2026-09-26 — The run-2 repair chain closed in local composition
- Agent: supervisor, with workers on t233 to t260
- Changed: truthful request provenance, selected-Subflow repair replay, same-grant post-apply continuation, runtime-owned continuation/replay wiring, focused tests, and both plans' current state
- Why: Carry a refuted result through durable authorized repair, provider-free selected-Subflow replay, recursive judgement, and terminal grant revocation without widening authority or accounting.
- Validation: [COPY THE FINAL t258 FOCUSED/PACKAGE/ROOT TEST, CHECK, BUILD, AND DIFF-CHECK RESULTS; retain t255's 9/9 and 45/45 continuation/grant results]. This is local evidence, not a provider-backed pass.
- Outcome: Accepted
- Follow-up: execute the unchanged default-profile run 3 after the serial readiness gates; the pass streak remains 0 until live evidence changes it.
```

If final t258 validation is not wholly green, change the entry to `Outcome: Partial`, record only
observed results, and do not insert the locally-closed Current State block.

## Line-budget projection

Before integration, `mvp-today-plan.md` is 479 lines and its Current State is 64 lines (heading
through the line before the separator). T260's Current State insertion plus its `Next`/`Blockers`
replacements projects approximately **86 Current State lines**; the header, two Active Order
replacements, and two ledger entries keep the document well below **800 lines**.

Before integration, `language-driven-flow-loop-plan.md` is 694 lines and its Current State is 135
lines. The t260 insertion and the two replacements project **149 Current State lines**, leaving
only one line below the 150-line budget. The proposed ledger entry keeps the whole document below
800 lines. Do not add t261/t262 detail or a second local-fix summary to this Current State; any
additional current-state line requires compaction elsewhere first.

## Contradictions and duplication to avoid

- Do not say the repair was applied, persisted, replayed, or re-judged **live**; those remain run-3
  measurement requirements.
- Do not alter run 2's failed verdict, accounting representations, or zero-pass streak.
- Do not call t217 measured live or combine run 2's overlapping accounting representations.
- Do not imply the focused fixture's `maxCalls: 4` changed the production default of 26.
- Do not imply the continuation mints/replaces a grant, resets accounting/reveal/deadline state, or
  broadens purpose, scope, capabilities, permissions, consequence, retry, or budget policy.
- Do not report t261's free-Lab observation as a reservation or its downstream freshness as final;
  both require repeat checks after the settled Core build.
- Do not duplicate t262's instruction, oracle, failure checklist, exact live command, or sanitized
  evidence rules in Current State. They belong in the pending debug and preflight reports.
- Do not append separate t233, t239, t243, and t246 Current State summaries: t260's compact chain
  already covers them and the language plan has no line budget for repetition.

No shared plan, source, generated output, run artifact, provider/browser/Lab state, commit, or push
was changed by this audit.
