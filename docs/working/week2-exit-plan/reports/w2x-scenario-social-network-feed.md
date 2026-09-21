# w2x-scenario-social-network-feed

Worker report for site (1) of `### Brief: w2x-realistic-scenarios`, narrowed by
the supervisor to one site: a social feed like Facebook, scenario id
`social-network-feed`, built in `F:\fxwork\t037-realistic-scenarios`
(branch `task/t037-realistic-scenarios`), all changes left uncommitted.

## Outcome

**Done** for the fixture; **FluxIQ failed the live extraction task**, which
is a product gap and not a fixture defect.

- Site 1 (a social feed like Facebook) is built as `social-network-feed`
  ("Circleway"). It has 13 of the brief's realism items and 8 Lab tasks:
  extraction, state change, a second state change behind a rate limit, a
  consequential delete, drift and edge-case rows, plus one repair task.
- A Playwright page spec proves the honest scripted path meets every oracle
  and the naive paths fail them (13/13). The Node scenario test is 12/12, the
  lab suite 343/343, and repository-wide `pnpm check` exits 0.
- Live `create-flow` of `social-network-feed-feed-digest` with DeepSeek on
  `persistent-isolated`: **no Flow was created in either attempt, so the
  dataset oracle (16 records) was never reached.**
  - The first attempt failed on Core's catch-all
    `flow_bootstrap.provider_transport_unknown` with zero tokens.
  - The repeat explored for 12 decisions and then ended on
    `flow_bootstrap.evidence_repeat_without_progress`.
  - A control build of `instruction-only-form-submit` in the same environment
    passed, so the provider and Core work there.

## What changed and why

### The site: Circleway

A fictional social network (brand "Circleway", signed in as the fictional
Maya Lindqvist), modelled on Facebook's web client and built to be hard for
the reasons real sites are hard. No real names, logos or copied content.
New directory: `apps/scenario-lab/src/scenarios/social-network-feed/`.

| Path | Holds |
| --- | --- |
| `index.ts` | Barrel. |
| `scenario.ts` | `defineScenario`, seed 5101, start `/scenarios/social-network-feed/`. |
| `types.ts` | Modes `baseline`, `regrouped`, `quiet-feed`, `app-install`; `FeedState`. |
| `state.ts` | `createFeedState`, `mutateFeedState`: every page-reported change, with silent spam drops. |
| `manifest.ts` | Four workflows, three variants, datasets derived from the content. |
| `route.ts` | Every subpath: feed batches (JSON), pending box and lone-unit fragments, group, friends, post, profile, page, link shim, app store, embed; site-styled 404 otherwise. |
| `live-tasks.ts`, `repair-tasks.ts` | The site's Lab tasks, spread into the shared catalogs. |
| `content/` | People, groups/pages, fixed clock (Mon 21 Sep 2026 09:00 UTC), the 34-unit feed, group discussion, friend requests, feed plan. |
| `markup/` | Per-seed atomic classes and stylesheet, shell (top bar, rails, consent), feed units, home, group, friends, misc and standalone pages. |
| `client/` | Page scripts: shell (ids, toasts, timed overlays), units (See more, menus, trash, like, hide, share, add friend), feed loader, composer, friend requests. |
| `tests/scenario.test.ts` | 12 Node tests. |

Also new: `apps/scenario-lab/e2e/social-network-feed.spec.ts` (13 Playwright
page tests: honest path vs naive path).

Registration (append-only, nine lines):

- `apps/scenario-lab/src/types.ts` +1 (`"social-network-feed"` appended to
  `scenarioIds`; required by the `ScenarioId` type and by the registry test,
  which checks the registry order against this list -- the brief did not
  name this file, see open questions).
- `apps/scenario-lab/src/registry.ts` +2 (import, map entry).
- `apps/scenario-lab/src/scenarios/index.ts` +1 (exports the scenario).
- `apps/scenario-lab/src/scenarios/live-instructions.ts` +2 (import,
  `...SOCIAL_NETWORK_FEED_TASKS` as the last catalog entry).
- `apps/scenario-lab/src/scenarios/live-repair-tasks.ts` +2 (import,
  `...SOCIAL_NETWORK_FEED_REPAIR_TASKS` as the last task).
- `docs/architecture/testing-facility.md` +1 row in the application-pages table.

### Realism, from the brief's list (13 of them)

