# w2x-e2e-live-campaign, lane E: local-classifieds and company-website

Worker report for brief `w2x-e2e-live-campaign`, lane E (task t056, worktree
`F:\fxwork\t056-e2e-lane-e`). This was testing only. I changed no source, Lab or
scenario file.

## Outcome

**Partial.** Every task registered for both sites was run. The one exception is
`local-classifieds-repair-moved-save`, whose run stopped before any repair could
start, for the reason given below. **No run on either site produced a working
deterministic Flow:**

- 0 of 13 model builds created a Flow, so `matchedRecords` against
  `expectedRecords` was never measured and no replay was possible.
- 0 of 7 provider-free recording-lane runs replayed their recorded Flow to the
  oracle.
- 0 of 2 panel journeys got past exploration.

In every build that called the provider, `build.providerCalls` equals
`observed.calls`, so the model's work was all spent in the build. Nothing was
spent on running a Flow, because no Flow was ever run.

Round labels:

- **Round 1a** ran on Core `278c44b` with downstream `08e7dc6`. It covers the 7
  recording-lane runs and 2 creation runs.
- **Round 1b** ran on Core `71e2798` with downstream `13284d8`, after the
  supervisor synced Core. It covers the rest.
- **Disclosure:** 5 round-1a runs were made with `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`.
  Core's `dev` had moved past `278c44b` while those runs were in progress. They
  are the 3 company-website extraction recording runs, `local-classifieds-bike-search`
  and `local-classifieds-bike-search-list-layout`. The supervisor's pause message
  arrived after that, and the flag was never set again.

Spend:

- **Lab runs:** $0.4325, as reported by the provider, with no reservations
  included:
  - round 1a creation: $0.1780;
  - round 1b local-classifieds: $0.1492;
  - round 1b company-website: $0.1052, including $0.0022 for the repair
    diagnosis.
- **Panel runs:** their evidence does not record cost. They are estimated at about
  $0.06 each, from Lab builds with the same number of decisions.
- **Total:** about $0.55 of the $4 cap.
- No HTTP 429 and no RAM-fault retries occurred. Every task finished in one attempt.

## What changed and why

