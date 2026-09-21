# w2x-evidence-window (P7, t057): report

## Outcome

Partial. The total-evidence cap is gone. Five live builds on the three dev sites never ended `evidence_limit` and never had a tool fail for lack of room. The largest build gathered 153,142 bytes; P2's professional-network run stopped at 63,982 bytes after 14 calls. Each request now carries a bounded window: the newest results in full, plus a closed one-line record for each call it no longer carries.

Criteria met:

- Two of the three sites went past 15 calls: local-classifieds and professional-network, each with 26 decisions.
- Every build ended on a closed guard. Local-classifieds and professional-network stopped on the grant's call count (`flow_bootstrap.evidence_iteration_limit`). Auction stopped on the no-progress guard.

Not met:

- No build produced a proposal, so no Flow exists to replay. The measure that matters, a deterministic Flow, is not met.
- Auction did not reach 15 calls. It stopped at 11 decisions, and at 13 after a fix, on `repeat_without_progress`, cycling through structure-detection requests. P2's auction run `run-mubp85mr-5b24be58` did the same before this change.
- The Lab labels the two call-count builds `performance.budget`. That label is a miscount (open question 1).

## What changed and why

All changes are in Core worktree `F:\fxwork\t057\!FluxIQ`. They are uncommitted. `service.ts` is unchanged.

- **New `runtime/llm/context-window.ts` (178 lines; first written as `evidence-context-window.ts`, renamed in P11 for the naming rule).** Core had no context-window module, only a private function inside `evidence-loop.ts`. I moved that function out and extended it; the in-file copy is deleted. The window fills in this priority order:
  1. The newest result of each tool, whole. This is the old rule.
  2. A history entry, `core.evidence_history`, that lists each tool call no longer carried: `callId`, `toolId`, `resultCode`, and `changed` (`yes`, `no` or `unknown`).
  3. Older results, whole again, but only where every left-out call still keeps its line.

  Other rules:
  - A result is never cut. It is either shown whole or listed.
  - When the lines don't all fit, the most recent are listed and the rest are counted as `unlisted`.
  - Core's own notes get no line when they leave.
  - The newest entry is never displaced by the history.
  - The window, history included, stays within the provider's 64-entry limit.
  - The loop's bookkeeping field is stripped before anything reaches `decide`, because the provider checks entry keys exactly.

  My first version filled the space with older raw results before any lines. That left the history as a bare count. The live local-classifieds run 1 used that version.
- **`runtime/llm/evidence-loop.ts` (776 → 755 lines).**
  - Every entry the loop records now carries its closed call summary.
  - Each tool is offered `maxEvidenceContextBytes - 512` bytes, whatever has been gathered. Before, it was offered what was left of the total, so near the cap a tool got a few dozen bytes and threw, which read as `tool_failed`. This is the lane E relay.
  - Past the backstop, the loop still ends `evidence_limit`, never as a tool failure.
  - The default `maxEvidenceBytes` is now the loop ceiling of 1,048,576 bytes. It was 262,144.
  - `resolveLimits` refuses a `maxEvidenceContextBytes` larger than the byte budget of the one 64k-token constant (`automationStudioLlmTokenBudgetBytes(AUTOMATION_STUDIO_LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST)`, which is 192,000 bytes).
  - The loop re-exports `AUTOMATION_STUDIO_LLM_EVIDENCE_HISTORY_TOOL_ID`.
  - Added after live auction run 1: when the model re-asks for a result that was not in the last window, the loop answers it as before, but the first such answer per result, since the last real tool result, no longer counts toward the no-progress guard. Re-asking for a result that was in view, or for one already brought back, still counts. Without this, the history's own invitation ("Request one again only if you still need its result") would feed the guard.