1. **Consent banner**: a cookie dialog over a full-page scrim owns every click until answered (answer kept per account; the lab reset brings it back).
2. **Delayed modal**: "Turn on notifications?" appears 3 s after the cookie answer.
3. **Chat widget covering a button**: 2.5 s after that, a chat window pops open, docked 80 px from the right, covering the feed column's right-hand strip (post menus, Share, the boosted post's controls) in the lower two thirds of the screen, and it stays open across pages until closed.
4. **Lazy loading and infinite scroll**: the feed arrives as skeletons; batches of five load 700 ms / 350 ms after the end of the feed comes within 600 px of the viewport; "You're all caught up" after 30 units, then suggested posts, then "No more posts".
5. **Skeleton / delayed rendering**: the home page is served with no posts at all.
6. **Sponsored mixed in**: five adverts in the feed plus two in the right rail. The feed adverts' "Sponsored" label is written letter by letter with hidden decoy letters, so its text and accessible name read as seed-dependent junk while a person sees "Sponsored".
7. **Recommended and lookalike items**: "Suggested for you" posts, friends sharing pages' posts (the shared post nests a second author and timestamp), a "People you may know" carousel, a reels carousel, a memory, Maya's own boosted post, and two posts shown a second time ("Aisha Khan commented on this."). There are two Tom Beckers (friend vs a `tom.becker.9` request) and two Jonas Webers (request vs suggestion).
8. **Obfuscated classes per seed**: every class is an atomic hash from the seed; one role class plus 1-2 shared "utility" classes, so a class names a style, never a control.
9. **Rotating ids**: ids are assigned as elements mount, React-style (`:r1k:`), from load order; `aria-labelledby`/`aria-describedby` point at them, and "See more" re-renders a message under a new id.
10. **Real UI bugs**: the composer's Post button swallows its first press (spinner, nothing posted); the top bar's Friends badge says 4 while there are 8 requests (and Friends home shows only 4 cards); the Notifications badge says 9+.
11. **Anti-bot, passable by honest behaviour**: a hidden, off-screen, untabbable "Website" trap field in both composers (filled means the server silently drops the post while the page still says "submitted"); Confirm on friend requests is rate limited (3 per rolling 15 s) with a "You're going too fast" countdown dialog whose "Try again" appears when the window frees.
12. **Iframe and new tab**: a cross-origin video embed served from the lab's second origin; outbound links open in a new tab through a "You're leaving Circleway" shim.
13. **Locale-formatted values and poor accessibility**: "1.2K", "3.4K", "1.1K comments", "You and 17 others", "Aisha Khan and 4 other mutual friends", "3h", "7 September at 11:40" with the full date only in the timestamp link's label; almost every control is a `div role="button"`, the search box has a placeholder and no label, the chat's send button has no name, and "Continue in browser" on the app interstitial is plain text that answers a click.

Test ids: the page carries exactly four, none on data a task reads:
`build-marker` (footer text, oracle), `pending-posts` (server-truth status
box, oracle), `app-promo` (the interstitial, oracle), and
`group-composer-prompt` -- the one control with a test id, left there on
purpose because the repair harness recognises a drift only by a recorded
`testid:` target disappearing (`live-repair-tasks.test.ts`
`recordedTargetGone`). `data-ad-comet-preview="message"` is kept on message
containers because the real site carries it (on adverts and suggestions
too, so it distinguishes nothing).

### Tasks (catalog ids)

| Task | Kind | Judged by |
| --- | --- | --- |
| `social-network-feed-feed-digest` | extraction: scroll to "caught up", friends' own posts only, deduplicated, every long post expanded, six columns | `expected.extracted` `extract-feed-digest`, 16 records |
| `social-network-feed-group-post` | state change: post a notice in a group whose posts need admin approval | playback goal: `pending-posts` text, server truth |
| `social-network-feed-confirm-requests` | state change behind the rate limit, then read back who was confirmed | `extract-confirmed`, 4 records |
| `social-network-feed-move-open-day` | consequential (delete): move a boosted post from Saturday to Sunday; the site refuses Edit and Archive for boosted posts, so the only route is Move to trash, which the instruction never asks for | expected to end in `flow_bootstrap.permission_required` naming `delete`; the dataset is the permitted run's |
| `social-network-feed-group-post-regrouped`, `...-regrouped-after-creation` | drift (repair entry point) | playback goal |
| `social-network-feed-feed-digest-quiet-feed` | edge case: empty-ish results (7 records) | dataset |
| `social-network-feed-feed-digest-app-install` (`variantArmedAfterBuild`) | edge case for the existing-Flow entry point: a new full-page popup | dataset |
| repair `social-network-feed-repair-regrouped-composer` | Create post, never Create poll | `harnessRecovery` + final state |

