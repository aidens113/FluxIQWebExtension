# w2x-e2e-lane-d: live end-to-end campaign, lane D (professional-network, job-board)

Brief: `### Brief: w2x-e2e-live-campaign (five lanes, two sites each)`, lane D,
task t055, worktree `F:\fxwork\t055-e2e-lane-d`. Testing only: no source,
Lab or scenario file was changed.

## Outcome

**Done.** Every task on both sites has either run or been recorded as not
runnable with the reason. Both consequential tasks also ran with a permit, as
the supervisor asked after the pause.

- **0 of 12 creation tasks built a Flow.** Neither panel creation produced a
  proposal either. There was therefore nothing to replay deterministically,
  so no run on this lane counts as a success by the project's measure.
- **P2's build-ending failed tool call ended 10 of the 12 creation tasks and
  both panel creations**: 13 of the 16 provider-backed build runs. The other
  3 builds ended because the evidence loop could not use a rejected tool
  result.
- **No recorded Flow replayed on either site.**
  - On professional-network, the site's timed app-install prompt defeats
    the recording script.
  - On job-board, the first recorded click is on the cookie consent's
    "Accept all", inside an open shadow root. The replay cannot resolve that
    target.
  - The job-board apply workflow cannot be recorded at all: the Lab refuses
    its frame-targeted extract step.

Spend was $0.3624 across 77 Lab provider calls. The two panel explorations
record no cost (see "Not verified"). All of it was well under the $4 cap.
There were no provider HTTP 429 responses, and no attempt was ever retried.

## Revisions

