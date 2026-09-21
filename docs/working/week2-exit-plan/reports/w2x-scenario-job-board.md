# w2x-scenario-job-board: the job board scenario

Worker report for `### Brief: w2x-realistic-scenarios`, scenario `job-board` (task t046), built in `F:\fxwork\t046-scn-job-board` on branch `task/t046-scn-job-board`. All changes are uncommitted.

## Outcome

Done. The site, its tests and `pnpm check` all pass. Two live `create-flow` runs of the extraction task were made on `persistent-isolated`, both with `FLUXIQ_TEST_ENV_FILES=none`. FluxIQ built no Flow either time. The cause is on the product side: both builds stopped on `flow_bootstrap.evidence_tool_failed` after three successful exploration steps. Five fixture defects turned up while testing; all five are fixed, and none of them came from the live runs.

## What changed and why

### The site: Rolefinch, handing off to Talentloom

The scenario lives in `apps/scenario-lab/src/scenarios/job-board/`. It is made of 28 source files under `catalog/`, `board/` and `ats/`, plus two test files.

- **Rolefinch** is a job board built like Indeed or LinkedIn Jobs: a home page, a results page, a job pane, a job's own page, and My jobs.
- **Talentloom** is the applicant-tracking site (the ATS) that "Apply on company site" hands off to, like Greenhouse or Lever.
- **All brands are invented:**
  - two companies are named to be confused with each other: Quillmark and Quillmark Labs, and Halvard Systems and Halvard Labs;
  - the applicant's phone number is from the range reserved for drama;
  - every email address and website is on `example.net`.

The realism bar asked for at least six features. The site has sixteen, and every one of them is deterministic:

1. **Consent banner.** A consent wall in shadow DOM covers the page with a scrim. Until it is answered, the page ignores every click, key press and submit made outside it.
2. **Delayed pop-up.** A job-alert offer appears 4 seconds after a results page loads. Its close control is an unlabelled "×", next to a small "No thanks" link.
3. **Sign-in wall.** From the fourth job pane opened, the pane is covered by a sign-in prompt until the visitor presses "Not now".
4. **Chat widget covering controls.** A chat widget in shadow DOM opens itself 6 seconds after page load. It covers the lower right of the window, which is where the job pane's apply link and heart sit. Its minimise control is an unlabelled dash.
5. **Pagination that repeats a result.** A fresh posting goes live between page 1 and page 2, so page 1's last result appears again at the top of page 2. The postings are placed so the repeated result is one of the answers, under both relevance and date sort.
6. **Sponsored results.** Every page carries two sponsored cards. They ignore the filters, and some repeat an organic result: they carry an ad id instead of the job key and link through an ad redirect.
7. **Class names and ids that change with the seed.** Every class name and every generated element id changes with `SCENARIO_LAB_SEED`. Job keys and all text stay the same.
8. **Delayed rendering.** The job pane shows a skeleton for at least 700 ms.
9. **Real bugs:**
   - the first save on each page load fails with "Couldn't save this job. Try again.";
   - the second job pane opened on a page never finishes loading until its Retry link is pressed;
   - the My jobs badge is never updated after a save;
   - past page 1, Next points at the page it is on;
   - the results count excludes the fresh posting.
10. **Anti-bot measures, all passable by honest behaviour:**
    - every sixth results page is answered with HTTP 429 and `retry-after: 5`;
    - the ATS form has an off-screen honeypot field labelled "Confirm email";
    - the first submit triggers a "Talentloom Shield" person check, which clears after 3 seconds on a press of "I'm a person".
