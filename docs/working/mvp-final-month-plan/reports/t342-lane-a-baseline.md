# t342 — live lane A baseline on the restored creation path

Lead: t342-lane-a (lead). Worktree `fxwork/t342` (downstream 0a0f4979, Core e76e1775, branch
`task/t342-lane-a-baseline`). Instance `t342-slot-2`, slot 2, workspace `t342-a`. 2026-10-07, 19:52-20:12 UTC
(off-peak). Run debug: `docs/working/language-driven-flow-loop-plan/debugs/run-muyj5f0b-02fcd351.md`.

## In plain English

**Blocked. Nothing was built and nothing was spent.** The Lab started the one allowed lane A run, built the Core
panel and started Core. Then, as it should, it asked the running Core to prove which build it is before anything
costs money. Core said it could not, so the Lab stopped there: no project, no browser, no chat message, no model
call, $0.

Why Core could not say: when the Lab builds the Core panel for a run, it compiles Core from its source files instead
of using Core's built library. Only the built library carries the stamp that names the build, so a panel compiled
from source always answers "unavailable". This has been true since the build-identity check landed (t302). It was
never caught because the identity proofs used a stand-in server rather than the real panel, and t338's checks were
dry runs, which never start Core. It blocks every Lab run that talks to Core, paid or free: lanes A-D, saved-Flow
replays and provider-free Flow runs. I confirmed that with one free Flow run, which failed the same way.

I tried the fix on a scratch copy, without touching the repository. The same build, told not to read Core's source,
embeds the correct stamp, identical to the built library's. The fix belongs in the Lab's panel staging (below).

Because no build ran, there is no judge-versus-oracle comparison, cost per build, UI review, replay or second run to
report. The brief says to stop when a Lab or setup defect blocks the run itself, so I did not relaunch.

## What happened

| Time (UTC) | Step | Evidence |
| --- | --- | --- |
| 19:54 | Rebuilt Core libraries; downstream `pnpm build`: all current by stamp | `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` -> three `reuse`; `pnpm build` -> every step `reuse` |
| 19:54 | Claimed slot 2 | `lab-slots/slot-2/owner` = `{"task":"t342","lane":"A","instance":"t342-slot-2",...}` |
| 19:54 | Campaign dry run | one spawned command, with `--authoring-mode legacy --llm-max-calls 48` |
| 19:55 | Lab `--dry-run` of that command | exit 0; `status ready`, `providerCallCount 0`, created-flow, chat entry, persistent-isolated, deepseek-flash, `coreAuthoringMode legacy`, maxCalls 48, $0.10, `permittedConsequences []`, instruction 219 chars sha256 `2e6f5e7d...a405` |
| 19:58:10 | Live guard | `{"lab":"live-guard","state":"admitted",...,"fingerprint":"sha256:3632d337..."}` |
| 19:58-20:00 | Lab built the Core panel and started Core | `logs/core-web-build.log` compiled in 37.0 s, exit 0; `logs/core.log` `Ready in 1518ms`, gateway bound |
| 20:00:01 | Identity gate | `get-runtime-build-identity (400): Executing Core runtime build identity is unavailable.` (`process.startup`) |
| 20:00:07 | Campaign end | totals `providerCalls 0`, `reportedCostUsd 0`; ledger `finish` verdict failed, cost null |

Guards at launch: no `STOP-balance`, no override files; downstream two documentation files behind local `dev`
(allowed), Core equal to `dev`; no earlier ledger lines for this instance.

## Cause B1 and the proposed fix

- Core refuses when `service.coreRuntimeBuildIdentity` is null
  (`!FluxIQ/packages/fluxiq/src/programs/automation-studio/api/handlers/diagnostics/runtime-identity.ts:13`). It is
  read once from the embedded literal in `packages/fluxiq/src/runtime/build-identity/read.ts`. That literal is a
  placeholder in source and stamped only in `dist` (`dist/runtime/build-identity/read.js`: schema 1, version 0.7.0,
  1,601 artifacts, digest `144d96fa65f8...`).
- The served panel's server chunk inlines the placeholder into the service:
  `coreRuntimeBuildIdentity=(function(){let e=JSON.parse('{"fluxiqRuntimeIdentityPlaceholder":302}')...` in
  `!FluxIQ/.tmp/core-web-build/3ba011561d28594c1b0f43ca/b-73645052870f/apps/web/.next/server/chunks/Users_osrs__FluxStuff_fxwork_t342_!FluxIQ_0f2cb6e9._.js`.
- The cause is `packages/test-runner/src/core-web-build/workspace.ts:36`, which copies Core's `tsconfig.base.json`
  verbatim into the staged workspace. Its `paths` map `fluxiq`, `fluxiq/*` and `@fluxiq/contracts*` to `src/**.ts`,
  and Turbopack follows them. Without them, `apps/web/node_modules/fluxiq` (a link to Core's package, every export
  pointing at `dist`) would be used. The Lab's expectation is built from `dist`
  (`run-scenario/browser-session/core-identity/expected.ts:9,15`).
- Reproduction (free): `FLUXIQ_LAB_INSTANCE=<any> FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run
  basic-form --flow` -> `run-muyjgsoh-71c3b3f4`, the same 400. No Lab run on this machine has ever written
  `snapshots/running-core-identity.json`.
- Probe of the fix (free, scratch copy `!FluxIQ/.tmp/p1`, no repository file edited): the same staging with only
  those `paths` removed, then `next build --turbopack` with the Lab's build environment. The build exited 0, no
  server chunk contains the placeholder, and the service chunk embeds the stamped identity with digest
  `144d96fa65f8`, the same as `dist`.

Proposed fix, for a separate Lab brief (downstream `packages/test-runner/src/core-web-build/`):

