# Fix G4: social recent-group-posts wording

## Outcome

Done. The instruction for `social-network-feed-recent-group-posts` now says plainly that only posts written in a group the person has joined count.

## What changed and why

File: `apps/scenario-lab/src/scenarios/social-network-feed/live-tasks.ts`, constant `RECENT_GROUP_POSTS`. One sentence changed. Everything else is unchanged: the opening sentence, the date bound, the dedupe rule, the column list and the column definitions.

Old sentence:

> Leave out posts from groups I haven't joined, and list each post once even if the feed shows it again further down.

New sentence:

> Only posts written in a group I've joined count: leave out every post that wasn't written in a group at all, such as my friends' own posts, and every post from a group I haven't joined, such as one the feed suggests with a Join group button, and list each post once even if the feed shows it again further down.

Why: in social r4, 3 of 7 judge calls read the old sentence as keeping personal posts that are not in any group. The oracle (`qualification/recent-group-posts/expected.ts`, 3 records, all from Maya's three groups) expects only group posts. The site's own terms are "Joined" on a member's group page and "Join group" on suggested group posts (`markup/group.ts`, `markup/unit.ts`). The suggested group post it leaves out is Kim Tran's Urban Growers post, which the oracle's doc comment names. The oracle, fixture and expected records were not touched.

The baseline file `apps/scenario-lab/src/scenarios/tests/fixtures/realistic-task-baseline.ts` pins only the 57 original tasks. This task is a qualification addition that is checked by id only (`realistic-site-live-tasks.test.ts`), so the baseline needed no change. No test or audit report quotes the text.

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"` (in apps/scenario-lab): rebuilt, inputs changed. The built `dist/.../live-tasks.js` contains the new text.
- `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js dist/scenarios/tests/live-instructions.test.js dist/scenarios/social-network-feed/tests/scenario.test.js`: tests 33, pass 33, fail 0.
- `node scripts/structure-audit.mjs` (repo root): `structure-audit: passed (213 warning(s), 638 baselined).`

## Not verified

- `social-network-feed/tests/breadth-paths.test.ts` was not run. It drives a browser page, and the brief allowed no browser runs. It also does not read the instruction text.
- There was no live or judge run, so it is not yet confirmed that the judge now reads the sentence the way the oracle does.

## Open questions or contradictions found

None.
