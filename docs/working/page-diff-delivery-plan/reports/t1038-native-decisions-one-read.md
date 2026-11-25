# t1038 (W2): native decisions and one-call reads, sub-supervisor report

Trees: `fxwork/t1038/!FluxIQWebExtension` and `fxwork/t1038/!FluxIQ`, branch `task/t1038-native-decisions-one-read`, opened from Core 0.54.19 (t1034 included). Nothing committed; everything is in the working trees.

## Outcome

**Partial.** D12 and D13 are built and pass every narrow check, with one exception: a Core test in W1's paths needs the lead to apply a prepared replacement. The P4 replays are done. The provider-free bigbox run in slot 3 shows native tool calls (one fixed tool list across the run) and list reads as single calls. It still ends `not_judged`. The completion check holds the judge's yes as unconfirmed for `judge_evidence.before_state_missing`, a Core inconsistency outside W2's paths that predates this task (open question 1). Two other defects the run exposed are fixed: the read summary the judge could not parse, and the scripted model answering a continued judge as a chat turn.

## Workers

| Worker | Tier | Brief | Outcome | What I verified myself |
| --- | --- | --- | --- | --- |
| A1 `a1-native-decisions` | worker-heavy | D12, Core: neutral decision-tools module, Anthropic native tools, judge, decision-check, P4 replay | Partial: one W1-owned test needs a fix | The code shows `tool_choice` auto with one call at most, and the withdrawn allowance and its import are gone. The miss rule is worded within the bound. The test failure is the one A1 named. I read A1's proposed test diff. Core groups re-run (below). |
| B `b-one-read` | worker-heavy | D13, downstream: the read detects its own list, keeps every column, refusals point to one call, pair replay | Done | Domain tests and check re-run (below). B's replay table read. Its gap (the run's unjudged result) is traced below. |
| A2 `a2-deepseek-tools` | worker | D12 for DeepSeek on A1's module | Done | Core groups, check and audit re-run over the whole changed area (below). |
| C `c-scripted-lab` | worker | Scripted model answers with `tool_use`; bigbox script uses single reads; Lab run in slot 3 | Partial: ran unjudged | I read its run's step folders and found the two causes below. I fixed them and reran the Lab myself. |

No escalations. Four workers, within budget.

## What was built

- **D12, Core.**
  - `runtime/llm/provider-task/decision-tools/` builds one provider tool per decision variant: names reversible by lookup, `summary` first, `input` nested, byte-identical for the same offer. It also reads a tool call back into the unchanged wrapper `{kind, summary, decision}`.
  - `answer-transport.ts` switches `json_object` / `decision_tools`. With tools, the user message drops `outputSchema`, `context` stays byte-identical (tested), and the system text asks for one call.
  - Anthropic sends `tools` with `tool_choice: {type:"auto", disable_parallel_tool_use:true}`.
    - Forced choice is rejected on Sonnet and Opus 5.5, whose thinking cannot be fully disabled (`no-thinking.ts`).
    - Closed schemas go strict within the per-request limits.
  - The tool_use reply goes through the same task-answer -> decision-reading -> decision-check -> schema-miss path. New paid account cases: `tool_call_missing|several|unknown|unexpected`.
  - A judge continuing the decider keeps the decider's tools and choice (cache) and answers in text, checked against its own schema. Standalone judges keep their native schema.
  - DeepSeek sends function tools with `tool_choice: "required"`. Thinking is always disabled, so the docs allow it.
  - `decisionTools: false` keeps the old path on either adapter.
- **D13, downstream.**
  - `extractList: {handle: "tN"}`, `{words}` or `{}` detects the list itself and keeps every column; `fields` only picks.
  - Columns are named once at detection (`structure/column-names.ts`).
  - Refusals no longer say "detect first". The draft step keeps the issued handle plus its saved binding.

## Integration changes I made

1. **Fixed `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts` (cause of `web_judge.read_invalid`).**
   - The recorded read payload had its rejected samples taken out but kept `rejectedObservations`.
   - The observations are indexed by those samples, so `webAutomationExtractionSummaryValue` threw away the whole summary, and the judge evidence marked the read invalid. Proven on run-mwvsd9t9 step 18: removing only that key makes it parse.
   - The bug is older than this task. It hits any read whose conditions turn rows down.
   - Fix: the observations leave with their samples. Regression test added in `node-run/tests/rejected-rows.test.ts`.
