# t484 request-cache-placement: worker report

## Outcome

Done, including the continuation (ownership extended to the four layout tests and to `llm/context-window.ts` with its tests).

- **W1 (schema behind the window): fixed.** The output schema now sits in front of the task's context. The measured evidence below shows this placement is right on both build paths.
- **W3 (situation inserted mid-window): fixed.** A situation is placed once and appended. It never goes in front of an entry a previous decision was already sent.
- **W1 cause 2 (the new-page reshaping): no defect.** It is B1's view-to-reference replacement, a true change of what the entry shows. Over two days of live builds it is the only kind of rewrite the window makes. That property is now enforced by a test. `context-window.ts` itself is unchanged. Removing the re-bill this causes would change what the model is told, which needs a decision from the supervisor or user (see Open questions).

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t484/!FluxIQ`, branch `task/t484-request-cache-placement`. The paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

1. **`llm/deepseek/request-body.ts` (W1).**
   - What changed: an evidence decision's user message is now `taskKind, promptVersion, expectedOutput, outputSchema, context`. That is the same order the one-shot request has always used, and the key name is the one the system prompt reads ("the outputSchema field in the user message"). Before, `outputSchema` came after `context`, behind the window.
   - No wording or content changed.
   - The doc comment records:
     - the t193 trade it replaces;
     - the churn measurement below;
     - that a replaced view (B1) is the one rewrite the window makes.
2. **`route-state/build-routing.ts` (W3).**
   - `shown` remembers where each situation was first placed (`placed`) and the bytes of the previous decision's window (`previouslyShown`).
   - A new situation is placed by `firstPlacement`:
     - after the call it was observed after;
     - before every entry, for the start;
     - after the newest call in the window when its call is in no entry (the 0041 case, where the observation followed one of the trial's own steps). It now follows `test-2`.
     - In every case it goes no earlier than the leading entries the previous decision was sent byte for byte unchanged (`unchangedEntries`).
   - Later decisions reuse the remembered placement.
   - `isCoreNote` tells Core's own entries from the model's calls by Core's naming: the callId is the toolId, or the toolId plus a counter. I did not import the note tool ids: going past the `llm/` barrel is ratcheted by the audit, and `llm` already imports `route-state`.
   - **Order meaning kept:** a situation still follows the call that produced it, or the call that ran it (the trial). The guard only moves it past entries that existed before it was observed, so "after the call it follows" stays true in time. The `seen` text is unchanged.
3. **`llm/deepseek/tests/cache-placement.test.ts` (new, 3 cases, fail-first).**
   - It drives a real `startAutomationStudioBuildRouting` and the real `buildAutomationStudioDeepSeekRequestBody`.
   - It builds two consecutive requests of one build, with a route-state change between them. The scenario is an exploration call, a submit, then a trial whose own step moves the page.
   - It asserts that the later prompt (system + user) begins with every byte of the earlier one through the end of its last window entry, and that the schema, catalog and tools precede `"evidence"`.
   - The other cases: a placement holds on a third decision, and a repeated call id cannot pull a situation in front of an already-sent Core answer.
4. **The four tests that pinned the old layout now assert the new one.**
   - `llm/tests/evidence-loop-provider.test.ts`: the payload keys are exactly `[taskKind, promptVersion, expectedOutput, outputSchema, context]`, and `"outputSchema"` comes before `"evidence"`.
   - `llm/tests/provider-cache-prefix.test.ts`: only the objects the counter closes follow it (`/^\d+\}\}\}$/`), and `"outputSchema"` is inside the prefix, in written order after `"taskKind"`.
   - `llm/evidence-loop/tests/request-prefix.test.ts` (both cases):
     - every request's top-level keys are pinned to the new order;
     - `offerChangeStart` is the exemption, built like the tools one. When the schema changed (every tools change also changes it), the prefix must reach past `"outputSchema":`. When only the tools changed, it must reach `"tools":`. Otherwise it must cover the whole window, with `"outputSchema"` inside the prefix;
     - the header comment is updated with the measurement.
5. **`llm/tests/context-window.test.ts` (W1 cause 2).** A new case runs a growing window (page views, a read with held rows, looks, situations, recall answers) under `["page", "read.extracted"]`. Between consecutive decisions it checks:
   - an already-sent entry changes only where a view was removed and a `supersededBy` naming a newer entry was added;
   - every kept key is byte for byte unchanged and in order;
   - no view is replaced twice.

   It passes on the current code, because no defect exists to fail first. A mutation check confirmed it detects one: making the reference name the newest view (`replacedBy ??=`) failed it, along with 5 existing cases. I then restored the file byte for byte, and `git status` shows `context-window.ts` unmodified.

`system-prompt-pins.json` is untouched. I did not touch `harness/context-packet.ts` (t486) or `result-verification` (t482).

## Measurements (item 2 and cause 2)

Scripts are in the scratchpad (`t484-schema-churn*.cjs`, `t484-stub-loss.cjs`, `t484-other-div.cjs`, `t484-stub-again.cjs`). They read `~/FluxStuff/lab-runs/*/run-*/steps/*-decide/request.json`, 113 builds with 2+ decisions from 2026-10-01 to 10-12.

**How often `outputSchema` changes between consecutive decisions of one build:**

| Path | Builds | Pairs | Schema changed | Without a tools change |
| --- | --- | --- | --- | --- |
| Evidence-guided (10-01 to 10-07, the last such run) | 57 | 2,113 | 136 (6.4%) | 31 (1.5%) |
| Candidate (10-07 to 10-12) | 56 | 1,562 | 50 (3.2%) | 2 |

- It changes rarely, and mostly at the same call as a tools change, which already misses from the tools onward.
- Uncached characters attributable to the schema:
  - **Behind the window:** 25.8M on the evidence-guided path and 36.7M on the candidate path, counting every pair whose tools were unchanged.
  - **In front:** 2.2M and 0.13M, counting the whole user message on each schema-only change.
- **Decision:** front placement on both paths. I did not split the schema: no split is needed, and a split would change the shape the system prompt describes.

**Cause 2, two days of builds (2026-10-11 and 10-12, 1,161 pairs):**

- The first divergence was a view replaced by a reference in 464 pairs. In another 55, the same result's second view was replaced (its page after its rows, or the other way round). No kept value changed in any of them.
- These rewrites re-billed 1.17M characters of already-sent entries:
  - `core.route_state` 654k (the situation after the replaced call);
  - `detect_repeating_structure` 116k;
  - `test_candidate` 115k;
  - `submit_candidate` 106k;
  - `recall_result` 50k.
- They also removed 3.9M characters of old views.
- At DeepSeek's hit price (1/50 of a miss, `pricing.ts`), keeping a replaced view whole for the rest of a build costs about as much as the re-bill. It would also break "only the newest view of the target is shown whole" and the B1 context-size bound.
- In the reported 0019→0021 case, the divergence was exactly the stub. `page` was removed, `supersededBy: close-chat-1` was added, every other key was identical, and only the trailing notes followed it.

## Commands run and observed results

Run from `packages/fluxiq` unless noted.

- Fail-first, before any source change: `npx vitest run .../cache-placement.test.ts` -> `Tests 3 failed (3)` ("expected 8553 to be greater than or equal to 8633"). After the routing fix only: `1 failed | 2 passed` (`"outputSchema": expected 8813 to be less than 8132`). After both fixes: passed.
- Before the continuation, the four old-layout tests failed: `3 failed | 3 passed` files, `4 failed | 57 passed` tests (for example `expected '1}}}' to match /^\d+\}\},"outputSchema":/u`). After the update, `npx vitest run` on those 3 files -> `3 passed`, `28 passed`.
- Context-window guard: `npx vitest run .../llm/tests/context-window.test.ts` -> `19 passed`. The mutation run gave `Failed Tests 6`, and the file was then restored.
- Requested directories: `npx vitest run .../llm/tests .../llm/deepseek/tests .../llm/evidence-loop/tests .../route-state/tests` -> `Test Files 65 passed (65)`, `Tests 903 passed (903)`.
- Wider: `npx vitest run .../runtime/llm .../runtime/route-state` (all 186 llm test files plus route-state) -> `Test Files 190 passed (190)`, `Tests 1892 passed (1892)`.
- Core typecheck: `npx tsc --noEmit -p .`. The first run reported `TS2322` at `context-window.test.ts(379,103)`, which I fixed with `String(...)`. The rerun gave `tsc exit 0`.
- Structure audit, from the Core root: `node scripts/structure-audit.mjs` -> `structure-audit: passed (337 warning(s), 1159 baselined)`, exit 0.
  - Advisories on touched files: `provider-cache-prefix.test.ts` at 487 lines (it was about 485 before), and the pre-existing `llm/deepseek/` 17 files.
  - "2 baseline entries can be lowered" is not from my files, and I did not run `pnpm structure:baseline`.

## Not verified

- No full suites, no Lab or provider runs. The live saving is not measured; the figures above come from recorded requests.
- Test directories outside llm/ and route-state that may read evidence-decision key order (for example `runtime/tests/service-bootstrap/*`) were not run.
- Downstream (`!FluxIQWebExtension`) was not touched, and its build against this Core was not checked.

## Open questions or contradictions found

1. **Cause 2 can only be removed by changing what the model is told.** One option is to write each result in its final form, without its view, and show the current view as a single note at the end of the window that is replaced every decision, like history and budget. That stops all 1.17M characters of re-bill. But the newest result would no longer carry its view in place, so the decision instruction's sentence about `supersededBy` and "the newest view" needs new wording. That is for the supervisor or user to decide.
2. **Other mid-window rewrites outside my files** (same 1,161 pairs). Core notes such as `core.amendment_check`, `core.refusal_run` and `core.repeat_check` are removed or replaced mid-window when a newer one of the same kind arrives (`llm/decision-context/supersede.ts`), with about 200k characters re-billed across those classes. Classes like `X -> core.route_state` (test_candidate, submit, extract, rerun) are the W3 pattern that this change fixes.
3. The doubled per-token price in `run-mv62icw0-2be384b4` is a billing or rate matter, not request layout. I did not trace the `run-mv62icw3-9118516f` exploration misses to a cause in these files. Its debug attributes them to a re-read loop.
