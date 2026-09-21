# w2x-e2e-live-campaign — lane A (`social-network-feed`, `photo-social`)

Worker report, 2026-09-21. Brief: `### Brief: w2x-e2e-live-campaign`. Worktree
`F:\fxwork\t052-e2e-lane-a` (t052). Lab instance `t052-lane-a`, target `persistent-isolated`
with workspaces `t052-snf` and `t052-ps`, `FLUXIQ_TEST_ENV_FILES=none` on every run, and
DeepSeek `deepseek-chat` with its key read from the worktree's `.env.local` by name only.
Testing only: no source, Lab or scenario file was changed.

**Two revision pairs, labelled on every row:**
- **r1**: downstream `08e7dc6` + Core `278c44b`. These runs came before the supervisor's
  shared-Core pause. They are kept and were not rerun.
- **r2**: downstream `13284d8` + Core `71e2798`. This pair adds t035, t036 (`--llm-permit`)
  and t048. **P2's fix is in neither pair.**

## Outcome

**Done.** Every task on both sites was run, with two exceptions. No `lab replay` could run,
because no creation or UI build produced a Flow. The r1 queued `feed-digest-quiet-feed`
attempt was killed before it loaded Core; that task was then run in r2.

**Not one task produced a Flow from an instruction.** 0 of 14 creation runs and 0 of 2 UI
creations did, so by the project's measure (the deterministic Flow) the lane scored **0**.
0 of 2 repairs passed. 3 of 7 recording-lane Flows replayed and passed their oracle, all
on `social-network-feed`.

`build.providerCalls == observed.calls` held on every build whose count was recorded. The
exceptions are C4 and C5, where the build count is `null` beside 1 observed call. No build
reached playback, so no result depends on model work during a Flow run.

## Per-task table

Calls are `build.providerCalls / observed.calls`. The cost is the provider's reported
figure. "Where it stopped" comes from the evidence-loop trace, not from the Lab's failure
screenshot (see L2).

### `social-network-feed`

| # | Rev | Task | Run | Flow? | Calls | Oracle / records | Failure code (stage) | Where it stopped | Cost | Wall clock | Class |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R1 | r1 | recording lane, primary | run-mubpro3z-592a7ec1 | yes | 0 | passed | none | end; 11 actions succeeded | $0 | 156.8 s | pass |
| R2 | r1 | recording lane, `feed-digest` | run-mubpx7an-e8ac297c | no | 0 | not reached | extension refused its own extract `run_failed` ("List extracted.") | `extract-feed-digest`, after 14 scrolls and 4 "See more" | $0 | 61.8 s | **Lab defect L1** |
| R3 | r1 | recording lane, `confirm-requests` | run-mubq047k-a64aaf78 | yes | 0 | passed, **4/4** matched | none | end; 31 actions | $0 | 151.5 s | pass |
| R4 | r1 | recording lane, `move-open-day` | run-mubq4ndr-bf969433 | yes | 0 | passed, **1/1** matched | none | end; 24 actions | $0 | 117.6 s | pass |
| C1 | r1 | `group-post` | run-mubq9zmu-dc57d4bc | no | 3/3 | not reached | `flow_bootstrap.evidence_tool_failed` (`provider_output_validation`, 400) | inspect → press → navigate all succeeded; the 3rd decision's tool threw | $0.0136 | 48.8 s | **P2** |
| C2 | r1 | `group-post-regrouped` | run-mubqc3wb-415b3dd8 | no | 3/3 | not reached | same as C1 | same | $0.0136 | 44.1 s | **P2** |
| C3 | r1 | `group-post-regrouped-after-creation` | run-mubqe8yk-ab2b4089 | no | 3/3 | not reached | same as C1 | same | $0.0136 | 42.9 s | **P2** |
| C4 | r1 | `feed-digest` | run-mubqfy2c-9967f366 | no | null/1 | not reached | `lab.generation_http_400`, a body Core's own diagnostic parser rejects | no evidence-loop record; build 86.0 s | not recorded | 103.7 s | product gap G3 |
| C5 | r2 | `feed-digest-quiet-feed` | run-mubr0kaw-aa5bc3fb | no | null/1 | not reached | `lab.generation_http_400`, same | no record; build 76.6 s | not recorded | 113.7 s | product gap G3 |
| C6 | r2 | `feed-digest-app-install` (built on baseline) | run-mubr4d2i-5785927b | no | 15/15 | not reached | `flow_bootstrap.evidence_repeat_without_progress` | `detect_repeating_structure` repeated → `already_answered` ×3 → rejected | $0.0778 | 119.4 s | product gap G2 |
| C7 | r2 | `confirm-requests` | run-mubr8mrl-3854b6ba | no | 9/9 | not reached | `evidence_repeat_without_progress` | `detect_repeating_structure` `rejected.target_unobserved` ×2 → `already_answered` ×2 → rejected | $0.0419 | 109.9 s | product gap G2 |
| C8a | r2 | `move-open-day`, **no permit** | run-mubrbt6m-cc627c3c | no | 3/3 | not reached | `evidence_tool_failed` | inspect → press → navigate, then the 3rd tool threw; Core's `permissionRequest: null` | $0.0134 | 57.3 s | **P2**; the permission outcome was **not reached** |
| C8b | r2 | `move-open-day`, `--llm-permit delete` | run-mubrehzh-63d1ed4e | no | 3/3 | not reached | `evidence_tool_failed` | inspect → press → inspect, then threw | $0.0135 | 37.4 s | **P2** |
| RP1 | r2 | `repair-regrouped-composer` | run-mubrgdzx-1f636ff6 | recorded Flow | 0 | failed | `web.target.not_found` (expected); judgement "no diagnosis validated" | Core recovery ended `diagnosis_only`; the model was never called | $0 | 101.5 s | product gap G4 |
| UI1 | r2 | panel creation, `FLUXIQ_LLM_SCENARIO_ID=social-network-feed` + feed-digest instruction | bundle `ui/snf/evidence/demo-llm-explore-2026-09-21T21-37-29-128Z-f6f386` | no | 13 decisions (panel says `providerCallCount: 1`) | not reached | `flow_bootstrap.evidence_tool_failed` | 13 tool calls succeeded (6 with effects), then threw; apply and run not attempted | not recorded | prepare 112 s, key 79 s, explore 165 s | **P2** |

