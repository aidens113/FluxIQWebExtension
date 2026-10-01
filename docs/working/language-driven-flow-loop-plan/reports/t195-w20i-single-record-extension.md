# t195-w20i: one record read as a one-row table (extension half)

## Outcome

Done, with one location change forced by the structure audit. The three new modules sit in
`apps/extension/src/content/extraction/single-record/` instead of directly in `extraction/`. `extraction/` already
holds 25 source files, and 25 is the `directory-files` fail limit, so three more files there would have failed
`structure-audit`. The subdirectory has its own barrel (`single-record/index.ts`) and `tests/`. `infer-list.ts` and
`detect-structure.ts` import from the barrel. `extraction/index.ts` is unchanged, because it lists only the directory's
public surface and nothing outside `extraction/` uses the new modules.

## What changed and why

X = `apps/extension/src/content/extraction/`.

- **New `X/single-record/key-value-record.ts`**, which exports `keyValueRecord(list, name)`. It is pure: the caller
  passes `name`, which returns `{container, item: ItemSelectorCandidate}`, so the module never queries the document.
  - It applies to a `<dl>` in one of two forms:
    - bare: `dt` then one or more `dd`, repeated;
    - wrapped: every child is a `div` holding one `dt` then one or more `dd`.
  - It needs at least 2 pairs. A mixed form, any other child, a `dt` with no `dd`, or a leading `dd` gives nothing.
  - It proposes `{container, item, itemCount: 1, fields, confidence: item.confidence}`.
  - Each pair becomes one `text` field read from the pair's first `dd`:
    - bare form: `:scope > dd:nth-of-type(k)`, where k is that `dd`'s position among all `dd`s;
    - wrapped form: `:scope > div:nth-of-type(k) > dd`.
  - The label is the `dt`'s collapsed text, falling back to the selector when the `dt` has no words. The key comes
    from `webAutomationExtractionFieldKey`. Coverage is 1, `required: true`. A sensitive `dd` is marked `exclude`
    through `proposedFieldSpec`.
- **New `X/single-record/lone-record-level.ts`**, which exports `chooseLoneRecordLevel(levels)` and the type
  `LoneRecordLevel = {cell, boundary, contentFields, holdsRun, namedExactly}`.
  - It follows fix spec A: it returns `undefined` at the first `boundary` or `holdsRun`, skips `cell` levels, and
    returns the first index with `contentFields >= 2 && namedExactly`.
  - It accepts any `Iterable`, so levels can be produced lazily.
- **New `X/single-record/lone-record.ts`**, which exports `loneRecordAround(target)`.
  - It walks the target and at most 4 ancestors, never `<html>`.
  - Boundary: `document.body`, `main`/`[role~=main]`, or `closest(NON_DATA_REGIONS)`.
  - Cell: `!isRecordItemTag`.
  - `holdsRun`: `largestRunsFirst(level).length > 0`.
  - `contentFields`: `contentFieldCount(inferFields(level, [level]))`.
  - `namedExactly`: `generalizedItemSelector([level], selectorFor(parent))` is defined.
  - Each level is measured only as far as the rule needs.
  - The proposal is `{container, item, itemCount: 1, fields, confidence: round2(item.confidence × meanCoverage × 0.5)}`,
    with no pagination.
- **`X/infer-list.ts`, `inferListFromElement`.**
  - It first finds `picked.closest("dl")` and asks `keyValueRecord` with a namer built from `selectorFor` and
    `generalizedItemSelector`.
  - During the walk, levels that are the list's pairs are skipped as table cells are: their parent is the `dl`, or a
    wrapper `div` whose parent is the `dl`. This means the run of 3 bare `dd`s is never proposed.
  - A run of 3 or more nearer than the `dl` still returns at once, for example a `dd` holding a list of tags. So does
    one enclosing the `dl`.
  - The weak candidates are now "nearest wins": a pair as before, or, at the `dl`'s own level, the key-value record.
    At that level a pair of lists is preferred over the record, because the pair holds it.
  - Header paragraph added.
