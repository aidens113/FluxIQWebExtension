# t306 — Exact MVP-plan compaction cut map

Status: **Complete report-only map**

The active plan is now 857 lines because six later briefs were appended after t300. The safe cut
identified by t300 has not moved: its start/end headings and payload are unchanged. Keep t297 and
all later briefs active because they still govern plan integration, final validation, and the web
permission reconciliation.

## Exact archive payload

Create:

`docs/working/mvp-today-plan/archive/2026-09-26-run2-and-local-gate-briefs.md`

Move, verbatim and in order, this payload from the active plan:

- first line: current line 165, `### Brief: t219-run2-preflight-delta`
- last line: current line 717,
  ``- Report to: `docs/working/mvp-today-plan/reports/t296-final-test-edit-identity.md` ``
- count: 553 lines
- normalized payload SHA-256:
  `166aa772c10a3b0553fa0ca6eb7dd05c45a4071ff395d6dda0ffb2d989962573`

The hash input is those 553 lines in their current order, joined with LF, with one terminal LF,
UTF-8 encoded. The payload contains every t219–t296 brief, including grouped headings, and nothing
from t297 onward. Do not cut by a future numeric line alone: select from the exact t219 heading
through the exact t296 `Report to` line so concurrent append-only briefs cannot move the boundary.

The archive should have a short H1/introduction, a link back to
`../../mvp-today-plan.md`, and a link to the preceding
`./2026-09-26-pre-run-and-run1-coordination.md`; place the 553-line payload between explicit
`BEGIN VERBATIM t219-t296` / `END VERBATIM t219-t296` HTML comments. Those wrappers make a later
lossless comparison unambiguous and are outside the payload hash.

## Exact active-plan replacement

In `## Worker Briefs`, retain the section heading and the existing two opening lines:

```md
## Worker Briefs

Completed t170–t218 briefs are in the [archive](./mvp-today-plan/archive/2026-09-26-pre-run-and-run1-coordination.md).
Each worker owns only its uniquely named report and never commits.
```

Replace only the 553-line payload with this one line:

```md
Completed t219–t296 briefs are in the [run-2 and local-gate archive](./mvp-today-plan/archive/2026-09-26-run2-and-local-gate-briefs.md).
```

Retain the blank line that already separates the t296 block from
`### Brief: t297-final-plan-draft-refresh`, then retain t297–t306 exactly. Also retain without
movement or rewriting:

- the header and `## Current State`;
- `The Binding Rules`, `Current Runtime And Judge Contracts`, `Live Validation Contract`, and
  `Active Order Of Work`;
- the whole existing `## Work Ledger` and `## Open Questions`.

This substitution is a 552-line reduction. It does not delete evidence: the brief text is in the
new archive, each brief's result remains in its uniquely named report, and the active plan links to
both archives.

## Operation order and exact projected sizes

The protocol requires compaction before another edit to this already-oversized plan:

1. Capture and verify the 553-line payload/hash.
2. Create the archive with its cross-links and verbatim payload.
3. Replace the active payload with the one-line pointer.
4. Append one seven-line compaction ledger entry plus one separating blank line, recording commands
   actually observed rather than a worker claim.
5. Confirm the compacted active plan is **313 lines**: `857 - 552 + 8`.
6. Then apply t297. Its Current State replacements add four lines and its ledger entry plus blank
   adds eight, producing **325 lines**. The MVP Current State becomes 68 lines.
7. Apply t297 to the loop plan separately; as t300 established, it becomes 710 lines with a
   143-line Current State.

If any concurrent shared-plan edit lands first, recompute only the whole-file projections. The
heading-bounded 553-line payload remains valid only while its normalized hash still matches.

## Lossless verification

Before cutting, recompute the payload hash with this read-only PowerShell pattern (the end index is
the line immediately before the t297 heading, minus its separating blank):

```powershell
$p = 'docs/working/mvp-today-plan.md'
$l = Get-Content -LiteralPath $p
$s = [Array]::IndexOf($l, '### Brief: t219-run2-preflight-delta')
$n = [Array]::IndexOf($l, '### Brief: t297-final-plan-draft-refresh')
$payload = $l[$s..($n - 2)]
$bytes = [Text.Encoding]::UTF8.GetBytes(($payload -join "`n") + "`n")
$sha = [Security.Cryptography.SHA256]::Create()
try { ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
finally { $sha.Dispose() }
```

Require the 553 count and recorded SHA-256 before editing. Afterward, extract the lines between the
archive's two verbatim markers and require the same count, first line, last line, and hash. Then
verify the retained skeleton and links:

```powershell
rg -n '^## |^### Brief' docs/working/mvp-today-plan.md
rg -n '^### Brief' docs/working/mvp-today-plan/archive/2026-09-26-run2-and-local-gate-briefs.md
git diff --check -- docs/working/mvp-today-plan.md docs/working/mvp-today-plan/archive/2026-09-26-run2-and-local-gate-briefs.md
```

After t297's plan edits are settled, regenerate and verify the generated index/rules:

```powershell
pnpm structure:baseline
pnpm structure:check
```

The regenerated index should show 325 lines for `mvp-today-plan.md` and 710 for
`language-driven-flow-loop-plan.md` if no other plan edits intervene. The nested archive is
intentionally excluded by the index generator, which indexes only top-level `docs/working/*.md`.

t306 changed no shared plan, archive, index, source, generated output, run artifact, or live state.
This report is its only write.
