# t505 every-lasting-act-recorded: worker report

## Outcome

Done. The cause is proved from the run's step files, the fixture source and the code. It is a domain defect, not
a Core one. The domain's start-state read drops everything under the page's pinned (`position: sticky`) header,
including the hidden summary list that the add changed. The settled read after the napkins add therefore saw no
difference, and Core's `noEffect` correctly applied t475's rule to evidence that was wrong. The fix is in one domain
file. Core needed no change.

## What changed and why

### Cause (questions 1 and 3)

1. **act-3 was marked `noEffect`, which made it `undoable: false`.** This is proved by elimination.
   - The three exploration calls with lasting consequences are 0012 `modify_existing`, 0020 `create_new` and
     0040 `create_new`. No other `call.json` declares any.
   - Trial acts start at act-4, so act-3 exists and is `add-napkins-250-1`.
   - `beforeTrial` with `startReset` skips only an act that is `!undoable || undone`.
   - `undone` is set only inside `beforeTrial`. The trial gate calls it once per trial (`trial-gate.ts:229`), and
     trial 1 was the first.
   - `undoable` is false only for an irreversible class, which `create_new` is not, or through `noEffect`
     (`act-places.ts:79-80`).
   - So the settled read after 0040 had empty `differs` and no created items, on the same location.
2. **Why the read was empty.** Every visible effect of the add sat where the state never looks:
   - **The confirmation panel.** The 0040 result shows "✓ Added to cart", "Qty 1 · Pickup" and the item title
     inside `t1959 layer covers 36` under `[complementary]`. The panel is `position:fixed`
     (`bigbox-retail/theme/stylesheet.ts:140`), so it is a layer. `page-state.ts` rightly drops it.
   - **The header badge.** The fixture's own doc says "Add to cart ... redraws the mini cart -- never the count
     badge" (`client/product-script.ts:34`, `client/shell-script.ts:31`). The 0040 page still shows "🛒 2 $20.44".
   - **The hidden mini cart.** It sits inside `<header>` (`shell/shell.ts:53`), and the header is
     `position:sticky` (`theme/stylesheet.ts:17`). The capture's front-layer test marks any element under a
     fixed or sticky ancestor (`apps/extension/src/content/evidence/front-layer.ts:20-22`). The domain's
     `webIsLayer` counts `frontLayer`, and `page-state.ts` dropped every element with a layer ancestor, so all of
     the header's hidden state was left out. The page views before each add read
     `COVERING t1760 banner` (0038) and `COVERING t852 banner` (0018).
   - **The judge did see the mini cart.** The result check uses the same `includeHidden` capture and found these
     lines under `NON-RENDERED STATE` (0071 `request.txt`):
     - `"hidden":true,"tag":"li","text":"1 × ValueRidge Everyday Dinner Napkins, 250 Count · Pickup"`
     - `"4 items · Subtotal $43.39"`

   So the run could show the effect, but the reset's state threw it away.
