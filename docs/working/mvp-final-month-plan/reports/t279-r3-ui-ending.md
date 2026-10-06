# t279-r3-ui-ending (worker report)

Brief: "Brief: t279-r3-ui-ending (worker)" plus the round-3 shared rules, plus the supervisor's mid-task addition
(detected-field samples and readable labels, `run-mux6nxst-c9bca37c` step 0014). Trees `fxwork/t279/!FluxIQ` and
`fxwork/t279/!FluxIQWebExtension`, branch `task/t279-r3-ui-ending`. Nothing committed. No Lab, browser or provider call.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

**Done**, with one test outside my files that must move with the ending (exact diff below):
`R/tests/service-bootstrap/tests/judged-build.test.ts` lines 455-458 still expect the old words and now fail.

## What changed and why

### Item 1, R2-U-2: the budget ending (Core `R/flow-bootstrap/unfinished-build/`)

- `budget-exhausted.ts` rewritten.
  - A cost ending with figures now opens: "The build used its budget for this Flow before the Flow was finished."
    Then exactly one money sentence: "Building this Flow has used $0.08 of its spending limit of $0.10, and what was left was
    too little to go on." ("It used ..." when the build had no Flow purse; "... has used all of its spending limit of $0.10."
    when nothing was left). Cents, or tenths of a cent when cents would read as nothing or as the whole ceiling.
    Pending holds count as used.
  - Gone from the person's text: the refused call's worst case ("next call could have cost"), the judging reserve
    ("kept back"), earlier builds' share, what another round needed, "went on testing and judging", and the
    "$0.021 left of this Flow's $0.10" tail on the kept sentence. The figures stay in the purse's record; the
    `AutomationStudioFlowBootstrapCostSpending` type is unchanged so `phases.ts` still fills it.
  - Other bounds (time, tokens, calls, rounds) and a cost ending with no figures keep "The build stopped at its ... limit".
  - The check's account (where the reserve judged the Flow, or it was unchanged since a no) is "Its last check found: ...",
    "What is left to change: ...", "Its last check could not confirm it: ...". The judge's text first goes through
    `automationStudioActivityPersonWords` (so "Step 8" -> "A step", "dedup" -> "removing duplicates", "the judge's" ->
    "the check's"), then the existing `judge-words.ts` screen (whole sentences, asides whole or dropped).
- New `last-fix.ts` (`automationStudioFlowBootstrapLastFixBlockedSaid`): what blocked the last fix, read from the last
  round's trace. It walks back from the end, skipping Core bookkeeping (`dryrun.`, `initial.`, `rerun.N.*` resets and
  replays, `core.*_check`, `core.no_progress`, completes, unusable decisions), stops at the last call that worked
  (a `rerun.N` that did not fail, or any `effectApplied` call), and counts each try that was stopped:
  handle refusals (`malformed_handle`, `not_a_handle`, `handle_in_wrong_parameter`; "which list on the page to read" for a
  list node), `unobserved`/`not_found`, other failures, refused edits, and unchanged repeats (`changes_nothing`,
  `already_so`, `repeat_refused`); `answered_the_same_again` counts as a try with its first cause.
  It replaces "What held it up was that ..." when it finds anything; otherwise that old sentence stays.
- `phases.ts`: passes `lastRound: phase2.progress.trace` into the budget ending (one argument added).
- Why the live run had no blocker sentence: its `lastIssueCodes` matched nothing in `BLOCKED_WORDS`; the trace has the exact story.

### Item 2, R2-U-9: the detect card names the list

- Domain `structure/list-name.ts` (new, `webLlmStructureListName`): reads, in the detection's own capture, the container's
  `aria-label` / `aria-labelledby`, a table's `<caption>`, or the heading that is the container's immediate previous
  sibling (or the last element of that sibling, 2 levels deep); then the same for up to 3 ancestors, stopping at
  `main`/`body`/`html`. Only the immediate previous sibling, so a sidebar's "Filters" heading is never the name.
  Screened (`screenedPageText`), dropped when withheld, empty or longer than 60 characters.
- Domain `structure/packet.ts`: `list?: string` on `WebLlmRepeatingStructure` and on the packet input (optional, so
  existing callers compile). `detect.ts` fills it. `index.ts` header updated (not re-exported).
- Core `R/activity/call-context.ts`: `answered` also returns `list`, read by shape from `evidence.list` (as `readRows` is),
  bounded with `automationStudioActivityHumanLabel(.., 60)`.
