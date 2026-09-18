# w2-narrowing — making a narrowed job return the narrowed answer

Both acceptance tasks now return the right answer, and the unfiltered control is
unchanged. Three defects had to be fixed, in three different places; none of
them was in the instructions given to the model, and none was in the authoring
contract.

## What the built Flows actually did before the change

Reproduced live first, twice, before anything was designed.

`social-scheduler-week-ahead` and `property-listings-no-matches` both built a
Flow of exactly two nodes:

    web.browser.navigate -> web.dom.extract_list

No `select`, no `click`, nothing that narrows. The executed action list in
`run-mu6efrsv-f5b52d6a` is `web.browser.navigate, web.dom.extract_list` and its
`flowShape` is `{ nodeCount: 2 }`. The extraction then read the whole unfiltered
page: 288 of 288 homes where 0 were expected, and 280 of 280 posts where 14 were
expected.

The brief's `33 of 280` was a red herring. `run-mu6cwk2q-2d7d4200` records
`observedRecords: 33` beside **`invalidRows: 247`**: that run read all 280 rows
with a broken column mapping and 247 of them failed validation. It is not a
partially narrowed page. Across the whole corpus every narrowing-shaped job
returned its page's full count — 280 of 280, 288 of 288, 320 of 320 for
`company-directory-sector-sweep` and `company-directory-no-companies` — while
`social-scheduler-whole-queue`, which needs no filter, matched 280 of 280
exactly. Narrowing had never once happened.

None of the four questions in the brief was the cause. The filters were not set
and left unapplied, there was no wait problem, and the empty case had no
fallback. The Flow simply had no narrowing step in it at all.

## The cause

I instrumented Core's evidence loop temporarily to dump every decision the model
made and every evidence packet it was given (removed again; see *What I changed*
below). That turned a guess into three measurements.

**1. The model was never shown the controls.** The page evidence packet for the
social scheduler carried **18 elements out of 4,636, every one of them a post
link from the same table column**, and not one of the three filter selects
(`run-mu6edfgv-dd2b6d8d`). The cause is in
`apps/extension/src/content/dom-snapshot.ts`: elements are bucketed before they
are scored, and the first bucket is `isPrimaryControlElement` — "buttons, links,
menu items, tabs", which names **no form control at all**. A `<select>` fell into
the next bucket down. On a 280-row queue the links alone overflow the packet's
40-element bound, so every select, input and textarea on the page was structurally
unreachable. The model authored exactly the right Flow — choose the account,
choose the week, apply, read what is left — and, having only one handle, wrote
`target: target.1` on all three acting steps. The whole build was refused
`web.handle.wrong_control`, because `target.1` was an `<a>`.

**2. The evidence was gone by the time the Flow was written.** Core sizes the
first observation at `maxEvidenceContextBytes - 512` and that budget was 8,000,
so one packet could be 7,120 bytes of an 8,000-byte window. `evidenceContextWindow`
then filled the window newest-first, and the page observation is always the
*oldest* entry, so the second small tool result after it pushed the page out.
Measured in the token counts: the scheduler's decisions ran 5,880 → 6,065 input
tokens while the packet was present, then **4,067** on the third decision — the
one that writes the Flow. On the property page, where the selects *were* in the
packet at `target.14` and `target.15` with their real option values, the model
completing without them wrote `target.1`, `target.2`, `target.3`: the first three
positions, none of them the control that step needed
(`run-mu6efrsv-f5b52d6a`).

**3. The node catalog offered nothing that could act.** The catalog is ranked by
the words of the instruction, and only definitions scoring above zero reach it.
"Export the coming week's schedule for the Northwind Trails account as a table
with columns account, post, scheduled and status" contains no verb in any acting
intent group, so the catalog built for it live was, in full:

    ["builtin.control.end", "builtin.control.start",
     "builtin.data.write-records", "builtin.database.query",
     "web.output.dom-extract_list"]