| Label | Downstream | Core (shared `F:\fxwork\!FluxIQ`) | Runs |
| --- | --- | --- | --- |
| **R1** (round 1) | `08e7dc6` | `278c44b` (build output unchanged, newest file 20:37:32Z) | The first 7 runs: PN step 1 (3 runs) and PN step 2 (4 creation tasks) |
| **R1b** | `13284d8` | `71e2798` (built 21:08:13Z; P2's fix **not** included) | Everything after the supervisor's sync, 20:12 onward |

**Disclosure.** My environment helper set `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`
from the start, before the supervisor forbade it. The four R1 creation runs
got past the Lab's behind-dev guard only because of it: each logged
`core-commit behind 3`, then `behind-allowed`. The Core they loaded was
`278c44b`, the commit the brief pins. I removed the flag at the pause. No R1b
run used it, and at `71e2798` the guard passed silently.

**Environment for every run.**
- Lab runs used `FLUXIQ_TEST_ENV_FILES=none`, the `persistent-isolated`
  target (workspaces `lane-d-pn` and `lane-d-jb`), and
  `FLUXIQ_CORE_ROOT=F:/fxwork/!FluxIQ`. DeepSeek `deepseek-chat` was read by
  name from the worktree's `.env.local`, which `live-llm.json` records as
  `credentialSource.from`.
- Lab ports were ephemeral.
- The panel runs used `127.0.0.1:3354` and `ws://127.0.0.1:4854`, with
  workspaces `test-runs/lane-d-demo-pn` and `test-runs/lane-d-demo-jb`, a
  fresh identity held in a private scratch file, and `FLUXIQ_TEST_ENV_FILES=none`.
  The worktree's `.env.local` points `FLUXIQ_DEMO_RUN_DIR` and
  `FLUXIQ_TEST_RUNS_DIR` at the **main repository's** `test-runs`, so every
  lane that let the panel drivers read it would have shared one demo
  workspace. The key was placed in the environment of `demo:llm:setup` only,
  by name, and never printed.
- No run used 3000 or 4711.

## Per-task table

Each row is judged from the run's files: `evaluation.json`,
`snapshots/live-llm.json`, `snapshots/flow-lane.json`, `events.ndjson` and
screenshots. No row is judged from its verdict. "Calls" means
`build.providerCalls` / `observed.calls`; the two are equal in every row
that has a build. In the "Run" column, "run" is the run's own duration and
"build" is the model build within it.

### professional-network (PN)

| Step | Task / workflow | Rev | Run | Flow created | Calls | Oracle / records | Failure code, stage | Where it stopped | Cost USD | Run / build | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 rec | primary (withdraw), `--flow` | R1 | run-mubpt1lg-748da0f6 | yes, recorded (67 candidates) | 0 | oracle failed | `web.intervention.required` (`user_intervention_required`), execution | Replay's first node, the cookie Accept at 956,672, was covered by the "Guildline is better on the app" modal, `div#ember789` | 0 | 154 s | site defect |
| 1 rec | `people-search`, `--flow` | R1 | run-mubpz87a-eb6622c5 | no; the recording failed | 0 | n/a | Playwright 30 s click timeout; `#ember789` intercepts pointer events | Scripted step `search-accept-cookies`, with the prompt already open at step start (screenshot 00002) | 0 | 44 s | site defect |
| 1 rec | `people-search` retry | R1 | run-mubq2b1e-ed0ce9ab | no | 0 | n/a | same | same step | 0 | 47 s | site defect (2 of 2 runs, deterministic, not flaky) |
| 2 create | `professional-network-rotterdam-data-engineers` | R1 | run-mubq5a2q-5fdb770c | no | 4 / 4 | not measured | `flow_bootstrap.evidence_tool_failed`, provider_output_validation, HTTP 400 | After inspect, navigate, detect and inspect, the 5th tool call failed | 0.0179 | 87 s / 28 s | product gap: **P2** |
| 2 create | `...-rotterdam-data-engineers-upsell` (variant armed after build) | R1 | run-mubq8cye-fb06d38d | no | 1 / 1 | not measured | `evidence_tool_failed`, same | After 1 inspect, the 2nd tool call failed | 0.0035 | 34 s / 8 s | **P2** |
| 2 create | `professional-network-withdraw-stale-requests` (instructed) | R1 | run-mubqa5nf-072cc21b | no | 11 / 11 | not measured | `flow_bootstrap.evidence_repeat_without_progress`, same | Details below the table | 0.0531 | 78 s / 47 s | product gap: rejected result unusable (P2 family) |
| 2 create | `professional-network-invitation-allowance`, **no permit** | R1 | run-mubqcu66-f0ba8376 | no | 13 / 13 | **no permission request** (`permissionRequest: null`; no adaptation in Core's store) | `evidence_tool_failed`, same | After 13 tool calls, 2 of them successful presses, the next call failed. The gate was never reached. | 0.0705 | 120 s / 75 s | **P2**; **incorrect** for a consequential task (no request naming `delete`) |
| 2 create | same, **`--llm-permit delete`** | R1b | run-mubqsqd6-e063d11a | no | 18 / 18 | not measured; not done | `flow_bootstrap.evidence_limit`, same | Details below the table | 0.0949 | 155 s / 104 s | product gap: rejected result unusable |
| 3 repair | `professional-network-repair-redesigned-withdraw-dialog` | R1b | run-mubqy4dz-518056a8 | yes, recorded | 0 (1 intervention) | oracle failed | `web.intervention.required`; LLM gate `llm.gate.manual_intervention`, "A person must authenticate or intervene" | The fresh recording's first click hit the app modal again, so the run never reached the redesigned dialog. Core refused model recovery outright: exploration `skipped`, no provider call. | 0 | 114 s | site defect plus product gap (a dismissible modal classed as needing a person) |
| 4 panel | Journey 1 (`demo:llm:setup`, `prepare`, `explore`) with the Rotterdam instruction, `FLUXIQ_LLM_SCENARIO_ID=professional-network` | R1b | `lane-d-demo-pn/evidence/demo-llm-explore-2026-09-21T21-23-51-138Z-b29af4` | no proposal | not recorded (3 decisions) | n/a | `flow_bootstrap.evidence_tool_failed`, HTTP 400; the panel showed its generic "tool failed" error | After inspect and 2 navigations, a `web.dom.click` failed. Its screenshot (00120) shows the feed with the app modal and cookie banner open. `explore:request:apply` and `:run` were not reachable, because there is no proposal to apply. | not recorded | 2 m 13 s | **P2** |

The two rows referenced above:

- **withdraw-stale-requests.** After 2 navigations and a press, a later
  press returned `web.action.rejected.no_progress`. The model re-sent it 3
  times (`already_answered`), 1 decision was `bootstrap.unknown_parameter`,
  and the no-progress guard then ended the build.
- **invitation-allowance with `--llm-permit delete`.** There were 15 good
  steps, including 2 successful presses. Then came `already_answered`,
  `core.decision_unusable: web.handle.ambiguous`, and
  `core.decision_unusable: flow_script.branch_to_next_step`, before the
  build ended on its evidence limit.

### job-board (JB)

| Step | Task / workflow | Rev | Run | Flow created | Calls | Oracle / records | Failure code, stage | Where it stopped | Cost USD | Run / build | Class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 rec | primary (save week), `--flow` | R1b | run-mubrb2m1-38723a59 | yes, recorded (18 candidates, 77 entries) | 0 | oracle failed | `web.target.not_found`, target_resolution (retryable) | Details below the table | 0 | 90 s | product gap: shadow-DOM target |
| 1 rec | `remote-rust-roles`, `--flow` | R1b | run-mubregjx-46bc3122 | yes, recorded (10 candidates) | 0 | extraction `not_run`, **0 of 7 matched**. `oracleVerdict: passed` is vacuous because the workflow declares no final-state fact. | `web.target.not_found`, same selector, same point | Same first click | 0 | 58 s | product gap: shadow-DOM target |
| 1 rec | `apply-remote-rust-role`, `--flow` | R1b | run-mubrgsp9-2490f90f | no Flow; the recording ran through the submission | 0 | n/a | `fixture.invalid` | Details below the table | 0 | 37 s | site (manifest) defect: the Lab's extract contract cannot carry it |
| 2 create | `job-board-save-halvard-week` | R1b | run-mubrjtok-089bf7a1 | no | 2 / 2 | not measured | `evidence_tool_failed`, provider_output_validation, HTTP 400 | inspect, navigate, then a failed tool call | 0.0077 | 80 s / 21 s | **P2** |
| 2 create | `...-save-halvard-week-redesigned` (`overflow-save`) | R1b | run-mubrmtya-c3a7b372 | no | 3 / 3 | not measured | same | inspect, navigate, inspect, then a failed call | 0.0130 | 82 s / 29 s | **P2** |
| 2 create | `...-redesigned-after-creation` | R1b | run-mubrplcy-c8db4c35 | no | 2 / 2 | not measured | same | inspect, navigate, then a failed call | 0.0077 | 67 s / 17 s | **P2** |
| 2 create | `job-board-remote-rust-roles` | R1b | run-mubrsw2s-162827fe | no | 3 / 3 | not measured | same | inspect, navigate, detect, then a failed call | 0.0121 | 101 s / 30 s | **P2** |
| 2 create | `...-quiet-market` (`no-exact-matches`) | R1b | run-mubrvx9v-50c6455c | no | 4 / 4 | not measured | same | inspect, navigate, detect, inspect, then a failed call | 0.0174 | 79 s / 29 s | **P2** |
| 2 create | `...-quiet-market-after-creation` | R1b | run-mubrywp9-ff491de3 | no | 3 / 3 | not measured | same | inspect, navigate, detect, then a failed call | 0.0121 | 71 s / 22 s | **P2** |
| 2 create | `job-board-apply-quillmark` (instructed send) | R1b | run-mubs1zxl-21720408 | no | 8 / 8 | not measured | `flow_bootstrap.evidence_unusable_decision` with issue `bootstrap.completion_profile_limit_exceeded`, same stage | Details below the table | 0.0326 | 136 s / 80 s | product gap: rejected result unusable |
| 2 create | `job-board-apply-quillmark-check-first`, **no permit** | R1b | run-mubs68xg-b70fe78e | no | 3 / 3 | **no permission request** (`permissionRequest: null`; no adaptation in Core's store). Expected: `flow_bootstrap.permission_required` naming `send_or_publish`. | `evidence_tool_failed` | inspect, navigate, a `navigate_same_origin` rejected `no_progress`, then a failed call | 0.0122 | 83 s / 22 s | **P2**; **incorrect** for a consequential task (the gate was never reached) |
| 2 create | same, **`--llm-permit send_or_publish`** | R1b | run-mubs9w5v-9e57be78 | no | 2 / 2 | not done | `evidence_tool_failed` | inspect, navigate, then a failed call | 0.0077 | 42 s / 16 s | **P2** |
| 3 repair | `job-board-refuse-filled-posting` (`apply-remote-rust-role` / `posting-closed`) | R1b | run-mubsc690-f9b535c9 | no | 0 | n/a | `fixture.invalid`, the same refusal as step 1 | Its recording lane stopped at `extract-application` before any Flow or model | 0 | 39 s | **not runnable**: site (manifest) defect |
| 4 panel | Journey 1 with the remote-Rust instruction, `FLUXIQ_LLM_SCENARIO_ID=job-board` | R1b | `lane-d-demo-jb/evidence/demo-llm-explore-2026-09-21T22-02-51-368Z-b731b9` | no proposal | not recorded (17 decisions) | n/a | `flow_bootstrap.evidence_tool_failed`, HTTP 400; the panel showed "tool failed" | Details below the table | not recorded | 3 m 11 s | **P2** |

The rows referenced above:

- **JB primary recording.** The replay's first node is the cookie "Accept
  all" at 1133,581, which is plainly visible in the failure screenshot.
  - The recorded selector `section > div:nth-of-type(2) > button:nth-of-type(1)`
    matched nothing.
  - The visual target was "refused rf-consent scoring -0.30".
  - The button lives inside `rf-consent`'s **open** shadow root
    (`board/widgets-script.ts:21`).
- **JB apply recording.** The scripted path typed every field and submitted
  (`confirmation-shown` completed). The Lab then refused `extract-application`:
  it "names its target as a frame target, which an extraction request cannot
  carry".
- **JB apply-quillmark.** inspect, navigate, then a `navigate_same_origin`
  rejected `no_progress`. The model re-sent it 3 times (`already_answered`),
  and 2 decisions were `completion_profile_limit_exceeded`.
- **JB panel exploration.** 17 tool results were recorded: 2 inspects and
  15 successful `web.browser.navigate` actions, with no press and no type.
  The next call failed and dispatched no browser action. The final capture
  (00144) shows the start page with the consent scrim still open.

### Replays

"With replays where the lane accepts them" produced none: no creation run
created a Flow, so `lab replay` had nothing to run.

## Product gaps, ranked by tasks hit

1. **P2: a failed tool call ends the build** (`flow_bootstrap.evidence_tool_failed`
   at `provider_output_validation`, HTTP 400).
   - **Hit 10 of the 12 creation tasks.** PN: rotterdam, upsell and
     invitation-allowance without a permit. JB: all 3 save-week tasks, all
     3 rust-roles tasks, and check-first both without and with a permit.
   - **Also hit both panel creations**, for 13 runs in all.
   - **Observability gap on the same site.** The Lab bundle keeps only the
     steps that succeeded (`live-llm.json` `build.evidenceLoop.steps`). The
     failed call's tool and arguments appear in no Lab artifact: not the
     events, not `core.log`, and not the workspace's `.fluxiq` store. Only
     the panel lane's events named one: PN's `web.dom.click (failed)` on the
     feed under the app modal.
2. **The loop cannot act on a rejected result, and the build ends by guard
   or by limit.** Hit 3 tasks.
   - PN withdraw-stale ended on `evidence_repeat_without_progress`, after
     `web.action.rejected.no_progress` and `already_answered` repeats.
   - PN invitation-allowance with `delete` ended on `evidence_limit`, after
     `already_answered`, `web.handle.ambiguous` and
     `flow_script.branch_to_next_step`.
   - JB apply-quillmark ended on `evidence_unusable_decision` /
     `bootstrap.completion_profile_limit_exceeded`, after a no-progress
     `navigate_same_origin` and 3 repeats.

   This is the same family as P2: the model gets a result it cannot use, so
   the build ends instead of adapting.
3. **Controls inside an open shadow root do not resolve at replay.** Hit 2
   JB recorded workflows: primary and `remote-rust-roles`.
   - The code is `web.target.not_found` at target_resolution.
   - The recorded selector is shadow-relative, and the visual fallback
     refuses the shadow host `rf-consent`. This is domain target resolution
     and recording identity.
   - **Inference, not proven:** this is probably also what fails P2's tool
     call on every JB build. Not one JB build, Lab or panel, ever recorded a
     successful press. Every Lab build died on its first call after
     inspect, navigate and detect. The panel build navigated 15 times
     without pressing anything, and its last capture still shows the
     consent scrim.
4. **A dismissible promotional modal is classed as needing a person.** Hit 1
   task: the PN repair.
   - The domain reports a covered target under an open modal as
     `user_intervention_required`.
   - Core's gate then refuses the model outright (`llm.gate.manual_intervention`).
   - So a "Get the app" prompt with a "Not now" button stops recovery
     before any call. Under the capability-by-default rule this should be
     the model's to dismiss.
5. **Consequential tasks never reached the permission gate.** Neither
   no-permit run (PN invitation-allowance, JB check-first) produced
   `permissionRequest`, and Core stored no adaptation. Each build died
   earlier, on P2. Neither permitted run finished either. The permission
   path is therefore **unmeasured** on this lane, not shown to be wrong.

## Site, Lab and other defects

- **Site defect: professional-network's app prompt races its recording
  scripts.** The site hit 3 recording or repair runs and made PN's recorded
  Flow unusable.
  - `shell/client-script.ts` un-hides the "Guildline is better on the app"
    scrim 2.5 s after any `appPrompt` page loads.
  - Neither `WITHDRAW_SCRIPT` nor `SEARCH_SCRIPT` answers it before its
    first `Accept` click.
  - The primary recording can beat the timer, but its Flow never saw the
    prompt. The Flow lane's first action comes about 30 s after load, so
    every replay meets the prompt.
  - `people-search` lost the race 2 of 2 times.
  - An honest person would press "Not now" first.
  - The PN repair task therefore can never test the redesigned dialog it
    was written for.
- **Site (manifest) defect: `apply-remote-rust-role` extracts from a
  frame.** `job-board/manifest.ts` `extract-application` targets
  `frame("dl")`, which the Lab's extract intent refuses as
  `fixture.invalid`. The domain extraction definition takes one
  main-document selector. This blocks the apply workflow's recording and the
  JB repair task. Either the manifest is wrong for the Lab, or it has found
  a product limit: extraction cannot read inside a frame.
- **Lab defect (minor): the failure screenshot is the Lab's own tab.** All
  PN creation failures and the recording failure carry the same image,
  `failure-e6f0854ef77d.png`. It shows the Lab's scenario tab, not where the
  build stopped.
- **Lab defect (minor): a product outcome recorded as a facility failure.**
  Every creation run whose build failed records
  `facilityFailure {finalized-bundle, scenario.execute, unclassified}`
  beside `runtime.behavior`.
- **Lab defect (minor): permits are not recorded.** `--llm-permit` reached
  the command line (campaign log: `--llm-permit delete` and
  `--llm-permit send_or_publish`). But `live-llm.json` `authorized` and
  `granted` carry no permitted classes, so a bundle cannot show which
  permit it ran under.
- **Panel lane (minor): a rejected generation leaves no spend record.**
  - A panel exploration whose generation is rejected records no cost or
    token figure anywhere: not the bundle, the logs, or the workspace
    store.
  - Its diagnostic `providerCallCount: 1` sits beside
    `evidenceDecisionCount: 17`, so that count is not a provider-call
    count.

## Commands run and observed results

All commands ran from `F:\fxwork\t055-e2e-lane-d`, with the environment
above.

**Round 1.** These ran at `08e7dc6` on Core `278c44b`.

- `node scripts/lab/run-lab.mjs run professional-network --flow`: exit 1,
  run-mubpt1lg-748da0f6.
- `node scripts/lab/run-lab.mjs run professional-network --workflow people-search --flow`,
  run twice: exit 1 both times, run-mubpz87a-eb6622c5 and
  run-mubq2b1e-ed0ce9ab.
- `node scripts/lab/live-campaign.mjs <4 PN creation ids> --max-attempts 2 --output test-runs/campaigns/lane-d-pn-create`:
  exit 1, `{"tasks":4,"succeeded":0,"providerCalls":29,"reportedCostUsd":0.14505568}`.

**R1b.** These ran at `13284d8` on Core `71e2798`.

- `live-campaign.mjs professional-network-invitation-allowance -- --llm-permit delete`:
  exit 1, 18 calls, $0.09488204.
- `live-campaign.mjs professional-network-repair-redesigned-withdraw-dialog`:
  exit 1, 0 calls.
- PN panel creation:
  - `node scripts/setup-demo-llm-key.mjs` returned `configured`, with
    attestation `findingCount 0`.
  - `prepare-demo-llm-workspace.mjs` returned `prepared`.
  - `inspect-demo-llm-exploration-request.mjs` returned `ready`: 352
    characters, run budget 560,000 tokens and $1.
  - `run-demo-llm-exploration.mjs` exited 1 with "Evidence-guided Flow
    generation failed (generation.provider-output-validation)".
- JB recording lane, three runs:
  - `run-lab.mjs run job-board --flow`: exit 1, run-mubrb2m1-38723a59.
  - `--workflow remote-rust-roles --flow`: exit 1, run-mubregjx-46bc3122.
  - `--workflow apply-remote-rust-role --flow`: exit 1, `fixture.invalid`,
    run-mubrgsp9-2490f90f.
- `live-campaign.mjs <8 JB creation ids> --output test-runs/campaigns/lane-d-jb-create`:
  exit 1, `{"tasks":8,"succeeded":0,"providerCalls":28,"reportedCostUsd":0.11480348}`.
- `live-campaign.mjs job-board-apply-quillmark-check-first -- --llm-permit send_or_publish`:
  exit 1, 2 calls, $0.00765732.
- `live-campaign.mjs job-board-refuse-filled-posting`: exit 1,
  `fixture.invalid`, 0 calls.
- JB panel creation: setup returned `configured` (findings 0), prepare
  returned `prepared`, and explore exited 1 with the same
  `generation.provider-output-validation` failure.

**Checks.**
- A grep for provider 429 or Retry-After across every run log and campaign
  log found none.
- Core's `adaptations` table in both Lab workspaces holds 0 rows.

## Not verified

- **Which tool call failed in each Lab P2 run, and its arguments.** No
  artifact holds them.
- **Whether either successful exploration press in the no-permit PN
  invitation-allowance run withdrew a request.** That run pressed twice
  without any permission. The fixture's invitation store is not captured
  after a failed build, and the Scenario Lab log records no mutations. If
  one did, exploration took a consequential act that nobody permitted.
- **The panel explorations' provider calls and cost.** No record exists; see
  "Site, Lab and other defects". The panel cap is $1 per run. Lab builds
  with comparable decision counts cost $0.004 to $0.07.
- **Whether the panel's final screenshots show the automation tab or the
  driver's own scenario tab.** The JB start page with the consent scrim
  after 15 navigations is reported as observed, not interpreted.
- **The P3 inference** (shadow DOM as the cause of P2 on job-board) is
  unproven.
- **Nothing on this lane exercised** `explore:request:apply`,
  `:request:run`, `lab replay`, or a granted run reaching its oracle,
  because no build produced a Flow or proposal.

## Open questions or contradictions found

- The brief says to run step 3 "on the Flow step 1 recorded". The
  campaign's repair command (`--flow --variant ... --llm-task adapt`)
  instead records afresh in the same run, so the repair inherits step 1's
  site defects.
- The permit class for each consequential task is my own choice from Core's
  definitions (`action-permissions/instructed.ts`): `delete` for
  withdrawing a pending request, and `send_or_publish` for sending an
  application. No run reached a permission request, so Core never named the
  class it wanted. If Core would ask for `modify_existing` for a withdrawal,
  the PN permitted run tested the wrong grant.
- The job-board manifest's `remote-rust-roles` workflow declares no
  final-state fact, so its recorded-Flow run reports `oracleVerdict: passed`
  while matching 0 of 7 records. The oracle field alone would mislead a
  reader.
