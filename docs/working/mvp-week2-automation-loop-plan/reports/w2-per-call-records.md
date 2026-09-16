# Report: w2-per-call-records

Repositories: FluxIQ Core `F:\!FluxIQ` (`AS/` = `packages/fluxiq/src/programs/automation-studio/`) and this repository.
Nothing was committed or pushed. No demo, `pnpm lab` or `--live-llm` command was run.

## Outcome

**Done.** All three brief items are in place and every required check passes.

- **Core records every provider call.** Each run's detail now has one line per call at `metadata.llmGate.providerCalls`, beside `costAccounting`. The count of calls past the record limit is at `metadata.llmGate.providerCallsOmitted`.
  - The lines are in call order. They cover the diagnosis, every evidence-gathering call and the patch.
  - A test proves it for a diagnose, gather, gather, patch run. The run is persisted, read back, and gives four ordered lines whose totals equal `costAccounting` figure for figure.
- **The Lab reads the lines.** `observedCalls` lists every call, and the per-call budget checks now cover evidence calls.
  - A run detail without the lines is reported as `perCallRecords: "not recorded"`, and no zeros are invented for it.
  - Lines that do not cover every counted call fail the run.
- **The adaptation lane can certify an iterating run.**
  - It passes the run's own call count to the certificate.
  - It builds one certificate invocation per call from Core's lines.
  - It refuses, before anything is opened, reviewed or applied, a run whose lines do not cover every call.
- **The type checker now catches a missing count.** The certificate's parameter was typed `unknown`; it is now typed with the certificate's input type. A `@ts-expect-error` test breaks the build if the parameter is ever loosened again.

**Checks.**

| Check | Result |
| --- | --- |
| Core `pnpm check` | exit 0 |
| Core runtime suite | 969/969 on the first full run. On the second run, 968/969: the one failure was the known `instruction-readiness.test.ts` timeout, and that test passes alone. |
| This repository `pnpm check` | exit 0 |
| test-runner tests | 993/993 |
| Structure audit, both repositories | passes, with warning counts unchanged |

## What changed and why

### Core

**`AS/runtime/llm/run-call-record.ts` (new, 137 lines).** This module defines what one call's line is and builds it.

- **Fields.** Each line has:
  - `sequence`, a 1-based count order;
  - `requestId`;
  - `taskKind` and `stage`, each checked against Core's own vocabulary or else `null`;
  - `allowance` (`run` or `exploration`);
  - `promptVersion`, `provider` and `model`, each an identifier or else `null`;
  - `validation: { ok, issueCodes }`, which holds codes only and never a message;
  - `reported`, the provider's own figures, each `null` where the provider reported none;
  - `charged`, what the ledger actually booked, with `tokens` and `cost` each marked `reported` or `reserved`;
  - `budgetBreach`.
- **Why `reported` and `charged` are kept apart.** A reservation must never look like real usage, yet the lines still have to add up to `costAccounting`. When DeepSeek reports no usage, `reported` is all `null` and `charged` says `reserved`.
- **Bounds.**
  - Identifiers must match `^[A-Za-z0-9][A-Za-z0-9._:+-]{0,199}$`.
  - At most 16 issue codes are kept, deduplicated, each matching `^[a-z][a-z0-9_.-]{0,127}$`.
  - Token counts must be safe non-negative integers, and costs finite and non-negative.

**`AS/runtime/llm/run-budget.ts` (the run ledger).**

- **Why the ledger writes the lines.** The ledger is the only place that knows exactly which calls it counted and what it charged. It writes one line at the moment it counts a call, so the lines and the snapshot cannot disagree.
- **Changes.**
  - The reservation takes an optional `call` description.
  - `lease.complete(usage, outcome)` takes an optional outcome.
  - There is a new `callRecords(runId)` method that returns `{ calls, omitted }` as copies.
  - A reservation released without a call gets no line, so the patch-reserve hold never appears.
  - There is a new constant `AUTOMATION_STUDIO_LLM_RUN_CALL_RECORD_LIMIT`, equal to the 250-call backstop. Calls past it are counted in `omitted`, so a short list says it is short.