- **`runtime/loop-limits/flow-bootstrap-evidence-loop.ts`.** The Flow Bootstrap total is now `AUTOMATION_STUDIO_LLM_EVIDENCE_LOOP_LIMITS.maxEvidenceBytes` (1,048,576 bytes) instead of 64,000. This is the far, configurable backstop; the loop's `maxEvidenceBytes` input still sets it. At the web domain's 12,000-byte packet cap, 65 calls come to 780,000 bytes, so the backstop cannot bind before the call ceiling. The header comment records why. I also removed a stale comment claiming `50_000` was written out.
- **Tests.**
  - New `llm/tests/context-window.test.ts` (8 tests). It covers the pass-through case, lines for left-out calls, most-recent-listed with the rest counted, no lines for Core notes, the newest entry never displaced, an oversized result listed rather than silently dropped, the entry cap, and a 200-case property test for the byte bound, no cut entries and the newest entry kept.
  - `llm/tests/evidence-loop.test.ts`:
    - The "brings back into view" test was updated for the history.
    - New: builds go past 64,000 bytes with every decision inside its window.
    - New: every tool call is offered 23,488 bytes, and running out ends `evidence_limit` with no `tool_failed`. Under the old offer this test fails.
    - New: the backstop is configurable and defaults to the ceiling.
    - New: a window over the token budget is refused.
    - New: a first bring-back is free, a second one counts.
  - `loop-limits/tests/flow-bootstrap-evidence-loop.test.ts`: the backstop is pinned, and a 27-call build at 20 KB a page stays under it.

## Commands run and observed results

`git merge --no-commit dev` in the downstream worktree was **blocked by the hook** ("workers must not change git history"). As the brief directs, I read the sites from the main checkout:

- **Scenario lab.** I ran the main checkout's `apps/scenario-lab/scripts/build-scenario-lab.mjs` with `FLUXIQ_LAB_SCENARIO_OUT_DIR` set to `F:\fxwork\t057\!FluxIQWebExtension\apps\scenario-lab\.lab-instances\t057\dist`. That compiles dev's scenario source into my ignored instance directory. Nothing was written to the main checkout; its `git status` was unchanged.
- **Everything else.** The extension, domain host and test-runner are built from the t057 downstream worktree (`FLUXIQ_LAB_INSTANCE=t057 node scripts/lab/run-lab.mjs inspect none`).
- **How runs were launched.** Runs went through `node scripts/lab/live-campaign.mjs <task> --no-build -- --target persistent-isolated --workspace t057-<site>`, with `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_LAB_INSTANCE=t057` and `FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT` pointing at a scratch wrapper (`scratchpad\t057-lab-run.mjs`). The wrapper runs the t057 runner against that instance.
- **Guards the wrapper skips.** It bypasses `run-lab.mjs`'s Core guards, so I checked them myself. Core `dev` (71e2798) is an ancestor of the t057 Core HEAD. Core was rebuilt before each code change was run, and never while a run was in flight. `FLUXIQ_LAB_ALLOW_BEHIND_CORE` was not used.

Before this change, P2's run `run-mubpn1ga-8ae8fdc5` (professional-network) ended `evidence_limit` at 63,982 bytes after 14 calls.

Live runs (deepseek-chat; defaults of 26 calls and $0.25 per call):

| Run | Task | Core | Lab calls | Real calls* | Evidence bytes | Tokens | Cost | Ended | Flow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `run-mubr6flw-4d5116c8` | local-classifieds-bike-search | window v1 | 27 | 26 | 153,142 | 332,090 | $0.1481 | `evidence_iteration_limit` | no |
| `run-mubri4yg-10d01258` | professional-network-rotterdam-data-engineers | window v2 | 27 | 26 | 123,155 | 338,716 | $0.1508 | `evidence_iteration_limit` | no |
| `run-mubrqhvc-91d1f227` | auction-marketplace-kestrel-auctions | window v2 | 12 | 11 | 37,303 | 140,918 | $0.0628 | `repeat_without_progress` | no |
| `run-mubrxnkw-dc8ee2c4` | auction-marketplace-kestrel-auctions | final | 14 | 13 | 38,191 | 168,674 | $0.0751 | `repeat_without_progress` | no |
| `run-mubs2sme-75efe4a4` | local-classifieds-bike-search | final | 27 | 26 | 144,614 | 335,061 | $0.1498 | `evidence_iteration_limit` | no |

\* Real calls are Lab calls less one. See open question 1.

Total spend was $0.5866.

- **`build.providerCalls == observed.calls`** held in every run: 27=27, 27=27, 12=12, 14=14, 27=27. Both sides carry the same off-by-one.
- **Matched records.** None were measured. No Flow was created, so no playback ran and `evaluation.json` has `extraction: null`.
- **Failures.** No run had an `evidence_limit` or any `tool_failed` step.

