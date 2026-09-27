# t169 — Only a delete and money are asked about

## Outcome

Done. `npx vitest run src/programs/automation-studio/runtime/action-permissions` reaches **0
failures: 5 files passed, 60 tests passed** (was 4 files failed / 12 tests failed / 44 passed of 56).

The 12 failures were not the whole of it. Ten further tests outside that directory asserted the same
removed gate — 4 in `runtime/recovery/annotation/tests/`, 2 in `runtime/recovery/tests/`, 6 in
`runtime/tests/service-bootstrap/tests/` — and all now pass. Beyond that, **eight rows were still
passing while no longer testing anything**: they granted or instructed `modify_existing` and then
asserted the action proceeded, which is now true whatever the grant says. Those were repaired too,
because a row like that is a worse defect than a red one.

**No finding of over-removal.** Every assertion about `delete` or `move_money` passed unchanged,
including the ones this change might have been expected to break: `CHECK_OUT` still stops a run with
`missing: ["move_money"]`, a repair declaring `delete` is still held, and `automationStudioAction
PermissionDenied` still refuses both classes where there is no run behind it. Nothing had to be
weakened to make the suite green, and no assertion was left failing.

## What changed and why

### The 12, by category

| Category | Count | What was done |
| --- | --- | --- |
| Asserting the removed gate | 2 | Updated to assert the action proceeds |
| A genuinely risky gate that still stands | 0 | Nothing to report — none failed |
| Incidentally using `modify_existing` as a gated example | 10 | Rewritten onto `delete` or `move_money` |

The third category dominated, as the brief predicted. In every case the row's real subject was
something else — the authority a recovery gate reads, the lapsing of an instruction, whether a name
may be carried, whether a later patch is attempted — and `modify_existing` was only the class it
happened to press with.

### `action-permissions/tests/destructive.test.ts`

- **The derived exports are now asserted against their new contents** (brief item 3).
  `AUTOMATION_STUDIO_DESTRUCTIVE_ACTION_CONSEQUENCES` is asserted to equal `["move_money", "delete"]`,
  the predicate's complement to equal `["send_or_publish", "modify_existing", "create_new"]`, and
  `isAutomationStudioDestructiveActionConsequence("modify_existing")` to be `false`. The next change
  to `DESTROYS` fails a test rather than surfacing on a live run. The old assertion was wrong because
  it named a three-class list that the rule reduced to two.
- The ordering/dedup row kept its subject and moved onto `delete`, with `modify_existing` added to
  the "drops what takes nothing away" side, so the new rule is asserted from both directions.
- "asks only about the destructive part" needed an action that mixes a gated class with an ungated
  one, so a new `EMPTY_BASKET` fixture declares `["delete", "modify_existing"]`: the request carries
  both, and asks about `delete` alone.
- `SAVE_ADDRESS` (`modify_existing` + `create_new`) moved into a new describe, **an edit the gate no
  longer stops**, which asserts that it proceeds, that it is still recorded with the class it
  declared, and that `automationStudioActionDeclarationCrossCheck` names it as `beyond_instruction`.
  That last row is the evidence for the claim in `destructive.ts` — the cross-check, not a standing
  gate, is what now catches an irreversible overwrite the instruction did not ask for. `BASKET`'s
  body says "leave my saved address alone", so this is exactly that case.

### `action-permissions/tests/gate.test.ts`

- `REFUND` declares money and an edit, so the request now carries two classes and asks about one.
  That is a sharper test than before and was kept, with the file's stated property corrected: an
  absent grant never permits *a consequence that cannot be taken back*.
- The two-phrase sentence ("… move money **and** …") was carried only by the class that stopped
  being gated. A new row keeps that coverage with `["delete", "move_money"]`.
- **A vacuous row repaired.** "asks for exactly what the grant lacks, never what it already holds"
  granted `modify_existing` and asserted `missing: ["move_money"]` — true now with no grant at all.
  It declares three classes and grants `delete`, so each of the three is left out of the request for
  a different reason and only `move_money` remains.

