# Report: g-resolver-corroboration

Worker `g-resolver-corroboration`, 2026-09-12 to 2026-09-13. Brief: design A
from `reports/i-resolver-safety.md` (a match nothing distinguishing agrees with
exactly is refused) and row CS1d (an ambiguous page resolved by position). No
`pnpm build`, no `pnpm lab`, no Core edit, no commit.
`EXTENSION_TEST_BUILD_LABEL=g-resolver-corroboration` on every extension
command. Heavy runs were one at a time, and every exit status was redirected to
a file.

## Outcome

**Done.** The fix was measured in a scratch copy first, and nothing in the stop
condition fired. It then landed in the repository, and both guards have
mutation proofs.

- **Stop condition checked, not triggered.**
  - W20-W23 (`selector-only`, `text-only`, `moved`, `wrapped-aria`) resolve the
    same control before and after, in every command shape.
  - `reworded-aria` still resolves at 0.389.
  - W26 (`ambiguous-targets` `no-context`) now reports `web.target.ambiguous`
    where the Flow-shaped command used to click the first button by position.
- **Design A landed.**
  - One predicate, `corroboratesExactly`, reads Core's own contributions.
  - Both acting paths use it: Level 2 scoring (`score.ts`) and veto rule 2
    (`veto.ts`). Floor and margin are unchanged.
- **CS1d landed.**
  - A hit from `coordinates` or `visual-target` now scores the recorded
    target's family before it is acted on.
  - A family that scoring calls tied throws `scoredAmbiguous`.
- **One brief defect worked around.** A new `identity-near-miss.spec.ts` would
  have made `e2e/content/tests/` 26 files. Its hard limit is 25, and git tracked
  exactly 25 at HEAD.
  - The near-miss rows therefore live in `identity-resolution.spec.ts`, a file I
    own, which puts it at 501 lines: a warning, not a failure.
  - The standalone version is kept at
    `…/scratchpad/g-resolver-corroboration/identity-near-miss.spec.ts.standalone`.

## What changed and why

| File | Change |
| --- | --- |
| `apps/extension/src/content/identity/corroboration.ts` (new, 69 lines) | `corroboratesExactly(score)`. True when at least one positive contribution on `visibleText`, `accessibleName`, `label`, `id` or `testId` has `score / weight >= 0.92`, which is Core's "text matched exactly" rung. An identifier contributes positively only when it is equal. It compares no string and scores nothing itself. A zero-weight contribution never counts. |
| `…/identity/index.ts` | Barrel export, plus a header paragraph. |
| `…/identity/score.ts` | In `scoreTargetCandidates`, a winner failing the predicate returns `unmatched`. The check runs after the margin check, so every tie is still reported as `ambiguous` and only a would-be `resolved` changes. The floor comment no longer says the 0.301 separation protects in general: it now says that holds only for a near-miss whose identifiers contradict. Floor 0.35 and margin 0.2 are untouched. |
| `…/identity/veto.ts` | Rule 2 calls the shared predicate. The local any-rung `corroborated` helper and its signal list are removed. The header no longer calls rule 2 "free", and says why. The refusal summary now reads "…with nothing the recording named agreeing exactly", which the existing `identity-veto.spec.ts` regex still matches as a prefix. The `recordedDistinguisher` precondition is unchanged. |
| `apps/extension/src/content/action-runtime/resolve-target.ts` | `POSITIONAL_STRATEGIES` is `coordinates` and `visual-target`. For those, after the veto accepts the single element, the family is enumerated and scored, and `ambiguous` throws `scoredAmbiguous(decided, [...misses, attempt.description])`, so the failure's `expected` names the point. Enumeration and scoring are memoised per call (`scoredFamily`), so the not-found fallback reuses them rather than enumerating twice. Header comments updated. 580 → 616 lines. |
| `…/identity/tests/corroboration.test.ts` (new) | Eight rows scored by Core's real matcher: exact text corroborates; "Save changes and exit" does not, though Core puts it on the 0.82 rung and it clears the floor; shortened "Save" scores identically and is refused; a kept aria-label corroborates; label exact versus longer; id and test id equal versus different or missing; structure alone at 1.000 does not corroborate; zero weight does not. |
| `…/identity/tests/score.test.ts` | R2, R4, R7 and R8 shapes, plus the identifier-less near-miss without ids, all `unmatched`, each asserting it clears the floor first. R1 is `unmatched` and under the floor. `reworded-aria` resolves on both recordings. R9, the accepted cost, scores the same as the wrong action and is refused. Two uncorroborated twins stay `ambiguous`. |
| `…/identity/tests/veto.test.ts` | Partial-label wrong actions (no ids, and with ids of their own) against authored and identifier-less recordings: each score is on the acting side of rule 1, and each is refused `uncorroborated`. A "line is exactness" row: `DRIFTED[3]` with its name kept acts; shortened in both text and name, it is refused. The existing `DRIFTED` loop still asserts all four drift shapes are kept. |
| `…/action-runtime/tests/resolve-target.test.ts` | CS1d unit rows on a Node stub page of identical `ui-button` "Continue" twins. Both `coordinates` and `visual target` on one of two twins fail `web.target.ambiguous`, `scored-candidate`, `candidateCount 2`, best equal to runner-up. A point on a lone button still resolves by `coordinates`. The stub installs `window` and empty `HTMLElement`-family classes, restored after each test. |
| `apps/extension/e2e/content/tests/identity-resolution.spec.ts` | The CS1d `no-context` content row: recorded selector, recorded bounds and descriptor. It must fail `TARGET_AMBIGUOUS` with `expected` containing "visual target", strategy `scored-candidate`, result "None" and `selected: null`. Also a near-miss group: R1-R4 and R7-R8, each replayed in both the replay and the Flow shape, all `TARGET_NOT_FOUND`, zero clicks recorded by a capture listener, and `saveCount 0`, `discardCount 0`. A control row with the near-miss beside Save resolves Save, `saveCount 1`. 375 → 501 lines. |

