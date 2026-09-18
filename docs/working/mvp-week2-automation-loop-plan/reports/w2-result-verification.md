# w2-result-verification — ask whether the result answers the request

Outcome: **Done** (Core only; no domain change was needed).

## Did `loop_verification` fit?

Yes, and it needed no new output shape. `AS/runtime/llm/harness/task-kind.ts`
already declared it, already routed it to the `diagnosis` expected output
through `automationStudioLlmTaskExpectsDiagnosis`, and it was already allowed by
`grant-capabilities.ts` (`LOOP_PROTOCOL_TASK_KINDS`) and by
`runtime-session-grant.ts`. All of that is used as-is.

The one thing the diagnosis envelope did not have was a field meaning "does this
answer the request". It carries `stillAchievable` and
`deterministicRecoveryPossible`, which are about a *failure*, not a *result*. So
one field was added to the same named channel, in the same three-word form:

- `AutomationStudioLlmDiagnosisFields.answersRequest?: "yes" | "no" | "unknown"`

That is the narrowest possible extension: the channel is already a closed,
name-by-name allowlist, checked in `provider-result.ts`
(`validateUnknownDiagnosisFields`), declared with `additionalProperties: false`
in the provider's `DIAGNOSIS_FIELDS_SCHEMA`, and carried by
`stripAutomationStudioLlmResponseMetadata`. Adding a response `kind` would have
multiplied output shapes, which is exactly what the task-kind file says the loop
kinds avoided.

**The call is deliberately made outside the stage protocol** (`stage` is not
passed). `automationStudioLoopStageTransition` refuses a run that starts at
`verify`, and the refusal is right: a result verification is not the fifth stage
of a recovery, it happens on every finished run whether or not a recovery ever
ran. The packet already supports "a call made outside the protocol".

## The verdict contract

`AS/runtime/result-verification/contracts.ts`:

```
AutomationStudioResultVerdict = "answers" | "does_not_answer" | "unsure"
AutomationStudioResultVerification = {
  schemaVersion, verdict, basis, code, reason, observation, failure?
}
AutomationStudioResultVerificationOutcome =
  | (AutomationStudioResultVerification & { performed: true })
  | { performed: false; code; reason }        // never a verdict
```

- `basis` is `core_observation` | `model` | `model_silent` | `model_unavailable`,
  so a reader can tell a judgement from an unanswered question.
- `reason` is a sentence a person reads; `observation` is the specific fact
  behind it — counts, refusals and the Flow's step list.
