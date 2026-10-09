# t375 d1: Core re-verification (adaptation unblock)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t375/!FluxIQ`, branch `task/t375-adaptation-unblock`, `git status --short` clean before and after. Paths are relative to `packages/fluxiq/src/programs/automation-studio/` (`R/` = `runtime/`). Read and test only; no source or test edited.

## Outcome

Done. The t267/t273 fixes still hold on this tree. Every re-author, and every runtime patch, waits unapplied until a whole run with it is judged `answers`. The paired (extension) payer rule still holds. Two gaps are open: a person's own session pays for a model check on every succeeded run (Q2), and the chat's success sentence still shows the raw run id and status (Q4).

## What changed and why

Nothing. This was a read-and-verify brief.

## Findings

### Q1. Product run payloads and payers

How the handler decides (`api/handlers/runtime-execution.ts`):
- `llmExecution` is built only when `runIntent` is present and `service.conversations.callerFor(actor)` is not key-locked (:61-75).
- `pairedCaller = caller.paired` (:75).
- `resultCheckCallerPays: "repair_checks"` is passed only when `llmExecution` exists and either the caller is paired or the request asked for `repair_checks` (:92). Any other requested value is refused (:54).
- `callerFor` (`R/conversations/conversations.ts:298`, which calls `R/conversations/commands/caller.ts:33-42`) marks a session as paired only when it starts with `client-gateway:`.

