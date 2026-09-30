# Run debug — `run-mune0xh1-2470406a`

Worker t174-w4, 2026-09-30. Read from the bundle at
`test-runs/instances/t174-slot-1/run-mune0xh1-2470406a` in the t174 worktree, and from the
lane report `reports/t174-live-lane.md` (Runs row 10, "Fix 2"). No product code changed, and no
Core source was read. File references below are relative to the bundle unless they say
otherwise. **Shown** marks what an artifact records; **Inferred** marks a conclusion drawn from
it.

---

## Header

- Run id: `run-mune0xh1-2470406a` (t174 run 10)
- Scenario / variant / task: `crossborder-marketplace` / none / `crossborder-marketplace-hub-to-cart`
  (`form`, judged by playback goal `hub-in-cart`) (`snapshots/flow-lane.json` `task`).
- Command: NO EVIDENCE. The bundle does not record the Lab command line.
- Builds: facility `82a20780` dirty, Core `259a11ba` dirty, extension sha256 `6556c1ff…`
  (`run.json`), the same values as runs 8 and 9. Core's web app was rebuilt in this run
  (`logs/core-web-build.log`: Turbopack, "Compiled successfully in 53s", `[exit] code=0`;
  `run.json` `processExits.core-web-build: 0`).
- Date, provider, model: 2026-09-30 00:49:20.249Z to 00:52:50.406Z (`summary.json`), DeepSeek,
  `deepseek-flash`, profile `production` (`snapshots/live-llm.json`), grant 48 calls, $0.25 per
  call.
- Provider calls, tokens, cost: the Lab counts **1 call** (`evaluation.json` `llm.calls: 1`;
  `events.ndjson` seq 2 `calls: 1`, `llmGate.invoked: true`); `snapshots/flow-lane.json` has
  `build.providerCalls: null`, `accounting: null`. `logs/core.log` shows **17 `decide` round
  trips** (00:51:42.892 to 00:52:48.696), each 2,497 to 3,554 ms. Tokens and cost: NO EVIDENCE.
- Verdict as reported: failed, `runtime.behavior` (`evaluation.json`), "FluxIQ did not build a
  Flow from the task's instruction (flow_bootstrap.provider_output_validation_failed)"
  (`summary.json`, `events.ndjson` seq 3 at 00:52:49.113Z). Unlike run 7, this label is correct
  about the stage.
- Durations: run 209,930 ms (`evaluation.json`); build 69,574 ms (`snapshots/flow-lane.json`
  `build.durationMs`); Lab dispatch 00:51:33.325Z (`events.ndjson` seq 1) to loop start
  00:51:42.510Z (`logs/core.log`), 9.2 s.