### `action-permissions/tests/declared.test.ts` and `instructed.test.ts`

`OVERWRITE` (`delete` + `modify_existing`) still refuses on `delete`; three rows had `missing`
narrowed while `consequences` kept both classes. In `instructed.test.ts`, "asks for what the
instruction did not ask for" needed a class beyond the instruction that is still gated, so a
`REFUND_AND_REMOVE` fixture declares `["move_money", "delete"]` against an instruction that asks only
for the refund.

### `runtime/recovery/`

- `annotation/tests/permissions.test.ts` used `modify_existing` as its one example throughout; five
  of its seven rows would have passed vacuously. The example class is now `delete` and the dispatch
  instruction reads "…and remove any line the warehouse cannot fill", so the stored quote is still
  grounded in the person's own words.
- `annotation/tests/recovery-permissions.test.ts`: the stand-in domain's press now declares `delete`
  on a "Cancel unfilled lines" control, added to the failure evidence beside "Pick and pack" so the
  patch-stage rows that carry that name are untouched.
- `annotation/tests/patches.test.ts`: the request row moved to `["delete", "move_money"]`, keeping the
  only assertion of a joined two-class sentence in the *recovery* phrasing. The grant row now grants
  `delete` against a patch declaring `["delete", "modify_existing"]`, proving both that the grant
  authorises the delete and that the edit beside it needs no grant.
- `tests/runtime-exploration-permission.test.ts`: the press declares `["move_money", "delete"]` on a
  renamed "Refund and void line 1" control, which keeps the partial-grant row meaningful — it grants
  `delete` and is still asked about the money.

### `runtime/tests/service-bootstrap/tests/`

- `permission-ask.test.ts`: a second constant, `ASKED_ABOUT`, separates what the press declares from
  what a person is asked about; the two ask assertions use it.
- `permission.test.ts`: four `missing` lists narrowed to `["move_money"]`. "still asks for a
  consequence the instruction did not ask for" was inverted rather than dropped — the instruction now
  claims the *edit* and says nothing about the money, so the money is what is still asked for, which
  is the same property the row was written for. "still asks for what the grant does not cover" could
  not be made non-vacuous without a second gated class in a fixture another worker's area drives, so
  it was renamed to what it now truly proves: a grant naming a class nobody is asked about neither
  widens nor narrows the request. The property it used to hold is now proved on the gate itself in
  `gate.test.ts`.

### `destructive.ts` (comment only)

The file's opening comment still said "Three classes are destructive" and listed `modify_existing`
among them, contradicting the record below it. Corrected to two, with one sentence on why the third
left and a pointer to the record. **No value changed**: the only code line in the whole diff is the
supervisor's own `modify_existing: true` → `false`.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/action-permissions` →
  **5 files passed, 60 tests passed (60)**, 0 failures. Before the work: 4 failed / 1 passed files,
  12 failed / 44 passed tests (56). The count rose to 60 because four rows were added (three in the
  new "an edit the gate no longer stops" describe, one for the joined sentence).
- `npx vitest run src/programs/automation-studio/runtime/tests src/programs/automation-studio/runtime/recovery`
  → **8 files failed | 98 passed (106); 15 tests failed | 921 passed (936)**. Every recovery suite
  passed, including the four files I changed. All 15 failures are attributed away from this change
  below.
- `npx tsc --noEmit` → exit 0, no output.
- `node scripts/structure-audit.mjs` → **exit 1, 1 violation**:
  `runtime/llm/tests/: 26 source files exceeds the 25-file limit`. That is another worker's
  directory; this task created no files at all, so the violation is not from here. Advisory warnings
  on files I touched (`patches.test.ts` at 542 lines, `recovery/tests/` at 17 files) all pre-exist —
  no line was added to either. **`pnpm structure:baseline` was not run.**
  Note: the brief's path `packages/fluxiq/scripts/structure-audit.mjs` does not exist; the script
  lives at `F:\!FluxIQ\scripts\structure-audit.mjs` and was run from the repository root.

