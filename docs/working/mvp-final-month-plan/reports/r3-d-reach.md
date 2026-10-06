# r3-d-reach: worker report (2026-10-06)

## Outcome

Done. Both lane D round-2 causes are fixed. Each fix has a test that failed before the fix and passes after it. Nothing is committed. Trees: `fxwork/t275/!FluxIQ` and `fxwork/t275/!FluxIQWebExtension`, both on branch `task/t275-live-lane-d`.

## What changed and why

### D2-2 (downstream): a list that never appeared on another page is `unreproducible`

- `domain/src/runtime/llm-evidence/node-run/replay.ts`: when a replayed step fails with `about.resultReason === "list_never_appeared"` (the read's own account, `action-failure/read-shortfall.ts`), the new `listNeverAppeared` function takes the page once and compares its location with the `from.location` the step recorded.
  - If both are known and they differ, it answers `core.replay.unreproducible`. The `said` is "...its list never appeared, and this is not the page it read, so the steps before it no longer reach that page", and the reason `list_never_appeared` is kept.
  - On the read's own page, or when either location is unknown, it answers `core.replay.failed` exactly as before, with the same `said` and page notice that `failedOnPage` gives.
  - It never answers `remembered`, because a read changes nothing a site could remember. `missing-target.ts` was not touched; it is outside my ownership.
- `node-run/tests/replay-read-account.test.ts`: extended rather than adding a 26th file to `tests/`, which already holds 25. The new test covers three cases: the list read on another page is `unreproducible` and keeps reason `list_never_appeared`; on its own page it is `failed`; with an unknown `from` it is `failed`.

### D2-1 (Core): an amend decision that strands a kept step from its page

- New `R/flow-draft/amendment/reach.ts` (`automationStudioFlowDraftReach`) reads the draft's reach. Pages are keyed by the host's `replay.from`, written as canonical JSON and compared for equality only, never read. Steps are put in run order by their `d<n>` ids. Where a step "leaves" the target is where the next appended step that has a page found it. From this it builds two sets:
  - `unreached`: the step before it in the Flow does not leave it on its page.
  - `noWay`: no step of the Flow moves the target to its page, and the page is not the test's start.
  - Anything unknown counts as reached.
- New `R/flow-draft/amendment/strand-check.ts` (`automationStudioFlowDraftStrandCheck`) runs at the end of `applyAutomationStudioFlowDraftAmendments`:
  - **Drops are refused.** A `drop` or `exploratory` of a step that was in the Flow and moved the target to a page is put back and refused if, after the decision, a kept step on that page has no way there and had one before. The refusal carries `strands: <the stranded step's shown number>`. The check repeats until nothing changes, so the 0030 shape refuses both navigations: requests (strands the listing) and friends (strands the requests navigation once that is back). Close chat is still dropped.
  - **Moves and adds are reported, not refused.** A step newly left `unreached` gets an informational entry (`unreached: true, after, reachedBy`) beside the applied decision. This covers a step the decision added or moved there, or one whose previous step changed. It is not a refusal, because undoing a move after the rest of the decision has been applied is not clean. The 0025 shape (`add 12 to: 2`) is now reported.
  - **Newly stranded only.** A step that was already stranded before the decision is never reported or refused.
- `apply.ts`: takes the reach before the first amendment, records each kept-to-withdrawn change (with the prior settings), runs the check last, and subtracts the drops it put back from `applied`.
- `types.ts`: new optional refusal fields `strands`, `unreached`, `after`, `reachedBy`.
- **The refusal reason is borrowed: `changes_nothing`.** A new reason in the union fails the exhaustive map in `R/flow-bootstrap/evidence-loop-steps.ts` (`EVIDENCE_STEP_AMENDMENT_REFUSAL_REASONS`), which is on my must-not-touch list. This follows the existing precedent: `NOT_A_FLOW_STEP` and the replaced-attempt reason both borrow. The borrowed reason lives in one constant in `strand-check.ts`.
- `R/llm/draft-amendment-feedback.ts`: the model never sees the borrowed word. A refusal with `strands` is shown as `strands_a_step`, and one with `unreached` as `left_unreached`. Each has its own entry in `reasons` (`REACH_REASONS`) and a `next` naming the steps by number:
  - for a refused drop: "Step 4 stays in the Flow: it is the only step ... where step 6 acted ...";
  - for `left_unreached`: the step before it now, the steps that reached its page while exploring, and the reorder to make (or, when no step reached it, to run the step that gets there).
  - `left_unreached` is handled like `repeat_taken_off`: it is not counted as an amendment refused, never marked `repeated`, and comes with its own instruction line.
- Tests:
  - new `R/flow-draft/amendment/tests/reach.test.ts`, with 4 tests: the 0030 shape, harmless drops, the 0025 shape, and no report for steps already stranded or with unknown pages;
  - a new describe block of 3 tests in `R/llm/tests/draft-amendment-feedback.test.ts`.

## Commands run and observed results

**Fail-first**

- Domain, before the `replay.ts` fix: `node <scratchpad>/tools/run-subset.mjs <domain> r3d .../replay-read-account.test.ts` then `node --test` printed `not ok 17 ... expected: 'core.replay.unreproducible' actual: 'core.replay.failed'` and `# pass 16 # fail 1`.
- Core, before `reach.ts`, `strand-check.ts` and the `apply.ts` change: `npx vitest run .../amendment/tests/reach.test.ts` printed `2 failed | 2 passed (4)`. The two that passed are the "nothing said" cases.
- Feedback: with `draft-amendment-feedback.ts` temporarily restored to HEAD, `npx vitest run .../llm/tests/draft-amendment-feedback.test.ts` printed `3 failed | 49 passed (52)`. The file was then restored.

**After the fix**

- Core, run twice: `npx vitest run src/programs/automation-studio/runtime/flow-draft/ src/programs/automation-studio/runtime/llm/tests/draft-amendment-feedback.test.ts` printed `Test Files 27 passed (27)` and `Tests 338 passed (338)` both times. This covers all of `R/flow-draft` (tests and subdirectory tests) plus the feedback test.
- Core, extra: the llm tests that use drafts with `from` and drops, plus `R/llm/decision-handlers` and `R/llm/evidence-loop/tests`, printed `Test Files 38 passed (38)` and `Tests 409 passed (409)`.
- `node scripts/build-cache/cli.mjs fluxiq:check` exited 0. The first run exited 2 on a TS2345 in my own test (`replay: undefined` under `exactOptionalPropertyTypes`); after fixing it, exit 0.
- `node scripts/build-cache/cli.mjs structure-audit:check` (Core) printed `structure-audit: passed (263 warning(s), 349 baselined)`.
- `pnpm.cmd build` (Core) exited 0, both before the downstream checks and after the Core changes.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` exited 0.
- `node scripts/structure-audit.mjs` (downstream):
  - first run: exit 1, a `[contract-spread]` violation in my test at line 400 (`{ ...page(), url: at }`);
  - after fixing it: exit 0, `passed (171 warning(s), 118 baselined)`.
- Domain, run twice: `node --test` on the rebundled six replay test files (`replay-read-account`, `replay`, `replay-remembered`, `replay-verify`, `replay-permission-reason`, `replay-ambiguous-target`) printed `# tests 64 # pass 64 # fail 0` both times.
- `pnpm.cmd --filter @fluxiq-web-extension/domain build` exited 0.

## Not verified

- No Lab, browser or provider run, as the brief requires. The live effect on lane D is unproven.
- Neither the replay trace nor the run's step folders hold step digests or raw draft steps, so `replay.from` on every appended step (looks included) is inferred from `domain/.../replay.ts` ("written on every step"), not from the run's own records.
- Known imprecision in "where a step leaves the target":
  - It is read as the next appended step's `from`. After a whole-Flow test, the last exploration step before the test gets the page the test stopped on as its "leaves". That can hide a stranding (no harm) or, rarely, refuse a drop wrongly.
  - A page whose address drifts by itself (query or hash) can produce an informational `left_unreached` that is not real. It is never a refusal.
- `held-amendments.ts`, outside my ownership, renumbers each refusal of a held amendment to the amendment's own step. An informational `unreached` entry from a held amendment would carry that step number rather than the stranded step's. Not exercised.
- The progress accounting in `decision-handlers/amendment.ts` (not mine) was not re-examined for a decision whose only entries are informational `left_unreached`. It should behave as the `repeat_taken_off`-only case does.

## Open questions or contradictions found

- A dedicated reason needs one line in `R/flow-bootstrap/evidence-loop-steps.ts` (`EVIDENCE_STEP_AMENDMENT_REFUSAL_REASONS`; add e.g. `strands_a_step: true, left_unreached: true`), plus the two reasons in `types.ts` and `REFUSAL_REASONS`. After that, `REACH_REASON` in `strand-check.ts` can be split, and `shownReason`/`REACH_REASONS` in the feedback can fold into `REFUSAL_REASONS`. Until then, traces and bundles record these entries as `changes_nothing` with `strands` or `unreached` beside them.
- Moves and adds that strand a step are reported, not refused. The brief prefers refusal "of the stranding part". For drops it is refused; for moves it is information only, because an undone move would also have to undo the `replayed` marks and the repeat revalidation the move triggered. If refusal is wanted there too, it is a further change in `apply.ts` and `move.ts`.
- The Lane A brief (r3-a) owns `R/llm/decision-handlers/**`. If it changes how refusals count toward progress, `left_unreached` (borrowed `changes_nothing`, informational) should count like `repeat_taken_off`, not as no progress.

## Follow-up (supervisor, same day): dedicated reasons replace the borrowed `changes_nothing`

This section supersedes every mention above of the borrowed reason and of the `unreached: true` field, which no longer exists.

### What changed

- **`flow-draft/amendment/types.ts`**: the reason union gains two members:
  - `strands_a_step`, a real refusal. The drop is put back, and the entry carries `strands`.
  - `left_unreached`, information on an applied decision, not a refusal. It carries `after` and `reachedBy`.

  The `unreached` field was removed.
- **`flow-draft/amendment/strand-check.ts`**: the borrowed `REACH_REASON` constant is gone. Each case now emits its own reason.
- **`flow-bootstrap/evidence-loop-steps.ts`**: `EVIDENCE_STEP_AMENDMENT_REFUSAL_REASONS` gains `strands_a_step: true` and `left_unreached: true`. Nothing else in that file changed.
- **`llm/draft-amendment-feedback.ts`**:
  - `shownReason` and `REACH_REASONS` are folded into `REFUSAL_REASONS`.
  - A new set, `NOT_REFUSALS`, holds `repeat_taken_off` and `left_unreached`. Entries with those reasons are never marked `repeated` and never trigger the "changed nothing" instruction.
  - `next` is keyed by reason.
- **Tests**:
  - `reach.test.ts` and the feedback tests now expect the new reasons.
  - The exhaustive `everyReason` map in `draft-amendment-feedback.test.ts` gains both reasons.
- **Outside the files I was allowed to edit:** `src/ui/activity-action/refusal-words.ts`. I added `strands_a_step` and `left_unreached` to `ACTIVITY_ACTION_REFUSAL_WORDS.amendment`.
  - Why: without them `fluxiq:check` fails with TS2739 at `R/activity/wording/draft-edit-card.ts:21`. That file's `SAID` map is exhaustive by type and reads this object.
  - The file is not under `R/activity/**`, but it is outside the files you named. Please confirm or reassign the change.
  - The `left_unreached` words exist only to satisfy the type. No card should ever show them as "Not done".

### Every reader that maps or counts refusal reasons, and how it treats `left_unreached`

Each item gives what happens today and what it must do instead.

1. **`R/flow-bootstrap/evidence-loop-steps.ts:181-204`** (exhaustive allow-list)
   - Today: allowed, and kept as written in `amendmentsRefused` and `amendmentRefusals` beside real refusals.
   - Needed: no further change here. Readers of these fields must not count `left_unreached`.
2. **`R/llm/draft-amendment-feedback.ts`**
   - Done in this change: the entry is excluded from `amendmentsRefused` and from `repeated`, and gets its own instruction line.
   - `ok` and `code` still say `draft_amendments_refused` whenever any entry exists, as they already do for `repeat_taken_off`.
3. **`R/llm/decision-handlers/amendment.ts`** (other owner; described only)
   - Today: `:72` merges the entry into `refused`. That flows into `refusedCount` (`:91`), the row's `amendmentsRefused` (`:96`) and the history `refusals` (`:77-83`).
   - `:109` (`repeatedOnly`) is harmless: a `left_unreached` entry only exists when something was applied.
   - `:142` tells the model whenever `refused.length` is non-zero, which is wanted here as information.
   - Needed:
     - Exclude `left_unreached`, and arguably `repeat_taken_off`, from `refusedCount` and from the history `refusals`.
     - Either record these entries under a separate key such as `amendmentNotes`, or keep them where they are and have every reader skip them.
4. **`R/llm/evidence-loop/amendment-memory.ts:49-55`**
   - Today: a second `left_unreached` about the same step is marked `repeated`. The feedback now ignores that mark.
   - Needed: never mark it repeated. Lane A's new "identical to a refused amendment" guard (t262 tree, which I have not read) must key on real refusal reasons only, excluding `left_unreached` and `repeat_taken_off`.
5. **`R/llm/decision-context/group.ts:92-104`**
   - Today: any entry makes the history row `role: "refusal"` and puts the reason code in the refused cells.
   - Needed: exclude `left_unreached`, so the row reads `other` / `applied`.
6. **`R/llm/step-log/answer-step.ts:146,238-242`**
   - Today: an applied decision whose only entry is `left_unreached` is logged `partly_applied`.
   - Needed: count only real refusals, so it is logged `applied`.
7. **`R/llm/evidence-loop/held-amendments.ts:91`**
   - Today: `step` is overwritten with the held amendment's step number. That is wrong for this entry, which names the stranded step.
   - Needed: pass it through without renumbering, as `repeat_taken_off` is passed (renumbering it the way `takenOffAsWritten` does).
8. **`R/activity/decision-answer/draft-edit.ts:106-110,120-121`**
   - Today: the entry counts toward `reasons`, so the answer becomes `refused` and the card reads "partly done".
   - Needed: drop `left_unreached` and `repeat_taken_off` from `reasons`.
9. **`R/activity/decision-answer/edit-words.ts:140`**
   - Today: an amendment is treated as not applied when an entry names its step. In the 0025 shape the entry names the step the `add` named, so the applied add vanishes from "Changed: ...".
   - Needed: ignore `left_unreached` entries here.
10. **`R/activity/wording/draft-edit-card.ts:21,73`**
    - Today: `:21` compiles only because of the `refusal-words.ts` entries above. `:73` words "not done" from the reasons.
    - Needed: nothing beyond item 8. Once item 8 is fixed, `left_unreached` never reaches "not done".
11. **`R/service/flow-bootstrap-commands/evidence-trace.ts:131,169`**
    - Today: the entry is carried through as a refusal.
    - Needed: label it as information.

`strands_a_step` is a real refusal, and every reader above already handles it correctly.

### Commands run (follow-up)

- **Fail-first:** with `strand-check.ts` temporarily writing `changes_nothing` again, `reach.test.ts` printed `2 failed | 2 passed (4)`. The file was then restored.
- **Changed tests, run twice:** `npx vitest run R/flow-draft/ R/llm/tests/draft-amendment-feedback.test.ts R/flow-bootstrap/tests/evidence-loop-steps.test.ts src/ui/activity-action/tests/refusal.test.ts` printed `Test Files 29 passed (29)`, `Tests 382 passed (382)` both times.
- **Neighbouring readers:** `npx vitest run R/activity/ R/llm/decision-handlers R/llm/evidence-loop/tests R/llm/step-log` printed `Test Files 58 passed (58)`, `Tests 518 passed (518)`.
- **`fluxiq:check`:** exit 2 with the TS2739 above. After the `refusal-words.ts` entries were added, exit 0.
- **Core audit:** `passed (263 warning(s), 349 baselined)`.
- **Core `pnpm.cmd build`:** exit 0.
- **`domain check`:** exit 0, run against the rebuilt Core.

### Not verified (follow-up)

- No test checks that `evidence-loop-steps.ts` keeps a step carrying the new reasons. Only the source file was allowed, so I added none.
- Items 3-11 are unchanged. Until they are fixed, a `left_unreached` note is still counted as a refusal in the row, the history, the step log and the activity card.

## Second follow-up (supervisor): the note comes out of the refusal list at its source

This section supersedes the first follow-up's list of 11 readers. `left_unreached` no longer exists anywhere. The base is the t275 branch after the supervisor's commits and dev merge (Core `d2296f55`), which includes lane A's loop fix. Nothing is committed.

### What changed

- **`flow-draft/amendment/types.ts`**
  - `left_unreached` is removed from the reason union.
  - The refusal no longer carries `after` or `reachedBy`.
  - New exported type `AutomationStudioFlowDraftUnreachedStep = { step, after, reachedBy }`, documented as not a refusal.
  - `strands_a_step` stays.
- **`strand-check.ts`**: returns `{ refused, takenBack, unreached }`, where `refused` holds only `strands_a_step`.
- **`apply.ts`**: returns `unreached` as its own field beside `applied`, `refused` and `moved`, only when there is any.
- **Lists of reasons**: `left_unreached` is removed from the `flow-bootstrap/evidence-loop-steps.ts` allow list and from `src/ui/activity-action/refusal-words.ts`. `strands_a_step` stays in both. Nothing else under `src/ui/**` was touched.
- **`llm/draft-amendment-feedback.ts`**
  - New input `unreached`. The answer carries `unreached: [{ step, after, reachedBy, note }]` beside `refused`, the same way `moved` is carried.
  - New instruction line: "unreached is not a refusal...".
  - An answer whose only news is `unreached` is `ok: true` with code `llm_evidence_loop.draft_step_unreached`, mirroring the moved-only answer.
  - The `NOT_REFUSALS` set is gone. `repeat_taken_off` is handled as it was before.
- **`llm/decision-handlers/types.ts`**: `AutomationStudioLlmEvidenceRerunHeld` gains `unreached`.
- **`llm/decision-handlers/amendment.ts`**
  - `amended.unreached` is passed to `tell(...)`. It is told when it is the only news, and it is carried on `held` when amendments wait for a rerun.
  - It never enters `refused`, so none of these see it: `refusedCount`, the row's `amendmentsRefused`, the history `refusals`, `repeatedOnly`, `amendmentMemory.refusals`, the `same_amendment` key, or the held refusals.
  - Lane A's paths are unchanged otherwise.

The 11 readers from the first follow-up now never see the note. An applied decision whose only news is a note has no `amendmentsRefused` on its trace row, so:

- `step-log/answer-step.ts` reads it `applied`;
- the activity readers (`draft-edit.ts`, `edit-words.ts`, `draft-edit-card.ts`) read it as landed;
- `decision-context/group.ts` reads its history row as `other`/`applied`;
- the evidence trace carries nothing for it.

### Tests

- **New `llm/decision-handlers/tests/unreached-told.test.ts`**: runs the 0025 shape through the real loop with host `replay.from`. The draft is home, friends and requests (added), then the listing run and added at step 2.
  - The model's answer is `ok`, `draft_step_unreached`, `refused: []`, `applied: 1`.
  - The `unreached` note names steps 4, 1 and 3.
  - The instruction does not say "changed nothing".
  - The amend row is `draft_amended`, `amended: 1`, with no `amendmentsRefused`.
- **`reach.test.ts`**: the 0025 case now expects `refused: []` and `unreached: [{ step: 5, after: 1, reachedBy: [4] }]`.
- **`draft-amendment-feedback.test.ts`**: `left_unreached` is removed from the exhaustive `everyReason` map, and the two note tests now pass `unreached`.
  - An answer with only the note is `ok`, with empty `reasons` and no "changed nothing".
  - The note also stands beside a `no_such_step` refusal in the same answer.

### Commands run and observed results

- **Fail-first:** with `decision-handlers/amendment.ts` temporarily restored to HEAD, `npx vitest run .../decision-handlers/tests/unreached-told.test.ts` printed `AssertionError: expected undefined to match object { ok: true, …(4) }` and `1 failed (1)`. The file was then restored.
- **Tests, run twice:** `npx vitest run R/flow-draft/ R/llm/tests/draft-amendment-feedback.test.ts R/llm/decision-handlers R/llm/decision-context R/llm/evidence-loop R/llm/repeat-guard R/flow-bootstrap/tests/evidence-loop-steps.test.ts src/ui/activity-action/tests` printed `Test Files 78 passed (78)` and `Tests 921 passed (921)` both times. This run includes lane A's tests.
- `fluxiq:check`: exit 0.
- Core `structure-audit:check`: `passed (263 warning(s), 349 baselined)`.
- Core `pnpm.cmd build`: exit 0.
- `domain check`: exit 0, against the rebuilt Core.
- `grep -rn left_unreached packages/fluxiq/src`: no matches.

### Not verified (second follow-up)

- **Notes from held amendments are lost.** An `unreached` note produced while held amendments are settled is dropped, because `evidence-loop/held-amendments.ts` `settle()` (not mine) returns only `applied` and `refused` from each per-amendment apply. Such a note is never counted as a refusal, but it is also never told. Telling it needs `settle()` to return `unreached`, renumbered to the numbers the model wrote, as `takenOffAsWritten` does for taken-off repeats.
- **The step-log verdict was not exercised directly**, because it needs a log directory in env. It is derived from the row's `amendmentsRefused`, which is now absent for a note.
- No live run.
