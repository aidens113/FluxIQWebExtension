# w2x-scenario-local-classifieds — worker report

Brief: `### Brief: w2x-realistic-scenarios`, scenario `local-classifieds`, task
t044, worktree `F:\fxwork\t044-scn-local-classifieds` (branch
`task/t044-scn-local-classifieds`). All changes are uncommitted.

## Outcome

Done. The site, its Node and browser tests, and `pnpm check` all pass. One
live `create-flow` run of the extraction task was made. FluxIQ failed it:
no Flow was built. That failure is a product gap, recorded below. No fixture
defect came out of the live run.

- **The site.** Kerbfind Marketplace is a fictional local-classifieds site in
  the Facebook Marketplace mould, set in the fictional town of Kelford. It
  has 76 authored listings, 20 sellers, 5 adverts, 10 categories, and pages
  for listings, saved items, the inbox, an advertiser's shop and a map
  frame. It was built to be difficult, as the user directed. No control has
  a test id or an authored id except the one the repair contract requires
  (see Open questions, item 4). Nothing was tuned so that FluxIQ passes.
- **The live run.** It stopped after four model calls with
  `flow_bootstrap.evidence_tool_failed`.

## What changed and why

### Tasks, and what is hard about each

**1. Extraction** (`local-classifieds-bike-search`, dataset
`extract-bike-results`, 12 records).
- The ask: every bicycle within 10 miles of Kelford from £100 to £400 in
  good condition or better, each once, cheapest first, with no sponsored
  posts. Columns: title, price, location, url.
- A person has to:
  - answer the cookie dialog and the timed notification prompt;
  - set the radius in a shadow-DOM picker whose Apply needs a second press;
  - set the price, condition and sort filters;
  - scroll a feed whose one failing batch loads only after Try again;
  - leave out two adverts built from the same card component;
  - drop the listing the feed sends twice;
  - stop before "Results outside your search";
  - read the current price rather than the struck-through one.
- Distractors: a reseller's copy of the same bike 11.4 miles away, reduced
  prices still over the limit, sold bikes, fair-condition bikes, a £400
  e-bike and a £100 kids' bike exactly on the boundaries, and a "Free" bike.

**2. State change** (`local-classifieds-save-dining-tables`, dataset
`extract-saved-items`, 5 records, plus final-state facts).
- The ask: save the three cheapest dining tables within 5 miles, then read
  the whole saved list back, cheapest first.
- The cheapest results for "dining table" are table legs, chairs sold to
  match a dining table, a sold table, and a table 6.7 miles away.
- The saved list already holds two older saves, one of them sold.
- Save toggles, so pressing it on the repeated card unsaves the table.
- The sidebar's Saved count goes stale after a save.
- The saved list's order depends on save order until it is sorted.

**3. Consequential** (`local-classifieds-make-offer`, judged by the
playback goal).
- The ask: offer £140 for the cheapest like-new folding bike listed within
  10 miles in the last 7 days.
- A sponsored "new" folding bike at £149 is the first card of the narrowed
  search.
- A chat window opens over Make offer.
- The offer box is prefilled with the asking price.
- The dialog has an off-screen honeypot field. Filling it gets the offer
  accepted and never delivered.
- The listing's prefilled "Hi, is this still available?" message sits right
  above Make offer. Sending it first gets the offer refused by the
  contact rate limit (8 seconds).
- The goal facts are the receipt "Offer of £140 sent to Morgan Tate" and a
  Buying count of 3.

**Variants and catalogue rows.**
- Drift, for the repair entry point: `save-dining-tables` / `moved-save`.
  Save becomes a heart named "Add to saved items" on the photo and loses
  its test id, and Hide takes Save's old place. The repair row is
  `local-classifieds-repair-moved-save` (`expect: repair`,
  `temporary_target_override`).
