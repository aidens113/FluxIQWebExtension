# Run debug — `run-muq05kas-058193f0`

t193 lane B, session 4, run 35. The supervisor killed the run during a DeepSeek outage. Debugged by the lead from:

- the run log `scratchpad/t193/run35.log`;
- the Core log `test-runs/instances/t193-slot-2/.work/run-muq05kas-058193f0/logs/core.log` (the build trace);
- the decision dumps `decision-dumps/build-2026-10-01T20-47-36-063Z-32824.jsonl` and `build-2026-10-01T20-53-37-941Z-32824.jsonl`;
- the staging bundle `.staging-run-muq05kas-058193f0/` (29 events, 9 screenshots);
- the UI review `run-muq05kas-058193f0.ui-review.local/` (23 moments);
- the spend ledger.

The run was killed, so there is no `evaluation.json` and no `snapshots/live-llm.json`.

---

## Header

- Run id: `run-muq05kas-058193f0`.
- Scenario / variant / task: `bigbox-retail` / `redesigned-buy-box` / `bigbox-retail-pickup-cart-redesigned-after-creation`.
- Command: `scratchpad/t193/live-run-b.sh bigbox-retail bigbox-retail-pickup-cart-redesigned-after-creation …/run35.log` (session `58ff9269`).
  - It used the direct `generate-flow-bootstrap-adaptation` request, before the user's chat-only rule.
  - Trees: downstream `30b90670` (B1 wired) and Core `aafc5e86`.
- Date, provider, model: 2026-10-01, launched 20:42:46Z.
  - Prelude: 88.5 s, rebuilding scenario-lab, domain, extension and test-runner.
  - Live guard admitted the run; loop start 20:47:36Z.
  - DeepSeek `deepseek-flash`, profile `production`; Chromium, side panel verified open.
- Provider calls, tokens, cost:
  - 10 decision requests were sent, and the run was killed while the 10th was waiting. Not one was answered.
  - No usage was reported, so the input tokens per call are unknown: **B1 and W2 could not be measured on this run**.
  - The ledger holds only the `start` line (`launch-muq05gmc-ab980710`), with no `finish` line, so the spend is not recorded. Nothing answered means nothing was billed by usage.
- Verdict as reported: none. The supervisor killed the run at about 20:54:47Z (`exit=1`).
  - Cause: a DeepSeek outage. A 5-token request was accepted in 0.47 s, but no body arrived in 150 s, and status.deepseek.com returned 502.
- **Stage reached: 1.** No decision came back, so exploration never started.

## Stage 1 — the instruction and the expected chain

Unchanged from run 34; see `debugs/run-mup2i28c-6c7fc209.md`, Stage 1.

## Stage 2 — exploration

| # | What it was asked | What it decided | Action and parameters | Result |
| --- | --- | --- | --- | --- |
| T0 | (Core's opening look) | -- | `initial.core.run_node` `web.output.dom-capture_snapshot` | `web.action.rejected.not_at_start_location`, 1,648 ms (as designed: arrival is set only by a navigation the build makes) |
| D1 | the opening refusal plus the draft | nothing came back | -- | `decide throw ms=45070 AutomationStudioLlmUnusableDecisionError issues=llm.provider_timeout` |
| D2-D8 | the same, plus a refusal note for each "unusable decision" | nothing came back | -- | `llm.provider_timeout` each time, at 45,024, 45,016, 45,008, 45,010, 45,013, 45,014 and 45,019 ms |
| (round 2) | -- | -- | -- | 20:53:37.941Z `loop start`. After 8 unusable decisions the round "stalled". The build phases read a stalled round with an empty Flow as "Exploring again" and started round 2 |
| T0' | (opening look again) | -- | as T0 | `not_at_start_location`, 1,230 ms |
| D1' | -- | nothing came back | -- | `llm.provider_timeout`, 45,181 ms |
| D2' | -- | waiting at the kill | -- | started 20:54:24.357Z |

- Repeats, and what the loop believed was progress:
  - Each timeout was treated as **the model's** unusable decision.
  - The model was told its decision could not be used, but it had made none.
  - Each timeout counted toward the unusable-decision guard (8), not toward anything that recognises an outage.
- Rejections and refusals received: only T0's `not_at_start_location`, which said enough.
- Context: not measurable. No request body was answered, and the dumps hold only the T0 tool rows (dump: one `tool` line each).

## Stage 3 — the proposed Flow

None: no decision ever came back.

## Stage 4 — replay

Not reached.

## Stage 5 — the answer

Not reached.

## Stage 6 — judgement and repair

- Judged: no.
- The build ended neither "finished" nor "not doable".
  - It retried a dead provider for 6 minutes and then began a second round of waits.
  - It never told the person why.

## UI review

| Moment | Panel |
| --- | --- |
| `03-mid-build-panel.png` | "Looking at the page" twice as bare bold headings, then the live line "Building your Flow · Thinking about the next step". |
| `23-mid-build-panel.png` (about 7 minutes in) | The same two headings. Then "**Exploring again** — Nothing is in the Flow yet, and all 6 of the things you asked are still to do. Exploring on from the page as it stands." Then two more bare "Looking at the page" and the same "Thinking about the next step". |

- Overlay: stable, 16/16 visible at every moment, and it said nothing about the outage.
- Defects, one line each:
  - **U-P1 (fixed here, P1 below):** "Thinking about the next step" stood for the whole outage, about 7 minutes in 23 moments. Nothing said that the provider was not answering, or that requests were being retried.
  - **U-P2 (fixed here, P1):** "Exploring again" told the person the build was exploring when it was waiting on a dead provider.
  - **U1 (still open, owner extension):** the person's instruction is not shown as their message.
  - **U1 (still open, owner extension):** "Looking at the page" appears as a bare heading twice per round. The second one has no step behind it.

## Causes

| # | Cause, precisely | Repo and file | Fix | Task id |
| --- | --- | --- | --- | --- |
| P1 | **A provider timeout was an "unusable decision".** `llm.provider_timeout` is a spent call (`failure-disposition.ts`), so `automationStudioLlmUnusableDecisionError` wrapped it. The loop's catch then sent it to `refuseDecision`: it told the model, asked again, and counted it on the unusable guard (8). The stall made `phases.ts` start another round for an empty Flow, and nothing told the person | Core `R/llm/evidence-loop.ts` (catch), `R/flow-bootstrap/unfinished-build/{phases.ts, round-ending.ts}`, `R/activity/observer.ts` (no row closed on a failed decide) | Count unanswered calls (timeout, network, 5xx, 429) apart. Say nothing to the model. Three in a row end the loop as `llm_evidence_loop.provider_unavailable`. The build then ends at once, with no test and no further round, as `flow_bootstrap.provider_unavailable`, with a plain message. Each unanswered call closes its "Deciding" row and is said in words. **Done, Ready to commit (fix log P1)** | t193 |
| D | DeepSeek outage (502, bodies never sent) | external | none: no Lab while the provider is down | -- |

## Instrumentation gaps found

| Stage | What could not be answered | File that drops it |
| --- | --- | --- |
| header | The run's cost: the ledger keeps no `finish` line for a killed run, and the provider reported no usage | the Lab's spend ledger writer (no finish on kill) |
| 2 | The size of each unanswered request: estimated input tokens are logged only on a returned decision (`decide end`), not on a throw | Core build trace (`evidence-progress/progress-trace.ts`) |
