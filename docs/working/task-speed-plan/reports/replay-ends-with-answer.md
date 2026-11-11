# t897: a replay ends with its answer, and later attempts run the saved Flow

Worker: t897 (worker-heavy). Diagnosed run: `run-mwb5cnxg-003415b4` (social-network-feed,
`social-network-feed-group-post`, Haiku, `--attempts 4`). Proof run: `run-mwbadi79-d928f922`.

## Round 2 (after the first landing, 26e0d2158 / 0ed3f45fb)

### 1. `act_not_done` on an interruption that is not there: fixed

The cause: `engine/automation/step-skip/act-not-done.ts` marks any press it passes over as an act not done, because the domain floor says every press commits. That includes a saved cookie-banner step (`interruption`) whose banner simply was not shown on the replay. S9 then judged every replay for `act_not_done`.

The fix is in `flow-run/steps-ran.ts`. A saved step that is an `interruption` and claims none of the person's acts, passed over because its target is absent, reads `absent`. That is the accepted run's own page. A step that does an act still reads `absent_not_done`.

The test is `flow-run/tests/steps-ran-interruption.test.ts`, 3 cases. Before the fix: 1 failed, the interruption case (`absent_not_done`). After: 3/3.

flow-run plus completion: 138/139 under the other lanes' sweep. The one failure is a timeout at 61 s in flow-run.test's size case, which passes alone in 8.9 s.

### 2. D2, the missing answer card: my regression from round 1, fixed

It was not Lab timing:
- The Lab now waits up to 30 s for the card before its picture, and writes `answer-turn-wait.json`.
- The scoring's own 30 s chat-port wait also found no card on dining's attempt 2 (`run-mwbexkqx-cf7dd640`: answer wrong, `not_shown`).

The cause: round 1 added an optional `replay` to `AutomationStudioTaskOutcome`. The panel's reader (`apps/extension/.../results/read-task-outcome.ts`) accepted only a hand list of keys and refused the whole record, so no card drew for any attempt carrying a verdict. That matches Post attempts 2–4 of `run-mwbadi79` and dining's attempt 2.

The fix: the reader's field list is `Record<keyof AutomationStudioTaskOutcome, true>`, and `replay` is read strictly against `Record<AutomationStudioTaskReplayDeviation, true>`. Both are exhaustive at compile time; the types are imported type-only from `fluxiq/automation`.

The structural test (`results/tests/read-task-outcome.test.ts`): a `Required<AutomationStudioTaskOutcome>` fixture with every field set, which the reader must accept. 31/31 with the fix; against the old reader, 29/31 (both new read cases fail). `extension check`: exit 0.

### 3. Dining provider-free at `--attempts 4`: `run-mwbhd4eu-0a8863c9`, passed

| attempt | path | calls | answer | card drawn | replay verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | explore | 22 | right | after 5 ms | none |
| 2 | run_flow | 1 judge | right | after 3 ms | judged: flow_not_proven |
| 3 | run_flow | 0 | right | after 3 ms | stood on its record |
| 4 | run_flow | 0 | right | after 2 ms | stood on its record |

All continuations held. Attempts 3–4 now stand on their record at 0 calls. Before the steps-ran fix, the coordinator's run `run-mwb81x8q` judged them; the expected reason was the cookie step's `act_not_done`, which the S9 verdict was not yet recorded to show.

### 4. Live Post at `--attempts 4` on Haiku: `run-mwbj3imn-d681f993`, passed, $0.0167

| attempt | path | calls (interp/judge/decisions) | card | S9 verdict | posts before -> after |
| --- | --- | --- | --- | --- | --- |
| 1 | explore | 9 (1/1/7) | drew after 2 ms | none | 0 -> 1 |
| 2 | run_flow | 2 (0/2/0) | drew after 4 ms | judged: flow_not_proven | 1 -> 1 |
| 3 | run_flow | 0 | drew after 3 ms | stood on its record | 1 -> 1 |
| 4 | run_flow | 0 | drew after 3 ms | stood on its record | 1 -> 1 |