- **Written in the repository:** only this report.
- **Scratch files:** my own, all in the session scratchpad
  (`...\scratchpad\lane-e\`):
  - batch scripts and logs;
  - `judge.cjs`, which reads one run bundle into a judgement line;
  - `sql.cjs`, a read-only query helper for Core's SQLite;
  - `instr.cjs`, which extracts a task's instruction string;
  - `panel.sh`;
  - `panel-cred.sh`, a private generated panel identity that was never printed.
- **Ignored runtime state** created under the worktree's `test-runs/`:
  - `instances/lane-e/` for the run bundles;
  - persistent workspaces `lane-e-lc`, `lane-e-cw`, `lane-e-lc2` and `lane-e-cw2`;
  - campaign summaries under `campaigns/lane-e-*`;
  - demo workspaces `lane-e-panel-lc` and `lane-e-panel-cw`.
- **Pause handling:** I stopped my own batch and campaign processes after the
  in-flight task, as the supervisor's message asked. No other lane's process was
  touched.

## Commands run and observed results

The environment was the same for every Lab run:

- `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_LAB_INSTANCE=lane-e` and
  `npm_config_workspace_concurrency=1`;
- `--target persistent-isolated`;
- Lab ports allocated by the runner;
- panel ports 3356/4956 for local-classifieds and 3357/4957 for company-website;
- DeepSeek, with the key read from the worktree's `.env.local`.

Commands:

- **Recording lane:** `node scripts/lab/run-lab.mjs run <site> [--workflow <w>] --target persistent-isolated --workspace lane-e-{lc,cw} --flow`.
- **Creation and repair tasks:** `node scripts/lab/live-campaign.mjs <task ids> --max-attempts 2 --output test-runs/campaigns/lane-e-*-r1b -- --target persistent-isolated --workspace lane-e-{lc2,cw2}`.
- **Consequential tasks, permitted run:** the same command with
  `-- ... --llm-permit send_or_publish` for make-offer, and
  `--llm-permit move_money` for book-service.
- **Panel:** `setup-demo-llm-key.mjs`, then `prepare-demo-llm-workspace.mjs`, then
  `run-demo-llm-exploration.mjs` with `FLUXIQ_LLM_SCENARIO_ID` and
  `FLUXIQ_LLM_INSTRUCTION` set to the site's extraction task. That is journey 1;
  the apply and run steps were never reached.

Reading the tables:

- Run ids are under `F:\fxwork\t056-e2e-lane-e\test-runs\instances\lane-e\`.
- "Calls b/o" is `build.providerCalls` over `observed.calls`.
- "Evidence" is the build's decisions and evidence bytes, against Core's
  64,000-byte creation budget.
- **P2** means the build ended on a failed tool call. **P2 (budget)** means it
  ended the same way, but only because the evidence budget was used up.

### Recording lane (provider-free), round 1a

| Workflow | Run | Flow created | Outcome, judged from the files | Where it stopped | Wall clock | Classification |
| --- | --- | --- | --- | --- | --- | --- |
| local-classifieds primary (offer) | run-mubpss6p-93425e10 | yes, `flow.1860ac60…` (32 candidates, 23 recorded actions, extension = Core) | The recorded script passed. The Flow failed at node 1 with `web.validation.state_mismatch` at verification: it expected URL `/search/` and found the front page. Oracle failed. | Node 1, the "Allow all cookies" click. The click worked (the banner is gone in the screenshot), but the node claims the landing of the later search submission. | 149 s | Product gap. The recorded click's landing was attributed to the wrong click: the extension recorder's explained-navigation link and `domain/src/runtime/expectation/click-landing.ts`. |
| local-classifieds `bike-search` | run-mubq0jx5-539c439e | no | The recording script's `extract-bike-results` step, which is FluxIQ's own `web.dom.extract_list`, returned 13 records where 12 were expected. | The extract step, after "Results outside your search" | 39 s | Undetermined: a product gap or a scenario defect. The run is counts-only, so which record was extra cannot be seen. |
| local-classifieds `save-dining-tables` | run-mubq2xea-a38183db | no | `fixture.invalid`: "Scripted navigation requires a safe loopback destination" | Step `back-to-tables-1` | 20 s | Lab defect. `packages/test-runner/src/scenario-steps/scripted-navigation.ts` `safeNavigationUrl` refuses any query string, and the manifest navigates to `search/?query=dining+table&…`. |
| company-website primary (quote) | run-mubq4lrk-093d6e54 | yes, `flow.8e8e8936…` (24 candidates, 21 actions) | The Flow failed at node 1 with `web.target.ambiguous` at target resolution: `div:nth-of-type(2) > div` matched 7 elements, all scored -0.28. Oracle failed. | Node 1, the chat greeting's "×" Close (title "Close", XPath `/div[1]/div[1]`, apparently inside a shadow root) | 88 s | Product gap. The recorded identity lost the element's scope and distinguishing attribute, and the resolver did not use the accessible name or title "Close". |
| company-website `gas-engineers` | run-mubq9602-64eec465 | no | The extension refused the extract: `querySelectorAll` does not accept `:has(dt:text-is(…) + dd:text-matches(…))` | The extract step | 31 s | Site or scenario defect. The manifest's extract targets use Playwright-only pseudo-classes, but an `extract` step is FluxIQ's own read. |
| company-website `business-prices` | run-mubqawus-4884285f | no | The same refusal, for `:has-text` and `:text-is` | The extract step | 21 s | Site or scenario defect, as above |
| company-website `book-service` | run-mubqchue-3fce5b49 | no | The same refusal, for `dt:text-is("Reference") + dd` | The extract step | 24 s | Site or scenario defect, as above |

### Creation and repair tasks

No build created a Flow. The oracle was therefore never reached, the records were
never measured and no replay was possible.

| Task | Round | Run | Calls b/o | Build failure (code / stage) | Evidence | Where it stopped | Cost | Wall clock (run / build) | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| local-classifieds-bike-search | 1a | run-mubqeeb0-785daeb9 | 14/14 | `flow_bootstrap.evidence_limit` / provider_output_validation (400) | 14 d, 63,761 B | It explored the marketplace (inspect, press, same-origin navigate, repeated structure detection), with one unusable decision (`web.handle.ambiguous`) and one `target_unobserved`, and ran out of evidence before authoring anything. | $0.0795 | 115 s / 64 s | Product gap: the evidence budget |
| …-list-layout (armed after build) | 1a | run-mubqhqhk-1e205c3d | 17/17 | `flow_bootstrap.evidence_tool_failed` | 17 d, 63,877 B | As above, with 4 `target_unobserved` presses. The next tool was given 123 bytes and threw. | $0.0985 | 113 s / 68 s | P2 (budget) |
| …-location-check (armed after build) | 1b | run-mubqpw4d-ed72c026 | 11/11 | `evidence_tool_failed` | 11 d, 63,946 B | After typing into a field and one `target_unobserved`. 54 bytes were left for the next tool. | $0.0628 | 135 s / 62 s | P2 (budget) |
| local-classifieds-save-dining-tables | 1b | run-mubqu359-42e57a92 | 10/10 | `evidence_tool_failed` | 10 d, 63,861 B | It had pressed controls and inspected, but saved nothing. 139 bytes were left. | $0.0568 | 136 s / 88 s | P2 (budget) |
| local-classifieds-make-offer, **no permit** | 1b | run-mubqy9u4-0c86feac | 3/3 | `evidence_tool_failed` | 3 d, 23,377 B | Inspect, press (cookies), navigate; the 4th tool failed. **Incorrect:** it ended without a permission request (`permissionRequest: null`). Core stored no adaptation and no audit event. | $0.0148 | 38 s / 21 s | P2 |
| local-classifieds-make-offer, **`--llm-permit send_or_publish`** | 1b | run-mubr1gag-0fbabc4b | 3/3 | `evidence_tool_failed` | 3 d, 23,377 B | Identical to the unpermitted run, byte for byte. **Not done.** | $0.0148 | 71 s / 19 s | P2 (deterministic) |
| local-classifieds-repair-moved-save | 1b | run-mubqzvdm-464ff7ab | — | `fixture.invalid` in the recording lane, before any Flow or repair | — | The same `back-to-tables-1` query-string refusal | $0 | 26 s | **Not runnable:** the Lab defect in scripted navigation |
| company-website-quote-request | 1b | run-mubr4ksf-7cf09d55 | 1/1 | `evidence_tool_failed` | 1 d, 6,479 B | Its first tool call after inspecting the home page failed. The consent banner and chat greeting are both open on that page. | $0.0035 | 34 s / 7 s | P2 |
| …-quote-request-redesigned-after-creation | 1b | run-mubr6bex-e2e39a7c | 1/1 | `evidence_tool_failed` | 1 d, 6,479 B | Identical to quote-request | $0.0035 | 78 s / 35 s | P2 (deterministic) |
| company-website-gas-engineers | 1b | run-mubr9fia-f1f7228a | 9/9 | `flow_bootstrap.evidence_repeat_without_progress` | 9 d, 19,415 B | Navigated to the team page. Structure detection first succeeded twice, then returned `web.action.rejected.no_repeating_structure`, and the model repeated the call 3 times. | $0.0386 | 105 s / 52 s | Product gap: repeating-structure detection on the team cards, and no way out of the repeat |
| …-gas-engineers-winter-notice | 1b | run-mubrctrv-c704adaf | 7/7 | `evidence_tool_failed` | 7 d, 18,266 B | The same team page and the same `no_repeating_structure` rejections, then a tool failure | $0.0334 | 71 s / 27 s | P2, plus the structure-detection gap |
| company-website-business-prices | 1b | run-mubrf8xd-fc091cb1 | 3/3 | `evidence_tool_failed` | 3 d, 13,010 B | Navigated to the prices page and detected the structure; the 4th tool failed. | $0.0127 | 59 s / 17 s | P2 |
| company-website-book-service, **no permit** | 1b | run-mubrhnx8-67b0aeb5 | 2/2 | `evidence_tool_failed` | 2 d, 12,000 B | Inspect, navigate; the 3rd tool failed, long before the £30 deposit. **Incorrect:** no permission request, and Core stored no adaptation. | $0.0079 | 47 s / 13 s | P2 |
| company-website-book-service, **`--llm-permit move_money`** | 1b | run-mubrogqc-0de6b4fc | 1/1 | `evidence_tool_failed` | 1 d, 6,479 B | The first tool after inspect failed. **Not done.** | $0.0035 | 43 s / 13 s | P2 |
| company-website-repair-redesigned-quote-submit | 1b | run-mubrk4bd-016da27c | repair 1 call | The recorded Flow `flow.cc125992…` failed at node 1 with `web.target.ambiguous`, exactly as in round 1a. Diagnosis made 2 interventions and 1 provider call, but no patch: `llm.runtime_patch_not_requested`. | — | The chat greeting's Close, before the redesigned drawer the task is about. Repair judgement: failed. | $0.0022 | 131 s | Product gap: the recorded target identity. The variant's drift was never reached, so this task cannot measure repair until that is fixed. |

### Panel creation, journey 1 (round 1b; key setup and preparation passed on both sites)

| Site / task | Explore evidence | Outcome | Where it stopped | Wall clock | Classification |
| --- | --- | --- | --- | --- | --- |
| local-classifieds, the `BIKES` instruction | `demo-llm-explore-2026-09-21T21-44-13-544Z-f991e5` | HTTP 400, `flow_bootstrap.evidence_tool_failed` after 10 decisions at 63,962 B. The panel showed only a generic error (`visibleGenericError: true`). Apply and run were not runnable because no proposal existed. | The front page's "Today's picks", after 5 navigations and 2 clicks. It never used the category filters. "Couldn't load more listings. Try again" was on screen. | Setup 2 m 40 s, prepare 1 m 17 s, explore 2 m 27 s | P2 (budget), plus a UI gap: the error the person sees is generic |
| company-website, the `GAS_ENGINEERS` instruction | `demo-llm-explore-2026-09-21T21-51-25-803Z-7c4603` | HTTP 400, `evidence_tool_failed` after 10 decisions at 63,909 B. Generic error shown. Apply and run were not runnable. | 9 navigations, whose before and after screenshots are the same image (hash `e39db3173f0e`): the home page with the consent banner and chat greeting still open | Setup 1 m 51 s, prepare 1 m 53 s, explore 2 m 23 s | P2 (budget), plus a UI gap |

Neither panel evidence bundle records tokens or cost. The panel's own
`providerCallCount: 1` contradicts the 10 decisions it recorded.

## Product gaps, ranked by the number of tasks each one hit

1. **A build ends on a failed evidence tool call (`flow_bootstrap.evidence_tool_failed`).
   This is P2 proper: the evidence budget was not exhausted.**
   - **Hit:** 6 tasks in 8 runs: make-offer (twice), quote-request,
     quote-redesigned, gas winter-notice, business-prices and book-service (twice).
   - **Core site:** `runtime/llm/evidence-loop.ts:446-455`, where any thrown or
     malformed tool result ends the build.
   - **The failed call leaves no record:** its tool id and error are absent from
     `build.evidenceLoop.steps`, from `core.log` and from Core's store. Core stored
     no adaptation. So on company-website I cannot name the tool that failed.
   - **Determinism:** make-offer and quote-request failed identically on their
     reruns. Book-service did not: it failed at decision 3, then at decision 2.
2. **The 64,000-byte creation evidence budget runs out after 10 to 17 decisions.**
   - **Hit:** 6 tasks: bike-search, list-layout, location-check,
     save-dining-tables, and both panel journeys.
   - **Mechanism:**
     - `loop-limits/flow-bootstrap-evidence-loop.ts:107` sets `maxEvidenceBytes: 64_000`.
     - `llm/evidence-loop.ts:447` gives each tool only `64,000 - used` bytes;
       here that was 54 to 239 bytes.
     - The domain's `runtime/llm-evidence/sanitize.ts` `trimToBudget` then throws
       "web DOM snapshot exceeds the evidence byte limit", which Core reports as
       `tool_failed`. Only bike-search surfaced as `evidence_limit`.
   - **Relevance to P2:** 5 of these 6 therefore carry P2's code without P2's
     cause. Feeding the tool failure back to the model cannot rescue a build
     that has 54 bytes left.
3. **The recorded Flow does not replay the recorded honest path.**
   - **Hit:** 2 recording-lane workflows and 1 repair task. The repair task was
     blocked outright.
   - **company-website:** the chat Close target is stored as a shadow-relative
     `div:nth-of-type(2) > div` and resolves ambiguously, with 7 equal-score
     matches. This happened in round 1a, on the recording lane, and again in
     round 1b, in the repair run, where diagnosis then declined to request a patch.
   - **local-classifieds:** the cookie click carries a later search's URL as its
     expected state (`click-landing.ts`, or the recorder's explained-navigation
     link).
4. **Repeating-structure detection fails on the company-website team cards**
   (`web.action.rejected.no_repeating_structure`), and the model keeps asking.
   - **Hit:** 2 tasks. gas-engineers ended on `repeat_without_progress`;
     winter-notice showed the same pattern before its tool failure.
5. **After a rejected build, the panel shows only a generic error.** Hit: 2 panel
   journeys. The person is not told what failed or why.
6. **FluxIQ's `extract_list` returned 13 records where 12 were expected** on
   local-classifieds bike-search, in the recording lane. Hit: 1 workflow. It is
   undetermined whether this is a product gap or a manifest defect.

Lab and scenario defects, none of which count against the product:

- scripted navigation's query-string refusal, which blocks the save-dining-tables
  recording and the moved-save repair (2);
- the company-website manifest's Playwright-only extract selectors (3 workflows);
- the run files never record which classes `--llm-permit` granted: neither
  `live-llm.json` nor `run.json` names them. The campaign log shows the flag was
  passed, but I cannot confirm from the run's own files that the grant carried
  the class.

## Not verified

- **Which tool failed** in any P2-coded company-website build. Nothing retained
  names it (gap 1).
- **The extra record** in the bike-search recording extract.
- **Whether the consequential no-permit runs would raise the right class**
  (send_or_publish, move_money). Neither reached the consequential control, so
  the permission-request path was never exercised.
- **Deterministic replay** (`lab replay`) and the panel's apply and bound run:
  there was never a saved Flow or proposal to use.
- **Panel spend:** not recorded, only estimated.
- **Why the company-website panel's navigation screenshots never changed:**
  whether the captured tab differs from the one Core navigated, or whether the
  navigations did not take effect.
- **bike-search and list-layout on Core `71e2798`:** these round-1a results were
  not rerun, as instructed.

## Open questions or contradictions found

- **Is P2 the right fix for most local-classifieds failures?** Before P2's round-2
  measurement, the supervisor should decide how to split its fix from the
  evidence budget. Four of the six local-classifieds builds, and both panel
  journeys, ended within 250 bytes of the 64,000-byte budget.
- **How should the created Flows be judged?** No build on either site authored a
  Flow. Every "how many records matched" measure this campaign was meant to take
  is therefore still unmeasured on these sites.
- **Are the recording lanes usable for these two sites yet?** The scenarios say
  no recording lane had run them before ("no recording lane has run this
  fixture"). On company-website, 3 of 4 recording workflows cannot run until the
  manifest's selectors change, and 1 of 3 on local-classifieds cannot run until
  the Lab accepts query strings.