3. **act-2 was recorded only by accident.** During 0020 the runtime closed the chat card ("recovered on attempt 2
   after absorbing blocking_dialog, closing 1 dialog"). The page lines "Chat with us" and "×" appeared and
   "Hi, I'm Val…" went, so the in-place read differed. The mini cart was invisible to that read too. The pages
   show the same pattern: 0020 has "✓ Added to cart" in layer `t1098`, while 0040's chat launcher was already
   present before the press.
4. **This was not a cross-page effect** (question 3). The effect was on the acting page, in the "list it changed":
   the header's hidden summary. The only problem was that the domain classified the pinned header as an
   interruption. No other page or cross-page record was needed, so Core's `act-places.ts` and `ledger.ts` stay
   unchanged.

### Fix (question 2): `domain/src/runtime/llm-evidence/start-state/page-state.ts`

- **New rule.** A hidden element is kept in the state when two things hold:
  - The outermost front-layer ancestor above it is the page's `banner` landmark. The capture reports the
    nearest landmark at or above an element (`identity/context.ts:125`), so a top-level `<header>` reads as
    `banner`.
  - No ancestor is a dialog or a cover of a recognised kind (`isDialog`, `kind`), and the element itself is not
    `inDialog`.
- **Everything else is left out, as before:**
  - the banner's rendered elements, because what a pinned header covers changes with every scroll;
  - the hidden content of any other front layer, such as a pinned panel a press opened;
  - dialogs and recognised covers, whether painted or not.
- **Why this is principled.** A hidden element is not drawn in front of anything. The page's own banner is on
  the page before and after a press; it is not something that opened over the page. The rule also makes the
  state hold the same non-rendered lines the result check judges by.
- `state.ts`: the doc line now names the exception.

### How an item is proved to be the build's own

An act's effect is the multiset difference between two reads of the same page:

- the read just before the act;
- the settled read just after it, with nothing else done between (`act-places.ts`; lines compared as a multiset
  in `changed-lines.ts`).

A line the page held before the act, such as the dish soap's mini-cart line, is in the "before" read. So it is
never in that act's `lines.added`, and `stillThere` never asks to undo it.

Item tokens are stricter still: an item counts as `created` only when no read of this build has seen it
(`seenItems`) and the read before the act listed the page's items (t479). The start read at build start now also
holds the header's hidden lines, so pre-existing lines are seen from the first read on.

With this fix, act-3's place would have read:

- `added`: the napkins mini-cart line and "3 items · Subtotal $26.92";
- `gone`: "2 items · Subtotal $20.44".

Revisiting the product page after an undo then counts the act undone only once the napkins line is gone. The
existing `addedByOthers` rule keeps act-2's total line from being blamed on act-3.

### Tests (question 4): `domain/src/runtime/llm-evidence/start-state/tests/start-state.test.ts`

The generic fixture is `detail(saved, panel)`, with no scenario words: a detail page "Item 7" with a sticky
`banner` header holding a hidden summary ("1 x Lamp", "1 on your list"). Optionally a pinned `complementary`
"Added" panel opens, with a hidden tip of its own.

- **"an add on a detail page shows in the hidden summary its pinned header holds…"** This is the fail-first test.
  - Before the fix it failed, with state lines only `h1 "Item 7"` and `button "Keep on list"`.
  - After the fix, the added line "1 x Chair", the totals pair, no "Lamp" line, and none of the panel's or the
    header's rendered words.
- **"a pinned panel that opens with nothing else changed is still no difference…"** Keeps t475's rule: a panel
  alone, hidden tip included, is no effect.
- **"hidden content of a dialog stays out, even one in the page's banner…"** A consent dialog's hidden note stays
  out even when it is labelled `banner`.

The last two passed before the fix as well. They guard the rule against widening.

## Commands run and observed results

All runs are from the t505 trees.

| Command | Result |
| --- | --- |
| `DOMAIN_TEST_BUILD_LABEL=t505 node scripts/test-domain.mjs start-state/tests` (in `domain/`), before the fix | `# tests 14`, `# pass 13`, `# fail 1`. `not ok 8 - an add on a detail page shows in the hidden summary…` with the error listing only `h1 "Item 7"` / `button "Keep on list"` |
| The same, after the fix | `# tests 14`, `# pass 14`, `# fail 0` |
| `node ../scripts/check/core-build.mjs` | "FluxIQ Core's build … is current with its source." |
| `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/site-reset src/programs/automation-studio/runtime/flow-bootstrap/candidate` (Core `packages/fluxiq`) | `Test Files 20 passed (20)`, `Tests 204 passed (204)` |
| `pnpm check` (domain) | exit 0: tsc over src and tests, no diagnostics |
| `pnpm check` (Core `packages/fluxiq`) | exit 0, no diagnostics |
| `node scripts/structure-audit.mjs` (Core) | `structure-audit: passed (340 warning(s), 1159 baselined).` |
| `node scripts/structure-audit.mjs` (downstream) | `structure-audit: passed (192 warning(s), 646 baselined).`; no warning names `start-state` |

`git status` shows only the three domain files changed downstream, and nothing changed in Core.

## Not verified

- **No live or browser run.** None was allowed by the brief. The claim that the real capture marks the bigbox
  header and its hidden mini cart as `frontLayer` under a `banner` landmark is derived from the CSS and the
  capture code, not observed in a raw capture: the start-state reads are not stored in the run. Likewise "act-3
  would have been placed" is inferred.
- Real-site variety is untested:
  - a pinned header that is not a `banner` landmark (for example a `<div>` header, or a header nested inside a
    sectioning element) still loses its hidden state;
  - a pinned header whose hidden content changes by itself is left to Core's settled read.
- The mini-cart `li` item tokens (`items`) were not checked. They may now appear in `created` for an add, which
  only widens what an unasked removal may target to a line the add itself created.
- The full domain suite and the Lab were not run.

## Open questions or contradictions found

- **The brief's cross-page premise did not hold.** The effect was on the acting page, hidden in the pinned
  header. The cross-page gap t475 left (an add whose item shows only on another page, with no summary on the
  acting page) is still open. Closing it would need the domain to name where an act's effect lands, or Core to
  read another page during exploration. Both are larger designs that this fix does not need.
- **act-2 was placed on chat-card noise.** A cover the runtime closes during a lasting press changes the page and
  counts as part of the act. With the fix act-2 also carries its real mini-cart lines, so undo checks work, but
  the chat lines stay in its `changed`. Without a start hook, they could keep act-2 "still there" after a real
  undo, until it is asked for twice and then kept. This needs its own brief.
- A `noEffect` act still uses up an act number, so the lists the model sees skip it (act-1, act-2, act-4).
  Cosmetic.
- The run's debug note proposed listing `noEffect` acts under `absorbedByStartReset`. That is not done, because
  the brief keeps t475's rule.