- **`X/detect-structure.ts`, `detectAround`.**
  - It computes the run as before (`runAround`, the old body).
    - If that is a refusal, or the target sits inside an item of the answered run, the answer is unchanged.
    - Otherwise it computes `loneRecordAround(first)`. The record is kept only if every selector match sits inside it
      and `detected(lone)` is ok.
  - With a run, the answer is the run with `record: <lone>` beside it, and `infiniteScroll` is kept.
  - With no run, the answer is `{ok: true, proposal: <lone>}`, otherwise `no_repeating_run`.
  - A lone record never replaces a run.
  - **Additional decision.** `detectStructureWhenPresent` treats a lone-record-only answer as *improvable*. It keeps
    polling for a run for the same 5 s window and returns the lone record only when the window closes. Without this, a
    target aimed at the heading of a list still being drawn would be answered at once with the heading's record and
    never get the list. The cost: a page that holds only one record waits the full window, which is what it did before
    when it refused `no_repeating_run`. This is done with an internal
    `Attempt = {answer, improvable}`. The exported signatures are unchanged.
  - Header paragraph added.
- **`domain/src/extraction/structure-detection.ts`.**
  - The `ok: true` variant gains `record?: WebAutomationExtractionProposal | undefined`, documented.
  - `webAutomationStructureDetectionValue` copies `record` through the existing `proposalValue` and requires
    `itemCount === 1`.
  - A malformed record, or one with more than one item, refuses the whole detection, as every other malformed part
    does.
- **`apps/extension/src/shared/protocol.ts`**: no change. It imports `WebAutomationStructureDetection` from the domain
  and does not mirror it.

### The shape sent, for w20j

`web.dom.capture_snapshot`'s detection answer can now take three forms.

1. The run answered, with the target's own record beside it. This is sent only when the target is outside every item
   of the run and a lone record was found:

   ```ts
   { ok: true, proposal: <run proposal, itemCount >= 1>, infiniteScroll?: true, record?: <proposal with itemCount 1, no pagination> }
   ```

2. No run anywhere. The lone record **is** the `proposal`, with `itemCount: 1` and no `record` key. It is answered only
   after the 5 s wait.
3. A key-value `<dl>` aimed at directly, or found by the outward or page-wide search. It is the `proposal` itself, with
   `itemCount: 1`, fields labelled by the `dt` text (`role`, `company`, `reference`, `submitted` on the receipt), and
   no `record`.

So w20j's packet and handles must accept a 1-item `proposal` (cases 2 and 3) and issue a second handle for `record`
(case 1). Every proposal, including `record`, has passed `webAutomationStructureDetectionValue`, so it reads as a
`web.dom.extract_list` request.

## Commands run and observed results

Run from the downstream root `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQWebExtension`.

- **`node <scratchpad>/run-dir-tests.mjs apps/extension w20i content/extraction/tests content/extraction/single-record/tests`**
  - `tests 181, pass 181, fail 0`.
- **`node <scratchpad>/run-dir-tests.mjs apps/extension w20i content/extraction/single-record/tests`**
  - `tests 11, pass 11, fail 0`: 4 key-value-record cases and 7 lone-record-level cases.
  - The level cases include the audit's five: price span → 1, card → 0, cart heading → undefined, boundary → undefined,
    TD skipped.
- **`node <scratchpad>/run-dir-tests.mjs domain w20i extraction/tests`**
  - `tests 29, pass 29, fail 0`, including the 2 new `record` cases.
- **Revert check (domain).**
  - I put back `git show HEAD:domain/src/extraction/structure-detection.ts` and ran `structure-detection.test.ts`:
    `pass 4, fail 2`, and both new record cases failed.
  - After restoring my version: `pass 6, fail 0`. `git diff --stat` confirmed the restore (+21/−2).
