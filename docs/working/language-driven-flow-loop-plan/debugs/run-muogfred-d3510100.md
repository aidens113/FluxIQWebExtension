# Run debug — `run-muogfred-d3510100` (t193 run 33)

## Header

- Run id: `run-muogfred-d3510100`
- Scenario / variant / task: social-network-feed / `regrouped` (armed after the build) / `social-network-feed-group-post-regrouped-after-creation`
- Command (from the t193 tree, launched once by the lead, scratchpad `t193/live-run-b.sh`):
  `FLUXIQ_LAB_INSTANCE=t193-slot-2 FLUXIQ_BUILD_PROGRESS_TRACE=1 FLUXIQ_LAB_KEEP_RUN_STATE=1 node scripts/lab/run-lab.mjs run social-network-feed --live-llm --llm-profile production --llm-provider deepseek --llm-model deepseek-flash --llm-task create-flow --instruction-task social-network-feed-group-post-regrouped-after-creation --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-calls 64 --llm-max-cost-usd 0.25 --evidence events --replays 2`
- Why it was started: first run of this task by lane B, on the tree after dev's merge (6ea4fbea); to see the build and the ladder on a redesign that replaces a control with a differently named one. The Lab guard admitted it (`live-guard admitted`, ledger start 18:44:24Z).
- Date, provider, model: 2026-09-30 18:44:37Z-18:49:01Z, deepseek, deepseek-flash
- Provider calls, tokens, cost: 16 calls (15 loop), 194,179 in / 1,673 out, **$0.0279** (`snapshots/live-llm.json` observed)
- Verdict as reported: `failed`, "FluxIQ asked for permission after building a Flow from the task's instruction (permission.required: send_or_publish)"; `flowCreated: false`, `stoppedAt: build`, build outcome `permission_required` (`flow_bootstrap.permission_required`, stage review)
- **Stage reached: 2** (exploration). No Flow was saved, so nothing ran on the variant.

## Stage 1 — the instruction and the expected chain