**`AS/runtime/llm/harness/run.ts`.**

- **What the harness passes the ledger.**
  - At reservation, it passes the call's description: task kind, stage, staged prompt version, provider and model.
  - At completion, on all three paths (success, provider failure, unparseable result), it passes the outcome as codes.
- **Accounting fix (a behaviour change).** The harness used to withhold a provider's usage from the ledger whenever that usage was over the request's limits. The ledger then charged the smaller reservation and never counted the breach, which defeated the ledger's own "charges valid actual overages" rule.
  - The report is now always passed through.
  - For DeepSeek nothing changes: its provider throws on over-limit usage before the harness sees any.

**`AS/recovery/annotation/annotate.ts`.** The run detail's `llmGate` now carries `providerCalls` and `providerCallsOmitted`. The existing interventions are unchanged. `exploration.ts` needed no change, because its calls go through the same ledger.

**`AS/runtime/llm/index.ts`.** The barrel now exports the record types, as types only.

**`service.ts` was not touched and is still 6434 lines. The API contracts, `apps/**` and the docs were not touched.**

**Tests.**

- **New: `AS/runtime/llm/tests/run-call-record.test.ts`, 10 tests.** They cover:
  - the order of lines, and that their totals match the snapshot, including reserved charges;
  - no line for a released hold;
  - a call settled with no description or outcome;
  - a breach line;
  - the limit and the `omitted` count;
  - that `callRecords` hands out copies;
  - sanitization;
  - staged prompt versions and zero figures;
  - the harness's lines for success, provider failure and a garbled result, where the provider's failure message does not leak;
  - an overage charged as reported and counted as a breach;
  - no line for a call the ledger refused.
- **Extended: `AS/runtime/tests/service-adaptation/tests/iterating-recovery.test.ts`.** This is the required proof, run for both `diagnose_and_adapt` and `explore_and_adapt`. The persisted run has:
  - four lines, in the order diagnosis, gather, gather, patch, with the staged prompt versions `…runtime-diagnosis.v1+stage.gather`, `…evidence-tool-decision.v1+stage.gather` and `…runtime-patch.v1+stage.implement`;
  - DeepSeek as provider and model on every line, validation ok, and reported equal to charged;
  - first and last lines whose requests are those of the two model interventions;
  - four distinct requests;
  - charged sums equal to `costAccounting` in calls, input, output and total tokens, and cost.

### This repository

**`packages/test-runner/src/existing-fluxiq-control.ts`.**

- **What it now reads.** There is a new type, `ExistingRunProviderCall`, and `ExistingRunDetail` gains `providerCalls?` and `providerCallsOmitted?`. There is a new strict parser, `runProviderCalls`.
- **What the parser refuses.** It rejects the whole response when:
  - lines are out of order;
  - one of the two fields is present without the other;
  - a request repeats;
  - an issue code looks like a message;
  - a number is negative;
  - a charged value is marked with a source other than `reported` or `reserved`;
  - an identifier is unsafe;
  - there are more than 250 lines.

  Silently skipping a malformed line would reopen the gap these lines close.
- **How it was edited.** The deliberate NUL byte is preserved (it is now on line 606). The edit ran through a node script that asserted exactly one NUL before and after.

**`packages/test-runner/src/live-llm/observed-usage.ts`.**

- **Where `observedCalls` comes from.** It comes from Core's lines when they are present, and adds `requestId`, `taskKind` and `stage` to each call.
- **New fields.**
  - `perCallRecords` is one of `recorded`, `incomplete` or `not recorded`.
  - `unrecordedCalls` is `null` when unknowable.
- **Without lines.** The old intervention-based reading is kept, labelled `not recorded`.
- **Fallback total.** Where Core's accounting is missing, the fallback total cost is the sum of the charged figures.

**`packages/test-runner/src/live-llm/budget.ts`.**

- Per-call breaches now name the task, for example "call 3 (evidence_tool_decision) cost 0.9 …".
- There is a new breach for `incomplete`: "Core counted N provider call(s) but itemized M, so K call(s) escaped the per-call caps". There is a separate wording for when the lines outnumber the count.
- `not recorded` is not a breach, so the Lab still works against an older Core.

