# t991: fixes for the domain failures in the 2026-11-23 sweep (worker report)

Worker: worker-heavy, 2026-11-23. Worktree `fxwork/t991-sweep-fix-domain` on downstream 0a4f5a515, with the shared Core at 2dba34613 (read-only).

## Outcome

Done. I reproduced all 14 failures in this worktree; none came from the sweep tree alone. They have five causes. One is a real product regression, which I fixed in domain source. The other four are tests that pinned behaviour a later, approved change replaced on purpose. I updated those tests to the new contract and cited the change behind each. No assertion was weakened and no test was deleted. The P4 fixture finding also uncovered a separate Core defect, reported under "Open questions" (Core was not edited).

## What changed and why, per cause

### A. Product regression: retained definition columns made ordinary reads fail on clients without definition support (1 test)
- Test: 1039 `the bound production evidence gateway sends one supported or ordinary read normally` (`definition-capability/tests/binding.test.ts`).
- Broken by: t982 ba64bbf1c ("Checkpoint schema-backed extraction retention"). Since then, every read of a detected list keeps every detected column. In the fixture list, two columns read a semantic definition. So the ordinary read (`fields: {edition: "ordinary_edition"}`) also sent `edition_2` and `edition_term` as definition reads. A client without `web.extract.definition` then had the whole read refused with `web.action.not_implemented`, even though nothing the model asked for needed the feature. I confirmed this by instrumenting the dispatched request.
- Fix: new `domain/src/runtime/definition-fields/admission.ts` (`webDefinitionFieldAdmission`). When a client cannot read definitions, a definition column is left out of the request sent to the browser only if the read merely retains it. That means all of these hold:
  - `recordOutput.process.columns` names the answer's columns and does not include it;
  - it is not `required`;
  - no other member of the request names it (conditions, sort, dedupe keys, `primaryKey`, and so on);
  - nothing dedupes by the whole row.

  The stored schema keeps the column as optional, so the value is simply absent. An old reader never gets to read wrong text under that key. Anything else still refuses exactly as before, and a capable client gets the read unchanged.
