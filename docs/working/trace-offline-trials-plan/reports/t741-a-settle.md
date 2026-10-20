# Report: t741-a-settle (A1, structural)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ`, branch `task/t741-rerun3-fixes`. No commits.

## Outcome

Partial. A1 is implemented and every Definition of Done test passes. One test file I do not own,
`service/project-build/tests/project-build-reset-settle.test.ts`, has two tests that assert the old
behaviour, and they now fail because of this change (details under Open questions). The lead needs
to update them, or let a-receipts update them, since that file belongs to them.

## What changed and why

Paths are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `flow-bootstrap/site-reset/ledger.ts`
  - `evaluate` now detects a trial act that has no witness of its own: `call` is absent (a trial
    step's act or an entry preparation's act), it has no toggle, and every group is `none` once its
    repeats' lent destinations are counted.
  - Such an act is also judged on the build's issued lists. These come from the new private
    `issuedDestinations()`, which maps `createBaselines.issuedRefs()` through `createBaselines.named()`.
    I did not edit `create-baselines.ts`.
  - The judging goes through the new private `groupsOf()`, which wraps the existing `actGroups` call.
  - Adopted groups never set `changeSeen`. That keeps a settled act `unchanged` rather than
    `restored`, so every later trial still lists it under `startedWith.cannotUndo`.
  - The adopted groups produce `look` reasons with locations. That means the existing `lookFirst`,
    Core's own pre-trial look, reads them with no model turn.
  - The header gained a paragraph, "A trial act with no witness adopts the build's issued lists
    (office r3)", recording the rule and the reason for it.
  - The file is now 775 lines, under the 800 budget. I added no new file, because `site-reset/`
    already holds 25 files, which is the directory budget.
- `flow-bootstrap/site-reset/settlement-decision.ts`
  - New optional input `adopted`. It is used only when the act has no group and no toggle witness
    of its own.
  - If every adopted group holds, the act settles: `unchanged`, or `restored` only when an undo
    landed.
  - If an adopted group is stale or incomplete, the act stays open with a `look` reason (ref and
    location).
  - If any adopted group differs, the act stays open with only `name`. It is never told "undo this
    act there".
  - With no adopted groups, it returns `name` as before. The header documents all of this.
- `entry-preparation.ts` and `landed-acts.ts` are unchanged. Entry-preparation acts already reach the
  brief's ledger through `trialRan` (`phase-start.ts:166`), so they are trial acts with `call` absent
  and the ledger rule covers them.
- New tests:
  - `site-reset/tests/settlement-adopted.test.ts` covers DoD 1, 3, 4 and 5, plus the stale-words case.
  - `site-reset/tests/project-ledger-entry-repeats.test.ts` covers DoD 2: brief-1's trial act plus
    the entry acts of three more briefs. The supervisor's project reset reads `loc:box` once, all
    four acts settle `unchanged`, the judged trial is admitted with all four under `cannotUndo`, and
    they stay there after the next trial with no further look.
- Updated tests (files I own) that pinned the old "trial act asks to name its list" behaviour. Each
  keeps its intent by making one adopted list differ:
  - `settlement-shapes.test.ts`, shape E second test. The named list holds while another list still
    differs, and the act settles on it.
  - `project-ledger-repeats.test.ts`, the multi-subflow test. After Core's look, B's act inherits the
    list named for A's press. The second ask needs no look, because the read is still fresh.
  - `project-ledger-repeats.test.ts`, the "matching nothing" test. The act stays open asking to name
    a list, never to undo there, and Core's look happened.

## Commands run and observed results

All commands ran from `.../!FluxIQ/packages/fluxiq`.

1. Tests first: `pnpm exec vitest run .../site-reset/tests/settlement-adopted.test.ts .../site-reset/tests/project-ledger-entry-repeats.test.ts`
   - Before the fix: `Tests 4 failed | 2 passed (6)`.
   - The 4 failures are the new-behaviour cases. One example received: "Nothing read shows where its
     effect would be: ... name that list's ref", where "Read destination-1 at loc:box completely
     again." was expected.
   - The 2 passes are the regression guards (no issued ref, explored acts).
2. `pnpm exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/site-reset/tests/` (final run):
   `Test Files 19 passed (19)`, `Tests 265 passed (265)`.
   - An earlier run showed 3 failures in `words.test.ts` and `undoes-tool.test.ts`. Those files belong
     to a-receipts and were mid-edit; they pass in the final run.
3. `pnpm exec vitest run` on `service/project-build/tests/project-build-entry-preparation.test.ts`,
   `project-build-reset-settle.test.ts`, `project-build-reset.test.ts`,
   `project-build-trial-reset.test.ts` and `service/candidate-trial/tests/landed-acts.test.ts`:
   `Tests 2 failed | 32 passed (34)`.
   - entry-preparation: 6 passed. trial-reset: 1 passed. reset: 10 passed. landed-acts: 14 passed.
   - reset-settle: the 2 failures described below.
4. Cause check: I disabled adoption for one run (`witnessless = false && ...`), then reverted it.
   - With adoption off, the 2 reset-settle "settle first" tests pass.
   - With it on, they fail. That proves my change causes the failure.
   - The other 3 reset-settle tests (a-receipts' new describe) failed either way at that moment
     because of their own work in progress.
5. Neighbouring tests that use issued refs: `pnpm exec vitest run` on `flow-bootstrap/tests/action-permissions.test.ts`,
   `llm/repeat-guard/tests/reset-precondition.test.ts`, `project-agents/dispatch/tests/brief-loops.test.ts`,
   `project-agents/dispatch/tests/reset-done.test.ts`, `service/project-build/tests/project-build-acts-record.test.ts`
   and `service/project-build/tests/reset-calls.test.ts`: `Test Files 6 passed (6)`, `Tests 54 passed (54)`.

## Not verified

- No typecheck, structure audit or wider vitest run. The lead runs those. I watched for the
  statement-packing rule and the 800-line and 25-file budgets by hand.
- No installed-gateway or live reproduction of office act-12/15/18. That is the e2e-reset worker's
  job in wave 3.
- I did not prove that the office site's issued lists would all hold at the pre-trial look. If one
  differs because of another act, the trial act stays open with today's `name` words, as designed.

## Open questions or contradictions found

1. **Another worker's tests move: `service/project-build/tests/project-build-reset-settle.test.ts`**
   (not in my Owns list; a-receipts has edited it). In its fixture, act-3 is a trial act
   (`keep.trialRan(... spot: { subject: "s:extra" })`) with no witness, and `destination-1` is issued.
   - "look at the stale list once themselves ..." expects `remainingActs` to be `["act-2", "act-3"]`.
     It is now `["act-2"]`, because Core's look settles act-3 `unchanged`. That is DoD 1 working
     through the brief ports.
     - Suggested fix: expect `["act-2"]` and add `expect(run.keep.standing("act-3")).toBe("unchanged")`.
   - "tell the reset only the acts still open ..." reads `run.keep.inPlace().find(act-3)!.settle!`,
     but act-3 is no longer open.
     - Suggested fix: keep a trial act open by making the list differ at the reset's look. For
       example, give the list a second scope in the same group whose read at reset shows an extra
       row: act-3 then stays open with its `name` words while act-1's own list holds. Or drop the
       act-3 lines.
2. **A design note for the lead.** An adopted list that differs and later holds again settles the
   trial act `unchanged`, not `restored`, because adopted lists never count as a change seen of its
   own. This is deliberate and conservative: the judge is still told the act was left.
