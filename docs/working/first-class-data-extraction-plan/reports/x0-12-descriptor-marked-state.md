# x0-12-descriptor-marked-state: the two descriptor state readers are tested, and the recorder's last unfiltered route is closed

## Outcome

**Done.** Every item in the brief is finished and checked on the final tree.

- **The two unexercised siblings x0-11 left are now covered.** A checkbox inside
  a `data-sensitive` element carries no checked state, and a select inside one
  carries no option list and no selection, in the descriptor and in the
  snapshot. Each rule has a unit test and a content-harness row, and each was
  mutated and observed red on both.
- **The brief's recorder question is answered: no.** The recorder's `input` and
  `change` events on a control inside a marked element do **not** carry its
  value. `dom.input` carries no `inputValue` and no `element.value`, and
  `dom.change` on the checkbox and on the select carries no `checked`, no
  `options`, no `selectedValue` and no `inputValue`. Those paths already read
  through x0-11's value reader and needed no change.
- **A third recorder route did leak, was observed, and is fixed.** A printable
  key pressed in an *ordinary* text field inside a marked group was recorded as
  the character, one `dom.keydown` per key, in order. `recordableKey`
  (`dom-events.ts`) asked only whether the control itself was marked. It now
  asks the ancestor-aware rule. This was found by the new harness row, not by
  reading.
- **Tests.** 2 new unit tests (559 total, from 557) and 2 new harness rows
  (`evidence` 34, from 32).
- **Mutations.** 2 mutations of real source, each red on the unit tests *and*
  the harness, each restored byte-identical. The keydown rule's red is the
  pre-fix run itself. No mutation was refused by the permission classifier, so
  no scratch copy of the repository was needed.
- **Final checks.** Extension check exit 0; unit 559 of 559; harness `evidence`
  + `redaction` 53 passed; `recorder-trust` + `keyboard` 20 passed; structure
  audit's only FAIL is the supervisor-owned `docs/working/README.md`.

No synthetic secret value is quoted below. Injected strings are named by the
route they were placed in.

## What changed and why

### `apps/extension/src/content/describe-element.ts`

- **`checkedState` is exported**, unchanged in behaviour. Its doc comment now
  says why a checkbox inside a marked element is asked about as the element is.
- **`selectState` is new and exported.** It is the option-list block lifted out
  of `describeElement` verbatim: the same `isWithinSensitiveControl` guard, the
  same 20-option cap, the same 200-character slices, and the same rule that a
  `selectedValue` travels only when it is one of the options already listed.
  `describeElement` now assigns from it. Its local `SelectState` type takes its
  option shape from `DomElementDescriptor["options"]`, so the wire contract
  still defines it.
- **Why they are exported.** `describeElement` cannot be exercised under the
  Node unit runner without stubbing everything it reaches — xpath, visual
  bounds, `getComputedStyle`, `captureSettings` and all four `identity/`
  readers — which would be a large, fragile stub proving little. The file's own
  header already states the convention: the field accessors are exported
  because the snapshot path judges elements by the same fields. Exporting these
  two lets one small test close each rule.
- **The cost, stated plainly.** The file moves from 8 to 10 exported values and
  so crosses the audit's 8-value *advisory* threshold. It is a new warning, not
  a new failure (the rule fails at 15). The alternative I considered and
  rejected was a new `content/control-state.ts`: it is outside the paths this
  brief owns, and it would push `src/content/` from 17 to 18 files, worsening
  an existing directory warning instead.
- **Header comment** now names the three readers of what a control holds and
  the one rule they share.

### `apps/extension/src/content/dom-events.ts` (the brief's conditional ownership, triggered)

- **`recordableKey` asks `isWithinSensitiveControl`** instead of
  `isSensitiveFormControl`, so a key pressed in anything inside a marked
  element is withheld as one pressed in a marked control already was. A key
  whose name is longer than one character still always travels.
- **`isSensitiveFormControl` is dropped from the imports**, having become
  unused, and `isWithinSensitiveControl` is imported from `./sensitive-text`.
- **Both comments updated** — the file header and the function's doc — to say
  why a path that reads no value must still ask the same rule.
