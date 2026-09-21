# w2x-realistic-scenarios: `professional-network` (t043)

Worker report. Worktree `F:\fxwork\t043-scn-professional-network`, branch
`task/t043-scn-professional-network`, changes left uncommitted.

## Outcome

Done. Guildline, a fictional LinkedIn-archetype professional network, is
built in `apps/scenario-lab/src/scenarios/professional-network/`. It is purposely
difficult through realism: 15 of the brief's realism features, no targeting
aids, and exact, deterministic oracles.

Its tests, the scenario-lab suite (350 of 350) and `pnpm check` all pass. A
real Chromium spec shows that an honest person passes every oracle and that the
naive paths fail.

The one live `create-flow` run of the extraction task, with DeepSeek on
`persistent-isolated` and `FLUXIQ_TEST_ENV_FILES=none`, **failed before any Flow
existed**:

- run: `run-mubndfg6-51368c1b`
- verdict `failed`, `flowCreated: false`
- `matchedRecords`: not measured
- `build.providerCalls` 1, equal to `observed.calls` 1
- 7,756 tokens, $0.0035
- build failure `flow_bootstrap.evidence_tool_failed`, stage
  `provider_output_validation`, HTTP 400

That is a **product gap**, not a fixture defect; see "Live run" below.

## What changed and why

**The site: Guildline**, a fictional professional network modelled on the
LinkedIn archetype (no real names, logos or copied content). It has 69 members,
36 outstanding sent invitations and 8 received ones, all authored. Every age is
measured from a fixed reference time (21 Sep 2026 09:00 UTC), so the pages and
every oracle are identical on any day and any seed. The seed changes only the
dressing: generated class names (`css-xxxxxxx`, hashed over the seed) and
ember-style element ids that also change with every rendering.

Pages, all behind one shell:

- the feed (start page), with infinite scroll and promoted posts;
- global search: an "All" results page, then People;
- the people search, with filters, pagination and a results endpoint;
- My Network and the invitation manager (Received and Sent), with a Show more
  endpoint;
- profiles, with the Experience section in declarative shadow DOM;
- jobs, messaging, notifications, Premium and its checkout, app, settings,
  signed-out and an advertisement iframe.

Realism features, 15 of the brief's list against a minimum of six. None was
added to make targeting easy, and no control carries a test id except the one
the repair harness structurally needs (see Open questions).

1. **Consent banner.** It covers the bottom 96 px of every page until it is
   answered.
2. **Delayed app-install prompt.** It opens 2.5 s after the feed or a search
   page loads. Its close control is an unlabelled icon, and "Not now" is a
   styled div with no role.
3. **Chat widget covering controls.** A conversation with Priya Nair opens
   3.5 s into the session, 336 x 400 px, left of the messaging dock. It sits
   exactly over the results pager and the invitation list's "Show more" once
   the page is scrolled to them, and its Send posts a real message.
4. **Lazy loading and infinite scroll.** The feed loads five updates at a time
   through a sentinel. The Sent list loads ten per "Show more", fetched as JSON.
5. **Sponsored results mixed in.** Page 1 of the results carries a product ad
   and a promoted profile, Sanne de Wit (Amsterdam, a non-match). Page 2
   carries a promoted Lars Hoekstra, who also appears organically at the end
   of page 2 and again at the top of page 3.
6. **Obfuscated class names per seed**, plus rotating element ids.
7. **Skeleton and delayed rendering.** Results arrive 0.7 s behind skeleton
   cards, on every page change.
8. **Real UI bugs:**
   - Next is written against the page the address had at load, so it
     reaches page 2 and then stays there forever.
   - The first "Show more" after each load spins until a Retry appears, and
     only Retry loads the rows.
   - Every count on the Sent pills is stale after a withdrawal.
   - Choosing a location suggestion closes the dropdown without applying it.
   - Page 3 repeats the last result of page 2.