## Commands run and observed results

### Step 1: measurement before landing, in a scratch copy

**Enumeration.**
- **Command:** `node enumerate-corroboration.mjs`, from
  `apps/extension/.test-build-scratch/g-resolver-corroboration-probe/`, a
  gitignored copy of `l-veto-probe/enumerate.mjs` with the predicate beside
  today's rule. Exit 0.
- **Level 1 (the veto), totals across the 16 recording classes:**
  - Label agrees: 1935 → 1935 acted on, lost 0.
  - Label partly agrees: 1475 → 0, lost 1475.
  - Contradicted or gone: 0 → 0.
  - No label recorded: 32 → 32. The veto precondition does not run there.
- **Level 1 "partly agrees" losses per class** (highest score among the lost in
  brackets):

  | Class | Lost |
  | --- | --- |
  | id, test id, text, name | 189 (0.398) |
  | id, test id, text | 38 |
  | id, test id, name | 38 |
  | id, text, name | 264 (0.520) |
  | id, text | 60 |
  | id, name | 60 |
  | test id, text, name | 262 (0.509) |
  | test id, text | 58 |
  | test id, name | 58 |
  | text, name | 320 (0.703) |
  | text | 64 (0.659) |
  | name | 64 (0.659) |

- **Level 2 (scoring, one candidate alone), totals:**
  - Agrees: 2801 → 2801, lost 0.
  - Partly agrees: 2879 → 2014, lost 865.
  - Contradicted or gone: 457 → 457, lost 0. These resolve on an equal
    identifier.
  - No label recorded: 175 → 141. The 34 lost are every profile of the class
    that names nothing, and the highest of them scored 0.563.
- **Level 2 "partly agrees" losses per class:**

  | Class | Lost |
  | --- | --- |
  | id, test id, text, name | 14 (0.398) |
  | id, text, name | 100 (0.520) |
  | id, text | 27 |
  | id, name | 27 |
  | test id, text, name | 94 (0.509) |
  | test id, text | 23 |
  | test id, name | 23 |
  | text, name | 321 (0.703) |
  | text | 118 (0.659) |
  | name | 118 (0.659) |
  | id, test id, text | 0 |
  | id, test id, name | 0 |

