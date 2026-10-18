# Audit: social-network-feed (t715, worker `audit-social-network-feed`)

## Outcome

Done. All 13 `social-network-feed` rows in `REALISTIC_SITE_LIVE_TASKS` have a verdict. 7 rows were
reworded (5 originals, 2 additions), 1 fixture fix went in (the timestamp hover card), and none had a
wrong oracle. Every row can be done and has a browser path in `social-network-feed/tests/` that reaches
its oracle. The site's own tests, the package check and the structure audit pass.

**One test outside my paths now fails and needs the supervisor:** `scenarios/tests/realistic-site-live-tasks.test.ts`,
"qualification additions preserve the complete ordered original 57 tasks". It compares the original
rows with `scenarios/tests/fixtures/realistic-task-baseline.ts`, and five original rows were reworded
(entries listed under "Entries a change needs").

## Two facts that drive the verdicts

These come from reading the comparator, `packages/test-runner/src/run-expectations/extraction/`:

- **Records are matched by position** (`measureExtraction`, `matchesExtractionRecord`). Order-only
  mismatches are diagnosed but still fail. So any table with more than one row must say its order.
  Three did not (feed digest, recent group posts, hide suggested posts).
- **Values are compared exactly.** The only exception is root-relative against same-origin absolute
  URLs (`value-match.ts`). So a date has to be asked for in the site's own form. Four tables ask for a
  "full date and time", and the site writes it one way: "Monday 21 September 2026 at 05:55".

**A fixture gap:** that full date existed only as the timestamp link's `aria-label`. The page showed
"3h" or "2d", and the post page shows the same short label. `content/clock.ts` already described a
"hover card", but none was wired: the `hoverCard` class and its style existed with nothing using them.
A sighted person had no way to read the date any table asked for.

## Per-task verdicts

### social-network-feed-group-post: ok
- Possible: the recording reaches the playback goal (the pending box text) in the new
  `tests/original-task-paths.test.ts` ("group post: the recording leaves ..."), and in the e2e spec.