- **Why this is a real leak and not a theoretical one.** x0-11 moved every
  reader that touches a value or text to the ancestor-aware rule. The keydown
  path was left behind precisely because it never passes a value reader. The
  result was that a field inside a marked group yielded no value, no text and
  no state anywhere, while its characters were still recorded individually and
  could be reassembled in order. See run 4 below.

### Unit tests — `content/tests/describe-element.test.ts` (2 new)

1. A checkbox in a marked `<div>` and a radio in a marked `<fieldset>` report no
   checked state; an ordinary toggle still reports `true` *and* `false`, so the
   withholding is targeted and `false` is not read as an absence; a text input
   reports none either way.
2. A select inside a marked element gives nothing; a select the rule marks
   itself still gives nothing; an ordinary select still carries both options and
   its selection; and a selection that is not among the options listed is left
   off.

Three local stub helpers were needed — `toggle`, `option`, `select` — because
`content/tests/stub-page.ts` is not mine to edit and models neither a `checked`
property nor a select's `options` and live `value`. They follow the pattern the
file's existing `editable()` helper set.

### Content harness — `e2e/content/tests/evidence.spec.ts` (2 new rows)

A shared `injectMarkedGroup` helper injects a group marked `data-sensitive`
holding a text field, a select and a checkbox — none marked itself — and an
ordinary group holding the same three. The two groups are given different
shapes so they cannot be read as one repeating run.

1. **Descriptor row.** The whole snapshot and the whole `capture_snapshot` reply
   are scanned for the fixture's secrets and the four injected strings. The
   marked select carries no `options`, no `selectedValue` and no `value`, while
   `hasValue` stays `true` so presence still travels; the marked checkbox
   carries no `checked`. The ordinary select still carries both option labels
   and its selection, and the ordinary checkbox still carries `checked: true`.
2. **Recorder row.** Records a real typing session: the debounced `dom.input`,
   the `dom.change` a toggle and a select report, and the keydown path. Asserts
   no recorded message carries any injected string, every character key in the
   group is withheld while the `Tab` that left it still travels, and an
   ordinary field typed in the *same session* still records its value.
   - **The select change is driven by a real `ArrowDown` key press, not
     `selectOption`.** Playwright's `selectOption` dispatches untrusted events,
     which the recorder ignores by design, so the row would have proven nothing.
   - **Placement.** `redaction.spec.ts` is the thematic home for recorded-value
     leaks, but this brief owns `evidence.spec.ts`; a comment in the file says
     so. See open question 2.

## Commands run and observed results

Every command ran from the repository root, one at a time, never beside
another. The harness always ran with `--workers=1`. Full output is in the
session scratchpad.

| # | Command | Observed |
| --- | --- | --- |
| 1 | `node scripts/structure-audit.mjs` (before) | exit 1; 2 FAILs, both supervisor-owned working docs. On my paths only pre-existing warnings: `src/content/` 17 files, `evidence.spec.ts` 628 lines |
| 2 | extension `check` (before) | exit 0 |
| 3 | unit tests (before) | exit 0, `# tests 557`, `# pass 557`, `# fail 0` |
| 4 | harness `evidence` (before) | exit 0, `32 passed (13.9s)` |
| 5 | extension `check` after the edits | exit 0, no `error TS` |
| 6 | unit tests after the edits | exit 0, `# tests 559`, `# pass 559` — both new tests pass |
| 7 | harness `evidence`, **before the keydown fix** | exit 1, `1 failed`, `33 passed`. The descriptor row passed. The recorder row failed at the key assertion, the diff showing 31 single-character keys in order followed by `"Tab"` |
| 8 | extension `check` after the fix | exit 0 |
| 9 | unit tests after the fix | exit 0, `# tests 559`, `# pass 559` |
| 10 | harness `evidence redaction` | exit 0, `53 passed (18.6s)` |
| 11 | `node scripts/structure-audit.mjs` (after) | exit 1; one FAIL, `docs/working/README.md`, the supervisor's. New warnings mine: `describe-element.ts` 10 exported values, `evidence.spec.ts` 776 lines |
| 12 | mutations (below) | both red on both gates, both restored byte-identical |
| 13 | extension `check` (final) | exit 0 |
| 14 | unit tests (final) | exit 0, `# tests 559`, `# pass 559`, `# fail 0`, `# cancelled 0` |
| 15 | harness `evidence redaction` (final) | exit 0, `53 passed (17.7s)` |
| 16 | harness `recorder-trust keyboard` | exit 0, `20 passed (9.8s)` |
| 17 | `git diff --stat -- apps/extension/build domain/.test-build` | printed nothing |