### The 15 failures in the broad run, attributed

| Suite | Failures | Attribution |
| --- | --- | --- |
| `service-bootstrap/tests/generation.test.ts` | 6 | **Another worker, in flight.** Fails when run alone too, raising `flow_bootstrap.internal_error` from `flow-bootstrap/generation-failure/phase-failure.ts:36` — an **untracked** file in a directory git shows mid-split (`generation-failure.ts` deleted, its test moved into `generation-failure/tests/`). A permission narrowing cannot produce `internal_error`. |
| `service-flows/tests/representation.test.ts` | 2 | **Another worker, in flight.** Fails alone: "seeds a rerun from the failed attempt… expected undefined". Rerun/run-input seeding, with six `runtime/executor/*` files modified in the working tree. The file asserts no consequence class anywhere. |
| `service-flows/tests/instruction-readiness.test.ts` | 1 | **Load.** 15 005 ms timeout in the parallel run; **passes alone in 6 007 ms**. |
| `service-recordings/tests/proposals.test.ts` | 1 | **Load.** **Passes alone** (5 145 ms for the row that failed). |
| `service-flows/tests/canonical-persistence.test.ts` | 1 | **Load.** **Passes alone.** |
| `service-bootstrap/tests/adaptation.test.ts` | 1 | **Load.** **Passes alone.** |
| `service-flows/tests/scale-pages.test.ts` | 2 | Scale/directory-budget suite, 52 936 ms under load. Not re-run alone — see Not verified. |
| `runtime/tests/deepseek-bootstrap-exploration.test.ts` | 1 | "asks again after a decision that runs past its deadline", in a 157 494 ms file. Deadline-sensitive under load. Not re-run alone — see Not verified. |

## Not verified

- `scale-pages.test.ts` (2) and `deepseek-bootstrap-exploration.test.ts` (1) were **not** re-run in
  isolation, so their attribution to load rests on their runtimes (53 s and 157 s) and on the two
  suites that did prove load-sensitive, not on a clean single-file run.
- No live browser or live-provider run. Nothing here exercises a real gate answer from a person.
- `pnpm check`, `pnpm test` and `pnpm build` were not run — outside the brief, and the tree holds
  several workers' in-flight edits.
- I did not verify that the `runtime/llm/tests/` structure violation pre-dates this batch, only that
  this task created no files and so cannot have caused it.

## Open questions or contradictions found

1. **`cross-check.ts` now carries an untrue comment, and I did not touch it** (not mine per the
   brief). Its header says, of a class declared that the instruction does not ask for: *"A class
   declared that the instruction does not ask for is already handled — the gate refuses it and raises
   a request, and a person answers. The direction nothing else catches is the other one."* Since
   2026-09-26 that is false for `modify_existing`: the gate does **not** refuse it, and the
   cross-check is now the *only* thing that catches an unasked-for edit. The file therefore
   understates its own job, in the exact case `destructive.ts` says it covers. Worth one paragraph
   from whoever owns that file next. (The behaviour is correct and now has a test:
   `destructive.test.ts` → "is named by the cross-check against the instruction".)
2. **`api/handlers/tests/llm-permission.test.ts` passes and was deliberately left alone.** It carries
   `permittedConsequences: ["modify_existing"]` through the handler; the row tests plumbing, not
   gating, and would pass with any class. Nothing was lost, but if anyone reads it as a permission
   test, it is not one.
3. **Two `runtime/llm/` suites mention `modify_existing` and both pass unchanged** —
   `harness/tests/policy-gates.test.ts` and `tests/execution-grant/tests/execution-grant-permissions.test.ts`.
   They were run and observed green, and not edited because a worker is active in that directory.
4. `action-permissions/client/tests/index.test.ts` asserts the person-facing phrase for
   `modify_existing`. Still correct — the class exists and has a phrase; only its gating changed.
