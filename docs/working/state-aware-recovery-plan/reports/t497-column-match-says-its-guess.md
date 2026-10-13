# t497 column-match-says-its-guess: worker report

## Outcome

Partial. The refusal half of the brief is done and tested. A name whose nearest column is a sibling of the column it
means is now refused, not guessed. This covers a `where` condition, a record output column and a `fields` entry,
because all three go through the one matcher. Two pieces are not done, and each needs a file I do not own:

1. The condition refusal's `{code, field, valid}` issue now rides on the slot's refused answer. It stops one hop
   short of Core. `resolve-plan-node.ts:566` drops it. The fix is one line, in a file outside my ownership:
   `refusals.push({ code: slot.issue, kind: "extraction", path: [key, ...slot.path], fits: slot.expected, issues: slot.issues });`
   (the `Refusal` type there already has `issues?`, and `refusal()` already forwards them to Core at line ~796).
   Until that line lands, the D1 condition is refused at `extractList.where.0.field` with code
   `web.handle.unknown_field`, but without the list of valid columns.
2. **Accept and say so** needs Core, so I stopped there, as the brief says. Core accepts a resolved answer with
   exactly `status` and `parameters`. See `!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/plan-parameter-resolution.ts`
   (`exactKeys`, around line 351): an extra `assumed` member would refuse every node. The submit answer is built in
   `.../runtime/flow-bootstrap/candidate/authoring-loop.ts` and typed in
   `.../flow-bootstrap/authoring-result/contracts.ts`. Core already carries a parameter-name assumption the same way
   (`flow-bootstrap/plan/name-correction-assumption.ts`), and a column assumption would be a second `kind` there.
   Spelling-level guesses that are still accepted are recorded in the resolver's `assumed` list, as before. The
   submit answer still does not show them.

## The rule

A guess is a swapped part, and is refused, when all three of these hold:

- Both names are folded by Core and split into tokens. Each token is paired one-to-one with a token of the other
  name, best pair first, by Core's `automationStudioNameTokenCredit` (an equal token, a near token, or a synonym).
- At least one token pairs, so the two names belong to one family.
- The written name keeps at least one unpaired token, and the column also keeps at least one unpaired token.

Two exemptions keep every guess that is a slip:

- Two names within Core's whole-name typo distance are never a swap: one edit up to 4 characters, two edits from 5.
- A name that shares no token with its column is never a swap. That is a guess on the whole name, as before.

A name written short, a name written long, a misspelt token and a synonym all stay accepted guesses. A refused
guess does not fall back to the by-meaning column, because the name did name a family of columns.

The rule reads names only. It is not a score threshold, because a score cannot separate these cases. Core scores
D1's pair (rev 5's key against the Confirm column of `extraction.4`) at 0.702, which is above many legitimate
guesses. I checked that against Core's live `automationStudioMatchName` with the real keys from step 0020. The pair
shares 5 tokens, and each side keeps 2 unpaired tokens, so the rule refuses it.

## What changed and why

- `domain/src/output-nodes/extract-list/swapped-name.ts` (new): `webExtractionNameSwapsPart`, the rule above,
  built only from Core's exported normaliser, token credit and edit distance.
- `domain/src/output-nodes/extract-list/column-match.ts`: every return of a Core pick goes through `unswapped`,
  which returns `undefined` for a `nearest` pick that swaps a part. There is a header section saying so. Submit
  and dispatch both read this function, so they still agree.
- `domain/src/output-nodes/extract-list/index.ts`: exports the new module.
- `domain/src/runtime/llm-evidence/plan-resolution/extraction/refusal-issues.ts` (new): `WebPlanRefusalIssue`
  and `webPlanBoundedIssues`, moved out of `stored-columns.ts` so that conditions can use the same Core bounds.
  `valid` is now also de-duplicated.
- `extraction/stored-columns.ts`: uses that module. No behaviour change.
- `extraction/conditions.ts`: a column that neither vocabulary knows now refuses with
  `issues: [{code: "web.handle.unknown_field", field: <written>, valid: [...kept keys, ...detected keys]}]`,
  bounded. The header was updated: it used to say the name is never spelled back.
- `extraction/slot.ts`: the refused variant has an optional `issues`, set from the conditions refusal.
- `extraction/index.ts`: exports `WebPlanRefusalIssue` from its new home.
- Tests (all with generic names):
  - New: `output-nodes/extract-list/tests/swapped-name.test.ts`. It covers the predicate cases, the matcher
    refusing a key from another detection, and submit and dispatch agreeing on a sibling record-output column.
  - New: `plan-resolution/extraction/tests/swapped-condition.test.ts`. It covers condition and slot refusals that
    carry the issue, and a short name that is still a guess.
  - Changed: `tests/column-match.test.ts`. The `banana` condition refusal now expects the issue.

## Commands run and observed results

- Fail-first: `DOMAIN_TEST_BUILD_LABEL=t497 node scripts/test-domain.mjs output-nodes/extract-list/tests/swapped-name runtime/llm-evidence/plan-resolution/extraction/tests/swapped-condition`
  printed `# pass 1 # fail 5`. The matcher returned `{how: 'nearest', key: 'div_xk2p9q7_xm4r8t1_div_xa7s5d3_xf9g1h4'}`,
  which is the D1 mechanism. The one pass was the bare predicate test.
- Baseline before the change, over extract-list and extraction tests: `# tests 114 # pass 114`.
- After the change: `DOMAIN_TEST_BUILD_LABEL=t497 node scripts/test-domain.mjs output-nodes runtime/llm-evidence`
  printed `# tests 1251 # pass 1251 # fail 0`. That includes t489's pinned cases in both `stored-columns.test.ts`
  files.
- `npx tsc -p tsconfig.json --noEmit` exited 0. `npx tsc -p tsconfig.test.json --noEmit` exited 0. Both were run
  in `domain/`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (189 warning(s), 646 baselined)`. The one
  new warning is advisory: `domain/src/output-nodes/extract-list/: 16 source files is past the 15-file advisory
  threshold`, caused by `swapped-name.ts`.
- One-off check against Core with the real D1 keys: Core picks the Confirm column, `nearest`, score 0.702. The
  scratch script was deleted afterwards.

## Not verified

- The end-to-end submit refusal through `resolveWebPlanNode` and Core's sentence for it. This is blocked on the
  one line in `resolve-plan-node.ts` described above.
- Showing an accepted guess on the submit answer. This needs Core (above).
- The literal-request path (`actions/extraction/field-match.ts`) is not changed. It has its own matcher and was
  not in scope.
- No Lab, provider or full-suite runs, as the brief says.

## Open questions or contradictions found

- The brief describes the name as "Request accepted". What rev 5 actually wrote (step 0048) is the detector key
  `div_x0531l50_x1r2vv8_x4q0id2_div_x1papwzz_xu37y6r_xvzo2ll` from `extraction.6`, whose label is
  `text: 'Request accepted'`. The rule handles both shapes: the key shape is tested, and a header such as
  `Entry outcome` against `Entry action` is tested.
- Limitation: two keys that differ only in short tokens within 2 edits (`col_a1` against `col_b2`, `price_1`
  against `price_2`) count as a typo under Core's bound and are still guessed.
- A refused `fields` entry still gets no `valid` list. Only conditions and the record output get one. Adding it
  would mean threading the written name through `columns.ts`'s refusal.
- The new advisory warning could be cleared by moving `column-match.ts` and `swapped-name.ts` into
  `extract-list/column-match/`. I did not do that restructure.