### `photo-social` (all r2)

| # | Task | Run | Flow? | Calls | Oracle / records | Failure code (stage) | Where it stopped | Cost | Wall clock | Class |
|---|---|---|---|---|---|---|---|---|---|---|
| R5 | recording lane, primary | run-mubrskqv-c7f503a2 | yes | 0 | failed | `web.action.timeout` (execution), node 6 of 31 | `wait_for_selector "section > header > div"` right after `web.browser.navigate` | $0 | 163.5 s | product gap G5 |
| R6 | recording lane, `giveaway-entries` | run-mubrx2ix-4800c072 | yes | 0 | extract `not_run` 0/13 | same, node 6 of 20 | same | $0 | 130.2 s | product gap G5 |
| R7 | recording lane, `ask-price` | run-mubs1hra-120d145d | yes | 0 | extract `not_run` 0/1 | `web.validation.output_not_observed`, node 10: "0 records from 1 page" | `extract_list` ran straight after Send; no wait for the shop's reply | $0 | 125.4 s | product gap G6 |
| C9 | `glaze-collection` | run-mubs677g-d8c22023 | no | 15/15 | not reached | `evidence_tool_failed` | 15 tool calls succeeded, then the 16th threw | $0.0851 | 148.5 s | **P2** |
| C10 | `giveaway-entries` | run-mubsazbp-4e68a457 | no | 9/9 | not reached | `evidence_repeat_without_progress` | `navigate_same_origin` `rejected.no_progress` → repeated → `already_answered` ×2 → rejected | $0.0441 | 103.3 s | product gap G2 |
| C11 | `giveaway-entries-verified-upsell` | run-mubsfvld-0b991ed5 | no | 10/10 | not reached | `evidence_repeat_without_progress` | same pattern | $0.0494 | 138.0 s | product gap G2 |
| C12a | `moon-jar-price`, **no permit** | run-mubskw7q-a8b0cb8d | no | 13/13 | not reached | `evidence_tool_failed` | 13 tool calls succeeded (4 presses), then threw; Core's `permissionRequest: null` | $0.0744 | 110.6 s | **P2**; the permission outcome was **not reached** |
| C12b | `moon-jar-price`, `--llm-permit send_or_publish` | run-mubsonmr-1f631466 | no | 16/16 | not reached | `evidence_tool_failed` | 16 decisions; one `core.decision_unusable: llm.provider_timeout` was absorbed, then threw | $0.0869 | 154.9 s | **P2** (plus 1 provider timeout, recovered) |
| RP2 | `repair-consent-redesign` | run-mubstw7f-79ef580a | recorded Flow | 1 (repair) | failed | `web.target.not_found` (expected); judgement "no patch was accepted" | a runtime diagnosis validated (stage `gather`, confidence 0.55, 4,520 tokens), then no runtime patch was requested | $0.0024 | 153.9 s | product gap G4 |
| UI2 | panel creation, `FLUXIQ_LLM_SCENARIO_ID=photo-social` + giveaway instruction | bundle `ui/ps/evidence/demo-llm-explore-2026-09-21T22-15-42-615Z-b47c6f` | no | 13 decisions (panel says `providerCallCount: 1`) | not reached | `evidence_tool_failed`; the panel showed a generic visible error | 13 tool calls succeeded (12 with effects), then threw | not recorded | prepare 64 s, key 63 s, explore 121 s | **P2** |

