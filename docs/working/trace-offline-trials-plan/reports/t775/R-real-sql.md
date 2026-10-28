# t775-R: the real-SQL project-build tests phase D left red

Tree `fxwork/t775/!FluxIQ`, branch `task/t775-minimal-reset-judging`. T = `packages/fluxiq/src/programs/automation-studio/runtime/service/project-build/tests`. Nothing committed; no mutating git; no model calls.

## Outcome

**Done.** All 11 named failures follow from t775's intended change. None is a regression, so no product file changed.

- My first run reproduced 10 of the 11.
- The DeepSeek pre-send test passed in all 8 runs here (details below).
- The three files now pass on the real-SQL group: 19 of 19.

## What changed and why (one line per test)

**`project-build-brief-ports.test.ts`**

1. **"requires a pre-create baseline ..." (intended).** The exploration-door `create_baseline_required` is retired (`reset-admission/admission.ts`), and so is `trial_reset_required`.
   - Renamed: "tests with the build's create still on the site, said under startedWith, and the build's own undo removes exactly that row".
   - The new flow: read the destination (which issues a ref), create with that ref, test (runs; `startedWith.acts` = that act), then undo naming the act, then test again (yes, no `startedWith`).
   - Not weaker: it still asserts creates 1, removals 1, rows back to `["s:baseline"]`, and that the domain never sees `resetDestination`. It adds that the dirty trial lists exactly that one act.
2. **"a press refused for want of a ref ... (create_new)" (intended).** The exploration door now admits a press with no witness.
   - `retryRefused` in `brief-ports.ts` keys on `create_baseline_required` and `reset_witness_required` answers to `core.run_node`. Only the step door can still produce those codes, so `retryRefused` is now unreachable.
   - Renamed: "a press with no list read before it > runs at once, and a later complete read issues its ref naming no refused call".
   - It asserts the press answers exactly `{ok:true}` and the loan lands, the read still issues `destination-1`, and no answer carries `retryRefused`.
3. **"... (modify_existing)" (intended).** Same as 2, for `reset_witness_required`.

**`project-build-reset.test.ts`**