- Unambiguous: the group name matches the shortcut and the group page exactly ("Riverside Allotment
  Society"). The text is word for word, and "waiting for the group's admins to approve it" is the page's
  own "Your pending posts / Admins will review your post". The goal fails on a trapped (spam)
  submission, a swallowed single press, a poll, or a second post.
- Judge: the pending box shows the post. Purse: 3 overlays, open group, open composer, type, Post
  twice. That is small.

### social-network-feed-group-post-regrouped: ok
- Possible: on the armed `regrouped` page, Create post opens the same dialog and the run reaches the
  same goal (new test "group post on the redesigned group page ..."). The e2e spec shows Create poll
  fails it.
- Unambiguous: the instruction says "post", and the page offers Create post, Create poll and Create
  event, so only Create post fits. Judge and purse are as for the baseline row.

### social-network-feed-group-post-regrouped-after-creation: ok
- Possible: the same new test first runs the baseline recording on `regrouped`. It stops at
  `group-open` (the recorded prompt is gone), and re-pointing at Create post reaches the goal. The
  e2e spec covers the same path. Wording is shared with the two rows above.

### social-network-feed-feed-digest: reworded
- Old: "...collect every post my friends wrote themselves, including the ones they posted in groups.
  ... Give me a table with columns author, ...: author is the friend who wrote it, ..., posted is its
  full date and time rather than a short label like 3h, ..."
- New: "...collect every post my friends wrote themselves, and every post anyone wrote in one of my
  groups. ... Give me a table in the order the feed first shows them, with columns author, group,
  posted, text, reactions and comments: author is who wrote it, ..., posted is its full date and time
  exactly as the site writes it rather than a short label like 3h, ..."
- Why:
  1. Order was unstated, but records are positional.
  2. The date form was unstated, but values are exact.
  3. "my friends ... including the ones they posted in groups" assumed every group poster is a
     friend. The site cannot show that: Oliver Hughes (Old Town Bakers' Circle) appears nowhere but
     his group post. No profile states friendship, and `friends/list/` serves the Friends home. The
     oracle includes him, so the instruction now names group posts by anyone in Maya's groups.
     Suggested group posts come from groups she has not joined and stay excluded.
- Oracle unchanged: 16 rows. Possible: the new test "feed digest: the recording reads the sixteen
  posts ..." matches it, as does the e2e spec. Unambiguous after the rewording:
  - adverts ("Sponsored", scrambled in the DOM but visible), "Suggested for you", the two shares, Maya's
    boosted post, the memory, and both recaps ("list each post once") are all named exclusions;
  - "first shows" fixes where a recapped post sits;
  - an empty field shows no count element, which the oracle spells `null`.
- Purse: about 6 scroll loads, 4 See more, and one 16-row, 6-column read with four long texts. This
  is the heaviest read on the site. Feasible, but it is the row most likely to run long within $0.25.
  No live run of it appears in the lane debug notes.

### social-network-feed-feed-digest-quiet-feed: reworded (shares the instruction)
- Same old and new text as the digest. The oracle is 7 rows (first 15 units), walked in
  `tests/variant-and-naive-paths.test.ts` ("quiet feed: ..."). Purse: smaller than the baseline.

### social-network-feed-feed-digest-app-install: reworded (shares the instruction)
- Same old and new text as the digest. "Continue in browser", then the baseline digest, walked in
  `tests/variant-and-naive-paths.test.ts` ("app install: ...").

### social-network-feed-confirm-requests: reworded
- Old: "Go through my friend requests and confirm everyone ..."
- New: "Go through all of my friend requests and confirm everyone ..."
- Why: the top-bar badge says 4 and the Friends home previews four cards, and both agree with each
  other while the list holds eight. Two of the four qualifying requests (Lin Zhao, Freya Holm) are past
  the preview. "all of" leaves no reading in which the four-card preview is "my friend requests". It
  matches the delete-stranger wording and does not say where the rest are.
- Unambiguous otherwise:
  - "at least five": 23, "Aisha Khan and 4 other mutual friends" (= 5), 11, and 5 qualify;
  - Priya Nair's 4 does not, and neither does the second Tom Becker's 1;
  - the suggested Jonas Weber is not a request;
  - order is the list's;
  - mutualFriends is "exactly as their request shows it".
- Oracle unchanged: 4 records plus the server facts per request. Possible: the new test "confirm
  requests: the recording waits out the rate limit ..." passes both the table and every server fact.
  The e2e spec covers the same path. Purse: one rate-limit wait (up to 15 s) and about 8 acts. Live
  failures for this task in the lane notes are product causes (grammar, reruns, exploration presses),
  not wording.

### social-network-feed-move-open-day: reworded
- Old: "...everything else about it, including who can see it, should stay the same. ... posted is its
  full date and time."
- New: "...everything else it says, and who can see it, should stay the same. ... posted is its full
  date and time exactly as the site writes it."
- Why:
  1. "Everything else about it" cannot be kept. The post's reactions, comments, boost and time are
     lost by the only possible path (trash and repost), so a careful reader could judge the task
     impossible. The intent is its words and its audience.
  2. The date form, as above.
- `tests/scenario.test.ts` asserts the new phrase. Oracle unchanged: one row, audience "Public",
  posted "Monday 21 September 2026 at 09:00". Possible: walked in `tests/variant-and-naive-paths.test.ts`
  ("move open day: the permitted path ...").
- Without delete permission the right ending is the permission stop at Move, as declared. The audience
  is visible as the globe icon's SVG `<title>` tooltip. Purse: about 15 acts.

### social-network-feed-audit-pending-requests: ok
- Possible: walked in `tests/variant-and-naive-paths.test.ts` ("qualification final: complete eight
  ..."). "complete request list" and "leave it empty when none is shown" (Diego Alvarez, `""`) are
  explicit. url is matched as root-relative or same-origin absolute. Order is stated, and "suggested
  people" are excluded. Read only.
- Judge: yes. Purse: small.

### social-network-feed-recent-group-posts: reworded
- Old: "...and collect every post that was written in one of the groups I'm a member of on or after
  ... Give me a table with columns group, ..., posted is its full date and time rather than ..."
- New: "...and collect every post in it that was written in one of the groups I'm a member of on or
  after ... Give me a table in the order the feed first shows them, with columns group, ..., posted is
  its full date and time exactly as the site writes it rather than ..."
- Why:
  1. Order and date form, as above.
  2. "in it" ties the collection to the feed. The Riverside group page lists posts the feed does not
     (Walter Grieve, Sunday 20 September 11:00, is in Maya's group since Saturday), which a reader who
     went to the group pages would have added.
- Oracle unchanged: Elena 05:55 Monday, Sofía 20:46 Sunday, and Oliver 03:35 Sunday. Tom Becker
  (Friday 18) and Dev Patel (Tuesday 15) fall outside the date range, Kim Tran's Urban Growers post is
  from a group Maya has not joined, and the recap is a repeat.
- Membership is visible: "Your shortcuts", "Joined" against "Join group", and the suggested post's
  "Join group". Possible: walked in `tests/breadth-paths.test.ts`.
- Purse: scroll to the end, 2 See more, one 3-row read. Two live runs (t566) failed on product causes
  (scroll paging, positional template columns), not wording.

### social-network-feed-hide-suggested-posts: reworded
- Old: "...give me a table of the posts you hid with columns community and text, ..."
- New: "...give me a table of the posts you hid, in the order the feed showed them, with columns
  community and text, ..."
- Why: 2 rows, matched by position.
- Unambiguous otherwise:
  - "marks as suggested for me" is the page's "Suggested for you";
  - "down to where it says I'm all caught up" leaves out the suggestions under the "Suggested posts"
    heading below it;
  - "hide nothing else" covers shares, friends' posts and adverts. An advert's hide leaves no server
    trace, and the instruction already forbids it.
- Oracle unchanged: Urban Growers Network, then Kettle & Crumb, both short texts. Possible: walked in
  `tests/breadth-paths.test.ts`. Purse: scroll to the end, 2 hides, one read. One live run (t566)
  failed on a row-bound click after the row changed shape, a product cause.

### social-network-feed-delete-stranger-requests: ok
- "no mutual friends at all" matches only Diego Alvarez, whose card shows no line. The second Tom
  Becker's "1 mutual friend" is not none. "not just the first few" is explicit, and order and url are
  stated.
- Possible: walked in `tests/breadth-paths.test.ts`, and **passed live** (t566 run-mvd1j7jt-0c12a50c).
  Purse: small.

### social-network-feed-claim-found-key: reworded
- Old: "... posted is its full date and time and text is the whole post."
- New: "... posted is its full date and time exactly as the site writes it and text is the whole post."
- Why: the date form, as above. The oracle (Dev Patel, "Tuesday 15 September 2026 at 12:50", whole
  text) is unchanged. It is the only found-items post in Harbourside Runners, and the claim must go to
  that group: the final state catches the Riverside group, a poll, spam, a second post, or a single
  swallowed press.
- Possible: walked in `tests/breadth-paths.test.ts`. Purse: about 8 acts plus one read.

## What changed and why

- `client/unit-script.ts`: pointing at a timestamp (`a[href*="/posts/"][aria-label]`) mounts a
  `role="tooltip"` hover card on `document.body` with the label's text. It uses the existing
  `hoverCard` class and `pointer-events:none`, so it never takes a press or enters an article's
  extraction. Moving off the timestamp removes it. This is the fixture fix behind "posted ... exactly
  as the site writes it".
- `live-tasks.ts`: the seven rewordings above. No oracle, fixture data or permission point changed.
- `tests/scenario.test.ts`: the move-open-day phrase assertion follows the new text. A new test checks
  that every table of more than one row states its order, and every `posted` column asks for the
  site's own full date.
- `tests/original-task-paths.test.ts` (new): browser walks to their oracle for the group post, the
  regrouped group post (both rows), the feed digest and confirm-requests, including the server facts.
  It also checks the hover card shows "Monday 21 September 2026 at 05:55".

## Entries a change needs (outside my paths)

`apps/scenario-lab/src/scenarios/tests/fixtures/realistic-task-baseline.ts`: set the `instruction` of
these five rows to the new text exactly as in `social-network-feed/live-tasks.ts`:

- `social-network-feed-feed-digest`, `-feed-digest-quiet-feed` and `-feed-digest-app-install` (the
  `FEED_DIGEST` constant);
- `social-network-feed-confirm-requests` (`CONFIRM_REQUESTS`);
- `social-network-feed-move-open-day` (`MOVE_OPEN_DAY`).

A node check over the built dist confirmed these five are the only rows that differ from the baseline.

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`): build
  succeeded, "inputs changed: apps/scenario-lab ... ms 51739".
- `node --test "dist/scenarios/social-network-feed/**/*.test.js"`: `# tests 52`, `# pass 52`,
  `# fail 0`. That includes the five new browser walks, each `ok`, and the new instruction test.
- `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js` (to see the effect outside my
  paths): tests 1-3 `ok`. Test 4, "qualification additions preserve the complete ordered original 57
  tasks", is **`not ok`** because of the five rewordings above.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: exit 0.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (204 warning(s), 638 baselined)", with
  no finding in a social-network-feed file.

## Not verified

- No live Lab run of any reworded instruction (not in scope).
- The e2e spec (`apps/scenario-lab/e2e/social-network-feed.spec.ts`) was not run. The new hover card
  only adds an element to `body` on pointer-over.
- I did not check whether the extension's page view surfaces the hover card's text when a model's
  pointer rests on a timestamp. The model can already read the `aria-label`.

## Open questions or contradictions found

- **Empty values are stored two ways on this site, and the comparator tells them apart.**
  `audit-pending-requests` expects `""` for Diego's empty mutual-friends line, because the element is
  present but empty. `feed-digest` expects `null` (optional) where no count element is drawn. Each
  matches what the page's DOM gives a reader. But a Flow that writes an empty cell as `""` in the
  digest, or omits the field in the audit, fails, though both mean "empty". Consider having the judge
  treat `""` and `null` as equal for an empty cell. That would be a runner change, not this site's.
- The lane notes name no task here that failed on wording. The failures were product causes (paging,
  template columns, row-bound clicks, grammar). The rewordings are from reading the instruction against
  the site and the comparator.
