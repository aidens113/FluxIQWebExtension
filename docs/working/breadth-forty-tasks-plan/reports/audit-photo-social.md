# Audit: photo-social (t714, worker `audit-photo-social`)

## Outcome

Done. I audited all nine photo-social rows in `REALISTIC_SITE_LIVE_TASKS`: four originals, the upsell variant row, the
qualification row and four breadth tasks. Seven are ok as written. Two had a real ambiguity, and I fixed both at the
source without changing any oracle: the `newest-likes` instruction was reworded, and the giveaway's rule text in the
fixture was fixed (this covers two rows, because the base task and its upsell twin share one instruction). Every task
already had a browser-path test that reaches its oracle, so I added none. I found no photo-social debug notes in the
lane trees (t563, t565, t566, t567), so there is no live evidence of a wording failure on this site.

## What changed and why

| Task id | Verdict |
| --- | --- |
| `photo-social-glaze-collection` | ok. Exactly one answer follows: the top three August 2026 posts have 1,249, 1,236 and 1,212 likes, and the next has 1,207. The word "verified" rules out the impersonator's 5,020-like August post. Each exact count shows on the post's own page, and the playback goal checks the collections only. Purse: heavy but plausible (see below). |
| `photo-social-giveaway-entries` | **fixture fixed** (the pinned rule text). Old rules and caption: "tag two friends in a comment". New: "tag **at least** two friends in a comment". Why: two of the oracle's thirteen entries tag three friends (omar.farouk; grace.adeyemi's first entry, on 22 September). Read as "exactly two", omar drops out and grace's entry moves to her 26 September comment, which gives a different table. The oracle (`giveawayEntries`) is unchanged; the rule text now says what the oracle already applied. The other checks pass: self-tags and studio tags don't count as friends (rule stated); kiln.theory counts as a friend (only "us, or yourself" are excluded); comments after 27 September don't count; one entry per person at the earliest qualifying comment (no person has two on the same day); ines.vidal's entry is a reply (the rules say "replies count too"); dates come from `time@datetime`. |
| `photo-social-giveaway-entries-verified-upsell` | **fixture fixed** (same instruction and rule text as the row above). The upsell's "Not now" is the only safe answer; "Subscribe" leads to a payment form. |
| `photo-social-moon-jar-price` | ok. The only way to the price is the shop's instant reply to a message that names the piece. The card shows "Speckled moon jar" and "€68.00". The product page is linked only from that card. The Send permission point is right, because the instruction never asks for a message to be sent. |
| `photo-social-extend-studio-inspo` | ok. The three posts are the same ones as in the glaze task. The 9 August post is already in Studio inspo, so pressing its row in the dialog would remove it (a trap, and a correct one). The final count is "7", and "its final number of posts" asks for the number, not "7 posts". Saving the two posts it adds is part of adding them, and the instruction does not forbid it. |
| `photo-social-priya-tags` | ok. The five rows are exactly the comments and replies whose text mentions @priya.nair, in thread order. Priya's own comment does not tag her. The impersonator's copy of the post has no tags of her. |
| `photo-social-newest-likes` | **reworded.** Old: "Like the three most recent posts the verified Harbourlight Studio account has published, and do not like, …". New: "… has published, **reels included**, and do not like, …". Why: the oracle's second post is the 29 September trimming reel. The profile has a separate Reels tab, so "posts" could be read as photos and carousels only, which would put the 24 September carousel in place of the reel. The pinned trap is unchanged. Link format is not a risk: the judge accepts a root-relative or same-origin absolute URL (`run-expectations/extraction/value-match.ts`). |
| `photo-social-august-over-1300` | ok. The empty table is right, and the instruction says so. Every studio post of August 2026 is at or below 1,249. The grid's "1.2K" is under 1,300 whether the site rounds down or to the nearest hundred. The reel's grid count is plays; its page shows 640 likes. The 2025 pinned post, the impersonator and Kiln Theory are each ruled out by a word in the instruction. Product risk (named by the authors, not a task defect): whether Core stores a zero-row dataset. |
| `photo-social-kiln-notes` | ok. Kiln Theory has exactly two posts, both saved and both in Studio inspo. Kilnworks has nothing saved. The studio's saved kiln photo is a lookalike trap. On the Saved page the tiles are All posts, then collections in creation order, so the new one comes last: Kitchen 3, Studio inspo 5, Kiln Theory notes 2. The tile shows the number and the word "posts" in separate spans. |