**`packages/test-runner/src/demo-llm-adaptation.ts` (the certificate, 397 lines).**

- **Typed parameter.** `evaluateDemoLlmAdaptation(input: DemoLlmAdaptationCertificationInput)`. It still parses at runtime.
- **Exported types.** `DemoLlmAdaptationInvocation` and `DemoLlmAdaptationInvocations` are now exported.
- **Prompt versions are pinned per purpose, either bare or staged.**
  - Diagnosis: `automation-studio.runtime-diagnosis.v1`, optionally `+stage.gather`.
  - Evidence: `automation-studio.evidence-tool-decision.v1`, optionally `+stage.gather`. This is Core's real value; the previous fixture had invented one.
  - Patch: `automation-studio.runtime-patch.v1`, optionally `+stage.implement`.
- **Why the stage is not recorded in the evaluation.** The evaluation's provenance records the schema without the `+stage…` suffix, because the Lab's provenance identifier (`test-contracts` `safeIdentifier`) rejects `+`.
- **Why the old code could not certify a live run.** Its identifier check and its pinned prompt versions both rejected staged versions, and Core always stages recovery prompts.

**`packages/test-runner/src/demo-workspace/adaptation-lane.ts`.**

- **The early refusal.** The recommended wording is applied and still runs before review and apply. The condition is now "Core's count ≠ the number of lines, or lines were omitted".
- **New pure function `adaptationCertificateCalls(run, interventions, events)`.** It builds `[diagnosis, ...evidence, patch]` from Core's lines. The lane calls it right after the refusal, before the proposal is fetched, opened, reviewed or applied.
- **What it refuses by name.** It refuses when:
  - lines are missing;
  - the count does not match, or some lines were omitted;
  - there are fewer than two calls;
  - the events are out of order;
  - the first or last line's request is not the diagnosis or patch intervention's request;
  - a line's task kind is wrong;
  - a call was not made to DeepSeek with the `deepseek-chat` model;
  - a call did not validate;
  - reported usage is missing;
  - the prompt version is missing.
- **How ordering works.** Evidence calls have no run event of their own. On the certificate's ordering scale:
  - each run event sits at its sequence × 1024;
  - an evidence call sits at the diagnosis position plus its offset in Core's order;
  - apply and the first validation sit at the next two event steps after the patch.

  The scale of 1024 is larger than Core's 250-line limit, so evidence calls fit between adjacent diagnosis and patch events. The certificate's ordering check therefore reads exactly Core's recorded order.
- **The certificate call** now passes `providerCallCount: calls.providerCallCount`, `invocations: calls.invocations` and `requestId: calls.patchRequestId`.
- **Removed calls.** The lane no longer calls `requireCompleteAdaptationIntervention` or `adaptationInvocation` (both in `adaptation-ui.ts`, which I do not own). The first pins unstaged prompt versions, so it would refuse every live run. The builder checks the same things on the per-call lines instead.

**Why the type checker did not catch the missing count, and the fix.** `evaluateDemoLlmAdaptation` took `input: unknown`, so any object type-checked. The declared input type was used only as a cast inside the parser. Typing the parameter makes a missing field a compile error. That is guarded by the `@ts-expect-error` test in `tests/demo-llm-adaptation.test.ts`.

**`packages/test-runner/src/demo-llm-adaptation-control.ts` was not changed.**

**Tests (12 new, 3 files updated).**

- **`live-llm/tests/observed-usage.test.ts` (new, 5 tests).**
  - Every itemized call is observed in order.
  - An evidence call over a cap fails the run, and is named. The same run read the old way passed.
  - An unreported figure stays `null`, and the charged totals still bound the run.
  - `not recorded` falls back to the interventions.
  - Short, truncated and overstated lines each fail.
- **`demo-workspace/tests/adaptation-lane.test.ts` (new, 4 tests).**
  - The builder keeps Core's order, passes the run's count and uses scaled sequences, and the certificate accepts its output.
  - A two-call run still certifies.
  - 19 named refusals.
  - A source-level check that the lane passes `providerCallCount: calls.providerCallCount` and `invocations: calls.invocations`, builds the calls once, and does so before the proposal is fetched or applied.