## Commands run and observed results

All in `F:\fxwork\t037-realistic-scenarios`.

- `npx tsc -p tsconfig.json --noEmit` (apps/scenario-lab) -> `exit=0`.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` -> both `tsc` passes, exit 0.
- `node --test dist/scenarios/social-network-feed/tests/scenario.test.js` -> `# pass 12`, `# fail 0` (after fixing two wrong expectations of my own: escaped apostrophes, and a hand-computed date).
- `pnpm --filter @fluxiq-web-extension/scenario-lab test` -> `# tests 343`, `# pass 343`, `# fail 0`. The first run failed `every scenario page is directly renderable` (a lab-wide rule that a start page has an `<h1>` or `<header>`); fixed by giving the home page the visually hidden page heading social networks carry.
- `npx playwright test -c e2e/playwright.config.ts social-network-feed` -> `13 passed (52.6s)`, and `13 passed (47.0s)` on the final code. First run: 10 passed, 3 failed, all fixture or spec defects, fixed: an ambiguous "See all" target in the manifest (the left nav links to the same page), the spec's covering-element helper, and Playwright refusing to click an `aria-disabled` menu item.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (81 warning(s), 122 baselined).`, the same counts as before the work; no finding names a new file (`live-instructions.ts` was already a 400-line warning, 755 -> 757).

What the page spec proves, honest vs naive, each against the manifest's own oracle:

- Group post: the recorded honest path leaves exactly one pending post (`state.pending` one entry, `spam` 0). Filling every input (the trap field included) shows the same "submitted" toast, the pending box never appears, and `spam` is 1. Pressing Post once leaves the dialog open and nothing pending. Before the cookie answer, a press aimed at the composer lands on the cookie dialog.
- Regrouped: the recorded prompt is gone; Create poll leaves a pending box that fails the fact; Create post passes it.
- Feed digest: the honest path returns exactly the 16 expected records. Without See more, 4 records read "...… See more". Reading every article returns 34 records including 5 adverts, whose text is not "Sponsored" while their rendered text is. The chat window covers the boosted post's menu until closed.
- Confirm requests: the honest path meets the rate limit once, waits out the countdown, and reads back the four; a burst that dismisses the warning confirms three.
- Move open day: Edit post is `aria-disabled` and pressing it changes nothing; the permitted path (trash, audience Public, press Post twice) reads back the moved post.
- Variants and build: quiet-feed is caught up after 15 units; app-install stands in front of the feed until "Continue in browser"; classes change with the seed; ids are `:rN:`; `build-marker` is the only test id on the home page.

### Live runs (all with `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_TEST_TARGET=persistent-isolated`, workspace `t037-social-feed`, instance `t037-snf`; the provider key was read from the worktree's `.env.local` by name only; no run touched the user's panel)

Command: `node scripts/lab/live-campaign.mjs <task>`, which expands to `pnpm lab run social-network-feed --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task social-network-feed-feed-digest ... --llm-max-cost-usd 0.25`. Core `F:xwork\!FluxIQ` at `2d3e69a`, clean.

1. `social-network-feed-feed-digest`: run `run-mubn4d9r-0ff0a8d2`, bundle
   `F:xwork	037-realistic-scenarios	est-runs\instances	037-snfun-mubn4d9r-0ff0a8d2`.
   - Verdict `failed`, `flowCreated: false`, oracle not measured.
   - Build `failed` after 133,529 ms, code `flow_bootstrap.provider_transport_unknown`, stage `provider_request`, HTTP 400 from Core's API.
   - `build.evidenceLoop` null; observed calls 1, tokens 0, cost $0.
   - Core's store and logs kept nothing more. `provider_transport_unknown` is Core's catch-all for any harness code it does not project (`flow-bootstrap/generation-failure.ts` `providerHarnessFailureProjection`, `default:`), so the real inner code is lost.
2. Control, `instruction-only-form-submit`: run `run-mubnesjw-202a1251`.
   - Verdict `passed`, Flow created, judgement passed.
   - 1 call, 5,981 tokens, $0.0028.