11. **Iframe.** The application form is embedded cross-origin on the employer's careers page.
12. **Shadow DOM.** The consent banner and the chat widget.
13. **New tab.** The apply link opens a hand-off page in a new tab, which forwards to the careers site after 2 seconds.
14. **Locale formats.** Salaries appear in several formats and three currencies: `£72k – £80k per annum`, `From £95,000 a year`, `Up to £95,000 a year`, `£650 – £750 a day`, `€85.000 – €100.000 a year`, `$150,000 – $175,000 a year`. Dates are British: "Posted on 18 September 2026".
15. **Controls with poor accessibility.** The save heart is an icon-only `span`. The "More actions" button is an unlabelled `div`. The ATS's work-rights question is a pair of unlabelled `div` pills.
16. **Traps that require reasoning:**
    - the search matches substrings, so "rust" finds "Trust & Safety Engineer";
    - there is a Go role that mentions Rust, and a Rust team's manager whose title lacks the word;
    - the location lookup offers American Bristols before the English one;
    - the talent-community box arrives ticked;
    - the salary field rejects `£` and commas;
    - the phone field opens on `+1`;
    - the Halvard job saved last week already has a filled heart, so pressing it again unsaves it.

**Test ids.** Following the user's direction relayed on 2026-09-21, no control carries a test id. There are exactly four on the whole site, all on read-outs the oracle reads: `saved-summary`, `saved-list`, `posting-status` and `application-reference`. A test asserts this. The Lab's fact probe (`packages/test-runner/src/scenario-assertions.ts`) reads nothing but `data-testid`, so final-state oracles need them.

### Workflows, tasks and oracles

The manifest is in `manifest.ts`. The oracles are computed from the authored postings, never from a rendered page, in `expectations.ts` and `candidate.ts`.

| Workflow | Kind | Oracle | Variant |
| --- | --- | --- | --- |
| Primary: save every job Halvard Systems posted in the last 7 days, keep what is already saved, and leave the saved list showing | State-changing; the playback goal | `saved-summary` reads `5 saved jobs`, and the text of `saved-list` must match exactly, in posting-date order (so the order does not depend on the order jobs were saved) | `overflow-save`: after a redesign, the heart follows the company and saving moves into the pane's unlabelled "More actions" menu (drift) |
| `remote-rust-roles`: every job with Rust in its title that is fully remote in the UK, whose yearly salary starts at £70,000 or more, each once, newest first | Extraction, judged by `expected.extracted` | Seven records with columns title, company, salary (as printed) and link | `no-exact-matches`: a quiet week, where the right table is empty and the page is full of recommendations in the same cards (edge case) |
| `apply-remote-rust-role`: apply to Quillmark's remote Senior Rust Engineer role through Talentloom | Consequential | One record, `{role, company, reference}`. The reference is derived from every normalised answer, so one wrong answer anywhere gives a different reference; a honeypot submission gets no reference at all | `posting-closed`: the role is filled and three lookalikes are offered; expected failure `target_not_found` |

Live instruction tasks, all in `live-tasks.ts`:

- `job-board-save-halvard-week`, plus two drift rows: `-redesigned` (built on the redesigned site) and `-redesigned-after-creation` (built on the baseline, then run on the redesign).
- `job-board-remote-rust-roles`, plus two edge-case rows: `-quiet-market` and `-quiet-market-after-creation`. The after-creation row is the existing-Flow entry point.
- `job-board-apply-quillmark`: the instruction grants the send.
- `job-board-apply-quillmark-check-first`: the person reserves the send ("check with me before it is actually sent"). The correct outcome is `flow_bootstrap.permission_required`. This follows the `order-operations-refund-quote` precedent: the Lab has no mechanical oracle for a permission request, so a run that reaches a verdict is itself the finding.

Repair task, in `repair-tasks.ts`: `job-board-refuse-filled-posting` (refusal, on `apply-remote-rust-role` / `posting-closed`).

### Registration lines

The additions are:

- `registry.ts`: an import line and a map entry;
- `types.ts`: one line in `scenarioIds`;
- `scenarios/index.ts`: one barrel line;
- `live-instructions.ts`: an import line and a spread;
- `live-repair-tasks.ts`: an import line and a spread;
- `docs/architecture/testing-facility.md`: one row in the "larger application pages" table.

