# w2x-e2e-lane-b: live campaign lane B (bigbox-retail, everything-store), round 1

Worker report for `### Brief: w2x-e2e-live-campaign (five lanes, two sites each)`,
lane B, task t053, worktree `F:\fxwork\t053-e2e-lane-b`. Round 1 is the baseline
before P2's tool-failure fix.

Revisions:
- **Rev A**: downstream `08e7dc6`, Core `278c44b`. The first three bigbox recording
  runs only; the supervisor asked me to keep them.
- **Rev B**: downstream `13284d8`, Core `71e2798` (adds t035, t036's `--llm-permit` and
  t048; P2 not in). Every other run.

## Outcome

**Done.** Every lane B task was run or is recorded as not runnable, with the reason.
**No Flow reached a correct result.** Scored the way this project counts success (a
Flow that replays with no model and matches the expected records or final state):
0 of 10 creation tasks, 0 of 3 repair tasks and 0 of 2 panel creations passed.

- **Creation (Lab), 12 builds.** None produced a Flow; every build ended during
  exploration.
  - Seven ended on P2's build-ending failed tool call, `flow_bootstrap.evidence_tool_failed`.
  - The other five ended on an exploration stall, an ambiguous-handle stop, the
    evidence budget, or an unclassified 400.
- **Consequential tasks.** The four runs (two without a permit, two with
  `--llm-permit move_money`) all ended before reaching checkout. So permission
  behaviour is **unmeasured**: no permission request was raised and none was due
  yet. Core's store in both workspaces holds zero adaptations and zero adaptation
  audit events.
- **Repair.** The bigbox repair consulted the model once and got a validated
  diagnosis, then no patch. Both everything-store repairs, including the robot check
  whose correct outcome is asking the person, never reached their variant. Their
  recording lane is stopped by a scenario race (site defect 1).
- **Panel.** bigbox-retail: exploration ended on P2 (a failed `web.dom.type`).
  everything-store: the only Flow lane B produced. It was proposed (10 calls, $0.053),
  approved, applied, then run with **0 provider calls**, and it **failed** at its
  second node.

Spend: **$0.7304** reported over 135 calls, plus the everything-store panel's $0.053.
Two amounts were not recorded: the bigbox panel's seven calls, and one Lab call with
no accounting. The total is about $0.80, against the $4 cap. HTTP 429s: none.

## Per-task table

Judged from each run's files: `snapshots/live-llm.json` `build.providerCalls` against
`observed.calls` (equal in every build below), `evaluation.json`, `events.ndjson`, the
evidence-loop steps, and Core's `project.sqlite`. In the Result column, "Build ended"
means Core refused the build over HTTP 400 at stage `provider_output_validation`
unless the row says otherwise. Every run in this table used
`FLUXIQ_TEST_ENV_FILES=none`, a `persistent-isolated` workspace (`lane-b-bigbox-r1`
or `lane-b-es-r1` on Rev B), and ports the runner allocated. The panels used
62781/62782 and 62783/62784.

