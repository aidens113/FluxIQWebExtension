# t741 c2-reload-mark

## Outcome

Done. A reload view now marks dropped handles as renumbered only when it is the first view of a new
document (`navigation.timeOrigin` differs from the page's previous whole view). Where either view
lacks `timeOrigin`, the old rule still applies.

## What changed and why

- `domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts`
  - `FlowPages` gains `documents: Map<string, number>`: for each page, the `timeOrigin` of its
    newest whole view. It sits beside `renumbered`, and `keep()` clears it when a page is let go.
  - `markRenumbered()` marks only when `navigation.type === "reload"` and the view is a new
    document (`origin === undefined || previous === undefined || origin !== previous`). It records
    the view's origin, or deletes the entry when the view has none. It runs only for whole views
    (`remember`, and `rememberLook` when not truncated), so a truncated look never stands in for
    the page's document.
  - Header paragraph added ("Only the first view of a new document marks (t741, C2)").
  - Effect: a "Read more" that exploration pressed and that left the page, while another
    "Read more" is still shown in the same reloaded document, is no longer marked
    `renumberedByReload`. `resolveFromHistory()` therefore reaches the view history and `actedAs()`,
    which returns the acted identity. The bad mark came from social round 3, 0137-0165.
- `domain/src/runtime/llm-evidence/plan-resolution/tests/target-packets.test.ts`: added 4 tests at
  the end, on a generic library review list with stable handles:
  1. Same `timeOrigin` across both views: the pressed handle resolves to plain `{ok:false, code:"unknown"}`
     with no mark. `view_history` resolves it to `#review-1 > button.more` with the acted identity
     (button, "Read more").
  2. A new `timeOrigin`: the handle is still marked, and `view_history` keeps the refusal.
  3. `timeOrigin` missing on the first view, the second, or both: marked as before.
  4. A truncated look with a new origin, then a whole view of that origin: still marks.
  I first wrote these tests in a separate file. That made `plan-resolution/tests/` hold 26 files,
  over the 25-file structure limit, so I moved them into the existing test file.
- Extension: no change needed. `apps/extension/src/content/evidence/navigation.ts` already fills
  `timeOrigin: documentTimeOrigin()` (`performance.timeOrigin`), and domain `page-evidence.ts`
  `evidenceNavigation()` passes it through to `evidence.navigation.timeOrigin` when it is a finite
  number.

## Commands run and observed results

- Before the fix: `DOMAIN_TEST_BUILD_LABEL=t741-c2-reload-mark node scripts/test-domain.mjs plan-resolution/tests/target-packets-reload`
  gave tests 4, pass 3, fail 1. Test 1 failed because actual was
  `{ok:false, code:'unknown', renumberedByReload:true}`, which shows the defect.
- After the fix, with the tests moved into `target-packets.test.ts`:
  `DOMAIN_TEST_BUILD_LABEL=t741-c2-reload-mark node scripts/test-domain.mjs plan-resolution/tests`
  gave tests 170, pass 170, fail 0. The 4 new tests are 153-156.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (213 warning(s), 618 baselined)`.
  `target-packets.ts` (704 lines) and `target-packets.test.ts` (462 lines) each get only an
  advisory warning for being over 400 lines.

## Not verified

- Typecheck not run (the brief says the lead runs it). The new test code follows patterns the
  file already uses, including `cut.evidence.truncated = true`.
- No live browser check that `performance.timeOrigin` stays the same across in-page "Read more"
  expansions. That follows from the browser's definition, not from a live run here.
- Other domain test directories not run.

## Open questions or contradictions found

- In the second case (a new `timeOrigin`), `view_history` still returns the refusal, by design: a
  genuine reload renumbered the handle. The brief asks only for the same-document case to resolve.
- The structure audit's 25-file limit on `plan-resolution/tests/` is now exactly full. Another
  worker who adds a test file there will fail the audit.
