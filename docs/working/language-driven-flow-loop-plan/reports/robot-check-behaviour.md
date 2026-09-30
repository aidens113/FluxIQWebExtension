# What FluxIQ does when it meets a robot check (read-only investigation)

Worker report, 2026-09-29. Read-only: no Lab or browser run, no Lab slots, no git, no tests run.
Trees read: `fxwork/t174` (downstream and Core, with F7 uncommitted in the working tree),
`fxwork/t193`, `t194`, `t195` reports, and dev's `docs/working/mvp-today-plan.md` and
`docs/architecture/*`.

## Outcome

Done. The refresh the user saw was FluxIQ's own navigations. Nothing reloaded to defend itself. The
build model kept issuing `web.output.browser-navigate` to crossborder search addresses. Each one was
a full search load, and every search load after the second is served the "I'm not a robot" page at
the same address. Every navigation onto that page reported `web.action.succeeded`, so nothing in the
loop knew it was stuck. Core's dry-run replays, its draft reruns and, in run 15, repair's
`navigate_in_scope` re-ran the same navigations. A navigation to the address the tab already shows
is issued as `chrome.tabs.reload` (`apps/extension/src/runtime/automation-tab.ts:187-190`, identical
on dev and t174). That is the literal page refresh.

F7 only partly fixes this. It is uncommitted, in t174's working tree, and its worker may still be
editing it:

- It makes a navigation that lands on crossborder's page fail with `USER_INTERVENTION_REQUIRED`.
- Core's build loop has no handling for that code. The model is told "A failure ends nothing...
  change something, and run again", so nothing stops the loop or hands the page to a person.
- A click that lands on a check is still reported as a success.
- F7's wording does not recognise bigbox's or company-website's checks.

## 1. Which runs showed it, and what happened step by step

### Crossborder runs, lane t174 (slot-1)

Two runs, both `crossborder-marketplace-hub-to-cart`, both with UI-review captures:

- **Run 15:** `run-munoeac4-33c17306`, 2026-09-30 05:40-05:43Z.
- **Run 17:** `run-munp80f5-c31ea417`, 06:07-06:08Z.

These are the only runs whose captures show a robot check for most of the build.

How to read the table below:

- **Evidence bytes.** A navigation that lands on the check always returns 1,591-1,621 evidence bytes
  (`snapshots/live-llm.json` `build.evidenceLoop.steps[]`). A real results page returns 4,527-4,713
  bytes, an item page 7,447-7,829 bytes and the home page 7,904 bytes. The size identifies which
  page each navigation landed on.
- **Screenshots.** Run 17's `04-mid-build-scenario.png` (06:07:30Z) and `07-failure-scenario.png`
  (06:08:22Z) show the farbazaar "Sorry, we have detected unusual traffic... I'm not a robot" page
  at `/search`. Run 15's debug records the same page in captures 04, 05, 06, 10, 13 and 14
  (`debugs/run-munoeac4-33c17306.md:181-191`).

Run 17, from the build trace (`logs/core.log`) joined with `steps[]`:

| Step | Time (Z) | What ran | Result | Bytes | Page |
| --- | --- | --- | --- | --- | --- |
| initial | 06:07:00 | snapshot | `not_at_start_location` | 209 | - |
| nav1 | 06:07:04 | navigate | succeeded, `unchanged` | 7904 | home |
| nav2 | 06:07:09 | navigate | succeeded | 4527 | results: search load 1 |
| nav3 | 06:07:13 | navigate | succeeded | 4713 | results: search load 2 |
| det1, ext1 | 06:07:16-22 | detect and extract | ok | - | results |
| rerun.4 (amend) | 06:07:28 | navigate re-run | succeeded | **1591** | **check**: load 3 trips it (`route.ts:31`) |
| nav5 | 06:07:34 | navigate | succeeded | 7447 | item page |
| complete #1 | 06:07:35 | refused `instructed_act_missing` | dry run 1: reset, replay | - | - |
| nav6 | 06:07:43 | navigate | succeeded | **1603** | **check** |
| rerun.10 (amend) | 06:07:47 | navigate re-run | succeeded | 7829 | item page |
| nav7 | 06:07:51 | navigate | succeeded | **1621** | **check** |
| nav8 | 06:07:54 | navigate | succeeded, `pageState: unchanged` | **1591** | **check, reloaded** |
| nav9 | 06:07:58 | navigate | succeeded, `pageState: unchanged` | **1592** | **check, reloaded** |
| complete #2 | 06:07:59 | refused, dry run 2 replays | - | - | - |
| decisions 18-25 | to 06:08:19 | 8 × `core.decision_unusable` | `instructed_act_missing` | - | stays on the check |