**Mutations.** A scratch script kept outside the repository applied each one:
it required the text to occur exactly once, backed the file up, mutated it,
confirmed the mutated text was present, ran the checks, restored the file and
compared bytes. Both printed `mutated text present: true` and `identical to
original after restore: true`.

| # | Mutation (real source) | Observed |
| --- | --- | --- |
| M1 | `checkedState` returns `element.checked` with no ancestor rule | unit exit 1, `# fail 1` (`not ok 406`, the checkbox test); harness exit 1, `2 failed`, `32 passed` — both new rows |
| M2 | `selectState` drops `isWithinSensitiveControl` from its guard | unit exit 1, `# fail 1` (`not ok 407`, the select test); harness exit 1, `2 failed`, `32 passed` — both new rows |
| M3 | `recordableKey` asks only the control itself | this is the pre-fix source; observed red as run 7 above |

Each mutation kills exactly one unit test, so the two tests are independent
rather than overlapping, and both kill the recorder row as well as the
descriptor row, so that row depends on the state rules and not only on the
keydown rule.

## Not verified

- **Browsers and isolation.** Only the harness's Chromium, in the page's main
  world. Firefox, a loaded unpacked extension, the isolated world and shadow
  DOM were not exercised.
- **Specs not run.** Only `evidence`, `redaction`, `recorder-trust` and
  `keyboard`. The keydown change could in principle reach any spec that records
  a key press; those four are the ones that assert on it. Not run:
  `actions`, `identity*`, `extract-list`, `selection-redaction`, `click`,
  `select`, `frames`, `scroll`, `waits` and the rest.
- **Repository-wide gates.** `pnpm check`, `pnpm test` and `pnpm build` were not
  run. The extension package's `check` and unit tests were.
- **`x3b-page-engine`'s tree.** Its in-flight edits are in the working tree
  (`content/extraction/` added, `action-runtime/list-extraction.ts` deleted).
  My harness runs bundled that tree successfully, but I ran none of its specs
  and make no claim about them.
- **The plan document's own FAIL.** The 820-line working-doc FAIL present in run
  1 was gone by run 11. Another agent changed that file; I did not.
- **Documentation.** `docs/architecture/sensitive-values.md` is outside the paths
  this brief owns, so I did not edit it. Its "Recorded events" bullet now
  understates the rule — see open question 1.

## Open questions or contradictions found

1. **The documentation needs one sentence (not my file).**
   `docs/architecture/sensitive-values.md` says `recordableKey` "drops the key
   itself: a printable key pressed in a sensitive control *is* that control's
   value". After this fix that is true of a key pressed in a sensitive control
   **or in anything inside one**. The same paragraph could name the checked
   state and option list, which the "Element descriptors" bullet already covers
   for a marked select but not for one merely inside a marked element.
2. **The recorder row's home.** It sits in `evidence.spec.ts` because this brief
   owns that file, but `redaction.spec.ts` is where recorded-value leaks are
   proven. Moving it there would put all four recorder-leak rows together. A
   comment in the spec records this.
3. **`evidence.spec.ts` is 776 lines, 24 short of the 800-line hard FAIL.** The
   next addition to it will fail `pnpm check`. It wants splitting — the
   sensitive-input rows are now a coherent group of four and would make a
   natural `evidence-sensitive.spec.ts` — which is a structural change beyond
   this brief's owned paths.
4. **`describe-element.ts` now warns at 10 exported values.** Advisory only. If
   the supervisor would rather not carry it, the two state readers plus
   `readElementValue` would make a cohesive `control-state.ts`; I did not create
   one because it is outside this brief's owned paths (reasoning above).
5. **A fourth route I did not test.** `recordableKey` is asked of the *event
   target*. A key pressed while focus is on a marked group's container itself
   (a `contenteditable` region, say) is covered by the same ancestor walk, but
   no row exercises that shape; the row I added types into a child input.
