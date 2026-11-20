# t974: F22, completions refused "not judged" with no judge call

## Outcome

Done. The cause is found, reproduced from the recorded state of the run, and fixed at the root. A judge call that is not sent now says why in the step log and in core.log.

## Cause (exact)

1. **The data.** In memory, the attempt holds a read's `leftOut.found` with an `undefined` item for every condition the read said nothing about. The type allows this (`(string[] | undefined)[]`, kept aligned with `where`; `runtime/result-verification/flow-less/read-left-out.ts`).
2. **The screen.** `automationStudioResultEvidenceScreen` (`runtime/result-verification/result-evidence/screen.ts:9` before the fix) mapped arrays with `raw.map(visit)`. `visit(undefined)` fell through and returned `undefined`, so the item stayed in `resultEvidence.pages[i].leftOut.found`. Object members that were `undefined` were filtered out; array items were not.
3. **The refusal.** The summary went into the judge's request context. The Anthropic adapter's `prepare()` runs `validateAutomationStudioLlmTaskRequest` (`runtime/llm/provider-task/preflight.ts:29` before the fix). Its `boundedJson` returns false for any `undefined`, so the adapter threw `llm.provider_request_context_unbounded` (`runtime/llm/anthropic/provider.ts:109`). That happens before `fetch` and before the step-log folder is opened. The harness returned `ok:false` with `providerInvocation:"not_attempted"`.
4. **The wording.** `reading()` in `runtime/result-verification/flow-less/judge.ts:160-162` passed that code to `callFailureWords`. No pattern matched it, so the fallback "the verification call did not come back usable" was used (`verdict/call-failure-words.ts:14`). Nothing was logged.
5. **Why no record showed it.** The run's dataset store and every log write the same item as `null` (via `JSON.stringify`).