The build ended `flow_bootstrap.evidence_unusable_decision` (`events.ndjson` seq 3).

Run 15 follows the same pattern with the same byte sizes. 4 of its 9 build navigations landed on
the check: steps 4, 8, 11 and 14, where step 14 is a rerun with `pageState: unchanged`. After that:

- Playback navigated twice to the start page.
- Result re-authoring ran `nav.search.15` and others onto the check.
- The recovery ladder's exploration ran `navigate_in_scope` twice, and `web.recovery.press` came
  back `no_progress` (`debugs/run-munoeac4-33c17306.md:130-138`).

**Who chose to re-navigate.** Three sources:

1. **The model.** Every `nav*` and `rerun.*` above is a model decision (`kind=tool_call` or
   `amend_draft`). The model explored only by navigating to composed addresses: 0 presses and 0
   typing in both runs. t174 records this as "the model's navigate-only exploration stays open". Why
   the model chose to navigate again is not recorded: what the model was shown is withheld. What
   is recorded is that each navigation onto the check came back `web.action.succeeded`, and no
   result code named a challenge (run-15 debug, cause 2). Under the tool's own instruction, a
   succeeded navigation gives the model no reason to stop.
2. **Core's evidence loop.** Each `complete` runs a dry run: reset, then replay of the draft's
   navigations (`dryrun.N.*`, `core.replay.replayed`). Each `amend_draft` with a rerun runs the
   navigation again. Both are real site loads.
3. **Core's recovery ladder** (run 15 only): `navigate_in_scope` twice, during runtime exploration.

**What the extension did with a repeated address.** It issued a navigation to the address the tab
already holds as `chrome.tabs.reload` (`automation-tab.ts:187-190`). This is deliberate: "A
navigation means 'be on this page'". Steps with `pageState: unchanged` onto the check (run 17 nav8
and nav9, run 15 step 14) fit that. The artifacts do not keep the drive's `reloaded` flag or the
navigation address, so whether each individual navigation was a same-address reload or a new query
string is **NO EVIDENCE**. Either way, the fixture counts each one as a search load and re-serves
the check.

**Not the cause:**

- **The interference defence.** It never reloads. It skips any overlay that `challengeIn` reads as a
  challenge (`content/action-runtime/interference/clear.ts:86`). The only `tabs.reload` in the
  extension is `automation-tab.ts:190`.
- **Core's defensive retry.** It never ran: every navigation succeeded.

### Other lanes

- **t195, r4 `run-munoa86g-150fb0d9` (bigbox-retail pickup order).** A "Robot or human?" page with
  a Press & Hold control appeared on the search page during dry run 1, at d8 (screenshot t4,
  05:38:38; `t195 debugs/run-munoa86g-150fb0d9.md:156`, `reports/t195-w7-debugs-r3-r5.md:95`).
  That dry-run step was reported unreproducible. No repeated reloading is recorded.
- **t193 and t194.** No robot check is recorded:
  - t193 ran only bigbox.
  - t194 ran everything-store and met only the soft check, which it passed as designed
    (`t194-w3-extract-conditions.md:58`).
- **t174's bigbox runs** (`run-munore4o-c84cfa29`, `run-munpwa5r-e7aefe04`). The UI-review captures
  at `/search` (for example `run-munpwa5r` 10 and 14) show real results, not the check. The captures
  are periodic, so this does not prove the check never appeared.

## 2. What each scenario's check is by design, and what its task expects

All checks are served at the requested address. Reloading or re-navigating asks again. None is
passed by reloading.

