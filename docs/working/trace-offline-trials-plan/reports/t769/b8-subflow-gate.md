# t769 B8: subflow trial gate offline-first

AS = `packages/fluxiq/src/programs/automation-studio/` in Core `fxwork/t769/!FluxIQ`, branch `task/t769-p6-offline-trials-in-builds`.

## Outcome

Done. The subflow trial gate asks a port's optional `offlineFirst` once per revision and digest, before admission, the start hook and the site reset. A recorded `no` or `execution_failed` that passes the gate's own result checks is kept as the trial, with nothing done on the site. Anything else runs live in the same call, with `offlineCheck` added to the evidence, except for a `not_tried` note (D46).

UNIT READY: AS runtime/flow-bootstrap/subflow-candidate/contracts.ts, AS runtime/flow-bootstrap/subflow-candidate/subflow-trial-gate.ts, AS runtime/flow-bootstrap/subflow-candidate/subflow-trial-result.ts (new), AS runtime/flow-bootstrap/subflow-candidate/subflow-trial-offline-first.ts (new), AS runtime/flow-bootstrap/subflow-candidate/tests/subflow-trial-offline.test.ts

## What changed and why

- `contracts.ts`: `offlineFirst?: AutomationStudioTrialOfflineFirst<AutomationStudioSubflowTrialRequest, AutomationStudioSubflowTrialResult>` is now on `AutomationStudioSubflowTrialPort`, next to `environmentKind`. This is a type-only import from `../offline-first/index.ts`. `AutomationStudioSubflowTrialPreparingPort` gets the member through its intersection.
- `subflow-trial-result.ts` (new, one export `automationStudioSubflowTrialResultRead`): the gate's own result checks (partial/scope/entryPrepared/verdict/feedback, identity and revision/digest match, notRun, standingNo, carried kept conditions, flagged reads), moved verbatim out of `ask()` together with `flaggedReads`, `carriedKept` and `notRunOf`. Two reasons for the move: the gate was at 798 of 800 lines, and the kept answer has to meet exactly the same checks.
- `subflow-trial-offline-first.ts` (new, one export `automationStudioSubflowTrialOfflineFirstCheck`): calls `offlineFirst` inside `automationStudioLlmStepLogOfflineTrial` (`NNNN-offline`).
  - A throw that is not an abort becomes `undefined`, so B3's step runs it live as inconclusive and the error text is never shown. An abort rethrows.
  - The outcome goes through `automationStudioTrialOfflineFirstStep`. A keep is then read through `automationStudioSubflowTrialResultRead`, and it is kept only if: no notRun, `entryPrepared === true`, and the verdict is no or execution_failed. Otherwise it becomes B3's invalid-answer live note.
  - On keep, the result's `acts` are dropped.
  - On live, the evidence is `offlineCheck`, or `{}` for `not_tried`.
  - The step log's `logged` reflects the final decision.
- `subflow-trial-gate.ts` `test()`:
  - When `tried === 0` and the key has not been asked yet, it calls the check right after the same-failure and retest-limit checks.
  - On keep: no admission, no `prepareStart`, no `beforeTrial`, no `trialRan`/`leftOnSite`. `asked` is the kept read, and the weighing that follows is unchanged (trial count +1, standing nos, row check rule, `weighed`, earlier advice, kept conditions, closed digest on a no, `recordStop`, so D43 holds). The instruction is prefixed with `said`.
  - The step's evidence is spread last.
  - `ask()` now builds its request through a new `request()` helper, which the offline call also uses (so that call carries no `startedWith`) and gets the brief's identity from a new `identity()` helper. A new `adviceFor()` helper gives the earlier advice to both calls. A header paragraph was added. Lines: 798 -> 785.
- Beyond the brief's letter: an `offlineAsked` set keyed by revision and digest. A reset or admission refusal, a `notRun` or an unaffordable answer all put `tried` back to 0. With `tried === 0` alone, a retest after one of those would ask `offlineFirst` again, and an offline pass pays the judge every time (D42). The set enforces "once per revision+digest" literally. A test covers it.

## Commands run and observed results

2026-10-27, all from `packages/fluxiq` unless noted.