**Chromium measurement: current code against the candidate change.**
- **Setup:** `node build-bundles.mjs` (exit 0) built the real
  `resolve-target.ts` twice, from the working tree and with the scratch copy
  substituted.
- **Run:** `pnpm exec playwright test -c <scratch>/measure.config.mjs
  --workers=2`, from `apps/extension`, through the content harness's own
  Scenario Lab.
  - The first run exited 1 with `Cannot find module
    'file:///F:/!FluxIQWebExtension/apps/extension/e2e/content/index.ts'`,
    because the scratch directory had no `"type": "module"`.
  - After adding `package.json`, the rerun exited 0: `16 passed (10.1s)`.
- **Command shapes:** "replay" is selector plus descriptor; "Flow" adds the
  recorded document bounds; "point" is bounds plus descriptor with no selector.

| Row | Current code | Candidate |
| --- | --- | --- |
| identity-drift baseline, `selector-only`, `text-only`, `moved`, `wrapped-aria`, all three shapes | resolve the right control (0.149, 0.259, 0.777, 0.783) | identical |
| `reworded-aria`, all shapes | `scored-candidate` 0.389, runner-up −0.360 | identical |
| R1 authored, near-miss with ids in the slot | replay not_found 0.088; **Flow and point: `visual-target` acts on "Save changes and exit" at 0.088** | not_found in all shapes; the veto refuses the point |
| R2, R3, R4 identifier-less | **acts on "Save changes and exit"** (0.633; R3 through `selector`) in all shapes | not_found in all shapes |
| R7, R8 authored, id-less near-miss | **acts on it** at 0.359 (scored, or `visual-target` in Flow and point) | not_found in all shapes |
| R9 authored, Save shortened to "Save" (the right control) | resolves at 0.359 | not_found: the named cost |
| K1 identifier-less, K2 authored: near-miss added and Save kept | resolve Save | identical |
| ambiguous-targets baseline primary, and the scored tie-break (1.000 against 0.382) | resolve | identical |
| `no-context` primary | replay ambiguous; **Flow and point: `visual-target` acts on button 0 at 0.565** | Flow and point: `web.target.ambiguous`, `scored-candidate`, 0.565 = 0.565, n=2 |
| `no-context` secondary, all shapes | ambiguous (the point missed) | identical |
| `form-context` secondary | **Flow and point: `visual-target` acts on button 0, which is the *primary* button: a wrong click** | `web.target.ambiguous` |
| `form-context` primary | ambiguous | identical |
| admin-console `nav-settings`, storefront-checkout `continue-to-address`, member-directory `member-search`: 5 recording and page policy cases each, all shapes | as tabled in `x-identifierless` | **no outcome or Level 2 ranking changed in any case** |
| admin-console third "Row actions" button (15 identical), as-authored | replay and Flow resolve through the selector; point-only resolves button 4 by position | replay and Flow identical; **point-only now `web.target.ambiguous`, 23 scored, tied at 0.801** |

**Timing.** Milliseconds per call, median of 5 rounds of 7×20 calls, one
observation on a loaded machine:

| Case | Current code | Candidate |
| --- | --- | --- |
| member-directory search input, selector missed, point hit | 0.03 | 1.2 |
| identity-drift with 3,000 extra links, selector missed, point hit | 0.02 | 0.735 |
| member-directory button, selector hit | 0.105 | 0.105 |

The "member-directory button (253 buttons), point hit" timing row did not reach
the positional path in either version (both 0.04), so it measures nothing.

### Steps 2 and 3: after landing

- **Files landed:** the scratch copies went in with `cp`. `cmp` showed all five
  byte-identical to what was measured. `sha256sum -c` first confirmed none of my
  owned files had changed since my initial read.
- **Typecheck:** `pnpm check`, run twice (after landing and after moving the
  rows). Both exit 0 (`tsc -p tsconfig.json --noEmit && tsc -p
  tsconfig.test.json`).
