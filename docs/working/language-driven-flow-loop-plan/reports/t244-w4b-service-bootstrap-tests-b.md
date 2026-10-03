# t244-w4b — service-bootstrap tests (b) under the full-run-judged rule

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ`, branch `task/t244-partial-runs-full-judged-gate`.
R = `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing committed.

## Outcome

Done. All 36 tests in the seven owned files pass, and `tsc --noEmit` is clean for the whole package. No source
file was touched and no cause was found in source. `fixtures.ts` and `adaptation.test.ts` needed no change.

| File | Before (fail/pass) | After (fail/pass) |
| --- | --- | --- |
| plan-parameters.test.ts | 5 / 4 | 0 / 9 |
| provider-unavailable.test.ts | 1 / 2 | 0 / 3 |
| state-digest-and-trace.test.ts | 3 / 0 | 0 / 3 |
| unfinished-build.test.ts | 2 / 3 | 0 / 5 |
| unreadable-replies.test.ts | 1 / 1 | 0 / 2 |
| extend.test.ts | 4 / 1 | 0 / 5 |
| adaptation.test.ts | 0 / 9 | 0 / 9 |
| **Total** | **16 / 20** | **0 / 36** |

The "before" numbers come from the verbose run. An earlier non-verbose run of the same seven files reported
18 failed, with adaptation.test.ts among them; adaptation passed in every later run, so that looked like load.

## What changed and why (per test)

### R/tests/replaying-binding.ts (helper; runtime behaviour unchanged)
- **Cause:** it was typed against a private `Executor` (`{callId, toolId, value} & Record<string, unknown>`). So
  `tsc` refused every importer twice: the real binding's `executeTool` would not go into it, and what came out
  was not an `AutomationStudioLlmEvidenceRuntimeBinding`. Inline stand-ins also lost the literal type of `effect`.
  The same errors appeared in other workers' importers (`incomplete-draft`, `deepseek-bootstrap/tests/harness.ts`,
  `refuted-result/tests/repair-replay-chain`).
- **Change:** `automationStudioReplayingBinding<B extends AutomationStudioLlmEvidenceRuntimeBinding>(binding: B): B & { replays }`.
  `executeTool`'s input is typed from the binding, and the private `Executor` type is gone. The name, the
  `replays` shape and the runtime behaviour are unchanged. One doc sentence was added, and the header is still accurate.
- **Result:** `npx tsc --noEmit -p tsconfig.json` exit 0, with no errors anywhere in the package. Before the change it
  printed 125 lines of errors, all in test files that use the helper.

### unreadable-replies.test.ts
- "asks again ... carries on to a proposed Flow". **Cause:** the stand-in said nothing about how to run its
  step again, so the completion was refused `full_run_required` until the budget ran out. **Change:** wrapped the
  stand-in in `automationStudioReplayingBinding`. **Result:** pass. The request count (5) and the judge ordering
  are unchanged.

### provider-unavailable.test.ts
- "carries on to a proposed Flow when an unanswered request is followed by an answer". Same cause and change as
  above. **Result:** pass, with assertions unchanged.

### state-digest-and-trace.test.ts (all 3)
- **Cause:** (1) the act was never added (`add` missing), so the Flow had no proposed step: `proposableSteps: 0`,
  and every completion was refused `full_run_required` with "nothing ran". (2) The stand-in could not replay.
  (3) The provider answered the judge request with a decision.
- **Change:** `add: true` on `call.act`, the stand-in wrapped, and the judge answered with `judgeReply()`. The
  docstring now says why the act is added. **Result:** 3/3 pass with the digest and trace assertions unchanged.
  The digest list is still exactly look before/after and act before/after: replay calls are answered by the
  helper and never reach `captureStateDigest`.

### unfinished-build.test.ts
- "does not end while budget remains ... its Flow is proposed" and "tests and judges what it has, then
  repairs it live ...". **Cause:** the stand-in could not replay, and the provider answered judge requests with
  decisions. **Change:** both stand-ins (`build`, `buildEmpty`) wrapped. Judge requests get `judgeReply()` and are
  not pushed into `requests`, so the per-decision bookkeeping (`requests.length === 1`, repair numbering) still
  counts only decisions. **Result:** 5/5 pass, assertions unchanged.

### extend.test.ts (4 failing)
- **Cause:** each case completed straight over the two steps carried from the Flow on disk (`f1`, `f2`), which
  never ran in this build. That is now refused `full_run_required`.
