# Lane T P4 FA: honest outcomes (worker report)

Brief: lane-t-p4-fa-honest-outcomes. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t746/!FluxIQ`, branch
`task/t746-offline-trials-tier1`. Nothing committed.

## Outcome

Done. All four lead decisions are in place. Tests came first: each new test was run and seen to fail on the old code,
except two that already held (noted below). The brief's three checks pass, with their output quoted below.

## What changed and why

Paths are under `packages/fluxiq/src/`.

1. **U5 vocabulary** (`programs/automation-studio/model/offline-trial/vocabulary.ts`)
   - `source_not_live` and `judgement_unavailable` are added at the end of `AUTOMATION_STUDIO_TRIAL_EVIDENCE_REASON_CODES`.
     A doc comment says what each one means.
   - The validator needed no change. It accepts the new codes under its existing rules.
   - `tests/validate-trial-evidence-result.test.ts`:
     - the closed-vocabulary test now lists both codes;
     - an inconclusive result with a `judgement_unavailable` gap validates;
     - the same result with no missing evidence is refused (`inconclusive_without_missing_evidence`), and a pass that
       carries the reason is refused (`pass_with_reasons`);
     - an inconclusive result with a `source_not_live` gap validates, and a gap whose reason is not listed is refused
       (`gap_reason_not_listed`).

2. **Runner** (`programs/automation-studio/runtime/service/offline-trial/`)
   - `run.ts`: a derived source trace is refused with `source_not_live`, and the detail names the derivation. A missing
     manifest is still refused with `incomplete_capture`.
   - `evidence-result.ts`: when the matcher reports no gap:
     - a judge yes is a pass;
     - a judge no, or `execution_failed`, is a fail with `assertion_failure` and the assertion `violated`;
     - `not_judged` or `unsure` is inconclusive with `judgement_unavailable`. It carries one missing-evidence entry: scope
       = the result's scope, operation `null`, detail
       `build_test_judge.task_goal: the judge gave no verdict on the run's evidence (<verdict>)`. The assertion is
       `unverified`.
   - When the matcher reports a gap, the result is unchanged: gaps make it inconclusive under their own reasons.
   - Every matcher gap still becomes missing evidence, now including `failed_delivery` gaps. Their detail reads
     `; the recorded event at sequence N could not be read or fed` instead of "compared with".
   - Tests:
     - `tests/provenance.test.ts`: the derived-source refusal now expects exactly
       `{status:"refused", reasonCode:"source_not_live"}`, with no judge call and no new episode.
     - New `tests/honest-outcomes.test.ts`:
       - not judged gives inconclusive / `judgement_unavailable`, scope `full_recorded_path`;
       - unsure (the judge's `unknown`, which the trial shows as `unsure`) gives the same;
       - a recorded read that fails non-retryably, replayed with no gap, gives `execution_failed` and then fail /
         `assertion_failure` / scope `segment`;
       - a matcher report holding a `failed_delivery` gap before the first operation and one at `example.read#1` gives
         inconclusive, with missing evidence at operation `null` and at `example.read#1`, each under its own reason.
     - `tests/gap-vocabulary.test.ts` (the drift test) gains a second case. It pins the exact list of U5 reasons that are
       not the matcher's (the program-only reasons, the two new codes among them), so adding a code on either side
       fails the test until someone edits it deliberately.
     - New `tests/export.test.ts`: the runner, the evidence builder and the reader contracts resolve from
       `runtime/index.ts` and from `programs/automation-studio/index.ts` (the package's `./automation-studio` entry) as
       the same objects.

3. **Matcher** (`client-gateway/trace-matcher/`)
   - `matcher.ts`: a recorded event or artifact the matcher cannot read or feed now becomes a structured gap, with cause
     `failed_delivery`.
     - Where the gap is placed: at the matched command whose segment holds the event. Before the first operation it is
       placed at ordinal 0, command id `""` and action type `""`, which the runner maps to operation `null`.
       `recordedSequence` is the event's sequence.
     - After the gap, `diverged` is set, so every later command is answered `missing_transition` / `after_gap`.
     - Cases:
       - An input whose text cannot be read gives `incomplete_capture`, or `redacted_input` when it was redacted, the
         same rule the existing segment pre-check uses (now one `unreadableReason` helper). This used to be a silent
         `return`.
       - An artifact missing from the manifest or not returned by the store gives `missing_artifact`.
       - An artifact whose bytes the gateway refuses (`digest_mismatch`) gives `missing_artifact`.
       - No attached session when a recorded input or artifact is due gives `incomplete_capture`.
       - A thrown failure inside any matcher step (`guarded`) gives `incomplete_capture` at that step's command, and its
         message is also kept in `refusedDeliveries`.
     - Held reconcile answers carry the command their segment came after.
     - The rest of the segment is still fed after a failed delivery, so the matched command is not left waiting for its
       answer. Nothing recorded after the matched point is ever fed.
   - `types.ts`: `ClientGatewayTraceMatcherGap.cause` gains `"failed_delivery"`. The docs for the gap and for
     `refusedDeliveries` are updated.
   - `gap-reasons.ts`: the matcher's copy of the codes is unchanged, because the matcher never produces the two new
     codes. The header now says that program-only reasons are not copied and names the drift test that pins them. The
     notes on `missing_artifact` and `incomplete_capture` now cover failed deliveries.
   - New `tests/matcher-deliveries.test.ts`:
     - An unreadable recorded state event before the first operation gives the gap
       `{ordinal 0, "", "", incomplete_capture, failed_delivery, recordedSequence}`, and the next command gets
       `missing_transition` / `after_gap`. The event is never in `deliveredSequences`, and `refusedDeliveries` is `[]`.
       - The test moves the recording's state event and its disposition ahead of the first operation and renumbers. A
         trace claims a session only at its first command, so a recording cannot put an event there itself.
     - An artifact the store lists but cannot read back gives `missing_artifact` / `failed_delivery` at `example.search`
       ordinal 1, and the next command gets `missing_transition` / `after_gap`. `refusedDeliveries` is `[]`.

4. **Export**: `programs/automation-studio/runtime/index.ts` gains one line,
   `export * from "./service/offline-trial/index.ts";`, after `./service.ts`. The structure audit reports no import-cycle
   or browser-imports finding.

## Commands run and observed results

All run from `packages/fluxiq` unless noted.
- Failing first:
  - model tests -> `Tests 3 failed | 46 passed (49)` (the new codes were not yet in the vocabulary);
  - runner tests -> `Tests 3 failed | 14 passed (17)`. Failed: the derived source gave `incomplete_capture`, and
    not_judged and unsure each gave `fail`. Already passing on the old code: the execution-failure and gap-mapping
    cases;
  - `matcher-deliveries.test.ts` -> `Tests 2 failed (2)`. The unreadable opening event was skipped silently (`gaps []`),
    and the artifact failure let both commands match.
- `pnpm exec vitest run src/programs/automation-studio/model/offline-trial src/programs/automation-studio/runtime/service/offline-trial src/client-gateway/trace-matcher src/programs/automation-studio/runtime/gateway-trace`
  -> `Test Files  25 passed (25)`, `Tests  161 passed (161)`.
- The new matcher test plus the offline-trial directory, run twice more -> `Tests  20 passed (20)` both times.
- Neighbours: `pnpm exec vitest run src/programs/automation-studio/runtime/environment src/client-gateway/trace-replay`
  -> `Test Files  12 passed (12)`, `Tests  60 passed (60)`.
- `pnpm exec tsc --noEmit` -> no output; `tsc exit 0`.
- `node scripts/structure-audit.mjs` (worktree root) ->
  `structure-audit: passed (430 warning(s), 1152 baselined).`, exit 0.
  - It also printed "1 baseline entries can be lowered". That was already printed before this lane; I did not run
    `structure:baseline`.
  - Filtering the output for `offline-trial|trace-matcher|runtime/index.ts|import-cycle` found no finding on my files.
    `matcher.ts` is 301 lines.
- One temporary probe test (`zz-probe-fa.test.ts`) printed the recorded event order. I deleted it afterwards.

## Not verified

- A gateway digest refusal, a missing session, and a `guarded` matcher failure each produce a `failed_delivery` gap in
  code, but no test covers them. Only the unreadable input and the unreadable artifact are tested.
- The runner was not driven end to end into a `failed_delivery` gap. A real artifact failure needs an artifact-bearing
  domain read in the offline harness. Instead, the runner's mapping is tested on a real trial outcome paired with a
  matcher report that holds such gaps.
- No live browser or Lab run, no full Core suite (narrow-checks rule), and no Core build.

## Open questions or contradictions found

1. **Gateway handling failures are still notes, not gaps.** When `receiveRaw` throws on a recorded input the matcher
   read correctly, Core's own handling of it failed. The original run may have failed the same way: the trace records a
   `receive_failed` disposition for that. So this stays in `refusedDeliveries`. Turning it into a gap only when it
   differs from the recorded disposition needs disposition matching, which the matcher does not do. Lead: decide
   whether that is wanted.
2. **Feeding continues after a failed delivery within its segment.** I chose this so the matched command still gets its
   recorded answer rather than hanging the trial on a virtual clock that never advances. The verdict cannot be a pass,
   because a gap exists. The alternative is to stop the segment and answer the matched command with a gap. That would
   need its answer to be detected inside the segment.
3. **Redacted unreadable inputs use `redacted_input`, not `incomplete_capture`.** This matches the existing segment
   pre-check rule. The brief named `incomplete_capture` for unreadable events.
4. **A judge without a verdict is not added on top of matcher gaps.** When the matcher reported gaps, the result lists
   only the gap reasons, even if the judge was also unsure or did not judge. A gap usually means the run left recorded
   support, so the judge's silence there is secondary.