- Instruction: "Post this in the Riverside Allotment Society group, word for word: "Spare rhubarb crowns at plot 14, free to anyone who can collect them this weekend. Bring a bag!" Then make sure it is waiting for the group's admins to approve it."
- Expected chain (lane report, written before the run): open the group (left rail shortcut "Riverside Allotment Society", or Groups); press "Write something..." (the group's prompt, by test id); type the exact text; Post; confirm the group's pending-approval box. After the variant (`regrouped`) the prompt is gone and Create post / Create poll / Create event stand in its place: the repair must re-point at Create post, never Create poll.
- Wrong-but-plausible: posting the text on the home feed ("What's on your mind, Maya?"), or a poll.

## Stage 2 — exploration

From `logs/core.log` (build trace) and `flow-lane.json` `build.evidenceLoop.steps` / `declaredConsequences`:

| # | Decided | Action and parameters | Result |
| --- | --- | --- | --- |
| 0 | (initial look) | capture snapshot | `rejected.not_at_start_location` |
| 1 | tool | navigate to the start address | succeeded |
| 2 | tool | click "Decline optional cookies" | succeeded |
| 3 | tool | click "What's on your mind, Maya?" (the **home feed** composer) | succeeded (Create post dialog, audience Friends; screenshot 00008) |
| 4 | tool | type the text into "What's on your mind, Maya?" | `rejected.output_not_observed` (typed at the button) |
| 5 | tool | click "What's on your mind, Maya?" again | succeeded |
| 6 | tool | type the text into the textbox | succeeded |
| 7 | tool | click "Post" (send_or_publish) | `rejected.permission_required` / `consequences_not_granted` after **121.7 s** waiting for a person; nobody answered |
| 8 | complete `->d7,->d8` | completion check ok; dry runs replayed from a reset (6 steps, step 3 `unreproducible` 6.8 s) | `dry_run_refused` |
| 9 | amend `3:optional, 8:keep` | - | draft amended |
| 10 | complete `->d8` | dry run replayed again from the reset (step 3 `unreproducible` 7.0 s) | refused `bootstrap.instructed_act_missing a1:step_changed_nothing` |
| 11 | tool | click (not named in the trace) | succeeded |
| 12 | tool | click "Edit privacy. Sharing with Friends." (the post's audience) | `rejected.target_unobserved` / `handle_not_in_packet` |
| 13 | amend `9:drop` | - | draft amended |
| 14 | complete `a1>d8` | - | refused `instructed_act_missing a1:step_changed_nothing` |
| 15 | complete `a1>d7` | completion check ok | build ends `permission_required` |

- Repeats: the composer was pressed twice (3 and 5), and the draft kept both presses (s3, s4).
- Rejections: iteration 4's `output_not_observed` was enough to route (the model pressed the composer again and typed into the textbox). Iteration 12's `handle_not_in_packet` said the audience control was not in the packet.
- Context: every page packet was about 5-8 KB against the 6,000-byte packet budget, and the draft reached 3,800 of its 4,000-byte budget by iteration 13. Whether the rail's "Riverside Allotment Society" link was in any packet is NO EVIDENCE: packets are kept as byte counts only.

## Stage 3 — the proposed Flow

- No Flow was saved (`authoredNodes: null`). The last draft (from `declaredConsequences`, `main.s1..s6`): s1 open the start address; s2 press "Decline optional cookies"; s4 and s5 press "What's on your mind, Maya?"; s6 enter the text into "What's on your mind, Maya?"; the Post press (d7) stayed a refused attempt. The kept workspace is `test-runs/instances/t193-slot-2/.work/run-muogfred-d3510100/`; its real parameters were not needed for the causes below.
- Divergences from Stage 1:
  - The group is never opened: the whole draft posts on the home feed. Misread the instruction or the page (the group link is on screen in the left rail, screenshot 00003).
  - The composer press is kept twice: a transcript of the steps taken, not an authored Flow.
  - No pending-approval check.

## Stage 4 — replay

- Not reached: no Flow, so no playback on the variant and no `--replays`. Provider calls during replay: none.
- The build's own dry runs: two, each from a reset ("dryrun.N.reset go to"), each replaying the draft from its first step; draft step 3 was `core.replay.unreproducible` twice (6.8 s, 7.0 s).

## Stage 5 — the answer

- Not reached. The goal (the group's pending box holding the text) was never produced; the post would have gone to the feed.

## Stage 6 — judgement and repair

- **Why no repair triggered: no Flow ran.** The build stopped at the Post press to ask a person (`permission_required`, `send_or_publish`), waited 121.7 s, then the model completed the draft around the refused press and the build ended `permission_required` at review. The Lab stops a run there (`stoppedAt: build`, `flowCreated: false`), so the variant was never armed, nothing failed at run time, and the failure entry point (patch ladder, re-author) had nothing to repair.
- The ask itself is correct by the standing rule (money, delete and send/publish ask every time, even when instructed). The run was launched without the person's up-front permission: the Lab has `--llm-permit send_or_publish` (`packages/test-runner/src/commands.ts:310-324`) and the task declares no `permissionPoint` (`apps/scenario-lab/src/scenarios/live-instructions.ts:41-53`). With the honest verdict, a permission stop is never a pass, so this task can pass only if the person's answer is given: launched with `--llm-permit send_or_publish`, or the Lab plays the person answering "Allow" as it plays the robot check. Not verified live (Lab runs are stopped).
- Even with permission, this build would have posted on the feed, not in the group, and claimed act a1 with d7.

## Causes

| # | Cause, precisely | Repo and file | Fix | Owner |
| --- | --- | --- | --- | --- |
| 1 | The run carried no permission for the publish the instruction asks for; the build waited 121.7 s for an answer nobody gives and stopped `permission_required`. | Lab launch (`--llm-permit`), task definition `social-network-feed/live-tasks.ts:36` | Launch publish tasks with `--llm-permit send_or_publish`, or have the Lab answer the ask as the person (decision for the supervisor) | t193 (launcher); Lab-answer design: supervisor |
| 2 | The model posted from the home feed composer ("What's on your mind, Maya?") instead of opening the Riverside Allotment Society group. | build loop (model), page evidence | Unknown until the packet contents are visible; if the rail link was cut from the packet, that is the element cap | t200 if capped; otherwise build lane (t174) |
| 3 | The draft is a transcript: the composer press kept twice (s4, s5). | Core draft authoring | - | owned by t196 |
| 4 | Dry runs replayed the draft from a reset and its first step, twice (about 26 s), mid-build. | Core `flow-draft/dry-run.ts` | - | owned by t196 |
| 5 | Page packets at the 6,000-byte budget and a 4,000-byte draft budget nearly full. | extension capture, domain packet | - | owned by t200 |
| 6 | The completion claimed a1 (post) with d7, a press that was refused and changed nothing, and was accepted at iteration 15 after two `step_changed_nothing` refusals. | Core `flow-bootstrap/instructed-acts/check.ts` | - | t174 (instructed acts) |

## UI review

Screenshots read: `00003` (mid-build), `00008` (the permission ask), `00013` (after the ask), `00018` (end). The panel is the pre-t191-round-2 UI (the new UI was merged into this tree after the run).
- Simple/Advanced toggle still shown; the panel is split, a "Get set up" card above the chat (00003-00018).
- "To do: Add an AI model key" while a keyed build runs (all four).
- Raw internal wording: "Using core.run_node" in the panel and the overlay pill (00008, 00013); "The instruction asks for create_new, and none of this run's 40 actions said it would cause that; 39 of them said they would cause nothing lasting. Apply it as it stands?" (00018).
- Contradictory status: the header says "Flow ready" (00018) for a build that stopped to ask permission and saved no Flow.
- The permission ask (00008) is clear ("... click "Post" (button), which would send or publish ... Allow / Don't allow"), but "FluxIQ stopped waiting for an answer." (00013) gives no next step.
- The on-page overlay pill is visible bottom left while working (00003, 00008, 00013) and covers the rail's lower entries.

## Instrumentation gaps

- The model's page packets are recorded only as byte counts, so cause 2 cannot be split into "not shown" and "misread".
- Iteration 11's click has no control name in the declared list.