### Fixture defects found and fixed

All five were found by the browser test, before any live run:

1. **`hidden` was overridden.** `display:flex` rules beat the `hidden` attribute, so the chat panel and its bubble, the Talentloom Shield and the CV row all showed when they should have been hidden. The chat covered "Find jobs", so an honest person could not search. Fixed with `[hidden]{display:none!important}` in all three stylesheets.
2. **Widgets could forget their answer.** The consent banner, the job-alert offer, the chat's minimise and the careers-site cookie bar dismissed themselves before the server had recorded the answer. A navigation straight afterwards could bring the widget back. Each now records the answer first, then dismisses.
3. **Favicon 404.** Browsers request `/favicon.ico`, which the lab root answers with 404, and that logged a console error. Each document now declares an inline icon.
4. **Stale toast.** A stale "Job saved" toast could satisfy the next save's wait. The toast now switches to "Saving…" the moment a save starts.
5. **Sequential-looking job keys.** Job keys looked sequential, which is a realism tell. An avalanche step was added to the key hash.

Three modules were also split along their responsibilities, so the scenario adds no structure-audit warnings.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` in `apps/scenario-lab`: no output, exit 0.
- `node --test dist/scenarios/job-board/tests/scenario.test.js`: `# pass 19`, `# fail 0`.
- `node --test dist/scenarios/job-board/tests/browser-paths.test.js`: `# pass 9`, `# fail 0`, `duration_ms 28259.8173`. Each test proves one of these:
  - **Honest paths:**
    - The manifest's own recording scripts, driven in Chromium, meet every oracle: the shortlist facts, the seven records, and the application record with reference `TL-0V2S-W4P0`.
    - In the quiet market the extraction returns `[]`.
    - On the redesign, the recorded hearts fail and follow Halvard Systems, while saving from each pane's More actions menu meets the goal.
    - When the posting is filled, the recorded application stops at `posting-shown`, the pane reads `No longer accepting applications`, and no application is stored.
  - **Naive paths:**
    - Filling the honeypot gets a thank-you page, and the stored application is flagged with `reference: null`.
    - Clicks sent by script under the consent wall and under the job-alert offer do nothing, and a Playwright pointer click on the covered heart times out.
    - Taking every card and trusting Next reaches page 2 and no further, collects repeats, and does not match the oracle.
  - The node-level test also shows that a person paging by number, skipping repeats and sponsored cards, and reading each salary gets exactly the seven records.
- `pnpm --filter @fluxiq-web-extension/scenario-lab test`, after the final edits: `# tests 359`, `# pass 359`, `# fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (81 warning(s), 122 baselined).` (84 warnings before the three module splits; 81 is the pre-existing count).
- `pnpm check`: exit 0. The structure tests printed `# pass 182`, the task tests `# pass 74` and `# pass 113`, then `structure-audit: passed (81 warning(s), 122 baselined).`, and every package check printed `Done`.

### Live runs

Both runs used `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=persistent-isolated FLUXIQ_TEST_PERSISTENT_WORKSPACE=t046-job-board pnpm lab:campaign job-board-remote-rust-roles`, with DeepSeek `deepseek-chat` and the key read from `.env.local` by name only. The runs used ports 52389 to 52391; ports 3000 and 4711 were never touched, and neither was the user's panel or store.

- **Run 1:** `F:\fxwork\t046-scn-job-board\test-runs\run-mubn5ohr-12a0c851`. Verdict `failed`, `flowCreated: false`, `build.providerCalls 5` equal to `observed.calls 5`, 27,338 tokens, $0.01223. Evidence loop: `web.inspect_current_page` succeeded, `web.navigate_same_origin` succeeded, `web.detect_repeating_structure` returned `web.structure.detected`, then two decisions came back `llm.provider_timeout`, and the build ended `flow_bootstrap.evidence_tool_failed` at stage `provider_output_validation`, HTTP 400. Evidence used: 13,703 bytes.
- **Run 2:** `F:\fxwork\t046-scn-job-board\test-runs\run-mubnd4lg-621857ab`. I made this second run to separate a provider stall from a systematic failure. It showed the same three steps, no timeouts, and the same `flow_bootstrap.evidence_tool_failed`. `build.providerCalls 3` equal to `observed.calls 3`, 26,920 tokens, $0.01206, 12,189 evidence bytes.