1. `workspace.ts` `prepareWebWorkspace`: write the staged `tsconfig.base.json` with the `fluxiq`, `fluxiq/*` and
   `@fluxiq/contracts*` paths removed, so the panel resolves Core through its package exports to the stamped `dist`.
2. `key.ts:9`: raise `BUILD_LAYOUT_VERSION` from 2 to 3. `inputs.ts` hashes Core's real tsconfig, which the fix does not
   change, so without this the published source-built panel (key `3ba01156...`) would be reused.
3. `prepare.ts` `buildAndPublish`: before `markBuildComplete`, refuse to publish when any `.next/server/**/*.js`
   contains `fluxiqRuntimeIdentityPlaceholder`, with a message that names it. This fails at build time instead of
   with a 400 at run time.
4. Tests in `core-web-build/tests/` for 1-3. Then run a provider-free Flow-lane run, which must write all four
   `running-{core,host,server-adapter,build}-identity.json` snapshots before any paid run. The host, server-adapter
   and extension gates have never run in a real topology either, so they may show further defects.

The alternative is changing Core's own `apps/web` tsconfig or Next config. That also changes Core's development
build. The Lab staging is narrower and matches the facility doc's statement that the panel key covers the libraries'
`dist`.

## Other findings

- **B2, wrong blame in the campaign.** It said this deterministic Core 400 "can" be "this machine's memory fault ...
  only a retry tells them apart" (`scripts/lab/live-campaign/lab-run/ram-fault.mjs`). That contradicts the standing
  rule that live failures are product or Lab defects. An HTTP answer from Core control is not a crash. Proposal:
  exclude failures caused by a Core control HTTP response from the memory-fault classification, and name the
  endpoint and status.
- **B3, the dry run's panel key misleads.** The dry run reported key `a22a7ea3e56527de2aaf3183`, but the run built
  `3ba011561d28594c1b0f43ca`. Likely cause, not confirmed: the gateway server artifact the key covers is generated
  only by a real run.
- **B4, no free rehearsal before paying.** A dry run never starts Core, so it cannot catch identity, host or
  topology defects. A provider-free Flow-lane run (about 25 s with a cached panel) does. Proposal: make it part of the
  campaign's preflight whenever Core or the Lab changed since the last admitted run.

## Not measured, not run

- Judge versus oracle, cost per build, calls, steps: no build ran.
- UI review (chat, overlay, panel): the browser never launched (`ui review: 0 moment(s)`).
- Replay and second independent creation run: not reached.
- Running extension and domain-host identities: the Core gate refused first, so the host, server-adapter and
  extension checks never ran.

## Guard and slot state left behind

- Ledger: one `start` and `finish` for `t342-slot-2` (verdict failed, cost null). The debug exists under the run id,
  which satisfies the `debug` guard. The `unchanged` guard refuses this instance and task until source changes; the
  fix will change the fingerprint. `loop`: one start in the window.
- Slot 2 is still claimed by t342 (lane A).
- Scratch output to delete when no longer needed: `fxwork/t342/!FluxIQ/.tmp/p1` (probe build, about 210 MB, ignored)
  and the Lab's published source-built panel under `fxwork/t342/!FluxIQ/.tmp/core-web-build/3ba01156...`.

## Round 2 (2026-10-07, 21:11-21:50 UTC, off-peak)

Tree `fxwork/t342`: downstream at d0f0b7ea, which contains dev 706d2dfb (local `dev` ac50dd85 is two documentation
commits ahead, which the guard allows); Core at 93c059b0 (= Core dev). Both trees clean. Same instance, slot 2 and
workspace as round 1. Run debug: `docs/working/language-driven-flow-loop-plan/debugs/run-muylu4pp-f9cb2121.md`.

### In plain English

**Failed honestly: $0.0567 spent, no Flow saved, no further paid run.**

The identity fix worked. The Lab confirmed the running Core, domain host, server adapter and extension builds before
anything was spent. The build then ran from the extension chat in legacy mode.

The build found every control. It closed the cookie layers, searched, opened the right item, chose 7-in-1 and Spain,
collected the coupon, and even pressed Add to cart successfully. But the Flow it finished with had three faults:

- no Add to cart step;
- the quantity at 2, not 3;
- a Space Grey press that un-chose the colour the page already had.

Both build judges saw exactly that and said no, so nothing wrong was saved. One repair round could not fix it, and the
build stopped honestly, saying what was still missing.

Why, in order of weight:

1. **Core lost the Add to cart step while answering "applied".** The model asked to run Add to cart again and name it
   as the add (an `act` on a `rerun`). Core ran it, and the press worked. But Core ignored the `act` without saying so,
   and a rerun does not put a step into the Flow. The model thought the step was in and finished.
2. **Space Grey is already chosen when the page opens, and the build has no way to count that.** The acts checklist
   kept asking for a Space Grey step, so the model kept pressing a swatch that un-chooses itself. Core had even taken
   that press out and said why. The model put it back, and a press the model puts back is never taken out again.
3. **One "+" press, making the quantity 2, was accepted as "three".** Choice claims are not checked against the value
   they set.
4. **In the repair round the model tried edits the edit language does not have.** It tried to insert a new step with
   `add` and to turn a click into typing with `rerun`. It never made the run call the refusals told it to make. The
   repeat guard then closed the round.

Also found: this time the chat passed the build a paraphrase of the user's instruction (round 4 passed it verbatim).
The UI still has many wording and clutter defects, though two round-4 gaps are fixed.

### Measured