Where each build stopped:

- **Local-classifieds.** Browser history shows it reached `/scenarios/local-classifieds/category/bicycles/`, then pressed controls and inspected in-page, apparently applying filters and paging. In the final run the model tried to complete twice and its plan was refused (`web.handle.ambiguous`, steps 21 and 23), then it ran out of decisions.
- **Professional-network.** It reached `/search/results/people/?keywords=data%20engineer`. It met `blocked_by_dialog` once and recovered, then pressed through filters and pages until the call count ran out.
- **Auction.** Three structure detections, an inspect, one more detection, then repeat detection requests: 3 in run 1; in the final run 2 free bring-backs and then 3 counted repeats.

Checks, all after the live runs:

- Focused Core tests from `packages/fluxiq`: `npx vitest run` over `runtime/llm/tests`, `llm/harness-options/tests`, `llm/harness/tests`, `loop-limits/tests`, `flow-bootstrap/tests`, `tests/service-bootstrap`, `recovery/tests`, `recovery/annotation/tests` and `tests/deepseek-recovery-requests.test.ts`. Result: **856 passed, 1 failed of 857.** The failure was `service-bootstrap/tests/adaptation.test.ts > bridges a generated proposal ID...`, which timed out at 15,159 ms against `testTimeout: 15_000` under parallel load. Run alone, that test passes in 8.5 s, and the whole file passes 9/9.
- The three touched test files alone: 44/44 passed.
- Core `pnpm check`: exit 0. Structure tests 182/0 and 20/0; `structure-audit: passed (170 warning(s), 361 baselined)`; contracts, client-gateway-websocket, fluxiq and web checks all done. `evidence-loop.ts` at 755 lines and its test file at 483 lines are advisory warnings only. Both were already past 400 lines before this change.
- Core `pnpm build`: exit 0.
- Downstream `pnpm check` in `F:\fxwork\t057\!FluxIQWebExtension`: exit 0; `structure-audit: passed (84 warning(s), 122 baselined)`; all ten package checks done.

## Not verified

- **No run ended in a proposal.** So there is no Flow, no keyless replay and no matched-record count.
- **Downstream `pnpm check` ran on the t057 source, not on dev merged in.** The merge was blocked. The runner is also t057's, which lacks dev's result-verification call counting (`cf54c30`). No run reached verification, so this had no effect here.
- **Professional-network and the first local-classifieds run used intermediate code.** Professional-network ran on window v2, before the bring-back change. Local-classifieds run 1 ran on window v1. Only auction run 2 and local-classifieds run 2 ran on the final code.
- **The bound offered to each tool was not observed live.** It is covered by a unit test. Live, it shows only as the absence of `tool_failed` and `evidence_budget_exhausted`.
- **Recovery explorations were not run live.** They use the same loop and window.

## Open questions or contradictions found

1. **The Lab miscounts a refused build's calls by one, and now flags `performance.budget` falsely.**
   - For a refused build, the Lab's `providerCalls` is Core's diagnostic `decisionCount`: `test-runner/src/flow-lane/creation/build-proposal.ts:198`.
   - That `decisionCount` is `trace.length` (`flow-bootstrap/generation-failure.ts:380`), and the trace includes the iteration-0 initial observation, which makes no provider call.
   - The grant mints exactly `maxCalls` uses (`llm/execution-grants.ts:297`), and the loop completed all 26 decisions. So 26 calls were made, not 27.
   - The 64,000-byte cap hid this, because no build ever reached its call count. The fix belongs in the Lab or in `generation-failure.ts`. I own neither.
2. **With evidence no longer binding, realistic builds run into the call count without completing.** On local-classifieds and professional-network the model keeps pressing and inspecting, walking filters and pages, rather than completing. It is never told how many decisions remain. The next defect is either telling the model how many decisions it has left, or the call default. Both are outside this brief.
3. **Auction's structure-detection cycling predates this change** (P2's `run-mubp85mr-5b24be58`). It is the model repeating itself, and the guard is right to stop it.
4. **Recovery's own total cap is untouched.** `recovery/exploration-budget.ts` still defaults `maxEvidenceBytes` to 262,144 bytes. That file is not mine. With 24 calls at the web domain's 12,000-byte cap (288,000 bytes), it can bind before a recovery's calls do. It needs the same treatment by whoever owns recovery.
5. **The free first bring-back is a design choice.** It closes the trap in which the history invites a re-request and the guard then punishes it. The supervisor should confirm it.

