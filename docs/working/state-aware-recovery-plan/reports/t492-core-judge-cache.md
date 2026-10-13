# t492 Core half: judge request keeps a byte-stable prefix

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t492/!FluxIQ`, branch `task/t492-judge-cache-and-overact-oracle`. Nothing committed.

## Outcome

Done. The fix is smaller than D1 suggested. On the real run's requests, the move takes the shared user-message prefix of two trial judges from 1,128 to 1,855 characters, about 200 more cached tokens per judge. Most of D1's $0.0138 is the trial's own result summary, which changes from one trial to the next. See "Open questions" for the one further placement gain, which is in a file I do not own.

## What changed and why

- `packages/fluxiq/src/programs/automation-studio/runtime/llm/harness/context-packet.ts` (`packAutomationStudioLlmContext`): the packet's key order is now `schemaVersion, taskKind, stage, promptVersion, projectId, flowId, instructions, policyGates, runId, subflowId, nodeId`, followed by the varying evidence in the same order as before, then `metadata`. Before, `runId`, `subflowId` and `nodeId` came before `instructions`, and `policyGates` came near the end.
  - The ids are **moved, not removed**. They are opaque handles that the model reads by key name, never by position, so the model loses no meaning. They stay in the packet because the evidence they identify refers to them: recent actions carry attempt ids, and a runtime diagnosis or patch names its node.
  - `policyGates` moved forward because it is the same for every call about one Flow. Left after the varying evidence, it was re-billed on every call.
  - No wording changed. The only text added is a code comment that explains the order rule.
- **Result check:** it has the same defect and the same builder. Both the trial judge and the Flow run's result check are `loop_verification` packets built by `packAutomationStudioLlmContext`, and DeepSeek sends the packet as `context` unchanged for every non-evidence, non-bootstrap task kind (`deepseek/request-body.ts` `providerUserPayload`). There is no separate result-check packet builder. In 0057, `runId` and `subflowId` sat before `instructions`, and `policyGates` (442 characters) came after `recentActions` and `resultSummary`.
- Evidence decisions and one-shot builds are unaffected, because their wire payload picks keys explicitly in `request-body.ts`.
- New test `.../llm/harness/tests/judge-request-prefix.test.ts`. It renders two judges for two trials of one build, and two result checks for two runs of one Flow, through the real DeepSeek adapter's outbound body. It asserts that the shared prefix covers `taskKind`, `outputSchema`, `context`, `projectId`, `flowId`, `instructions` and the whole of `policyGates`, in that order, and that the two requests first differ inside the `runId` value. It also checks that the ids are still carried, after `policyGates`.
- `.../llm/harness/tests/in-run-repair-slot.test.ts`: this test pins a runtime-patch request's sha256 and length. The length held at 2941 and the digest changed, which is what a pure reorder should do. I re-took the digest (`5317e954…aed0`), added an assertion on the exact context key order, and added a comment that says why the digest changed. This file is in `harness/tests/`, beside the builder, so I treated it as within "the tests beside it".
- `deepseek/tests/system-prompt-pins.json` was not touched, because no system-prompt layout pins moved.

## Commands run and observed results

- Fail-first: `npx vitest run src/.../llm/harness/tests/judge-request-prefix.test.ts` against the original builder failed 3 of 3 tests: `"instructions": expected 1152 to be less than 1114`, `"instructions": expected 1168 to be less than 1103`, `runId: expected 5 to be greater than 11`. I re-ran the final test against the HEAD version of `context-packet.ts`, which I swapped in temporarily and then restored. It gave the same 3 failures.
- `npx vitest run src/programs/automation-studio/runtime/llm/harness src/programs/automation-studio/runtime/llm/tests src/programs/automation-studio/runtime/llm/deepseek` (in `packages/fluxiq`): `Test Files 79 passed (79)`, `Tests 914 passed (914)`. The first run before the pin update showed 2 failures: the in-run-repair digest pin, and my own test's tail assertion, which I then fixed.
- `npx tsc --noEmit -p .` (in `packages/fluxiq`): exit 0.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (338 warning(s), 1159 baselined)`. It also said "2 baseline entries can be lowered". Neither entry is from my files, and `.structure-baseline.json` is not mine to update.
- Measurement: I applied the same reorder offline to `~/FluxStuff/lab-runs/2026-10-12/run-mv6bg8sv-99895ba1/steps/{0035,0041,0057}-judge/request.json`. The shared user-message prefix went from 1,128 to 1,855 characters for 0035/0041, and from 1,117 to 1,836 for 0035/0057 and 0041/0057.

## Not verified

- No Lab, provider or live run, so I did not observe DeepSeek's actual cached-token figure. The roughly 200 tokens is a character-count estimate, and DeepSeek caches in blocks, so the realized gain may be one block more or less.
- The full Core suites were not run, as the brief said. Any other test that pins a whole packet's bytes or key order outside the three directories was not exercised. Two candidates found by grep are `runtime/recovery/tests/context.test.ts` and `runtime/service/runtime-adaptation/tests/judged-promotion.test.ts`; they mention `runId`, but I did not run them.

## Open questions or contradictions found

- **Most of D1's cost cannot be fixed in the packet.** Between trials 1 and 2 (0035/0041), `resultSummary` diverges at its 78th character (`totalRecordCount` 2 vs 1), and `flowShape` (38k vs 25k characters) differs between revisions. That is the trial-specific evidence the debug note could not size.
- **One further placement gain, outside my ownership.** `resultSummary.startView` (4,125 characters, about 1k tokens) was byte-identical in both trial judges, but it is the last key of the summary, after every varying count. Placing it first in the summary would let later judges of one build reuse it. The summary's key order is set in `runtime/result-verification/**`, which t493 owns, so I did not reorder it, not even from the packet. I recommend raising it with t493 or a follow-up.
- `metadata` stays last. It is caller-supplied, and I did not audit whether every caller keeps it constant.
