# Lane C first candidate-mode probe (`everything-store-plus-earbuds-under-50`)

Lead: lane C live lead (`lead-xhigh`), tree `C:/Users/osrs_/FluxStuff/fxwork/t274` (both repos, branch
`task/t274-live-lane-c`), Lab slot 1, instance `t274-slot-1`, workspace `t274-c`. Brief: `### Brief: lanes B, C and D
first candidate-mode probes` in the supervisor's `docs/working/mvp-final-month-plan.md`. Nothing committed; no product
source edited; no override file created.

## Verdict

**Failed before any test run: $0.033 for 21 calls; no Flow; no further paid run.** Run `run-mv0fuotv-805294d7`, launched
04:00:13 UTC, admitted by the guard at 04:01:16, ended 04:08:33. Full debug:
`docs/working/language-driven-flow-loop-plan/debugs/run-mv0fuotv-805294d7.md`.

In plain English:

- The build explored well. It searched, read page 1 (20 rows, including the ones that load only on scroll), moved to
  page 2, read it, and moved on to page 3 past the store's broken Next link. The product's paging held.
- It then wrote the whole Flow as a script. The loop was right ("read this page, then Next page, repeat while Next
  page moves on"), but it added a safety cap, `repeat most: 10`, on the Next page step. The cap belongs on the read
  step beside `repeat while`, and it was not needed at all.
- Core refused the script, calling it "a repeat inside a repeat" without naming the cap line. The model took that to
  mean its `repeat while` was misplaced; it was not. It sent the same script back unchanged.
- The repeat guard refused the identical resend three times in a row, each time with legacy-mode advice and without
  the original reason. The third refusal ended the build, with $0.067 and 27 calls unused.
- Nothing was tested, judged, promoted or applied. The Lab's oracle was never measured, and there was no Flow to
  replay.
- Had the script been accepted, it would still have failed the oracle. Its filter for leaving out accessories
  dropped every listing whose title contains "charging case". That removes the charging-case accessory, but also 3 of
  the 13 genuine pairs, whose titles end "with Wireless Charging Case" (checked against the built fixture).

## Preflight (zero calls), 2026-10-09

- 03:05 UTC tree state: downstream `1d04a11a` (dev `128d907e` is one documentation-only commit ahead, which the
  `behind-dev` rule allows), Core `52d7ac3a` (= Core `dev`), both clean, branch `task/t274-live-lane-c`.
- Slot 1 `owner`: `{"task":"t274","lane":"C","instance":"t274-slot-1"}`. Previous live run of the instance,
  `run-muxky0df-c9839389` (2026-10-07 04:00, failed), has its debug in this tree, so the `debug` rule is satisfied.
- Rebuild: Core `pnpm.cmd build` exit 0 in 336 s (`contracts` and `client-gateway-websocket` restored, `fluxiq:build`
  and `web:build` rebuilt); downstream `pnpm.cmd build` exit 0 in 129 s (domain, extension and test-runner rebuilt;
  extension chrome, firefox and e2e-chromium each "verified 22 files"). The stale-worker fix R4-1
  (`guarded-browser/forget-cached-service-workers.ts`) is in this tree.
- Campaign dry run (env `FLUXIQ_LAB_INSTANCE=t274-slot-1`, `FLUXIQ_TEST_ENV_FILES=none`,
  `FLUXIQ_TEST_TARGET=persistent-isolated`, `FLUXIQ_TEST_PERSISTENT_WORKSPACE=t274-c`):
  `pnpm.cmd lab:campaign everything-store-plus-earbuds-under-50 --dry-run --max-attempts 1 --authoring-mode candidate`
  exit 0, one command: `pnpm lab run everything-store --live-llm --llm-profile lab-create-flow --llm-provider deepseek
  --llm-model deepseek-flash --authoring-mode candidate --llm-task create-flow --instruction-task
  everything-store-plus-earbuds-under-50 --llm-max-input-tokens 992000 --llm-max-output-tokens 8000
  --llm-max-total-tokens 1000000 --llm-max-calls 48`.
- Lab `--dry-run` of that command: exit 0, `status: ready`, `providerCallCount: 0`, `lane: created-flow`,
  `buildEntry: chat`, `target: persistent-isolated`, `coreDefaultModel: deepseek-flash`, `coreAuthoringMode:
  candidate`, maxCalls 48, `maxEstimatedCostUsd 0.1`, `permittedConsequences []`, instruction 415 characters
  `d4f7835b...` (unchanged since round 1), `candidateTrial {trialRunner: true, startReset: true, source: "lab-plan"}`,
  `coreWeb` key `d64694e9...` not cached. Prelude rebuilt scenario-lab, domain host and extension for the instance.
- Running identities are checked by the Lab itself after Core starts and before the first provider call
  (`snapshots/running-{core,host,server-adapter,build}-identity.json`); a dry run cannot start Core. They are asserted
  below against the first call's time.
- Oracle (fixture `everything-store/workflows/plus-under-fifty.ts`): 13 ordered records, 52 fields; traps are the
  4-star filter admitting 3.8/3.9, "$25 to $50" admitting $50.00 and dropping under-$25 pairs, two Plus accessories,
  four sponsored placements a page plus a sponsored carousel, each page repeating the previous page's last result,
  four results loading only on scroll, page two's Next leading back to page two, and a 429 on a too-fast sweep.
  Final state: not challenged, cart count still 2.

## Run (2026-10-09 04:00-04:08 UTC)

- Command: the campaign dry run's command without `--dry-run`, same environment, `--max-attempts 1`, headed, chat
  build, flash, $0.10 ceiling. Guard `admitted` (fingerprint `sha256:58dcb4e0...`, `overridden: []`). Lab ledger
  `launch-mv0fufom-f03e223e`.
- The first five minutes were the Lab building the Core panel for this run (`next build`; the dry run had reported
  `coreWeb` not cached), with four lanes building at once.
- Identities: all four `running-*-identity.json` were `verified: true` at 04:06:49-04:06:52, before the first call
  (04:06:57).
- Mode: candidate (`coreAuthoringMode: candidate`; `flow-lane.json` candidate `not_tested`, `trialCount: 0`).
- Lab verdict: `failed`, `runtime.behavior`, `lab.chat_build_failed` (`flow_bootstrap.evidence_repeat_without_progress`,
  `llm_evidence_loop.repeat_refused`); `flowCreated: false`; oracle not measured.
- Calls and cost: 21 calls, $0.033140 (build $0.032948 of $0.10; 21 of 48 calls):
  - chat $0.000192;
  - exploration $0.027664 (16 decisions);
  - submission $0.005284 (4 decisions).
  - About $0.0116 went on decisions that could change nothing: 3 unreadable replies, 3 repeated looks and 3
    identical resends.
- Afterwards no Lab process was left (checked by command line). Not relaunched. No replay (no Flow).

## Causes, reproduction and the file to change (all Core, `C:/Users/osrs_/FluxStuff/!FluxIQ`)

| # | Cause | Reproduction | File to change |
| --- | --- | --- | --- |
| C1 (decisive) | The script format never says which step carries `repeat most:` ("a last step that cannot answer ended needs repeat most" reads as "on the last step"). The parser attaches it to the step it is written under, and routing refuses that as a nested repeat and as a repeat "not saying what repeats it". Neither message quotes the `repeat most` line or says to move it. | Step `0036-tool-core.submit_candidate/call.json` gives `flow_script.repeat_body_is_routed @ flow.line.22` and `flow_script.repeat_invalid @ flow.line.27`. Unit form (not run): `authoring/tests/candidate-loops.test.ts`, with `  repeat most: 5` under the span's last step. | `runtime/flow-bootstrap/plan/flow-script-format.ts:264` (say where it goes, and that a step answering ended needs none); `runtime/flow-bootstrap/authoring/parse.ts:182-189` and `authoring/draft-routing.ts:302,316` (take a lone `repeat most:` inside a `repeat while` span as that span's bound, or refuse naming the line and the move) |
| C2 (made C1 fatal) | An identical resubmission of a refused script gets the generic repeat note. It gives legacy advice ("amend the draft (rerun a step ...)", "the Flow so far is then tested and judged", false in candidate mode) and does not restate the refusal's issues. Three in a row end the build. | Steps 0038, 0040 and 0042 (`sameAsCall: submit-1`) | `runtime/llm/repeat-guard/feedback.ts:22-26`: a `core.submit_candidate` note that repeats the issues and quotes the lines |
| C3 (waste) | DeepSeek flash dropped the root object's final `}` on all three extract-list `run_node` replies (`content_unclosed`, finish reason `stop`). Core repairs a surplus `}` but not a missing one. | Steps 0017, 0025 and 0033 (`response.txt`) | `runtime/llm/deepseek/response-envelope.ts:116-129` |
| C4 (model, latent) | The accessory filter `name not contains ["ear tips", "charging case", "eartips"]` is case-folded, so it also drops 3 genuine answer rows (8, 9, 11). A candidate that passed its trial on this filter would store 10 of 13 rows. | Scratch check of the fixture's expected names; condition code `contracts/src/record-sets/process/condition-holds.ts:45` | Model reasoning. A prompt hint about telling accessories apart by what they are, or a judge cue to count against the page, would be design work, not a defect fix. |
| C5 (waste, model) | The same structure look on `t168` asked three times after it was answered. | Steps 0009-0014 | None needed; Core's note was clear |

