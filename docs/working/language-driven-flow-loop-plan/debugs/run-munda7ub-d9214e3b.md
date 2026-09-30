# Run debug — `run-munda7ub-d9214e3b`

Worker t174-w4, 2026-09-30. Read from the bundle at
`test-runs/instances/t174-slot-1/run-munda7ub-d9214e3b` in the t174 worktree, and from the
lane report `reports/t174-live-lane.md` (Runs row 7, "Fix 2"). No product code changed, and no
Core source was read. File references below are relative to the bundle unless they say
otherwise. **Shown** marks what an artifact records; **Inferred** marks a conclusion drawn from
it.

---

## Header

- Run id: `run-munda7ub-d9214e3b` (t174 run 7)
- Scenario / variant / task: `crossborder-marketplace` / none / `crossborder-marketplace-hub-to-cart`
  (`form`, judged by playback goal `hub-in-cart`) (`snapshots/flow-lane.json` `task`).
- Command: NO EVIDENCE. The bundle does not record the Lab command line (`run.json` has ports,
  commits and extension path only).
- Builds: facility `82a20780` dirty, Core `259a11ba` dirty, extension sha256 `6556c1ff…`
  (`run.json`). No `logs/core-web-build.log` in this bundle, and `run.json` `processExits` has no
  `core-web-build` entry, so this run did not rebuild Core's web app.
- Date, provider, model: 2026-09-30 00:28:33.977Z to 00:32:44.870Z (`summary.json`), DeepSeek,
  `deepseek-flash`, profile `production`, grant 48 calls, $0.25 per call, $2 total, 25,000 ms
  timeout (`snapshots/live-llm.json` `granted`).
- Provider calls, tokens, cost: **the bundle claims 0 calls** (`evaluation.json` `llm.calls: 0`;
  `snapshots/flow-lane.json` `build.providerCalls: 0`, `providerInvocation: "not_attempted"`,
  `accounting: null`). `logs/core.log` shows **22 `decide` round trips** (00:29:20.067 to
  00:32:32.769), each 3,116 to 16,513 ms, which are provider calls. Tokens and cost: NO EVIDENCE
  (dropped with the accounting).
- Verdict as reported: failed, `runtime.behavior` (`evaluation.json`), "Live LLM run reached no
  provider … Core made none" (`summary.json` `firstFailure`, `events.ndjson` seq 3 at
  00:32:43.154Z). That message is false: see stage 2.
- Durations: run 250,569 ms (`evaluation.json`); build 207,966 ms (`snapshots/flow-lane.json`
  `build.durationMs`); Lab dispatch 00:29:04.679Z (`events.ndjson` seq 1) to loop start
  00:29:19.477Z (`logs/core.log`), 14.8 s.
- **Stage reached: 2 (exploration).** Three completions were refused, then the build ended on an
  unrecognised throw. No Flow was created (`evaluation.json` `flowCreated: false`), and nothing
  was replayed as a Flow, answered or judged.

## Stage 1 — the instruction and the expected chain

- Shown: the instruction is 219 characters, sha256 `2e6f5e7d…a405` (`snapshots/flow-lane.json`
  `task.instruction`). Its body is not copied here (privacy rule).
- The expected node chain lives in the scenario source
  (`apps/scenario-lab/src/scenarios/crossborder-marketplace/`), which was outside this brief and
  not read. Stage-by-stage divergence from the expected chain is therefore not given here.

## Stage 2 — exploration

From the `[FluxIQ build-trace]` lines in `logs/core.log`. Draft positions use the numbering the
run 6 debug established (every tool_call decision takes a position, including one answered from
memory; `dryrun.<attempt>.<position>`). **Inferred:** with that numbering, dry run 1's
`dryrun.1.9` and `dryrun.1.10` land exactly on `extract1` and `nav6`, so the numbering fits this
run too.