9. **Anti-bot measures:**
   - The results endpoint answers a third request inside 3 s with a
     "security check": a 429 with `Retry-After: 5`. The check clears by itself
     after the wait, or 2 s after its role-less "I'm not a robot" box is
     clicked.
   - The connection-note form has an off-screen honeypot field. A request that
     fills it is thanked on screen and silently discarded.
10. **An iframe:** the right-rail advertisement.
11. **Shadow DOM:**
    - Every invitation age is a `gl-time-ago` custom element that renders
      "Sent 1 month ago" only inside its open shadow root. The light DOM
      carries only a `datetime` attribute.
    - Profile Experience sections are declarative shadow roots.
12. **Locale-formatted text:** "1,204", "2.3K", "€75.000 – €92.000 per jaar",
    and a member whose location reads "Rotterdam, Zuid-Holland, Nederland".
13. **Div-buttons with poor accessibility:**
    - Filter pills, "Show results" and "Cancel" are divs.
    - Page-invitation "Withdraw" controls are divs.
    - Withdraw buttons carry no per-row label.
14. **Duplicate and ambiguous labels:**
    - Two "Search" controls.
    - "All filters" repeats every checkbox label ("2nd" twice).
    - Two "Manage" links.
    - Two Rotterdams in the location typeahead, whose suggestion text also
      equals every Rotterdam card's location line.
    - Names inside links that also hold visually hidden "View X's profile"
      text.
    - Degree badges holding hidden "2nd degree connection" text.
15. **Consequential distractors** on the pages the tasks visit:
    - Connect, Accept and Pending (which opens the withdraw dialog) on result
      cards.
    - Accept and Ignore on received invitations.
    - Page and newsletter invitations that are a month or more old, but are
      not connection requests.
    - A connection request exactly four weeks old.

**Tasks** (`live-tasks.ts`, `repair-tasks.ts`):

| Task | Kind | Judged by |
| --- | --- | --- |
| `professional-network-rotterdam-data-engineers` | Extraction: search "data engineer", 2nd degree, Rotterdam NL (not NY); every page; each person once; no promoted entry; columns name, headline, location | `expected.extracted` step `extract-rotterdam-engineers`: exactly 23 records, in first-seen order, 3 pages |
| `professional-network-withdraw-stale-requests` | State change: withdraw connection requests sent a month or more ago; leave newer ones, page and newsletter invites, and received invitations | Playback goal `withdraw-month-old-requests`: the page-embedded invitation store (`data-testid="invitation-store"`, hydration JSON) must equal an exact set with 12 urns removed |
| `professional-network-invitation-allowance` | Consequential: "deal with" month-old requests so they stop counting against the limit, without ever asking for a withdrawal | Same goal. A correct build should end in `flow_bootstrap.permission_required` unless granted, following the `order-operations-refund-quote` precedent |
| `professional-network-rotterdam-data-engineers-upsell` | Existing-Flow edge case: variant `premium-upsell` (a new popup), `variantArmedAfterBuild` | Same dataset |
| `professional-network-repair-redesigned-withdraw-dialog` | Repair entry point: variant `redesigned-withdraw-dialog`. The recorded confirm loses its hook, is renamed "Withdraw invitation" and moved first, beside "Keep invitation" | Repair task, `temporary_target_override`. Final state is the goal set |

Oracles are exact and deterministic:

- **Extraction:** the dataset is the search's own match list, which is what an
  honest person gets after dropping promoted entries and the page-3 repeat.
- **Withdrawal:** the store is a sorted urn set. Withdrawing the wrong things,
  withdrawing too few, sending a stray invitation, or accepting or ignoring
  anything all change it.
- **Search tasks:** `finalState` also requires the store to be unchanged, so a
  run that clicks Connect or Accept while scraping fails.

**One-line registrations outside the scenario directory**, each appended at the
end of its list:

- `apps/scenario-lab/src/types.ts` +1: the id, which is required and was not
  named in the brief.
- `apps/scenario-lab/src/registry.ts` +2: import and map entry.
- `apps/scenario-lab/src/scenarios/live-instructions.ts` +2: import and
  `...PROFESSIONAL_NETWORK_LIVE_TASKS,`.
