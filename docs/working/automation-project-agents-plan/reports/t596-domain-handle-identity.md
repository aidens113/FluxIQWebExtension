# t596 domain-handle-identity: worker report

## Outcome

Done. A handle whose control changed between views (for example, its words and one class changed because an earlier
brief pressed it) now stays identifiable. When the views' agreement names the control fewer ways than the thinner
view did, the newest view (the one the builder was shown) fills the gap. The two-signal floor is unchanged, and a
control that every view describes thinly is still refused `web.handle.unidentifiable`.

## What changed and why

- `domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`: `webPlanElementIdentityAcrossViews` still
  computes the agreement first, as `agreedAcrossViews` (the old body, unchanged). It then counts signals with
  `element-fingerprint`'s `webElementIdentitySignals`, so the merge uses the same measure as the save-time guard. If
  the agreement has fewer signals than `min(signals(earlier), signals(newer))`, the newer view lends its fields one
  group at a time, stopping as soon as that count is met:
  1. stable facts: implicitRole, inputType, label, id, testId, name;
  2. words: accessibleName, visibleText;
  3. class tokens.

  Fields both views agree on are always kept. Context and attributes stay as agreed, since they count as no signal.
  In the A8 case the merge gives `{div, "Collected", class b}`, which is 3 signals instead of 1. The class `x` that the
  act toggled is still dropped. The doc comment records the A8 case and the rule.
- `signals.ts` and `resolve-plan-node.ts`: not changed. The guard and the floor are as they were.
- Tests, all in `plan-resolution/tests/`:
  - New tests were appended to `acted-identity.test.ts` with a t596 section header. They are not in their own file
    because a 26th file in `tests/` fails the structure audit's 25-file `directory-files` limit. They cover:
    - a unit merge where the views differ in words and one class, giving 3 signals and dropping the toggled class;
    - the agreement still winning when it names the control as well as the thinner view (the toggled class is still
      dropped);
    - stable facts being lent before words;
    - the A8 brief-2 case rebuilt through `resolveWebPlanNodeParameters` with `view_history`: it resolves, has at
      least 2 signals and reads "Collected";
    - a truly thin control (`div` + one class in every view, and `div` + `b`, then `b x`) still refused with
      `["web.handle.unidentifiable", "web.handle.unidentifiable:target"]`.
  - Assertions that encoded the old "a disputed label is always dropped" behaviour were updated to the new behaviour:
    - `target-packets.test.ts`: the t356 relabel test, the cut-short look test, the exploring half of the t442 test,
      and the untouched SPEC handle;
    - `view-history.test.ts`: the coupon that left the page;
    - `acted-identity.test.ts`: the exploring half;
    - `identity-stable-facts.test.ts`: the label-change test, plus the "box left with its tag and one class is
      refused" test. That test documented "the cost of the F5 floor", which is exactly the case this brief removes,
      so it now asserts the box is saved with the newest label.

## Commands run and observed results

- `node scripts/test-domain.mjs src/runtime/llm-evidence/plan-resolution` (from `domain/`). Before the test updates:
  209 pass, 8 fail, all of them the old-semantics assertions listed above. Final run: `# tests 222 # pass 222 # fail 0`.
- `node scripts/test-domain.mjs src/runtime/llm-evidence` (from `domain/`, recursive, includes node-run). Run after
  the source change and before the test-file edits: `# tests 1105 # pass 1105 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit`: exit 0. `npx tsc -p tsconfig.test.json --noEmit`: exit 0.
- `pnpm structure:check` (repo root). The first run failed with a `directory-files` error: 26 files in
  `plan-resolution/tests/`. After folding the new tests into `acted-identity.test.ts`:
  `structure-audit: passed (194 warning(s), 639 baselined)`, exit 0.

## Not verified

- Live browser behaviour was not tested; no live or provider run was made. One open question is how the page's finder
  and veto (`apps/extension/src/content/identity/score.ts`, `veto.ts`) score a saved `{div, "Collected", class b}`
  against a reset page that reads "Get coupons". The class and tag still agree but the words differ. This only matters
  if a trial's start state differs from the view the builder was shown.
- The whole `domain` suite was not run, under the twice-a-day rule. Only `src/runtime/llm-evidence` was run, and that
  was before the final test-only edits.

## Open questions or contradictions found

- I read "never merge to fewer signals than any single view had" as never fewer than the thinner view
  (`min`). Requiring at least the richer view's count is sometimes impossible, because the newer view may lack
  fields the earlier one had.
- Behaviour change: exploration's own identity for a re-viewed handle now carries the newest words wherever the
  agreement alone would thin it. That matches the page as it is now, so the veto concern in t356 does not arise there.
  But t356 C1's protection (a label the act changed is never adopted) now rests entirely on `acted` (t442 F1) for acts
  made by the Flow's own exploration. A label that changed without any recorded act is now the newest view's label
  instead of being dropped.
- `target-packets.ts` (not owned) still says in its header "a label the act changed is dropped, never adopted" (lines
  68-77) and "a handle nothing acted on keeps the agreed identity everywhere" (lines 92-93). These are now only
  partly true and should cite t596. I did not edit it, because I do not own it.
- The plan-resolution `tests/` directory is now at its 25-file limit, so the next new test file there needs a
  regrouping.