- `failure` is present exactly when the verdict is not `answers`:
  `output_not_observed` for `does_not_answer` ("the action reported success and
  its intended effect was never observed", one level up), `ambiguous_or_unknown`
  for `unsure`. **No new failure category was introduced.**

**Core's words, not the model's.** `structured-diagnosis.ts` states the rule that
a model's prose is its reading of a medium Core deliberately does not store, so
`reason` and `observation` are composed by Core from its own counts and the
verdict word. The model's `expected`/`observed`/`changed` are never recorded. A
test asserts that (`verdict.test.ts`, "never records the model's own prose").

## Where it fails closed

`automationStudioResultVerificationAnswers` is the single reader of a verdict and
returns true only for `answers`. Everything else carries a failure record:

| Situation | Verdict | Run outcome |
| --- | --- | --- |
| `answersRequest: "yes"` | `answers` | stays `succeeded` |
| `answersRequest: "no"` | `does_not_answer` | **`failed`**, `output_not_observed` |
| `answersRequest: "unknown"` | `unsure` | **`failed`**, `ambiguous_or_unknown` |
| reply carried no `answersRequest` | `unsure` (`verdict_absent`) | **`failed`** |
| call did not come back usable | `unsure` (`verdict_unavailable`, names the provider code) | **`failed`** |
| stored records could not be read | `unsure` (`unreadable`, names the error's *name*, never its message) | **`failed`** |
| zero rows stored | `does_not_answer` (`no_records`) — **no call spent** | **`failed`** |
| every row refused by record validation | `does_not_answer` (`every_record_refused`) — **no call spent** | **`failed`** |

Two situations are deliberately **not** verdicts and leave the run alone, with
the reason recorded as `performed: false`:

- the run stored no record set at all (`nothing_to_judge`) — a sign-in or a
  button press has no result of this kind;
- no model could be asked (`no_model_available`) — none configured, or the run's
  grant does not authorize `loop_verification`.

That distinction is load-bearing. Treating "nobody could be asked" as `unsure`
would fail every run in a deployment with no model configured, which is not the
defect. Treating it as a pass would be. It is recorded as neither.

The verification runs **only on a run that reported `succeeded`** — a run that
already failed is already telling the truth, and a second reason costs a call.

## What is sent, and how it is bounded

One call, never a loop. New packet slot `context.resultSummary`, restricted to
`loop_verification` in `packAutomationStudioLlmContext` exactly as
`failureEvidence` is restricted to the runtime tasks.

`summarizeAutomationStudioRunResult` builds it from the run's dataset summaries
and the first page of each set. Ceilings live in
`AS/runtime/loop-limits/result-summary.ts` — the directory the audit config names
for a value two directories read and neither owns:

- 4 record sets, 4 sample rows per set, 8 sample rows in all, 24 columns per set;
- 120 characters per sampled value (cut and marked), nested values replaced by
  `[withheld]` rather than walked;
- 40 Flow steps; 4,000 bytes for the whole summary. Over budget, **every sample
  is dropped** rather than a large one sent.
- `withheld: true` whenever anything was cut, so a sample of four out of 240 can
  never read as four out of four.

Screening: every sample goes through `screenAutomationStudioLlmEvidence` — the
same screen every other evidence slot passes: the bound domain's declared denied
keys and Core's credential shapes. A sample that fails is **dropped whole**. With
no declared-keys list, **no row is sampled at all** (absent means nobody said,
never "deny nothing"). Stored rows have already had their `exclude` fields
removed by the record schema's allowlist copy before reaching the store.

Pre-send: `automationStudioLlmRequestEvidenceRefusal` now checks the slot under
its own new pre-flight code `llm.provider_result_summary_invalid` (declared in
`provider-contract.ts`, mapped to `END_GRANT` in `failure-disposition.ts`, and
named in the Flow-bootstrap code map). Denied keys are looked for in the sampled
rows only — every other key is Core's envelope — and credentials everywhere.

**Nothing was widened in `domain/src/runtime/llm-evidence/`.** No domain file was
touched at all; the row values come from Core's own dataset store.

Also sent: the Flow's authored shape (`nodeId` + `definitionId` per node). That
is what makes the fourth measured defect visible — a request to filter that
produced navigate → extract → end has no step that could ever have narrowed
anything. The same identifiers already travel in `context.recentActions`.

## Mutations — each run, each observed, each reverted

| Mutation | Observed |
| --- | --- |
| Treat `unsure` as answering (`automationStudioResultVerdictFromDiagnosis` returns `answers` for anything but `no`) | **5 tests failed**: `verdict.test.ts` "reads the three answers…", "fails closed on unsure", "fails closed on a reply that never said"; `run-outcome.test.ts` "fails closed when the model is unsure", "fails closed when the reply never says". Reverted; 30/30 pass. |
| Report success when the record count is zero (`totalRecordCount > 0` → `>= 0`) | **4 tests failed**: `core-observation.test.ts` "refuses a run that stored no records at all", "refuses a run whose every row was refused…"; `run-outcome.test.ts` "fails a run that stored nothing without spending a call", "fails a run whose every row was refused, without spending a call". Reverted. |
| Ignore validation refusals when every row was refused (`totalRefusedCount > 0` → `false`) | **2 tests failed**: `core-observation.test.ts` "refuses a run whose every row was refused, and says so distinctly"; `run-outcome.test.ts` "fails a run whose every row was refused, without spending a call". Reverted. |

## Where it is wired in

`AutomationStudioService.runRuntimeSession`, at both terminal returns (the
Router-selected path and the direct path). `service.ts` sits **exactly at its
ratcheted 6,405-line budget**, so the two call sites and the ports literal were
paid for by compacting the `startInput` assembly in the same method: the file is
6,405 lines again and `structure-audit` passes.

Everything the verification reaches outside itself is a port
(`AutomationStudioResultVerificationPorts`), for the reason
`recovery/annotation/ports.ts` gives — a path that needs a project directory and
a live run to drive is a path nobody asserts on. The dataset ports are optional:
absent where the deployment stores no records, which is configuration, not a
failure.

`deepseek-provider.ts` was at 798 lines and the new prompt pushed it to 807, so
the two diagnosis prompt instructions moved to
`AS/runtime/llm/diagnosis-instructions.ts` (adapter back to 800). Prompts are not
adapter mechanics, and an unrelated file's line budget is the wrong reason to
make a design decision.

## Validation — observed output

Run from inside `packages/fluxiq`, never a repository root.

- `npx tsc --noEmit` → exit 0.
- `npx vitest run src/programs/automation-studio/runtime/result-verification`
  → `Test Files 4 passed (4)`, `Tests 30 passed (30)`.
- `npx vitest run …/runtime/llm/tests …/result-verification` → every file in both
  directories passed except the three execution-grant files (below);
  `deepseek-evidence-preflight.test.ts` 14 passed (including the new result
  summary pre-send case), `diagnosis-channel.test.ts` 3 passed,
  `failure-disposition.test.ts` 6 passed.
- `node scripts/structure-audit.mjs` (repo root) →
  `structure-audit: passed (162 warning(s), 361 baselined)`.

### Two existing tests updated, because my change extends a counted vocabulary

- `failure-disposition.test.ts`: "eighteen pre-send refusals" → nineteen
  (`toHaveLength(18)` → `19`).
- `diagnosis-channel.test.ts`: the diagnosis schema's key list now includes
  `answersRequest`.

Both failed before the update and pass after; no other list in either repository
enumerates these codes (grepped for `provider_exploration_evidence_invalid` and
for `stillAchievable` across both checkouts).

### Pre-existing failures that are not mine

The full Core suite reports **69 failures across 12 files**, all in two blast
radii, and all from a sibling agent's commit `37679ce` "Size the token limits to
the model, not to a number nobody chose", made at 16:33 during this task:

- `Error: LLM token limits are invalid.` thrown at `execution-grants.ts:197` —
  `execution-grants.test.ts` (24), `execution-grant-failures.test.ts` (21),
  `execution-grant-lifetime.test.ts` (7), `runtime-llm-grants.test.ts`,
  `api/contracts/tests/llm.test.ts` (2), `llm-generation.test.ts`,
  `iterating-recovery.test.ts` (2), `execution-digest.test.ts`;
- `structured-diagnosis.test.ts` (4) and `plan.test.ts` (4) on `explorationNeeded`
  and `loopStage`.

`git show --stat 37679ce` changed exactly `execution-grants.ts`,
`structured-diagnosis.ts` and `deepseek-provider.ts`, and **no test file**. My
diff touches neither of the first two. `git diff` on `deepseek-provider.ts`
confirms my four edits sit on top of that commit and clobbered nothing.

`global-docs.test.ts` and `durable-patches.test.ts` each failed once in a full
run and passed when run alone — the machine's known RAM fault.

## Not verified

- **Live.** No run was made against DeepSeek. The prompt wording, and whether a
  real model answers `answersRequest` well, are untested against the provider.
- **The four measured defects, end to end.** #1 (0 of 8) and #2 (5 of 5 refused)
  are caught deterministically with no call. #4 (240 returned, 2 asked for) is
  reachable from the count plus `flowShape`, and is the case the prompt is
  written for. **#3 (10 of 40 posts) is the weakest**: Core cannot know 40 were
  there, so unless the instruction states a count, the model has to infer it from
  `truncated`/`withheld` and the Flow's shape. That one may still pass.
- **The retry path.** `retryRuntimeSessionAfterAutoAppliedPatch` returns its
  session before either call site, so a run that succeeded only after an
  auto-applied patch is not verified. Closing it needs a third call site and
  `service.ts` has no line budget left; it wants the method moved out of
  `service.ts` first.
- **Core build / downstream.** `pnpm --filter fluxiq build` was not run, so the
  web-extension repository (which consumes Core's `dist`) was not typechecked
  against this. The change is additive; `tsc --noEmit` is clean.
- **`pnpm check` / `pnpm test` at the Core root** were not run: the root suite is
  currently red from the sibling commit above, and the brief forbids running the
  package's tests from a root.

## Files

New, all under `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`:

- `runtime/result-verification/{contracts,core-observation,result-summary,verdict,verify,run-outcome,index}.ts`
- `runtime/result-verification/tests/{core-observation,verdict,result-summary,run-outcome}.test.ts`
- `runtime/loop-limits/result-summary.ts`
- `runtime/llm/diagnosis-instructions.ts`

Changed: `runtime/service.ts`, `runtime/index.ts`, `runtime/loop-limits/index.ts`,
`runtime/llm/{deepseek-provider,failure-disposition,provider-contract}.ts`,
`runtime/llm/harness/{context-packet,index,provider-result,request-evidence-check,structured-response,task-request}.ts`,
`runtime/flow-bootstrap/generation-failure.ts`,
`runtime/llm/tests/{failure-disposition,diagnosis-channel,deepseek-evidence-preflight}.test.ts`.

Nothing was committed.