- **`bash .../heavy.sh "t195-w20i extension check" pnpm --filter @fluxiq-web-extension/extension check`: exit 1.**
  - The source project (`tsconfig.json`) passed.
  - The test project failed on 3 errors, none in my files:
    - `src/panel/extraction/tests/dialog-dom.ts(16,37)`: `TS2610 'ownerDocument' is defined as an accessor in class 'FakeElement', but is overridden here in 'DialogElement' as an instance property`;
    - the same error in `src/panel/recording/review/tests/recording-review.test.ts(20,16)`;
    - the same error in `src/panel/settings/tests/forget-confirmation.test.ts(17,16)`.
  - `FakeElement` comes from `src/panel/chat/tests/fake-dom.ts`, which declares `get ownerDocument`. The panel files
    are unmodified in the working tree, so this was already broken on the branch (the last commit to touch them is
    `47ba62dc`, the "chat UI lane's uncommitted work" WIP). tsc reports every error in a project, and none were in my
    files.
- **After a final comment-only edit to `detect-structure.ts`**, I ran
  `node typescript/bin/tsc -p apps/extension/tsconfig.json --noEmit` directly: `exit 0`.
- **`bash .../heavy.sh "t195-w20i domain check" pnpm --filter @fluxiq-web-extension/domain check`.**
  - First run: 1 error in my new test, a spread of `Record<string, any>` that lost `proposal`'s type. I fixed it with
    an annotation.
  - Rerun: passed, with build-cache line `"reason":"no stamp; stored in the shared store"` and no errors.
- **`node scripts/structure-audit.mjs`**: 2 violations, both in w20k's files and none in mine:
  - `[imports] apps/extension/src/content/action-runtime/recovery/tests/attempt.test.ts: 2 import(s) reach into another directory's files ... "../../../actions/types"`;
  - `[imports] apps/extension/src/content/actions/tests/gate-refusal.test.ts: 1 import(s) ... "../../action-runtime/results"`.
  - A grep of the audit output for `single-record|infer-list|detect-structure|structure-detection` printed nothing.

## Not verified

- **No browser run, as the brief says.** These parts need a real document and were exercised by no test:
  - the DOM walks in `infer-list.ts` (the `closest("dl")`, the pair skip, the nearest-wins choice);
  - `lone-record.ts` (level measurement, `selectorFor`, `largestRunsFirst`, `matches`/`closest`);
  - `detect-structure.ts` (`record` beside a run, the lone-only answer, the improvable wait).

  `selectorFor` and `generalizedItemSelector` query `document`, and the fake DOM has no document or `closest`. These
  claims are therefore not run:
  - the receipt pick now yields `{role, company, reference, submitted}`;
  - the reply card's price yields the card's inner `div` (name, price, meta). The card `<a>` with its link is one level
    further out, and spec A picks the first rich level.
- The new single-record modules' tests fail when reverted only in the trivial sense that the modules would not exist.
  The domain revert check was run and is recorded above.
- Cart regression (`run-mulum3x7-18ceeb75`): by construction a lone record is only ever added beside a run, but this
  was not exercised on the cart page.
- The full extension `check` did not go green, because of the pre-existing panel test errors above.

## Open questions or contradictions found

1. **Duplicated region list.** `lone-record.ts` restates `NON_DATA_REGIONS`, because `largest-runs.ts` (not mine to
   edit) does not export it. One line in `largest-runs.ts` (`export const NON_DATA_REGIONS`, or an
   `isInNonDataRegion(el)`) would remove the copy.
2. **Brief path vs audit limit.** The brief named `X/key-value-record.ts` and the others directly under `X`. That would
   fail the `directory-files` limit (25), so they are in `X/single-record/`. A module cycle now exists:
   `infer-list → single-record (barrel) → lone-record → largest-runs → infer-list`. It is function-only, with no
   top-level calls, so it is safe at run time and no audit rule checks cycles. If the supervisor prefers, importing
   `./single-record/key-value-record` directly from `infer-list.ts` would break it, but that would count as a
   barrel-bypass import.
3. **Bare-form selectors and multi-value pairs.**
   - In the bare form, a `dt` with several `dd`s reads only its first `dd` (as specified). The wrapped form's `> dd`
     selector also resolves to the first `dd`, because `readField` uses `querySelector`.
   - HTML's several-`dt`-to-one-`dd` grouping is refused as "a term with no value".
4. **Pre-existing panel test errors.** The `ownerDocument` errors (`panel/chat/tests/fake-dom.ts` against three panel
   tests) block `extension check` for every worker on this branch. They belong to whoever owns `apps/extension/src/panel/`.