- Pairing: this run paired and dispatched normally on the same builds as runs 8 and 9, whose
  pairing timed out (`events.ndjson` seq 1 is a `runtime.dispatch`). **Inferred** (and the
  report's conclusion): those timeouts were not a pairing regression in these builds.
- **Stage reached: 2 (exploration).** No completion was attempted. The build ended on an
  unrecognised throw right after tool call `c18`.

## Stage 1 — the instruction and the expected chain

- Shown: the instruction is 219 characters, sha256 `2e6f5e7d…a405`, identical to run 7's
  (`snapshots/flow-lane.json` `task.instruction`). Its body is not copied here.
- The expected node chain is in the scenario source, which was outside this brief and not read.

## Stage 2 — exploration

From the `[FluxIQ build-trace]` lines in `logs/core.log`. No dry run happened, so draft positions
cannot be checked against dry-run ids and are not given. Call ids are the model's own; the gaps
(`c5`, `c12`, `c13`, `c15`) are unexplained (NO EVIDENCE).

| It | Decision (ms) | Call id / tool | Result (tool ms) | core.log time |
| --- | --- | --- | --- | --- |
| 0 | (initial, Core's) | `initial.core.run_node` / `core.run_node` | `web.inspect.succeeded` (122) | 00:51:42.753 |
| 1 | tool_call (3,076) | `c1` / `core.run_node` | `web.action.rejected.target_unobserved` (131) | 00:51:46.240 |
| 2 | tool_call (2,497) | `c2` / `core.run_node` | `web.action.rejected.target_unobserved` (166) | 00:51:49.179 |
| 3 | tool_call (2,993) | `c3` / `core.run_node` | `web.action.succeeded` (1,741) | 00:51:54.204 |
| 4 | tool_call (3,453) | `c4` / `core.run_node` | `web.action.succeeded` (1,423) | 00:51:59.401 |
| 5 | tool_call (3,554) | `c6` / `core.run_node` | `web.action.succeeded` (1,640) | 00:52:04.803 |
| 6 | tool_call (2,787) | `c7` / `core.run_node` | `web.action.succeeded` (1,609) | 00:52:09.416 |
| 7 | tool_call (2,944) | `c8` / `core.run_node` | `web.action.succeeded` (1,630) | 00:52:14.162 |
| 8 | amend_draft (2,613) | – | content NO EVIDENCE | 00:52:16.863 |
| 9 | tool_call (2,769) | `c9` / `web.detect_repeating_structure` | `web.structure.detected` (418) | 00:52:20.161 |
| 10 | tool_call (2,857) | `c10` / `core.run_node` | `web.action.succeeded` (1,641) | 00:52:24.841 |
| 11 | tool_call (2,499) | `c11` / `web.detect_repeating_structure` | `web.structure.detected` (347) | 00:52:27.870 |
| 12 | tool_call (3,044) | none run | answered from memory: `decide start iteration=13` follows 1 ms later with no `tool start`; which answer is NO EVIDENCE | 00:52:30.996 |
| 13 | tool_call (3,049) | `c14` / `core.run_node` | `web.action.succeeded` (1,596) | 00:52:35.729 |
| 14 | amend_draft (2,793) | – | – | 00:52:38.621 |
| 15 | tool_call (2,906) | `c16` / `core.run_node` | `web.action.succeeded` (1,402) | 00:52:43.056 |
| 16 | tool_call (2,549) | `c17` / `core.run_node` | `web.action.rejected.target_unobserved` (107) | 00:52:45.940 |
| 17 | tool_call (2,647) | `c18` / `core.run_node` | **`web.action.rejected.target_unobserved` (116)** at 00:52:48.948. Then no `decide start iteration=18`; the log's next line is the process `[exit] code=1` at teardown | 00:52:48.948 |

Totals (shown): 17 decisions = 15 tool_call (14 executed, 1 answered from memory) + 2
amend_draft + 0 complete. 15 tools executed including Core's initial inspect: 9
`web.action.succeeded`, 4 `web.action.rejected.target_unobserved`, 2 `web.structure.detected`,
1 `web.inspect.succeeded`.

- **Rejections.** `c1` and `c2` (the first two actions) and `c17`, `c18` (the last two), all
  `target_unobserved`, each in 107 to 166 ms. After `c1`/`c2` the build went on to succeed with
  `c3`; `c17`/`c18` were back to back.
- **Decision latency** was steady at 2.5 to 3.6 s, lower than run 7's 3.1 to 16.5 s.
- **Context eviction or truncation:** NO EVIDENCE (`snapshots/flow-lane.json`
  `evidenceLoop: null`).

### The end of the build: an unrecognised throw

- Shown: `c18` ends at 00:52:48.948 (`logs/core.log`). The Lab records the failure at
  00:52:49.091Z (`provider-failures.local.json` `records[0].at`), 143 ms later; the build settles
  at 00:52:49.099Z (`events.ndjson` seq 2).
- Shown, failure record (`provider-failures.local.json`, codes only): Core HTTP 400;
  `code: flow_bootstrap.provider_output_validation_failed`, `stage: provider_output_validation`,
  `providerInvocation: attempted`, `providerResponse: received`, `retryable: false`,
  **`issueCodes: ["thrown.Error"]`**. No `thrown.at:` code. `provider.thrown` and
  `provider.body` are null. `snapshots/flow-lane.json` `build.failure` and `events.ndjson` seq 3
  carry the same code and stage.
- So the t174 naming fix (report, Runs row 7) is visible here: the stage and invocation are now
  right and the class is named. The frame code is missing because Next runs Core from minified
  chunks whose paths `thrown-issue-codes.ts` cannot match (report, Runs row 10).
- Report (`reports/t174-live-lane.md`, "Fix 2"): the throw is `llm/evidence-loop/draft-shown.ts`
  failing closed on a packed draft entry that holds a row shown as `did_not_work`, raised inside
  the pre-decision `try` before `decide start` of the next iteration. The report calls this run's
  signature an exact match (tool end 48.948, nothing, failure 49.091) and reproduced it in tests.
- **Inferred, consistent with that cause:** the refused `c1` and `c2` did not throw, which fits
  the report's condition that the throw comes only once the draft outgrows the full entry and is
  packed. Draft size is NO EVIDENCE here.

## Stage 3 — the proposed Flow

Not reached. No `complete` decision was made, so no plan was checked and no Flow was created
(`evaluation.json` `flowCreated: false`, `snapshots/flow-lane.json` `flowShape: null`).

## Stage 4 — replay

Not reached. No dry run appears in `logs/core.log`.

## Stage 5 — the answer

Not reached (`snapshots/decision-trace.json` `runs: []`).

## Stage 6 — judgement and repair

Not reached.

## Causes

| # | Cause, precisely | Repo and file | Fix | Status / owner |
| --- | --- | --- | --- | --- |
| 1 | The build ended on a bare `Error` 143 ms after the refused `c18`, before iteration 18: `draft-shown.ts` refused a packed draft row shown as `did_not_work`, a disposition t175 (`98133e7`) made the draft show (report, "Fix 2"). | Core `runtime/llm/evidence-loop/draft-shown.ts` | The reader accepts every shown disposition (`SHOWN_DISPOSITIONS`) and still fails closed on anything else; tests `llm/evidence-loop/tests/draft-shown.test.ts` 16/16, `llm/tests/evidence-loop-draft-shown.test.ts` 8/8, both failing with the old reader (report, "Fix 2"). `flow-draft/entry.ts` (t189's) untouched. | **Fixed** in Core (t174). Not yet seen in a live run. |
| 2 | The failure named only `thrown.Error`, no frame. | Lab `packages/test-runner/src/core-web-build/server-process.ts` | The Lab's Core server runs with `--enable-source-maps`, so `thrown.at:` names the source line (report, "Fix 2"; test `core-web-build/tests/server-process.test.ts`). | **Fixed** (t174), checked on an esbuild bundle only; not yet seen in a live `next start`. |
| 3 | Four `web.action.rejected.target_unobserved` actions (`c1`, `c2`, `c17`, `c18`). | Unknown; the targets are not in the bundle | None. | **Open**, no owner named. Whether `c17`/`c18` would have been routed around, as `c1`/`c2` were, is unknown because the throw ended the build. |
| 4 | 17 provider round trips are counted as 1 call (Lab) and `null` (Core), with no accounting. | Core throw path (`snapshots/flow-lane.json` `build.accounting`) | None yet. | **Open**, no owner named (same gap as runs 6 and 7). |

## Instrumentation gaps found

| Stage | What could not be answered | Where it is dropped |
| --- | --- | --- |
| 2 | What iteration 12 asked for and which from-memory answer it got | Core `llm/evidence-loop/progress-trace.ts` |
| 2 | Which node kind each `core.run_node` call ran, and each target | `progress-trace.ts` logs `toolId` and `resultCode` only |
| 2 | What the 2 `amend_draft` decisions changed | `progress-trace.ts` logs only `kind` |
| 2 | Draft size and whether it had been packed at `c18` | `draftShown` lives in the loop trace, not stored for a failed build |
| end | The throw's frame | minified Next chunks without source maps (fixed by cause 2) |
| header | Calls, tokens and cost of 17 decisions | the throw path returns `accounting: null` |
| header | The Lab command line | `run.json` |
