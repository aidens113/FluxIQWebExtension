# Fix F2: row identity (t719, extension)

Worker report, 2026-10-19. Tree `C:/Users/osrs_/FluxStuff/fxwork/t719/!FluxIQWebExtension`, branch
`task/t719-site-reset-undoable-acts`. Nothing committed. Core not touched or rebuilt.

## Outcome

Done. Both defects are fixed, with tests written first. The new tests fail against the unfixed sources (6 of
15 failed) and pass with the fix.

## What changed and why

1. **Joined `lines` value (job save r1, Cause 1).** New module `apps/extension/src/content/identity/joined-row-value.ts`
   exports `heldAsJoinedLines(value, holds)`. In `record.ts`, `holdsRowValues` still looks for each value whole
   first. If that fails, a value that contains `WEB_AUTOMATION_EXTRACT_LINE_SEPARATOR` (imported from
   `@fluxiq-web-extension/domain/client`) counts as held only when every non-empty part is found in that same
   record. The gate is unchanged otherwise. A missing part refuses. Parts that are found only across two
   records refuse, because the gate is asked about one record at a time. A value with no separator gets no
   part-wise test.
2. **A control that is itself one of a run (photo newest-likes r1, Cause 3).** New module
   `apps/extension/src/content/identity/own-run.ts` exports `ownRun(control)`, exported from the identity barrel.
   It returns the run of same-shaped siblings that the control is a row of. Same-shaped means the same tag,
   written role and class attribute. The control must carry content of its own, meaning a picture or words
   in more than one place, and at least one sibling must say something different. In `record.ts`:
   - `sitsInRepeatedRow` is now also true for such a control.
   - In the values gate, `agreesWithRecordedRecord` falls back to the control itself as its row:
     `enclosingRecord ?? controlRow.row ?? controlRunRow`.

   New `apps/extension/src/content/action-runtime/pass-row/run-member.ts` exports `runMemberForRow`.
   `resolved-for-pass.ts` gains a step 3. If the gated resolution fails and the first (rows-aside) answer is a
   run member, the pass uses the one member of that run that holds every row value. Two holders, or none, keep
   the gated failure.

   Why step 3 is needed: the gate alone is not enough. A tile's name is its own counts and its href its own,
   so the gated family scoring can never corroborate the pass's tile (`corroboration.ts` requires an exact
   name, text, label, id or test id). Without step 3 every pass after the first failed as not_found.

**The carries-content condition was added beyond the brief, on purpose.** The run of the photo site's own post
dialog (`div[role=button].iconButton` for Like, Comment, Share and Save) is a same-shaped run with differing
content. Under a bare "same shape and differing content" rule, the Like press in every pass would be
values-gated and refused. Icon-only buttons and one-word links therefore stay page-level. Tests pin both
cases.

## Commands run and observed results

All were run from `apps/extension` with `EXTENSION_TEST_BUILD_LABEL=f2-row-identity`, unless noted.

- `node scripts/test-extension.mjs identity/tests/own-run joined-row-value pass-row-own-run pass-row-joined-value`
  with `record.ts` and `resolved-for-pass.ts` temporarily set back to HEAD (then restored): `# tests 15`,
  `# pass 9`, `# fail 6`. These failed:
  - joined title pass
  - tile per pass
  - absent tile not_found
  - joined value held
  - tile run
  - tile values gate
- The same command after the fix: all pass. Within the 52-test run below, the new tests are:
  - `identity/tests/joined-row-value.test.ts`: 5
  - `identity/tests/own-run.test.ts`: 4
  - `action-runtime/tests/pass-row-own-run.test.ts`: 4
  - `action-runtime/tests/pass-row-joined-value.test.ts`: 2
- `node scripts/test-extension.mjs identity/tests/own-run identity/tests/record.test joined-row-value pass-row`
  gave `# tests 52`, `# pass 52`, `# fail 0`.
- `node scripts/test-extension.mjs content/identity/tests content/action-runtime/tests` gave `# tests 300`,
  `# pass 300`, `# fail 0`.
- `node scripts/test-extension.mjs content/actions/tests` gave `# tests 183`, `# pass 183`, `# fail 0`.
- `npx tsc -p tsconfig.json --noEmit` exited 0 with no output. `npx tsc -p tsconfig.test.json --noEmit` also
  exited 0 with no output.
- From the repo root, `node scripts/structure-audit.mjs` exited 0:
  `structure-audit: passed (213 warning(s), 638 baselined)`. The only advisories on touched paths:
  - `content/identity/` has 21 files (advisory 15, limit 25).
  - `identity/tests/` has 16 files.
  - `record.ts` is 718 lines (advisory 400, limit 800; it was 702).

## Not verified

- No browser, Lab or paid run. The fix is proven only on the stub DOM.
- The swapped answer in step 3 reports the rows-aside resolution's strategy and measurement, with the pass's
  tile as the element. The measurement was taken on the build's tile, not the pass's.

## Open questions or contradictions found

1. **The job loop will probably still fail at pass 2 (not fixed: owned by `resolve-target.ts` / `score.ts`).**
   The job cards' title links carry a per-card `id` (`jobTitle-<hash>`), and their names differ per row.
   - With the lines fix, the pass on the recorded card resolves.
   - On any other card, the gated family scoring refuses the card's own link. Its name differs, and the
     recorded id still exists on the page, so it counts against it. I reproduced this with per-row ids on a
     stub card list: `not_found`. With per-row ids removed and titles equal, the joined gate resolves correctly
     (the test kept).

   Opening each row's own title link needs either of these, and both are outside my ownership:
   - a resolver rule that, under a values gate, does not weigh per-instance ids and names against a row's own
     copy;
   - placing the control at the recorded control's relative path in the pass's record.
2. **`sitsInRepeatedRow` misses nested records (not fixed, same file, outside the brief).** `enclosingRecord`
   stops at the innermost record. For `li > article > ... > a`, that record is the `article`, which has no
   same-tag sibling, so `repeatedAtCapture` is false. If such a target carries no `listPosition`, pass-row
   treats a per-row link as page-level and acts on the build's card on every pass. In practice an `li` gives
   a `listPosition`, which bypasses pass-row. A `[role=feed] > div > [role=article]` wrapper does not.
3. Photo r1 read 24 rows, but the grid draws 12 before a load. With this fix, passes 13 to 24 fail as
   not_found rather than acting on another tile, which is the intended fail-closed behaviour. F5 (first N
   rows) is still needed for that task.
