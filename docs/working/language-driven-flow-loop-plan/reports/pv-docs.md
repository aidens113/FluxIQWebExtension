# PV-docs report

## Outcome
Done.

## What changed and why
docs/architecture/page-evidence.md, section "What A Model Reads: The Compact Page View":
- Extended the inline kind list with `field[search]` and the state list with `selected`, `pressed`, `current`, `marked`, `placeholder "…"` (the doc lists these inline, not in a table).
- Added subsection "### Controls The Markup Does Not Name": the page-world press probe feeding `hasClickHandler` (and why), `cursor`, `setApart`, the delegate rule, `field[search]` conditions with `searchForm`, `placeholderName` and the placeholder rule, the label lookup before wrappers ("Quantity"), computed-display visibility, and the guard spec page-view-controls.spec.ts.
Source: the t229 report's "Root causes and what changed"; I did not re-read the full code diff.

## Commands run and observed results
`node scripts/structure-audit.mjs` -> `structure-audit: passed (155 warning(s), 118 baselined).`

## Not verified
Did not cross-check each claim against the code diff beyond the t229 report.

## Open questions or contradictions found
None.