The **judge can check every task**: each value in an oracle is on the page (exact like counts on post pages, comment
days in `time@datetime` and the tooltip, collection counts on the Saved tiles, the price on the reply card).

**Fits the purse (rough honest-path counts):**
- `priya-tags`, `newest-likes`, `kiln-notes`, `moon-jar-price`: light, about 3 to 8 pages and 4 to 12 acts.
- `giveaway-entries`: 1 post page, 4 "Load more" presses (the first is swallowed), up to 5 reply toggles, and 41 comments to read. The page view is large but it is one page.
- `august-over-1300`: the profile, two scrolls, "Try again", the session check, then one read.
- **Flag (tightest): `glaze-collection` and `extend-studio-inspo`.** Each loads the grid through the rate limit and the session check, opens the four posts that show "1.2K", then saves and files three posts through the dialog or the picker: about 20 to 30 acts. That is plausible but tight at $0.25. I made no change, because the work is the task's intent.

**Applies to every task:** each oracle needs `consent: essential`, meaning optional cookies were declined, but no
instruction mentions cookies. The dialog's scrim blocks every click until the dialog is answered, and declining is the
only answer that doesn't agree to optional tracking for the user. Company-website and everything-store follow the same
pattern. I left it alone; whether instructions should say this is a corpus-wide decision for the supervisor.

**Files changed** (all under `apps/scenario-lab/src/scenarios/photo-social/`):
- `live-tasks.ts`: the `NEWEST_LIKES` wording.
- `data/giveaway.ts`: `GIVEAWAY_RULES` and its doc comment.
- `data/studio-posts.ts`: the giveaway caption, which the impersonator's copy also uses.
- `tests/scenario.test.ts`: pins that the rules and caption say "at least two", and that an entry with three tags exists.
- `breadth/tests/expected.test.ts`: pins that a reel is among the three newest and that the instruction says "reels included".

No shared-test changes are needed. `scenarios/tests/fixtures/realistic-task-baseline.ts` holds the original
photo-social instructions, which I did not change, and does not hold `newest-likes`. The two shared corpus tests pass
as they are.

## Commands run and observed results

All run in `C:/Users/osrs_/FluxStuff/fxwork/t714-audit-photo-social`.
- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`): built, "inputs changed: apps/scenario-lab", 31,210 ms.
- `node --test dist/scenarios/photo-social/tests/*.test.js dist/scenarios/photo-social/breadth/tests/*.test.js dist/scenarios/photo-social/qualification/tests/*.test.js`: "tests 41, pass 41, fail 0" (171 s). This covers the browser honest and naive paths, the breadth paths and the expected-data tests.
- `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js dist/scenarios/tests/live-instructions.test.js`: "tests 17, pass 17, fail 0". These are read-only runs of the shared corpus tests.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: exit 0.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (204 warning(s), 638 baselined)", exit 0.

## Not verified

- No live Lab run. I did not check whether a model actually reads "reels included" or "at least two" the intended way.
- The purse estimates are counts of pages and acts, not measured costs.
- Whether Core stores the zero-row dataset that `august-over-1300` needs.

## Open questions or contradictions found

- Should instructions state the cookie-decline expectation that every oracle checks, or does it stay an unstated product rule? This affects every site.
- `extend-studio-inspo` says "do not like, follow or message anyone". "Like anyone" is loose wording, but the meaning is clear, so I left it.