**Replays: none runnable.** `lab replay` needs a created Flow, and no creation or UI run
made one. The Flow lane of R1, R3 and R4 is itself a provider-free run of the saved
recorded Flow: 0 calls, oracle passed.

**Permission cases.** Core's run detail answered `permissionRequest: null` in C8a and
C12a, because both builds ended on P2 before a gated control was reached. Whether C12a
sent a message without permission cannot be read from any file: the oracle does not run
after a failed build, and the Lab's screenshot shows another tab (L2). With a permit, both
C8b and C12b also ended on P2. **Neither correct outcome (a permission request naming the
class, or done with the oracle passing) was observed.** Both are blocked by P2, not
refuted.

## Product gaps, ranked by the tasks they hit

1. **G1 = P2, a failed tool call ends the build**
   (`llm_evidence_loop.tool_failed` → `flow_bootstrap.evidence_tool_failed`). **10 runs,
   8 task entries:** C1, C2, C3, C8a, C8b, C9, C12a, C12b, UI1, UI2. It hits every kind of
   job on both sites and both surfaces. A decision's tool call throws inside `executeTool`
   and the loop returns failure (`F:\fxwork\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\llm\evidence-loop.ts:447-450`).
   It struck after 3 to 16 decisions, whose tool calls had all succeeded. **The failed call
   is never in the recorded trace**, so neither the tool nor its reason is observable. That
   observability gap should be closed with P2.
2. **G2, the model repeats a rejected or answered call until the no-progress guard ends
   the build** (`flow_bootstrap.evidence_repeat_without_progress`). **4 tasks:** C6, C7,
   C10, C11. The triggers were `web.action.rejected.target_unobserved` (C7),
   `web.action.rejected.no_progress` (C10, C11) and `llm_evidence_loop.already_answered`
   (C6). The rejection feedback does not redirect the model. This sits beside P2 but has a
   different code, so P2's fix alone may not clear it.
3. **G4, repair cannot recover a recorded Flow.** **2 tasks:** RP1, RP2.
   - RP1: Core's recovery ended `diagnosis_only` and the model was never called. Core
     then synthesizes the fixed issue "LLM diagnosis provider is not configured in this
     runtime slice." (`…/runtime/service/summaries/conversions.ts:222-240`), which misstates
     the cause.
   - RP2: a real diagnosis validated, but no runtime patch was ever requested.
   - Both match the known gap in Current State (the adaptive retry is skipped under a
     grant; a target override is refused at preflight). L4 (t050) owns that fix.
4. **G3, generation returns HTTP 400 with no parseable diagnostic** (`lab.generation_http_400`,
   `packages/test-runner/src/flow-lane/creation/build-proposal.ts:185-188`). **2 tasks:**
   C4 and C5, which are both runs of the feed-digest instruction on the unarmed build page.
   Each build ran 76-86 s and recorded 1 call. Spend and the provider-call count are
   unrecorded.
5. **G5, a shadow-DOM control is recorded with a document-relative selector.** **2 runs:**
   R5, R6. Photo-social's messages dock is `fl-dock` with an open shadow root
   (`apps/scenario-lab/src/scenarios/photo-social/client/overlay-script.ts:31,68`). The
   press on its `[part="collapse-button"]` was recorded as `section > header > div`, which
   only resolves inside the shadow root, so the replayed wait times out. This is the
   extension recorder's selector generation.
6. **G6, a recorded Flow reads before asynchronous content arrives.** **1 run:** R7. The
   script's `reply-arrived` wait (up to 8 s) became no Flow node, so `extract_list` ran
   straight after Send. `extract_list` also does not wait for `minItems` before failing.
7. **G7, UI reporting.** **2 runs:** UI1, UI2. The panel's generation diagnostic reports
   `providerCallCount: 1` next to 13 decisions, and a tool failure is shown to the person
   only as a generic error.

## Lab defects

