# t775-Q: judging a row's quantity change against the asked change (Core)

## Outcome

Done. The work is in tree `fxwork/t775/!FluxIQ`, branch `task/t775-minimal-reset-judging`. Nothing was
committed. R below means `packages/fluxiq/src/programs/automation-studio/runtime`.

Every edit is inside `R/result-verification/site-change/`. Nothing in `agreement/`, `refuted-no/` or
`flow-bootstrap/trial-change/` needed a change: C's hooks already call `automationStudioResultChangeCountClaim`
(in `refuted-no/weigh.ts`) and `automationStudioResultSiteChangeHeld` (in the agreement and
reask-contradicted), and the new behaviour runs through those two calls.

## What changed and why

### New files

- **`site-change/line-moves.ts`, `automationStudioResultLineMoves(lines)`.** This is the closed reading of
  one witness's packet `lines: { gone, added, cut? }`.
  - **A pair.** A gone line and an added line form a pair when they are identical character for character
    except for exactly one whole number. The pair gives `by = after - before`.
  - **What a number is.** Number tokens are `\d+(?:[.,]\d+)*`, so `9.99` and `1,000` are single tokens that
    are not whole numbers. A difference in any such token, any difference in text, or two numbers that
    differ all mean no pair.
  - **Groups.** Lines joined by pairs form groups (union-find). If a group holds pairs with different
    moves, the result is `undefined`, meaning no reading. Within a group the pairs are matched one to one
    greedily. If the greedy matching cannot pair min(gone, added) lines, the result is also `undefined`.
  - **Cut lines.** If `cut` is non-zero on either side, the result is `undefined`. It is also `undefined`
    when a line is at the packet's 200-character cap and ends in `…`. A page's own line that ends in `…`
    below the cap still reads.
  - **Unpaired lines** are left alone: they belong to rows added or removed whole.
  - No word is parsed and no unit is guessed, so the reading is the same in any page language.
- **`site-change/witness-move.ts`, `automationStudioResultWitnessMove(witness)`.** Applies to a list
  witness whose change is an object.
  - The move is: rows added count +1 each, rows removed count -1 each, plus each changed row's line move.
  - It needs exactly `change.changed` pairs. Any other number of pairs means `undefined`, because some
    changed row's move cannot be read.
  - It is also `undefined` for a control witness, an unread witness, or a witness whose change is `none`.
  - It returns `{ added, removed, moves, total, words }`. `words` is Core's sentence, which keeps the old
    `"1 row added, none removed or changed"` form when no rows changed.
- **`site-change/count-differs.ts`, `automationStudioResultChangeCountDiffers(siteChange)`.** It lists each
  `shown` change part with a numeric count where some witness's readable total differs from the signed
  asked count (adds N is +N, removes N is -N). It skips:
  - `each_match` parts;
  - witnesses with no reading;
  - a witness that also serves another change part, since its move cannot be split between the two parts.
- **Tests.**
  - `site-change/tests/line-moves.test.ts`: 5 tests.
  - `site-change/tests/quantity-moves.test.ts`: 11 tests. Its fixture is cart-like (Dune, "Qty").

### Edited files

- **`site-change/count-claim.ts`.**
  - **The list-witness match** now uses the witness move. A witness matches when its total equals the
    signed count and every part of the move goes in the asked direction: for adds, no row removed and every
    line move positive; for removes, the mirror. Pure added-row cases behave exactly as before.
  - **What counts as a count.** A count may now also be tied to the witness's `where` words. Before, a
    numeral counted only when a word of the part's `what` came within two words after it. Now it also
    counts when a word of the witness's `where` comes within two words after it, or within three words
    before it. This is what makes "The cart has 10, the task asked for 1." a claim when `where` is "Cart".
- **`site-change/held.ts`.** A yes is also held when `count-differs` finds a part.
  - It uses the same code, `core.result.change_not_proven`, so a phase-D gate needs to read only one code.
  - The reason reads, for example: `part "p1" (moved other than asked: it adds 1 copy of Dune, and Core read at "Cart" no row added or removed; 1 row changed with only one whole number moved: "Dune — Qty 9" became "Dune — Qty 11" (+2); a move of +2 in all, a move of 2 where it asks for 1)`.
- **`site-change/index.ts`.** The barrel exports the three new functions and two types, and the header
  describes the new files.
- **`site-change/tests/count-claim.test.ts`.** A stale comment was reworded. The assertions are unchanged.

### Model-facing words

The only new text that reaches a model is Core's finding or hold reason, which may be re-asked or passed
on. It uses generic words ("row", "whole number moved", "moved other than asked"). The page lines it quotes
are packet data that the judge already sees. The instructions file was not touched.

## Commands run and observed results