| Path | runIntent | llmExecution | resultCheckCallerPays |
| --- | --- | --- | --- |
| Chat "run it", `context.paired` true (`R/conversations/commands/run-flow.ts:51`; paired set from `caller.paired` at `api/handlers/conversations.ts:281`) | `explore_and_adapt` | Yes, under the person's unlocked session. The port's actor carries that unlocked session, so the handler sees a non-paired session, and the command asks for the rule itself. | `repair_checks`, because the request asked for it (:92) |
| Same, paired but key locked | `explore_and_adapt` | No: `callerFor` returns `keyLocked`, so the run is deterministic | Requested, but dropped because `llmExecution` is absent (:92) |
| Chat "run it", `context.paired` false (web panel chat, person's own session) | `explore_and_adapt` | Yes, the person's session | None, which means `every_run` |
| Extension Automations Run (`client-gateway:` actor, `{projectId, flowId, runIntent:"explore_and_adapt"}`) | `explore_and_adapt` | Yes, if the person has an unlocked session; otherwise deterministic | `repair_checks` via `pairedCaller` (:92) |
| Web panel FlowRunView, explicit model modes (`diagnosis_only`, `diagnose_and_adapt`, `explore_and_adapt`; `apps/web/.../runtime/run-input-model.ts:11-12`, `FlowRunView.tsx:194,209-214`) | The chosen mode, with `adaptiveMode: "manual_approval"` | Yes, the person's session | None (`every_run`) |
| Web panel FlowRunView, other modes (`fully_adaptive`, `manual_approval`, `no_llm_intervention`; `FlowRunView.tsx:236-245`) | None | No | None, and no caller exists |

### Q2. Model calls a run whose every step succeeded can still make

1. **Failure gate.** `R/recovery/annotation/annotate.ts:125` returns before any model call unless `summary.status === "failed"`. `R/service/runtime-session/recovery-state.ts:46` passes succeeded runs straight to that gate. Holds: no ladder call.
2. **Result check.** `verifyAutomationStudioRuntimeSessionResult` (`R/result-verification/run-outcome.ts:270`) runs on every succeeded run.
   - It makes no call when Core's own counts settle the result (:503-505).
   - Otherwise it resolves a provider (:517) and calls it if one comes back. Nothing in it checks `resultCheck.checked`.
   - The provider comes from `resolveAutomationStudioResultCheckProvider` (`R/service/runtime-adaptation/result-check.ts:179-200`):
     - Caller's key: used when `callerPays !== "repair_checks"`, or when the check's code is `after_repair` or `after_refutation` (:189, :203-206).
     - Standing authorization: used otherwise, and only when the schedule chose the run and the authorization was redeemed (:192, :66-103).
3. **Schedule** (`R/result-check-schedule/decide.ts:47-79`). No check at all if checking is disabled or the shape is `never`. Otherwise a run is checked when any of these holds:
   - it repaired itself this run (`after_repair`);
   - the last check was `refuted` (`after_refutation`);
   - its ordinal is in the sequence;
   - the last scheduled check was `unverified` (`reask_unsettled`).

   With the defaults (`settings.ts:47-54`, `ordinals.ts:10-15`), the sequence is ordinals 1, 2, 3, 8, 33, 158, ... within an epoch. The epoch is the Flow's graph revision (`result-check.ts:216`), so the first three runs after every change are checked.
4. **Standing result-check authorization.** It is absent until a person turns checking on (`R/service/flow-settings/result-check-settings.ts:9-13`). Without it, no unattended sampled check is paid for.
5. **Candidate trial and build judge.** Build-time only: `R/service.ts:1554-1580`, inside `generateFlowBootstrapAdaptationInternal`. No post-run judge exists in `runRuntimeSession`.
   - `settleAutomationStudioRunJudgedReauthor` and `settleAutomationStudioRunJudgedPromotions` (`R/service.ts:2534`) only read the verdict; they never call a model.
6. **Refuted-result repair.** `R/service/runtime-adaptation/refuted-result-port.ts` runs only after a check performed and refuted (`run-outcome.ts:298` marks that session failed). From there a re-author build and the patch ladder can call the model, so a refutation reached through (2) can spend more.

Whether a routine succeeded run (nothing repaired, last check not refuted) can make a call, per path:
- **Extension Run, paired chat "run it":** none on the person's key. A call is possible only on the standing authorization, at scheduled ordinals, when one is granted.
- **Non-paired chat "run it", web panel model modes:** yes. One result-check call on the person's key on every succeeded run, whatever the schedule. This includes a Flow whose checking is disabled or set to `never`, because :189 resolves the caller's provider without looking at `check.checked`. **Gap.**
- **Web panel plain Run:** standing authorization only, at scheduled ordinals.
- **Note on `after_refutation`:** for a `repair_checks` caller, the first run after a refuted check is paid by the person's key, even when that run repaired nothing. This is intended (`R/service/runtime-adaptation/tests/result-check.test.ts:240`), but it is a routine run.

Tests that prove zero calls today:
- `R/tests/service-adaptation/tests/caller-paid-result-check.test.ts`:
  - :195 "makes no result-check call for a routine run that succeeded with nothing repaired" and :205 "leaves a routine sample to the Flow's standing authorization". Both call the service directly with `repair_checks`, the service half of the extension Run.
  - :248 "makes no routine result-check call on the person's key". Covers the paired chat "run it" end to end: the command, the real registry and handlers, and the real service.
- `api/handlers/tests/runtime-execution.test.ts`:
  - :71 paired client gets `repair_checks`;
  - :81 a person's own session may ask for `repair_checks`;
  - :100 nothing is asked of a run without a model;
  - :107 a key-locked paired client runs deterministically.

  These use a mocked service: they check the payload only, not the absence of calls.

Test that proves the gap rather than closing it:
- `caller-paid-result-check.test.ts:269` "is judged with the caller's key even when the schedule would not sample it". This is the `every_run` path used by the non-paired chat and the web panel.

Coverage gaps:
- No test drives the extension Run end to end (paired `client-gateway:` actor, real handler, real service) and counts zero calls.
- No test covers a non-paired chat "run it".
- No test covers a Flow with checking disabled under an `every_run` caller.

### Q3. Re-author under candidate mode

Both re-author routes hold the edit unapplied until the judged re-run, on every path.
- **Build, approve, hold.** Both routes go through `automationStudioReauthorBuild` (`R/service/runtime-adaptation/reauthor-build.ts:91-175`): build, then `approve` with `hold: true` (:144-145). Nothing there applies.
- **Re-run without applying.** `R/service/runtime-adaptation/repair-rerun.ts:153-161` runs the held graph unapplied. For an unsupported topology or an unreadable edit it declines (:156-157). Its `applyFlowBootstrapAdaptation` port is declared as "Legacy compatibility; never apply before judgement" (:85-86) and is never called in that file.
- **The only apply.** `R/service/runtime-adaptation/judged-reauthor.ts:132-152`, on `automationStudioJudgedPromotionOutcome` (`R/service/runtime-adaptation/judged-promotion.ts:117-127`). It needs all of: the pass ran this edit, the session succeeded, `resultVerification.performed === true`, and the verdict is `answers`. Otherwise the edit is rejected and the reason recorded.
- **Runtime patches.** `judged-promotion.ts:327` is the only call to `applyFlowAdaptation`.

`appliedBeforeJudged` does not exist in any non-test source. The only reference is a test asserting it is absent (`R/tests/service-adaptation/tests/judged-reauthor.test.ts:215`). The S4 fallback is unreachable because it no longer exists.

Authoring mode of a re-author build:
- The request is `{projectId, flowId, mode:"extend", evidenceGuided:true, caller, permittedConsequences?}` (`reauthor-build.ts:127-131`), with no `authoringMode`.
- `R/service/flow-bootstrap-commands/generation-request.ts:32,51,69` sets candidate mode only when the request carries `"candidate"`.
- So a re-author always runs the legacy evidence-guided extend round (`R/service.ts:1584` onward), whether or not the chat authors candidates (`R/conversations/commands/build.ts:132-138`).

Candidate-mode code applying an edit before a whole run is judged `answers`: none found.
- **Promotion.** The candidate trial runs the exact candidate once from its declared start (`R/service.ts:1557`). `promoteAutomationStudioCandidateTrial` (`R/service/candidate-trial/promotion.ts:41-57`) only creates a proposed adaptation, and only for a standing `yes` on the exact revision and digest.
- **What `yes` means.** In the build-test judge, `yes` is `answers` (`R/result-verification/build-test/judge.ts:13,209,222`).
- **Chat apply.**
  - `R/conversations/commands/improve.ts:66-69` asks the person before applying.
  - `explore.ts:74` and `create-here.ts:81` apply a proposal right away, but only on a blank Flow, and in candidate mode only after that judged trial. A draft is never applied (`explore.ts:66`).
  - `R/conversations/commands/apply.ts` does not check that a trial stands behind the adaptation. It relies on proposals existing only after one. This is not a gap today; it is worth knowing.

### Q4. Item 24: the chat's success sentence

The succeeded template is at `R/conversations/commands/run-flow.ts:67`:

```ts
const summary = `The run${runId ? ` ${runId}` : ""} ended ${status}${reason}.`;
```

- `reason` (:60) is `: <terminalReason>` whenever the terminal reason differs from the status.
- The summary is passed to the thread verbatim (`progress.ts:41`).
- It therefore contains the raw run id, the raw status word, and the raw terminal-reason text. `R/conversations/commands/tests/run-flow.test.ts:78,92,104,112,123,139,150` pin the output `"The run run.7 ended succeeded."`.
- The failed and cancelled branch (:62-66) is already in plain words, with no id.

Naming the Flow:
- `AutomationStudioConversationCommandContext` (`R/conversations/commands/command.ts:52-88`) has no `flowName`.
- Only the announcement view has one (`command.ts:125-131`), filled by `R/conversations/instructions/respond.ts:131` from the thread's flow list. That is how `run-flow.ts:45` says `Running "<name>" now`.
- For `run()` to name the Flow it would need the name added to the context, or a read through the port (`get-flow` is a read endpoint, `api/contracts/endpoints.ts:40`). `port.ts:17` allows `read` endpoints.

## Commands run and observed results

From `packages/fluxiq`:

`npx vitest run R/conversations/commands/tests/run-flow.test.ts api/handlers/tests/runtime-execution.test.ts R/tests/service-adaptation/tests/caller-paid-result-check.test.ts R/tests/service-adaptation/tests/caller-paid-reauthor-check.test.ts R/tests/service-adaptation/tests/judged-reauthor.test.ts R/tests/service-adaptation/tests/judged-run-evidence.test.ts R/service/runtime-adaptation/tests/judged-reauthor.test.ts R/service/runtime-adaptation/tests/result-check.test.ts`

The command was run with full `src/programs/automation-studio/...` paths. It exited 0 and printed `Test Files 8 passed (8)`, `Tests 71 passed (71)`.

| File | Tests passed |
| --- | --- |
| `result-check.test.ts` | 19 |
| `run-flow.test.ts` | 10 |
| `runtime-adaptation/tests/judged-reauthor.test.ts` | 18 |
| `runtime-execution.test.ts` | 12 |
| `caller-paid-reauthor-check.test.ts` | 1 |
| `judged-run-evidence.test.ts` | 2 |
| `service-adaptation/tests/judged-reauthor.test.ts` | 3 |
| `caller-paid-result-check.test.ts` | 6 |

## Not verified

- No Lab, browser or provider run.
- I did not test the extension's own client code: that it really sends `{projectId, flowId, runIntent:"explore_and_adapt"}`. I took that from the brief.
- I did not trace whether `verifyAutomationStudioRunResult` itself can skip a call when the provider is present but the cost ceiling is zero.
- I did not read `held-candidate.ts` beyond its topology refusals, or `R/recovery/refuted-result/held-reauthor.ts` beyond the marker readers used above.
- The web panel was read only, not run.

## Open questions or contradictions found

1. Should an `every_run` caller (a non-paired chat "run it", or a web panel model run) still pay for a check on every succeeded run, including on Flows with checking disabled or set to `never`? `result-check.ts:189` makes it do so, and the comment at :146-150 calls this "how it has always been". It contradicts the item-23 aim of no routine model calls on a person's key.
2. Is paying for the `after_refutation` check of a routine `repair_checks` run intended, when that run repaired nothing?
3. The comment in the handler at `runtime-execution.ts:87-91` and the command's payload agree. The `R/service/runtime-adaptation/result-check.ts:170-172` comment still says "a person's own session passes nothing", which is now incomplete: the chat's paired "run it" passes `repair_checks` explicitly.