Smaller: the first read used the wrong parameter shape and was refused with the right shape shown (0016), and was then
corrected. The cookie step names `t37`, a promotional carousel text, rather than Decline (`t121`).

## Judge versus oracle

No trial and no judge ran, and the oracle was not measured. C4 shows the risk for the next run: a trial would have
read 10 of the 13 rows, and only the judges stand between that and promotion.

## UI

Worker review: `reports/lane-c-candidate-ui.md` (24 pictures). The lead confirmed the ending text in `flow-lane.json` and
the "Decided the next step" heading in Lab view 7.

1. The ending gives no cause: ""Create an automation here" stopped because the build failed: it kept trying without
   getting any further, so it was stopped." It is honest that nothing was made, but circular, and it quotes the
   internal command name. It never says the Flow was refused and never tested.
2. The model's untrue "Resubmitting the corrected Flow ..." is shown three times under cards labelled "Change the Flow
   · run the step again". The live line then said "that didn't work, trying another way" before an identical resend.
3. "Action · Dom next page" (card and overlay) is still there from round 4. Each unusable reply is headed "Decided the
   next step".
4. The refusal itself (0036) was on screen for only seconds and is never restated.

## Next

1. Fix C1 and C2 in Core (small: prompt words, the lone-`repeat most` rule or message, and the candidate repeat note);
   C3 alongside. They are independent of lanes A, B and D and touch no file their runs need, but they change product
   source, so per the plan they merge between streaks.