- Core `R/activity/observer.ts`: on a succeeded call, a `list` is merged into the call words for the end row only.
- Core `R/activity/wording/action.ts`: `AutomationStudioActivityCallWords.list`; the detect phrase gains
  `listed: "Looking for the list “<list>”"`, which wins over the target when present.
- Core `src/ui/activity-action/action-of.ts`: `LIST_NAMED` -> card target `the "<name>" list` when the name is short and
  whole (`shortName`), else "the repeating list on the page".
- No change was needed in `R/llm/loop-configuration.ts` (`R/llm/**` is not mine): the name comes off the result, not
  `describeCall`, since only the result knows which list was found. The card key is the tool ref, so the end row's new
  title updates the same card.
- `docs/architecture/extension-client.md` has none of the changed words; not edited.

### Supervisor addition: field samples and readable labels (domain `structure/`)

- New `structure/field-sample.ts` (`webLlmShownColumn`): per detected column, `sample` = its value in the first item that
  has it (text/column: the element's words; link: its path+query, never origin or fragment; attribute: that attribute),
  screened, one line, at most 40 characters cut at a word with "…". Never for a `value` column or any
  input/select/textarea/option or element with `inputType`/`controlType`; never a withheld value.
- A label that is a class path whose class tokens are at least half generated (letters and digits run together, length
  5+, or `css-`/`sc-`/`jsx-`) becomes `<what>: '<sample>'`, `<what>` from role/tag/shape: link, button, heading, image,
  price, number, text. A label written in words is kept. With no sample and no role, the old label stays.
- `first-item/locate.ts`: new `webLlmFirstItemElements` (same walk as the handles, without needing a page shown);
  exported through `first-item/index.ts`.
- `packet.ts`: `sample?: string` on `WebLlmStructureField`; `readableFields` fills sample and label. Header updated.
- **Keys unchanged** (my choice): a key is what an extraction writes its column under (D16), what retained handles,
  plan `fields` maps and already-authored Flows name; renaming would break them. The readable label carries the meaning.
- **Contradiction, flagged:** this reverses the packet's documented rule "No selector and no value, ever (D3)". I kept
  "no selector" and limited values to one bounded sample per column; `column-at.test.ts` asserted no value in the packet,
  and I changed it to assert the second item's values never appear and the first item's mutual text is the sample. If D3
  is recorded in an architecture doc, it needs the same amendment (not checked; outside my files).

## Commands run and observed results

Core commands from `packages/fluxiq` unless noted; domain subsets via
`node <scratchpad>/tools/run-subset.mjs <abs domain dir> t279-dom <files>` then `node --test <printed .mjs>`.

- Fail-first, item 2 domain: `list-name.test.ts` with `list:` wired to `undefined` -> `# tests 5 # pass 1 # fail 4`.
- Fail-first, item 2 Core: the four source files restored from HEAD, `npx vitest run R/activity/tests/observer.test.ts
  src/ui/activity-action/tests/action-of.test.ts R/activity/wording/tests/wording.test.ts` -> `3 failed | 153 passed`.
  With the fix (plus `call-context.test.ts`) -> `Test Files 4 passed (4)`, `Tests 160 passed (160)`.
- Fail-first, item 1: `budget-exhausted.ts` restored from HEAD, `npx vitest run .../unfinished-build/tests/budget-exhausted.test.ts`
  -> `6 failed | 3 passed (9)` (the 4 new R2-U-2 tests and the 2 updated lines). With the fix -> 9/9.
- Fail-first, field samples: `field-sample.test.ts` with the sample/label wiring disabled -> `# tests 3 # pass 1 # fail 2`.
- `npx vitest run R/flow-bootstrap/unfinished-build/tests` after updating pinned expectations -> `Test Files 25 passed (25)`,
  `Tests 209 passed (209)`.
- Final, after Core build: `npx vitest run R/flow-bootstrap/unfinished-build/tests R/activity src/ui/activity-action`
  -> `Test Files 57 passed (57)`, `Tests 630 passed (630)`.
- Neighbours: `npx vitest run R/flow-bootstrap R/conversations R/tests/service-bootstrap/tests` -> `1 failed | 1512 passed`;
  the one failure is `judged-build.test.ts` (below).
- Domain: all of `structure/tests` and `structure/first-item/tests` -> `# tests 38 # pass 38 # fail 0`; the 20 other domain
  test files that exercise detection -> `# tests 171 # pass 171 # fail 0`.
- Core root `node scripts/build-cache/cli.mjs fluxiq:check` -> stored, no errors. `structure-audit:check` ->
  `structure-audit: passed (264 warning(s), 349 baselined)`. `pnpm.cmd build` -> exit 0.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` -> exit 0. `node scripts/structure-audit.mjs` -> first run
  1 violation (`contract-spread` in my `list-name.test.ts`), fixed; then `passed (171 warning(s), 118 baselined)`.

## Pinned expectations I moved (owned test files)

`unfinished-build/tests/`: budget-exhausted, budget-figures, ending-never-cut, judged, loop-budget-cost-ending,
murzln6g-repair-funding, no-progress-ending, phases, repair-rounds, reserve-judging, reserve-unchanged, shared-purse
(each now asserts the used figure and the absence of the purse's words; `shared-purse` keeps its "70%, never 110%" check
through the used figure). Domain: `detect.test.ts` allowlist gains `list` and `sample`; `column-at.test.ts` as above.

## Change needed outside my files

`R/tests/service-bootstrap/tests/judged-build.test.ts`, lines 455-458:

```diff
-    expect(diagnostic.ending?.message).toContain("went on testing and judging the Flow as it stood");
-    expect(diagnostic.ending?.message).toContain(`The judge found: ${RESERVE_SAID.observed.replace(/\.$/u, "")}.`);
+    expect(diagnostic.ending?.message).toContain("Building this Flow has used $0.07 of its spending limit of $0.10, and what was left was too little to go on.");
+    expect(diagnostic.ending?.message).toContain(`Its last check found: ${RESERVE_SAID.observed.replace(/\.$/u, "")}.`);
     // The judge's words are said plain and whole, never inside quotation marks (t276).
-    expect(diagnostic.ending?.message).toContain(`What the judge says is left to change: ${RESERVE_SAID.changed.replace(/\.$/u, "")}.`);
+    expect(diagnostic.ending?.message).toContain(`What is left to change: ${RESERVE_SAID.changed.replace(/\.$/u, "")}.`);
```

Observed message for that test: "The build used its budget for this Flow before the Flow was finished. Building this
Flow has used $0.07 of its spending limit of $0.10, and what was left was too little to go on. The Flow (1 step) ran
from its start, but what it did was judged not to be what you asked. Its last check found: The test read the rows, but
no price column was read. What is left to change: Read the price of each row as well. I worked on it live once,
exploring the page. The steps I found so far were kept as ...". Not applied (not my file).

## Words the next live UI review must see

- **Budget ending (lane C shape):** "The build used its budget for this Flow before the Flow was finished. Building this
  Flow has used $0.08 of its spending limit of $0.10, and what was left was too little to go on. ... Its last check
  found: A step kept 82 rows from 5 pages with no filtering or removing duplicates. ... What is left to change: ...
  I worked on it live twice: ... What blocked the last fix: it was tried 7 times, and each time the step did not say
  which list on the page to read, or it was the same as a try already made, so it was not run again. The steps I found
  so far were kept as a draft, so building again carries on from them." Exactly one "$" pair; never "next call", "the
  judge", "kept back", "earlier builds", "Step N", "dedup", or an aside cut at "(e.g.".
- **Detect card** on a page that names its list (heading before it, or aria name): overlay/end title
  "Looking for the list “Search results”", card "Look · the "Search results" list". On a page that does not (lane C's
  unlabelled results): unchanged "Look · the repeating list on the page".
- **Model-facing detect result** (step files, not the chat): `list` when the page names it; each field has `sample`, and
  on atomic-class sites labels like `link: 'Tom Becker'`, `text: '1 mutual friend'` instead of class paths.

## Not verified

- No live run; whether real captures carry `parent` links and headings as siblings the way the fixtures do is untested
  on the ten scenarios.
- The extension was not rebuilt and its tests were not run (no extension file changed; it takes Core's titles/targets).
- Whole-package suites not run (twice-a-day rule).
- Whether "D3" is written in an architecture doc that now needs amending.

## Open questions or contradictions found

- The supervisor addition reverses D3's "no value" half (see above); confirm that is intended.
- Still raw elsewhere (outside the brief): other endings in `unfinished-build/` (`not-finished.ts`, `not-doable.ts`) still
  say "the judge"/"What the judge found this time", and `phases.ts` announces "The Flow is unchanged since the judge
  said ..., so what was kept back for judging is not spent judging it again" and "judging it with what was kept back for
  judging" as chat lines during a build. Same treatment would apply; tests `murzln6g-repair-funding.test.ts:150` and
  `reserve-unchanged.test.ts:97` pin those announces.
- `budget-exhausted.ts` no longer reads `projectedCostUsd`, `carriedUsd`, `keptBackUsd`, `nextRound`, `judgedUsd`'s
  amount; they stay on the type for the purse's record and `phases.ts`. A later cleanup could drop the unused ones.