- **Unit tests:** `pnpm test`, run twice (after landing, and a final run after
  all restores). Both exit 0: `# tests 348 / # pass 348 / # fail 0`.
- **Content harness, targeted:** `pnpm exec playwright test -c
  e2e/playwright.content.config.ts --workers=2 --reporter=list identity-
  large-page-resolution resolve-target`, run twice. Both exit 0 with `50
  passed`.
  - The second run, after the move, had 22 rows in `identity-resolution.spec.ts`
    (the near-miss group and the `no-context` row included).
  - The other rows: `identity-ambiguity` 5, `identity-veto` 4,
    `identity-signals` 4, `identity-wire-chain` 2, `large-page-resolution` 3,
    `resolve-target` 10.
- **Content harness, full suite:** same command without a filter. Exit 1: `215
  passed`, `1 failed`, `identity.spec.ts:112 › ambiguous-targets: identical
  controls share every name signal`.
  - The received descriptors differ in `"landmarkName": "Primary"` against
    `"Secondary"`.
  - Rerun alone (`--workers=1 identity.spec -g "identical controls share every
    name signal"`): exit 1, the same one-line diff.
  - This is not caused by this change. `landmarkName` appears 0 times in every
    file I changed and 2 times in `identity/context.ts`, which commit `5911011`
    (B5, "Record … a landmark's name") changed during my run. The test asserts
    two descriptors are equal and does not depend on which element gets chosen.
- **Structure audit, first run:** scratch `GIT_INDEX_FILE` (copy of
  `.git/index`, my three new files staged), `node scripts/structure-audit.mjs`.
  Exit 1:
  - `FAIL [directory-files] apps/extension/e2e/content/tests/: 26 source files
    exceeds the 25-file limit`.
  - `FAIL [working-docs] docs/working/README.md is out of date`.
  - `git ls-files apps/extension/e2e/content/tests | wc -l` printed 25.
- **Structure audit, second run** (after moving the rows, two new files
  staged): exit 1 with one violation, `FAIL [working-docs] docs/working/README.md
  is out of date`. That is not mine; no file under `docs/working` is mine
  besides this report. My warnings:
  - `identity-resolution.spec.ts: 501 lines` (new).
  - `resolve-target.ts: 616 lines` (it was 580, already past 400).

### Mutation proofs

Each mutation was restored and checked with `sha256sum -c` against the landed
hashes: all OK. For M4, a `diff` against the measured scratch copy also showed
the mutated line as the only difference.

- **M1: design A's predicate bypassed.** In `corroboration.ts`, `>=
  EXACT_SIMILARITY` became `>= 0`, which is the old any-positive-rung rule.
  - Unit: exit 1, `# fail 14`. The failing rows:
    - 213, 214, 216 (`expected: false`, `actual: true`).
    - 226-230, the near-miss rows, and 233, R9 (`expected: 'unmatched'`,
      `actual: 'resolved'`).
    - 252-256, the partial-label veto rows (`expected: 'uncorroborated'`).
    - R1 (231) still passed: its 0.088 is under the floor.
  - Content (`identity-resolution -g "near-miss"`): exit 1, `6 failed, 1
    passed`. R1-R4, R7 and R8 fail with "Element clicked." and `+ "status":
    "succeeded"`; R1 fails through the Flow shape, the rest through replay. The
    control passes.
- **M4: CS1d disabled.** In `resolve-target.ts`, the positional `throw
  scoredAmbiguous(…)` became `void decided;`.
  - Unit: exit 1, `# fail 2`. Rows 155 (coordinates) and 156 (visual target)
    fail with `error: 'the point resolved one of the twins instead of failing'`.
  - Content (`identity-resolution -g "no-context"`): exit 1, `1 failed`,
    `Received "status": "succeeded"`, `"strategy": "visual-target"`.

## Not verified