2. Then rerun lane C in candidate mode. Watch the accessory filter (C4) against the oracle, and how the judges treat
   a short table.
3. The `unchanged` guard will refuse a rerun on this fingerprint until the source changes; no override was created.

---

# Round 2 (candidate mode, 2026-10-09)

Brief: `### Brief: lanes A-D round 2 in candidate mode (one lead per lane)` in the supervisor's
`docs/working/mvp-final-month-plan.md`. Same tree, slot, instance and workspace as round 1. Supervisor change at about
08:19 UTC (user): no time-of-day rule; the `peak` guard is removed (t382, dev `ba87bc0f`, merged into this branch as
`eb2ffa12`; it changes only `scripts/lab/live-guards/**` and docs), so the run launches when preflight is ready.

## Preflight (zero calls)

- Tree: downstream `eb2ffa12` on `task/t274-live-lane-c` (contains dev `ba87bc0f` and the t375, t376, t377, t378 and
  t379 merges), Core `dcaf8f9f` (= Core `dev`, Merge task t378), both clean. Slot 1 `owner` is t274 / C /
  `t274-slot-1`. Round 1's run `run-mv0fuotv-805294d7` has its debug in this tree (the `debug` rule).
- Round 2 changes present in source: the candidate repeat note (`runtime/llm/repeat-guard/feedback.ts` imports
  `candidate-feedback.ts`), where `repeat most:` goes (`flow-script-format.ts:305-306`), the unclosed-reply repair
  (`deepseek/response-envelope.ts` -> `unclosed-content.ts`).
- Core rebuild: `pnpm.cmd build` exit 0 in 337 s (`web:build` rebuilt, 240 s).
- Downstream rebuild: `pnpm.cmd build` exit 0 in 178 s (domain, test-runner, scenario-lab and the extension; chrome,
  firefox and e2e-chromium each "verified 22 files").
- Campaign dry run (same environment as round 1: `FLUXIQ_LAB_INSTANCE=t274-slot-1`, `FLUXIQ_TEST_ENV_FILES=none`,
  `FLUXIQ_TEST_TARGET=persistent-isolated`, `FLUXIQ_TEST_PERSISTENT_WORKSPACE=t274-c`): the same one command as round 1.
- Lab `--dry-run` of it: exit 0, `status: ready`, `providerCallCount: 0`, `lane: created-flow`, `buildEntry: chat`,
  `coreDefaultModel: deepseek-flash`, `coreAuthoringMode: candidate`, maxCalls 48, `maxEstimatedCostUsd 0.1`,
  `permittedConsequences []`, instruction 415 characters `d4f7835b...` (unchanged), `candidateTrial {trialRunner: true,
  startReset: true, source: "lab-plan"}`, `coreWeb` key `646f4ec2...` not cached. Lab browsers are always headed
  (`test-runner/src/commands.ts:246`). No t274 process was running before launch.

