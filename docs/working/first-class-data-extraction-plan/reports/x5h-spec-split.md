# X5-H — splitting the two oversized content-harness spec files

## Outcome

Done. `evidence.spec.ts` (790 lines) and `extract-list.spec.ts` (782 lines) are
gone, replaced by nine files whose largest is 292 lines. The extension type
check passes, the structure audit gained no finding, and every test name is
byte-identical to the originals.

**One deviation from the brief, forced by a mechanical rule.** The brief said to
put the new files in the same `apps/extension/e2e/content/tests/` folder. That
is impossible: the folder held exactly 25 source files, which is the audit's
hard `directoryFiles` limit, and it has no entry in `.structure-baseline.json`,
so the ratchet cannot suppress it. Any file added there makes the count 26 and
fails `pnpm check` outright. Splitting one 790-line file into three siblings
would have taken it to 27. The existing `extraction/tests/inference.spec.ts`
already records the same problem and its resolution (D16), and names this task:
"Splitting `extract-list.spec.ts` and `evidence.spec.ts` (X5-H) should land here
too." I followed that precedent. Removing the two originals also bought
headroom: the folder is now at 23 files.

## What changed and why

Each file was split at its own subject seams, never at a line count. Nothing was
rewritten; the rows moved verbatim.

`extract-list.spec.ts` was already organized as one `test.describe` per fixture,
so the seams were its own:

| New file | Lines | Subject |
| --- | --- | --- |
| `extraction/tests/extract-list-catalog.spec.ts` | 292 | product-catalog: paging by Next and by number, `maxPages`/`maxItems`, `timeoutMs`, and the structured field specs |
| `extraction/tests/extract-list-pagination.spec.ts` | 263 | lists that outgrow one page: infinite-feed scroll, auth-gate, and the appending feeds injected into basic-form |
| `extraction/tests/extract-list-sensitive.spec.ts` | 148 | sensitive-input: what a read refuses, and what it still reads |
| `extraction/tests/extract-list-table.spec.ts` | 92 | data-table: reading by column header, and surviving a reorder |
| `extraction/tests/scenario-variant.ts` | 33 | shared support (see below) |

`evidence.spec.ts` carried four subjects behind one table:

| New file | Lines | Subject |
| --- | --- | --- |
| `evidence/tests/page-evidence.spec.ts` | 229 | the `ROWS` table: every evidence item asserted on a page at rest |
| `evidence/tests/sensitive-names.spec.ts` | 281 | sensitive-input: names, context and marked-group state that may never quote a control's contents |
| `evidence/tests/snapshot-items.spec.ts` | 170 | the six items audited as already present — `SNAPSHOT_ROWS`, the selection rows, and the expected-state checks |
| `evidence/tests/live-page.spec.ts` | 122 | the four items a page at rest cannot show: an open dialog, an answered native confirm, a page caught mid-load, change and recency |
| `evidence/tests/captured-snapshot.ts` | 36 | shared support (see below) |

**Shared support, extracted only where more than one file needed it.**
`captured-snapshot.ts` holds `CapturedSnapshot`, `CapturedElement`, `capture()`
and `evidenceOf()`, which all four evidence specs use. `scenario-variant.ts`
holds `armVariant()` and `reloadHarness()`, which three of the four extraction
specs use. Everything with a single consumer moved with that consumer and was
not shared: `injectAppendingFeed`/`feedItems` sit in the pagination spec,
`injectMarkedGroup` and the secret lists in the sensitive spec, `byTestId` and
`expectedStateCheck` in the snapshot-items spec. Nothing was duplicated.

Placement follows the precedent already in the repository: `identity-fixtures.ts`
is a non-spec support module living directly inside a test root, imported by six
specs. The audit permits this — `test-placement` constrains only test files, and
`naming`'s depth and prefix-group checks both skip anything under a `tests/`
segment.

## Commands run and observed results

**Type check** — `pnpm --filter @fluxiq-web-extension/extension check`, which the
package defines as `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`.
The second project is the one that covers `e2e/**/*.ts`.

```
> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json
EXIT: 0
```