2. **Fixed `packages/test-runner/src/attempt-lane/scripted-model/wire-request.ts` (judge misrouted as a chat turn).**
   - A judge that continues the decider ends with a `system` turn, so the server read no task payload and answered it as a `panel_command` (reply keys `do/with/process`, logged as an unreadable judge reply).
   - The request structure is older than this task. Now the kind is read from the previous user turn's last text block.
   - Tests: `scripted-model/tests/wire-request.test.ts`.

## Commands and observed results

- Core, `NODE_OPTIONS=--max-old-space-size=3072 node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm src/runtime/models src/runtime/result-verification src/framework/automation-service/service/answer-first` (heavy gate):
  - parallel: `Test Files 692 passed (692)`, `Tests 5892 passed (5892)`.
  - real-sql: `Test Files 1 failed | 75 passed (76)`, `Tests 1 failed | 510 passed (511)`. The one failure is `answer-first/completion/tests/judge-continues-decider.test.ts > an attempt started the way a chat starts it > sends the judge after a decision as a continuation of its own decider, and its step says so` (open question 2).
- `pnpm --filter fluxiq check` -> exit 0. Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (574 warning(s), 903 baselined).`
- Core libraries rebuilt (`pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build`) -> exit 0. Then `pnpm --filter @fluxiq-web-extension/domain check` -> `core-build: ... is current with its source`, exit 0.
- `DOMAIN_TEST_BUILD_LABEL=t1038sup node scripts/test-domain.mjs llm-evidence/structure/ llm-evidence/node-run/ llm-evidence/rejection-next/ llm-evidence/plan-resolution/ llm-evidence/judge-evidence/ output-nodes/ actions/extraction/ extraction/ llm-evidence/tests/tool-rejection` -> `# tests 1568 # pass 1568 # fail 0`.
- Downstream `node scripts/structure-audit.mjs` -> `structure-audit: passed (261 warning(s), 551 baselined).` `node scripts/check/model-text.mjs` -> `model-text: ok (203 scenario tokens, 555 model-facing Core files, 14376 string literals)`.
- test-runner `tsc -p tsconfig.json` -> clean. `node --test "dist/attempt-lane/scripted-model/**/*.test.js"` -> `# tests 116 # pass 116 # fail 0`.
- Extension check and tests: B's runs (`exit 0`; `# tests 4168 # pass 4168 # fail 0`). Nothing under `apps/extension` changed, so I did not re-run them.

## P4: native decisions (A1's replay, 467 decide steps of the five recordings)

| Run | Decisions | Old read | Old refused | New read | New refused | Cannot be a tool call | Fixed tokens old -> new |
| --- | --- | --- | --- | --- | --- | --- | --- |
| mwuuo3zk | 143 | 132 | 10 | 134 | 1 | 8 | 5991 -> 6752 |
| mwuxd2v9 | 82 | 70 | 11 | 74 | 1 | 7 | 5984 -> 6742 |
| mwv5m906 | 74 | 73 | 0 | 70 | 0 | 4 | 6030 -> 6801 |
| mwveg5ls | 128 | 124 | 3 | 122 | 2 | 4 | 5789 -> 6450 |
| **all five** | 467 | 438 | 25 | 440 | 4 | 23 | 5954 -> 6694 |

