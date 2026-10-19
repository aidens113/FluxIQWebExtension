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

## Continuation (2026-10-19): notes 1 and 2

### Outcome

Done. Both notes are fixed, with the reproduction written first.

### What changed and why

1. **Row data no longer refuses a pass row's copy (note 1).** The fix is in `action-runtime/pass-row/`.
   - `resolved-for-pass.ts` now handles every target that carries pass-row values, not only unplaced ones.
     The as-built resolution and the gated resolution run as before. When the gated resolution fails, the
     build's control is resolved as recorded, with only the values taken off; key, text and list position
     stay. It is then placed by structure.
   - New `row-slot.ts` exports `placedInPassRow`. It takes `repeatedRowOf(built)` as the build's row and
     computes the slot: the path from the row root to the control, each step a tag plus its index among
     same-tag siblings. For each row of that tag in the same list, it follows the slot. It keeps a copy only
     when:
     - `agreesWithRecordedRecord({ values })` holds;
     - and `differsOnlyByRowData(built, copy, values)` holds.

     Exactly one copy must qualify; otherwise the gated failure stands.
   - New `row-data.ts` exports `differsOnlyByRowData`. These must be equal:
     - tag;
     - `role`, `type`, `name`, `data-testid`, `data-test-id`, `data-qa`;
     - the class set.

     These may differ only as row data:
     - the accessible name, when it equals, contains or is contained in one of the pass row's values;
     - the id, when both ids share one stem up to their last separator (`title-` + code);
     - the href, when both have the same origin, the same segment count with the first segment equal, and
       the same query keys.

     A signal present on one control and missing on the other refuses.
   - The superseded `run-member.ts` is deleted. The gallery tile is now the empty-slot case of the same rule.
   - `resolve-target.ts` passes a `placed` reporter. A placed copy is reported with the strategy that found
     the build's control and `candidateCount: 1`, and carries no score because nothing scored the copy. This
     replaces the earlier swap, which reported the build's tile's measurement.
   - The saved fingerprint is still used in full: it is what finds the build's control. Only the copy's
     row-varying signals are discounted, and only through `placedInPassRow` inside a pass with values.
2. **Nested records (note 2).** `record.ts` gets a new export, `repeatedRowOf(element)`, also in the
   identity barrel. It climbs every record at or above the element, within the record depth bound, and
   returns the first one that has a same-tag sibling. Only after that does it fall back to the control-row
   rule, then to the own-run rule. `sitsInRepeatedRow` is now `repeatedRowOf(...) !== undefined`. Result: a
   link in an `article` that is alone in its `li` sits in the `li` row.

### Commands run and observed results

All were run from `apps/extension` with `EXTENSION_TEST_BUILD_LABEL=f2-row-identity`, unless noted.

- **Reproduction on 12b910ca code:** `node scripts/test-extension.mjs pass-row-row-data`.
  - Test 1 ("each pass opens its own card's title ...") failed: `No target resolved from selector ... (refused
    a#title-k3x9 "Pear galette" in another record), element fingerprint (refused ...)`.
  - Test 2 (nested records, no list position) failed: it resolved card 1's link, the page-level answer.
  - Tests 3 to 6, the refusals, passed.
- `node scripts/test-extension.mjs pass-row`: `# tests 17`, `# pass 17`, `# fail 0`.
- `node scripts/test-extension.mjs content/identity/tests content/action-runtime/tests content/actions/tests
  content/action-runtime/pass-row/tests`: `# tests 498`, `# pass 498`, `# fail 0`.
  - New in this round: `action-runtime/tests/pass-row-row-data.test.ts` (6),
    `action-runtime/pass-row/tests/row-data.test.ts` (6) and `identity/tests/record-repeated-row.test.ts` (3).
- `npx tsc -p tsconfig.json --noEmit` exited 0 with no output. `npx tsc -p tsconfig.test.json --noEmit` also
  exited 0 with no output.
- From the repo root, `node scripts/structure-audit.mjs` exited 0:
  `structure-audit: passed (213 warning(s), 638 baselined)`.
  - The first run failed: `resolve-target.ts: 807 lines exceeds the 800-line limit`. I inlined the reporter,
    which brought it to 799 lines.
  - Advisories on touched files: `record.ts` is 731 lines, `identity/` has 21 files, `identity/tests/` has
    17 files.

### Not verified

- No browser, Lab or paid run. The fix is proven on the stub DOM only.
- Placement assumes the pass's row is a same-tag sibling of the build's row in one list container. A list
  split across several containers is not placed, and fails closed.
- The name rule accepts any name that contains or is contained in a row value. A short value such as "9"
  makes this weak, so the slot and template checks carry the decision.

### Open questions or contradictions found

1. **HEAD 01f72745 is inconsistent on its own, caused by me.** During this round I ran
   `git rm --cached run-member.ts`, which staged the deletion. Your docs commit 01f72745 ("F1 reset
   destination report") swept that deletion in. HEAD's `resolved-for-pass.ts` still imports `./run-member`,
   so HEAD alone does not compile. The working tree is consistent: `resolved-for-pass.ts` no longer imports
   it. Commit this round's changes together, and I will not touch the index again.
2. `repeatedRowOf` now treats a control as row-scoped when any record within 12 levels above it has a
   same-tag sibling, for example a page with two sibling `article`s. Inside a pass, such a control is now
   values-gated instead of acted on as page-level. This fails closed, and none of the existing 498 tests
   changed result.