- **L1: every Lab `extract` field is sent as required.** `packages/test-runner/src/scenario-steps/extract-intent.ts:88-92,164-173`
  sends structured field specs with no `required` and says this is "the domain's optional
  reading". The extension reads a structured spec as required unless it says `false`
  (`apps/extension/src/content/extraction/field-spec.ts:14,80`). The feed's `group`,
  `reactions` and `comments` are legitimately empty on some posts, and the manifest's
  expectation spells them `null` with `optionalFields`
  (`apps/scenario-lab/src/scenarios/social-network-feed/manifest.ts:240-249`). The read
  therefore fails validation (`apps/extension/src/content/actions/extract-list.ts:87-95`)
  and R2 cannot record the site's honest path. The site is not at fault.
- **L2: the Lab's failure screenshot shows its own scenario tab, not the automation's.**
  R5 and C12a have byte-identical failure screenshots (hash `194487b219dc`, the home feed
  at start). The screenshot cannot show where a creation run stopped.
- **L3: the live-llm snapshot does not record the permit.** `granted` omits
  `permittedConsequences`. The permit is proven only because
  `live-llm/execution-grant.ts:132` refuses a grant that differs from what was asked.

No site defects and no flaky results were found: the three group-post runs failed
identically, and so did both feed-digest 400s. There were **0 HTTP 429s**. Provider noise
was one `llm.provider_timeout` inside C12b, which the loop absorbed.

## Spend and time

**$0.5296 reported** ($0.0407 in r1, $0.4888 in r2), plus spend that was not recorded for
C4, C5 (1 call each), UI1 and UI2 (13 decisions each). By comparison with C9 (15 decisions,
$0.085), the unrecorded total is under $0.25, well inside the $4 cap. The lane ran from
20:44Z to 22:17Z, about 93 minutes including the pause.

## What changed and why

Only this report changed. The scratch judge script, logs and the UI credentials file live in
my session scratchpad, outside every repository. Run evidence is in the worktree's ignored
`test-runs/instances/t052-lane-a/`.

## Commands run and observed results

- Recording lane: `node scripts/lab/run-lab.mjs run <site> [--workflow <w>] --flow`, with
  `FLUXIQ_TEST_TARGET=persistent-isolated`, `FLUXIQ_LAB_INSTANCE=t052-lane-a`,
  `FLUXIQ_TEST_ENV_FILES=none`. Results are in rows R1-R7.
- Creation: `node scripts/lab/live-campaign.mjs <task ids> --max-attempts 2 --output
  test-runs/instances/t052-lane-a/campaign-*`, plus `-- --llm-permit delete` or
  `-- --llm-permit send_or_publish` for the permitted twins. Campaign totals:
  - `campaign-snf-r2a`: 4 failed, 28 calls, $0.1331.
  - `campaign-ps`: 4 failed, 47 calls, $0.2530.
  - The two permit campaigns: 1 failed each, 3 calls ($0.0135) and 16 calls ($0.0869).
- Repair: `node scripts/lab/live-campaign.mjs <repair id>`. Both judgements failed (RP1,
  RP2).
- UI: `prepare-demo-llm-workspace.mjs` → `setup-demo-llm-key.mjs` →
  `run-demo-llm-exploration.mjs`, with ports allocated per run (58608/58609 and
  49393/49394) and `FLUXIQ_DEMO_EXTENSION_DIR` pinned. Explore exited 1 both times, so
  apply and run were not attempted.
- One r1 campaign (`campaign-snf`) was refused in full by the Lab's Core-commit guard: 8
  tasks, no runs, $0. The four r1 creation runs C1-C4 then ran with
  `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` before the supervisor's instruction arrived. It was not
  used after that instruction.
- Every other judgement above was read from `evaluation.json`, `snapshots/live-llm.json`,
  `snapshots/flow-lane.json`, the UI evidence bundles, and read-only SQLite queries of each
  workspace's Core store (`runtime_runs.summary_json` and event chunks).

## Not verified

- Which tool, and why, threw in every P2 run: the trace omits it.
- Whether the unpermitted moon-jar build (C12a) sent a message.
- The cause of the empty-diagnostic 400 (C4, C5).
- That G5 is the recorder rather than content-script target resolution. I confirmed the
  recorded selector and the shadow root, but did not trace the recorder code.
- The spend of C4, C5, UI1 and UI2.
- Firefox, which was not exercised.

## Open questions or contradictions found

- The UI's `providerCallCount: 1` contradicts its own `evidenceDecisionCount: 13` (G7).
- Core's "provider is not configured" issue is a placeholder that misstates why the
  diagnosis never ran (G4).
- Round-2 permission judgement is impossible until P2 lands. The move-open-day and
  moon-jar pairs should be the first re-runs after P2's fix.
