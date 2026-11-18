# t893 proof debug (worker report)

## Outcome

Done. Final proof `run-mwm3xdhv-216b9033` exited 0 with `"status":"passed"`. All four attempts were right and ended achieved, and every later attempt continued the one before it. All of it was provider-free.
The cause was (a), the script, in three separate defects. It was not (b) t893's readiness change, and not (c) the fixture or task. One Core defect is left over (see Open questions): the judge is still asked on attempts 3 and 4.

## Cause, with step-file evidence (run-mwlxtalc-4297736d)

1. **The script used an amendment Core dev does not have.** Request 12 (`steps/0028-decide`) sent `{"change":"take","call":"read-accepted"}`. Core answered `llm.provider_output_invalid`: `amendments[0].step is missing`, `change must be one of "add","drop",...`, `call is not a key this object takes`. Steps 0030-0038 are the same refusal five more times; with step 0028 that is six of the report's "7 provider-format errors". The 7th, step 0045, is the scripted refusal itself (`provider_http_error` 400). `take` exists only on Core `task/t905-result-ledger` (changes.ts `..., "bind", "take"`). `git merge-base --is-ancestor task/t905-result-ledger dev` says NOT merged; only t935's `callId` view was ported. On t905, `take` is just `add` of the unreplaced step whose `callId` matches, at its shown number (`takenAs`, apply.ts:365-370).
2. **What happened at request 20 is fallout from defect 1, not a readiness bug.** After the six refusals Core started a new build attempt (requests 18-20 carry `core.attempt_note.2` and a fresh `core.budget.2/3`), so `read-accepted` was no longer evidence. The script restarted detect, then read, then accept-first. Ximena had already been accepted by hand: at step 0012 her row shows `t490 button "Accept"`, step 0014 pressed it with `web.action.succeeded, effectApplied: true`, and steps 0027 and 0044 show `t611 "Accepted"`. "Shows no Accept" was the true state of the page, not controls that hadn't rendered yet.
3. **The repeat landed on the wrong press** (found in proof run-mwm2glmb-f6c5aed3). The fixture opens Priya Nair's conversation "a few seconds into the session" (scenario-lab `professional-network/shell/overlays.ts:40-41`). This time it opened right after the hand Accept, so `close-7` became draft step 8. `stepOf` picks the *last* kept press of the node type, so the script sent `{"step":8,"change":"repeat","over":6}` (step 0017). The forward passes then failed `row_control_not_found` for Lucia Romano and Chidi Nwosu (steps 0022-0023). In the two earlier runs the popup opened after the forward run (`close-9`), which is why they got past this point.
4. **The judge allowance was sized for two attempts** (proof run-mwlzsno7-bef30d2d). Attempts 1 and 2 passed. Attempt 3 was refused at `loop_verification` 4: note `flow_not_proven` (Core S9, `replay-stands.ts:50`; the `provenWhole` logic is identical on dev and t905). Its replay read `totalRecordCount: 3`.

## Fix (owned files only)

`packages/test-runner/src/attempt-lane/scripted-model/scripts/professional-network-accept-messaged-invitations.ts`:
- `finishFromRead` sends Core dev's `{ step: <shown number of the step whose callId is the chosen read>, change: "add" }`. That is exactly what t905's `take` reduces to. The checks before it are unchanged: the read is unique by callId, not replaced, not written, not intermediate, and successful.
- `stepOf` is replaced by `stepOfCall(callId, actionId)`. The repeat and `forward.from` name the script's own read and press by call identity (`read-invitations`/`accept-first`; for `reshape`, `write-read`/`write-accept`). It throws when the draft has no unique such step. No choosing "the last press of its kind".
- `NOTES_BACK_JUDGES = 4`: the honest notes-back path for 3+ attempts (A1 result; A2 empty replay, then its explored Messaging read; A3 `flow_not_proven` replay). Every judge is still `answersByRows`, which answers no to zero rows. No oracle changed.

