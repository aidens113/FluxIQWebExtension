# t195-w9: a row's age drawn inside a shadow root

Brief: can a list extraction read and filter on the age of a sent invitation on
professional-network (`professional-network-withdraw-stale-requests`), when the
age is drawn by `gl-time-ago` inside a shadow root?

## Outcome

Done. Before this change the answer was no. A `text` field never read shadow-root
text, and detection never offered the age as a column. Both are fixed in the
owning files, and the tests fail without the fix. The `where` grammar already
handles "a month or more" as `matches: "month|year"` on the age text.

## Answers

### 1. What `gl-time-ago` renders, and where

- Definition: `apps/scenario-lab/src/scenarios/professional-network/shell/client-script.ts:60-67`.
  On connect it calls `attachShadow({ mode: 'open' })` (line 65) and writes
  `<span>` + text. The text comes from `timeAgoLabel(datetime, REFERENCE_NOW_MS)`
  (line 63), with `"Sent "` in front when `format="sent"` (line 64).
- The sent row markup is `network/rows.ts:69`. It is
  `<gl-time-ago class=".." datetime="<ISO>" format="sent"></gl-time-ago>` with no
  light children, placed in `div.inviteText` (`rows.ts:72` for a person, `:77`
  for a page or newsletter).
- The wording is in `data/time-ago.ts:22-37`. `sentAtIso(days)` (`:11-13`) is
  now minus `days` days minus 1 hour, so the floored age is exactly `days`.
  The rules are: `<=0` "today", `1` "yesterday", `<7` "N days ago", `<30`
  floor(d/7) weeks, `<365` floor(d/30) months, and otherwise years.
- What each value in `data/invitations.ts:15-52` shows on a sent row:
  - 0 shows "Sent today" and 1 shows "Sent yesterday".
  - 2, 3 and 5 show "Sent N days ago".
  - 8, 10, 12 and 13 show "Sent 1 week ago".
  - 15, 17, 19 and 20 show "Sent 2 weeks ago".
  - 22, 24, 25, 26 and 27 show "Sent 3 weeks ago".
  - **28 shows "Sent 4 weeks ago".**
  - 33, 38, 40, 45 and 52 show "Sent 1 month ago".
  - 61, 66, 70 and 80 show "Sent 2 months ago".
  - 90 and 95 show "Sent 3 months ago".
  - 124 and 130 show "Sent 4 months ago".
  - 150 shows "Sent 5 months ago", 199 "Sent 6 months ago" and 240 "Sent 8 months ago".
  - No row reaches a year.
- Where the words live: **only in the open shadow root.** The light DOM holds
  nothing. The attribute `datetime` carries only the ISO instant (for example
  `2026-08-19T08:00:00.000Z`), not the words.

### 2. Did the list reader and detection see it? (before the fix)

- **Reader: no.** `field-reader.ts` `readText` (formerly line 89-91) is
  `tightestStatedValue(el) ?? normalize(textOutsideSensitiveControls(el))`.
  - `textOutsideSensitiveControls` (`content/sensitive-text.ts`) is `textContent`,
    or a light `childNodes` walk. Neither ever enters a shadow root.
  - `tightestStatedValue` (`value-statement.ts`) reads the same way.
  - So a text field on `gl-time-ago` read `""`. A text field on the whole
    `<li>` read the name, headline and "Withdraw", with no age.
- **Detection: no.** `infer-fields.ts` `elementSources` offers a text column
  only for an element with a test id, or for `isTextLeaf` (no element children
  **and** non-empty `textOutsideSensitiveControls`).
  - The childless `gl-time-ago` reads `""`, so it was never offered.
  - Its `datetime` attribute was not offered either. Only the item's own
    `data-*` attributes become attribute columns (`itemAttributeSources`).
  - Measured on a fake row before the fix, the proposal was `data-entity-urn`,
    name `strong`, headline `div` and `button`, with no age (test 13's failure
    output, below).

### 3. Can the `where` grammar say "a month or more"?

- **Yes, on the age text.** `matches` compiles a bare source case-insensitively
  (`domain/src/actions/extraction/condition-match.ts:177-193`) and tests the
  collapsed value (`:108-111`, `:149-153`). `condition-grammar.ts:98-101`
  accepts `regex` and `pattern` as other names for it.
  - `matches: "month|year"` keeps every row of 33 days or more. It drops
    "Sent 4 weeks ago" (28 days) and everything younger.
  - The model writes a condition naming the age column, with
    `matches: "month|year"`, or equivalently `contains: ["month", "year"]`
    (a list means any of these, `condition-grammar.ts:26-28`).
- **A numeric rule does not work here.**
  - A bound reads the **first** number in the value
    (`condition-match.ts:97-98`, `:199-209`). "Sent 1 month ago" reads 1, and
    "Sent 3 weeks ago" reads 3, so `atLeast` cannot tell weeks from months
    without a text test beside it.
  - On `datetime`, the first number is the year (2026).
  - The grammar has no date comparison, and `datetime` is not proposed as a
    column anyway.
