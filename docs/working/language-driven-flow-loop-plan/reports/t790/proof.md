# t790 / proof: the general recent-group-posts Flow, headed and provider-free

Cited run: `run-mvswewhy-e4e469d4`. Its Flow matched the oracle only through a literal list of today's three groups and a regex for three dates.

## Outcome

Done.

1. **The general Flow matches the oracle exactly.** It was hand-authored with no group list and no date pattern. It keeps rows by each post's own membership mark (its audience label starts "Shared with Members of") and by the fix-4 date bound on `posted`. It ran headed and provider-free, through the real built extension and Core, on social-network-feed. It stored exactly the oracle's rows: 3 of 3 rows in order, 15 of 15 fields, 0 unexpected rows, 0 extra columns. The Lab's own judge (`replaySavedFlow`, the code `lab replay` runs) gave `verdict: passed`.
2. **Membership change: no control exists.** The fixture has no join or leave control that changes membership (evidence below), so that half of the goal could not be run. Nothing was changed to stand in for one, and no fixture state needed restoring.

## The Flow script (exact text compiled)

```text
flow: Collect the home feed's posts written in a group I have joined on or after Saturday 19 September 2026, down to where it says I'm all caught up
step: allow the cookies if they are still asked
  node: web.dom.click
  selector: [role="dialog"][aria-modal="true"]:not(:has([aria-label="Close"])) > div:last-child > [role="button"]:last-child
  timeoutMs: 8000
  consequences: none
  optional: yes
step: decline notifications if they are still asked
  node: web.dom.click
  selector: [role="dialog"][aria-modal="true"]:has([aria-label="Close"]) > div:last-child > [role="button"]:first-child
  timeoutMs: 10000
  consequences: none
  optional: yes
step: close the chat if it is still open
  node: web.dom.click
  selector: [aria-label="Close chat"]
  timeoutMs: 10000
  consequences: none
  optional: yes
step posts: read the posts the feed shows
  node: web.dom.extract_list
  extractList: {"item": "[role=\"feed\"] > [role=\"article\"]", "fields": {"group": "h3 a[href*=\"/groups/\"]", "author": "a[href*=\"/people/\"]:not([aria-hidden])", "posted": "a[href*=\"/posts/\"][aria-label]@aria-label", "text": "[data-ad-comet-preview=\"message\"]", "comments": "[role=\"button\"][aria-expanded] > span"}, "where": [{"field": "group", "is": "present"}, {"read": "svg[role=\"img\"][aria-label^=\"Shared with\"]@aria-label", "startsWith": ["Shared with Members of"]}, {"field": "posted", "atLeast": "2026-09-19", "as": "date"}]}
  extractList.minItems: 0
  recordOutput.process: {"dedupe": {"by": ["group", "author", "posted", "text"]}}
  repeat while: next
step next: load more of the feed
  node: web.dom.next_page
  nextPage: {"item": "[role=\"feed\"] > [role=\"article\"]", "pagination": {"mode": "scroll"}}
  consequences: none
```

How it is built:
- The overlay steps are the matrix's `CONFIRM_OPENING` wording for this site.
- The field selectors are page structure, not seeded classes. They are the same structure the scenario's recording uses.
- The membership mark is read by a `where` `read` of its own, so it is tested without becoming a stored column. The answer keeps exactly the five asked-for columns.
- "Each once" is the record output's dedupe. "Whole text" is the read's default text disclosure.
- The loop is `repeat while: next` over a scroll `next_page`, which answers `ended` at the feed's end.

## What changed and why

