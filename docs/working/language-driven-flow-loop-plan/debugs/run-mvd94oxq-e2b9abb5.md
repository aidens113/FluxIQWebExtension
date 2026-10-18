# Debug: run-mvd94oxq-e2b9abb5

- Instance: bf-slot-3, task `social-network-feed-recent-group-posts` (audit-reworded instruction), authoring mode
  `project`, 2026-10-18 UTC, lane tree `fxwork/t566` synced to dev `48cdbfee` / Core `c1ed1bdd` (lanes 1-4 round 1
  merged, Core dist rebuilt). Steps: 119 (`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-17/run-mvd94oxq-e2b9abb5/steps`).
  LLM calls: 66.
- Verdict: **failed** (`runtime.behavior`), no Flow created; build ended `status=draft` at 1,040 s. Billed $0.107 of
  $0.25 (builder $0.049, supervisor $0.044, repair $0.014). Largest decision input 143,986 tokens. 27.7 min
  including a 7.8 min prelude.
- Shape: 51 decide, 14 judge, 12 submit_subflow, 7 test_subflow; brief 1 (builder) then brief 2 (repair); both
  ended in `repeat_refused` identical submits.

## How far it got

Lane 3 fix 1 and lane 1 fix 2b both held live: every trial paged the feed by scroll to "You're all caught up" (4
pages), and the stored rows now carry the right `author` and the full `posted` date from the time link's
aria-label ("Monday 21 September 2026 at 05:55"). The trials stored 4 rows.

## Why it failed (third distinct cause)

1. **Duplicate kept:** the Flow deduped by `posturl`, a column it excluded; the judges report `dedupes: false` and
   Elena Sokolova's committee notes stored twice (the feed shows them again as a recap). The site's post links
   carry a per-showing tracking parameter (`markup/unit.ts` `trackedHref(..., key)`), so the two showings likely
   differ by URL; not verified whether an excluded column can drive a dedupe at all.
2. **Text cut short:** `text` is the shortened post ending "… See more". Reads have no way to expand a row's own
   "See more", so a correct Flow must press it per row (possible since fix 4) or open each post; the builder did
   neither.
3. **Group column:** `group` holds the audience label ("Members of Riverside Allotment Society") rather than the
   group name the oracle expects; a model column choice, which the judges did not flag.
4. The date `matches` pattern was right this time; the judges' notes on it were partly wrong (one claimed it kept
   only 19-31 September).

Causes so far: run 1 paging (fixed, fix 1); run 2 template-dependent columns (fixed, lane 1 fix 2b); run 5 dedupe /
truncated text. Per the brief this task is recorded **open** after three failures on three different causes.

## UI review (chat cards)

The opening card restates the whole instruction and says what will happen ("working out its steps by trying them
on the page you had open and then test-running the whole Flow once from the start"); the panel sat on
"Starting..." for the first minutes with no other sign of progress.

## Next

Open. Candidate product work: dedupe by a kept identity that survives tracking parameters, and a read option that
reveals an item's own truncated text. Not started: the session is wrapping up.