## P11: builds bounded by budget, not by a call count (scope extension)

### P11 outcome

Partial. A build is no longer stopped by a count of decisions. It is bounded by the grant's token budget, the grant's cost ceiling and a deadline, and it stops when the no-progress guard trips. The model is shown what is left on every decision after the first, and its last decision is offered only completion. Recovery's total evidence cap (P7 open question 4) is also raised to the ceiling.

In the first live pair (`--llm-max-calls 64`), neither build stopped on a call count:

- **Local-classifieds** ran 33 decisions and ended `flow_bootstrap.evidence_unusable_decision`. Its plans from decision 20 onward were refused as `web.handle.ambiguous`.
- **Professional-network** ran 42 decisions, using 533,446 of its 600,000 tokens. The final decision, offered only completion, wrote a plan that was refused as `web.handle.ambiguous`, and then the budget was spent.

Both stayed well inside the cost cap ($0.194 and $0.238 against $2). `build.providerCalls == observed.calls` held for both (34=34, 43=43; each count includes the initial observation, see open question 1 above).

**No Flow was created, so there are no matched records.** The blocker is now the plans themselves: they name controls ambiguously and Core's completion check refuses them. The budget no longer is.

That pair ran on the budget code before its last two changes:

- A budget spent straight after a refused answer now ends as that refusal, with its issue codes, instead of as `iteration_limit`. The professional-network run above would now read `evidence_unusable_decision` (`web.handle.ambiguous`).
- The budget entry is omitted on the first decision, unless that decision is also the last.

Five later professional-network attempts on the final code produced no readable build (see P11 commands). Both of these changes are covered by unit and service tests, not by a live run.

### P11: what changed and why