No diagnostics printed. This exercised the rewritten relative imports, which
change depth in the new locations: `../../../index.js` for the harness barrel,
`../../../../../src/...` for the content and protocol types, and
`../../../../../../scenario-lab/...` for `PLANTED_UNLOCK_CODE`.

**Line counts** — `wc -l`, as the brief requires (not `Measure-Object -Line`).

```
 36 evidence/tests/captured-snapshot.ts
122 evidence/tests/live-page.spec.ts
229 evidence/tests/page-evidence.spec.ts
281 evidence/tests/sensitive-names.spec.ts
170 evidence/tests/snapshot-items.spec.ts
292 extraction/tests/extract-list-catalog.spec.ts
263 extraction/tests/extract-list-pagination.spec.ts
148 extraction/tests/extract-list-sensitive.spec.ts
 92 extraction/tests/extract-list-table.spec.ts
190 extraction/tests/inference.spec.ts   (untouched)
 33 extraction/tests/scenario-variant.ts
```

Largest is 292 against a hard limit of 800 and an advisory threshold of 400, so
every file is under the 500-line target with room for extraction fixture rows.
Files directly in `e2e/content/tests/`: 23, down from 25.

**Test-name parity** — the originals were copied to a scratchpad before deletion
and their test titles compared with the new files'. Static `test("…")` titles and
the `item: "…"` entries of the two row tables:

```
OLD title count: 64
NEW title count: 64
diff old new -> (no differences)
OLD test( call sites: 45
NEW test( call sites: 45
```

**Structure audit** — `node scripts/structure-audit.mjs`, run before and after,
with the working tree staged first (the audit reads `git ls-files` and is blind
to untracked files).

Before: `structure-audit: 1 violation(s) across 1 rule(s)` — the
`docs/working/README.md` index being out of date — plus advisory warnings
including `evidence.spec.ts: 790 lines` and `extract-list.spec.ts: 782 lines`.

After: the same single violation, unchanged, and both 790/782 warnings gone.

```
warn  [directory-files] apps/extension/e2e/content/tests/: 23 source files is past the 15-file advisory threshold.
FAIL  [working-docs] docs/working/README.md is out of date with the documents' header blocks.
structure-audit: 1 violation(s) across 1 rule(s).
```

That FAIL predates this work and is untouched by it: the rule indexes only direct
children of `docs/working/`, so neither this report nor anything under
`reports/` can affect it. Regenerating the index is the supervisor's call.

## Not verified

- **The Playwright content harness was not run.** The brief said not to; it costs
  about 50 seconds per pass and the supervisor will run it. Nothing here is
  proof of live browser behavior — only that the code compiles and that the test
  inventory is unchanged.
- **Runtime collection of the nested specs was not executed.** Playwright's
  `testDir` is `./content/tests` and its default `testMatch` is recursive, and
  `extraction/tests/inference.spec.ts` already sits at this exact depth and ran
  in the 267-passed baseline. I did not run `--list` to confirm it directly, so
  this rests on that precedent rather than on an observation.
- **No assertion was evaluated.** The split is textual; whether each moved row
  still passes is what the harness run will show.

## Open questions or contradictions found

1. **The brief's placement instruction could not be followed** (detailed above).
   Worth correcting in the plan so the next brief does not repeat it: new
   harness specs cannot go directly into `e2e/content/tests/`.
2. **`inference.spec.ts` carries its own private copy of `armVariant`.** It is
   now a near-duplicate of the shared `scenario-variant.ts` sitting beside it,
   differing only in taking no payload argument. I did not touch that file
   because the brief did not give it to me. Folding it onto the shared helper is
   a small, safe follow-up.
3. **One comment was reworded, no assertion touched.** In the marked-group
   recording row, "This row sits in the evidence spec because the brief that
   added it owns this file" became "sits with the evidence specs … owns them",
   since "this file" no longer identified anything. Its pointer to
   `redaction.spec.ts` as the thematic home for recorded-value leaks still
   stands, and that relocation is still unmade.
4. **No assertion looked wrong.** Nothing was changed, and I found nothing I
   would argue with.