Test file: the amendment expectations now use `{step:14, change:"add"}` and the allowance is 4. Three new tests: a Close kept after the hand Accept (this run's draft) still repeats step 7 over 6; reshape repeats its written press over its written read; a draft without call ids is refused. No readiness source changed, so `extension check` was not needed. `docs/architecture/extension-client.md` was not touched (no product change).

## Commands (all through heavy-slot, from the t893 worktree)

- test-runner build x3: EXIT 0 each.
- `node --test dist/.../professional-network-accept-messaged-invitations.test.js`: after fixes 1 and 2, 18/18 pass, EXIT 0; after fix 3, 21/21 pass, EXIT 0.
- `node scripts/structure-audit.mjs` x3: `passed (254 warning(s), 551 baselined)`, EXIT 0.
- Proof 1 `run-mwlzsno7-bef30d2d`: EXIT 1, A1 and A2 right, A3 refused at judge 4 (defect 4).
- Proof 2: EXIT 1 before launch. The Lab's core-commit guard said the shared Core e60e82631 was 5 commits behind Core dev (t930 only; nothing touches flow-authoring or answer-first).
- Proof 3 (`FLUXIQ_LAB_ALLOW_BEHIND_CORE=1`, so it ran against the brief's pinned Core) `run-mwm2glmb-f6c5aed3`: EXIT 1, A1 refused at request 10 (defect 3).
- Proof 4 `run-mwm3xdhv-216b9033`: **EXIT 0, status passed.** The shared Core had meanwhile been synced (not by me) to Core dev 7431351c0, so this ran on current Core dev. The override variable was still set but had nothing to override.

## Final proof run-mwm3xdhv-216b9033 (path C:/Users/osrs_/FluxStuff/fxwork/t893-web-instant-actions-4/test-runs/attempts/run-mwm3xdhv-216b9033)

Flow `flow.d2ba2b78-c561-44f6-8304-9312f62b056a` in every attempt. Provider `scripted`, model none, so no real provider calls. All 24 scripted calls were answered. The Lab port was OS-assigned (127.0.0.1:53970).
- A1 explore: right, achieved, 3 rows. 15 calls (interpretation 1, judge 1, decisions 13). 26.0 s, 14 live steps.
- A2 run_flow_then_explore: right, 3 rows. Continuation held from A1 (startedFrom attempt.c943e521, digest d9e45b09...). 7 calls (judge 1, decisions 6). 39.0 s.
- A3 run_flow: right, 3 rows. Continuation held from A2 (attempt.fc288773, digest d1ab60e2...). 1 call (judge, `flow_not_proven`). 15.1 s, 0 decisions.
- A4 run_flow: right, 3 rows. Continuation held from A3 (attempt.6c4f8ee5, digest d1ab60e2..., the same Flow). 1 call (judge, `step_failed`). 10.1 s, 0 decisions.
The report prints "NOT DETERMINISTIC" because A2-A4 made model calls; the run status is still passed.

## Not verified

Firefox; the plain, reshape and thin forms in a live Lab run (unit tests only); whether the written reshape steps carry `callId` in a real draft (the script refuses rather than guessing if they don't); the full suites.

## Open questions or contradictions found

- **A Core defect (outside my files) makes every replay on a site where the work is already done get judged.** `flow-run/steps-ran.ts:139` gives a step with no attempts `ran: "not_reached"`. In A4's replay the for-each (step 0076) goes straight to its merge (0077) with no Accept press, because no invitation is left to accept. `replay-stands.ts:55` then reports `step_failed` (note at step 0081). The rule's own header says a repeat that does not press twice is "passed over as saved, and no deviation". Fixing this in Core would make A4 a zero-call attempt.
- A3's judge follows Core's "one judged whole run" rule, so it is by design.
- Recommend the scripted model server check each reply against the request's own `outputSchema`, so script/Core protocol drift fails a unit test, not a Lab run. That is outside my files.
- The t893 branch was written against t905's unmerged `take`. Its earlier report (codex-t893-authoring-fix.md) assumed t905 would merge first.
