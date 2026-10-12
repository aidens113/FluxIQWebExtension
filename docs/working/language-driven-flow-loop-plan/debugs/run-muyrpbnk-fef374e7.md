# Run debug — run-muyrpbnk-fef374e7 (lane A round 4, candidate mode after t354, t342-slot-2)

Written as `run-pending-t342-slot-2-a-r4.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-07 ~23:58 UTC; off-peak until 01:00 UTC).

## Header

Lane A, t342 round 4: the candidate-mode probe repeated after t354 (Core 0c53a16c). t354 gives the candidate loop
legacy's unusable-reply retry, stages an ending unusable reply as `provider_output_validation` ("the model's answer
could not be used"), and carries a failed build's whole spend into the failure, the per-build ceiling and the Lab.
Instance `t342-slot-2`, slot 2, workspace `t342-a`. Tree at downstream b9e0c352 (contains dev ea2366b9), Core
0c53a16c (= Core dev), both clean. No `STOP-balance`, no override files. Core libraries (fluxiq rebuilt) and
`pnpm build` exit 0 at 23:56 UTC.

Previous run on this instance: round 3 `run-muyqgopm-1bfa7054` (candidate; one unusable reply, `kind: "callId"`,
ended the build before any submission: C1 no retry, C2 wrong words, C3 no spend recorded; all three addressed by t354).

## Expectations (written before launch)

Same instruction (219 characters, sha256 `2e6f5e7d...a405`), oracle and correct-candidate description as round 3's
debug (`run-muyqgopm-1bfa7054.md`, "Expectations").

Command: `FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none pnpm lab:campaign
crossborder-marketplace-hub-to-cart --max-attempts 1 --authoring-mode candidate -- --target persistent-isolated
--workspace t342-a`.

Dry runs (23:56-23:57 UTC): one spawned command with `--authoring-mode candidate`; Lab `--dry-run` exit 0, `status
ready`, `providerCallCount 0`, created-flow, chat entry, flash, `coreAuthoringMode` candidate, `candidateTrial
{trialRunner: true, startReset: true, source: lab-plan}`, 48 calls, $0.10, `permittedConsequences []`, `coreWeb` key
`c512f500...` not cached.

To check, beyond round 3's K1-K8:

- R4-a an unusable reply, if one comes, is refused with feedback and the model asked again (t354).
- R4-b each `core.test_candidate` trial: the start-hook reset receipt, the steps run and their results, the trial's
  end view against the four oracle facts, both judge verdicts.
- R4-c promotion if reached: a proposed adaptation with `candidateTrial` audit detail, the chat applies it and says the
  automation is ready, the Lab plays it on its own tab and checks the oracle.
- R4-d spend: the per-build figure equals the step-log sum whether the build passes or fails (t354).
- Round 2 and 3 traps to watch in any submitted script: a Space Grey press, the covering layers before Add to cart, the
  quantity set to 3, Add to cart present once.

Replays and a second candidate run only on an oracle pass that the product accepted.

## Result (written by the t342 lane lead from the run folder, 2026-10-08 ~00:15 UTC)

**Failed: two trials, neither ran past step 2, no candidate promoted.** Verdict `runtime.behavior`
(`lab.chat_build_failed`), issue `flow_bootstrap.evidence_repeat_without_progress`. The oracle was not measured.

- Launched 23:57:35 UTC (guard `admitted`, fingerprint `sha256:43afc378...`); panel open 23:59:24; build ended
  00:01:14.7 after 108 s.
- 34 calls, $0.039318:
  - chat: 1 call, $0.000071;
  - exploration: 14 decisions, $0.018064;
  - submissions: 16 decisions, $0.018584;
  - trial requests: 3 decisions, $0.002599;
  - judges: 0 (no trial reached its end).
- The build's spend is recorded this time: $0.039248 in `build.accounting`, `perBuild` and the ledger (t354 seen).
- No Lab process was left running (checked).

Sequence:

1. Exploration, 0002-0026. It dismissed the layers, searched and opened the item, collected the coupon (busy at 0014,
   done at 0016), chose the options, and typed 3 into the quantity field.
2. Submissions 0027 (revision 1) and 0029 (revision 2), both accepted. The same 8 steps: navigate to the item URL,
   coupon `t925`, Space Grey `t931`, 7-in-1, Spain, type 3, Add to cart, `wait_for_text "added to cart"`.
3. Trial 1 (0031/0032, revision 2, `trial.dcb39f20...`): `start: "reset"`. Step 1 navigate succeeded; step 2, the
   coupon press, failed `web.target.not_found`.
4. A look (0034), then 4 refused submissions (0037-0044, revisions 3-6) that added "dismiss the welcome popup" `t478`
   and "dismiss the cookie banner" `t488`, refused `web.handle.unknown` for nodes 1 and 2.
5. Revision 7 (0045), with those steps removed, accepted.
6. Trial 2 (0047/0048, revision 7, `trial.739f1e99...`): `start: "reset"`. Step 1 succeeded; step 2 (coupon) failed
   `web.action.rate_limited`.
7. 0049 asked for the same trial again ("see if the transient limit clears"): refused `repeat_refused`.
8. 0051 meant "coupon press made optional"; the script came back identical (revision 8, same digest,
   `changedPaths: []`).
9. Eight refused submissions in a row (0053-0068, revisions 9-16), again with the start-page handles `t478`/`t488`.
10. The no-progress guard ended the build.

Checks:

- R4-a: no unusable reply this time.
- R4-b, both trials: start reset receipt `start: "reset"`, execution `execution_failed` at step 2, no judge call, no end
  view or oracle comparison (nothing ran far enough). A run of the scripted steps would also have pressed Space Grey
  (un-choosing it) and had no step for the covering layers.
- R4-c: not reached.
- R4-d: spend recorded (seen).
- K5 own words: seen.

### Causes

**C1: script handles bind to the control as exploration last saw it, after exploration's own act.**

- The coupon control read "Get coupons" on a fresh page (0012) and "Collected" from 0016 on. Revision 2's step 2
  `target: t925` was bound to the "Collected" control.
- On the trial's freshly reset page it was not found: the overlay at moment 5 reads "Running step 2 of 8: Clicking
  “Collected”".
- Revision 7, submitted after trial 1 had left a fresh item page in view, rebound it to "Get coupons"
  (`changedPaths ... nodes.1.parameters.element.visibleText`).
- Owner: downstream `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts:113`, which takes
  `visibleText` from the newest view of the handle.
- Fix: bind a script handle to the identity the control had before the step that acted on it, or drop the text the act
  changed from the identity. Exact selection point not traced.

**C2: the trial allows one attempt per step, where a normal run retries.**

- The page refuses the first coupon press with "Network busy, please try again" (retryable `web.action.rate_limited`;
  domain `failure/codes.ts:283` `retryable: true`).
- A normal run retries every node three times by default (Core `executor/retry-policy.ts`, 250 ms, 1 s, 2 s). The trial
  runs with `retryPolicy: { maxAttempts: 1 }` and `maxRetriesPerAction: 0`
  (`flow-bootstrap/verification/detached-execution.ts:75-76`).
- The script format has no per-step retry or optional setting (`plan/flow-script-format.ts`), so the model could not
  fix it either.
- Fix: run trials with the normal deterministic retry policy, keeping the model-recovery and adaptation budgets at
  zero. Write the failing test first: a step that fails once with a retryable code passes on its second attempt in a
  trial.
- This is the decisive cause for any lane A candidate, because the coupon press is busy on its first attempt after
  every reset.

**C3: a refused handle gets a generic sentence, and the model loops on it.**

- Twelve submissions were refused `web.handle.unknown` for handles `t478`/`t488`. They were printed on the start page,
  but the script's first step opens the item page.
- The refusal names no handle and no location. It says only "copy that token exactly ... add location if you explored
  more than one place".
- Fix: name each refused handle and where the evidence printed it, or that it was never printed. Owner: the
  `web.handle.unknown` producer, downstream `domain/src/runtime/llm-evidence/node-run/run.ts`, and the candidate
  submission diagnostics.

**C4: trial feedback is too thin to repair from.**

- Trial feedback is only `{step, definitionId, status, failureCode}`: no control name, no page notice ("Network busy,
  please try again"), no end view.
- Owner: Core `runtime/service/candidate-trial/feedback.ts`.
- Fix: include the failed step's control words, the page's own notice and a screened end view.

**C5: a retry of a trial after a retryable failure is refused as a repeat.**

- 0049 was refused `repeat_refused`, although a busy page is exactly where trying again is right.
- Owner: the repeat guard's outcome rules (Core `llm/repeat-guard/outcomes.ts`). It should not block an identical
  trial whose failure code is retryable.

**C6: the ending is still wrong in two ways.**

- `flow_bootstrap.evidence_repeat_without_progress` is worded "the model's answer could not be used"; the model's
  answers were usable, and the build stopped for making no progress.
- It says the Flow "has no steps yet" although four candidate drafts were saved.
- The Lab's record has `candidate: null` on this path, so the candidate id and trials are missing from
  `snapshots/flow-lane.json`.
- Owners: Core candidate failure staging (t354's staging in `runtime/service.ts`), `conversations/commands/progress.ts`
  wording, `conversations/commands/create-here.ts` ending, and downstream
  `packages/test-runner/src/flow-lane/creation/candidate-outcome.ts`.

### UI review (8 moments, lead)

- Internal names reach the person: headings "Using “Test candidate”" and "Using “Submit candidate”", "Revision 7",
  "rate limit" (05, 07, 08).
- Moment 5 says "The quick fixes didn't help — Trying again didn't fix the step", although trials never retry.
- The overlay shows "Step 2 of 8" and "Fixing your Flow" during a trial.
- Fixed since round 3: the Stop button, stable overlay placement, and the right words for an unusable reply.
- The ending is wrong as described in C6.

Not run: replay and second candidate run (no pass). No relaunch.