4. **"refuses the whole trial until a reset brief undoes ..." (intended).** The first whole trial now runs.
   - Renamed: "runs the whole trial with the builder's acts still on the site, said under startedWith, and a reset brief then undoes exactly the build's acts".
   - It asserts:
     - test 1 is `ok`/yes, with `startedWith.acts` = exactly act-1 and act-2;
     - the reset is done, with `lastingActsInPlace` 0;
     - the exact press order (adds the first trial's no-op save);
     - the box ends `[lentil-soup, rye-loaf]`, so the pre-existing recipe was never touched;
     - the judge saw the box with the acts on it, then without them;
     - test 2 has no `startedWith`;
     - the build record is unchanged.
5. **"undoes a cart line ..." (intended).** Renamed: "runs the whole trial with a builder's cart line on the site, then a reset undoes exactly that line and keeps the line that was there before".
   - It asserts:
     - test 1 has `startedWith` {acts [act-2], cannotUndo [act-1]};
     - the undo removes only herb-tea, and the cart ends `[dish-soap]`;
     - the first trial was judged with the line, the second without it;
     - the record gains act-4, the second whole trial's add.
   - The reset-task wording assertions are kept.
6. **"assembles a Flow that loads the start location first ..." (intended; not a regression).** `phaseStart` was present. The `toMatchObject` array failed because `stillOnSite` now also lists act-3, the first whole trial's own add, which exists because that trial ran.
   - It now asserts exactly [act-2, act-3], and that the only undo was the builder's line (cart `[dish-soap]`).
7. **"a reset brief > offers undoes and no write ..." (intended).** `lastingActsInPlace` is 1 -> 2, because act-3 exists.
   - It now asserts the blocked reason names exactly act-2 and act-3 to undo, with act-4 (the reset's own add) said apart, and the cart unchanged.
   - Test 2 is refused `candidate.trial_step_unwitnessed`, by no reset gate. The reset's extra add left the cart listing `line:herb-tea` twice. A collection with duplicate subjects is invalid (`reset-settlement/collection-groups.ts`), so `destination-1` no longer resolves as a witness. That rule predates t775.
8. **"refuses an undo of an original item ..." (intended).** Renamed with ", and the next whole trial runs with it said".
   - The refusal assertions are kept unchanged: `candidate.undo_unproved` on act-2, its words, no `outsideBrief`, and the dish soap never touched.
   - It now asserts `lastingActsInPlace` 2, and that test 2 runs with `startedWith` [act-2 still there as "line herb-tea", act-3], cannotUndo [act-1], never naming dish-soap.
9. **"a reset brief's requests through DeepSeek's own pre-send checks" (not reproduced; no change).**
   - It passed in my first full run, in 5 isolated reruns, in the directory-wide run and in both final runs.
   - The reset completion schema has one source (`project-agents/dispatch/reset-completion.ts`), and the two trial gates' `cannotUndo` descriptions are identical.
   - The supervisor's failing run most likely caught the tree while D1/D3 were rewording one copy. That is the F3 shape this test guards.
10. **"whole-trial collection authority comes from original builder routing ..." (intended; not a regression).** Only the first `beforeTrial` assertion was the retired acts-in-place refusal.
    - It now asserts `admit`, with `startedWith.acts` containing the act.
    - Every authority assertion that follows was untouched and passes for all four kinds: original, late, other-resource and malformed. These are the in-place or unsatisfiable check and the deletion and inverse admit/refuse checks.

**`project-build-trial-reset.test.ts`**

11. **"undoes every act of the build, across builders, before each trial ..." (intended).** Retitled: "runs each trial on the site as it stands, with the build's acts said; undoes the build asks for remove exactly its own acts, across builders; and each run starts on the loaded start page".
    - The scripts are redone:
      - Builder "first" explores with honey and tests with it on the site. Test 1 has `startedWith` [act-1, `stillThere` "line honey"] and `leftOnSite` [act-1, act-2].
      - The supervisor's reset removes exactly honey, the trial's oat milk and rye, before the entry runs.
      - Builder "second" explores with butter, then undoes its entry's oat milk (act-4, the cross-ledger route) and its butter (act-5, settled). It tests clean, with no `startedWith`.
    - Explored products differ from the scripted ones, so no list shows a line twice.
    - Kept:
      - every run's first act loads START;
      - the second trial `ranOn` PRODUCT;
      - the entry runs after the first trial;
      - the domain never sees `undoes`;
      - dish soap is never touched.
    - Changed: the final cart is `[dish-soap, oat-milk, jam]`, said as `leftOnSite` [act-6, act-7], because Core no longer runs a cleanup reset before an ending (D1).

**Headers.** The header comments of `project-build-reset.test.ts` and `project-build-trial-reset.test.ts` are rewritten to the t775 rule.

**Line limit.** `project-build-reset.test.ts` is held at 800 lines, the audit limit. Two other ways out failed:
- Splitting the authority test into its own file put the directory at 26 files, past the 25-file limit.
- So the split was undone and comments were tightened instead.
- The `toHaveLength` checks that duplicated `toMatchObject`'s strict arrays were removed.

## Commands run and observed results

All runs are from `packages/fluxiq` unless noted.

- **Baseline:** `pnpm test T/project-build-brief-ports.test.ts T/project-build-reset.test.ts T/project-build-trial-reset.test.ts`
  - Printed "Tests 10 failed | 9 passed (19)" and "[vitest-groups] failed: real-sql".
  - The DeepSeek test passed.
- **Final, same command:** printed "Test Files 3 passed (3)", "Tests 19 passed (19)" and "[vitest-groups] all groups passed: parallel, real-sql".
- **DeepSeek test, 5 isolated runs:** `npx vitest run T/project-build-reset.test.ts -t "DeepSeek"` printed "Tests 2 passed | 8 skipped (10)" each time.
- **Whole directory:** `pnpm test src/programs/automation-studio/runtime/service/project-build`
  - Parallel group: "Test Files 20 passed (20)", "Tests 120 passed (120)".
  - Real-SQL group: "Test Files 7 passed (7)", "Tests 35 passed (35)".
  - Printed "all groups passed: parallel, real-sql".
- **`pnpm structure:check` (Core root).**
  - First run: "FAIL [file-lines] ... project-build-reset.test.ts: 825 lines exceeds the 800-line limit".
  - After the split: "FAIL [directory-files] ... 26 source files exceeds the 25-file limit".
  - Final: "structure-audit: passed (448 warning(s), 1152 baselined)."
- **`pnpm check` (Core root).** Exit 0, with 0 `error TS` lines. `fluxiq:check` was rebuilt ("inputs changed: packages/fluxiq").

## Not verified

- No headed or live run.
- I did not reproduce the DeepSeek failure, so its cause is inferred, not shown.
- The parallel-group tests of product directories were not run, because no product directory changed.

## Open questions or contradictions found

1. **Dead code in `brief-ports.ts`.** `retryRefused` and `WANTS_REF` can no longer fire: only the step door refuses those codes, and it is never reached through `core.run_node`. The header text at lines ~172-180 still describes the old behaviour. This is a cleanup candidate, and the file is not mine.
2. **Whole-trial acts that change nothing stay listed.** A whole trial's own act that changed nothing (act-3 on the cart site) is listed as still on the site, and as "still to undo" by a blocked reset, until a fresh read settles it. With no start location, the whole run gets no readings (D5), so its no-op add cannot be told apart from the builder's line with the same subject. The behaviour is honest but noisy.
3. **Duplicate rows void a list as a witness.** A list that shows the same row twice (two identical adds) voids its witness for every later trial step. This is real on sites where adding the same product twice shows two rows. It is pre-existing, but fewer resets make it likelier.
