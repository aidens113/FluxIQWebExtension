# Report: t404-working-docs-link-re-review

## Outcome

**NO-GO** for final working-document closure. Broken-link, paired-header, generated-index, and
Current State size remediation pass. The active plans and the t401 ledger draft still need a narrow
next-gate refresh: the post-timeout final Core check is pending, while the downstream test is active.

## Findings

- **GO — t401 report links:** all nine unique relative report targets resolve from
  `docs/working/mvp-today-plan/reports/`: t379, t385, t388, t393, t394, t395, t397, t399, and t400.
  No broken Markdown target remains in the t401 draft.
- **GO — paired headers:** `mvp-today-plan.md` and `language-driven-flow-loop-plan.md` are both
  `Status: Active` and each says exactly `Paired document: none`.
- **GO — generated README currentness:** the active rows in `docs/working/README.md` show `none`
  for both plans and show 310 and 706 lines respectively, matching the files observed in this
  review. Their document links resolve to the reviewed plans.
- **GO — Current State limits:** MVP spans lines 14–132, 119 lines including the heading and final
  separator. Language-driven flow loop spans lines 14–138, 125 lines on the same basis. Both remain
  below the 150-line limit.
- **NO-GO — MVP latest gate:** lines 95–99 say Core check is green and describe downstream closure
  only as work to finish. The latest gate is more specific: the root suite is green, but the final
  Core check after the timeout edits is still pending; the downstream test is already active, with
  later downstream freshness/identity closure following it.
- **NO-GO — language-loop latest gate:** lines 130–134 say `Core root gates are green` and that broad
  Core/downstream closure remains. This likewise overstates Core closure and omits that the
  downstream test is active.
- **NO-GO if t401 is used without refresh:** both draft `Follow-up` fields still say to complete the
  Core root `pnpm test` rerun and then release t385. That sequence is stale: the root suite is green,
  the final post-timeout Core check is pending, and downstream testing is active. The bracketed
  validation placeholders remain intentionally unresolved and must still be replaced only from
  supervisor-observed results.

## Precise remaining corrections

1. In MVP `Next`, distinguish **green Core root suite** from the **pending final Core check after the
   timeout edits**; name the **active downstream test**, then retain downstream freshness/identity,
   generated/staged-path review, Current State reconciliation, integration decision, and fresh
   no-hindsight authorization in their actual order.
2. Make the same gate split in the language-loop next/blocker text. Do not say all Core root gates
   are green until the pending final check is observed green; replace the vague broad-closure phrase
   with the active downstream test and its remaining downstream/final-review gates.
3. Before either t401 draft is pasted, replace its stale follow-up sequence with the same current
   gate ordering and fill its validation placeholders from supervisor-observed commands/results.
4. Regenerate the README only if these corrections alter header-derived data or total line counts;
   its currently observed pairings and counts are correct.

## Validation scope

Read-only file inspection, line counting, and relative-link existence checks only. One initial
PowerShell link-check command had a parser error before performing the check; the corrected
read-only command completed and found all targets. No structure generator, test, build, provider,
browser, Lab, live, staging, commit, or push operation was run. This report is the only file added.