| Scenario | Check (file) | What trips it | Honest way through, per the fixture | What the task expects |
| --- | --- | --- | --- | --- |
| crossborder-marketplace | "Security check" page: "please confirm you are not a robot", an "I'm not a robot" box. Pressing it runs a 2 s check, then reloads (`markup/verify.ts`, `client/verify-script.ts`) | Every search load once 2 have been made since the last pass. It then stays until answered (`route.ts:21-33`, `state/mutate.ts:82-84`) | **Press the box.** The honest `SPAIN_HUBS_SCRIPT` does exactly this (`manifest/steps.ts:88-89`) | `hub-to-cart`: the honest path loads search once and never meets the check (`steps.ts` ARRIVE and OPEN_OFFICIAL_LISTING). The check appeared only because FluxIQ loaded search 3+ times. `spain-hubs`: the honest path meets it on the third results page. |
| bigbox-retail | "Robot or human?", Press & Hold for 2 s, or wait 8 s and it passes itself (`pages/robot-check-page.ts`, `state/robot-check.ts`) | The 3rd results document served, then every results load until passed (`route.ts:35-37`) | **Wait.** The honest `pickup-towels` script only waits (`manifest/pickup-towels-workflow.ts:35-36,49`) | Nothing declared about the check. Reloading restarts its countdown. |
| everything-store (soft) | "Click the button below to continue shopping" (`pages/challenges/soft-check.ts`) | First search of a session | Click once ready, or wait | Pass it. |
| everything-store (hard) | "Enter the characters you see below", a canvas image (`pages/challenges/robot-check.ts`) | Variant `robot-check`, or the honeypot flag | Only a person can pass it | **Stop and ask a person**: `failure: { category: "user_intervention_required" }`, nothing typed, no new image (`workflows/first-page.ts:58-62,90-107`). Every other task asserts `never-challenged` (`workflows/shared-steps.ts:39`). |
| auction-marketplace | "Checking your browser before you continue". Continues by itself after 5 s, or press Continue (`pages/standalone.ts:10-23`) | 4th results page view (`route.ts:44`) | Wait, or press Continue | - |
| local-classifieds | Feed cover "Checking your browser before you continue", with Continue (`client/feed-script.ts:77`) | Feed rate (`route.ts:63,77`) | Wait, or Continue | - |
| company-website | Pressing submit starts "Checking you are human…", then a "Confirm you are human" box (`client/quote-script.ts:68-76`) | **A click** (submit), in page, not a navigation | **Click the box.** The manifest's honest steps do (`manifest.ts:59-60`) | - |
| professional-network | 429 security check with Retry-After (`search/rate-limit.ts`) | Fast paging | Wait and retry | - |
| job-board, photo-social | A "person check" on the ATS form, and a "session check" on the grid (not read in detail) | - | - | - |

Summary: only everything-store's canvas check is designed as person-only. Crossborder's and
company-website's are one-click checkboxes, which the fixtures' honest scripts press. Bigbox's,
auction's, local-classifieds' and everything-store's soft check clear themselves if the automation
waits. `docs/architecture/testing-facility.md:977-986` agrees.

## 3. What the product rule says

- **`mvp-today-plan.md`, the binding rules** (`:141-165`), say nothing about robot checks:
  - Rule 1, defensive execution: recoverable page, timeout and 429 faults are absorbed. Refusals are
    terminal. "a no-op is never reported as success".
  - Rule 2, risk-only permission: only moving money, deleting, and sending or publishing are
    permission events.
  - A robot check is not a permission event under rule 2, and no rule names it.
- **The rule that exists is the extension's**, on dev. `content/action-runtime/challenge-evidence.ts`
  treats a robot check as "a page condition recovery... must never try to get past". `results.ts`
  `challengeGateFailure` reports it as `USER_INTERVENTION_REQUIRED` "which only a person can
  answer". The failure taxonomy maps that code to `user_intervention_required`, not retryable
  (`docs/architecture/failure-taxonomy.md:32,194-200`).
- **Core honours the code at runtime:**
  - `executor/defensive/continuation.ts:44`: `false`, so it is not continued.
  - `recovery/deterministic-diagnosis.ts:196`: `"no"`, not recoverable.
  - `recovery/runtime-exploration.ts:456`: `"refused"`.
  - The everything-store `robot-check` variant is the one declared expectation, and it says the run
    stops and asks a person.

