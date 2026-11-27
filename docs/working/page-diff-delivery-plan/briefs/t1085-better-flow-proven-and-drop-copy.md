# Brief t1085: a proven Flow beats an unproven one, and a step is not a copy of one being dropped

**Goal.** Fix two defects found in bigbox run-mwz29d50. Neither fix may add a count, cap or wait.

**1. The kept Flow wins over a repair judged yes.**
- Core `packages/fluxiq/src/framework/automation-service/service/answer-first/task-memory/better-flow.ts:39-43`
  keeps the old Flow whenever both are `confirmed` and the old one did not "break live".
- In attempt 3:
  - the kept Flow (`best`, `provenWhole: false`) was replayed;
  - its judged whole run came back `unknown`, so the attempt repaired;
  - the repair's Flow (`latest`) was judged yes;
  - `best` was still kept, so attempt 4 repeated attempt 3 exactly.
- **The rule.** Proof beats no proof. When both are confirmed, a next Flow whose whole run was judged yes replaces a
  kept Flow that is not `provenWhole` and whose own judged whole run in this attempt did not come back yes.
- Fix it where the facts are: in `better-flow.ts`, or in its caller if that is where "the kept Flow's judged run did
  not stand" is known. Keep the table in the file's header true.
- **Test.** A unit test with this run's two records, as F3 in the report describes: today it returns `best`, and
  after the fix it returns `latest`.

**2. The draft amendment refuses a step as a copy of one the same decision drops.**
- Core `packages/fluxiq/src/runtime/flow-authoring/draft/amendment/apply.ts:232-236` and `:259-266` check a `keep` or
  `result` for `second_copy` against the steps as they stand, ignoring a `drop` in the same decision.
- In step 0058, "keep 18, result 18, drop 13" was refused as 18 being a copy of 13.
- **The rule.** The check runs against the steps as they will stand after that decision's drops. Keep the
  per-decision atomicity (t1069).
- **Test.** A unit test with that shape.

**3. Which read is the result (kestrel run-mwz2jc4w, K3).**
- Attempt 2's saved Flow kept its carried read as the draft's result. Every fresh read of the same list was marked
  "not the result", while the result line said "no read step yet". The model read three more times ($0.29).
- Rows read before the model made step 14 the result were not credited ("v1 has read no page yet"), so the paging
  loop was rebuilt and run twice ($0.39).
- **The rule.**
  - A carried read that has not run this attempt does not hold the result against a fresh read of the same list.
  - The header and the draft name the same step.
  - Rows a read took before it was ruled the result stay credited to it.
- **Where.** Core `packages/fluxiq/src/runtime/flow-authoring/draft/compose/compose.ts:98-110`, and the answer-first
  result feed.
- **Proofs.** As "K3" in `docs/working/page-diff-delivery-plan/reports/run-mwz2jc4w-kestrel.md` describes:
  - compose on 0052's recorded draft;
  - 0058's amendment keeps page 1's 26 rows.

**Read first.**
- `docs/working/page-diff-delivery-plan/reports/run-mwz29d50-bigbox.md`, sections "F3" and "Secondary".
- `docs/working/page-diff-delivery-plan/reports/run-mwz2jc4w-kestrel.md`, sections "Q3" and "K3".
- The files above and their `tests/` folders.

**Owned.** Core (`fxwork/t1085-better-flow-proven-and-drop-copy/!FluxIQ`):
- `.../answer-first/task-memory/**`, and the caller of `automationStudioAnswerFirstBetterFlow` if needed;
- `packages/fluxiq/src/runtime/flow-authoring/draft/amendment/**` and `draft/compose/**`;
- the answer-first result-feed files K3 needs (name them in the report);
- their tests.
- Not `answer-first/attempt/**` (t1088).

**Must not touch.**
- `engine/automation/state-routing/**` and `domain/src/**` (t1083).
- `runtime/result-verification/**` (t1084).
- `packages/test-runner/**`.

**Checks.** Put heavy commands through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1085-<label> -- <cmd>`.
- The tests beside the changed files: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql <dirs>` from
  `packages/fluxiq`.
- `node scripts/structure-audit.mjs` (Core).

No `node -e`, no git, no live or paid runs.

**Report.** `docs/working/page-diff-delivery-plan/reports/t1085.md` in the downstream worktree, ending with the
return contract.