- **Run:** `run-muylu4pp-f9cb2121`. Guard admitted 21:13:20, chat send 21:15:11, ended 21:19:00.
- **Verdict:** failed, `runtime.behavior` / `lab.chat_build_failed`. Issues: `flow_bootstrap.build_not_finished`,
  `llm_evidence_loop.repeat_refused`.
- **Calls and cost:** 38 calls, $0.056718.
  - chat: 1 call, $0.000172;
  - exploration: 28 calls, $0.042911;
  - judges: 2 calls, $0.001649;
  - repair: 7 calls, $0.011986.
  - The build used $0.056546 of its $0.10 ceiling and 37 of its 48 calls.
- **Identities:** all four `running-{core,host,server-adapter,build}-identity.json` verified at 21:15:02-07, before the
  first call (21:15:11.9).
- **Mode:** legacy (`snapshots/live-llm.json`).
- **Judges versus oracle:** both judges said no. All four oracle facts would fail on the end view: no hub line, the
  `1 Cart` comes from exploration only, Space Grey is off, and the quantity is 2. So the judges agree with the oracle.
  Their Space Grey advice ("select it rather than toggling it off"), however, pointed the repair the wrong way.
- **UI:** U1 and U3 pass; U2, U4 and U5 partly. Details below.
- **Lab processes left:** none (checked by command line after the run).

Before launch, 21:11-21:12:

- Rebuild: Core libraries reused or restored from the build store; `pnpm build` exit 0.
- The campaign printed one command.
- The Lab's `--dry-run` exited 0: `status ready`, `providerCallCount 0`, legacy, flash, 48 calls, $0.10,
  `permittedConsequences []`, instruction sha256 `2e6f5e7d...a405`, `coreWeb` key `7baf48d2...` not cached.

### Causes, reproduction and the file to change

**C1: an `act` on a `rerun` is dropped without a word.** A rerun of a step that is not in the Flow leaves it out, and
the answer still says `applied`.

- Reproduction: decision 0073; answer 0074 (`applied`, keptStepCount 10); 0075 "Added to cart!"; the draft at 0076
  shows step 15 as `disposition: taken`.
- File to change: Core `runtime/llm/evidence-loop/rerun-request.ts:108-170`, which never reads `amendment.act`; also
  `flow-draft/amendment/apply.ts:113-116`. The refusal sentence goes in `llm/draft-amendment-feedback.ts`; the test
  goes beside `rerun-request.ts`.
- Verified by the lead, from the code and the step files.

**C2: a choice the page arrives with has no "already chosen" state on the checklist, and a re-added toggle half is
exempt from being taken out.**

- Reproduction: at 0012 Space Grey is marked, and every press un-chooses it (0020 ... 0139). The draft shown at 0071
  says step 19 was "taken out by Core". Decision 0071 re-adds it with `a1.colour`. The test's end view shows Space Grey
  off.
- Files to change:
  - a new rule under Core `flow-bootstrap/instructed-acts/`, so a preset choice counts as done;
  - `flow-draft/reversal.ts:86-95`, where `partnerOf` should skip `replacedBy` receipts;
  - a design call on the exemption at `reversal.ts:63`.
- Verified by the lead from the draft text and the code. The `partnerOf` change was shown only by a worker's scratch
  run against Core dist.

**C3: a quantity choice is accepted on a press that set 2, not 3.**

- Reproduction: step 13 is one "+" press (quantity 2 at 0039); the checklist at 0080 says `a1.quantity done: 13`.
- Files to change: Core `flow-bootstrap/instructed-acts/claim-verdict.ts:50`, which judges only ids matching
  `/^a[0-9]+$/`, and `quantity-fault.ts`, which accepts any stepper, field or select press. The domain's page-change
  statements must also carry field values.
- Verified by the lead for the Core lines. The domain part is the worker's claim only.

**C4: the repair round tried edits the edit language does not have.** It used `add` to "insert a step", refused
`not_a_kept_step` four times with the advice ignored. It used `rerun` to turn a click into typing, and the `text` on a
click was ignored.

- Reproduction: 0096, 0112 and 0132 for the inserts. 0131 and 0140 for the reruns: the clicks at 0102, 0110 and 0139
  succeeded and the quantity stayed 1.
- File to change: refuse rerun input keys the node does not take, in `llm/evidence-loop/rerun-input.ts` or in the click
  node's parameter validation. Owner not traced.
- Verified by the lead, from the step files.

**C5: three same-kind refusals in a row closed the repair round.** This is a consequence of C2: `changes_nothing` at
0130, 0132 and 0141. Nothing to change; it worked as designed. Verified by the lead.

Other findings:

- **F1: the chat paraphrased the instruction.** At 0001 it passed "add three ... to my cart ... while on the item
  page"; round 4 passed the user's words verbatim. Core `runtime/conversations/commands/create-here.ts:49` saves the
  interpreter's `instruction` argument. Proposal: when create-here starts from the person's turn, save the person's own
  message.
- **F2: a design question.** Completion is accepted by design while an act still has no step
  (`llm/harness-options/bootstrap-completion.ts`). A provider-free refusal saying "step 15 ran Add to cart but is not
  in the Flow" would have let the model recover during exploration.

Worker reports, with their claims verified as marked above:

- `reports/t342-r2-toggle-trace.md` (worker-high). It cites `quantity-fault.ts` lines 107-126, which do not exist in the
  101-line file. The behaviour it describes does match the file's header.
- `reports/t342-r2-ui-review.md` (worker). The lead checked `09-mid-build-panel.png` and `14-failure-panel.png`.

### UI review (summary)