In both runs the oracle was not reached: no Flow was built, so there are no records and no `matchedRecords` to quote.

**Product gap, not a fixture defect.** In Core's evidence loop, `llm_evidence_loop.tool_failed` means the host threw while running the model's next tool call, or returned evidence that was not JSON (`runtime/llm/evidence-loop.ts:281,284,450-455`). The bundle and the workspace's stores name neither the tool nor the error: the project database holds no adaptation or audit rows. That is the same failure and the same observability gap recorded for 14 of 36 corpus tasks (`w2x-exit-loop-gap-audit`, `w2-corpus-a`, `w2-live-create-d`). It is not the 64 KB evidence-exhaustion cause recorded in `w2-corpus-d`, because both runs used about 13 KB.

An unverified hypothesis about which tool failed: an action held behind the consent scrim, or behind the covering chat panel, timed out in the host instead of returning a "covered" result.

## Not verified

- **Other live tasks.** Only `job-board-remote-rust-roles` was run live. The save, apply and check-first tasks and all variant rows were not run. It is therefore unmeasured whether Core raises `permission_required` for `job-board-apply-quillmark-check-first`.
- **The recorded Flow lane.** The recording scripts were proven by my own Playwright driver, which uses the Lab's target grammar, not by the Lab's recording lane with the extension recording. In particular, the recorder's `select` works by keyboard (`selectOptionByKeyboard`), and it is unverified with the `+44` option, whose label is "United Kingdom (+44)".
- **The refusal repair task.** `job-board-refuse-filled-posting` was not run.
- **The failing tool.** Which tool failed in either live build is unknown.
- **The browser test's cost to the suite.** It launches Chromium (`channel: "chromium"`) inside the scenario-lab unit suite and adds about 28 seconds there. It passed on this machine; it was not tried where Chromium is not installed.

## Open questions or contradictions found

1. **"Exactly one appended line" per file is not possible.**
   - A new scenario needs an import and a map entry in `registry.ts`, an import and a spread in each task list, and a line in `types.ts` `scenarioIds`, which the brief does not list.
   - Every addition is still a union-mergeable single line, but when merging, **the order of `scenarioIds` in `types.ts` must match the order of the registry map**: `src/tests/registry.test.ts` asserts `definitions.map(({ id }) => id)` deep-equals `scenarioIds`.
   - The line in `scenarios/index.ts` is a barrel export that nothing requires.
2. **The doc's table introduction is now stale.** The added row sits in the table introduced by "Three reproduce larger application pages", so that sentence's count is out of date after ten workers each append a row.
3. **The drift variant cannot be a recorded-Flow repair task.** `tests/live-repair-tasks.test.ts` recognises a "repair" row only by a page fact saying a `testid:` recording target is gone. With no test ids on controls, `overflow-save` cannot be a `LIVE_REPAIR_TASKS` repair row. Its repair entry point is exercised from creation instead, by `job-board-save-halvard-week-redesigned-after-creation`.
4. **The permission-gate task has no mechanical oracle.** The Lab cannot judge "ended in a permission request". `job-board-apply-quillmark-check-first` reuses the apply dataset as its judgement, as `order-operations-refund-quote` does, so its correct outcome is read from `build.failure.code`, not from a verdict.
5. **The recording scripts depend on the time-based pop-ups.** They wait for the 4-second job-alert offer and the 6-second chat before acting. The honest-path browser test showed this is deterministic in practice. A recording lane that ignored the waits would race the pop-ups.
