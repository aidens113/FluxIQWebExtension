# t195-w1 report — debug of `run-munnop9n-5475d593` (lane D, control flow)

## Outcome

Done. The debug is at `docs/working/language-driven-flow-loop-plan/debugs/run-munnop9n-5475d593.md`.
Every template field is filled, or marked `NO EVIDENCE:` with what is missing. Stage 1 is
copied verbatim, and all seven brief questions are answered with the file and field they rest
on. No product code was touched, and no Lab or browser run was started.

## What changed and why

- Added `debugs/run-munnop9n-5475d593.md`, filled from the bundle, the Lab stdout and the 6
  `-r2-` screenshots.
- Added this report.

The numbered causes, each with its file:line:

1. **Routing is told in one place only**: the `change` enum text in Core
   `runtime/flow-draft/amendment.ts:107`, carried by the `amend_draft` variant
   (`llm/evidence-loop-decision.ts:175`, offered at `llm/evidence-loop.ts:490-491`).
   - The decision instruction (`evidence-loop-decision.ts:44`) and the draft tellings
     (`flow-draft/entry.ts:43,56,57`) say nothing about routing.
   - The only other mention is `flow-draft/dry-run.ts:212`, which offers `optional` and
     `only_if` after a failed replay.
   - The model stated **`optional` only**, on d6 and d21 at iteration 32. That is inferred from
     the Merge nodes `s3` and `s8` via `draft-routing.ts:103-107`. It never stated `repeat` or
     `only_if`.
2. **The instruction contradicts drafting.** `evidence-loop-decision.ts:44` ("never mutate …
   never repeat a successful mutation") conflicts with `entry.ts:43` ("run, not written").
   The model pressed Confirm only after `instructed_act_missing` forced it, and only once.
3. **The instructed-acts check is one act = one step.** `instructed-acts/instruction-acts.ts:82`
   reads a single `confirm` act, and `instructed-acts/check.ts:74-87` accepts any one kept
   mutating step, including an `optional` one.
4. **The dry run exempts conditional steps.** `flow-draft/dry-run.ts:163-165` together with
   `routing.ts:109-124` let a Confirm that failed replay twice ship as `optional`.
5. **The Confirm targets a fixed card.** `listPosition` is 1-based
   (`apps/extension/src/content/identity/context.ts:230`), so s7 targets list index 0. Per
   stage 1 that request does not qualify, and screenshot t4 shows it accepted.
6. **Wrong order, no filter.** s6 extract precedes s7 and has no `where`
   (`domain/src/actions/extraction/request.ts:310-324`). It returns all 8 cards; one has no
   mutual line, which trips `core-observation.ts:62`.
7. **Iterations 12–26 counted as progress.** They were 8 reruns plus 5 unchanged, 1 withdraw
   and 1 undo, all on the extraction. They counted because `decision-handlers/amendment.ts:86,95`
   and `evidence-loop.ts:559` exempt reruns, and only `no-progress.ts:146` byte equality could
   flag them.
8. **`not_a_wrong_answer`.** `result-verification/verify.ts:121-122` short-circuits on
   `required_values_missing`, and `recovery/refuted-result/reauthor.ts:84-85` routes only
   `does_not_answer_request`.
9. **The repair lacked s6's parameters.** `recovery/context.ts:243` (8,000 B) and `:322-329`
   dropped `step_parameters`, `subflow`, `route_context` and `recent_nodes`.
10. **`runtime_patch` failed `llm.provider_output_invalid`** at
    `llm/deepseek/response-envelope.ts:59-72`. The throw at `:43` discarded the usage, so the
    call was charged its reserved 48,000 / 8,000 tokens and $0.0833.
11. **Iteration 2 was `llm_output.invalid_evidence_decision`** (`llm/harness/provider-result.ts:146`
    or `:171`: the decision was not an object or had an unsupported kind). The trace shows
    `issues=-` because `evidence-loop/progress-trace.ts:66-67` reads the wrong field.
12. **The facility's final-state oracle checks only the path**
    (`social-network-feed/manifest.ts:196`, `test-runner/.../oracles.ts:32`), so it reported
    `held`.
13. **The panel misreports.** It shows "Done" mid-build (`panel/simple/now-copy.ts:52-54`) and
    "Add an AI model key — To do" while a key is in use (`panel/simple/start/setup-steps.ts:50-52`).
    No on-page status overlay is visible in any shot.

Q3: `confirm-request-1` was refused at `domain/src/runtime/llm-evidence/node-run/run.ts:258-262`
(`target_not_a_handle`). The model named no `{handle}`; it used an invented locator. No page
action ran (58 ms, 217 B). It was neither the notifications dialog nor a stale handle, which
would take the `handleRefusal` path at `:248-251`. Which target it named is NO EVIDENCE.

## Commands run and observed results

These were read-only inspections; nothing was built or run.

- `node -e` over `snapshots/flow-lane.json`, `decision-trace.json` and `live-llm.json`.
  - Printed 42 evidence-loop steps, 9 playback actions and 6 authored nodes.
  - `harnessRecovery`: diagnosis ok, then `runtime_patch` `llm.provider_output_invalid`.
  - `providerCalls[6].charged.tokens = "reserved"`.
- `cat` of `logs/core.log`: 33 decisions. The completion checks gave `false`, `false`, `true`
  and `true`. `dryrun.N.6` was `unreproducible` ×4, and `dryrun.3.21` / `dryrun.4.21` were
  `core.replay.failed`.
- `cat` of `evaluation.json` and `extraction-mismatches.json`: 8 observed rows, 4 expected,
  `matchedInAnyOrder` 4, no field mismatches.
- The 6 screenshots were viewed. They show the side panel throughout, a notifications dialog
  at t1–t3, the list-index-0 card accepted at t4, a cookie dialog at t5, and no on-page
  overlay.
- `stat` on the dirty Core and facility files: every cited file was last written before the
  run's build at 05:17:56Z, so the line numbers are the ones the run executed.
- A privacy grep over the debug for `127.0`, `http`, `href` and `[aria` found nothing.

## Not verified

- **The content of each rerun argument** (iterations 12–25), and whether the eight 8,563-byte
  answers were identical. Neither is in the bundle.
- **The configured `maxStepsWithoutProgress` for this build.** Under the default of 8, identical
  answers would have stopped the loop at iteration 21.
- **Which card `main.s7` pressed in playback**, and whether the card at list index 0 was
  accepted by build iteration 30 or by the dry-run 3 press.
- **Why `d21` failed replay.** The trace carries the code only.
- **Which `runtime_patch` check refused the reply**, and iteration 2's exact shape.
- **The prompts the model actually received.** They are not exported; the answer to "was
  routing shown" is from the code at the run's commit.
- **The instructed-acts refusal reasons at 27 and 29.**

## Open questions or contradictions found

- **The brief's framing is off on two counts.**
  - It says s7 targets "index 1 of 8". `listPosition` is 1-based, so that is the first card
    (list index 0), a non-qualifying request per stage 1, not the second.
  - It says the `resultReauthor` refusal came although "the oracle says the answer is wrong".
    Core never sees the oracle. Its own deterministic finding (`required_values_missing`)
    pre-empts the model's "does it answer" judgement.
- **`draft.instructionBytes` is the size of the draft entry's own guidance, not of the
  person's instruction.** It falls 1052 → 618 → 154 as the draft fills its 4,000-byte budget.
  From iteration 23 the model's draft entry names no amendment word at all.
- **Accounting overstates the repair's cost.** $0.0833 of $0.0928 is a reserved ceiling, not
  spend.
- **The side panel reports "Add an AI model key — To do"** during a live-provider run.
