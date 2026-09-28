# Compaction report — automated-testing-facility-plan.md (2026-09-28)

## Outcome

Done. `docs/working/automated-testing-facility-plan.md` went from **1846 to 520
lines**, inside the 450-600 target and under both the 800-line compaction
threshold and the 1842-line baseline. The only remaining `working-docs`
violation for the repository is the `docs/working/README.md out of date`
message, which is the supervisor's to fix.

## What changed and why

Nothing was deleted. Every removed line was moved verbatim into one of four new
files under `automated-testing-facility-plan/archive/`, each opening with a
one-line note saying what it holds and that it was archived on 2026-09-28. Each
removal site in the main document keeps a heading suffixed `(archived)` and a
single sentence naming the archive file that now holds the material.

| Archive file | Lines | Holds (original line ranges) |
| --- | --- | --- |
| `archive/phase-step-records-2026-09.md` | 593 | Per-phase step prose after the Execution Log table (184-666); `## Final Implementation And Live Validation (2026-09-05)` (1690-1792) |
| `archive/implementation-phases.md` | 419 | `## Implementation Phases`, Phases 0-12 (1272-1688) |
| `archive/superseded-design-specifications.md` | 250 | `## Runner Topology` (879-1012); `## Evidence And Human Review` (1119-1180); `## Agent And Subagent Workflow` (1193-1240) |
| `archive/design-rationale-and-boundary-audit.md` | 145 | `## Executive Decision`, `## Goals`, `## Non-goals For The First Facility`, `## Audit Findings` (693-767); `## Proposed Repository Layout` (821-877); `## Recommended Defaults To Confirm In Phase 0` (1834-1840) |

The three extra design sections beyond the brief's named candidates — Runner
Topology, Evidence And Human Review, Agent And Subagent Workflow — were needed
to reach the 450-600 band; the named candidates alone left the document at
about 728 lines. All three are superseded design specification rather than
record: Current State already states the evidence policy in the body no longer
matches the code, the header states the rotated phase subagents are retired,
and the `existing` target mode the Runner Topology specifies has never run.

### Constraints honoured

- **Lines 1-165 byte-identical.** Verified by `diff` of the first 165 lines of
  the old and new files: no output, exit 0.
- **Execution Log table byte-identical.** Verified by `diff` of original lines
  166-183 against the new document's lines 166-183: no output, exit 0.
- **Preserved verbatim in the main document:** `## Failure Taxonomy` (the sole
  `performance.budget` occurrence is still there, line 431), `## Key Risks`,
  `## Architectural Boundary` (including "Core must never import this
  repository", line 259, and the promotion checklist), `## Test-control Seams`,
  `## Metrics`, `## Initial CI Shape`, `## Documentation Sources`, the gate
  table under `## Implementation Validation (2026-09-04)` (lines 193-205), and
  `## Browser Strategy`, `## Scenario Contract`, `## Test Layers`.
- **Core Router/Subflow ownership invariant kept in the main document.** The
  paragraph beginning "Core now owns and enforces explicit Flow representation
  metadata" (original 1695-1704) stays under
  `## Final Implementation And Live Validation (2026-09-05)` at new lines
  455-464, alongside its two-line status. It also appears in the archive copy of
  that section, which is intentional duplication rather than loss.
- **Line accounting.** The fifteen original lines not carried into either the
  main document or an archive file (667, 692, 768, 820, 878, 1013, 1118, 1181,
  1192, 1241, 1271, 1689, 1793, 1833, 1841) were each confirmed to be an empty
  separator line before being dropped; the new document supplies its own
  separators.

## Commands run and observed results

- `node scripts/structure-audit.mjs` (before): two `working-docs` failures —
  `docs/working/automated-testing-facility-plan.md: 1846 lines exceeds the
  800-line compaction threshold ... Baseline for this entry is 1842` and
  `docs/working/README.md is out of date with the documents' header blocks.`
- `node scripts/structure-audit.mjs` (after): the plan's failure is gone. The
  full tail is:

  ```text
    warn  [file-lines] packages/test-runner/src/run-scenario.ts: 688 lines is past the 400-line advisory threshold.
    warn  [file-lines] packages/test-runner/src/tests/existing-fluxiq-control.test.ts: 460 lines is past the 400-line advisory threshold.
    FAIL  [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.

  structure-audit: 1 violation(s) across 1 rule(s).
  ```

  Grepping the audit output for `automated-testing-facility` returns nothing.
- `wc -l docs/working/automated-testing-facility-plan.md` -> `520`.
- `wc -l docs/working/automated-testing-facility-plan/archive/*.md` -> 145, 419,
  593, 250; 1407 total.
- `diff` of old vs new lines 1-165, and of old 166-183 vs new 166-183: both
  empty.

## Not verified

- I did not run `pnpm check`, `pnpm test` or `pnpm build`; the change is
  documentation only and the brief named only the structure audit.
- I did not regenerate `docs/working/README.md`, per the brief. It remains out
  of date, and that is the one audit failure left.
- I did not verify that every internal cross-reference elsewhere in the
  repository still resolves. One stale reference is known and deliberate: the
  header block's line 9 says the Core-side changes are "at lines 67-75 and
  1691-1700". Those numbers no longer hold — the invariant paragraph is now at
  455-464 — but line 9 is inside the untouchable 1-165 range, so I left it. The
  supervisor should correct that pointer.
- No archive file carries a working-document header block. The audit did not
  complain, and `reports/` has none either, but I did not confirm that the
  index generator ignores `archive/` rather than merely tolerating it today.

## Open questions or contradictions found

- The brief listed `## Recommended Defaults To Confirm In Phase 0` as an
  archive candidate while its own preserve list did not mention it; I archived
  it, which is consistent with the candidate list. It is the one section whose
  removal was a judgement call between the two lists.
- The brief said not to touch `reports/`, and also to write this report into
  `reports/`. I created only this new file there and changed nothing else in
  that directory.