- **Keeping only connection requests is a separate matter.** Page and newsletter
  rows also carry an age. The simplest route is the Sent "People" filter
  (`?type=CONNECTION`, `rows.ts:10`). Otherwise the condition needs a column
  only person rows have, such as the headline `div` (`rows.ts:72`), with
  `is: "present"`. I did not verify which column the model gets for that.

## What changed and why

- `apps/extension/src/content/extraction/field-reader.ts`
  - `readText` is now
    `tightestStatedValue(el) ?? normalize(hostsOpenShadowRoot(el) ? drawnText(el) : textOutsideSensitiveControls(el))`.
  - `drawnText` walks the painted tree in document order:
    - an open shadow root's host reads its root's nodes;
    - a `<slot>` reads its `assignedNodes()`, or its fallback children when
      nothing is assigned;
    - every subtree rooted at a sensitive control is skipped by the shared
      `isSensitiveFormControl` rule (D2), as `textOutsideSensitiveControls`
      skips it;
    - `STYLE`, `SCRIPT`, `TEMPLATE` and `NOSCRIPT` are skipped, so a
      component's stylesheet never reaches a value.
  - The walk is bounded at `MAX_DRAWN_NODES = 10_000` nodes.
  - An element with no open shadow root anywhere inside it reads exactly as
    before.
  - Nothing beyond the field's own value is returned.
- `apps/extension/src/content/extraction/infer-fields.ts`
  - The new `drawsShadowText` offers a childless open-shadow-root host as a
    `text` column when the field reader finds words in it.
  - It never reads a sensitive host, and the words decide only whether the
    column exists; they never reach a label (D3).
  - The column goes through the existing `statedMoreTightly` guard.
- Tests, all in `apps/extension/src/content/extraction/tests/`:
  - `fake-shadow-dom.ts` (new) is test support: a minimal Node DOM with open
    shadow roots, slots and the selector forms inference writes. It exports one
    thing.
  - `field-reader.test.ts` (new) has 7 tests: an age in the shadow root; the
    row reading in document order; a sensitive control in the shadow root left
    out; a style tag not read; a slot, both assigned and fallback; the
    no-shadow regression guard; and the bound.
  - `infer-fields.test.ts` gains 2 tests: the shadow host is proposed with
    coverage 1, required, and a label free of the words, and reads each row's
    age; and a wordless host is not proposed.

## Commands run and observed results

1. Bundle and run the touched tests through esbuild, the same way
   `scripts/test-extension.mjs` does, into the label directory
   `apps/extension/.test-build-scratch/t195-w9`, then
   `node --test .../field-reader.test.mjs .../infer-fields.test.mjs`.
   - Observed: `# tests 14`, `# pass 14`, `# fail 0`.
2. The same run against the HEAD `field-reader.ts` and `infer-fields.ts`
   (swapped in, then restored).
   - Observed: `# tests 14`, `# pass 7`, `# fail 7`.
   - Tests 1-5, 7 and 13 fail. Test 13's failure lists the proposal with no
     age column:
     `[{"kind":"attribute","attribute":"data-entity-urn",...},{"kind":"text","selector":":scope > div:nth-of-type(1) > div:nth-of-type(1) > strong",...},{"kind":"text","selector":":scope > div:nth-of-type(1) > div:nth-of-type(2)",...},{"kind":"text","selector":":scope > div:nth-of-type(2) > button",...}]`.
   - After restoring, the rerun printed 14/14 pass.
3. `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w9 tsc" npx tsc -p apps/extension/tsconfig.json --noEmit`
   - Observed: `[heavy] t195 w9 tsc holds b1`, no diagnostics, `exit=0`.
4. The test files are excluded from that tsconfig, so I type-checked them with
   a scratch tsconfig extending it (in the session scratchpad), through
   heavy.sh.
   - Observed: `exit=0`. `--listFilesOnly` confirmed all three test files were
     included.
5. `node scripts/structure-audit.mjs` (read-only)
   - Observed: `structure-audit: passed (125 warning(s), 120 baselined).`
   - The only extraction warnings are advisory: `infer-fields.ts` is 624 lines
     (it was 606 before), and the directory file counts.

## Not verified

- Not run on a live page or in a real browser (no Lab or browser run, per the
  brief). The fake DOM stands in for a real `ShadowRoot` and `HTMLSlotElement`.
- Not run: the full extension suite, `pnpm check` and the build.
- I did not check the plan resolver's key for naming the column, or whether the
  model picks the age column. The Flow outcome is also unverified.

## Open questions or contradictions found

- The shared text reader `content/sensitive-text.ts` is outside this brief and
  is still blind to shadow roots. It serves snapshots, accessible names, the
  single `extract` verb (`action-runtime/extract.ts`) and `value-statement.ts`.
  So a single-element extract, and the tightest-statement pairing, still ignore
  shadow text. Moving `drawnText` into `sensitive-text.ts` would fix every
  reader at once.
- A shadow host that has light element children is still not offered by
  itself. Its slotted children are offered; text drawn only in its shadow root
  is not.
- On the live page, the whole-row text runs words together, because the markup
  has no whitespace between its blocks. `matches: "month|year"` is unaffected.