- The 25 old refusals: 7 now read, 14 cannot be a tool call, and 4 are still refused (a node outside `core.run_node`'s list, now told as the allowed list within the bound).
- The 23 that cannot be expressed: 18 named a tool not offered (`find_on_page`, a node id as a tool, a withdrawn look), which a native call cannot do. 4 had no reply recorded, and 1 had no decision.
- Fixed tokens are estimated, and include 286 for the API's tool system prompt. They sit first in the cached prefix, while the user message drops the `outputSchema` it used to carry.

## P4: one-call reads (B's replay, the real content script on the bigbox fixture)

- 21 recorded detect-then-read pairs. 16 were replayed as single reads, and all 16 match on every asked column.
- 12 of the 16 also match the recording exactly. The other 4 differ only in "Pickup today/tomorrow", which depends on the time of day.
- 5 could not be replayed:
  - 3 on the home page: the recorded live detection found a 2-item section list the fixture never issues, and the old read itself is refused on the fixture.
  - 2 `cells` reads: the fixture issues no cells there.
- On the recordings, the detections no longer required carried about 114k tokens of results.

## Provider-free Lab run (slot 3, scripted model, headed, watcher on)

The final run is `run-mwvu78hj-7320b1e2`, on a freshly built Core with no stale override (`test-runs/instances/slot-3/attempts/run-mwvu78hj-7320b1e2`, log `test-runs/t1038/sup-lab-run.log`).

- 33 of 33 decision requests carried `tools`, and every one carried the same tool list, byte for byte. None carried `outputSchema`.
- 12 `dom-extract_list` reads (Flow replays included), 0 `detect_repeating_structure` calls. 15 and 12 rows.
- Both judges answered "yes" on the first ask, through the continuation.
- The completion check still holds the result `answer_first.judged_unsure` for `witnesses.before (judge_evidence.before_state_missing)` only (`web_judge.read_invalid` is gone). The script then runs out of replies, giving `{"status":"not_judged","why":"AttemptScriptRefused"}`.
- Watcher: 0 alerts (`test-runs/lab-watch/slot-3-11208/watch-alerts.ndjson`).

## Not verified

- Nothing ran live or against a provider:
  - strict-tool compile limits;
  - how often Sonnet with `auto` replies with no tool call (a paid, accounted refusal);
  - whether a model maps `core_run_node` to the `core.run_node` it reads;
  - DeepSeek's `required` choice on every configured model;
  - token counts (estimated, not `count_tokens`).
- The run's verdict and later deterministic attempts. The oracle was never reached.
- D13's `words` route and its preference for a target's own record over the list were unit-tested only. Column names off bigbox are untested; bigbox's generated classes give mostly `text_N` names.
- C's runs 2-7 were script-only fixes beyond the one rerun its brief allowed. All were provider-free.

## Open questions for the lead

1. **`judge_evidence.before_state_missing` on a read-only task (Core, outside W2).**
   - In `runtime/result-verification/judge-evidence/summary.ts`, the before state is required when the trail has any `role: "action"` step (here the consent and offer dismissals and the filter clicks; `acts: []`).
   - But `answer-first/witnesses/witnesses.ts` reads the before side only before the first *lasting* act, so a read task with only non-lasting clicks never has one, and every completion is held unconfirmed.
   - The fix belongs to answer-first/judging (W1's `attempt`/`completion`, or the unlisted `judge-evidence/summary.ts`). Either read the before witness before the first act of any kind, or require it only when a lasting act ran.
   - Until it is fixed, the scripted bigbox run cannot reach its oracle.
2. **The W1-owned test `answer-first/completion/tests/judge-continues-decider.test.ts`.** Its fake wire reads `body.output_config.format`, which a tools request no longer sends. A1's proven replacement is `test-runs/t1038/a1-judge-continues-decider.patch-target.ts`; the diff is three hunks, a tools-aware fake reply. Apply it at integration or hand it to W1.
3. **The scripted bigbox script overlaps with W1.** `packages/test-runner/src/attempt-lane/scripted-model/scripts/bigbox-retail-rated-delivery-towels.ts` changed for single reads. Its lines are listed in `reports/t1038/c-scripted-lab.md`. It still has a `columns` probe read, because `where` needs column names that are `text_N` on this site.
4. **For W3/Core.** `EXTRACTION_FROM` in Core `runtime/flow-authoring/bootstrap/plan/issue-feedback.ts` still says "Detect the structure first". An auto-drafted read step should copy the read's stored parameters (handle plus saved binding), not the model's `tN`.
5. **For W1.** The detect tool's description in Core `tools.ts` still lacks the `{handle: "tN"}` form. B left it alone to avoid W1's `find_on_page` removal beside it.
6. **Files edited outside the owned lists (in no list):**
   - Core: `runtime/llm/step-log/response-text.ts`, `runtime/llm/session-key-provider.ts` (test seam), `runtime/result-verification/flow-less/tests/judge-unreadable.test.ts`.
   - Downstream: `domain/src/runtime/llm-evidence/plan-resolution/extraction/**`, `domain/src/output-nodes/extract-list/catalog-text.ts` and tests, `domain/src/runtime/llm-evidence/tests/tool-rejection-detail.test.ts`, `packages/test-runner/src/attempt-lane/scripted-model/**`, and the docs `page-evidence.md`, `web-capabilities.md`, `build-loop.md`, Core `automation-studio.md`, `automation-studio/llm-flow-bootstrap.md`.

Worker reports: `reports/t1038/{a1-native-decisions,b-one-read,a2-deepseek-tools,c-scripted-lab}.md`.