Nothing that sets a control, nothing that presses one — while the Flow script
format was telling the model, in the same request, that narrowing first is
required and returning everything is a wrong answer. A job that reads part of a
collection is worded as a request for data, never as a list of actions, so
ranking on the instruction's words is the wrong question for an acting node. On
the property task this drove the model to spend 14 provider calls trying to
narrow by URL (`?bedrooms=5&price=up-to-250000`), wandering onto a listing detail
page and back, which made its handles ambiguous across two locations and failed
the build with `web.handle.ambiguous`.

The instructions given to the model were already correct on every point, and I
changed none of them.

## What I changed and where

**`apps/extension/src/content/element-traits.ts`** — added
`isPageControlElement`: the controls a page's own state is changed through
(`select`, `input`, `textarea`, `button`, `summary`, contenteditable, and the
ARIA widget roles). Also corrected `isPrimaryControlElement`'s doc comment,
which claimed a rank it no longer holds.

**`apps/extension/src/content/dom-snapshot.ts`** — `snapshotElementBucket` now
ranks those controls above links. A button satisfies both tests and the first
wins, so it stays with the fields it applies and what falls through is links,
summaries, menu items and tabs. This is not a fixture accommodation: a long list
of links is one repeating structure that `web.detect_repeating_structure` already
hands over as a single extraction handle, whereas the one `<select>` that narrows
that list is described nowhere else.

**`packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts`**
— `evidenceContextWindow` now reserves the newest result of each tool before
filling the rest of the window, so a 76-byte refusal the model has already acted
on cannot evict the page observation the Flow must be written from. An entry that
does not fit is skipped rather than ending the walk. Byte accounting is now
incremental and exactly matches `JSON.stringify` of the array.

**`.../runtime/loop-limits/flow-bootstrap-evidence-loop.ts`** —
`maxEvidenceContextBytes` 8,000 → `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES`
(24,000), sized for what a window has to hold at once rather than for one
observation. The live builds spend about 7,000–9,000 input tokens of the 48,000
their grant allows, so what bounds a build stays the grant's cost, tokens and
calls.

**`.../runtime/flow-bootstrap/plan/ranking.ts`** — a way to choose, to press and
to enter is now offered whether or not the instruction named one. They are
*preferred*, not required, so a domain registering none of them fails nothing,
and they come last among the preferences, so the list extraction a scraping job
cannot do without is still reserved first. A budget too small for them drops
them, which is where such a catalog stood already.

Core gained no web, DOM, URL, selector, tab or browser concept; the ranking
change uses Core's own existing intent vocabulary. Nothing was widened: every
acting step still resolves through the same handle store and the same
`web.handle.*` refusals, and `web.handle.wrong_control` still fires on a select
aimed at a button.

Tests: rewrote `catalog.test.ts`'s "does not offer it to an instruction that only
enters text", which pinned the assumption this change overturns, to state the new
truth precisely (the choice node is not something that instruction *asked for* —
not reserved, and dropped on a tight budget), and added two tests for the defect
itself: a data-shaped instruction is still offered a way to choose, press and
enter, and the extraction is reserved ahead of any of them. Updated the pinned
`maxEvidenceContextBytes` in `flow-bootstrap-evidence-loop.test.ts`.

## Observed results

Live, `pnpm lab:campaign social-scheduler-week-ahead property-listings-no-matches
social-scheduler-whole-queue`, after the change and with the instrumentation
removed and Core rebuilt:

| Task | Expected | **Observed** | Matched | Flow the model built |
| --- | --- | --- | --- | --- |
| `social-scheduler-week-ahead` | 14 | **14** | 14 of 14 | navigate → select → select → extract_list |
| `property-listings-no-matches` | 0 | **0** | — (0 expected) | navigate → select → select → click → extract_list |
| `social-scheduler-whole-queue` (control) | 280 | **280** | 280 of 280 | navigate → extract_list |

All three dataset judgements pass and all three oracles report `passed`. The
control is unchanged, so the narrowing fix did not break unfiltered extraction.