- Edge cases, for the existing-Flow entry point, both on `bike-search`:
  - `list-layout`: an A/B list layout where each link wraps only the title.
  - `location-check`: an "Are you still in Kelford?" popup that blocks the
    page after the cookie dialog.

  Both have creation rows with `variantArmedAfterBuild`.

### Realism features

These are the brief's realism-bar items. The site has 15 of them; the bar
is at least 6.

- A blocking cookie consent dialog.
- A notification prompt on a per-seed delay.
- A chat widget covering Make offer.
- Infinite scroll with skeleton cards.
- Sponsored cards mixed in with real listings.
- Atomic class names that change completely per seed. A Node test proves
  two seeds share no class name.
- React-style `:rN:` ids, also per seed.
- Details that render late behind a skeleton.
- Real UI bugs:
  - the second-press Apply in the radius picker;
  - a spinner, left by skeletons, that clears only on Try again;
  - a stale results count and a stale Saved badge.
- Anti-bot measures:
  - the honeypot;
  - the contact rate limit, which reports how long to wait;
  - a "Checking your browser" pause on the 4th search within 10 seconds,
    which clears after 2.5 seconds or on Continue.
- A cross-origin map iframe on the lab's second port.
- Shadow DOM, in the radius picker.
- New tabs: adverts open the advertiser's shop.
- Locale formatting: £1,250, "Free", "Listed yesterday", and "Saturday 19
  September 2026" in a title.
- Div-buttons with poor accessibility: an unnamed chat minimise, a bare
  "Try again" span, "See more".

Also present from the user's direction:
- duplicate and ambiguous labels: two "Search" boxes, two "Message"
  textboxes, a "Send" beside "Send offer";
- a result deliberately repeated across a batch boundary;
- results outside the search appearing straight after the real ones.

The seed moves the class names, the ids, where the adverts and the repeated
card fall, which batch fails (1 or 2), and every delay. The answers never
move. `scenario.test.ts` checks this over seeds 0 to 59.

### Files

**The scenario** (all new), `apps/scenario-lab/src/scenarios/local-classifieds/`:
- `types.ts`, `state.ts`, `limits.ts`, `readouts.ts`, `root.ts`
- `targets.ts`, `answers.ts`, `manifest.ts`, `route.ts`, `scenario.ts`
- `live-tasks.ts`, `repair-tasks.ts`, `index.ts`
- `catalog/` (listings, places, sellers, adverts, query, options, matching,
  feed)
- `format/`, `view/`, `client/`, `pages/`
- `tests/scenario.test.ts` and `tests/session.test.ts`: 18 tests, no browser.

**The browser spec**, `apps/scenario-lab/e2e/local-classifieds.spec.ts`.
This is outside my owned paths; see Open questions, item 1. It has 20
tests:
- the manifest's recording scripts run as the honest paths;
- the naive paths judged by the same oracle:
  - pressing under the chat;
  - filling the honeypot;
  - taking the first card, which is the advert;
  - sending the ready-made message and then the offer;
  - reading every card;
  - saving the first three cards;
  - pressing Save twice;
  - pressing Hide after the redesign;
- all three variants;
- the honest paths again on seeds 1 and 42.

**Registrations:**
- `src/types.ts`: one line.
- `src/registry.ts`: import and entry.
- `src/scenarios/index.ts`: one line.
- `src/scenarios/live-instructions.ts`: import and spread.
- `src/scenarios/live-repair-tasks.ts`: import and spread.
- `docs/architecture/testing-facility.md`: one row in the "larger
  application pages" table.

## Commands run and observed results