So yes: under the standing rule, a robot check that only a person can answer must be handed to the
person as an intervention. But three things are unsettled:

- **Checkbox checks.** The doctrine counts crossborder's and company-website's boxes as "robot
  checks" (F7 does for crossborder). The fixtures' honest scripts press them.
- **Spain-hubs.** Under the doctrine, `crossborder-marketplace-spain-hubs` cannot pass without a
  person pressing the box, because its honest path meets the check.
- **Self-clearing checks.** No rule says a check that clears itself should be waited out. Under rule
  1 it should be, rather than handed to a person or re-navigated.

## 4. Does F7 fix it?

The worker `t174-w14` is still in progress, so these files may change. F7's files in the t174 tree:

- `runtime/landed-challenge.ts` (new)
- `shared/page-challenge-message.ts` (new)
- `runtime/action-runner.ts`: navigate branch `:91`, `navigationResult` `:213-222`
- `runtime/action-results.ts`: `navigationChallengeFailure`
- `content/message-handler.ts`: a `fluxiq.pageChallenge` answer from the top frame
- `content/action-runtime/challenge-evidence.ts`: the `interstitialText` read for pages of at most
  1,000 characters, `:91`

**What F7 does fix:**

- A navigation that lands on crossborder's page now fails with `USER_INTERVENTION_REQUIRED` instead
  of succeeding.
- The failed navigation is not added to the draft ("A node that runs and succeeds becomes a step").
- At runtime (playback and repair), Core's continuation, diagnosis and exploration refuse that code,
  so run 15's `navigate_in_scope` onto the check should now stop.
- The interstitial read also widens `challengeGateFailure`. Any later action whose target is missing
  on crossborder's page now fails with `USER_INTERVENTION_REQUIRED`.

**What F7 does not fix:**

1. **The build does not stop.** Nothing under Core `runtime/llm/` or `runtime/flow-bootstrap/`
   handles `user_intervention_required` (grep: no match). The `core.run_node` tool tells the model
   "A node that fails comes back with what went wrong... read it, change something, and run again.
   A failure ends nothing." (`Core runtime/llm/node-tools/run-node.ts:64`). So after F7:
   - The model sees a failed navigation and may navigate again. Each attempt is still a real load or
     reload, now failing.
   - Or the model may snapshot the page and press "I'm not a robot" itself. Nothing refuses a click
     whose target was found on a challenge page; only a missing target is gated. That contradicts
     the doctrine.
   - There is no hand-off to the person and no wait-and-resume, unlike the permission ask
     (`flow-bootstrap/action-permissions.ts`).

   "Stops re-navigating into it" in F7's fix-log text is therefore a hope about the model, not a
   mechanism.
2. **A check that appears after a click is not recognised at the click.** Crossborder's filter
   clicks, bigbox's facet clicks, auction's pager clicks and company-website's submit all trip a
   check through a click. `runtime/click-landing.ts:166-167` checks only for HTTP 400 or above, and
   every check is served 200. So the click reports success. Only the next action that targets
   something missing gets `USER_INTERVENTION_REQUIRED`. Snapshots, waits and navigations do not.
   Company-website's check is drawn in the page after a click, with no navigation, which F7's
   arrival check cannot see.
3. **Wording coverage.** I ran the regex against each fixture's text with `node -e`, copying the
   pattern from `challenge-evidence.ts:77`:
   - Matched: crossborder ("not a robot") and everything-store hard ("characters you see", plus
     `aria-label="Security image"`).
   - Not matched: bigbox ("Robot or human?", "confirm that you're human") and company-website
     ("Confirm you are human").

   So F7 still reports bigbox's check as a successful navigation. That is the check t195 r4 met.
4. **Self-clearing checks are not waited out.** Bigbox (8 s), auction (5 s), local-classifieds and
   everything-store soft are not recognised by anything, which is correct because they are not
   person-only. But no defensive wait exists either. A re-navigation or reload restarts them, and
   bigbox's countdown restarts on every load.
5. **Nothing causes fewer loads.** The trigger in every scenario is repeated loads:
   - the model's navigate-only exploration of composed search addresses;
   - dry-run replays and reruns of navigations;
   - the same-address reload rule (`automation-tab.ts:187-190`).

   F7 does not touch any of these.
