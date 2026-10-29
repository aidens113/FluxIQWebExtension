# t792-T: a trial-learned toggle ties to its step by identity, never by position

## Outcome

Done, including the lead's follow-up (the section after "What changed and why"). All changes are in the Core tree
`fxwork/t792/!FluxIQ`. Every check the brief and the follow-up name passed, including the headed e2e (5 of 5). No
commits, no model calls, no Lab live runs.

## What changed and why

**The cause.** A trial's toggle was recorded with `trialNodes` only: the executed id `...<subflow key>.<node key>`.
`toggle-tie.ts` tied a step to it when that id ended with the step's `<subflow key>.<node key>`. For a script, the key
is the step's place (`s1`, `s2`, ... from `authoring/assemble.ts`). So once a revision inserted or removed an earlier
step, the signature landed on whichever step now held that key, even if it was another control. The record also
deduplicated by node id and signature, so a later revision's different step under the same id and signature was
dropped.

**The identity.** A step is known by its node plus its parameters, compared whole, with Core's own `ensureState`
taken off. Core already identifies a step across revisions this way: t666's "step as the revision that ran wrote it"
(`result-verification/standing-no/written-conditions.ts`) is `canonical(node.parameters)`. There is no
revision-stable node id for a plan step. I rejected the other two candidates:

- **The label** is display words. Core's same-behaviour rule (`candidate/unchanged-submission.ts`) sets labels aside.
- **`target` alone** names no control in the web domain, because its resolution drops a resolved `target` and writes
  `selector` plus `element` instead (`domain/.../plan-resolution/resolve-plan-node.ts`).

**The key (position) decides only between twins**: two steps of the plan with the same node and the same parameters.
A step whose parameters match no trial press gets none. Trial presses never tie an exploration call.

Files (all under `packages/fluxiq/src/programs/automation-studio/runtime/`):

- `flow-bootstrap/script-statements/toggle-tie.ts`:
  - A trial press ties only a plan step, by identity, and by key only between twins.
  - Explored presses keep their handle and target ties.
  - The tie input's `ref` became `step: { ref, parameters, others }`.
- `flow-bootstrap/script-statements/toggle-idempotent.ts`: new field `trialParameters?: JsonObject` on
  `AutomationStudioExploredToggle`. It passes the step's parameters and the plan's other nodes to the tie.
- `flow-bootstrap/explored-toggles.ts`:
  - `trial(attempts, graph?)` keeps each trial node's `parameterValues` as `trialParameters`, with `ensureState` off
    and a 16 KiB cap.
  - A node the graph does not show gets none, and that record ties no step.
  - Deduplication also compares `trialParameters`.
- `service/candidate-trial/run.ts` and `service/subflow-trial/run.ts` pass `frames.graph`, which already merges the
  nodes of every invoked sibling subflow. `service/candidate-trial/contracts.ts` updates the port type.
- `flow-bootstrap/subflow-candidate/scoped-submission.ts`: header comment only. The probe-key aliasing stays for
  twins.

Tests:

- New `script-statements/tests/toggle-tie.test.ts`:
  - an inserted earlier step;
  - a removed earlier step;
  - controls trading places never swap signatures;
  - an identical step renumbered keeps its tie, and a changed step gets none;
  - the key decides only between twins, and `ensureState` is not part of identity;
  - a record without parameters ties nothing, and no exploration call is tied to a trial press.
- `service/project-build/tests/project-build-shared-toggles.test.ts`: a new end-to-end case through the real subflow
  trial and a repair's scoped controller. An inserted press of another control takes the trial node's old key, and
  `ensureState` lands on the moved Pin step only.
- These tests were updated to carry or assert `trialParameters`:
  - `toggle-idempotent.test.ts`;
  - `explored-toggles.test.ts`;
  - `submission-toggles-graph.test.ts`, which now hands `trial` the real trial graph;
  - `trial-toggles.test.ts`.

**Mutation check.** With the old key-only tie temporarily restored, 7 of the 11 tests in the two new-test files failed.
I then restored the file.

## Follow-up (lead): other-state words, record persistence, headed e2e

**1. A control named in its other state keeps the tie.** New `flow-bootstrap/script-statements/toggle-state-words.ts`
exports `automationStudioToggleSameAcrossStates(a, b, signature)`, also exported from the barrel.

- It reads only that press's own signature, and only its `gains` and `loses` string lists. A signature without them
  (for example `via: "attribute"`) allows no difference at all.
- Two writings match when they have the same shape (same keys, same list lengths) and every value is equal, except
  text whose words differ only by that signature's words. Words are compared in lower case, split on anything that is
  not a letter or a digit, in any order.
- A list of plain strings (a class list) may also differ in length by those words.
- Any other differing word means another control. So does another toggle's words, because only the press's own
  signature is consulted.

`toggle-tie.ts` now classifies each trial press against the step:

- `exact`: as before, and the key decides only between twins.
- `other_state`: ties only when no other step of the plan on that node matches the press at all. So a plan that
  presses a control and then presses it back ("Like", then "Unlike") ties the press to the exact step, never to the
  undo.

The `explored-toggles.ts` header, which said Core never reads inside a signature, now names this one exception. The
Core doc bullet ("Idempotent toggles", `docs/architecture/automation-studio/llm-flow-bootstrap.md`) is updated too.