**Evidence.** The stored result evidence (`run_dataset_batches.evidence_json` in each attempt's `project.sqlite`) has `null` items in `leftOut.found`:

| Run | Result | Judge |
| --- | --- | --- |
| run-mwouzg29-ebb0f27d | `null` items at `pages[1..3].leftOut.found` | not sent |
| run-mwov5v61-01468cd3 | `null` items in the v3 step's `pages[0].leftOut.found` | not sent; its three earlier judges ran on v2 and were sent |
| run-mwow1z18-81707c66 | `null` items at `pages[0..3].leftOut.found` | not sent |
| run-mwouuc9b-dc74ca2b (campaign-a, same Core) | none | judges sent |
| run-mwovplov-72e78c93 (campaign-a, same Core) | none | judges sent |

The lead's hypotheses do not hold:
- **Climb, window, continuation:** ruled out. The windows are 1M tokens, case 3 never climbed, and the continuation only builds the body of a call that is sent anyway.
- **Unplaced reads:** ruled out. run-mwovplov's result also had "unplaced read 1-5" and its judges were sent. "Unplaced" means the read reported no page or offset, not that the read was outside the draft.
- **Purse:** ruled out. A purse refusal reads as `refusedByPurse` and becomes a budget-out.

**Reproduction.** I rebuilt case 1's judge input from its records:
- instructions and decider evidence from step 0099;
- the 20 rows from 0100's `resultHolds`;
- `resultEvidence` and `readPages` from `project.sqlite`, through the real `automationStudioResultEvidenceFromBatches`;
- the trail from every tool step's `call.json` and `result.json`, through `automationStudioResultTrailStepOfCall`;
- the end view from 0098.

I ran it through the real flow-less judge, the real harness, and laddered Anthropic adapters (Haiku and Sonnet, climbed) with a scripted `fetch`, inside a ladder frame. With the stored `null`s the judge was sent. With them turned back into `undefined`, as they are in memory, the result was `providerInvocation: not_attempted`, code `llm.provider_request_context_unbounded`, and judgement "The run's result was never judged: the verification call did not come back usable." No judge `fetch` was made. That matches the live runs exactly.

## What changed and why (Core worktree `fxwork/t974/!FluxIQ`, not committed)

- **`runtime/result-verification/result-evidence/screen.ts`** (the root fix):
  - The screen now outputs JSON. An `undefined` item becomes `null`, as the store keeps it, which keeps `found` aligned with `where`.
  - A function, symbol or bigint is withheld.
  - This is shared by both judges, so it also fixes the Flow judge in `verify.ts`.
- **`runtime/result-verification/flow-less/judged-summary.ts`:** `sent` leaves through `jsonForm`. Every part of the summary is built from values held in memory, and a single value with no JSON form anywhere makes the whole request unsendable. The form is the one the store and step log already show:
  - an `undefined` or function member is left out;
  - an array item with no JSON form becomes `null`;
  - a number that is not finite becomes `null`.

  Nothing is cut or reordered, so the trail-first cache layout is unchanged. This is the structural guarantee that a judge which could be sent is sent.
- **`runtime/result-verification/run-trail/screen.ts`:** a function, symbol or bigint in a trail answer is left out instead of passing through. Same class of gap.
- **`runtime/llm/provider-task/unbounded-json.ts`** (new; exported through the `provider-task` barrel):
  - `automationStudioLlmUnboundedJsonAt` says what is not bounded JSON (an undefined value, a number that is not finite, a function, a cycle, or nesting deeper than 64) and where.
  - The path shows array indices and identifier keys only, at most 8 steps, so no page text.
  - `preflight.ts` uses it for the context check, and its refusal now names the place. It also uses it for the evidence-entry check at line 105, which was the old `boundedJson`.
- **`runtime/result-verification/flow-less/judge.ts`:**
  - When a judge's harness result is `not_attempted` (refused before sending), or the harness threw, the judge writes a step-log note, `The judge's call was not sent (<code>), so the result was not judged. <Core's message>`, and a build-trace line in core.log: `judge not_sent code=<code> name=<error name>`.
  - For `context_unbounded` the note also gives where. This is computed from `result.request.context`, because the provider failure normaliser always replaces the message with fixed words.
  - A thrown error's message is never written; only its name and code.
  - Purse refusals are unchanged and still become a budget-out.
- **`runtime/result-verification/verdict/call-failure-words.ts`:** `llm.provider_request_context_unbounded`, `request_construction_failed` and `request_task_mismatch` now read "Core built the judge's request in a form it could not send, so it was never asked", instead of "did not come back usable".
- **`runtime/result-verification/flow-less/tests/judge-unsent.test.ts`** (new):
  - **F22:** a summary whose evidence holds an `undefined` `found` item, as in memory, run through the real harness and the real Anthropic adapter. It failed before the fix (no request sent, `expected [] to have a length of 1`) and passes after (one request sent, `found` sent as `[null, [...]]`, and the reply is read as "no").
  - **Not sent, refused:** a pre-send refusal writes the note with its code and path, plus the core.log line.
  - **Not sent, thrown:** a harness throw writes a note naming the error, without its message.
- **`runtime/result-verification/verdict/tests/call-failure-words.test.ts`** (new): the three request codes get the new sentence, and every other family is unchanged.

User rules: there is no cap anywhere and nothing is cut. The judge still sees the whole run plus the final data, and only how a value with no JSON form is written changes. Not-judged refusals still send the model back to work, so the task still ends only with its result or its budget.

## Commands run and observed results

All through `fxwork/.heavy-slots/heavy-slot.mjs`.
- **Before the fix** (original `screen.ts` and `judged-summary.ts` read from `HEAD`), `vitest run …/flow-less/tests/judge-unsent.test.ts`: 1 failed, 3 passed. The F22 case failed with `expected [] to have a length of 1 but got +0`: no judge request.
- **Batch of 41 files** (flow-less, result-evidence, run-trail, provider-task and anthropic test directories; verdict, zero-provider-run, harness run and no-cap tests; answer-first left-out, processing and keep; generation-failure provider-refusal and diagnostics): 38 files passed, 3 failed.
  - `judge-continuation` (4 failures): caused by the leftover `boundedJson` reference in `preflight.ts`, since fixed.
  - `judge-unsent` F22: a fixture shape error, since fixed.
  - `default-wording` (2 snapshot failures): see below.
- **After those fixes**, `vitest run` on `judge-continuation`, `default-wording` and `judge-unsent`: `judge-continuation` 4/4 and `judge-unsent` 4/4 passed. `default-wording` 2 failed: the snapshot mismatch is in the supplementary-recordings instruction text in the explorer's system prompt. I did not touch that text, so the failure was already there on HEAD 29cc1d16c.
- **Targeted tsc** (scratchpad tsconfig extending `tsconfig.base.json`, the 9 changed files plus their import graph): exited 2 at first with `preflight.ts(113,93): Cannot find name 'boundedJson'`. After the fix it exited 0.
- **Structure audit** (`node scripts/structure-audit.mjs`), first run: exited 1 with one violation. `judge-unsent.test.ts` imported other directories' files instead of their barrels. I moved the words test to `verdict/tests/`, imported the provider from the Anthropic barrel, and dropped the cross-directory fixture import.
- **Final gated pass:**
  - targeted tsc: `tsc_exit=0`;
  - the batch above plus `verdict/tests`: Test Files 1 failed, 42 passed (43); Tests 2 failed, 437 passed (439). The only failures are the 2 `default-wording` snapshot tests that were already failing;
  - structure audit: `audit_exit=0`.

## Not verified

- No live or Lab run. No paid call was made.
- `verify.ts` (the Flow judge) gains the screen fix but not the not-sent note; its behaviour after the fix was not exercised beyond `zero-provider-run.test.ts`.
- Which upstream code writes the `undefined` items in memory (`answer-first/rows/read-evidence.ts` or the domain) was not traced further. The type allows it, and the screen is the JSON boundary.

## Open questions or contradictions

- The `default-wording` snapshot was already stale on HEAD, which affects Core's full sweep. It needs an owner.
- The lead's "unplaced reads" hypothesis is contradicted by run-mwovplov-72e78c93, whose judges were sent with an unplaced result. The `null` items in `leftOut.found` are what all three failing runs share, and they are absent from the runs whose judges were sent.
