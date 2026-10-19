# Debug: run-mvecxeci-1c2cc227 (photo-social-newest-likes, r1)

Status: FAILED. Diagnosis only (brief R3, 2026-10-19). No source edits, builds, browser or paid runs.

## The run

- Task `photo-social-newest-likes`, built from the real extension chat (step 0001 `flow.createHere`).
  Instruction: like the three most recent posts the verified Harbourlight Studio account has published,
  reels included, nothing else; then a table, newest first, one column `link` with each post's address.
- Source: downstream 7ca0929f, Core 903ebb58 (from `run.json`). Chromium 134, slot 4, persistent-isolated.
- 26 provider calls, $0.0462, about 15.5 minutes (build 553.9 s; the one trial alone took 442 s).
- Ended: the only candidate trial (step 0049, revision 3, `trial.9d818d20-7889-4618-b773-692713fd3b35`)
  was judged "no"; the builder's next decision and then the supervisor's were refused by the cost
  reservation (`flow_bootstrap.run_budget_cost_exhausted`, core.log 22:03:49), so no repair ran and the
  Flow stayed a draft. No oracle, whole-run verdict or replay exists.

## What the site needs (from the task's own source)

`apps/scenario-lab/src/scenarios/photo-social/breadth/newest-likes/{workflow,expected}.ts`: the profile
grid shows three pinned posts first (20 Sep 2026 giveaway, Aug 2025, Mar 2026), then posts newest first.
The answer is cells 4 to 6: D1OKDvAEHfa (2 Oct), DgYZxS8LJOe (29 Sep reel), DPIEH3I491a (26 Sep). Each
grid cell is an `<a href="/p/<code>/">` holding an `<img alt="Photo by ... on <date>">` and, on pinned
cells, an icon labelled "Pinned post icon". The audit (`reports/audit-photo-social.md`) accepts a
root-relative or absolute link. The task is achievable and its wording leads to the oracle's answer.

## Step by step

| Step | What happened | Verdict |
| --- | --- | --- |
| 0003-0008 | Supervisor plan: one subflow, parts p1 (like the three newest) and p2 (table). Purse given: $0.0998 (`read_task.money.canGiveUsd`), brief allowance $0.0844. | Fine, but see "Budget" below. |
| 0010-0014 | Builder declines cookies, dismisses the notifications prompt, opens the profile. | Fine. |
| 0017 | `web.detect_repeating_structure` on t432 (the first grid cell): 12 items, columns img `src`, img `alt` (holds the date), an icon `aria-label` (sample "Pinned post icon"), two count columns. **No column holds the cell's own address**: the item element is itself the `<a href>`, and field inference never offers the item's own `href`. | **Earliest product gap.** The requested `link` column could not be read from this list. |
| 0018-0040 | Builder opens t432 three times as "the newest post" (it is the pinned 20 Sep giveaway; the "Pinned post icon" column sample was in its evidence from 0017), describes the heart repeatedly, three `already_answered` refusals. It never checked recency. | Model mistake (exploration only). |
| 0042 | First script: read the grid keeping only the alt column; `repeat over: posts` with `repeat most: 3` on each of open / like / close. The intent, "act on three rows", is right; no pinned exclusion. | Model's bound was the right idea. |
| 0043 | Core refuses: `flow_script.repeat_invalid` "repeat most beside repeat over. A repeat over runs once for each row its listing read; repeat most bounds a repeat while", plus two `repeat_most_misplaced`. No way to bound the rows is offered. | **Decisive divergence (product).** |
| 0044-0047 | Model removes the bound (it has no alternative), fixes the span label, revision 3 accepted: an unbounded loop with a `modify_existing` press over every row the read keeps. | Consequence of 0043. |
| 0049 | Trial: the read kept 24 rows; 24 passes. **Every pass opened the same cell**, "2.9K 47" = D96ahbWGjtY (all 624 comment links in the judge evidence are D96ahbWGjtY's), and the like press toggled Like / Unlike on that one post. A rate-limit notice appeared. 24 lasting acts are listed as left on the site. Stored: 24 rows, alt column only. | **Second product defect:** row scoping did not move the open press to each pass's row. |
| 0050-0051 | Judges: both "no". | Right verdict (below). |
| after 0049 | Builder's next decision refused by `llm_budget.run_cost_limit`; supervisor's too. | Budget, below. |

## Was the judge right?

Yes. The trial liked far more than three, the record set had no `link` column, and the acts were on a
pinned post. Judge call 1 is accurate (24 passes, toggling on D96ahbWGjtY, rate-limit notice). Judge call 2
wrongly says the three newest were liked "but so were 21 older posts": it read `rowsActedOn` (the rows
the loop was handed) as the posts acted on; the page evidence shows only D96ahbWGjtY opened. The "no"
does not depend on that error.

Both judges advised "a where/limit on the listing step keeping the three newest". Under the current
grammar that advice cannot work: `extractList.maxItems` and `sort` are moved off the page into the
record output's end-of-run processing (`domain/src/output-nodes/extract-list/one-page-read.ts`,
`OFF_THE_PAGE`), so they shape the saved answer, not the rows a For Each acts on; and `where` filters by
column values, never by position. A repair following the advice would have liked every non-pinned post.