- **No Lab run**, which this dispatch forbids. A Lab run must show:
  - week1 W20, W21, W22 and W23 recover, and W26 reports `web.target.ambiguous`,
    3 of 3 with `--repeat 3`.
  - `identity-drift --variant reworded-aria --flow` still resolves at confidence
    0.366 with `saveCount 1`.
  - The R7-shaped negative variant (`g-identity-drift-mode`) reports
    `target_not_found` in at least 90% of runs.
  - `ambiguous-targets` `no-context` reports `web.target.ambiguous` through the
    Flow lane.
  - `form-context` still refuses, now without any chance of the positional wrong
    click measured above. Whether it should *resolve* depends on context signals
    Core does not compare. That is not this brief.
- **The measurement and content rows hand the descriptor straight to the
  content script.**
  - They do not pass through the background worker, the domain mapping or Core.
    The descriptor is what `web.dom.extract` returns, not the narrowed wire
    fingerprint.
  - The Flow shape's `visualTarget` is built from the descriptor's document
    bounds, as `L-replay` inferred the Lab sends it. I did not read the
    background's command assembly.
- **Timings are one observation each** on this machine, under load. The
  member-directory button timing row did not exercise the positional path.
- **The enumeration is synthetic.** "Partly agrees" mixes legitimate drift (R9)
  with wrong actions (R7), and that population can't be split, so 1475 and 865
  are upper bounds on legitimate losses, not counts of them. Real-site wrong
  action labels were not measured.
- **Recordings that name nothing distinguishing no longer resolve through Level
  2.** The enumeration shows 34 of 34 lost; `p-veto-coords` counted 63 of 587
  fixture controls in that class. No fixture row depends on it: the full content
  suite and every D row were unchanged. The Lab corpus was not checked for it.
- Visible text longer than a candidate's 200-character bound could miss the
  exact rung. Not measured; no fixture has such a control.
- Firefox, cross-frame resolution and real sites were not exercised.
- The `identity.spec.ts:112` failure is attributed to `5911011` by reading the
  diff and the files. I did not run that test at a commit before `5911011`.

## Open questions or contradictions found

1. **Brief defect: file placement.** `identity-near-miss.spec.ts` (new) could not
   land: `e2e/content/tests/` held exactly 25 tracked files at HEAD after
   `12daaad` and `5911011` added `identity-signals.spec.ts` and
   `identity-wire-chain.spec.ts`. The rows now sit in `identity-resolution.spec.ts`
   (501 lines, a new 400-line warning). If a split is preferred, the directory
   needs restructuring first. The standalone file is in the scratchpad, and it
   passed the same seven rows before the move.
2. **`identity.spec.ts:112` is red at HEAD**, and it belongs to whoever owns B5
   (`g-recorder-signals` or the supervisor). Its comment says "the context
   records the landmark's role only", which `5911011` made false.
3. **Product decisions this lands, named in code and here.**
   - R9-type drift (the right control shortened, no aria-label and no surviving
     identifier) is refused. It scores exactly what the wrong action scores.
   - Level 2 refuses recordings that name no distinguishing signal. The veto
     precondition still exempts them at Level 1, as D14 decided.
   - The positional check costs a point-only replay onto identical controls. The
     admin-console row action measured above now fails ambiguous where it
     clicked the right row by position. With the recorded selector present it is
     unchanged.
4. **Not handled, by the brief's letter.**
   - The positional check throws only on `ambiguous`. If the veto accepts a
     point while scoring would resolve a *different* element by the margin, the
     point still wins.
   - `scoredAmbiguous`'s message says "no exact match" even when a point did
     land. The record's `expected` does name the point.
5. **Doc truth outside my files.**
   - D14 in `archive/2026-09-12-decisions-d13-d14.md`, lines 75-81, 92-99 and
     100-107, still describes rule 2 as any-rung, "free" and protecting against
     label impostors in general.
   - `veto.test.ts:12-18` still claims that file guards D13 on its own. The new
     `score.test.ts` rows now cover the identifier-less recording and the id-less
     near-miss the earlier report found missing.
6. **Structure baseline:** no entry should change. The only failing rule left is
   `working-docs`, which is the supervisor's index regeneration.
