# Report: t769/b3-offline-first-contracts (worker-heavy)

Core tree `fxwork/t769/!FluxIQ`, branch `task/t769-p6-offline-trials-in-builds`. AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. The new `AS/runtime/flow-bootstrap/offline-first/` module holds the `offlineFirst` port-member contract, the gate step, the plain words, a barrel, and two test files. It is exported from the flow-bootstrap barrel. The whole directory is now on the `from` side of the "trace-free model guidance" boundary, and a probe showed the rule catches a trace import there.

UNIT READY: AS/runtime/flow-bootstrap/offline-first/{contracts.ts, gate-step.ts, words.ts, index.ts, tests/gate-step.test.ts, tests/words.test.ts}, AS/runtime/flow-bootstrap/index.ts, scripts/structure-audit/config.mjs

## What changed and why

### 2026-10-27
- **`offline-first/contracts.ts`** (types only, so there is no value export). It imports only the `JsonObject` type from `core/index.ts`; nothing in it names a trace.
  - `AutomationStudioTrialOfflineFirst<TRequest, TResult>` is the port member. It is generic over the request (`AutomationStudioCandidateTrialRequest` or `AutomationStudioSubflowTrialRequest`) and over the result.
  - `TResult` is constrained to `{ revision, digest, verdict: string, feedback: JsonObject }`, which both `AutomationStudioCandidateTrialResult` and `AutomationStudioSubflowTrialResult` satisfy.
  - The file also holds:
    - the answer union and the note union;
    - the evidence fields (`checkedAgainst` / `offlineCheck`);
    - a `logged` shape that is structurally identical to B4's `AutomationStudioLlmStepLogOfflineTrialOutcome`. It is defined here rather than imported, so the module stays a leaf. The gate's `describe` can return `step.logged` as it is.
  - It also holds the step's outcome type.
