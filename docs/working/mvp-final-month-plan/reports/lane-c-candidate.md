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