All in `F:\fxwork\t057\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\`. Nothing is committed and `service.ts` is untouched: it spreads the Flow Bootstrap limits' `loop` object into the loop, so the budget reaches the loop without a service change.

- **New `llm/loop-budget.ts` (109 lines).**
  - Before each decision it works out how many decisions each bound still allows, and takes the smallest together with the iteration backstop:
    - **Tokens:** the run budget, less what was spent, less one decision held back for calls the loop cannot see (such as the build's single instruction-authority read). The next call must leave room for the grant's per-call worst case.
    - **Cost:** the run's cost ceiling against the estimated cost decisions report.
    - **Time:** the deadline, divided by the average time per decision.
  - Decisions that reported no usage are counted at the average.
  - It builds the closed `core.budget` entry: `decisionsLeft`, `tokensLeft`, `costLeftUsd`, `secondsLeft` and one fixed instruction sentence.
  - It validates the budget.
- **`llm/evidence-loop.ts` (now 796 lines).** It takes an optional `budget`. With a budget:
  - The loop shows the model the `core.budget` entry as its newest evidence, with the window shrunk by that entry's bytes and one entry slot.
  - When one decision is left, only `complete` is offered (`tools: []`).
  - If that last decision asks for a tool anyway, the tool is not run and the loop ends `iteration_limit`.
  - With nothing left, the loop ends. If the previous answer was refused, it ends through `unusableDecisions.stalled` with that refusal's issue codes. Otherwise it ends `iteration_limit`.

  I could not add a failure code: the union is keyed exhaustively in `flow-bootstrap/generation-failure.ts` and `recovery/exploration-outcome.ts`, which I don't own. Without a budget, the loop behaves exactly as before.
- **`loop-limits/flow-bootstrap-evidence-loop.ts`.**
  - `loop.budget` now carries the grant's `maxTotalTokensPerRun`, the per-call worst case from its token limits, `maxTotalEstimatedCostUsd`, and `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_DURATION_MS`.
  - That duration is 540,000 ms: the grant's 600,000 ms run lease less a minute for the plan check and persisting. A test pins it to `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_RUN_MS`.
  - `maxIterations` is only the backstop: the grant's own call count, or the loop's ceiling. The grant mints exactly that many calls, so the loop cannot exceed it.
  - `AUTOMATION_STUDIO_FLOW_BOOTSTRAP_MAX_ACCOUNTED_TOKENS` is now read off the largest run token budget a grant accepts: 64 × the per-request ceiling, pinned to `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS`. It is no longer read off the loop's iteration ceiling. The value is unchanged at 4,096,000.
  - The grant numbers are written out because importing `llm/execution-grants.ts` here would close a cycle through the provider factory.
- **`recovery/exploration-budget.ts`.** The default `maxEvidenceBytes` goes from 262,144 to the ceiling, 1,048,576. 24 calls at the web domain's 12,000-byte packet (288,000 bytes) could reach the old default first. Each request is bounded by the loop's window, which recovery already gets through the same loop.
- **Rename for the naming rule.** Core `pnpm check` failed `[naming]` because three `llm/` files shared `evidence-`. The new modules are therefore `llm/context-window.ts` and `llm/loop-budget.ts`, and their tests are `llm/tests/context-window.test.ts` and `llm/tests/loop-budget.test.ts`.
- **Tests.**
  - New `llm/tests/loop-budget.test.ts` (9 tests):
    - the countdown arithmetic;
    - the worst case assumed before any usage is reported;
    - unreported decisions counted at the average;
    - nothing left once any bound is spent;
    - the entry shown on every decision after the first, inside the window's bytes;
    - the last decision offered only completion, and completing;
    - `iteration_limit` when nothing is left, including a last decision that still asks for a tool;
    - a budget spent after a refused plan ending as that refusal;
    - the deadline counted on an injected clock;
    - an invalid budget refused.
  - `loop-limits` tests: the budget contents, the deadline pin and the accounted-tokens pin.
  - `recovery/tests/exploration-budget.test.ts`: the default equals the ceiling, and 24 × 12,000 bytes stays under it.

### P11: commands run and observed results

After the supervisor's merge (`5d46c67`), runs used the t057 downstream worktree's own scenario-lab. The scratch wrapper was dropped. The command was `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t057 node scripts/lab/live-campaign.mjs <task> --max-attempts 2 -- --target persistent-isolated --workspace <ws> --llm-max-calls 64`. Core `dev` (71e2798) is contained in the t057 Core, and `FLUXIQ_LAB_ALLOW_BEHIND_CORE` was not used.

| Run | Task | Core | Result | Calls (Lab = observed) | Tokens | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| `run-mubsyuzd-5f634dca` | local-classifieds-bike-search | budget v1 | `evidence_unusable_decision` (`web.handle.ambiguous`), 146 s, 147,081 evidence bytes | 34 = 34 | 428,435 | $0.1943 |
| `run-mubt57qz-9227b125` | professional-network-rotterdam-data-engineers | budget v1 | budget spent after a refused final completion (reported `evidence_iteration_limit`), 219 s, 183,308 evidence bytes | 43 = 43 | 533,446 | $0.2385 |
| `run-mubtf0ws-01a95f81` | professional-network | final less 2 edits | Lab `environment.missing`: "FluxIQ HTTP operation timed out" at 670 s, no build record | not recorded | not recorded | not recorded |
| `run-mubu10yp-0073a496` | professional-network | same | Lab setup HTTP timeout 30 s after dispatch, while I was running a test suite alongside it | 0 | 0 | 0 |
| `run-mubunt2e-74e4936d` | professional-network | final | Core web panel build `uncaughtException kill EPERM`, twice | 0 | 0 | 0 |
| `run-mubuvmwt-3e832601` | professional-network | final | `lab.generation_http_400`: the Lab could not parse Core's diagnostic; 119 s | not recorded (Lab saw 1) | not recorded | not recorded |
| `run-mubvdjqu-6f224da3` | professional-network | final | `lab.generation_unfinished` after 675 s; browser history shows the build exploring | not recorded (Lab saw 1) | not recorded | not recorded |

- **Why the later runs are unreadable.** Other worktrees (t064, t066, t070) were running Lab builds and test suites on the machine during these runs. The Lab's control request is bounded at 300 s (`GENERATION_REQUEST_TIMEOUT_MS`, "`http-control`'s own bound"). After that it can find a proposal by polling but never a failure. So any build that fails after 300 s reads as a timeout with no build record. The P11 pair finished in 146 s and 219 s; the later builds evidently ran longer.
- **Spend is unknown for three runs.** `run-mubtf0ws`, `run-mubuvmwt` and `run-mubvdjqu` recorded nothing. Each is capped by its 600,000-token grant, about $0.25.

Checks, all after the live runs:

- **Focused Core tests** (`--testTimeout 120000`) over `llm/tests`, `llm/harness-options/tests`, `llm/harness/tests`, `loop-limits/tests`, `flow-bootstrap/tests`, `tests/service-bootstrap`, `recovery` and `tests/deepseek-recovery-requests.test.ts`: **875 passed of 875, 73 files.**
  - The same set at the default 15 s timeout, run while a live run was going, had 9 timeouts and one real failure. The real failure was `service-bootstrap/tests/generation.test.ts`, "packs opted-in reusable context...", which expects the first decision to carry one entry. Omitting the budget entry on the first decision fixed it.
  - `service-bootstrap` alone, serially: 68 passed of 68.
- **After the rename, the five touched test files:** 83 passed of 83.
- **Core `pnpm check`:** the first run exited 1 on `[naming]` (three `evidence-` files). After the rename it exited 0: 182/0 and 20/0 structure tests, `structure-audit: passed (170 warning(s), 361 baselined)`, and all four package checks done. After trimming the `exploration-budget.ts` comment back to 400 lines, the audit is still at 170 warnings and `pnpm --filter fluxiq check` passes.
- **Core `pnpm build`:** exit 0. The final `pnpm --filter fluxiq build` passed with 0 TS errors. `tsc -b --clean` left the old `evidence-context-window.*` and `evidence-loop-budget.*` outputs in `packages/fluxiq/dist`. They are unreferenced; the next clean output removes them.
- **Downstream `pnpm check`** (t057 worktree with dev merged): exit 0, `structure-audit: passed (84 warning(s), 122 baselined)`, all ten package checks done.

### P11: not verified

- **The final code's two last changes were not observed live:** the refused-then-spent ending, and no budget entry on the first decision. The five later professional-network attempts yielded no build record.
- **No Flow was created on either site,** so there is no matched/expected record count and no replay.
- **The time bound has not ended a live build.** Neither pair build came near 540 s. The unreadable runs may have, but nothing recorded it.
- **Whether the model paces itself on `decisionsLeft`.** Local-classifieds started trying to complete at decision 20 and professional-network at decision 37, but the requests were not captured, so I cannot show which entry it read.

### P11: open questions or contradictions found

1. **Two call-count defaults still sit at 26, both outside my scope.** They are Core's `AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS` (`llm/execution-grants.ts`) and the Lab's `DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun` (`packages/test-contracts/src/llm.ts`). A grant mints exactly its call count and the loop cannot exceed it. With a default grant, a build still stops at 26, though now with a forced completion rather than mid-exploration. The live proofs passed `--llm-max-calls 64`. For the call count to be only a far backstop by default, both need to move to 64. A recovery test pins the Core default to the exploration's 24 + 2.
2. **The Lab cannot see a failed build that runs past 300 s.** It reports `environment.missing` or `lab.generation_unfinished` with no calls, tokens or cost. Longer builds are now normal (up to the 540 s deadline). The Lab's `http-control` bound, or its fallback that only polls for proposals, needs to be fixed by the Lab owner. The web panel waits the full lease.
3. **`lab.generation_http_400` in `run-mubuvmwt-3e832601`.** Core returned a 400 the Lab could not parse into a diagnostic, after 119 s. I could not see the payload. The same path passed 68/68 service tests. Whoever owns the Lab parser should capture the envelope's shape on the next occurrence.
4. **The next blocker for a Flow is plan quality.** Both P11 builds were refused on `web.handle.ambiguous`: the model's plans name controls that more than one element matches. That is outside this brief (the completion check, or how the domain issues handles).
5. **Build time is now bounded by the budget.** At about 5 s a decision, the 600,000-token budget ends a build near 43 decisions and about 220 s. Under load it can run to the 540 s deadline.