- **`tests/demo-llm-adaptation.test.ts` (+2 tests).**
  - Staged prompts are accepted only at their own stage.
  - The `@ts-expect-error` guard for a missing count.
  - The fixture now uses Core's real evidence prompt, and the unsafe-prompt case now expects the fixed-safety-fact refusal.
- **`tests/existing-fluxiq-control.test.ts` (+1 test).** Exact parsing of the lines, "no lines" read as absent rather than as zero, and nine malformed variants rejected. It went here, not into a new file, because `src/tests` is baselined at 49 files.
- **`live-llm/tests/budget.test.ts`.** Fixtures updated for the new fields, and the old-reader assertions extended.

## Commands run and observed results

| Command | Result |
| --- | --- |
| `npx tsc --noEmit -p .` (Core `packages/fluxiq`) | no output (clean) |
| `npx vitest run …/llm/tests/run-call-record.test.ts …/run-budget.test.ts …/harness.test.ts …/iterating-recovery.test.ts --root packages/fluxiq`, first run | 50/52. Two `iterating-recovery` failures, which were my test's mistake: the persisted run carries a third intervention, the deterministic recovery's diagnosis, which has no request. I fixed the test to compare against interventions that carry a request. |
| `npx vitest run …/iterating-recovery.test.ts --root packages/fluxiq` | 3/3 |
| `npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq`, run 1 | `Test Files 106 passed (106)`, `Tests 969 passed (969)`, exit 0. 959 before, plus 10 new. |
| Same, run 2 (final) | `Tests 1 failed / 968 passed (969)`. The failure was `instruction-readiness.test.ts` at **15,010 ms** (timeout). |
| `npx vitest run …/service-flows/tests/instruction-readiness.test.ts --root packages/fluxiq` | 1/1 passed in **5,301 ms** |
| Core `pnpm check` | exit 0. `structure-audit: passed (140 warning(s), 254 baselined)`, the same count as the previous report. It also prints "1 baseline entries can be lowered", as before. All four workspaces reported `check: Done`. |
| Core `node scripts/structure-audit.mjs` | exit 0, 140 warnings; none names a file I touched. `wc -l service.ts` gives 6434. |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | exit 0 |
| `pnpm --filter @fluxiq-web-extension/test-runner test`, run 1 | `# tests 993 # pass 992 # fail 1`. The failure was my source-level test, which sliced into the builder's own definition; I fixed the slice. |
| Same, runs 2 and 3 (run 3 after the controls) | exit 0, `# tests 993 # pass 993 # fail 0 # cancelled 0` |
| This repository `pnpm check` | exit 0. `structure-audit: passed (57 warning(s), 17 baselined)`, unchanged. All 10 workspaces reported `check: Done`. |
| This repository `node scripts/structure-audit.mjs` | exit 0, 57 warnings. The two warnings on `existing-fluxiq-control.ts` (655 lines; 29 methods) were already there: the file was over 400 lines before, and I added no methods. |

**The 993 count.** 980 before, plus my 12, plus 1 I did not write. The extra test is presumably from the concurrent worker, whose `demo-llm-create-ui/tests/exploration.test.ts` and `tests/demo-llm-exploration-request.test.ts` are modified. I did not check which test it is.

**Negative controls.** For each control, the file was backed up to the scratchpad, broken, tested, restored, and compared byte for byte (`cmp` and `sha1sum -c` both OK). The test-runner `dist` was rebuilt from the restored sources, and `tsc` exited 0.