- `apps/scenario-lab/src/scenarios/live-repair-tasks.ts` +2: import and
  spread.
- `docs/architecture/testing-facility.md` +1: a row after `member-directory`.

`src/scenarios/index.ts` needed nothing, because the tasks flow through the
two task arrays. An ES import cannot share a line with a use, hence two lines
where the brief said one.

Fixture defects found and fixed while testing, before any live run:

- `.scrim{display:flex}` overrode `hidden`, so every hidden dialog covered the
  page. Added `[hidden]{display:none!important}`.
- Closing the connect dialog did not clear the honeypot field, so an honest
  second request was discarded. It is now cleared on close.
- The rate window of 2 s was unreachable through the UI because of the 0.7 s
  skeleton delay. It is now 3 s, still never hit at a reading pace.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` in `apps/scenario-lab`: no output
  (clean).
- `node --test dist/scenarios/professional-network/tests/scenario.test.js`:
  10 tests, 10 pass. Covers the manifest, oracles, results composition,
  mutations, seed rotation, and every route.
- `node --test dist/scenarios/professional-network/tests/honest-and-naive-paths.test.js`:
  9 tests, 9 pass, `duration_ms 36535`. Real Chromium against an in-process
  lab. The honest paths:
  - filter through the page's own pills and typeahead, page by number, and
    collect exactly the 23 expected records (24 read, one repeat);
  - withdraw exactly the 12 month-old requests, reading ages from shadow
    roots, and reach the goal store, which survives a reload;
  - reach the goal under the redesigned dialog;
  - get past the Premium offer and read the same people;
  - send a kept connection request.

  The naive paths fail:
  - following Next and keeping every card takes Sanne and never reaches Yara;
  - fast paging meets the 429 check, which then clears for a click;
  - a click on the pager under the conversation lands on the conversation;
  - withdrawing everything a month or more old (16 rows, pages included)
    misses the goal;
  - pressing Keep invitation withdraws nothing;
  - a click under the offer opens nothing;
  - filling the honeypot leaves the store unchanged.

  No page ever requested anything off the loopback lab.
- `node --test dist/tests/registry.test.js dist/scenarios/tests/live-instructions.test.js dist/scenarios/tests/live-repair-tasks.test.js dist/tests/state-store.test.js dist/tests/server.test.js`:
  31 tests, 31 pass.
- `node scripts/structure-audit.mjs`:
  `structure-audit: passed (81 warning(s), 122 baselined)`, with no finding on
  a professional-network file. One earlier failure, a `swallowed-failure` in
  `search/query.ts`, was fixed with a `best-effort:` reason.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test`: exit 0, 350 tests,
  350 pass, 0 fail.
- `pnpm check`: exit 0. Every workspace `check` printed `Done`, and the
  structure audit passed.