| It | Pos | Decision (ms) | Call id / tool | Result (tool ms) | core.log time |
| --- | --- | --- | --- | --- | --- |
| 0 | 1 | (initial, Core's) | `initial.core.run_node` / `core.run_node` | `web.inspect.succeeded` (187) | 00:29:19.872 |
| 1 | 2 | tool_call (4,882) | `nav1` / `core.run_node` | `web.action.succeeded` (2,706) | 00:29:27.852 |
| 2 | 3 | tool_call (6,221) | `detect1` / `web.detect_repeating_structure` | `web.structure.detected` (613) | 00:29:35.039 |
| 3 | 4 | tool_call (7,276) | none run | answered from memory: `decide start iteration=4` follows 1 ms after `decide end iteration=3`, with no `tool start`. Which answer it got is NO EVIDENCE | 00:29:42.431 |
| 4 | 5 | tool_call (8,517) | `nav2` / `core.run_node` | `web.action.succeeded` (2,570) | 00:29:53.685 |
| 5 | 6 | tool_call (8,634) | `nav3` / `core.run_node` | `web.action.succeeded` (2,519) | 00:30:05.012 |
| 6 | 7 | tool_call (5,558) | `nav4` / `core.run_node` | `web.action.succeeded` (2,448) | 00:30:13.322 |
| 7 | 8 | tool_call (4,850) | `nav5` / `core.run_node` | `web.action.succeeded` (2,304) | 00:30:20.505 |
| 8 | – | amend_draft (5,459) | – | content NO EVIDENCE | 00:30:25.981 |
| 9 | 9 | tool_call (4,682) | `extract1` / `core.run_node` | `web.inspect.succeeded` (11,166) | 00:30:42.858 |
| 10 | – | amend_draft (16,513) | – | – | 00:30:59.382 |
| 11 | – | amend_draft (4,890) | – | – | 00:31:04.274 |
| 12 | – | **complete #1** (7,916) | – | refused `bootstrap.invalid_subflows`; no dry run logged | 00:31:12.202 |
| 13 | – | **complete #2** (6,697) | – | refused `bootstrap.invalid_subflows`; no dry run logged | 00:31:18.903 |
| 14 | 10 | tool_call (15,254) | `nav6` / `core.run_node` | `web.action.succeeded` (2,424) | 00:31:37.645 |
| 15–18 | – | amend_draft ×4 (10,037 / 5,213 / 3,116 / 3,213) | – | 4 amendments in a row | 00:31:47.762–00:31:59.310 |
| 19 | – | **complete #3** (5,109) | – | refused `bootstrap.instructed_act_missing` (00:32:04.450). Then dry run 1: `dryrun.1.reset` `core.replay.replayed` (1,269), `dryrun.1.9` `core.replay.replayed` (11,045), `dryrun.1.10` `core.replay.replayed` (1,292) | 00:32:04.450–00:32:18.057 |
| 20 | 11 | tool_call (4,036) | `nav7` / `core.run_node` | `web.action.succeeded` (2,366) | 00:32:25.553 |
| 21 | – | amend_draft (3,831) | – | – | 00:32:29.400 |
| 22 | 12 | tool_call (3,366) | `act1` / `core.run_node` | **`web.action.rejected.target_not_found` (10,320)** at 00:32:43.102. Then no `decide start iteration=23` line; the log's next line is the process `[exit] code=1` at teardown | 00:32:43.102 |

Totals (shown): 22 decisions = 11 tool_call (10 executed, 1 answered from memory) + 8
amend_draft + 3 complete. 11 tools executed including Core's initial inspect. Decision latency
3,116 to 16,513 ms.

- **Repeats.** Seven `nav*` calls, all `web.action.succeeded` in 2.3 to 2.7 s. The call ids are
  the model's own names; the trace records only `toolId=core.run_node`, so that they were
  navigations is **inferred** from the ids, not shown. 8 of 22 decisions (36%) were amendments,
  4 of them in a row after completion #2.
- **Rejections.** One: `act1`, `web.action.rejected.target_not_found`, the last tool of the
  build, 10,320 ms. It is the only action in the run that did not succeed.
- **Completion dry runs.** Only completion #3 is followed by a dry run in the log. **Inferred:**
  completions #1 and #2 were refused on `invalid_subflows` before any dry run. At completion #3
  the draft proposed 2 steps (positions 9 and 10), both replayed cleanly.
- **Context eviction or truncation:** NO EVIDENCE (`snapshots/flow-lane.json`
  `evidenceLoop: null`; the loop trace is not stored for a failed build).

### The end of the build: an unrecognised throw

- Shown: `act1` ends at 00:32:43.102 (`logs/core.log`). The Lab records the failure at
  00:32:43.129Z (`provider-failures.local.json` `records[0].at`), 27 ms later, and the build
  settles at 00:32:43.139Z (`events.ndjson` seq 2), 37 ms later.
- Shown, failure record (`provider-failures.local.json`, codes only): Core HTTP 400;
  `code: flow_bootstrap.pre_provider_validation_failed`, `stage: pre_provider_validation`,
  `providerInvocation: not_attempted`, `providerResponse: not_received`, `retryable: false`.
  The diagnostic has **no `issueCodes` field**; `provider.thrown` and `provider.body` are null.
  Same code and stage in `snapshots/flow-lane.json` `build.failure` and
  `events.ndjson` seq 2 `llmGate` (`invoked: false`).
- Report (`reports/t174-live-lane.md`, "Fix 2"): the throw is `llm/evidence-loop/draft-shown.ts`
  refusing a packed draft entry holding a row shown as `did_not_work`
  (`"Cannot measure malformed or unknown packed draft shape"`), rethrown before the next
  `decide start`. The report reproduced this for run 10 and assigns runs 6 and 7 to it by the same
  signature.
- **Inferred, consistent with that cause:** `act1` is the first and only refused action of this
  run, and the throw follows it immediately. A refused press is the row Fix 2 names
  (`did_not_work`). Whether the draft was packed at that point (over 4,000 bytes) is NO EVIDENCE
  here: draft size is not traced.

## Stage 3 — the proposed Flow

No Flow was created (`evaluation.json` `flowCreated: false`, `snapshots/flow-lane.json`
`flowShape: null`, `authoredNodes: null`).

- Completion #1 and #2: refused `bootstrap.invalid_subflows`. Which subflow rule failed is NO
  EVIDENCE (the trace prints issue codes only).
- Completion #3: refused `bootstrap.instructed_act_missing`. The dry run shows the draft held 2
  steps, positions 9 (`extract1`, an inspect) and 10 (`nav6`). **Inferred:** no step that acts on
  the page beyond a navigation was kept, which fits an instructed act having no step. Which act
  was missing is NO EVIDENCE (`missingActs` is not traced).
- Classification: the build did not reach the act the task asks for until iteration 22
  (`act1`), and that act's target was not found. Why it was not found is NO EVIDENCE (the target
  parameters are not in the bundle).