| # | Rev | Site | Step | Task | Run | Calls | Cost $ | Wall | Result from files | Class |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | A | bigbox | 1 rec | primary | `run-mubps09q-2dea0484` | 0 | 0 | 184 s | `recording.persistence`: 29/29 steps ran; Core had not finalized 124 entries 90 s after Stop | Flaky under load (product gap 7) |
| R2 | A | bigbox | 1 rec | `pickup-towels` | `run-mubq0tah-649821b3` | 0 | 0 | 47 s | Every step ran, including the bot-check wait; the extract was refused because its selector uses `:has-text`/`:text-matches` | Site defect 2 |
| R3 | A | bigbox | 1 rec | `pickup-order` | `run-mubq3f6i-7f4048a9` | 0 | 0 | 34 s | Full guest checkout ran; extract refused (`:has-text`) | Site defect 2 |
| R4 | B | bigbox | 1 rec | primary (retry, inside the repair run) | `run-mubrehc9-b4c443f2` | - | - | - | **Passed**: 129 entries finalized about 62 s after the last step (CPU 81%); Core built the recorded Flow | - |
| R5 | B | everything-store | 1 rec | primary (`purchase`) | `run-mubqoz3k-475ad4bb` | 0 | 0 | 110 s | First step `accept-cookies` timed out: the notifications prompt's backdrop "intercepts pointer events" | Site defect 1 |
| R6 | B | everything-store | 1 rec | `add-to-cart`, `first-page-earbuds` | inside repair runs E7, E8 | 0 | 0 | - | Same first-step failure in both | Site defect 1 |
| R7 | - | everything-store | 1 rec | `plus-under-fifty` | not run | - | - | - | The manifest says no recording can pass, by design, and its first step is the same race | Not runnable |
| B1 | B | bigbox | 2 create | `pickup-towels` | `run-mubquesy-0ba9e7fc` | 1 | not recorded | 96 s | Build ended after 65 s with HTTP 400 and no diagnostic: Core's `flow_bootstrap.unclassified_failure` (`api/handlers/llm-generation.ts:138`); the Lab keeps only `lab.generation_http_400` | Product gap 5 |
| B2 | B | bigbox | 2 create | `pickup-towels-list-layout-after-creation` | `run-mubqxmlu-8bbeb23f` | 4 | 0.018 | 49 s | Build ended: `evidence_tool_failed` after 4 successful tool steps | **P2** |
| B3 | B | bigbox | 2 create | `pickup-cart` | `run-mubqzfy4-831deeb7` | 16 | 0.092 | 116 s | Build ended: `evidence_tool_failed`. Trace: repeated same-origin navigates, 2 `no_progress`, 2 `already_answered`, 1 ambiguous handle; no cart action | **P2** |
| B4 | B | bigbox | 2 create | `pickup-cart-redesigned-after-creation` | `run-mubr2u1e-7de7981d` | 8 | 0.044 | 95 s | Build ended: `evidence_tool_failed` | **P2** |
| B5 | B | bigbox | 2 create | `pickup-order`, no permit | `run-mubranzz-f291a578` | 2 | 0.008 | 43 s | Build ended: `evidence_tool_failed` after inspect and one press. `permissionRequest` null; checkout never reached | **P2**; permission unmeasured |
| B6 | B | bigbox | 2 create | `pickup-order`, `--llm-permit move_money` | `run-mubrcw7u-e1913ada` | 2 | 0.008 | 43 s | Identical to B5. The permit reached Core (the grant's preflight echo is checked) | **P2**; permission unmeasured |
| B7 | B | bigbox | 3 repair | `repair-redesigned-buy-box` | `run-mubrehc9-b4c443f2` | 1 | 0.003 | 123 s | Recorded Flow under the variant hit `web.target.ambiguous` (bare `button`, 12 matches); 2 diagnoses (1 validated), 0 patches; judged failed, "no patch was accepted"; oracle failed | Product gap 4 |
| B8 | B | bigbox | 4 panel | `demo:llm:*`, `bigbox-retail` with the `pickup-towels` instruction | `demo-llm-explore-2026-09-21T22-04-24-480Z-dfa38e` | 7 decisions | not recorded | prepare 118 s, setup 109 s, explore 96 s | Explore ended: `flow_bootstrap.evidence_tool_failed` on a failed `web.dom.type`, after navigate, click and 4 navigates; the panel showed its generic tool-failed error | **P2** |
| E1 | B | everything-store | 2 create | `plus-earbuds-under-50` | `run-mubrid4f-a1dca149` | 17 | 0.097 | 174 s | Build ended: `evidence_limit` (the evidence gathered across calls went over `maxEvidenceBytes`); 3 ambiguous handles, 1 `target_unobserved` press | Product gap 3 |
| E2 | B | everything-store | 2 create | `first-page-plus-earbuds` | `run-mubrnb6e-3f2862cb` | 13 | 0.065 | 125 s | Build ended: `evidence_unusable_decision` (`web.handle.ambiguous`, 3 in a row) | Product gap 2 |
| E3 | B | everything-store | 2 create | `first-page-plus-earbuds-deal-wheel` | `run-mubrr9b2-0519b391` | 23 | 0.127 | 228 s | Build ended: `evidence_repeat_without_progress`; 8 `no_progress` or `already_answered` navigates, 3 ambiguous handles | Product gap 2 |
| E4 | B | everything-store | 2 create | `kettle-to-cart` | `run-mubrx332-b3961c4f` | 20 | 0.116 | 174 s | Build ended: `evidence_tool_failed`; 3 `target_unobserved` presses | **P2** |
| E5 | B | everything-store | 2 create | `buy-kettle`, no permit | `run-mubs2dsu-1923e4e9` | 10 | 0.049 | 130 s | Build ended: `evidence_repeat_without_progress`; `permissionRequest` null; checkout never reached | Product gap 2; permission unmeasured |
| E6 | B | everything-store | 2 create | `buy-kettle`, `--llm-permit move_money` | `run-mubs6phq-cb54563b` | 18 | 0.103 | 127 s | Build ended: `evidence_tool_failed`; checkout never reached | **P2**; permission unmeasured |
| E7 | B | everything-store | 3 repair | `repair-redesigned-search` | `run-mubsb8j4-d7ccabf9` | 0 | 0 | 51 s | Stopped in its recording lane at `accept-cookies` (site defect 1); the model was never consulted | Site defect 1 |
| E8 | B | everything-store | 3 repair | `refuse-robot-check` (correct end: ask the person) | `run-mubsdyzt-a3d3953e` | 0 | 0 | 71 s | Same; the robot check was never shown to the model | Site defect 1 |
| E9 | B | everything-store | 4 panel | `demo:llm:*`, `everything-store` with the `first-page-plus-earbuds` instruction | explore `…22-09-26-685Z-930466`, run `…22-12-46-836Z-1acde3` | explore 10, run 0 | 0.053 | prepare 75 s, setup 94 s, explore 159 s, apply 46 s, run 43 s | Proposed, applied (navigate, click, `extract_list`, end), then run with 0 calls. **Failed**: navigate "succeeded", but its before and after screenshots are identical and Core's after-location is the start page; then the click on `a[aria-label="Brightaisle Plus"]` gave `web.target.not_found`. Driver result: `exploration_request_run.manifest_oracle_failed` | Product gap 6 |

"Replays where the lane accepts them": no Lab creation produced a Flow, so `lab
replay` had nothing to run. The one created Flow (E9) was replayed with no model by
the panel's own bound run, which is the result shown.

## Product gaps, ranked by how many tasks they hit

1. **P2: a failed tool call ends the whole build** (`flow_bootstrap.evidence_tool_failed`).
   Core `runtime/llm/evidence-loop.ts:447-455` returns `llm_evidence_loop.tool_failed`
   when a tool throws or returns an unparsable result. The model never sees the failure.
   **7 tasks, 8 runs:** B2, B3, B4, B5, B6, B8, E4, E6. B8 names the failed tool:
   `web.dom.type`. In the Lab runs, every recorded step before the failure succeeded, so
   the failing call is the one after the last step shown.
2. **Exploration stalls and ambiguous handles.** `evidence_repeat_without_progress`
   (E3, E5) and `evidence_unusable_decision` (E2, with `web.handle.ambiguous`).
   **3 tasks.** The pattern behind them also shows in runs that ended other ways:
   `core.decision_unusable` with `web.handle.ambiguous` occurs in 6 of the 12 build
   traces, and `press_control` returns `target_unobserved` in 4. The model keeps naming
   controls by handles that match several elements, or presses controls that were
   never observed, and on these stores it re-navigates instead of acting.
3. **The evidence budget ends the build** (`flow_bootstrap.evidence_limit`,
   `evidence-loop.ts:457`). The evidence gathered across all tool calls went over
   `maxEvidenceBytes` on the multi-page task (E1). **1 task.**
4. **Repair: a validated diagnosis and no patch** (B7). **1 task.** The Flow failed
   with `web.target.ambiguous`, the model was consulted, one diagnosis validated, and
   no runtime patch was attempted. This matches Current State's finding that the
   adaptive path does not go on to a patch when a grant is present. Not traced here.
5. **An unclassified generation failure** (B1). **1 task.** Core returned 400 with no
   diagnostic: `flow_bootstrap.unclassified_failure`, from the handler's catch-all at
   `api/handlers/llm-generation.ts:138`. The Lab records only
   `lab.generation_http_400`, so the cause is lost. This is also a small Lab defect:
   the error string Core does send is dropped. It may be P2 surfacing through a path
   the classifier misses; I could not confirm that.
6. **A created Flow's navigate reported success without leaving the start page**
   (E9). **1 task.** The saved node's `url` is the results page
   `/scenarios/everything-store/s?k=wireless+earbuds`; the store serves that URL
   directly (`route.ts` `searchRoute`). Yet the replay's before and after screenshots
   have the same hash (`389ba81a01c8`), and Core's after-action location is
   `/scenarios/everything-store/`. The next click then fails. Cause not traced. The
   same Flow also saved none of the exploration's cookie or notification dismissals
   and no search steps: the replay's page still showed both overlays.
7. **Recording delivery is slow and load-sensitive** (R1, then passing in R4).
   **1 task.** About 1 entry/s under 100% CPU (Rev A), about 2 entries/s at 81% (Rev B).
   On Rev A some event timestamps were stamped at delivery rather than at capture.

## Site and Lab defects

1. **everything-store: the opening race (site defect).** It stops every recording
   lane and both repair tasks (R5, R6, E7, E8). The prompt opens 4 s after each page
   load (`client/timings.ts` `notifications: 4000`), and its backdrop makes the page
   inert. `SHARED_STEPS.openStore` clicks the cookie banner's Accept *before* waiting
   for the prompt. The recording lane's Core action probe (navigate, then type)
   finishes about 4.7 s after the page load, so the prompt is already up and
   intercepts the click (R5: page load about 21:11:57.8, first click 21:12:01.9).
   3 of 3 runs failed this way. An honest person answers the prompt first; the script
   has to as well, or wait for the prompt before the cookie click.
2. **bigbox-retail: Playwright-only extract selectors** (R2, R3; the supervisor has
   this). `pickup-towels` and `pickup-order` extract with `:has-text`,
   `:text-matches` and `:text-is`, which the extension's `querySelectorAll` rejects.
3. **Lab: the consequential-task judgement.** No run reached the point, so it
   remains untested whether the created-Flow lane can score a permission request.
   The `pickup-order` catalog comment says it cannot yet.

## What changed and why

No repository file changed except this report. Evidence stays in ignored paths under
`F:\fxwork\t053-e2e-lane-b\test-runs\`:
- run bundles;
- campaign summaries under `campaigns/lane-b-*`;
- workspaces `persistent-isolated/lane-b-{bigbox,everything,bigbox-r1,es-r1}`;
- panel workspaces `panel-bigbox` and `panel-es`.

The panel identity was random and generated for this lane. It is kept only in my
scratch directory and never printed. The provider key went only to the
`demo:llm:setup` process, from `.env.local`.

## Commands run and observed results

- Recording lanes: `node scripts/lab/run-lab.mjs run <site> [--workflow w] --flow --target persistent-isolated --workspace <ws>`
  gave R1-R3 and R5 as tabled.
- Creation and repair: `node scripts/lab/live-campaign.mjs --max-attempts 2 --output test-runs/campaigns/lane-b-<name> <ids> -- --target persistent-isolated --workspace <ws> [--llm-permit move_money]`.
  The campaign totals printed were $0.153 (4 bigbox tasks), $0.0084 twice, $0.0027,
  $0.405 (4 everything-store tasks), $0.049, $0.103 and $0 (2 repairs). A summed read
  of every campaign `summary.json` printed `TOTAL cost 0.7304 calls 135`.
- Operator error, with no spend: my first chain put `--max-attempts` and `--output`
  after `--`, and the Lab refused them ("Unknown option: --max-attempts"). I stopped
  that chain and killed only lane B's process trees. The dead build-lock owner is
  reclaimed automatically (`scripts/lab/build-lock.mjs`). The chain was rerun with the
  options first.
- Panel: `pnpm demo:llm:prepare`, `demo:llm:setup`, `demo:llm:explore`,
  `demo:llm:explore:request:apply` and `demo:llm:explore:request:run`, with
  `FLUXIQ_TEST_ENV_FILES=none`, allocated `FLUXIQ_DEMO_BASE_URL`/`GATEWAY_URL`,
  `FLUXIQ_LLM_SCENARIO_ID=<site>` and `FLUXIQ_LLM_INSTRUCTION=<task instruction>`.
  Outputs are as tabled; setup's secret attestation printed `findingCount: 0` both
  times.
- The Core commit guard did not refuse any Rev B run. `FLUXIQ_LAB_ALLOW_BEHIND_CORE`
  was never used on Rev B.
- `grep` for 429, `Retry-After` or rate limits across the campaign logs found none.

## Not verified

- Permission behaviour for both consequential tasks: no build got near checkout.
- The robot-check refusal and the redesigned-search repair: the recording race
  stopped them first.
- Which tool call failed in each Lab P2 run. The Lab trace lists only the successful
  steps, and B8's `web.dom.type` is the only named failure.
- The cause of E9's no-op navigate (extension navigate compared with the tab the
  screenshots come from), and the cause of B1's unclassified failure.
- The bigbox panel's cost (the driver records none).

## Open questions or contradictions found

- E9 is the one deterministic replay in lane B. It ran with 0 provider calls and
  failed. The panel driver's oracle (`manifest_oracle`) judges final-state facts, not
  `matchedRecords`. So even a Flow that ran through would need its datasets compared
  separately to count as a success.
- Site defect 1 blocks both everything-store repairs. Once it is fixed, E7 and E8
  (and the everything-store recording lanes) are the runs to repeat first.
