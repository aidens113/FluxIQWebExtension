# t300 — Plan line-budget and index audit

Status: **Complete read-only audit**

## Verdict

`language-driven-flow-loop-plan.md` can accept t297 as drafted. `mvp-today-plan.md` cannot be
touched directly: it is already 803 lines, so the working-document protocol requires compaction
before the supervisor applies t297. Its Current State itself is comfortably within budget; the
oversize condition comes from accumulated worker briefs.

The generated working index is already stale for `mvp-today-plan.md`: it records 668 lines while
the file currently has 803. Its 694-line entry for `language-driven-flow-loop-plan.md` is current.

## Exact current and projected counts

Current State is counted from the `## Current State` heading through the line before its closing
`---`, including the heading. Whole-file projections include the t297 replacement and its seven-line
ledger entry plus one separating blank line.

| Plan | Current file lines | Current State now | Current State after t297 | File after t297, without required compaction | Protocol result |
| --- | ---: | ---: | ---: | ---: | --- |
| `mvp-today-plan.md` | 803 | 64 | 68 | 815 | Current State passes; whole file remains over the 800-line compaction threshold. |
| `language-driven-flow-loop-plan.md` | 694 | 135 | 143 | 710 | Passes both limits; 7 Current State lines remain before 150. |

The t297 MVP replacement adds four Current State lines: its first replacement is 12 lines for the
current 10, and its second is 10 lines for the current 8. The loop-plan replacement is 22 lines for
the current 14, adding eight. Each proposed ledger entry is seven lines and needs one separating
blank line. Neither ledger approaches the separate 20-entry compaction trigger (currently five and
three entries respectively; each becomes six and four before recording any required compaction).

## Exact required compaction

Follow the protocol's ordering literally: compact the already-oversized MVP plan before applying
t297.

1. Move the completed t219–t296 brief block, currently lines 165–717 inclusive (553 lines), to a
   dated file under `docs/working/mvp-today-plan/archive/`.
2. Replace that block in the active plan with one archive-pointer line. This is an exact 552-line
   reduction and leaves the still-actionable t297–t300 briefs in place.
3. Append the required seven-line compaction ledger entry plus its separating blank line.
4. Apply t297's two Current State replacements and seven-line ledger entry.

With those exact operations and no other edits, `mvp-today-plan.md` projects to **271 lines**:
`803 - 552 + 8 + 4 + 8`. Its projected Current State remains 68 lines. The archive preserves the
brief evidence; it is not indexed because the generator deliberately indexes only top-level
`docs/working/*.md` files.

Archiving fewer lines is possible mathematically but would leave a poor active-memory document.
Before t297, at least 11 net lines would need to disappear to leave room for the required
eight-line compaction ledger and finish at 800; after including t297, at least 23 net lines would
need to disappear. The bounded t219–t296 archive above is the exact coherent cut.

No compaction is required for the loop plan.

## Index regeneration

After both plan edits and the new archive are settled, regenerate the derived index with:

```powershell
pnpm structure:baseline
```

That is the command named by the owning `working-docs` rule when `docs/working/README.md` differs
from generated content. With the exact edits above, the regenerated top-level index should show
271 lines for `mvp-today-plan.md` and 710 for `language-driven-flow-loop-plan.md`. Then run
`pnpm structure:check` to verify the headers, Current State limits, compaction threshold, ledger,
and generated index together.

t300 changed no shared plan, index, source, build output, run artifact, or live state. This report
is its only write.