- **`offline-first/gate-step.ts`**: `automationStudioTrialOfflineFirstStep(answer: unknown, expected)`.
  - **Keep** happens only for `kind: "kept"` with these conditions:
    - the result is an object and its `revision` / `digest` match `expected`;
    - `feedback` is an object;
    - `verdict` is `no` or `execution_failed`.
  - The kept result is returned as a `structuredClone`. `standingNo` is carried unread.
  - **Live** is returned for every valid `live` note, with `said` attached, `evidence.offlineCheck`, and `logged`.
  - **Anything else runs live `inconclusive`**, with one of these `why` codes:
    - `offline_kept_yes`: a kept yes;
    - `offline_answer_mismatch`: wrong revision or digest;
    - `offline_answer_invalid`: anything else.

    That last group covers: unknown keys on the envelope, the note or `checked`; bad counts (negative, non-integer, matched > recorded); a gap step < 1 or a non-integer step; a `why` that is not a plain code (`^[a-z][a-z0-9_.-]{0,59}$`, a subset of B4's refused-code regex); `not_tried` without `why`; an uncloneable result; `undefined` (what a gate passes after catching a throw).
  - `logged.outcome` takes these values: `kept_no`, `kept_failed`, `passed`, `gap` (+`step`), `inconclusive`, or `refused:<why>` for `not_tried`. The counts are added as `matchedOperations` / `recordedOperations`.
- **`offline-first/words.ts`**: `AUTOMATION_STUDIO_TRIAL_OFFLINE_FIRST_WORDS` (frozen).
  - `kept` starts with "This test ran against the recording of this build's last live test, not the site."
  - It also holds `passed`, `inconclusive`, `notTried`, and `gap(step, why)`. Each says the test "ran on the site, and the verdict here is the site's".
  - `reasons` gives words for all 9 matcher gap reason codes. The codes are repeated as plain strings, never imported. Examples: changed action, changed order, the page changed by itself, no saved copy of the page.
  - `otherReason` covers an unknown code. The gap sentence never echoes the code.
- **`offline-first/index.ts`** is the barrel for the three files.
- **`flow-bootstrap/index.ts`** gains `export * from "./offline-first/index.ts";`.
  - That is the convention for pure subdirectories: answerability, authoring and others are exported. Only directories that reach `runtime/llm/` (candidate) are kept out.
  - The module is a leaf, so the export adds no cycle. As a result, `runtime/index.ts` publishes these names.
- **Core `scripts/structure-audit/config.mjs`**: I added the directory prefix `.../runtime/flow-bootstrap/offline-first/` to the `from` list of "trace-free model guidance", and updated the comment above it.
  - This goes beyond `words.ts` alone. gate-step and contracts produce model-facing text and contracts too, and the brief requires the module to hold NO trace types. The directory prefix enforces that mechanically for every file in it, including the tests.

## Commands run and observed results

All Core commands, 2026-10-27.

- **Tests first.** `pnpm test src/programs/automation-studio/runtime/flow-bootstrap/offline-first` was run from `packages/fluxiq` before any source existed. Both files FAILED: `Error: Failed to load url ../index.ts ... Does the file exist?`, `Test Files  2 failed (2)`, `Tests  no tests`, `[vitest-groups] failed: parallel (exit 1)`.
- **Mid-run.** The same command after the first source draft gave `Test Files  1 failed | 1 passed (2)`, `Tests  6 failed | 17 passed (23)`. The cause was that the catch path built the inconclusive note without `said`. I fixed it.
- **Final.** The same command:
  - parallel group: `Test Files  2 passed (2)`, `Tests  23 passed (23)`;
  - real-sql group: `No test files found, exiting with code 0` (it prints no "Test Files" line, because these files carry no real-sql mark);
  - then `[vitest-groups] all groups passed: parallel, real-sql`.
- **Typecheck.** `pnpm exec tsc --noEmit -p .` (in `packages/fluxiq`) ran out of memory at the default heap after about 3 minutes (`FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`). I reran it with the heap the package's own `check` script uses: `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .` gave `exit=0` with no output (0 lines, 0 `error TS`). The tree at that time included the other workers' in-flight edits.
- **Structure audit.** `node scripts/structure-audit.mjs` (Core root) ended with `structure-audit: 5 violation(s) across 4 rule(s).`. No line names `offline-first`. All 5 are other workers' files, noted and not fixed:
  - B4: `[as-never]` in `llm/step-log/tests/offline-trial-step.test.ts:54`;
  - B4: `[swallowed-failure]` in `llm/step-log/offline-trial-step.ts:59`;
  - B2: `[directory-files]` `service/candidate-trial/tests/` is at 26 files;
  - B2: `[imports]` `../../gateway-trace/installation.ts` in `service/candidate-trial/run.ts:85` and `service/subflow-trial/run.ts:96`.
- **Boundary probe.** I temporarily prepended `import "../../gateway-trace/index.ts";` to `words.ts` and ran the audit. It printed `FAIL [module-reach] .../offline-first/gate-step.ts`, `.../index.ts` and `.../words.ts`, each "reaches .../gateway-trace/index.ts, which "trace-free model guidance" forbids", with `structure-audit: 17 violation(s) across 6 rule(s).`. The other new failures were guidance modules reaching it through the flow-bootstrap barrel. I then restored `words.ts` from a scratch copy and re-ran: 5 violations, 0 offline-first lines.

## Final exported type signatures (verbatim)

```ts
// contracts.ts
export type AutomationStudioTrialOfflineFirstResult = {
  revision: number;
  digest: string;
  verdict: string;
  feedback: JsonObject;
};
export type AutomationStudioTrialOfflineFirstChecked = { matched: number; recorded: number };
export type AutomationStudioTrialOfflineFirstNote =
  | { outcome: "passed" }
  | { outcome: "gap"; step: number; why: string }
  | { outcome: "inconclusive"; why?: string }
  | { outcome: "not_tried"; why: string };
export type AutomationStudioTrialOfflineFirstAnswer<TResult extends AutomationStudioTrialOfflineFirstResult> =
  | { kind: "kept"; result: TResult; standingNo?: unknown; checked?: AutomationStudioTrialOfflineFirstChecked }
  | { kind: "live"; note: AutomationStudioTrialOfflineFirstNote; checked?: AutomationStudioTrialOfflineFirstChecked };
export type AutomationStudioTrialOfflineFirst<TRequest, TResult extends AutomationStudioTrialOfflineFirstResult> =
  (request: TRequest) => Promise<AutomationStudioTrialOfflineFirstAnswer<TResult>>;
export type AutomationStudioTrialOfflineCheck = AutomationStudioTrialOfflineFirstNote & { said: string };
export type AutomationStudioTrialOfflineFirstEvidence =
  | { checkedAgainst: "recorded_run" }
  | { offlineCheck: AutomationStudioTrialOfflineCheck };
export type AutomationStudioTrialOfflineFirstLogged = {
  outcome: string;
  step?: number;
  matchedOperations?: number;
  recordedOperations?: number;
};
export type AutomationStudioTrialOfflineFirstStepOutcome<TResult extends AutomationStudioTrialOfflineFirstResult> =
  | { kind: "keep"; result: TResult; standingNo?: unknown; evidence: { checkedAgainst: "recorded_run" }; said: string; logged: AutomationStudioTrialOfflineFirstLogged }
  | { kind: "live"; note: AutomationStudioTrialOfflineCheck; evidence: { offlineCheck: AutomationStudioTrialOfflineCheck }; logged: AutomationStudioTrialOfflineFirstLogged };

// gate-step.ts
export function automationStudioTrialOfflineFirstStep<TResult extends AutomationStudioTrialOfflineFirstResult>(
  answer: unknown,
  expected: { revision: number; digest: string }
): AutomationStudioTrialOfflineFirstStepOutcome<TResult>;

// words.ts
export const AUTOMATION_STUDIO_TRIAL_OFFLINE_FIRST_WORDS: Readonly<{
  kept: string; passed: string; inconclusive: string; notTried: string;
  reasons: Readonly<Record<string, string>>; otherReason: string;
  gap(step: number, why: string): string;
}>;
```

### How B7/B8 use it

1. Type the port member as `offlineFirst?: AutomationStudioTrialOfflineFirst<AutomationStudioCandidateTrialRequest, AutomationStudioCandidateTrialResult>`, or the subflow pair.
2. When `tried === 0`, call it inside `automationStudioLlmStepLogOfflineTrial(meta, run, (raw) => automationStudioTrialOfflineFirstStep(raw, latest).logged)`. On a throw that is not an abort, pass `undefined` to the step.
3. On `keep`:
   - run `result` through the gate's own result checks, which carry subflow identity and `entryPrepared`;
   - weigh it as `asked`;
   - prefix the instruction with `said`;
   - spread `evidence`;
   - skip the reset, the hook and `leftOnSite`.
4. On `live`, spread `evidence` into the live trial's evidence.

A type test shows both evidence shapes spread into a `JsonObject`.

## Not verified

- The gates themselves are not wired (B7/B8). The fit to `ask()` was checked by reading both gates' `test()` and `ask()` bodies and by a type-level test with a gate-like result type, not by integration.
- Not checked: whether `logged` is accepted by B4's final `describe` type. It matched B4's file as read today (`outcome`/`step`/`matchedOperations`/`recordedOperations`, and refused codes matching `[A-Za-z0-9_.-]{1,60}`).
- No full suites, no live or paid runs, no model calls. The Core prompt-contract tests were not run (the design says they do not cover these words).

## Open questions or contradictions found

1. **Gap reason drift.** `words.ts` repeats the 9 matcher gap reason codes as strings. A drift test cannot sit here: the tests are inside the boundary, so they cannot import `client-gateway/trace-matcher`. B9 (`service/offline-first/answer.ts` tests) should assert that every `CLIENT_GATEWAY_TRACE_MATCHER_GAP_REASONS` entry has `WORDS.reasons[code]`.
2. **`not_tried` evidence on every first test.** A `not_tried` note on every first test of a scope (no source yet) adds an `offlineCheck` sentence to each first live trial, as the design says. If that is unwanted noise for the model, B7/B8 could skip the evidence for `not_tried` and only log it.
3. **Strict `checked` validation.** An invalid `checked` makes even a valid kept no run live. That is safe, but B9 must send well-formed counts or omit them.
