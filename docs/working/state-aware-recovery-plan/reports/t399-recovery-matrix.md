# t399: the provider-free acceptance matrix (worker report)

Trees: downstream `fxwork/t399/!FluxIQWebExtension` and Core `fxwork/t399/!FluxIQ` (read only), both on
`task/t399-recovery-matrix`. Nothing is committed.

## Outcome

**Partial.** The runner, the command, the Flows and the checks are built and tested. Rows 1 and 13b pass headed and
provider-free on current dev. Row 13a fails: the cause is a product defect, read from its trace (below). Row 3 cannot
run on dev or after t392 as the brief imagined it, because of an authoring gap in the candidate grammar. Rows that need
t392 are reported `not-proven` by name, never stubbed.

| Row | Status on current dev | Cause / evidence |
| --- | --- | --- |
| 1 | **ran, passed** (twice) | First step s1, no state route, cart 3 pieces added once, coupon held, goal facts held. Core counted 0 calls (`costAccounting.calls: 0`). |
| 2 | blocked: authoring gap, then pending t392 (entries) | The `start at:` condition is an element fact, which the grammar names only by an evidence handle. |
| 3 | **ran, blocked** (authoring gap), then pending t392 (entries) | `rmx-…01-56-29…/case-3.json`: refused for handle `today-filter`. See question 1. |
| 4a, 4b | blocked: authoring gap, then pending t392 (handlers) | The flash deal has no role or name, so only an element fact can see it. |
| 5 | blocked: authoring gap, then pending t392 (handlers) | Same flash deal. |
| 6 | blocked: authoring gap, then pending t392 (handlers) | Same flash deal. |
| 7 | **ran, not-proven** (handlers) | Dev's requirement gate refused the run before any step: "This automation needs handlers for interruptions, which this version of FluxIQ doesn't offer yet." Uses only dialog facts, so it is authorable. |
| 8 | **ran, not-proven** (call-subflow) | Core refused the script `flow_script.call_unavailable`: dev's library has no `builtin.control.call-subflow`. |
| 9 | ready to run, pending t392 F (reconciliation) | Not run: proving reconciliation needs t392 F. |
| 10 | **ran, not-proven** (handlers, checkpoints) | Same requirement-gate refusal as row 7. The first launch classified it `error`; the runner now reads the gate refusal as `not-proven` (verified on row 7's rerun). |
| 11 | ready to run, pending t392 F (reconciliation) | Not run. |
| 13a | **ran, failed** (product defect) | Detailed under "Commands run". |
| 13b | **ran, passed** | The check failed on all four attempts, the failed edge went to the authored End (resultStatus failed), 3 confirmed, 0 calls (gate declined, `llm.gate.training_mode`). |

Commands for the pending rows, once t392 merges:

- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 7`
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 8`
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 9`
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 10`
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 11`

Rows 2-6 also need the authoring gap closed first. `pnpm lab recovery-matrix --list` prints every row's status and
command.

## What changed and why

All new code is in `packages/test-runner/src/recovery-matrix/`, each directory with a barrel.

- **`matrix-row.ts`, `matrix-rows.ts`.** The table: rows 1-11 and 13, with each case's Flow, variant or perturbation,
  check, and site expectation. Each row also lists the executor capabilities it `needs` and any `authoringGap`.
  - Site assignments follow t390.
  - Row 4 has cases 4a (`flash-deal-on-arrival`) and 4b (`flash-deal`). `flash-deal-second-item` is not a case: it
    needs a Flow that loads two product pages.
  - Row 13 has two cases. 13a: the rate limit is absorbed by retries. 13b: a planned fail leads to an authored stop.
- **`flows/`.** Ten candidate scripts, written against each scenario's markup and recording script:
  - `hub/`: crossborder cart, plus the promotion-handler and two-handler variants.
  - `confirm/`: social confirm, then-stop, and checkpoint.
  - bigbox: store entry, towels entry, two blocks, quick-add alternative.
  - Lessons from the runs, recorded in the files:
    - A typing step needs an `element` identity. Without one, Core takes the typed text as the field's identity and
      the browser vetoes the right field (`web.target.ambiguous`, score -0.26).
    - Every overlay step must be `optional`. The extension's interference clearing answers consent dialogs and
      closes prompts, including the very dialog a step targets.
- **`compile/`.** Core's own path, in-process, against the workspace's FluxIQ root while its Core is stopped:
  `acceptAutomationStudioFlowBootstrapResult`, then `validateAutomationStudioFlowBootstrapPlan`, then
  `createFlowBootstrapAdaptation`, approve, apply. No graph is written by hand. `evidence-handles.ts` refuses any plan
  that still names a `{ handle }` anywhere. Core's own check reads node parameters only, so a handle in entry metadata
  would otherwise be saved and never resolve.
- **`run/run-matrix-case.ts`.** One case:
  1. Open a fresh persistent workspace once (Core sets up the identity, project and port) and close it.
  2. Compile the Flow.
  3. Reopen the workspace with `modelProvidersEnabled: false`, reset the site, arm the variant and the perturbation,
     and pair the extension in a headed browser (`openReplayBrowser`).
  4. Run the Flow deterministically with `executeRecordedFlowRun` and no `llmExecution`.
  5. Read the evidence: Core's detail (waiting up to 30 s for the gate record), the site's `/__control/final-state`,
     and the goal facts.
  6. Judge the case.

  A case refuses to start with a provider credential in its environment. A case that does not pass keeps its
  workspace (Core store and logs) and names it in `retainedWorkspace`. `requirement-refusal.ts` turns Core's
  requirement-gate refusal into `not-proven`.
- **`records/`.**
  - `attempt-records.ts` reads each attempt in closed words: `lifecycle`, `entry`, `stateRouting` with refused
    guards, `framePath`, failure, and retry, taken from the attempt or its metadata.
  - `site-state.ts` judges cart pieces and adds, coupons, confirmed requests and refused presses, and counts
    duplicated acts.
  - `model-calls.ts` takes the count from `costAccounting`. A gate with `invoked: false` and no listed calls counts as
    zero. No gate record is unknown, and the case fails.
- **`checks/matrix-checks.ts`.** One check per behaviour. Each starts from the same floor: zero calls, interventions
  and activations, and the site as expected. A check whose mechanism wrote no record returns `not-proven` with the
  missing capability.
- **`measures.ts`.** The plan's measures per case. In-run fixes, escalations and learning cost are 0 by construction.
  Handler overhead is `null`: the trace has no per-boundary timing.
- **`command.ts`, `run-recovery-matrix.ts`.** Selection by `--list | --ready | --case | --row` (row 12 refused). The
  bundle is `test-runs/recovery-matrix/<id>/case-<id>.json` plus `summary.json`.
- **Registration.** `commands.ts`: one union member and one branch, importing `recovery-matrix/command.js` directly,
  because going through the barrel closes a module cycle and the audit allows the deep import for that. `cli.ts`: one
  dispatch branch. `run-scenario.ts` is untouched.
- **Docs.** `docs/architecture/testing-facility.md` has a new section, "The recovery acceptance matrix", after "Run
  perturbations".
- **Tests.** 39, under `recovery-matrix/{tests,records/tests,checks/tests,run/tests,compile/tests}`. The compile test
  saves every matrix Flow through Core's own path, or asserts the exact refusal for gap and Call Subflow rows.

## Commands run and observed results

- **Package checks.**
  - `pnpm --filter @fluxiq-web-extension/test-runner check`: no diagnostics.
  - Build, then `node --test dist/recovery-matrix/**/tests/*.test.js` (five globs): `# tests 39 # pass 39 # fail 0`.
  - Existing tests over `commands.js`/`cli.js` (runner-wiring, auth-cli, cli-llm, clone-cache, commands):
    `# tests 75 # pass 75 # fail 0`.
- **Structure audit.** `node scripts/structure-audit.mjs 2>&1 | grep -E "FAIL|structure-audit:"`:
  `structure-audit: passed (184 warning(s), 651 baselined).`
  - None of the warnings is on a changed file.
  - The earlier runs failed on an import cycle (fixed by the deep import), barrel imports, and `confirm-`/`hub-`
    filename prefixes (fixed with subdirectories).
- **Headed, provider-free runs.** All launched as `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_ALLOW_BEHIND_CORE=1 pnpm lab
  recovery-matrix ...`. Core's `dev` is one task ahead of this tree (t398, not t392), and the tree is read-only.
  Bundles are under `test-runs/recovery-matrix/`.
  1. `--case 1` (`01-31-38`): failed `web.target.not_found` after 4 attempts on the step after the first.
     - The workspace was deleted by my first version of the runner, so the trace is lost. The runner now keeps the
       workspace of any case that does not pass.
     - The counts fit the consent banner being already answered by the interference clearing, but no trace showed it.
  2. `--case 1` (`01-37-15`): s3 failed `web.target.ambiguous`. From the trace: the selector matched, the veto
     refused the input (score -0.26), and 60 scored candidates tied. Fix: an `element` identity on typing steps.
  3. `--case 1` (`01-43-09`): every step succeeded. The coupon's busy refusal was retried. The verdict still failed,
     because the detail was read before Core wrote its zero gate (the stored record shows `costAccounting.calls: 0`).
     Fix: wait for the gate record.
  4. `--ready` (`01-45-37`):
     - Case 1 **passed**.
     - 13a and 13b failed at s3 "Not now". The trace says "closing 1 dialog the page had put in the way" and then the
       target was absent on all 4 attempts. The cookie step had also been answered by the clearing. Fix: every
       overlay step is optional.
  5. `--ready` (`01-50-32`):
     - Case 1 **passed**.
     - 13b **passed**.
     - 13a **failed**: `web.action.rate_limited` on Lin Zhao's confirm (the third), then `web.target.not_found` on 3
       retries.
       - The trace shows the press refused with a 6500 ms wait. During the retry the clearing "closed 1 dialog the
         page had put in the way", after which the Confirm button was gone.
       - The site shows Lin confirmed, `rateLimited: 1`, and 3 confirmed in all. Freya was never reached.
       - OK confirms nothing, so the clearing must have pressed the notice's "Try again", which confirms. The node's
         retry then failed on the missing control, and Core did not recognise that the act had landed.
       - 0 model calls (gate declined).
       - Why the third press was refused at all (the window allows 3) is not shown by Core's attempt record. There is
         no second-press mark on the earlier confirms.
       - Not rerun: the cause is product behaviour, not the Flow.
  6. `--case 3 --case 7 --case 8 --case 10` (`01-56-29`): results as in the Outcome table. Cases 7 and 10 were
     classified `error`.
  7. `--case 7` (`01-59-15`): `not-proven`, `missingRecords: ["handlers"]`, with the gate refusal recorded. This
     verifies the classification change.
- **Retained workspaces.** Under `test-runs/persistent-isolated/` (rmx-1-…, rmx-13a-…, rmx-13b-…, rmx-7-…, rmx-8-…,
  rmx-10-…). They hold the traces quoted above.

## Not verified

- **Rows not run with t392.** No row's lifecycle, entry or frame record was ever seen. The reader's field names follow
  Core C11 and are guessed for t392's actual shape (`lifecycle.event/handlerId/disposition/completionCheck`,
  `entry.kind`, `framePath`, `stateRouting.refused[].guard`). They should be checked against t392's run detail when it
  merges.
- **Rows 9 and 11.** The runner code that arms perturbations was not run in any launch.
- **Bigbox scripts (rows 2, 3, 7, 8).** Their selectors were never executed in a browser. Row 7 never got past the
  gate, and row 8 never compiled.
- **13b's measures bundle.** It predates the last measures fix: it counts the authored End as a second incident. The
  current code does not.
- **Full suites.** Not run, as required. No paid runs. Lane trees and `lab-slots/` were not touched.

## Open questions or contradictions found

1. **Rows 1 and 3 "on current dev" (brief).** Row 1 holds. Row 3 does not.
   - Dev's safe state routing (t387) has nothing to route between: a hand-authored Flow carries no route signatures,
     since only builds write them. A "shortcut" can therefore only be an authored entry.
   - An authored entry needs an element fact (the Today filter's state). The candidate grammar
     (`script-statements/fact-condition.ts`) names an element in a fact only by an evidence handle.
   - The web host already evaluates `{ selector }` fact targets (`domain/src/runtime/facts/query.ts`).
   - A small Core grammar change would unblock rows 2-6: for example `exists "css:<selector>"`, or reuse of a step's
     selector. That is Core work outside this brief. Dialog facts (`dialog <kind> "<name>"`) already work, which is
     why rows 7 and 10 are authorable.
2. **Product finding from 13a.** On a rate-limit notice, the extension's interference clearing pressed the notice's
   "Try again", which performed the committing confirm outside the Flow's knowledge. The node's retry then failed
   `target_not_found`, a true failure, and Core did not recognise that the act had landed.
   - This is in R5a's area (reconciliation; "satisfied step reads as done").
   - It also makes row 13's "retries absorb the rate limit" impossible on dev.
3. **Product finding from 13a and 13b.** The interference clearing closes the very dialog a step targets ("Not now"
   inside the notification prompt). A Flow cannot press a specific choice in such a dialog, for example "Turn on".
4. **Requirement-gate wording.** Dev's run refusal for `flow.handlers@1` arrives as a 400 on `run-runtime-session`.
   `requirement-refusal.ts` matches its sentence ("doesn't offer yet"). A closed code on that refusal would be sturdier.
5. **A failed run's zero calls.** A failed deterministic run carries no `costAccounting`, only the gate's
   `invoked: false` with `llm.gate.training_mode`. `lab replay`'s stricter rule treats that as unknown. The matrix
   reads it as zero; the supervisor may want Core to write the zero accounting for failed runs too.
6. **Missing variant case.** Row 4's `flash-deal-second-item` case is not built (see "What changed").
