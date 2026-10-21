# t748-u5-office-baselines report

## Outcome

Done. All three points were assessed. C6 and the t738 gap are fixed in code. C5 has no sound generic rule, so only the words that offer refs changed. Every new test that covers a change fails on HEAD and passes now. The narrow validation set, the Core typecheck and the Core structure audit all pass.

## What changed and why

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ`. R = `packages/fluxiq/src/programs/automation-studio/runtime/`.

### C5: a baseline accepted on a list that can never show the act's effect

**Assessment: no sound generic rule exists.** Core knows, about a creation's candidate destination:
- where the list was read (its group, which is the page location);
- the act's `subject`, `page`, `scope` and `item`;
- whether the act's own page is the latest read;
- the original's subjects (opaque tokens).

From these, the office case cannot be told apart from real creations whose effect does show on a list. In the office case, a list of other items suggested on the subject's own page, the control sits in no list and the subject is absent from the list. The same holds in each counterexample below:

1. **A creation whose effect shows on its own page.** "Add a note" under a recipe joins the notes list on the recipe page. That list is on the act's own page, the control sits outside it, and the subject is absent, which is the same shape as the suggested-items list. This case is tested (`create-baselines.test.ts`, "still accepts a list on the creation's own page").
2. **A panel on the item's own page listing what the person has collected so far** (a small collection panel beside a detail page). The list is on the act's page, the control is outside it, the subject is absent, and its items are peers of the subject, exactly like a suggested-items list. A creation does join it. So a rule of the form "a list of the subject's peers on the subject's page" would refuse a real destination.
3. **A two-list chooser** (an "available" list and a "chosen" list on one page). Adding X joins the chosen list on the same page. If "available" also holds the chosen items, their subjects co-occur with X in another list, which defeats any rule based on subject co-occurrence.

Rules based on page, control placement, peer subjects or co-occurrence each refuse one of these. So Core keeps accepting any issued list that meets the existing conditions: same resource, valid group, subject absent.

**Words changed** (`R/flow-bootstrap/site-reset/words.ts`, `create-baselines.ts`):
- `createBaselineRequired(here, elsewhere)` now:
  - tells the model to name the list the new entry would join, and that a list on this page shows the creation only where the new entry would appear in that very list;
  - says a list that only suggests or relates other items to the one acted on never gains the new entry;
  - lists the refs already issued in two groups: "Lists read complete on this page" (the latest read's refs) and "Lists read complete elsewhere" (with their places), the latter followed by "retry naming its ref without reading it again".
- Before this change, the refusal named no ref. The only refs the model saw were the receipts printed beside it, which are the pressed page's own lists. That is exactly how destination-4 was offered.
- `create-baselines.ts` `check` splits the issued refs by the latest observation (`this.current`) and passes both groups.
- `witnessRequired` gains the same generic sentence for any press (`SHOWS`).

### C6: no next step after the baseline read

Change in `R/service/project-build/brief-ports.ts`, `placing`:
- It keeps the latest press refused `candidate.create_baseline_required` or `candidate.reset_witness_required`, with the refs printed beside that refusal.
- Until a later call lands an act (`ledger.actOf(callId)`), every answer that prints refs other than those carries `retryRefused: { call, refs, instruction }`. The instruction is `WORDS.retryRefused`: the refused call's id and the refs this read issued, then "go back to where it was refused and make that call again, the same as before, naming that list's ref as resetDestination; do not read the list again first". If none of them is where the effect would show, it says to read that list completely, then retry.
- The refusal's own answer and pages that print no list carry no note. Once the retried press lands, the note stops.
- The header gained a paragraph. `project-build/` already holds 25 source files, so this went inline, not into a new file.

### t738 gap: is there a press that has no witness and can run before the seal?

1. **Lone `create_new`: real, and closed.**
   - The creation precondition covers only an identified creation: one with a subject, or one with a page and no item.
   - An unidentified creation was exempted by `reset-witness.ts` as "a creation". Example: a control in an untitled item (`item` set, no `subject`) on a page with a heading (`page` set), or one with a `scope` that is not a recorded original.
   - The ledger still holds such an act strictly, because `strictReset` needs only subject, page or scope. So it landed with no possible witness.
   - Shown in a test: after the seal, the same press is admitted and becomes `nothing_to_name` unsettleable.
   - Fix: removed the `only === "create_new"` exemption. An identified creation never reaches `witnessMissing`, because `check` routes it to the creation precondition first. An unidentified one now answers `candidate.reset_witness_required` like any other strict reversible press.
   - Every witness the settlement recognises for such a press is still accepted:
     - an issued ref (`destination()` resolves it, since no subject check applies to an unidentified creation);
     - a control inside a complete original list.
   - A creation whose control names nothing (no subject, page or scope) keeps the legacy policy.
2. **Unscoped presses: not a witness gap.** They are not strict (`strictReset` is false). The legacy policy lets `cannotUndo` keep them, so such an act never stays on the site unsettleable. Not changed. One side effect is real, though: an unscoped lasting press seals the baselines (`ledger.ts` seals on any lasting act). See Open questions.
3. **Stated-state witness only for exactly `modify_existing` with a place: correct, not a gap.** It mirrors the ledger, which keeps `act.press` only under `onlyModifies` and only with a `place`. The toggle witness also needs `state`. Counting it for any other class would admit a press that has no toggle witness.

### Tests (generic fixtures: reading list, recipes, library; no realistic-site words)

- `site-reset/tests/reset-witness.test.ts`:
  - new describe "an unidentified creation before the seal (t748)", with 3 tests: refused with no witness, with the sealed counterexample; admitted with an issued ref or inside a complete list; legacy policy and the creation precondition unchanged.
  - one list entry updated: the "unidentified create admitted" case is now an unscoped creation.
- `site-reset/tests/create-baselines.test.ts`:
  - new describe "a creation's destination on its own page (t748)", with 2 tests: the own-page counterexample is still accepted; the refusal splits refs into this page and elsewhere and carries the caution words.
  - `unidentified` in the "preserves..." case is now unscoped.
- `site-reset/tests/words.test.ts`: new describe with 2 tests, covering the `retryRefused` words and the `createBaselineRequired` words with refs, both generic.
- `service/project-build/tests/project-build-brief-ports.test.ts`: new `it.each` over `create_new` and `modify_existing`, run through the real service. The sequence is: refused, read the loans list, note present, back to the book page, no note, retry with the ref (lands), read again (no note).

### Proposed doc text for `docs/architecture/automation-studio/llm-flow-bootstrap.md` (not written; docs are outside my ownership)

> **Which list a creation names, and the step after reading it (t748).** Core does not judge which issued list a creation's `resetDestination` names, beyond same resource, a valid group and the subject absent from the list. By everything Core reads, a list of other items suggested beside the subject has the same shape as a list a creation on its own page does join, such as replies under what a reply answers, or a collection panel beside an item. The `candidate.create_baseline_required` refusal therefore lists the refs already issued, split into those read on this page and those read elsewhere. It says to name the list the new entry would join, and that a list that only suggests or relates other items never gains it. While a press stands refused for want of a ref (`candidate.create_baseline_required`, `candidate.reset_witness_required`), each later answer that prints refs the refusal did not print carries `retryRefused`: the refused call, those refs, and words saying to make the call again naming the ref of the list where its effect shows. It stops once a call lands an act. Before the seal, an unidentified `create_new` (no subject, and in an item or on a page with no heading), which the ledger still holds strictly, needs a witness like any other reversible press. Only a creation whose control names nothing keeps the legacy policy.

## Commands run and observed results

All commands were run from `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ/packages/fluxiq` unless noted.

- **HEAD-failing proof.** I copied my four source files' HEAD versions from scratch (`.../scratchpad/t748/u5-orig/`) into place and ran `pnpm exec vitest run` on `reset-witness`, `create-baselines`, `words` and `project-build-brief-ports` tests. It printed "Tests 6 failed | 39 passed (45)". The 6 failures were exactly the change tests:
  - the C5 refusal split;
  - both words tests;
  - the unidentified creation refused;
  - C6 `create_new`;
  - C6 `modify_existing`.

  The guard tests (counterexample, admitted with a witness, legacy policy) passed on HEAD, as intended. I then restored my versions; `git diff --stat` showed all 4 files with my changes.
- **Narrow set.** `pnpm exec vitest run` over `R/flow-bootstrap/site-reset`, `R/flow-bootstrap/reset-answers`, `R/flow-bootstrap/reset-settlement`, `R/service/project-build`, `R/project-agents`, `R/llm/deepseek/tests/system-prompt.test.ts`, `R/flow-bootstrap/plan/tests/extraction-vocabulary.test.ts` and `R/flow-bootstrap/plan/tests/issue-feedback` printed "Test Files 126 passed (126), Tests 1027 passed (1027)". `issue-feedback.test.ts`, `issue-feedback-words.test.ts` and `issue-feedback-word-forms.test.ts` all ran.
- **Typecheck.** `pnpm exec tsc --noEmit -p tsconfig.json` exited 0 with 0 `error TS` lines.
- **Audit.** At the Core root, `node scripts/structure-audit.mjs` printed "structure-audit: passed (436 warning(s), 1152 baselined)". It also reported "1 baseline entries can be lowered"; that is not from my files, and I did not run `structure:baseline`.
- One intermediate failure, now fixed: my C5 test's forbidden-word regex matched the fixture location `loc:meal-plan`, so I renamed it to `loc:week`. Another: the C6 test first used `maxIterations: 8`, which put the builder into its last-decisions mode before the retry. I raised it to 20.

## Not verified

- No live run. Whether builders follow `retryRefused` and the new creation words, and stop naming a suggested-items list, is unproved.
- Downstream e2e specs were not run. `apps/extension/e2e/site-reset/tests/*` (office-buy-now, job-failed-save and others) could press an unidentified creation before any read; I did not check whether one does.
- Tests outside the narrow set that drive `createBaseline` with an unidentified scoped `create_new` before any read were not run. `action-permissions.test.ts` sits outside the set; it is not in the folders above and I did not run it.

## Open questions or contradictions found

1. **Seal by an unscoped press.** An unscoped reversible press (no subject, page or scope) lands under the legacy policy and is keepable, but it seals the baselines. If nothing was read before it, every later identified creation is refused `no_call`, and every later strict press is admitted and lands unsettleable. Closing this would mean refusing unscoped presses, a policy change to the legacy path. It would also touch `ledger.ts`, which another worker owns. I left it alone and am raising it for the supervisor.
2. **After the seal, a witnessless strict press is still admitted** ("nothing more is asked"). When `refsClosed()` is true, it lands as an act no call can settle. Refusing it would block the press forever. Admitting it ends the brief as blocked. Both outcomes end blocked, and the brief scoped me to before the seal.
3. `retryRefused` refs carry counts only, no places. `placing` holds only the brief's receipts, which carry no location, and the project ledger's `issuedRefs()` numbering is not guaranteed to match the brief ledger's refs.
4. The `project-build/` directory is at the 25-file limit, so the brief's "one new file allowed there" can only be a test file.