| Control | Result |
| --- | --- |
| A. `annotate.ts` drops `providerCalls` | `iterating-recovery`: 2 failed / 1 passed |
| B. Ledger keeps no lines | `run-call-record`: 8 failed / 2 passed |
| C. Harness withholds the overage again | 1 failed / 9 passed (the overage test) |
| D. Harness passes no call description | 3 failed / 10 passed, across both files |
| E. Lab reader ignores the lines | `observed-usage`: 4 failed / 1 passed |
| F. No `incomplete` breach | `observed-usage`: 1 failed / 4 passed |
| G. Certificate parameter back to `unknown` | `tsc` exit 2: `tests/demo-llm-adaptation.test.ts(172,5): error TS2578: Unused '@ts-expect-error' directive.` |
| H. Lane drops `providerCallCount: calls.providerCallCount,` | `tsc` exit 2 (`TS2345` at `adaptation-lane.ts(132,51)`), and the lane test gives 1 failed / 3 passed |

## Not verified

- **No real run.** Nothing was run against DeepSeek, and no demo or Lab run was made. Nothing shows a real iterating run producing these lines, or `pnpm demo:llm:adapt` certifying one end to end.
- **Whether the web demo's failed run has exactly two interventions.** The lane still requires exactly two, and so does `requireSourceRun` in the control module. The Core fixture showed that a run can also carry a deterministic-recovery diagnosis intervention.
- **Behaviour under concurrent calls.** Line order is the order in which the ledger counted calls, which is completion order. The recovery path makes its calls one after another, so this equals call order there. Concurrent calls would be listed in completion order.
- **Size.** A 250-line list in the run-summary envelope was not measured. By estimate it is roughly 100 KB, against the 4 MB chunk limit.
- **Wider runs.** I did not run Core `pnpm test` across all packages, `pnpm build` in either repository, or this repository's full `pnpm test`; only test-runner tests were run.
- **`apps/web`.** It passed Core `pnpm check` at the moment it was run, but another worker is editing it.
- **Nothing in the web panel shows the lines.** No UI was changed.

## Open questions or contradictions found

1. **Public contract: no change needed.** The lines live in the run detail's untyped `metadata: JsonObject`. Nothing in `AS/api/contracts/**`, `packages/contracts` or `apps/web/src` types or reads `llmGate`. If the contracts worker wants the lines typed, the exact shape is `AutomationStudioLlmRunCallRecord`, exported from `AS/runtime/llm/index.ts`, at `llmGate.providerCalls: AutomationStudioLlmRunCallRecord[]` and `llmGate.providerCallsOmitted: number`. The two are always written together, and both are absent when no provider was reached.
2. **Dead exports in `demo-workspace/adaptation-ui.ts` (not my file).** `adaptationInvocation` and `requireCompleteAdaptationIntervention` are now unused. The second pins unstaged prompt versions, which live Core never writes. I recommend deleting both.
3. **The stage is lost in the evaluation.** The Lab's provenance contract (`test-contracts` `safeIdentifier`) forbids `+`, so the certificate's evaluation records `automation-studio.runtime-diagnosis.v1`, not `…+stage.gather`. The stage is still pinned by the certificate's own check. Carrying it into the evaluation needs a `test-contracts` change: allow `+` in `promptSchemaVersion`, or add a stage field. Those are not my files.
4. **Only the snapshot shows the coverage status.** `live-llm-run.ts` (not my file) writes the whole observed usage, including `perCallRecords`, to `snapshots/live-llm.json`. But its published details carry only calls, interventions, cost and gate. Adding `perCallRecords` there is a one-line change if operators should see "not recorded" in the summary.
5. **DeepSeek over-limit usage is still booked at the reservation.** When DeepSeek's provider sees over-limit usage it throws `llm.provider_usage_limit_exceeded`. The call is then charged its reservation, `reported` is `null`, and no breach is counted, although the provider knew the real figures. The harness fix does not reach this path. A follow-up in `deepseek-provider.ts` could attach the reported usage to the error.
6. **Documentation not updated (not in my paths).**
   - This repository's `docs/architecture/testing-facility.md` (the `demo:llm:adapt` paragraph) should say that the lane now certifies iterating runs from Core's per-call lines, and refuses a run whose lines do not cover every call.
   - Core's architecture docs could describe `llmGate.providerCalls`.
7. **A small inconsistency in `exploration.ts`.** Its evidence-decision calls carry no `executionPurpose` in their request metadata, while the diagnosis and patch calls do. DeepSeek reads that field only for patches, so I left it alone.