The built Flows are now the recorded workflows. The scheduler's is
`select account-filter = photogram-northwind-trails`,
`select range-filter = next-7`, then read — the option *values*, read out of the
packet, not the labels. The property site's adds the `click` on Search that the
scheduler does not need, because the scheduler filters on change and the property
site has a submit.

Checks run, with observed results:

- `pnpm --filter fluxiq build` — clean, twice (once after each Core change).
- Core `vitest run runtime/llm runtime/loop-limits runtime/flow-bootstrap` —
  **527 passed, 40 files, 0 failed.**
- `pnpm --filter @fluxiq-web-extension/extension test` — **678 passed, 0 failed.**
- `node scripts/structure-audit.mjs` — 1 violation, pre-existing and not mine:
  `scripts/lab/` has three files sharing the prefix `core-`, added by commit
  `407e1d9`. It wants `scripts/lab/core/` with the prefix stripped.

## Not verified

- **Only the three named tasks were run live.** The other narrowing jobs the
  corpus holds — `company-directory-sector-sweep` (40 of 320),
  `company-directory-no-companies` (0 of 320), `property-listings-area-search`
  (57 of 288), `social-scheduler-retry-failed` — have the same shape and should
  benefit, but I did not run them. `property-listings-area-search` in particular
  needs pagination to be followed as well as a filter applied, which this work
  did not touch.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run whole.** I ran the
  narrowest relevant suites named above plus the structure audit.
- **Sample size.** The table above is the final clean campaign,
  `test-runs/campaigns/2026-09-18T04-02-14-398Z` (runs `run-mu6fo536-634e1438`,
  `run-mu6fs0dg-b9781886`, `run-mu6ftzyq-dbc8af15`). The campaign before it,
  `2026-09-18T03-53-39-091Z`, ran the same code with the diagnostic probes still
  in and produced the same three counts (14 / 0 / 280), so each result
  reproduced twice. Provider behaviour varies and two runs is not a
  distribution.
- **The element-budget flood is fixed only where it starved the packet, not in
  general.** After the change the scheduler's packet is 3 selects followed by 37
  row checkboxes: the controls the job needs are present, but 280 mutually
  indistinguishable checkboxes still spend most of the budget, and the page's
  buttons and links no longer appear at all. `social-scheduler-retry-failed`
  needs the Retry button and would still not find it — as it would not have
  before, when the packet was 18 post links. A packet that carried one example of
  each repeating control instead of forty is the real fix and is not done.
- **The domain has a twin of the ranking defect I did not change.**
  `domain/src/recording/web-state/element/kind.ts` and `selection.ts` define the
  same `isPrimaryControlElement` buckets for durable web state. That path does
  not feed the LLM evidence packet — the packet takes `interactiveElements` from
  the extension in the order given — so it is not on the path fixed here, and
  changing recorded web state would move what assertions and the repair path
  compare against. Worth a decision, separately.
- **Two of the three runs still report verdict `failed`, for an unrelated
  pre-existing reason.** `security.redaction`: the attestation finds
  `.fluxiq/global.sqlite` in the workspace scope `unscanned-store`. This is not
  new and is not about narrowing — it appears in 16 runs across 6 lab instances
  since before this work, on `member-directory`, `support-desk` and
  `order-operations` as well, and on the `whole-queue` control that matched 280
  of 280. The dataset judgement and the oracle are what measure the answer, and
  both pass for all three. Somebody should decide whether that store should be
  scanned or declared out of scope; I did not touch it.

## Open questions

- Should `AUTOMATION_STUDIO_EVIDENCE_CONTEXT_BYTES` be shared with the recovery
  path's loop, which is bounded by the same three ceilings? I set it only for
  Flow Bootstrap, where the defect was measured.
- The catalog byte budget derives from `firstLiveMaxInputTokens: 4_000` while the
  grant allows 48,000 input tokens. That is a 12× gap, and it is why the acting
  nodes displaced `builtin.data.write-records` and `builtin.database.query` rather
  than joining them. Nothing broke, but the figure looks like it predates the
  current token limits.