## Stage 4 — replay

Not reached; no Flow. The one dry run (completion #3) is the only replay:

| Node | Executed | Produced | Duration | Retries |
| --- | --- | --- | --- | --- |
| dry run 1 reset | yes | `core.replay.replayed` | 1,269 ms | – |
| pos 9 `extract1` | yes | `core.replay.replayed` | 11,045 ms | NO EVIDENCE |
| pos 10 `nav6` | yes | `core.replay.replayed` | 1,292 ms | NO EVIDENCE |

Provider calls during replay: none (`core.run_node` only).

## Stage 5 — the answer

Not reached. No Flow run (`snapshots/decision-trace.json` `runs: []`; `evaluation.json`
`actions: []`).

## Stage 6 — judgement and repair

Not reached. No Flow, verification, repair or persistence (`snapshots/flow-lane.json`
`resultVerification: null`, `route: null`).

## Causes

| # | Cause, precisely | Repo and file | Fix | Status / owner |
| --- | --- | --- | --- | --- |
| 1 | The build ended on an unrecognised throw 27 ms after the refused `act1`, before iteration 23: `draft-shown.ts` refused a packed draft row shown as `did_not_work` (report, "Fix 2"; attribution to this run is by signature). | Core `runtime/llm/evidence-loop/draft-shown.ts` | The reader accepts every shown disposition (`SHOWN_DISPOSITIONS`, including `did_not_work`) and still fails closed on anything else; tests `llm/evidence-loop/tests/draft-shown.test.ts` 16/16, `llm/tests/evidence-loop-draft-shown.test.ts` 8/8 (report, "Fix 2"). | **Fixed** in Core (t174). Not yet seen in a live run. |
| 2 | The throw was filed `flow_bootstrap.pre_provider_validation_failed` / `not_attempted` with no issue codes after 22 decisions, so the Lab wrote "Core made none", which is false. | Core `flow-bootstrap/generation-failure/*`, `runtime/service.ts` | `generation-failure/thrown-issue-codes.ts` publishes `thrown.<Class>` and `thrown.at:<file>:<line>`; `service.ts` passes the error and moves the running stage to `provider_output_validation` after a decision returns (report, Runs row 7). Run 10 shows it working: `provider_output_validation_failed`, `attempted`, `issueCodes: ["thrown.Error"]`. | **Fixed** (t174). The frame code needed `--enable-source-maps` for Next's bundle (report, "Fix 2", `packages/test-runner/src/core-web-build/server-process.ts`), not yet seen live. |
| 3 | Completions #1 and #2 refused `bootstrap.invalid_subflows`. | Core (completion checks); exact rule NO EVIDENCE | None yet. | **Open.** Listed in the report's "Exact next step" 3 for crossborder; no owner named there, routed by the supervisor. |
| 4 | Completion #3 refused `bootstrap.instructed_act_missing`: the draft kept only an inspect and a navigation. | Core `runtime/flow-bootstrap/instructed-acts/` | None yet. | **Open.** The report names t189 and t175 for the bigbox form of this refusal; for crossborder no owner is named, routed by the supervisor. |
| 5 | `act1`, the build's first attempt at the task's act, was `target_not_found` after 10,320 ms. | Unknown; the target is not in the bundle | None. | **Open**, no owner named. Would show again only once cause 1's fix lets the loop continue. |
| 6 | A build that made 22 provider round trips reports 0 calls and `accounting: null`. | Core throw path (`snapshots/flow-lane.json` `build.accounting`) | None yet. | **Open**, no owner named (same gap as run 6). |

## Instrumentation gaps found

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2 | What iteration 3's tool_call asked for and which from-memory answer it got | Core `llm/evidence-loop/progress-trace.ts` (traces `executeTool`, not the from-memory answer) |
| 2 | Which node kind each `core.run_node` call ran (`nav*` is only the model's name) | `progress-trace.ts` logs `toolId` and `resultCode` only |
| 2 | What each of the 8 `amend_draft` decisions changed | `progress-trace.ts` logs only `kind` |
| 2 | Draft size at each decision (whether it had been packed when `act1` was refused) | `draftShown` lives in the loop trace, not stored for a failed build |
| 3 | Which subflow rule `invalid_subflows` named; which act `instructed_act_missing` named | `progress-trace.ts` prints issue codes only |
| 3 | `act1`'s target (why it was not found) | a failed build stores no draft; the Lab deletes the Core store with the run |
| header | Calls, tokens and cost of the 22 decisions | the throw path returns `accounting: null` |
| header | The Lab command line | `run.json` |
| end | The throw's class and frame | no `issueCodes` on this build (before the t174 naming fix) |