- **Pass:** U1 start; U3 overlay (shown from the send, 16 of 16 samples visible in most moments, no flicker).
- **Fixed since round 4:** "Couldn't fix your Flow" on a creation build; the missing "Starting…" after the send.
- **Still open:** "Trying again: clicking on the page" names no control (moment 12).
- **New:**
  - the repair heading carries a step number, "judged" and the judge's raw observation (09);
  - edit cards use step numbers or contradict themselves ("added "Space Grey"; removed "Space Grey"", 07, 10, 11);
  - click cards have no target (03, 08, 12);
  - "Get coupons" is cut to "Get…" in the overlay;
  - each repair replay reprints 4-6 full cards (09-13);
  - identical refusals are not folded (05);
  - "Stop build" is absent during "Starting…" and looks like plain text afterwards;
  - the ending is one long paragraph and never says why the build stopped;
  - the overlay jumps in height.

### Not run, not verified

- Replay and second creation run: not run (no pass), as briefed.
- R6-2, playback on the Flow's own tab: not exercised, because nothing was played back.
- C2's checklist rule and C3's value check are designs only; no tests were written. The `partnerOf` change was shown
  only by a worker's scratch script against Core dist.

### Process correction acknowledged

Round 1's provider-free check used `basic-form`, which is not one of the ten realistic scenarios. That broke the
standing rule. Round 2 ran only `crossborder-marketplace`.

### Guard and slot state left behind (round 2)

- Ledger: `start` and `finish` for `run-muylu4pp-f9cb2121` (failed, $0.056718).
- The run's debug exists under the run id, which satisfies the `debug` guard.
- The `unchanged` guard refuses this instance and task until source changes.
- `loop`: one start in the window.
- Slot 2 is still claimed by t342 (lane A).
- Workspace `t342-a` holds the unfinished draft Flow `flow.13a2efa3-9dac-42a8-b177-4e047d5e114e`, in project
  `99c4b41d-...`, with no runs.
- The round 1 probe directory `!FluxIQ/.tmp/p1` is already gone.

## Round 3 (2026-10-07, 23:20-23:55 UTC, off-peak): the first live candidate-mode build

The tree `fxwork/t342` was at downstream 1d3731f7 (contains dev 7cc511ed) and Core 1b9f15f7 (= Core dev), both clean.
Same instance, slot 2 and workspace as before. Run debug:
`docs/working/language-driven-flow-loop-plan/debugs/run-muyqgopm-1bfa7054.md`.

### In plain English

**Failed before the first candidate reached Core: $0.021, no candidate, no trial, no further paid run.**

The candidate build started properly from the chat, with the person's own words. It explored the page cleanly and
quickly: in 16 decisions it found the item, collected the coupon, chose 7-in-1 and Spain, and typed 3 into the quantity
field. Then the model wrote its first complete candidate, but got one word of the reply's wrapper wrong. It wrote "callId"
where "tool_call" belongs.

In legacy mode Core would have told the model its reply was unusable and asked again. In candidate mode that retry is
not wired up, so this single slip ended the whole build. The chat then told the person something false, "the model
could not be reached", directly under its own line saying it was asking again. The failed build also reported its spend
as $0 to the Lab's per-build check, although it cost $0.0206.

The submit tool and the test tool were offered correctly, but the trial runner, its judge, promotion and apply were
never exercised. So this round says nothing yet about whether candidate mode builds lane A better. It does show three
defects that would stop any candidate build at its first malformed reply.

The script the model was about to submit would probably have been refused by a trial. It presses Space Grey (round 2's
toggle trap) and dismisses none of the layers covering Add to cart. The quantity, however, was right this time.

### Candidate (round 3) versus legacy (round 2), same task and instance

| | Round 2, legacy (`run-muylu4pp-f9cb2121`) | Round 3, candidate (`run-muyqgopm-1bfa7054`) |
| --- | --- | --- |
| Outcome | failed honestly after build, test, judges, one repair and a second test | failed at the first submission (unusable reply ended the build) |
| How far | Flow drafted, tested twice, judged once; nothing applied | exploration done; candidate never accepted for checking; no trial |
| Calls | 38 (chat 1, exploration 28, judges 2, repair 7) | 18 (chat 1, exploration 17) |
| Cost | $0.056718 (build $0.056546) | $0.020980 (build $0.020646; recorded as $0) |
| Exploration decisions to a complete answer | 28 to `complete` | 16 to the submit |
| Churn | 20 amendment answers, 13 with refusals; 1 refused repeat call; three same-kind refusals ended repair | 0 submissions refused, 0 trials, 0 completions refused; 1 refused repeat call; 1 unusable reply (fatal) |
| Quantity | one "+" press (2), accepted as three | typed 3 into the field |
| Space Grey | toggle half kept; un-chose the colour | the script presses it (same trap; untested) |
| Add to cart | ran but left out of the Flow (rerun `act` dropped) | in the script (untested) |
| Instruction saved | chat paraphrase | person's own words (t349 seen) |

### Causes, reproduction and the file to change

- **C1: one unusable reply ends a candidate build.**
  - Reproduction: step 0035's `decision.json` has `"kind": "callId"` with a complete `core.submit_candidate` input.
    `logs/core.log` shows `decide throw ... AutomationStudioLlmUnusableDecisionError ...
    llm_output.invalid_evidence_decision`, then `build throw`.
  - Cause: Core `runtime/service.ts:1565` (candidate loop options) sets `propagateDecisionErrors: true` without the
    `unusableDecisions` setting that legacy passes (`service.ts:1596`). Core `llm/evidence-loop.ts:660-690` then
    rethrows.
  - Fix: pass `unusableDecisions` to the candidate loop, with a stalled ending that keeps the draft. The failing test
    first: one malformed decision, then a valid submission, must continue.
  - Verified by the lead in code and logs.