All continuations held. Attempt 2's second judge call is the re-ask after a refused row citation, within one completion. Debug note: `docs/working/language-driven-flow-loop-plan/debugs/run-mwbj3imn-d681f993.md`.

Before this run, one try stopped at the Lab's stale-Core gate after the dev merge, before any call; Core's libraries were rebuilt through the slot. Core structure audit before reporting: passed (530 warnings).

## Outcome (round 1)

Partial: all the work agreed for landing is done and checked. The live Post proof passed. The round-1 follow-ups are done in round 2 above.

Handed over to a new lane, as the coordinator decided:
- **D1:** the chat shows "Click · Post — Done" for a step the run gate did not send.
- **The run gate's cross-attempt act carry.**

## Root causes and fixes

### (a) Attempts "ending" with no answer: a Lab misreport (fixed)

Core ended every attempt. The Lab's follower (`follow-attempt.ts`) stopped on `waiting_for_person`:
- A saved Flow's run asks permission for the Post once before it starts.
- The Lab's own person answered in the chat after 1.1–1.3 s.
- When a 1 s poll landed in that window, the follower read the row mid-run: `working`, 1 live step, `ms` 1334, notes only, no answer card yet.

How we know Core finished attempt 2: attempt 3's message could only be typed once the chat composer was enabled again. That happened 0.9 s after attempt 2's last judge.

The fix: the follower keeps following a permission wait when the run's person answers permission questions. That is every task except `askFirst` ones (`attempt-person.ts` `answersPermissions`, `live-driver.ts`).

Did S9 (t895) cause or expose (a)? Neither: it adds no wait and writes no status.

### (b) Later attempts abandoned the saved Flow (fixed, two parts)

**Gate (`run-acts/run-gate.ts`, `not-arisen.ts` header).** The run gate refused the carried composer press but said nothing of an act done. So `not-arisen` did not pass over the step typing into the composer's form, and that step failed four times with `target_not_found`.

Now a refused carried act always says `skipped: "already_done"`. Every act the gate can refuse is declared, claimed, or held on repeat.

**Classification root (domain `stable-handles.ts`, content `dom-snapshot.ts`).** The composer press should never have been held:
- It first closed "Turn on notifications?".
- The composer's dialog opened where that dialog had stood.
- Tier 3 of the handle allocator gave the new dialog the old one's handles (t334, t335).
- The change walk then said `"Create post" reads`, and Core took that as "changed something that stays".

The content-harness probe reproduced this on dev's code. t896's click change did not contribute.