- Tests written first. `pnpm test src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate/tests/subflow-trial-offline` printed `Tests 7 failed | 4 passed (11)`, `[vitest-groups] failed: parallel (exit 1)`. The failures were: offline not called (`offline: +0`), and the abort test printed "promise resolved ... instead of rejecting".
- After the implementation: `pnpm test src/programs/automation-studio/runtime/flow-bootstrap/subflow-candidate` printed `Test Files 25 passed (25)`, `Tests 149 passed (149)`, `[vitest-groups] all groups passed: parallel, real-sql`.
- Once-per-key test added first. It failed with `expected { offline: 2, ... } to match object { offline: 1, resets: 2, trials: 1 }` and `Tests 1 failed | 11 passed (12)`. After the fix the full directory run printed `Test Files 25 passed (25)`, `Tests 150 passed (150)`, `[vitest-groups] all groups passed: parallel, real-sql`.
- `pnpm test src/programs/automation-studio/runtime/project-agents/single-subflow` (drives this gate) printed `Test Files 8 passed (8)`, `Tests 32 passed (32)`, `all groups passed`.
- `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .`:
  - First run: exit 2 with 13 errors, all in other workers' files: `flow-bootstrap/candidate/tests/offline-trial/tests/offline-first-gate.test.ts` (45,52: JsonValue) and `service/offline-first/tests/{answer,installation,sources,subflow,whole}.test.ts` (missing `../index.ts`, implicit any).
  - Final run: exit 0, 0 errors.
- Core root `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"`:
  - First run: `FAIL [statement-packing] .../candidate/tests/offline-trial/tests/offline-first-gate.test.ts ... line 179` (B7's file) and `1 violation(s)`.
  - Final run: `structure-audit: passed (443 warning(s), 1152 baselined).` Warnings for my directory: `subflow-candidate/` has 19 source files and `tests/` has 25 (advisory threshold 15), and the gate has 785 lines (advisory threshold 400). None fail.

## Tests added (in `tests/subflow-trial-offline.test.ts`; the folder is at 25 files, so no new file)

- A kept no: no admission, hook, reset, site trial or `trialRan`. Evidence `checkedAgainst: "recorded_run"`, instruction starts with `WORDS.kept`, no `retestsLeft`/`leftOnSite`/`offlineCheck`, `weighed` told no, digest closed (retest gives `subflow.trial_unchanged_after_no`, and completion is refused). Step log: only `0001-offline` + `index.md`, meta `outcome: "kept_no"`, counts 4/4.
- An offline pass: admission, hook, reset and live trial run; the request has no `startedWith`. The live yes completes, with `offlineCheck {passed, said}`.
- A gap: live in the same call, `offlineCheck` gap with step 3 and the words' sentence. Step log is `0001-offline` then `0002-reset`. The retest is live with no new check and no `offlineCheck`.
- A kept execution_failed: counts as one trial (retestsLeft 2, `stoppedBy`, prefixed instruction). The live retest's same stop closes the revision (`failedStep`, then `subflow.trial_same_failure`).
- A kept yes, and a kept no about another subflow: both live, `offlineCheck` inconclusive.
- `not_tried`: no `offlineCheck`, logged `refused:no_source`. A throwing check runs live as inconclusive, and its error text is absent.
- An abort inside the check propagates, with no site action.
- A reset refusal and then a retest: `offlineFirst` asked once.
- No `offlineFirst`: unchanged counts and no new fields. The three existing tests still pass.

## Not verified

- Not wired: nothing in `service/**` or `project-agents/**` sets `offlineFirst` yet (B9 / the wrappers), so this runs only against test ports. `dispatch/trial-port.ts` must copy `offlineFirst` (F3), or it never reaches this gate in a project build.
- No full suites, no live or paid runs, no model calls. Only `subflow-candidate` and `project-agents/single-subflow` tests were run.

## Open questions or contradictions found

1. **A kept answer requires `entryPrepared === true`.** The gate's generic checks accept `false`. I treat a kept answer whose entry was not prepared as live, because it says nothing about this subflow. This matches the design's source eligibility (§2), but it is my rule.
2. **A kept answer's `acts` are dropped.** No act landed on the site, and `weighed` and receipts would otherwise list the recording's acts as this trial's. B9 should not rely on them being carried.
3. **An offline port (`environmentKind` not live) that also has `offlineFirst` is still asked.** The brief did not say to skip it. Such a pair is presumably never built.
4. **`offlineAsked` (above) goes beyond the brief's wording.** It is in line with D41 and D42. B7's whole gate may want the same guard, because its reset refusals also leave `tried` at 0.