- **C2: an unusable reply is told as "the model could not be reached".**
  - Reproduction: 05-failure-panel.png and `build.chat.said`.
  - Cause: the candidate branch never moves `failureStage` to `provider_output_validation` when a decision returns
    (legacy does, `service.ts:1633`; the candidate branch sets it only at `service.ts:1574`). Stage `provider_request`
    is worded at `conversations/commands/progress.ts:103`.
  - Fix: in the candidate branch, set the stage when a decision returns.
  - Verified by the lead in code.
- **C3: a failed candidate build reports no spend.**
  - Reproduction: `build.accounting: null` and `perBuild.estimatedCostUsd: 0` against $0.020646 summed from the step
    logs. The ledger shows `maxBuildCostUsd 0`.
  - Cause: the candidate failure path carries only `failureAccounting` from `progress` (`service.ts:1574`).
  - Fix: carry the loop's accounting on failure, as legacy's `loopAccounting` does. This matters for the $0.10 per-build
    check.
  - Verified by the lead from the files.

Predictive risks for the next candidate run, untested because no trial ran:

- the script's Space Grey press (round 2 C2, unfixed);
- the item URL opened directly with the covering layers left;
- a `wait_for_text "added to cart"` whose wording may not match the page's "Added to cart!".

### UI review (all 5 moments, by the lead)

- **Fixed (t350):** "Stop build" is a real button from the first moment; the overlay is placed stably at the bottom
  left.