The fix:
- Snapshots carry `nodeToken`, a WeakMap serial per document, through sanitize, capture and structure-detect into `binding.nodeTokens`.
- Within one document, a layer root's number (dialog or cover) goes only to the layer it was last seen as.
- Ordinary controls keep today's tiers. Applying the guard to all elements would break fixtures that redraw a control on a new node: auction's header counter, job-board's cloned fields, local-classifieds' Apply. The worst case is a double act (auction's Watch would lose its "rose" signal).

The rejected alternative (LAYER_KINDS in the statement) is not applied.

### How a replay over an act already done ends (the brief's question)

The rule applied: S9 together with "judge the change".
1. The act is not pressed again.
2. Steps whose page never came are passed over.
3. The run reaches its end.
4. It is judged once against the change. The answer is `done_on_site`, "nothing changed this time".

Once the Flow is proven whole, later replays stand on their record. No path ends silently.

### S9 verdict persisted (point 5, done)

The verdict is either `{stood:true}` or `{stood:false, deviation}`. It is written to:
- the attempt row (`attempt-store/record.ts`, strict read in `attempt-store/replay-verdict.ts`);
- the outcome (`AutomationStudioTaskOutcomeReplay` and the closed `AUTOMATION_STUDIO_TASK_REPLAY_DEVIATIONS` in `api-contracts/automation/task-attempt.ts`);
- the step files, as a note written from `completion/check.ts`;
- the Lab's `attempt.json` `replay` and an `attempt-report.txt` line "Replay of attempt N".

The barrel import is fixed. There is no import between attempt-store and completion; both read the contract.

## Live Post proof: `run-mwbadi79-d928f922` (Haiku, $0.020, passed)

| attempt | path | calls | answer | replay verdict |
| --- | --- | --- | --- | --- |
| 1 | explore | 10 (interp 1, judge 1, decisions 8) | right | none |
| 2 | run_flow | 1 judge | right | judged: flow_not_proven |
| 3 | run_flow | 1 judge | right | judged: act_not_done |
| 4 | run_flow | 1 judge | right | judged: act_not_done |

All continuations held. The run wrote 45 step folders in `lab-runs/2026-11-10/run-mwbadi79-d928f922/steps`; `run-mwb5cnxg` had 49.

Presses:
- **Attempt 1:**
  - composer opener pressed once, answered;
  - Post's first press settled unchanged (the 450 ms trap) and was pressed once more inside the command (t896);
  - the site recorded one group-post, and the post appeared.
- **Attempts 2–4:**
  - the cookie step s2 ended by state route (banner absent);
  - the composer opener was pressed once;
  - the text was typed;
  - Post was NOT dispatched (already done);
  - no group-post request; the post count stayed 1.

What the user saw is this reopened, unsent composer with the chat card "Click · Post — Done" (that wording is D1). It is not the trap, and not the old misclassification.

## Remaining items (diagnosis so far)

- **`act_not_done`:** the engine marks any press passed over as "not done", because the domain floor says every press commits (`step-skip/act-not-done.ts`). The consent step is a saved `interruption`, so its absence is the accepted page.
  - The fix, in `flow-run/steps-ran.ts`: when the saved step is an interruption with no claimed act, an absent target reads as `absent`.
  - A step that does a person's act keeps `absent_not_done`.
  - Untested.
- **D2:** the panel reads attempts on its own cycle (`panel/chat/transport/ports/results/results-port.ts`), so the card draws after the turn ends.
  - The Lab's `pictureOfAnswer` reads once with no wait. Only the scoring's chat port waits (30 s), and only when records or asked acts are judged.
  - Attempt 1 got the wait; attempts 2–4 did not.
  - Proposed fix: the evidence read waits up to the same draw window on every attempt. Prove it on dining's or Post's later attempts.

## Checks run on the landed tree state (observed)

- **Core:**
  - vitest `answer-first` (run-acts included) + `runtime/conversations` + `engine/automation/state-routing` + `task-attempt-wiring`: 184 files, 1320/1320.
  - `NODE_OPTIONS=--max-old-space-size=6144 npx tsc -p tsconfig.json --noEmit`: exit 0.
  - Structure audit: passed (530 warnings).
  - Library rebuild: exit 0.
- **Domain:**
  - `domain check`: exit 0.
  - Tests `stable-handles press-effect sanitize page-view`: 240/240.
  - With the guard disabled, the two layer cases fail; restored.
- **Extension:**
  - `extension check`: exit 0 (after keeping `nodeToken` off `WireElementTarget`).
  - `test-runner check` and build: exit 0; follower tests 15/15.
  - Content harness `replaced-dialog-change.spec.ts`: 2/2. With the guard off, case 1 fails with the false `{"words":"Create post","how":"reads"}`.
  - Content harness `evidence snapshot-fidelity press-answers`: 76 passed.
  - Unit `gateway-payloads dom-element`: 21/21.
  - Extension structure audit: passed.
- **Reproduction tests that fail before their fixes:**
  - `flow-run/tests/replay-over-done-act.test.ts`: `run_flow_then_explore` before the gate fix; passes after, with verdicts `flow_not_proven`, then stood.
  - The follower case against t896's compiled follower stops at `waiting_for_person`/`permission`.

## Not verified

- A full content-harness and extension unit suite run. The full suites wait for the twice-daily sweep.
- The steps-ran interruption fix and the D2 fix (neither written into the tree).
- Dining at `--attempts 4`.
