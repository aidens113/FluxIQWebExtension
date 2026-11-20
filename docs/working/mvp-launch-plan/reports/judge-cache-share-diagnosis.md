# Judge cache share, run 30 (run-mwoxglkg-e37fd49b, bigbox new-store-cheapest-towels, $3.92)

Read-only diagnosis; no code changed. Steps: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-20/run-mwoxglkg-e37fd49b/steps/`
(the lane tree's `test-runs/` holds no steps; the run's debug file names this path). Sizes are bytes of request text; tokens from `meta.json` usage.

## Cause (confirmed)

Continuation works as designed, but the judge's own message is 3 to 6 times larger than the decider prefix it reuses,
and it is sent uncached every time. Two parts:

1. **The judge's message is almost all new trail.** The decider's evidence holds about 8 compact tool entries (13 callIds,
   most of them Core's own `core.*`). The judge's `resultSummary.trail` is the attempt's whole log, a different and much
   fuller rendering: each entry carries a `found` page view of 7 to 16 KB. At 0207 the trail has 35 entries and 302 KB;
   only 2 of them are in the decider's evidence, so `shownAbove` removes 2 and the rest is appended. The prefix is the
   decider's evidence, which was never the full trail.
2. **The appended judge block carries no `cache_control`** (judge marks are only blocks 0 and 8, both from the decider).
   So `cache write` is 0 on every continuation judge, and the next judge of the same attempt pays for the same ~200k
   tokens again. Judges 0207, 0214 and 0225 sent near-identical 357 to 370 KB appended blocks, all fresh, 0 to 1 s apart.

## Run 30 judge table (all attempt 1 per meta; all deltas to the decider are 0 to 1 s)

| Step | Model | Mode | Input | Cache read | Fresh | Write | Prefix (B) | Appended (B) | $ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0094 | sonnet | continuation | 123,330 | 46,673 (38%) | 76,657 | 0 | 105,334 | 135,938 | 0.166 |
| 0099 | sonnet | continuation | 123,650 | 46,865 (38%) | 76,785 | 0 | 105,839 | 136,307 | 0.166 |
| 0207 | sonnet | continuation | 228,097 | 25,062 (11%) | 203,035 | 0 | 58,348 | 356,167 | 0.414 |
| 0214 | sonnet | continuation | 229,168 | 25,675 (11%) | 203,493 | 0 | 59,548 | 357,040 | 0.416 |
| 0225 | sonnet | continuation | 243,503 | 32,106 (13%) | 211,397 | 0 | 72,563 | 370,485 | 0.433 |
| 0232 | haiku | standalone | 47,683 | 0 | 47,683 | 39,147 | n/a | 14,713 (judge msg) | 0.006 |
| 0233 | haiku | standalone | 48,123 | 39,147 (81%) | 8,976 | 0 | n/a | 16,168 | 0.002 |
| 0254 | sonnet | continuation | 72,276 | 21,158 (29%) | 51,118 | 0 | 48,824 | 88,025 | 0.111 |
| 0259 | sonnet | continuation | 72,654 | 21,382 (29%) | 51,272 | 0 | 49,259 | 88,312 | 0.113 |
| 0270 | sonnet | continuation | 84,620 | 28,054 (33%) | 56,566 | 0 | 64,418 | 96,862 | 0.124 |
| 0277 | haiku | standalone | 47,846 | 3,537 (7%) | 44,309 | 35,774 | n/a | 14,713 | 0.006 |

Cache read tokens track the prefix share almost exactly (0207: prefix 58 KB of 414 KB user text = 14%, read 11%).
Sonnet continuation judges cost $1.34 of the $1.96 judge spend, all of it the uncached appended trail. The decider
requests they continue are only 74 to 108 KB (0206: 80,756 B, 22 KB of it after its last mark), so even a perfect prefix
could cover little of a 414 KB judge request.

## Causes ruled out

- **Replays with no decider prefix:** no. Every Sonnet judge reports `continues_the_decider`.
- **Expired past 5 minutes:** no. Judge starts 0 to 1 s after the decider it continues.
- **Model mismatch after a climb:** not for the Sonnet judges (same model as the decider just before). The three Haiku
  judges (0232, 0233, 0277) are standalone with `no_decision_in_this_attempt` (the attempt had climbed to Sonnet; no Haiku
  decider prefix under that key). They are tiny ($0.002 to $0.006) and not the cost.
- **Breakpoint placement:** minor. The decider's last mark is at block 8 of 15 (22 KB after it unused), but even full
  use would not change the order of magnitude.

## Other runs (same pattern)

- run-mwovplov-72e78c93 (professional-network): Sonnet judges 0113, 0150, 0225 read 27.6k/40.1k/30.8k of 104k/120k/112k
  (27 to 33%), appended 155 to 163 KB vs prefix 65 to 93 KB, $0.17 each; Haiku judges 0307 and 0310 are identical
  requests (121,939 in, 42,519 read, 0 written), so the second did not benefit from the first.
- run-mwounh32-24f9bc6b (social-network-feed): judges on Haiku/Sonnet/Opus read 33 to 37% (prefix 73 to 83 KB, appended
  117 to 145 KB), write 0; one Haiku standalone after the decider changed (0220, 113 s gap, `no_decision_in_this_attempt`).

The lower 11 to 13% in run 30 is the larger trail (302 KB of entries) against a small decider context, not a different fault.

## Smallest fix (not a cap)

1. Put an ephemeral `cache_control` on the judge's appended user block in `automationStudioAnthropicJudgeContinuation`
   (`continuation.ts`, line 80). The appended trail is then written once (1.25x) and the next judge of the attempt,
   which repeats it with a few new entries, reads it. Order matters: trail entries must stay in a stable order so the
   later judge's request extends the earlier one byte for byte (the 0207/0214/0225 trails differ by only a few entries).
2. Better, a stable trail rendering: hold the previous judge's request as a prefix too (as deciders are held per attempt
   key in `llm/anthropic/provider.ts`), so a judge continues the latest judge or decider, whichever is longer.
3. Optionally and separately: the trail's per-entry `found` page views (7 to 16 KB, several entries equal in size, i.e. the
   same page repeated) are what makes the message large; the judge judges the answer, so ask whether each entry needs its
   whole page view. That changes judge evidence, so it is a decision for the lead.

## Not verified

No live call was made. I did not check how the Anthropic API counts the tail of a request after the last mark for a
later request, so the saving from (1) is an inference from the Haiku standalone pair (0232 wrote 39,147, 0233 read it).
Attempt numbers in meta read as 1 for every judge, so I matched deciders by model and order, not by attempt key.

## Addendum: what the trail bytes are (lead's four questions)

Measured on the judge requests' `resultSummary.trail.entries` with throwaway node scripts (scratchpad `pv.mjs`, `pv2.mjs`).
A "page view" is a `found` sub-field: `fields` (extracted field list), `page` or `view`. Byte-identical means the same
JSON string as an earlier entry's same sub-field in the same trail. A `pageViewSameAs: <callId>` stub is costed at 20 B + the id.

Note first: the trails at 0207, 0214 and 0225 are the same size (302,504 B entries, 35 entries) and the three sub-field
tallies are identical, so the three judges ask about the same trail; the later two differ only in a few bytes.

**3. Fields by share (run 30, 0207):** `found` 286,778 B (95%), `asked` 9,118 (3%), `where` 1,466, `outcome` 1,433, `did` 1,320
(each under 1%). Inside `found`: `fields` 132,003, `page` 86,093, `view` 39,620, `changed` 9,548, `atNote` 4,224.
(mwovplov 0150: `found` 85%, `asked` 9%, `where` 3%; inside `found`: `page` 48.7k, `fields` 22.8k, `found` 16.2k, `read` 7.0k.)

**1. Byte-identical repeats (run 30, 0207/0214/0225, same numbers each):**

| Sub-field | Instances | Bytes | Repeats of an earlier one | Saved by `pageViewSameAs` |
| --- | --- | --- | --- | --- |
| `fields` | 11 | 132,003 | 9 | 116,973 |
| `page` | 14 | 79,170 | 9 | 52,251 |
| `view` | 6 | 39,620 | 4 | 26,324 |
| Total | 31 | 250,793 | 22 | 195,548 (65% of the 302,575 B trail) |

So about 196 KB of the 357 KB appended block is exact repeats of the same page (the run re-looks at the same unchanged
cart/pickup page). At 0207's 203k fresh tokens, that is roughly 2/3 of them, about $0.27 of the $0.41.
run-mwovplov 0150 (trail 134,523 B): `fields` repeats 2 of 5 (7,242 B saved); `page` 0 repeats of 8; total 7,242 B (5%).
There the pages are distinct, so the dedupe barely helps.

**2. Line-level delta against the previous entry's view** (applied to non-identical views only, counted only when
smaller than the whole view; removed lines costed 8 B each plus 30 B per entry): run 30 saves 15,847 B (`page`, 3 entries;
`fields` and `view` none), about 5% on top of the exact-repeat saving. mwovplov: 4,527 B (1 entry). Deltas are small
because consecutive non-identical views differ in most lines (cart contents and store lists reorder); identical-repeat
stubs are where the saving is.

**4. Does the decider's evidence already hold the page views?** No, by this test: for each page-view string over 200 B I
probed 80 characters from its middle against the decider request's text (0206, 0213, 0224). 0 of 31 run-30 views are
in it; mwovplov 0149 also 0 of 13 with this probe (an earlier probe on a different start offset found 2 of 7 `page`
views, 13,269 B, in 0112's request, so some overlap exists there). The decider carries a compact current view and the
latest few call results, not each past page. So the trail does not repeat the cached prefix; the prefix is not a
substitute for it, and the trail is genuinely new text to the cache.

**Consequence for the fix.** `pageViewSameAs` gives about 65% fewer bytes on run 30 but little on mwovplov, so it
fixes the repeated-page case, not every case. Because the judge's message is new relative to the cached decider
prefix, the share rises only by shrinking it or by caching the trail itself, so the lead's point stands (my earlier
`cache_control` suggestion only helps if consecutive judges extend one another).

Not verified (addendum): the decider-overlap probe is a substring test of one 80-character slice per view, so it can miss
views that the decider holds reformatted; the delta cost model is a rough line diff, not the encoding that would be built.