- Shared helper: `definition-fields/active-field.ts`. Both call sites now use admission: `runtime/llm-evidence/tools.ts` (the evidence runtime's `executeAction`) and `io/gateway-output-dispatcher.ts` (the Flow output path, whose command and interrupted-dispatch reading now use the admitted payload).
- New tests:
  - `definition-fields/tests/admission.test.ts`, 4 tests. They cover leaving a column out, a capable client getting the same read, 10 dependency cases plus an inline condition that still refuse, and pass-through.
  - One dispatcher test in `io/tests/gateway-output-dispatcher-definition.test.ts`.

### B. Superseded by t982 (ba64bbf1c): the resolved read carries `recordOutput` and keeps every detected column (6 tests)
Contract: `docs/architecture/retained-extraction.md` and plan rule U3 ("extraction keeps every column; output projection happens in processing"). The resolver now adds the retained detected columns after the requested ones. It also adds a `recordOutput` holding the full schema, with `process.columns` set to the requested view.
- 1990 `dotted extractList.fields ...` (`dotted-parameters.test.ts`). The keys are now `["extractList","recordOutput"]`, still with no dotted key. The fields are the requested `name`, `price` followed by every other detected key, taken from the capture. `process.columns` is exactly `["name","price"]`.
- 2029 `the record's handle with two of its columns ...` (`one-record.test.ts`). The full expected value now includes the retained third span and the exact `recordOutput`. The draft read-back now withholds all three selectors, which is what a re-author is shown.
- 2030 `a receipt detected as a list of one ...` (`one-record.test.ts`). The full expected value now includes the retained `submitted` column and `recordOutput` with `process: {limit:1, columns:[role,company,reference], minRows:1}`.
- 2091 `an extraction handle becomes the request ...` and 2095 `a misplaced or malformed handle ...` (`resolve-plan-node.test.ts`). The full expected values now include the exact `recordOutput`.
- 2034 `a list nobody detected, ... another Flow's keys ...` (`own-extraction-list.test.ts`). The kept step now holds the retained columns under their detected keys. Flow two's own detection uses those same keys, so it legitimately gets those selectors back. The test now checks two things separately:
  - The plan's keys (`name`, `price`, `url`) still resolve as `unchanged` in flow two. This is the original assertion, unchanged.
  - A new assertion: the plan's keys get no selector, while every retained detected key gets back exactly the selector flow one kept.

### C. Superseded by Core t989 (b967bf34f): one generic grammar sentence changed (1 test)
- 2219 `loop: explicit web examples reconstruct the pinned original UTF8 bytes` (`script-examples/tests/parity.test.ts`). t989 replaced the sentence about rows a Flow reads and `recordOutput.process` in `AUTOMATION_STUDIO_FLOW_SCRIPT_LOOP_FORMAT`.
- I checked that this is the only difference. With the old sentence put back, the rendered loop section is exactly the old pin: 8977 bytes, sha 206bc7db…. I re-pinned it to 9227 bytes, sha d478e980…, with a comment.

### D. Superseded by Core t968 (f30024d9c, merged in d33a47c69): a certain no-effect counts as a lost target (1 test)
- 3008 `four verified paging no-effects exhaust the normal first-plus-three ladder ...` (`paging-progress/tests/evidence.test.ts`). `automationStudioStaleTargetFailure` now treats `certainNoEffect: true` as a lost target. As a result, Core asks once, just before the last attempt, to find the target again from its source step. This matches the stale-target rule in AGENTS.md and the t968 note that "no-effect acts count as failures".
- I updated the title and the assertions: `refreshed === 1` and `result.reacquire === "unavailable"`. The checks of 4 attempts, 4 sends, 0 advances, `checked === 0` and an unacted retryable failure are unchanged.

### E. Superseded by Core t983 / P4 (002650596): automation defaults to claude-haiku-5-5 (5 tests)
- 2936 (`carried-row-service-repair.test.ts`) and 2937–2940 (`carried-service-repair.test.ts`).
- The fixture's only key is DeepSeek, and the Flow named no model. Under P4 (plan rules U7 and U6), the run and its judge request `claude-haiku-5-5`. The run metadata showed provider `anthropic`, model `claude-haiku-5-5`, `llm.provider_secret_unavailable`, then `core.result.verdict_unavailable` with 0 model calls.
- Fix: both fixtures' Flow metadata now names its key's model explicitly (`llmProvider: "deepseek", llmModel: "deepseek-flash"`). P4's documentation says an explicit task model is retained. No assertion changed.

## Commands run and observed results
- Reproduce: `DOMAIN_TEST_BUILD_LABEL=t991 node .../heavy-slot.mjs run t991-repro -- node scripts/test-domain.mjs <10 fragments>` printed tests 53, pass 39, fail 14. These are the same 14 as the sweep.
- Diagnosis runs, each on a single file without the heavy slot, using temporary instrumentation that I reverted afterwards:
  - own-extraction-list key dump;
  - the definition request dump;
  - carried run metadata;
  - carried fixture with `llmProvider` only: 4 of 6 still failed, with `verification_did_not_finish`, `failureCode: "Error"`;
  - carried fixture with provider and model: 6/6 passed;
  - parity old-sentence probe: 8977 bytes and the old sha.
- Affected tests after the fixes (heavy slot `t991-rerun`), covering binding, dotted, one-record, own-extraction-list, resolve-plan-node, parity, both carried files, paging-progress, definition-fields and the dispatcher definition tests: tests 68, pass 68, fail 0.
- `pnpm --filter @fluxiq-web-extension/domain check` (heavy slot `t991-check`): exit 0. core-build reported that Core's build is current, and the domain:check step ran (44,967 ms).
- `node scripts/structure-audit.mjs`: "structure-audit: passed (258 warning(s), 551 baselined)".
- Tests that import the changed dispatch modules (heavy slot `t991-importers`: `io/tests`, adapter-check-wait, llm-evidence tools, result-observation, structure detect, output-nodes native-runtime and definitions, definition-fields, plan-resolution/extraction): exit 0, tests 246, pass 246, fail 0.

## Not verified
- Full domain suite: not run, per the brief. Tests that do not import the changed files were not rerun.
- Browser behaviour of admission against a real old extension build. This repository's extension declares the definition capability, so only older or third-party clients reach the new path.
- `docs/architecture/retained-extraction.md` does not yet describe how old clients are handled. It is outside my owned paths.

## Open questions or contradictions found
1. **Core defect (not edited).** `packages/fluxiq/src/runtime/llm/role-routing/judge-model.ts:5-7`, `automationStudioLlmRunJudgeModelId`, falls back to `claude-haiku-5-5` without checking the selected provider. The caller is `framework/automation-service/service.ts:2475`, which passes `providerId` from the Flow's `llmProvider` but takes `modelId` from that function. So a Flow that selects only `llmProvider: "deepseek"` gets a judge request of `deepseek` plus `claude-haiku-5-5`. The resolver's `assertAutomationStudioLlmModelBinding` then throws, and every result check ends `core.result.verification_did_not_finish` (`failureCode: "Error"`).
   - This contradicts P4's own contract ("an explicitly selected other provider keeps its compatible default") and the way `role-routing/resolution.ts` and `task-model/resolve.ts` already handle `providerId === "deepseek"`.
   - Observed directly with the carried fixture set to provider only. The fixtures here avoid it by naming the model too, so this needs its own Core fix and Core test.
2. Product question for the lead: since P4, a workspace whose only key is DeepSeek and whose Flow names no provider gets Haiku for build, repair and judge, and fails with `llm.provider_secret_unavailable` instead of using the configured key. This is consistent with "Automation defaults to claude-haiku-5-5", but worth confirming as intended.
3. Documentation follow-up (lead-owned path): add the old-client rule for retained definition columns to `docs/architecture/retained-extraction.md`.