6. **The person is never told.** UI finding U9 (`reports/t174-live-lane.md:281`): the overlay read
   "Deciding the next step" over the check for most of run 15. F7 adds no panel or overlay signal.

## Correct behaviour

My recommendation, from the rules and fixtures above:

- **Person-only checks** (everything-store canvas, and crossborder's and company-website's boxes
  unless the product decides otherwise). The build and the runtime stop acting on the page. They put
  a visible "a robot check is waiting for you" request to the person, wait for them to answer, then
  resume with the page re-observed. They never type, press or reload into it.
- **Self-clearing checks** (bigbox, auction, local-classifieds, everything-store soft, and
  professional-network's 429). Defensive execution waits them out without navigating, then
  re-observes.
- **In every case**, a navigation or click that lands on any check is never reported as a plain
  success.

## What remains, with owning files

| # | Gap | Owner (file:line) |
| --- | --- | --- |
| R1 | The build loop has no stop, hand-off or wait for `user_intervention_required`, and it tells the model to try again | Core `runtime/llm/node-tools/run-node.ts:64`; evidence loop `runtime/llm/evidence-loop/tool-execution.ts`; a hand-off like `runtime/flow-bootstrap/action-permissions.ts` |
| R2 | A click landing on a check reports success | extension `apps/extension/src/runtime/click-landing.ts:166-167`; could reuse `runtime/landed-challenge.ts` (t174) |
| R3 | Bigbox and company-website wording not recognised | extension `content/action-runtime/challenge-evidence.ts:77` (`CAPTCHA_WORDS`) |
| R4 | No defensive wait for self-clearing checks, and a same-address navigation reloads the check, restarting its countdown | extension `runtime/automation-tab.ts:187-190`; defensive envelope (Core `executor/defensive/`) |
| R5 | Navigate-only exploration and replayed navigations make the loads that trip checks | Core evidence loop / dry-run replay (`runtime/llm/node-tools/replay-draft.ts`); t174's open item |
| R6 | Nothing shows the person that a check is waiting (U9) | t191 (UI), extension panel and overlay |
| R7 | Product decision: are checkbox checks the person's (doctrine, F7) or passed by the product (fixture honest scripts)? It decides whether `spain-hubs` can pass unattended | supervisor or user; `docs/working/mvp-today-plan.md` binding rules |

## Commands run and observed results

- `grep` over all 30 run folders in the four lanes for "robot/captcha/verify you are human": 0
  hits. Artifacts are redacted, so I used byte sizes and screenshots instead.
- A `python` read of `live-llm.json` `build.evidenceLoop.steps[]` for runs 15 and 17 produced the
  tables above: the check lands at 1591-1621 bytes.
- Read the UI-review PNGs:
  - run 17: 04 and 07 show the check;
  - `run-munpwa5r` (bigbox): 10 and 14 show real results.
- `node -e` regex test: crossborder `captcha`, everything-store hard `captcha`; bigbox,
  everything-store soft, auction, classifieds and company-website `no match`.
- `git status` and `git diff` in the t174 tree, to read F7. No git writes.

## Not verified

- F7's unit tests: I did not run them. The worker may be mid-edit, and the brief is read-only.
- F7's live behaviour, and what the model does after a failed `USER_INTERVENTION_REQUIRED`
  navigation: needs a live run.
- Whether each navigation onto the check was a same-address `tabs.reload` or a new query string:
  the address and the `reloaded` flag are not kept in the artifacts.
- What the model was shown after each navigation, for example whether the page title "Security
  check" reached it.
- Job-board's and photo-social's checks, which I did not read in detail.

## Open questions or contradictions

- The product rule and the fixtures disagree on checkbox checks (R7). The everything-store variant
  and the extension doctrine say "person". Crossborder's `SPAIN_HUBS_SCRIPT` and company-website's
  honest steps press the box.
- F7's fix-log claim "stops re-navigating into it" rests on Core acting on the code, and Core's
  build loop does not act on it (R1).
- `run-munpwa5r-e7aefe04` (bigbox, t174 slot-1) exists but is not in t174's run table yet.