**2. The build record keeps what the ties need.**

- `project-agents/record/build-record.ts`: `AutomationStudioProjectBuildToggle` gains two fields:
  - `trialParameters?: JsonObject`, for a trial press only;
  - `target?: JsonValue`, for an exploration press only. Without it, a reload would lose the tie by resolved target.
- `build-record-parser.ts`: allows both keys, each capped at 16 KiB. Each is refused `project.toggle_origin` on the
  other origin, and `trialParameters` must be an object.
- `service/project-build-toggles/toggles-record.ts`: the writer writes both fields. New
  `AutomationStudioProjectBuildTogglesRecord.restored(kept)` turns a record's toggles back into
  `AutomationStudioExploredToggles`.
- `AutomationStudioExploredToggles` takes optional restored entries in its constructor and keeps the newest 256.
- The doc's "Toggles in the build record" bullet is updated.

Nothing reloads a build record mid-build today: Core never restarts a build that is under way (t683, in
`project-agents/supervisor/state.ts`). So `restored` is the seam a resume would use. The new test proves the round trip
through a fresh store: the restored list equals the original, and a renumbered plan is tied the same way from either.

New tests:

- `toggle-tie.test.ts`, three cases:
  - other-state words keep the tie: Like and Unlike, "Save post" and "Saved post", and a class list that gained
    `is-active` under a class signature;
  - different controls never tie: the Like control written with the Save toggle's words, another row's Like, text
    changed by more than the state (a count), and a stated-attribute signature;
  - press-then-undo ties only the exact step.
- `project-build-toggles-record.test.ts`: one reload case, which also checks the origin refusal. The first case now
  expects the explored `target`.

Mutation checks for part 1:

- With the `other_state` branch disabled, the other-state test failed (1 of 9).
- With the "no other step matches" guard weakened, 4 failed, including the undo test.
- The file was restored both times.

**3. Headed e2e.** I rebuilt Core's libraries, then ran the lead's spec set: 5 passed. The like loop passed in both its
newest and pinned variants. The photo-toggle run proposed a Flow (`trialUnlike: true`), and `photo-dialog-step` passed.

## Commands run and observed results

**Second round, after the follow-up.** One script (`scratchpad/t792T/validate2.sh`, logs in `scratchpad/t792T/v2/`)
ran everything inside one hold of the shared lock.

- (`packages/fluxiq`) `pnpm test` over `flow-bootstrap`, `service/project-build-toggles`, `service/project-build`,
  `service/candidate-trial`, `service/subflow-trial` and `project-agents/record`:
  - parallel: 316 files passed, 1 skipped (3406 tests passed, 2 skipped);
  - real-sql: 9 files passed (57 tests);
  - "all groups passed: parallel, real-sql".
- The three prompt-contract tests (`llm/deepseek/tests/system-prompt.test.ts`,
  `flow-bootstrap/plan/tests/extraction-vocabulary.test.ts`, `flow-bootstrap/plan/tests/issue-feedback.test.ts`) ->
  3 files and 70 tests passed; both groups passed.
- (root) `pnpm structure:check` -> rc 0, "passed (450 warning(s), 1152 baselined)".
- (root) `pnpm docs:reference` -> rc 0.
- (root) `pnpm docs:check` -> rc 0.
- (root) `pnpm check` -> rc 0. Script tests: 471 passed, 0 failed. `fluxiq:check` and `web:check` were rebuilt and
  passed.
- (Core) `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> rc 0.
- (downstream `apps/extension`) `pnpm test:e2e e2e/site-reset/tests/judged-change-like-loop.spec.ts e2e/site-reset/tests/photo-toggle.spec.ts e2e/site-reset/tests/photo-dialog-step.spec.ts --workers=1`
  -> rc 0, "5 passed (6.8m)", headed Chromium. The extension build verified 22 files for each of chrome, firefox and
  e2e-chromium.
- After my script's exit, another agent took the shared lock at 00:06:32. It is not mine and I left it alone.

**First round**, before the follow-up:

- The brief's `pnpm test` set -> parallel 275 files passed (1 skipped), real-sql 8 passed.
- The prompt-contract tests passed.
- `pnpm check`, `structure:check`, `docs:reference` and `docs:check` -> rc 0.

## Not verified

- No Lab live run.
- I did not read the e2e runs' build records, so I do not know which tie (exact or other-state) each live step got.
- A repair whose resolved `element` differs by more than the toggle's words still gets no tie, for example a count in
  the name ("Unlike 13"). This is deliberate.
- I ran no downstream unit tests or downstream `tsc` on their own. No downstream file changed, and the extension `tsc`
  inside `test:e2e` passed.
- No production path calls `restored` yet, because nothing resumes a build that is under way.

## Open questions or contradictions found

1. The brief suggested "label plus target". I used parameters, for the reasons above.
2. Between twins whose keys both moved, the tie goes to neither. This is deliberate, and documented in `toggle-tie.ts`.
3. The downstream header `domain/src/actions/toggle-signature/signature.ts` still says "Core stores it whole and never
   reads inside it". Core now reads `gains` and `loses` for the other-state tie. I did not edit it because it is
   outside this tree; the lead should update that comment.
