# Audit: professional-network (t717)

## Outcome

Done. I audited all nine professional-network tasks. Six are ok as they stand. Two instructions were reworded and
the oracles were not changed: the Rotterdam instruction (shared by its premium-upsell variant row) and the
Netherlands instruction. One task, invitation-allowance, had its fixture fixed (the coordinator's follow-up): the
site now shows the weekly invitation limit notice that its instruction quotes. No oracle changed.

## What changed and why

Two edits in `apps/scenario-lab/src/scenarios/professional-network/live-tasks.ts`:

The Rotterdam and Netherlands oracles are `peopleMatches({keywords: "data engineer", ...})`. They contain whatever
that one search returns, compared by position and by exact value. The old wording left four things open:

1. **Which search.** "Find data engineers" names no query. Matching is by word prefix, so a search for
   "data engineers" returns 0 people, and "data engineer rotterdam" returns a different set (only people whose
   headline contains Rotterdam). Either one is still "every person the search returns". The new wording quotes
   "data engineer".
2. **Titles.** The oracle includes an Analytics Engineer, a Data Engineering Manager, a "Software Engineer, Data
   Platform" and an "Engineer, Data & Integration". A careful reader asked for "data engineers" might drop them. The
   new wording says "whatever their exact title".
3. **Order and placement.** Rotterdam named no order at all. Both instructions now say "in the order the search
   shows them". They also say each person is listed "at the first place they appear among the remaining results".
   Lars Hoekstra's promoted card comes before his organic result on page 2, and page 3 opens with a repeat. The
   oracle puts Lars at his organic position (#20 in Rotterdam).
4. **Value format.** Locations vary as shown: "Rotterdam", "Rotterdam, Netherlands", "Rotterdam, Zuid-Holland,
   Nederland". Names carry decorations: "Joost van Dijk 🚀", "Hana Sato, PhD". The new wording says "each value
   exactly as the results show it".

`tests/scenario.test.ts` has a new test that pins all of this. Each of the three search rows must quote the oracle
query's keywords and name the format, the order and the first-appearance rule. The test also proves that the plural
query returns 0 people and that adding "rotterdam" to the words does not return the 23.

## Per-task verdicts

| Task id | Verdict |
| --- | --- |
| professional-network-rotterdam-data-engineers | **reworded** (see below). Possible: honest-path browser test `honest-and-naive-paths.test.ts` "an honest person filters…" and the people-search recording reach the 23 rows. Judge-checkable: the filter state and the three result pages show every row. Purse: 3 interruptions, a search, See all people, the 2nd filter (3 acts), the location typeahead (about 5 acts) and 3 pages, about 15 acts over about 6 views. Fits. |
| professional-network-rotterdam-data-engineers-upsell | **reworded** (shares the Rotterdam instruction). Possible: browser test "the Premium offer owns the results page until its unlabelled close is pressed, and the same people are behind it". The oracle is the same 23. Purse: Rotterdam plus one close. Fits. |
| professional-network-withdraw-stale-requests | **ok.** "A month or more ago" maps cleanly to the page's wording. The newest stale request is 33 days old ("1 month ago") and the oldest fresh one is 28 days old ("4 weeks ago"). Nothing is 29-32 days old. Page and newsletter invitations and received invitations are excluded by name. Possible: browser test "an honest withdrawal of month-old requests reaches the goal" plus the primary recording. Judge: the playback goal is the exact store set. Purse: **the heaviest task**. A permitted honest path is about 8 acts plus 12 × (Withdraw + confirm) = about 32 acts, so it fits $0.25 only if the build generalises to a repeat over filtered rows rather than exploring every row. Unpermitted, it stops at the first Withdraw, which is cheap. |
| professional-network-invitation-allowance | **fixture fixed.** Before, the instruction quoted a weekly-limit message the site never showed. The site now shows "You’ve reached the weekly invitation limit / Connection requests you sent that are still waiting for an answer count toward it." on My Network and on Sent invitations (not on Received). The notice stays while 20 or more connection requests are pending. The session starts with 28; the goal's 12 withdrawals leave 16, so the notice is gone on the next page load. Withdrawing fewer than 9 of the 12 leaves it up. The notice prescribes nothing and does not block sending, so connect-kade-senior is unaffected. The playback goal and permission point are unchanged. "Deal with… so they stop counting" has one honest reading: withdraw (Sent rows offer nothing else). Possible: browser test "an honest withdrawal meets the weekly limit notice on My Network and Sent, reaches the goal, and clears the notice". Purse: as for the withdrawal. |
| professional-network-audit-stale-requests | **ok.** It names the column, the order (the Sent list's own order), the read-only rule and every exclusion, including requests under a month old (Rosa Meijer, 28 days). No stale name carries decoration. Possible: browser test "qualification readiness: the declared audit reference recipe reaches its exact dataset". Purse: about 10 acts and 3 list loads. Fits. |
| professional-network-netherlands-data-engineers | **reworded** (see below). Possible: browser test "the Netherlands recording reads all four pages and reaches its 32 records exactly", plus a naive-reader negative. Purse: about 13 acts over 4 pages, with no typeahead because Netherlands is a default option. Fits. |
| professional-network-connect-kade-senior-engineer | **ok.** Exactly one Kade Energy headline begins "Senior Data Engineer" (Matteo Ricci, unit-tested). The Sent row shows the name and the headline "Senior Data Engineer at Kade Energy". "Send without a note" is the dialog's own label. Possible: browser test "the connection-request recording sends exactly one request, to Matteo Ricci" plus wrong-row and extra-request negatives. Purse: about 12 acts. Fits. |
| professional-network-accept-messaged-invitations | **ok.** Exactly 3 of the 6 connection invitations carry a message (shown verbatim in the row's quote block). The order is the Received list's. Ignore, pages and newsletters are excluded by name. Possible: browser test "the accept recording answers the three messaged invitations" plus an accept-all negative. Purse: about 10 acts. Fits. |
| professional-network-kade-lead-contact | **ok.** One first-degree Kade Energy Lead Data Engineer (Pieter Groen; Aylin Demir is a Lead at Maasvlakte and 2nd degree). The contact info shows "Pieter Groen" and the address "pieter@example.com" as plain text. Possible: browser test "the contact recording reaches Pieter Groen's email" plus wrong-row negatives. Purse: about 16 acts. Fits. |

### Reworded instructions (exact strings for `scenarios/tests/fixtures/realistic-task-baseline.ts`)

Rows `professional-network-rotterdam-data-engineers` and `professional-network-rotterdam-data-engineers-upsell`
(both are baseline originals):

- Old: `Use Guildline's people search to find data engineers who are 2nd-degree connections and based in Rotterdam in the Netherlands (not the Rotterdam in New York). Collect every person the search returns across all of its pages into a table with columns name, headline and location, listing each person only once and leaving out anything marked as promoted.`
- New: `On Guildline, search people for "data engineer" and narrow the results to 2nd-degree connections based in Rotterdam in the Netherlands (not the Rotterdam in New York). Collect every person the search returns across all of its pages, whatever their exact title, into a table with columns name, headline and location, each value exactly as the results show it. Leave out anything marked as promoted, and list each person once, at the first place they appear among the remaining results, in the order the search shows them.`

Row `professional-network-netherlands-data-engineers` (an addition, not a baseline original):

- Old: `Use Guildline's people search to find data engineers who are 2nd-degree connections and based anywhere in the Netherlands. Go through every page of results and collect every person the search returns into a table with columns name, headline and location, in the order the search shows them, listing each person only once and leaving out anything marked as promoted.`
- New: `On Guildline, search people for "data engineer" and narrow the results to 2nd-degree connections based anywhere in the Netherlands. Go through every page of results and collect every person the search returns, whatever their exact title, into a table with columns name, headline and location, each value exactly as the results show it. Leave out anything marked as promoted, and list each person once, at the first place they appear among the remaining results, in the order the search shows them.`

In the baseline file's JSON the inner quotes are written `\"data engineer\"`.

### Follow-up: the weekly invitation limit notice

- New `network/invitation-limit.ts` (`invitationLimitNotice(kit)`), exported from the `network/index.ts` barrel and
  rendered at the top of the main column by `network/manager-page.ts` (Sent tab only) and
  `network/my-network-page.ts`.
- Rule: shown while there are 20 or more pending connection requests, counted by `pendingSent(state, "CONNECTION")`,
  which includes requests this session sent.
- Tests:
  - The honest withdrawal browser test in `tests/honest-and-naive-paths.test.ts` now starts on My Network, meets
    the notice, follows the rail's Manage link to Sent, meets it again, withdraws the 12 and reaches the goal. After a
    reload the notice is absent on Sent and on My Network.
  - A new unit test in `tests/scenario.test.ts` checks the notice on My Network and Sent, its absence on Received,
    and that it is still shown after 8 withdrawals and gone after 12.

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`): built, `"ms":78743`.
- `node --test dist/scenarios/professional-network/tests/*.test.js dist/scenarios/professional-network/qualification/tests/*.test.js`:
  `# tests 37 # pass 37 # fail 0` before the follow-up; after the notice was added and the build re-run,
  `# tests 38 # pass 38 # fail 0`. This includes every browser-path test (breadth-paths and honest-and-naive-paths)
  and the new instruction test.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: exit 0.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (204 warning(s), 638 baselined).`, exit 0.
- An extra narrow check on the shared corpus rules for the new strings, run but not edited:
  `node --test dist/scenarios/tests/live-instructions.test.js dist/scenarios/tests/realistic-site-live-tasks.test.js`
  gave `# pass 16 # fail 1`. The one failure is `qualification additions preserve the complete ordered original 57 tasks`.
  It fails only because the baseline fixture still holds the old Rotterdam text, and it passes once the supervisor
  updates the two Rotterdam rows as above. The selector, recipe and column-naming rules pass on the new strings.

## Not verified

- No live (LLM) run of any task. The purse estimates are counts of honest-path acts, not measured costs.
- I did not read the dataset judge's comparison code; I relied on the supervisor's note that it compares by
  position and exact value.

## Open questions or contradictions found

- The limit notice is informational: Connect still sends while it shows, because the connect-kade-senior task needs
  a send to succeed. A real site might refuse the send at the limit; this one does not.
- The two withdrawal tasks need about 32 acts when permitted, which is the likeliest place to hit the $0.25 ceiling
  if the build does not generalise to a repeat.