- **No repository source, fixture, task, oracle, workflow or Core file was changed.** `git status` shows no file of mine in the repository.
- **Scratch files** are in `C:\Users\osrs_\AppData\Local\Temp\claude\c--Users-osrs--FluxStuff--FluxIQWebExtension\b969a395-6436-4284-bccb-432f7f43683b\scratchpad\`. Copies are kept with the evidence.
  - `t790-proof-flow.txt` is the script above.
  - `t790-proof-driver.mjs`:
    1. Opens a fresh persistent workspace once, as `run-matrix-case.ts` does.
    2. Saves the script as a Flow through `compileMatrixFlow`: Core's acceptor, then its validator against the web node library, then `createFlowBootstrapAdaptation` with approve and apply. No graph is hand-written.
    3. Calls `replaySavedFlow` with task `social-network-feed-recent-group-posts`. Its two seams only observe: they keep the browser handle for screenshots and keep the run's datasets for the field-by-field comparison.
  - `t790-proof-detail.mjs` reads Core's run detail offline from the stopped workspace. That is where the per-condition account below comes from.
- **Why not a matrix case.** A matrix case needs edits to `matrix-rows.ts`, `flows/index.ts` and its check types. That is more than the one new file the brief allows, and a matrix check judges site acts, not datasets. `replaySavedFlow` is the harness's own expected-dataset judge, so no case file was added.

## Commands run and observed results

All heavy commands ran under `lab-slots/heavy-check.lock`, which I released each time.

1. **Build.** `FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs recovery-matrix --list`. It went through the launcher's build phase and then ran nothing.
   - Result: exit 0, `rebuilt: test-contracts, scenario-lab, domain, extension, test-evidence, test-runner`, repository staleness check passed.
   - The extension and domain dist before this were older than fix 4's contract and domain sources.
2. **Run a.** `FLUXIQ_TEST_ENV_FILES=none node t790-proof-driver.mjs t790-proof-flow.txt a`.
   - Result: exit 1 before any browser opened. Core refused the script at validate: `bootstrap.parameter_schema_mismatch at plan.subflows.0.nodes.8.parameters.extractList: The step's "extractList.where.1.startsWith" must be an array`. I had written `"startsWith": "Shared with Members of"`.
   - I changed it to the one-element list `["Shared with Members of"]`, which means the same thing ("a list means any"). See open question 1.
   - The failed workspace `t790proof-a-d34a2f` was mine and has been removed.
3. **Run b.** The same command with label `b`.
   - Compiled cleanly: 11 nodes (`s9: dom-extract_list`, `s10: dom-next_page`), 0 warnings.
   - Replay `replay-mvt5a2t4-1199f91b`: `verdict: passed`, `reasons: []`.
   - Extraction: `expectedRecords 3, observedRecords 3, matchedRecords 3, expectedFields 15, presentFields 15, unexpectedFields 0, collectedRecords 8`.
   - `playbackGoalHeld: true`: the account-unchanged final state held.
   - The Flow's content hash and graph hash were unchanged (`f64319fd…` and `f6fcfa68…`).
   - Run `03d53987-eb3a-4a53-89bc-369518e49ec6`: `succeeded`. Every attempt succeeded on its first try: three optional clicks, read 1, next page (`moved by scroll`), read 2, next page (`ended: scrolled_to_end`).
4. **Offline detail read.** `node t790-proof-detail.mjs <workspace fluxiq-root> <project> <run> run-detail.json` wrote 386 KB.

### Stored rows vs. the oracle

**Rows:** 3 stored and 3 expected. 3 match in order, with 5 of 5 fields each. 0 unexpected rows, 0 extra columns.

| # | group | author | posted | comments | text |
| --- | --- | --- | --- | --- | --- |
| 1 | Riverside Allotment Society | Elena Sokolova | Monday 21 September 2026 at 05:55 | 18 comments | whole, equal |
| 2 | Harbourside Runners | Sofía Marín | Sunday 20 September 2026 at 20:46 | 24 comments | equal |
| 3 | Old Town Bakers' Circle | Oliver Hughes | Sunday 20 September 2026 at 03:35 | 15 comments | whole, equal |

Rows 1 and 3 are the two posts cut short behind "See more", and both were stored whole.

**Processing:** `collected 8, duplicates 5, filteredOut 0, kept 3`. Pass 1 gave 4 rows, 3 of them new. Pass 2 gave 4 rows, none new. The repeats are the Elena recap ("Aisha Khan commented on this") and pass 2's re-reads.

### Which condition left out which row

This is from Core's run detail, `actionAttempts[8]` and `[12]` `.metadata.extraction.conditions`. "Rejected" counts every row a condition failed. "Alone" counts the rows only that condition failed.

| Read | Items seen | Kept | Rejected (group, mark, date) | Alone (group, mark, date) |
| --- | --- | --- | --- | --- |
| Pass 1 | 25 | 4 | 19, 20, 9 | 0, 1, 1 |
| Pass 2, the whole feed | 34 | 4 | 25, 28, 14 | 0, 3, 2 |

In pass 2, these rows were left out by one condition only:
- **The membership mark alone left out three posts.** All are from unjoined groups and dated inside the range:
  - Kim Tran, Urban Growers Network, Monday 21 September 00:20
  - Rosa Delgado, Cycle Commuters of Harbourside, Monday 21 September 04:00
  - Idris Bello, Urban Growers Network, Sunday 20 September 09:40
- **The date bound alone left out two joined-group posts:**
  - Tom Becker, Riverside Allotment Society, Friday 18 September
  - Dev Patel, Harbourside Runners, Tuesday 15 September

So each of the two general conditions is needed for the oracle's answer. `group is present` never decided a row on its own, so it is redundant beside the mark, but harmless.