## Verdict

**Failed: $0.086 for 23 calls; nothing was submitted, tested or judged; no Flow; no replay.** Run
`run-mv0pa79q-ef91811b`, launched 08:24:46 UTC, guard `admitted` (fingerprint `sha256:d8adceeb...`, changed since
round 1), first call 08:29:06, ended 08:30:56. Evidence: `test-runs/instances/t274-slot-1/run-mv0pa79q-ef91811b/`
(`steps/`, `snapshots/`), UI pictures in `run-mv0pa79q-ef91811b.ui-review.local/`. Early cause sent to the supervisor at
about 08:40 UTC.

In plain English:

- The build explored well again. It declined cookies with the right button (`t121`; round 1 pressed a carousel text),
  closed the notification dialog, searched, read page 1 with a correct filter (Plus, 4 stars or more, under $50, not
  sponsored), then went Next page to pages 2, 3, 4 and 5 and read each. Paging held every time, past the store's
  broken page-2 Next link.
- It never wrote the script. It believed it had to read every page first ("to finish reading every results page
  before writing the Flow"), and each decision cost about twice round 1's because the run was launched inside
  DeepSeek's peak hours.
- At its 19th decision, with 3 decisions ($0.0255) left, Core's wrap-up stopped offering every tool, including the one
  that submits the script, and allowed only "complete". In candidate mode a build can complete only with a script it
  has submitted, so from that moment it could not finish.
- The model sent "complete" four times with invented identifiers; each was refused ("Submit a valid complete candidate
  ..."), and the third identical one stopped the build as "kept trying without getting any further".

## Run facts

- Mode: candidate (`flow-lane.json`: `authoringMode: candidate`, candidate `not_tested`, `trialCount: 0`, `draft: none`).
- Identities: the four `running-*-identity.json` were `verified: true`, written 08:29:01-08:29:04, before the first call
  (08:29:06). The Lab built the Core panel for the instance from 08:25 to about 08:29.
- Lab verdict: `failed`, `runtime.behavior`, `lab.chat_build_failed`, Core code
  `flow_bootstrap.evidence_repeat_without_progress`; `flowCreated: false`; oracle not measured.
- Calls and cost: 23 calls, $0.086080 (build $0.085885 of $0.10): chat $0.000195; exploration (0003-0038, 18
  decisions) $0.074295; the four refused completions $0.011590.
  - Price: 601,605 input tokens (269,317 uncached) cost $0.086; round 1's 540,521 (193,513 uncached) cost $0.033. Same
    work, about double the price per uncached token: launched at 08:25 UTC, inside the 06:00-10:00 peak (the user removed
    the time-of-day rule today).
  - Spent on nothing: reading pages 3-5 $0.0272, refused completions $0.0116, two unusable replies $0.0090, three
    repeated structure looks $0.0065, one misshaped read $0.0043.
  - Cache: when the offered tools change, the cached prefix collapses: 0019 hit 3,584 of 17,450 tokens; 0039 hit 3,584
    of 35,174 ($0.0096 for one "complete").
- No Lab process left (checked by command line after the run). Not relaunched. No replay (no Flow).

## Round 2 changes in effect?

| Change | Seen in this run |
| --- | --- |
| t377 Lab reads before the chat send retry; listings read only their rows | Chat send and the build started normally (step 0001); no Lab read failure |
| t378 refusals name the script line; `repeat most:` placement text | Text present in the submit tool's schema (0037 request lines 2424-2425); not exercised: nothing was submitted |
| t378 missing closing brace repaired | No `content_unclosed` reply this run (round 1 had three) |
| t378 candidate repeat note | Not exercised: no submission was resent |
| t375 plain endings | "Create an automation here" is gone from the ending (picture 08) |
| t376 neutral record button, Stop, onboarding | Record button neutral and Stop present (worker); onboarding never shown (picture 01 shows only "Loading the conversation...", checked by the lead) |

## Causes, reproduction and the file to change

| # | Cause | Reproduction | File to change |
| --- | --- | --- | --- |
| R2-1 (decisive, Core) | The budget wrap-up offers no tools at all: `offered = wrappingUp ? [] : eligibleTools`. In candidate mode that withdraws `core.submit_candidate`, so a build that has not yet submitted can never complete. The wrap-up text is legacy ("complete now from the draft you have ... amend the draft"). | `steps/0039-decide/request.txt`: entry `core.budget.19` (`decisionsLeft: 3`, `costLeftUsd: 0.0255`) and an `outputSchema` whose only decision is `complete`; 0040, 0042, 0044, 0046 refused. Unit form (not run): candidate authoring loop with a budget at 3 decisions left and no accepted candidate must still offer `core.submit_candidate` (and `core.test_candidate` after an accepted one). | Core `runtime/llm/evidence-loop.ts:641-642` (keep the candidate tools in the wrap-up, and start it earlier in candidate mode: submit, test and complete need at least three decisions); `runtime/llm/loop-budget.ts:133-135` (candidate wording: submit your script now, then test it, then complete) |
| R2-2 (Core, made R2-1 opaque) | The completion refusal says "Submit a valid complete candidate and complete with its latest revision and digest", without saying that no script has been submitted yet or naming `core.submit_candidate`; during the wrap-up it could not be acted on anyway. | `steps/0040-answer-unusable/result.json` | Core `runtime/flow-bootstrap/candidate/authoring-loop.ts:44` |
| R2-3 (downstream domain and Core, contributing) | Nothing tells a candidate build that one page and one Next page are enough evidence for a paging loop. The domain's shared system text gives the legacy recipe ("then amend_draft repeat on the read through Next page"), and the budget entry says "Plan to complete" without saying completing first needs a submitted, tested script. The model read all five pages. | `steps/0037-decide/request.txt` line 22 (Lists) and the model's summaries at 0025-0037 | Downstream `domain/src/runtime/llm-evidence/system-instructions/instructions.ts:53` (mode-neutral: the Flow states the loop; one page and one Next page are enough); Core `loop-budget.ts:133` |
| R2-4 (Core, minor) | `core.submit_candidate` is declared `effect: "observe"`, so withdrawing looks after an ignored redirect also withdraws the submit tool (0019 and 0021 offered only `core.run_node` and `core.test_candidate`). Each change in the tool list also empties the prompt cache. | `steps/0019-decide/request.txt` versus 0017 | Core `runtime/llm/decision-handlers/look-withdrawal.ts:85` (never withdraw the candidate tools) or the tool's effect at `authoring-loop.ts:36` |
| R2-5 (Core wording) | The ending carries the last *submission* refusal (t378), so a build that never submitted still ends "it kept trying without getting any further". It should say no script was submitted before the budget ran low. | `flow-lane.json` failure message; picture 08 | Core `runtime/service/candidate-failure/refusal-codes.ts`, `runtime/conversations/commands/progress.ts:163` |
| R2-6 (model, waste) | Twice wrote `kind: callId` in place of `kind: tool_call` (0005, 0031); asked the same structure look three times after it was answered (0013-0018, as round 1's C5); one read in the wrong parameter shape (0019, refused `target_unobserved`, then corrected). | Those steps | None; Core's notes were correct |
| R2-7 (model, latent) | Page 1's filter has no accessory test, so it kept "Replacement Ear Tips ..." ($12.99, 4.5, Plus); the oracle excludes the two Plus accessories. Round 1's filter overreached the other way (C4). | `steps/0022-tool-core.run_node/result.json` `read.extracted` | Model reasoning; only the trial's judges stand between this and promotion |

## Judge versus oracle

No trial and no judge ran; the oracle was not measured. R2-7 is the risk to watch next: a script built on page 1's filter
would include at least one accessory row.

## UI

Worker review: `reports/lane-c-candidate-ui-r2.md` (16 review pictures, 11 Lab screenshots). The lead confirmed pictures
01 (start) and 08 (failure).

1. No onboarding at start: the panel shows only "Loading the conversation..." (picture 01).
2. The four refused completions show as four "Checking whether the Flow is finished" paragraphs quoting the model's
   untrue "the search results across all five pages were read, so the Flow can be authored", with no refusal card
   (picture 08). The ending is still circular: "The build failed: it kept trying without getting any further, so it
   was stopped."
3. Fixed since round 1: "Dom next page" is now "Next page"; the idle record button is neutral; Stop is present; the
   internal command name is gone from the ending. Still wrong: unusable replies sit under "Deciding the next step";
   new: list steps are named by their columns ("name, price and 4 more"); the overlay still covers page controls
   (worker).

## Next

1. Fix R2-1 and R2-2 in Core (keep the candidate tools in the wrap-up, start it earlier in candidate mode, and say
   "submit first" in the refusal); R2-4 and R2-5 alongside.
2. Fix R2-3: the domain's Lists line in mode-neutral words, and the candidate budget wording.
3. Then rerun lane C. The `unchanged` guard will refuse a rerun on this fingerprint until product source changes; no
   override was created.
