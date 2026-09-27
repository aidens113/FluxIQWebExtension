# Report: t392-working-docs-preclosure-audit

## Outcome

NO-GO to append t389's proposed entry or close the provider-free unit as currently written. GO on physical capacity: either plan can accept one corrected final entry without compaction.

## What changed and why

Only this worker-owned report was added. The audit covered the headers, `Current State`, and `Work Ledger` sections of `mvp-today-plan.md` and `language-driven-flow-loop-plan.md`, plus reports t389, t390, and t391, as required by the brief.

### Preconditions to final ledger append

1. Normalize both header fields to exactly `Paired document: none`. The present backticked `none — ...` prose is not the protocol's path-or-`none` value; retain any useful explanation in `Scope` or `Related` instead.
2. Keep both statuses `Active`. That controlled value is accurate while provider-free closure, integration, and any later authorization remain queued. Do not use `Complete` or `Blocked`: the MVP is not delivered, but the next provider-free work is actionable.
3. Rewrite the language-loop `Current State` before the append. It occupies 153 audit-counted lines including its heading (lines 14–166), over the 150-line automated budget and not “under 150” as the protocol requires. Reduce it to at most 149 audit-counted lines; preferably make it materially shorter by moving historical run analysis into the existing body/archive. In particular, remove or historicalize lines 95–121: “no fix was dispatched,” “all are uncommitted,” and “unassigned” are stale present-tense claims. Retain the binding ten-scenario rule, latest accepted run-4 facts, zero-pass streak, provider-free packing correction and its caveats, exact remaining gates, live-authorization prohibition, and blockers.
4. The MVP `Current State` is physically conformant at 118 audit-counted lines, but its `Next` paragraph (lines 95–99) is stale. T383 already reports the authored Core architecture wording GO, t385 already records downstream package checks, t390 resolves the report-number gaps, and t391 gives the bounded authored-document privacy scan a GO. Replace that paragraph with the genuinely remaining order: supervisor-observed Core root check/test/build/docs gates; downstream root gate plus full output-dependency rebuild, six freshness comparisons, and final identity; final sensitive/generated-artifact and staged-path review; Current State reconciliation; then integration decision and, only after all provider-free gates pass, a fresh no-hindsight live authorization. Apply the same correction to language-loop lines 150–159, which currently still lists generic “integrated Core,” “authored docs,” and “identity checks” as though no package/doc review has occurred.
5. Do not append t389's proposed ledger text verbatim. Its `Validation` bullet gives results and report ids but not the exact commands the supervisor ran and observed, so it does not satisfy the protocol. Worker reports are claims. After independent supervisor verification, name each exact command and observed result; if a command was not run, say `not validated` and why. Keep t387's identity review explicitly read-only and do not present it as a rerun.
6. Use an exact controlled ledger outcome: `Accepted`, `Partial`, `Reverted`, or `Blocked`. The proposed `Accepted as ...` is not the template value. While root/downstream/integration closure remains held, use `Partial`; after the supervisor actually completes and observes all provider-free gates, a new final entry may use `Accepted`. Put qualification in `Follow-up`, not in the outcome token.
7. Link the evidence rather than leaving bare task ids. At minimum link t389 (catalog and evidence limitations), t390 (missing-number disposition), and t391 (bounded privacy scan), and make t389's controlling direct-evidence task ids real relative links to their report files. Do not cite nonexistent t359/t362/t363/t371/t388 files. Cite t357/t364/t379 for executed Core checks and t366 for the embedded read-only t371 follow-up, exactly as t390 requires. Do not claim t352's run-4 debug precision findings closed without a separate supervisor inspection.
8. Keep the entry under 15 physical lines. T389's proposal is seven physical lines, but its very long unwrapped bullets obscure the missing-command problem; a corrected entry can remain below the limit by using one heading and the six required bullets, with concise report links and detailed evidence left in the reports.

### Capacity and structure

- `mvp-today-plan.md`: 309 lines, 10 ledger entries, 118-line `Current State`. Appending the seven-line t389 proposal plus one separator line would produce 317 lines and 11 entries.
- `language-driven-flow-loop-plan.md`: 734 lines, 6 ledger entries, 153-line `Current State`. The same append would produce 742 lines and 7 entries. Its Current State must be shortened, but neither the 800-line document trigger nor the 20-entry ledger trigger requires compaction.
- Both plans otherwise preserve the required H1/header/Current State/reference/Work Ledger/Open Questions order. All five reviewed files are UTF-8 without BOM or replacement characters, LF-only, with a terminal newline. Markdown fences in the reviewed scope are balanced.

After correcting headers, Current States, and ledgers, regenerate the working-document index and update only the relevant audit baseline with:

`pnpm structure:baseline --rule working-docs`

Then run the non-writing check `pnpm structure:check --rule working-docs` and inspect its actual output before recording it as validation. Neither command was run in this worker audit.

## Commands run and observed results

- Read-only PowerShell section scans found 309 and 734 lines; 10 and 6 ledger entries; and 118 and 153 audit-counted Current State lines for the MVP and language-loop plans respectively.
- A read-only Node UTF-8 scan found no BOM, no U+FFFD replacement characters, LF-only endings, and a terminal newline in both plans and t389–t391.
- Read-only searches and source inspection confirmed `pnpm structure:baseline` maps to `node scripts/structure-audit.mjs --update`, the working-doc rule alone owns index regeneration, and `--rule working-docs` scopes that update.
- No generated-document command, structure audit, test, build, provider, browser, Lab, live, commit, or push command was run.

## Not verified

I did not inspect source/runtime changes, raw run artifacts, reports outside t389–t391, the generated index contents, Core root/downstream gates, supervisor orchestration history, or whether t352's debug-file corrections were separately closed. I did not independently validate any product result quoted by t389–t391.

## Open questions or contradictions found

- T389 correctly labels its proposed entry held and provider-free, but the proposed `Outcome: Accepted as ...` and command-free `Validation` line conflict with the ledger protocol.
- T390 removes the apparent report-gap blocker for t359/t362/t363/t371, subject only to the supervisor's live-history check for contrary t362/t363 dispatch evidence.
- T391 is a GO only for its bounded authored-document scan; it does not close the final generated-artifact/staged-path review that t389 leaves pending.