- **Plain and good:** the candidate intro ("working out its steps by trying them on the page ... then test-running the
  whole Flow once from the start").
- **Still open:** click cards and overlay lines name no control ("Click · Working on it", "Clicking on the page").
- **Back:** the confusing "Reading your instruction gave no answer for ... so the build's tests check the steps that do
  them rather than do them again" sentence.
- **New, from C1/C2:** "Asking it again" directly followed by "stopped ... could not be reached".
- **Minor:** the Flow is named with the instruction's first 70 characters.

### Not run, not verified

- Trial runner, start-hook reset receipt, build-test judge on trial evidence, promotion, chat apply, playback on the
  Flow's own tab: never reached.
- Replay and second candidate run: not run (no pass), as briefed.
- The C1 fix is a design. No test was written, per the no-source-edits rule.

### Guard and slot state left behind (round 3)

- Ledger: `start` and `finish` for `run-muyqgopm-1bfa7054` (failed, $0.020980).
- The run's debug exists under the run id. The `unchanged` guard refuses this instance and task until source changes.
- Slot 2 is still claimed by t342.
- No Lab process is running.

## Round 4 (2026-10-07/08, 23:54-00:20 UTC, off-peak): candidate mode after t354

The tree `fxwork/t342` was at downstream b9e0c352 (contains dev ea2366b9) and Core 0c53a16c (= Core dev), both clean.
Same instance, slot 2 and workspace. Dry run: ready, 0 calls, candidate mode, `candidateTrial {trialRunner: true,
startReset: true}`, 48 calls, $0.10. Guard admitted at 23:57:35 UTC. Run debug:
`docs/working/language-driven-flow-loop-plan/debugs/run-muyrpbnk-fef374e7.md`.

### In plain English

**Failed: $0.039, two trials, neither got past its second step, nothing promoted, no further paid run.**

t354's three fixes held: no reply was lost, and the spend was recorded. This time the candidate machinery really ran.
The model explored, wrote a whole Flow as a script, and Core test-ran it twice from a freshly reset page. Both trials
broke on the same step, collecting the store coupon, for two different reasons, and neither reason was the model's
fault:

1. **The script pointed at the coupon button as it looked after exploration had already pressed it.** The button says
   "Get coupons" on a fresh page and "Collected" afterwards. Core recorded the step against "Collected", so on the
   reset page the trial could not find it.
2. **When the target was right, the page answered the first press with "Network busy, please try again".** A normal
   run retries such a press up to three times. A trial allows one attempt, so it failed.

The model then had no way out:

- The script language has no way to say "retry this" or "optional".
- Its request to simply try the trial again was refused as a repeat.
- The trial told it only "step 2 failed: rate limited", without the page's own words.

It then guessed that pop-ups were in the way and added steps using buttons it had seen on a different page. Core
refused that twelve times with a sentence that never named the buttons or the page, until the no-progress guard
stopped the build. The ending then told the person "the model's answer could not be used" and that the Flow "has no
steps yet". Both are untrue: the answers were usable and four drafts were saved.

### Rounds 2, 3 and 4 side by side (same task, instance and model)

| | Round 2, legacy | Round 3, candidate | Round 4, candidate + t354 |
| --- | --- | --- | --- |
| Run | `run-muylu4pp-f9cb2121` | `run-muyqgopm-1bfa7054` | `run-muyrpbnk-fef374e7` |
| Outcome | failed honestly after test, judges, repair | failed at the first submission (one bad reply) | failed after two trials, both stopped at step 2 |
| Calls / cost | 38 / $0.056718 | 18 / $0.020980 (recorded $0) | 34 / $0.039318 (recorded $0.039248) |
| Split | chat 1, exploration 28, judges 2, repair 7 | chat 1, exploration 17 | chat 1, exploration 14, submissions 16, trial requests 3, judges 0 |
| Churn | 20 amendment answers, 13 with refusals | 1 unusable reply (fatal) | 16 submissions, 12 refused; 3 trial requests, 1 refused as repeat; 0 completions |
| Furthest point | Flow tested and judged twice | exploration only | two trials from a reset page, step 2 of 8 |
| Quantity | "+" once (2), accepted as three | typed 3 | typed 3 |
| Space Grey | toggle kept, colour un-chosen | press in script (untested) | press in script (never reached) |
| Instruction saved | paraphrase | own words | own words |

### Causes, reproduction and the file to change

| # | Cause | Reproduction | File to change | Verified by |
| --- | --- | --- | --- | --- |
| C1 | Script handles bind to the control as exploration last saw it, after its own act ("Collected" for "Get coupons") | page views 0012 vs 0016/0026 (`t925`); trial 1 (0032) step 2 `web.target.not_found`; overlay moment 5 "Clicking “Collected”"; revision 7 `changedPaths ... element.visibleText` | downstream `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts:113` (identity text from the newest view); choose the view before the acting step | lead (views, trial record); selection point not traced |
| C2 | A trial allows one attempt per step; a normal run retries three times | trial 2 (0048) step 2 `web.action.rate_limited` (retryable, domain `failure/codes.ts:283`) on the page's first-press "Network busy" | Core `flow-bootstrap/verification/detached-execution.ts:75-76` (`retryPolicy {maxAttempts: 1}`, `maxRetriesPerAction: 0`) against `executor/retry-policy.ts` default; keep model recovery at zero | lead, code |
| C3 | `web.handle.unknown` refusals name no handle or location; 12 refusals of start-page handles `t478`/`t488` | 0037-0044, 0053-0068; the handles appear only in 0004's start page view | downstream `domain/src/runtime/llm-evidence/node-run/run.ts` and the candidate submission diagnostics | lead |
| C4 | Trial feedback has only step number and code | 0032, 0048 `feedback.steps` | Core `runtime/service/candidate-trial/feedback.ts`: add control words, the page's notice, a screened end view | lead |
| C5 | Retrying a trial after a retryable failure is refused as a repeat | 0049/0050 `repeat_refused` | Core `llm/repeat-guard/outcomes.ts` | lead |
| C6 | No-progress ending worded "the model's answer could not be used"; "has no steps yet" with four drafts saved; Lab `candidate: null` | `build.chat.said`, `snapshots/flow-lane.json` | Core candidate failure staging in `runtime/service.ts`, `conversations/commands/progress.ts`, `conversations/commands/create-here.ts`; downstream `flow-lane/creation/candidate-outcome.ts` | lead |
| gap | The script format has no retry or optional key | 0051 resubmission identical (`changedPaths: []`) | Core `flow-bootstrap/plan/flow-script-format.ts` (only after C2: with normal retries the model need not write one) | lead |

Order that matters: C2 then C1. Every lane A candidate meets the busy coupon after a reset, and every candidate that
collects the coupon in exploration meets C1. After those, round 2's Space Grey trap is still in every script the
model wrote (C2 of round 2, unfixed).

### UI review (8 moments, lead)

- Internal names reach the person: "Using “Test candidate”", "Using “Submit candidate”", "Revision 7", "rate limit"
  (05, 07, 08).
- Moment 5 says "Trying again didn't fix the step", although trials never retry.
- The overlay says "Step 2 of 8" and "Fixing your Flow" during a trial.
- Fixed since round 3: the unusable-reply words, the Stop button, overlay placement.
- The ending is wrong (C6).

### Not run, not verified

- The trial judge, promotion, chat apply, playback and the oracle: never reached.
- Replay and second candidate run: not run (no pass), as briefed.
- Fixes are designs; no tests written (no source edits).

### Guard and slot state left behind (round 4)

- Ledger: `start` and `finish` for `run-muyrpbnk-fef374e7` (failed, $0.039318). Its debug exists under the run id. The
  `unchanged` guard refuses this instance and task until source changes.
- Slot 2 is still claimed by t342.
- No Lab process is running.

## Round 5 (2026-10-08, 03:03-04:25 UTC; launched off-peak at 04:01): candidate mode with the round 4 fixes

The tree `fxwork/t342` was at downstream 069af09a (contains dev 3e72200a; local `dev` later moved two documentation
files ahead) and Core a318edb5 (= Core dev), both clean.

- Rebuild and dry run at 03:03-03:05: ready, 0 calls, candidate mode, `candidateTrial {trialRunner: true, startReset:
  true}`, 48 calls, $0.10.
- Waited out peak pricing; the guard admitted the run at 04:01:28.

Run debug: `docs/working/language-driven-flow-loop-plan/debugs/run-muz0f12h-eae63685.md`.

### In plain English

**Failed: $0.023, two trials, nothing promoted, no further paid run.**

Round 4's two blockers are gone. The coupon button was found on the reset page, and when the page said "busy" the
press was retried and worked, in both trials. The second trial ran almost the whole Flow: coupon, 7-in-1, Spain and
quantity 3. Then Add to cart was refused with "please select a colour".

The one thing left is Space Grey, round 2's trap. Space Grey is already chosen when the page opens, and its swatch is
a plain box, not a checkbox:

- The "make sure it is chosen" step the model wrote first is refused, because that step only works on checkboxes.
- A plain click, its second try, un-chooses the colour.
- Leaving the step out is not offered: the build asks for a step for every option the person named.

The model worked out exactly what was wrong ("no Color was selected"). It spent its last eight decisions looking for
a hidden checkbox that does not exist, until the look limit stopped it.

The trial report also told it the coupon press had failed when it had in fact succeeded on its retry: it numbers
attempts as steps.

The ending was honest and plain this time, and the Lab recorded the candidate and both trials.

### Rounds 2-5 side by side (same task, instance and model)

| | Round 2, legacy | Round 3, candidate | Round 4, candidate + t354 | Round 5, candidate + t355-t363 |
| --- | --- | --- | --- | --- |
| Run | `run-muylu4pp-f9cb2121` | `run-muyqgopm-1bfa7054` | `run-muyrpbnk-fef374e7` | `run-muz0f12h-eae63685` |
| Furthest point | Flow tested and judged twice | exploration only | two trials, step 2 of 8 | two trials, trial 2 reached Add to cart |
| What stopped it | Add to cart left out; Space Grey toggled; quantity 2 | one bad reply | coupon target and busy page | Space Grey cannot be set |
| Calls / cost | 38 / $0.0567 | 18 / $0.0210 | 34 / $0.0393 | 22 / $0.0226 |
| Churn | 13 of 20 amendment answers with refusals | 1 fatal bad reply | 12 of 16 submissions refused | 0 of 2 submissions refused; 8 looks at the end |
| Coupon | done in exploration | done in exploration | failed in both trials | found and retried to success in both trials |
| Space Grey | toggled off | press in script | press in script | check refused (div), then click toggled it off |
| Quantity | 2 | typed 3 | typed 3 | typed 3 (ran in trial 2) |
| Ending words | honest | wrong ("could not be reached") | wrong ("answer could not be used") | honest, names the cause |

### Causes, reproduction and the file to change

- **C1 (decisive): a preselected toggle swatch has no expressible desired state.**
  - Reproduction: trial 1 attempt 8 `web.dom-check` on Space Grey refused `not_checkable: <div> is not a checkbox or a
    radio`. Trial 2 attempt 8: the Space Grey click un-chose the colour, and attempt 12 (Add to cart) was refused "needs
    something first".
  - File to change:
    - extension `apps/extension/src/content/actions/check.ts` (`:13`, `:61`): honour the chosen state that the domain
      reads for any pressable choice (`domain/src/runtime/llm-evidence/node-run/press-effect/chosen-state.ts`,
      `page-view/element/state-tokens.ts`). Already chosen means nothing to do; otherwise press once and confirm.
    - and/or round 2's checklist rule: an option already marked needs no step.
  - Verified by the lead, from the trial records and the code header.
- **C2: trial feedback numbers attempts as steps, and reports a retried success as a failure.**
  - Reproduction: trial 1's feedback has 8 entries for 7 nodes; "step 6 failed rate_limited" is attempt 6 of node s6,
    whose attempt 7 succeeded. Trial 2 has 12 entries for 11 nodes in the same way.
  - File to change: Core `runtime/service/candidate-trial/feedback.ts`. Give one entry per node with its final outcome
    and attempt count, and name every control.
  - Verified by the lead: the workspace's trial event streams against the feedback.
- **C3: stuck on an inexpressible step, the model looks until the guard stops it.** Eight finds and describes,
  0029-0044. This is a consequence of C1; nothing to change. Verified by the lead.

Seen working this round, each checked by the lead in the trial records or the chat:

- the coupon's identity across its label change, and the busy press retried, `unacted` (t355, t356, t359);
- optional popup steps skipped where absent (t357, t358);
- plain trial headings, and controls named on most cards (t356, t363);
- an honest ending, and the Lab's candidate record (t362).

### UI review (7 moments, lead)

- **Good:** plain headings ("Saving the Flow's steps", "Testing the whole Flow from the start"); no internal tool names;
  cards name Add to cart, 7-in-1, Spain; the Stop button; an honest ending.
- **Still to fix:**
  - the overlay during trials reads "Building your Flow" / "Fixing your Flow | Step N of 10", not "Testing your Flow";
  - "Trying again didn't fix the step" after a refusal that is not retryable;
  - Type and Look cards name no target;
  - a card label is cut in the middle ("Choice ... on every Choice item");
  - the ending does not say what blocked the build (the colour could not be chosen).
- **Script risk:** the "close the welcome popup" step pressed a promo banner (`t68` "Choice Day · free returns on every
  Choice item"). It was skipped here, but it would navigate away where present.

### Not run, not verified

- The trial judge, promotion, chat apply, playback and the oracle: not reached.
- Replay and second candidate run: not run (no pass), as briefed.
- Fixes are designs; no tests were written (no source edits).

### Guard and slot state left behind (round 5)

- Ledger: `start` and `finish` for `run-muz0f12h-eae63685` (failed, $0.022649). Its debug exists under the run id. The
  `unchanged` guard refuses this instance and task until source changes.
- Slot 2 is still claimed by t342.
- No Lab process is running.

## Round 6 (2026-10-08, 04:52-05:20 UTC, off-peak): candidate mode with round 5's causes fixed

The tree `fxwork/t342` was at downstream ee7a2895 (contains dev ab771df2) and Core 97772aeb (= Core dev), both clean.

- Rebuild and dry run at 04:52-04:54: ready, 0 calls, candidate mode, `candidateTrial {trialRunner: true, startReset:
  true}`, 48 calls, $0.10.
- The guard admitted the run at 04:55:34.

Run debug: `docs/working/language-driven-flow-loop-plan/debugs/run-muz2cj6p-80eb2179.md`.

### In plain English

**The product passed lane A in candidate mode for the first time. The Lab still marked the run failed, because of a
defect in the Lab itself.**

The build explored the page, wrote the Flow as a script and test-ran it from a freshly reset page four times:

- **Trials 1-3** each did the real work: the coupon (retried once when the page was busy), Space Grey left as it was
  because it was already chosen, 7-in-1, Spain, quantity 3 and Add to cart. Each then failed only on its last line, a
  check that waited for wording that disappears or never shows.
- **Trial 4** opened the mini-cart first, and everything passed.

Then:

- Both judges said yes, describing exactly what the private oracle checks: three hubs in Space Grey, 7-in-1, from
  Spain, the coupon collected, nothing bought.
- Core turned the tested Flow into the real one, and the chat applied it and said the automation is ready.

The Lab then refused to go on. It requires an audit record that only legacy builds produce, so it never played the
saved Flow or checked the oracle itself.

I therefore ran the zero-call replay, which costs nothing and needs no model. The saved Flow ran from start to finish
with no model and no help, and the oracle held.

The second creation run was refused by the guard, because the Lab recorded this run as failed and the source has not
changed. It needs the Lab fix, or the user's override, which I did not create.

Cost: $0.026698 for 23 calls. The cheapest build to get this far.

### Rounds 2-6 side by side (same task, instance and model)

| | Round 2, legacy | Round 3, candidate | Round 4, candidate | Round 5, candidate | Round 6, candidate |
| --- | --- | --- | --- | --- | --- |
| Run | `run-muylu4pp-f9cb2121` | `run-muyqgopm-1bfa7054` | `run-muyrpbnk-fef374e7` | `run-muz0f12h-eae63685` | `run-muz2cj6p-80eb2179` |
| Product outcome | failed honestly | failed (bad reply) | failed (coupon) | failed (colour) | **passed: tested, judged yes twice, promoted, applied, "ready"** |
| Lab verdict | failed | failed | failed | failed | failed (`lab.proposal_without_evidence_audit`, a Lab defect) |
| Oracle | not measured | not measured | not measured | not measured | **held on a zero-call replay** |
| Calls / cost | 38 / $0.0567 | 18 / $0.0210 | 34 / $0.0393 | 22 / $0.0226 | 23 / $0.0267 |
| Trials | n/a | 0 | 2 (both stopped at step 2) | 2 (stopped at colour or Add to cart) | 4 (3 failed at the final check, 1 yes) |
| Churn | 13 of 20 amendment answers with refusals | 1 fatal bad reply | 12 of 16 submissions refused | 0 of 2 refused; 8 looks | 0 of 4 submissions refused; 1 wasted re-test |

### Evidence of the pass

- **Trial 4** (`trial.26f46af5...`, revision 4, `start: "reset"`):
  - navigate;
  - two optional dismissals skipped as absent;
  - coupon "succeeded after 2 attempts";
  - `dom-check` Space Grey, 7-in-1 and Spain succeeded;
  - quantity typed;
  - Add to cart;
  - mini-cart opened;
  - `wait_for_text "Cart (3)"` succeeded.
- **Judges 0041/0042:** `answersRequest: yes`, confidence 0.9 each. They cite Cart (3), the line "Space Grey · 7-in-1 ·
  Ships from Spain" × 3, the coupon collected and no purchase.
- **Promotion and apply:** adaptation `adaptation.bootstrap.1f6b3177...`. Chat: "Your automation ... is ready ... a
  test run of the whole Flow from its start was judged, twice, to do what you asked." Overlay: "Flow ready | Your Flow
  is ready".
- **Zero-call replay** `replay-muz2npvw-b51023b7`: verdict passed; 0 provider calls, 0 interventions, 0 harness
  activations; model providers disabled; Flow hash `9f513eb7...` unchanged; run succeeded; `playbackGoalHeld: true`.
- **Second creation run, 05:05:52:** refused by the `unchanged` rule, $0.

### Causes and findings, with the file to change

| # | Finding | Reproduction | File to change | Verified by |
| --- | --- | --- | --- | --- |
| L1 | The Lab refuses a promoted candidate for lacking the legacy evidence audit; the candidate record is never read | `snapshots/flow-lane.json` `build.failure.code` `lab.proposal_without_evidence_audit`, `candidate: null`, `adaptationId` present | downstream `packages/test-runner/src/flow-lane/creation/build-proposal.ts:490-494` (accept a candidate proposal by its `candidateTrial` audit), or Core `runtime/service/candidate-trial/promotion.ts` (attach the candidate loop's evidence counts); `chat/build-from-chat.ts:199-210` reads the promotion only after the build passes | lead, code and snapshot |
| L2 | The `unchanged` guard treats a Lab-defect failure as a product failure, blocking the second pass | refused launch at 05:05:52 | `scripts/lab/live-guards/` rule `unchanged` (design question: judge "did not pass" by the product's verdict, or allow when the run's product outcome was accepted) | lead |
| F1 | An optional `wait_for_text` that times out still fails the trial | trial 3 (0036), revision 3 step marked `optional: yes` | Core optional routing (t357) for failures other than an absent target; not traced | lead (trial record); cause not traced |
| F2 | A deterministic timeout invited a re-test of the same revision | trial 2 (0030) = trial 1's failure | Core trial gate (t356) re-test rule | lead |
| F3 | UI words | panel 18; overlay moments 12, 16 | Core ending and activity wording | lead |

F3 in detail:

- "Reading your instruction gave no answer for ..." still appears just before the ready message;
- the ready line keeps legacy words ("I tried its steps on the page you had open and put the ones that worked into
  it");
- the overlay headline switches between "Building" and "Testing" while the model decides;
- the coupon and dismissal lines name no control.

**Next order:**

1. L1 (small), then L2 or a user override.
2. Then the second candidate creation run on the same pair, and that run's own zero-call replay, for lane A's
   two-pass qualification.

### Not run, not verified

- The Lab's own reset, playback and oracle after creation (L1 blocked them). The oracle was measured by the replay
  instead.
- The second creation run: refused by the guard.
- Fixes are designs; no tests were written (no source edits).

### Guard and slot state left behind (round 6)

- Ledger: `start` and `finish` for `run-muz2cj6p-80eb2179` (failed, $0.026698). Its debug exists under the run id.
- The replay is recorded at `test-runs/instances/t342-slot-2/replays/replay-muz2npvw-b51023b7.json`.
- The `unchanged` guard refuses this instance and task until source changes.
- Slot 2 is still claimed by t342. Workspace `t342-a` holds the applied Flow (project `b35b7fd6-...`, Flow
  `flow.d1642aeb-...`).
- No Lab process is running.