- **Change:** `serviceWithAppliedFlow` wraps the stand-in and returns its `replays`. Every case that finishes
  first scripts `RERUN_CARRIED`: `amend_draft rerun` of step 1, then of step 3, each with `input: {consequences: []}`.
  **Why step 3:** a rerun takes its step's place and the replaced step stays listed, withdrawn, just after it
  (`R/llm/evidence-loop/rerun-replacement.ts`, splice and renumber). After `f1` is rerun the draft reads
  `[rerun, f1 withdrawn, f2]`. My first attempt used steps 1 and 2 and reran `f1` twice; the diagnostic showed
  `targetedStepIds: ["f1"]` both times. `maxCallsPerRun` went from 4 to 6 (two reruns, at most one step of the
  case's own, the completion, and the judge; with 4 the extra-step case would run out). The stale docstring
  ("carried steps are not run by the build's test, only a judge's yes proposes...") was rewritten to the new rule.
- **Kept assertions:** the node ids of the kept nodes (`after...nodes.map(id)` equal to before;
  `existingIds.nodeIdByKey` `{s1, s2}`), plus the router, Subflow and graph Flow ids. These pass through
  `standsFor`.
- **Added assertion** ("opens for a non-blank Flow"): the build's test replayed both carried nodes in order,
  `replays` with replay not `reset` mapping to `[OPEN_ID, READ_ID]`.
- **Result:** 5/5 pass.

### plan-parameters.test.ts (5 failing)
- **Cause:** the building cases wrote the plan out whole in the reply with no step run in the build, which is
  now refused `full_run_required` ("nothing ran"). The persist case awaited such a build first.
- **First attempt, abandoned (evidence):** run the typing node through `core.run_node` and build the plan from
  the draft. That cannot carry this file's subject. A run-node step writes `ranWith.parameters` into the plan as
  text (`R/llm/node-tools/draft-step.ts`), and the selector is a string parameter, so the completion-time
  resolver received the handle as a string. It refused `example.locator_not_observed` on every attempt
  (diagnostic: `core.decision_unusable resultCode example.locator_not_observed`, draft steps 2). That follows the
  design: a run-node Flow carries what the node ran on, resolved by the domain when it runs. So handle
  resolution at completion applies only to a plan the reply wrote. I restored the file from HEAD and took the
  approach below.
- **Change:** the stand-in gained its own acting tool `example.type_text` (mutate), which is not a node of the
  library. `create(plans, { types: true })` first types the name with that tool and `add: true`, then completes
  with each plan in turn. The Flow now has a proposed step the build's test can run. Core cannot write that step
  down, so the plan is still the reply's, as `bootstrap-completion.ts` says ("The draft wins wherever there is
  one. Where there is none -- a domain whose actions are not nodes of the registry ... -- the reply's own plan is
  still read"). The resolver therefore still resolves the handle in the written plan, and that is the subject.
  The binding is wrapped with the helper. A header paragraph explains this.
  - "builds the node with the parameter the domain resolved from the handle": the request count goes 2 to 3
    (typing step, completion, judge). The parameter assertions are unchanged.
  - "builds a node whose handle carries the location it was seen at": `types: true`. The resolver-call
    assertion is unchanged.
  - "hands a guessed locator back ...": the counts shift by one (4 requests; the refusal is shown before
    decision 3). The trace is now `["tool_call","tool_call","unusable","complete"]` (free look, typing step,
    refused, corrected). The refusal's code, path, and absence of page content are unchanged.
  - "hands a plan the registry refuses back ...": the refusal is shown before decision 3; otherwise unchanged.
  - "refuses to persist a plan that still names a handle, however it arrives": its preceding build now
    finishes, and the test asserts `status: "proposed"` instead of a bare `await`.
  - The four completion-check cases ("keeps asking past three", "handle the domain never issued", "no
    resolver", "names the last refusal") never act and keep their written plans. The check refuses before a
    test arises, so they assert the check's verdict as before, unchanged.
- **Result:** 9/9 pass.

### adaptation.test.ts, fixtures.ts
No change. adaptation passes 9/9.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t244/!FluxIQ/packages/fluxiq`.

- Baseline: `npx vitest run <7 files> --reporter=verbose` gave `Tests 16 failed | 20 passed (36)`. The earlier
  non-verbose run gave `Tests 18 failed | 18 passed`, with all 7 files failed.
- Per file, after each change: `npx vitest run <file>`. unreadable-replies 2/2, provider-unavailable 3/3,
  state-digest-and-trace 3/3, unfinished-build 5/5, extend 5/5, plan-parameters 9/9.
- All seven together, before the helper retype: `Test Files 7 passed (7)`, `Tests 36 passed (36)`.
- `npx tsc --noEmit -p tsconfig.json` before the helper retype: exit 2, 125 lines of errors, all in test files
  using the helper (6 of them in my files). After: exit 0, no output.
- All seven together after the retype, while other workers were running: `Tests 1 failed | 35 passed (36)`. The
  failure was one case in adaptation.test.ts, and I did not capture which case or the message. Durations were
  about twice the earlier run.
- `npx vitest run .../adaptation.test.ts --no-file-parallelism` alone: `Tests 9 passed (9)`. Its slowest case
  took 13.5 s against the 15 s limit.

## Not verified

- Which adaptation.test.ts case failed in the parallel run, and why. The likeliest cause is a 15 s timeout under
  load, since the file passes alone and its slowest case is 13.5 s, but I did not confirm it.
- I did not run the other importers of the helper (incomplete-draft, deepseek-bootstrap harness,
  repair-replay-chain) after the retype. They compile, and the change affects types only.
- No full suite was run, per the repository rule.

## Open questions or contradictions found

- The brief says building plan-parameter tests "must now run and add the steps (the plan is written from the
  draft)". With a library node (`core.run_node`) that loses the subject: a drafted plan carries what the node ran
  on, never a handle, so completion-time handle resolution never runs on it. I used a domain acting tool, whose
  step cannot be written as a node, so the reply's plan is what gets resolved. If the supervisor wants the
  draft-written path covered, the resolver's subject belongs in the domain's run of the node (`ranWith`), not in
  `resolvePlanNodeParameters`. That would be a different test.
- adaptation.test.ts has a case at about 13.5 s alone against a 15 s timeout, which makes it fragile under
  parallel load. It is outside this brief's rule changes.