- Live run. Command, from the worktree root:

  ```
  FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t043-professional-network pnpm lab:campaign professional-network-rotterdam-data-engineers
  ```

  It resolved to `pnpm lab run professional-network --live-llm --llm-profile
  lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task
  create-flow --instruction-task professional-network-rotterdam-data-engineers
  ... --llm-max-cost-usd 0.25`. Observed:

  - The campaign reported `failed (run-mubndfg6-51368c1b), judgement not
    measured`. Totals: `tasks 1, passed 0, providerCalls 1, reportedTokens
    7756, reportedCostUsd 0.00347072`. Exit code 1.
  - `snapshots/live-llm.json`, evidence loop: `decisionCount 1`,
    `toolCallCount 1`, `toolIds ["web.inspect_current_page"]`, step
    `resultCode web.inspect.succeeded`, `evidenceBytes 5616`.
  - Build failure: `failure {code: flow_bootstrap.evidence_tool_failed, stage:
    provider_output_validation, httpStatus: 400}`, `permissionRequest null`,
    `durationMs 28952`.
  - The failure screenshot shows the feed rendered correctly, with the
    2.5-second app prompt open over it and the cookie banner unanswered.
  - Bundle: `F:xwork	043-scn-professional-network	est-runsun-mubndfg6-51368c1b`.
    Campaign summary: `test-runs\campaigns6-09-21T19-36-09-051Z\summary.md`.

  **Classification: product gap.**

  - What happened: Core's evidence loop turns `llm_evidence_loop.tool_failed`
    into this code (`runtime/llm/evidence-loop.ts:450-455` and
    `flow-bootstrap/generation-failure.ts:247`, read-only in the shared Core).
    The initial observation succeeded, the model's first decision (66 output
    tokens) asked for a tool, and that tool's execution threw or returned an
    unreadable result. Core then ended the whole build instead of returning the
    failure to the model as evidence.
  - Why it is not a fixture defect: the page was working as designed, and the
    honest browser path clears the same prompt with one click on "Not now".
  - Gap 1, capability: a single failed or blocked action on the first
    decision ends creation. It is never put to the model, which could close the
    prompt and retry.
  - Gap 2, observability: the failed call is absent from the recorded trace
    (only the initial observation is listed), and per-call records are "not
    recorded". Neither the lane nor this report can name which tool failed or
    why.
  - Not claimed: that the prompt caused the throw. It is the only
    interruption the screenshot shows, so it is the likeliest cause, but the
    trace cannot confirm it.
  - Caveat: while the campaign was building, I ran the scenario-lab suite,
    which rebuilt `apps/scenario-lab/dist` from identical sources. The Lab's
    scenario server started after both builds, and the screenshot shows the
    correct page.

## Not verified

- **Recording lane.** The manifest's recording scripts were not run through
  the recording lane with the extension. The browser spec drives the same
  targets and field selectors, but through Playwright directly.
  - `people-search` uses `numbered` pagination, which the runner's extract
    reader refuses as `fixture.invalid`. That is the known runner limitation
    the product-catalog `numbered-pages` workflow also has.
  - A recording cannot express the cross-page deduplication either, so a
    recorded-Flow lane run of `people-search` cannot meet its dataset.
- **Other tasks and the repair task.** The repair task, the upsell edge-case
  task, the withdrawal task and the consequential task were not run live. The
  brief asked for one live run, of the extraction task.
- **No Flow ever ran live.** The extraction oracle has therefore never been
  measured against a created Flow; only the honest browser path has met it.
- **Firefox.** Not exercised.

## Open questions or contradictions found

1. **The one control test id.** `live-repair-tasks.test.ts` only accepts a
   repair task whose variant removes a control the recording targets by
   `testid:`. So the shared withdraw dialog's confirm carries
   `data-testid="withdraw-confirm"` in the baseline, and it is the only test id
   on any control. The only other test id on the site is the oracle's
   `invitation-store` JSON script, which is not interactive. If the user's "no
   test ids" direction must hold absolutely, the repair harness needs another
   way to declare "the recorded target is gone".
2. **"Exactly one appended line".** The registrations are 1, 2, 2, 2 and 1
   lines, and `types.ts` needs its id line too. When unioning ten branches,
   the order of `scenarioIds` in `types.ts` must match the order of the
   registry map: `tests/registry.test.ts` compares them.
3. **Permission semantics of the consequential task.** Core treats an
   instruction that asks for a consequence as authority. So
   `professional-network-withdraw-stale-requests` names the withdrawal
   explicitly and should not raise a permission request.
   `professional-network-invitation-allowance` deliberately does not name it.
   Whether Core reads "deal with ... so they stop counting" as instructed is
   exactly what that task measures.
4. **Doc wording.** The testing-facility sentence before the table still says
   "Three reproduce larger application pages". I left it alone so ten
   branches merge as one-line unions; the supervisor should update the count
   once.
5. **Seed.** 4303, chosen well clear of the corpus's 101-172 range. A sibling
   choosing the same seed would fail the uniqueness test at merge.