### Zero model calls

The replay's `model` block reads:
- `environmentCredentialVariables: []`, `modelProvidersEnabled: false`, `runIntent: null`
- `coreProviderCallCount: 0`, `accountedCalls: 0`, `calls: 0`, `interventions: 0`, `harnessActivations: 0`
- `llmGate: {invoked: false}`; Core provider keys 0 before and 0 after, preserved

`resultVerification: "unverified"` is expected: Core's result check needs a model, and the oracle verdict here is the Lab's.

### Evidence paths

Under `C:/Users/osrs_/FluxStuff/fxwork/t790/!FluxIQWebExtension/test-runs/`, which is git-ignored:

- `t790-proof/t790proof-b-ca995b/`:
  - `proof.json`: script, compile result, replay result, stored rows, per-row comparison
  - `run-detail.json`: Core's run detail
  - screenshots, all taken in the headed replay browser:
    - `00-before-run.png`: the cookie dialog on the fresh feed
    - `01-during-1.png` to `04-during-4.png`: during the run
    - `05-after-run.png`: the feed's end, "No more posts to show right now.", and the extension's "Run finished" toast
    - `zz-after-run-full.png`: 1263 x 12711 full page
  - copies of the three scratch scripts
- `replays/replay-mvt5a2t4-1199f91b.json`: the replay receipt
- `persistent-isolated/t790proof-b-ca995b/`: the workspace, with Core's store and the browser profile, kept for debugging. It is mine and can be deleted.

## Membership change (goal 2): no control exists

- The joined groups are a constant: `MEMBER_GROUPS` in `apps/scenario-lab/src/scenarios/social-network-feed/markup/group.ts` lists riverside-allotments, harbourside-runners and old-town-bakers.
- The feed's "Join group" button only shows a toast, "Your request to join has been sent." (`client/unit-script.ts`, lines 201-202). It changes no state.
- The group page's "Joined ▾" control has no handler in any client script.
- `state.ts` `mutateFeedState` has no join or leave operation. It has set-mode, consent, notifications, chat, chat-message, app-promo, group-post, create-post, trash-post, hide-post, unhide-post, share-post, like, confirm-request, delete-request, add-friend and rate-limited.
- So no person-level action on this fixture changes membership, and the after-change rerun could not be done.
- Nothing needed restoring. The read is no lasting act, and the replay's final-state check confirmed the account was unchanged.

## Not verified

- **How the Flow would respond to a membership change.** It could not be run (above). The Flow keys on each row's own audience label. A newly joined group's posts would carry "Shared with Members of …" and come back, but that is an inference, not an observation.
- **The other membership mark** ("join control absent together with a group present") was not run. The Join button is distinguishable only by its seeded class or its text, and its text is not CSS-selectable. The audience label was the clean structural mark.
- **Firefox** was not run, only the e2e-chromium build.
- **No live, paid or model-driven build.** This proves the general Flow is expressible and correct on today's fixture. It does not show that a builder would author it.
- **Where `disclosedRows` is recorded.** The read's metadata shows no `disclosedRows`, although the two long posts were stored whole. I did not trace where the disclosure is recorded.

## Open questions or contradictions found (reported, not fixed)

1. **A text test written as one string is refused in a literal `extractList` JSON, though the contract says one value or a list is allowed.**
   - `domain/src/actions/extraction/schema.ts`, lines 109-112, declares `matches`, `contains`, `startsWith` and `endsWith` as `type: "array"` only.
   - `request.ts` types each as `string | string[]`.
   - Core's `AUTOMATION_STUDIO_FLOW_CONDITION_RULES` tells the builder "one value or a list meaning any".
   - Core's validate stage applied the schema and refused my string with `bootstrap.parameter_schema_mismatch`.
   - The cited run's builder wrote `matches` as a string through the dotted `extractList.where` key on an evidence-handle read, and that was accepted. So some path normalises a string to a list, but not the literal-JSON path. I did not trace which one.
   - A builder that writes the documented string form inside a literal `extractList` would be refused. Either the schema or the guidance should change.
2. **The cited run's oracle pass was luck, not a general rule.** Its regex `(19|20|21) September 2026` fit today's data. This run shows the general form, the audience-label mark plus `atLeast "2026-09-19" as date`, gives the same 3 rows on the same fixture, with each condition doing necessary work.
3. **Optional, judgement call.** The fixture cannot show a Flow following a membership change, which is what this lane's generality claim is about. A fixture variant with a fourth joined group, or a join control that updates state, would make it testable. That would be a fixture change under the realistic-task rule, never an oracle change.