**1. Scenario tests** (the brief's first check), run in
`apps/scenario-lab`:
- `node scripts/build-scenario-lab.mjs && node --test dist/scenarios/local-classifieds/tests/*.test.js`
  printed `# tests 18`, `# pass 18`, `# fail 0`.
- `npx playwright test -c e2e/playwright.config.ts e2e/local-classifieds.spec.ts --reporter=line`
  printed `20 passed (35.6s)` on the final run, after the file splits.
- Earlier runs failed on fixture and spec defects, all fixed:
  1. The filter headings' CSS `::after` chevron was part of their
     accessible name, so "Item condition" did not match. The chevron is now
     an `aria-hidden` span.
  2. The bike script scrolled the sidebar: the wheel scrolls whatever is
     under the pointer, and the pointer was over the sort menu. The script
     now clicks the results heading first, and scrolls three times.
  3. Three spec defects: a wait shorter than the "checking your browser"
     pause; an unscoped "Message" textbox; reading links while the feed
     was still reloading.

**2. The live run.** Command:

```text
FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t044-classifieds pnpm lab:campaign local-classifieds-bike-search
```

- `FLUXIQ_TEST_ENV_FILES=none` was set. The workspace, `t044-classifieds`,
  is my own. The user's panel and ports 3000 and 4711 were not touched.
- The campaign expanded it to
  `pnpm lab run local-classifieds --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task local-classifieds-bike-search ... --llm-max-cost-usd 0.25`.
- It printed `[campaign] local-classifieds-bike-search: failed (run-mubnq6wr-18d3f633), judgement not measured`
  and exited 1.
- Evidence: `F:\fxwork\t044-scn-local-classifieds\test-runs\run-mubnq6wr-18d3f633`.
- Verdict `failed`; `flowCreated: false`; `oracleVerdict: null`. The oracle
  was never measured, so there are no matched records.
- The first failure: "FluxIQ did not build a Flow from the task's
  instruction (flow_bootstrap.evidence_tool_failed)".
- `snapshots/live-llm.json`:
  - `build.providerCalls: 4`, equal to `observed.calls: 4`;
  - 44,625 tokens, about $0.0199;
  - `build.failure = { code: "flow_bootstrap.evidence_tool_failed", stage: "provider_output_validation", httpStatus: 400 }`;
  - four successful steps, in order: `web.inspect_current_page`,
    `web.press_control`, `web.navigate_same_origin`,
    `web.detect_repeating_structure`.
- The run's arrival page facts held in the Lab's real browser, since the
  Lab checks them before the build starts: path, Buying 2, Saved 2, no
  iframes.
- Classification: **product gap, not a fixture defect.** See Open
  questions, items 5 and 6.

**3. Wider checks:**
- `pnpm test` in `apps/scenario-lab` printed `# tests 349`, `# pass 349`,
  `# fail 0`. This includes the catalog tests and the registry and server
  tests.
- `pnpm --filter @fluxiq-web-extension/test-matrix test` printed
  `# tests 17`, `# pass 17`, `# fail 0`, which includes the scenario-catalog
  registry-order test.
- `pnpm check` at the repository root exited 0 and printed
  `structure-audit: passed (81 warning(s), 122 baselined).` My files add no
  warnings. Two advisories (11 and 10 exported values) were removed by
  splitting `catalog/options.ts` out of `query.ts`, and
  `targets.ts`/`answers.ts` out of `expected.ts`.
- `git status --short` lists only the six modified files above, the new
  spec, and the new scenario directory.

## Not verified

- The recording lane, the recorded Flow lane and the repair lane were not
  run on this fixture. The repair row `local-classifieds-repair-moved-save`
  is untested live.
- No live run was made of the save task, the offer task, or the two
  armed-after-build variants.
- The failing fifth tool call is not identified. Core records only
  successful steps. The likely cause below is inferred from source, not
  observed.
- The browser tests ran in headless Chromium at 1280×720 on seeds 1, 42
  and 44. Other viewports were not tried. A much shorter viewport might
  leave "Try again" unreached by the bike script's three scrolls.
- The Lab's extension, the side panel, and Firefox were not exercised
  beyond the one live run.

## Open questions or contradictions found

1. **The browser spec is outside my owned paths.** The brief requires the
   scenario test to show that "clicks under the overlay" fails, which needs
   a browser. CI's unit job (`pnpm test`) installs no browser, so a
   browser test cannot live in the Node suite. I added
   `apps/scenario-lab/e2e/local-classifieds.spec.ts`: a new, scenario-named
   file following the `<id>.spec.ts` convention, so no merge conflict. The
   supervisor can drop it or accept it.

2. **More than one line in some registrations.**
   - `src/types.ts` needs `"local-classifieds"` in `scenarioIds`. The
     brief does not list that file, but without it the `ScenarioId` type
     rejects the id, and the registry and server tests compare against
     that list.
   - `registry.ts`, `live-instructions.ts` and `live-repair-tasks.ts` each
     got two lines: an import and an entry. One line cannot both import and
     register without a top-level-await trick.
   - Each insertion point unions cleanly. The order in `scenarioIds` and
     the registry `Map` must match after the merge; `registry.test.ts`
     checks it.

3. **A stale sentence in the testing-facility doc.** The table I appended
   to is introduced by "Three reproduce larger application pages". It now
   has four rows. The one-row rule kept me from editing the sentence.

4. **The one control with a test id.** The Save control carries
   `marketplace_pdp_save`. The repair-task contract requires it:
   `recordedTargetGone` in `tests/live-repair-tasks.test.ts` recognises
   only `testid:` targets.
   - The other test ids are readouts the oracle needs:
     - `marketplace_buying_count`
     - `marketplace_saved_badge`
     - `marketplace_saved_total`
     - `marketplace_offer_receipt`
     - `marketplace_location_prompt`, the popup container
   - Page facts can only name test-id subjects
     (`packages/test-runner/src/scenario-assertions.ts`).

5. **Product gap: a failed interaction ends the whole build.**
   - `domain/src/runtime/llm-evidence/capture.ts:128` throws
     `web evidence interaction failed` whenever an action's status is not
     `succeeded`.
   - `sanitize.ts:276` throws when a snapshot is over the evidence byte
     limit.
   - Core's evidence loop (`packages/fluxiq/src/programs/automation-studio/runtime/llm/evidence-loop.ts:445-455`)
     catches any throw and ends the build as `llm_evidence_loop.tool_failed`,
     mapped to `flow_bootstrap.evidence_tool_failed`.
   - The extension's actionability check refuses a control another element
     covers (`apps/extension/src/content/action-runtime/actionability.ts`).
     So on a real site, where a modal or chat opens on a timer, one press on
     a covered control kills the build. The model is never told, so it
     cannot close the overlay and try again.
   - This is the most likely cause here. The four logged steps are the
     page, a press (cookies), a navigation to results, and the structure.
     On that results page the notification prompt opens 1.6 to 3.0 seconds
     after load.
   - This is unconfirmed; see item 6.

6. **Product gap: the failing call leaves no record.** The same `catch {}`
   blocks discard the error. The failing decision never enters the trace.
   Nothing about the failed build is persisted: the workspace's
   `project.sqlite` `adaptations` table has 0 rows. So a run bundle cannot
   say which tool failed or why.

7. **Product gap: no de-duplication.** Neither `web.dom.extract_list` nor
   the recording grammar can drop an item the feed sent twice. The
   `bike-search` recording script therefore reads 13 records against an
   answer of 12; the browser spec asserts both numbers. A person
   de-duplicates. The manifest's description of the workflow says so.

8. **A Lab gap: the catalog cannot judge a permission request.**
   - `LiveInstructionTask` (`packages/test-runner/src/flow-lane/creation/instruction-task.ts`)
     has no way to declare that the right result is a request for
     permission.
   - The created-Flow lane throws when a build proposes nothing
     (`flow-lane/creation/lane.ts`, "FluxIQ did not build a Flow"), even
     though `build-proposal.ts` already carries `permissionRequest`.
   - So `local-classifieds-make-offer` is judged by the permitted run's
     goal. An ungranted run that correctly asks for permission is scored as
     a failure today.
   - This probably belongs with t036 (`w2x-lab-llm-permit`).