1. **First run** of `node ../../scripts/vitest-groups.mjs --groups=parallel src/.../result-verification/site-change`
   from `packages/fluxiq`. One test failed: my fixture `"Dune 9 of 13"` happened to agree with the move of
   the other candidate (+1). I changed it to `"9 of 15"`. The rerun printed `Test Files 5 passed (5)`,
   `Tests 26 passed (26)` and `all groups passed: parallel`.
2. **Fail-first.** I backed up `count-differs.ts`, `witness-move.ts` and `count-claim.ts` and stubbed them
   back to the old behaviour: no differs, no line moves, no place words. The same command then printed
   `Tests 7 failed | 19 passed (26)`. The failures were:
   - 9→10 reads +1: `expected undefined to match object`;
   - the cart no refuted: `expected undefined to be true`;
   - re-ask: `expected undefined to match object { calls: [ 1, 2 ] }`;
   - 9→11 held: `expected { …(10) } to match object { verdict: 'unsure', …(4) }`;
   - 5→3 removes 2 refuted: `expected undefined to match object { refuted: true }`;
   - removes moved the other way held: `expected [] to deeply equal [ ObjectContaining {"part": "p1"} ]`;
   - rows plus quantity summed: `expected undefined to match object { total: 2 }`.

   I then restored the three files from the backup and confirmed with `cmp`: `restored count-differs.ts`,
   `restored witness-move.ts`, `restored count-claim.ts`.

   The negative cases passed both ways, as expected: two numbers changed gives no reading; 9→11 is not
   refuted.
3. **Acceptance tests**, final, after the cap-length refinement to `line-moves.ts`:
   `node ../../scripts/vitest-groups.mjs --groups=parallel src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/flow-bootstrap/trial-change src/programs/automation-studio/runtime/llm/deepseek/tests`
   printed `Test Files 174 passed (174)`, `Tests 1446 passed (1446)` and
   `[vitest-groups] all groups passed: parallel`.
4. **`pnpm check`** in `packages/fluxiq` exited 0 with no `error TS` lines. Last line:
   `{"build-cache":"build","step":"fluxiq:check","reason":"inputs changed: packages/fluxiq; stored in the shared store (0 file(s), 0 bytes)",...}`.
   No foreign errors appeared in this run.
5. **`pnpm structure:check`** at the Core root exited 0: `structure-audit: passed (443 warning(s), 1152 baselined).`

## Not verified

- **No live or browser run.** Nothing in the product fills `siteChange` yet (phase D), and I did not check
  what the domain actually emits as `lines`. The reading assumes each changed row produces a gone line and
  an added line that differ only in the row's number. If a row's line also carries a price or total that
  moves with it, the result is no reading and the judge decides, as the brief asks. In the realistic
  scenarios that may be the common case.
- **A row added whole counts as 1,** whatever quantity its line shows. This keeps C's row semantics. So
  for "adds 2", a single new row reading "Qty 2" reads as a move of +1: a no about it is not refuted, and a
  yes about it **is** held as unsure. See open question 2.
- **A domain whose subject identity includes the quantity text.** In that case a 9→10 shows as 1 removed
  plus 1 added, with `changed: 0`. The lines may pair, but pairs (1) ≠ changed (0), so the result is no
  reading for the move. The subject-only reading is then +0 total, which differs from +1, so a yes **would
  be held**. I did not guard this, because I do not know the domain's identity rule. See open question 2.
- **`diagnosis.defects` is not read.** That is the located-defects path, which I do not own. A no that
  lists a count only under `defects` goes through the unsupported-no re-ask, as before.
- **The where-word count rule** only fires when every witness of the part already matches the asked move.
  A wrongly read claim therefore costs at most one re-ask. I did not measure it against real judge prose.

## Open questions or contradictions found

1. **Per witness, not summed.** "A change part's witnesses give a readable total move" was read per
   witness. The total is subjects plus quantity moves, and the hold applies when any readable witness
   differs. Two witnesses showing the same change, such as a list and its count badge, would wrongly sum to
   2N. This matches C's count-claim rule that "every witness changed by exactly N".
2. **The hold can over-fire on row semantics.** It holds whenever a readable witness's subject or line move
   differs, which includes the two edges above: a new row whose quantity is above 1, and a domain that keys
   rows by text that contains the quantity. Each only turns a yes into unsure, never a no. Even so, the lead
   may prefer to hold only when at least one line move was read, so that a subject-only mismatch stays with
   the judge. That would be a one-line change in `count-differs.ts`: skip when `move.moves.length === 0`.
3. **Same code for both hold reasons.** The hold reuses `core.result.change_not_proven` rather than a
   sibling code, so a phase-D gate has one code to read. The reason's words tell the cases apart
   (`moved other than asked`).