## Causes

Cause class: **product defect** (three, in order of effect), with a model mistake the product could not
have corrected and a launch budget setting that removed the repair round.

1. **No way to act on only the first N rows a read kept (Core).** Owner:
   `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/authoring/draft-routing.ts`,
   function `scriptSpan` (refusal at line 326 for `repeat.over` with `repeat.most`); the For Each node
   `packages/fluxiq/src/programs/automation-studio/nodes/control-flow/for-each.ts` has only
   `maxIterations`, a safety limit that fails the pass when exceeded rather than stopping. The script
   guidance (`flow-bootstrap/plan/flow-script-format.ts`, the "rows a repeat over acts on" line) offers
   only `where`. Any "the N newest / first N / top N" act is therefore inexpressible. Generic, not
   photo-specific.
2. **A cell that is itself the link offers no address column (this repo, extension).** Owner:
   `apps/extension/src/content/extraction/infer-fields.ts`: `itemAttributeSources` reads only the item's
   own `data-*` attributes and `elementSources` walks `item.querySelectorAll("*")`, descendants only.
   `resolvesIn` already supports a selector-less source read off the item itself, so the rest of the
   pipeline can carry it. Any grid of linked tiles (image galleries, product tiles) is affected.
3. **A press on a control that is itself the repeated item is not scoped to the pass's row (this repo,
   extension).** Owner: `apps/extension/src/content/action-runtime/pass-row/resolved-for-pass.ts`,
   `resolvedForPass`, through `sitsInRepeatedRow` in `apps/extension/src/content/identity/record.ts`.
   The saved open press carried only `{ landmark: "main" }` (no record key, text or list position), so
   the "rows aside" resolution ran first and found cell 1. `sitsInRepeatedRow(cell)` is false because an
   `<a>` is not record-shaped and `controlRow` (`identity/control-row.ts`, `alikeTo`) looks for a twin
   with the **same accessible name**, while each cell's name is its own counts ("2.9K 47", "3.4K ...").
   So cell 1 was acted on in every pass, although the row's alt value would have placed the right cell
   through the values gate (`holdsRowValues` matches attribute values). This breaks the promise the
   script guidance makes ("a step inside the span that presses a row's control finds that row's own
   control on each pass"). Established by code reading plus the trial evidence; not reproduced in a
   browser.

Model mistake: the builder treated the first grid cell as the newest post and wrote no pinned exclusion,
although the pin column was offered. With fixes 1 to 3 a repair could express the right Flow generically:
`where` the icon column does not contain "Pinned" (a negated `contains`), `repeat most: 3`, and a link
column. The judge's feedback would have pointed it there had a repair round been paid for.

Contributing, operational: **Budget.** The build ran on Core's default $0.10 ceiling, not $0.25.
`--llm-max-cost-usd 0.25` can only lower the ceiling; only `FLUXIQ_LLM_RUN_COST_CEILING_USD` (or the Lab's
`--llm-cost-ceiling-usd`) raises it (`scripts/lab/live-campaign/lab-run/command.mjs` header;
`run.json` `fluxiqEnvironment` lists only the cache, instance and target variables). The project memory
records Lab tests at $0.25 since 2026-10-12; supervisor to confirm that rule. One judged trial cost
$0.029 because each judge request was 191k input tokens (650 KB: the loop's 72 presses each carry a
`changed` page diff, many repeating the open dialog's full comment list), after which neither builder nor supervisor could
reserve a call. Even with the ceiling raised, fix 1 is still needed: the advised repair cannot bound the
loop today.

Also observed, not proven a defect: the saved like control carries no accessible name (role, classes,
drawing, dialog only), so a pass on an already-liked post pressed "Unlike" and reported success. Whether
the identity deliberately drops state words for toggles was not checked.

## Shared cause with priya-tags?

Not the same root cause. Priya-tags (run-mvebbeom-a60886e1) failed on read completeness: a click-and-merge
loop whose tail stopped advancing, and a one-row answer out of five. Newest-likes failed on loop bounding,
row scoping and a missing link column. Both are loops over photo-social lists, but no code owner is shared.
They do share the operational factor: priya's purse was also $0.0998 (`canGiveUsd`), and its build also
ended on `flow_bootstrap.run_budget_cost_exhausted` (its core.log line 330) while the judge said the task
was still achievable.

## Proposed least, general fixes and the tests that prove them

1. Core: accept `repeat most: N` beside `repeat over:` as "the first N rows the listing kept, in its
   order". Add an optional For Each parameter that stops after N passes (route `done`), distinct from the
   failing `maxIterations`; `scriptSpan` emits it instead of refusing; one clause in
   `flow-script-format.ts` says so, with a generic example. Tests:
   `nodes/control-flow/tests/for-each.test.ts` (five items, bound 3: three body passes then `done`, no
   failure) and the draft-routing tests under `runtime/flow-bootstrap/authoring/tests/` (a script with
   `repeat over` plus `repeat most: 3` compiles to that For Each; a non-integer bound is still refused).
2. Extension: offer the item's own `href` as a `link` column when the detected item is itself an
   `<a href>`. Owner `infer-fields.ts` (`itemAttributeSources` or a sibling of it). Test:
   `apps/extension/src/content/extraction/tests/infer-fields.test.ts`, a run of `<a href>` tiles each
   holding an `<img alt>`: `inferFields` returns a link field with full coverage reading each tile's own
   href.
3. Extension: treat a control that is itself one of a run of same-shaped siblings (same tag and class)
   as sitting in a repeated row even when its name differs per row, so the pass's values gate places it.
   Owner `identity/record.ts` `sitsInRepeatedRow` (or `resolvedForPass`). Test:
   `apps/extension/src/content/action-runtime/tests/pass-row-resolution.test.ts`, a grid of link tiles
   with differing names and a pass row holding tile 3's alt: the press resolves to tile 3, not tile 1;
   and the existing page-level control cases still resolve as recorded.
4. Launch: set `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25` (or `--llm-cost-ceiling-usd 0.25`) for Lab builds,
   if the $0.25 rule stands.

None of these names this site, its posts, the pinned trap or the answer; no oracle, task wording or
fixture change is needed. A rerun must use a fresh workspace: this one has 24 recorded like presses on
D96ahbWGjtY whose final state was not inspected.

## Evidence

Run root `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-18/run-mvecxeci-1c2cc227`: `steps/0017` (detected
columns), `steps/0042`-`0047` (scripts and refusals), `steps/0049/result.json` (trial feedback, 24 rows,
`leftOnSite`), `steps/0050-judge/request.txt` (saved nodes, `rowsActedOn`, per-press `changed`),
`steps/0008-tool-project.dispatch/result.json` (allowance, refusal reason), `logs/core.log`.