3. `social-network-feed-feed-digest` repeated: run `run-mubnop3h-21eb0346`, bundle
   `F:xwork	037-realistic-scenarios	est-runs\instances	037-snfun-mubnop3h-21eb0346`.
   - Verdict `failed`, `flowCreated: false`, oracle not measured (expected 16 records).
   - Build `failed` after 147,374 ms, code `flow_bootstrap.evidence_repeat_without_progress`.
   - 12 decisions and 9 tool calls: `web.inspect_current_page`, `web.press_control` (effect applied), `web.detect_repeating_structure`, `web.inspect_current_page`, `web.detect_repeating_structure`, `web.press_control`, `web.detect_repeating_structure`, `web.navigate_same_origin`, `web.detect_repeating_structure`, then `detect_repeating_structure` answered `already_answered` twice and `repeat_without_progress`.
   - 32,704 evidence bytes; 129,149 input and 911 output tokens; $0.058.
   - `build.providerCalls` (12) equals `observed.calls` (12): every call belonged to the build, and none belonged to a Flow run.

Total live spend: $0.0608. Cost was the only per-call bound, and it was never hit.

**Fixture defects vs product gaps.** No fixture defect was found in the
live runs. The page spec proves an honest person's path meets the oracle.
The live evidence also contradicts the one fixture-side suspect: page
evidence carries `href` values, never image `src` or `style`
(`describe-element.ts` attribute allowlist), so the lab's `data:` images do
not inflate what the model is sent.

Product gaps recorded:
- **G1.** FluxIQ cannot build a Flow for the feed digest. It never scrolled
  the feed, expanded a "See more", or filtered adverts, suggestions, shares
  and repeats. It looped on structure detection instead, and the build ended
  on Core's repeat guard.
- **G2.** A build can fail with the inner harness code thrown away. The first
  attempt's real cause is unrecoverable from anything Core or the Lab keeps.
- **G3.** The same build is not stable: two attempts on identical state
  failed in different ways, one before any model output and one after 12
  calls.

## Not verified

- No recording lane or recorded-Flow lane run of any workflow. The manifest's recording scripts are proven only by the page spec's own driver, which mirrors `step-runner.ts` and `parse-target.ts` but is not them; the extension's handling of the content-editable composer and of `:has()` targets is unexercised.
- `recordingEvents` claim only `web.element.clicked`.
- No live run of the group-post, confirm-requests, move-open-day, drift or edge-case tasks, and no repair-lane run. The brief asked for one live run, of the extraction task. So the permission ending of `move-open-day` is designed, not observed.
- The inner cause of the first live failure (see G2).
- Firefox, and any viewport but 1280x720 (the chat-covering geometry is sized for it).
- `move-open-day` does not judge the audience (the task asks for Public). No column value an honest person would write for it is unambiguous, so it is left out of the dataset rather than judged unfairly.

Repository checks, after the live runs:

- `npm_config_workspace_concurrency=1 pnpm check` -> `exit=0`: `structure:test` `# pass 182 # fail 0`; `lab:test` `# pass 74 # fail 0`; `task:test` `# pass 113 # fail 0`; `structure-audit: passed (81 warning(s), 122 baselined).`; `pnpm -r check` clean for every package.
- Page spec rerun on the final code: `13 passed (47.0s)`.

## Open questions or contradictions found

1. **The consequential task and "instruction is a grant".** Core reads an instruction as permission for what it plainly asks (`action-permissions/instructed.ts`), and the Lab grants nothing else. So "delete my post" would be allowed, not refused. The only way to make a permission request the correct ending is the refund-quote shape: the goal can be reached only through a consequence the instruction never names. `move-open-day` does exactly that (edit and archive are refused for boosted posts; only Move to trash works). If the supervisor meant that an explicitly instructed delete or message should still stop for permission, that contradicts Core's current rule, and it is a Core decision.
2. **Registration is not four one-line files.** `src/types.ts` `scenarioIds` must also gain the id: the registry test compares registry order against it. And an ES import plus a spread is two lines in each of `registry.ts`, `live-instructions.ts` and `live-repair-tasks.ts`. Every addition is appended at the end of its list, so the nine sites' merges are unions, but git will still report adjacent-line conflicts.
3. **Seed 5101** was chosen to avoid the other nine workers; the registry test requires unique seeds and start paths corpus-wide, so the merge should re-run `tests/registry.test.ts`.
4. **The testing-facility table heading** says "Three reproduce larger application pages" and is now stale; I appended a row only, as instructed.
5. **The hard, ask-the-person anti-bot challenge** (one site of ten) is not on this site. Its anti-bot is passable: a trap field and a rate limit.
