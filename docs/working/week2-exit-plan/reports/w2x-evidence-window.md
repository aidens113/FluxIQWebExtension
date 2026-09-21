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

- **New `runtime/llm/evidence-context-window.ts` (178 lines).** Core had no context-window module, only a private function inside `evidence-loop.ts`. I moved that function out and extended it; the in-file copy is deleted. The window fills in this priority order:
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
  - New `llm/tests/evidence-context-window.test.ts` (8 tests). It covers the pass-through case, lines for left-out calls, most-recent-listed with the rest counted, no lines for Core notes, the newest entry never displaced, an oversized result listed rather than silently dropped, the entry cap, and a 200-case property test for the byte bound, no cut entries and the newest entry kept.
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
