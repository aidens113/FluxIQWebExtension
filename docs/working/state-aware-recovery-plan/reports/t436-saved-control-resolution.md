# t436: saved controls must be found on a later visit

Worker report for brief t436. Worktree `fxwork/t436-saved-control-resolution`, branch
`task/t436-saved-control-resolution`. Nothing is committed.

## Outcome

Done. All three fixes are in, each with tests beside it. Each fix was checked with a mutation that reverts it, and
those tests fail. The real-page row on the crossborder item page (seed 7342) passes headed. It saves 7-in-1 and Spain
while they are chosen on one page view, the way a build saves a step: the page view's handle is resolved into the
step's parameters. On a fresh view where 4-in-1 and China are chosen, the saved step chooses exactly 7-in-1 and Spain.
The run's dispatched fingerprint shapes do the same on another fresh view.

One point contradicts the root-cause report, and it changed fix C (see Open questions). A step built from a handle
reads its classes from the descriptor's `attributes.class`, not from `classNames`. So C strips the state class from
both.

## What changed and why

**A. A class set is never a single weak answer.**
- `apps/extension/src/content/element-finder.ts`:
  - New `stableFingerprintMatches(fingerprint, root)`. It runs the stable strategies in the old order: selector,
    xpath, id, test id, name, then class set.
  - It returns `{ matches, shared }`. The class set answers with every element carrying it, capped at 60 (the
    scorer's own `MAX_CANDIDATES`), and is marked `shared`. The other strategies still answer with one element.
  - `findClosestFingerprint` is now built on it and behaves as before: the first stable match, then a text fallback.
  - There is no new try/catch. The class selector is checked by the existing `query` before `querySelectorAll`, so
    the `failure-as-empty` ratchet is unchanged.
- `apps/extension/src/content/action-runtime/resolve-target.ts`:
  - `fingerprintMatches`: when a stable lookup answered by a shared class set, the accessible-name scan (role-less
    targets, as before) and the exact-text scan also run. Their matches are unioned with the class-set matches, with
    duplicates removed. The existing multi-match path (gate, then `scoreTargetCandidates`, floor, margin, exact
    corroboration) then chooses.
  - Unique stable answers return as before. The order when nothing stable answered is unchanged: name, then text.
  - New in `resolveIn`: when the fingerprint strategy's pool scores `unmatched` (none of the matches is the recorded
    control), it counts as a miss and Level 2 runs. Before, it was returned as TARGET_AMBIGUOUS. This mirrors what the
    veto does to a lone refused answer. Without it, a shared class set whose words match nothing would surface as a
    "tie" instead of "not found".
  - The file is 799 lines, under the 800 cap.

**B. Level 2 sees controls the page made pressable.**
- `apps/extension/src/content/identity/candidates.ts`:
  - `collectTargetCandidates` adds a second pass, only when the family names a tag. It covers that tag's elements
    that `CANDIDATE_SELECTOR` does not admit (`drawnAsControls`).
  - Such an element is admitted when the page listens for presses on it (`pageListensForPress`, the page world's
    probe) or when it sets its own `pointer` cursor (`ownPressCursor`). The cursor check is guarded where no
    `getComputedStyle` exists.
  - The pass shares `examined` and `MAX_SCANNED`, `MAX_CANDIDATES` and the `admits` gate. Truncation still compares
    against the lists' real lengths, so a page holding exactly the cap is reported complete.
  - It imports `../evidence/press-cursor` directly, because `../evidence`'s barrel leads back to `identity`
    (`evidence/controls.ts`).

**C. The class that sets the chosen option apart is not saved.**
- `apps/extension/src/content/evidence/like-options.ts`: `LikeOptions` gains `scarce` (the classes at most half the run
  carries). `apart` is computed from it, so the rule lives in one place.
- `apps/extension/src/content/evidence/set-apart.ts`:
  - New `setApartClasses(element)`. It returns the element's scarce classes only when the element is the run's single
    member set apart. This is the existing `setApartFromLikeSiblings` condition, so a consent banner's two drawn
    buttons keep their classes.
  - A cheap gate (`likeSiblingLacksAClass`) skips `likeOptions` and its cursor reads unless a like sibling lacks one
    of the element's classes. This matters because `describeElement` runs for every snapshot element.
  - Exported through `evidence/index.ts`.
- `apps/extension/src/content/describe-element.ts`: `classNames` leaves those classes out. So does `attributes.class`;
  see Open questions for why. The page view still prints `marked` from the live element (`dom-snapshot.ts`
  `setApart`).

**Tests and test support.** All test support is in tests/ folders I own.
- New `apps/extension/src/content/tests/stub-dom.ts`: the store chooser's hand-built DOM and selector engine, lifted
  out and extended. It adds:
  - `.class`, `#id` and single-quoted attribute selectors;
  - a `cursor` read from `style` and inherited;
  - a `listenForPress` marker that the press probe's `dispatchEvent` answers;
  - `attributes`, `classList.contains`, a global `getComputedStyle`, and the `HTMLAnchorElement` / table globals.

  The classes are exported as types only (structure rule: one exported class per file).
- `action-runtime/tests/store-chooser-page.ts` now builds on it. Its rows pass unchanged.
- New `action-runtime/tests/option-chip-page.ts`: the crossborder pickers with seed 7342's hashes, per-view group ids,
  and an `unmarked` variant that has no pointer or listener.
- New `action-runtime/tests/option-chip-replay.test.ts`, 6 rows:
  - trial 1 s10 Spain as dispatched;
  - replay s9 7-in-1 carrying the state class;
  - the A-only row on unmarked chips;
  - the Silver swatch named by `title`;
  - a chip no option matches: not found, with "9 control(s) of the same family", never a tie;
  - describe-on-one-view then resolve-on-fresh-view through `describeElement`.
- New `identity/tests/candidates.test.ts`, 5 rows: pointer or listener admitted while plain text and an inherited
  pointer are not; a role-only family is not widened; caps and truncation; exactly the cap reads as complete; the
  admit gate applies.
- `evidence/tests/set-apart.test.ts`: 3 rows added. This file already existed; the brief listed it as new.
- `apps/extension/e2e/content/tests/check-chosen-option/tests/check-chosen-option.spec.ts`: one row added.
  - It saves through the domain's evidence runtime and `resolvePlanNodeParameters`, and asserts the saved element is
    `{ tagName: "div", visibleText, classNames: [chipOption] }`.
  - It dispatches through Core's normalizer and the gateway mapping on a fresh view, after asserting that the
    exploration view's group ids are absent there.
  - It then dispatches the run's two fingerprint shapes (s9 with `optionOn`, s10 without) on another fresh view.

## Commands run and observed results

All were run in `C:/Users/osrs_/FluxStuff/fxwork/t436-saved-control-resolution`.

- **Typecheck.** In `apps/extension`, ran `node <typescript/bin/tsc> -p tsconfig.json --noEmit` and
  `node <tsc> -p tsconfig.test.json --noEmit`. These are the two projects `scripts/check-extension.mjs` checks.
  - Printed: `tsc src exit 0`, `tsc test exit 0`.
- **Unit tests beside every changed file.** Ran `EXTENSION_TEST_BUILD_LABEL=t436 node scripts/test-extension.mjs
  src/content/action-runtime/tests/ src/content/identity/tests/ src/content/evidence/tests/ src/content/tests/`.
  - Printed: `# tests 342`, `# pass 341`, `# fail 1`.
  - The one failure is `assertion-evaluation.test.ts` "the wait is real: a claim that becomes true partway through
    the window holds". It took about 3 s against its 2 s window.
  - It is pre-existing and not caused by this change. With the HEAD versions of every changed file restored and the
    new files removed, `node scripts/test-extension.mjs src/content/action-runtime/tests/` printed `not ok 2 - the
    wait is real…`, `# pass 107`, `# fail 1`.
  - Run alone, `node scripts/test-extension.mjs src/content/action-runtime/tests/assertion-evaluation` printed
    `# pass 7`, `# fail 0`.
  - Cause: while that test awaits, the runner is still importing the later bundles synchronously
    (`scripts/test-extension.mjs`, `await import` loop), so its event loop stalls past the window.
- **New rows only:**
  - `node scripts/test-extension.mjs src/content/action-runtime/tests/option-chip`: `# pass 6`, `# fail 0`.
  - `… src/content/identity/tests/candidates src/content/evidence/tests/set-apart`: all `ok`. This was 12 rows,
    before the candidates expectation was corrected to count the outer pointer div, which is correct; it was then
    rerun with 5 of 5 `ok`.
- **Mutation checks** (temporary edits, restored and rerun green afterwards):
  - A reverted (first stable match only): only the A-only row failed. B rescues the others through Level 2.
  - A and B reverted: all 6 option-chip rows failed.
  - B reverted: the not-found row failed (wrong family count).
  - C reverted: the describe-then-resolve row failed.
- **Structure audit.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (184 warning(s), 651
  baselined).`
  - The first run failed `[exported-values] … stub-dom.ts: 2 exported classes`. That was fixed with type-only class
    exports.
  - The warnings on touched files were all there before this change: `describe-element.ts` 11 exported values,
    `resolve-target.ts` 799 lines advisory, `resolve-target.test.ts` 547 lines.
- **Real page, headed.** In `apps/extension`, ran `pnpm test:content -- check-chosen-option --headed --workers=1`.
  - Printed `3 passed (26.7s)`, including `ok 3 … crossborder: option chips saved on one page view are chosen on a
    fresh one, by what was saved, and the first chip of the class never is (4.1s)`.
  - The scenario was crossborder-marketplace only, Chromium (the harness's `channel: "chromium"`), with the content
    bundle built from this worktree by the harness's global setup.
- **Real page, discriminating runs** (headed, `-g "saved on one page view"`):
  - With HEAD's `resolve-target.ts`, `candidates.ts` and `describe-element.ts`: failed at `7-in-1 is saved by its
    words and its own class`, because the saved `classNames` held `css-1dntdmy`.
  - With C kept and A and B reverted: failed at `saved Spain`, with status not `succeeded`.
  - Sources were restored after each run.

## Not verified

- **Other e2e specs were not run.** They would show A's and B's effect on other pages, and the brief allowed only this
  spec. I did not check which scenarios they use. The ones to rerun in the next sweep:
  - `identity-veto.spec.ts`, `identity-ambiguity.spec.ts`, `identity-resolution.spec.ts`;
  - `resolve-target.spec.ts`, `large-page-resolution.spec.ts`;
  - `selectors/tests/volatile-selector-replay.spec.ts`, which asserts "N control(s) of the same family" counts that B
    can raise for `div`, `span` or `li` families;
  - `created-identity/tests/fingerprint-after-change.spec.ts`, whose input family should be unchanged.
- **A changes when a class-set lookup yields TARGET_AMBIGUOUS.** Several like controls whose words all match now tie
  and are refused. Before, the first was weighed alone by the veto.
- **B performance.** B adds a `querySelectorAll(<tag>)` and a `matches()` per element of that tag, plus a probe
  dispatch and up to two computed-style reads per examined extra element, all under `MAX_SCANNED`. Its cost on a
  large page was not measured.
- **C on the snapshot.** C changes `classNames` and `attributes.class` in every snapshot descriptor of a single
  set-apart element. I checked that no extension or domain reader uses the descriptor's class to detect chosen state:
  `in-place-effect.ts` reads the live element. I did not run domain tests.
- **No Firefox run** and no live Lab run.

## Open questions or contradictions found

- **The root-cause report says every save path reads classes from `classNames`, but the model-built path does not.**
  The report (`r4a-4-saved-chip-not-found.md`, fix C) says "every save path … reads classes from this descriptor",
  meaning `classNames`. A step built from a handle (`domain/src/runtime/llm-evidence/packet-fingerprint/
  from-packet.ts`) passes the packet's `attributes` to `webElementFingerprint`, which reads `attributes.class`
  (`domain/src/element-fingerprint/build.ts:76`).
  - The real-page row caught this: the first headed run failed with the saved `classNames` still holding
    `css-1dntdmy`.
  - I fixed it in `describe-element.ts`, which I own, by rewriting `attributes.class` to the kept tokens for that one
    element. So the descriptor's `attributes` no longer carries that one class verbatim; the page view still says
    `marked`.
  - If the supervisor prefers `attributes` to stay a verbatim copy, the alternative is a domain change: the packet
    would carry `classNames`, or the builder would prefer it. That is outside this brief.
- **This lab's view counter does not always rotate the group ids between loads.** The run's own `#fbaudnsk` anchor
  existed on a later view in the harness, because it rendered views=0 for sku-spec. So the e2e row anchors the run's
  selector shape on the exploration view's own group ids and asserts they are absent on each fresh view, rather than
  using the run's literal ids. The unit row uses the literal ids.
- **The brief listed `evidence/tests/set-apart.test.ts` as new; it already existed, and I extended it.**
- **I created two test-support files the brief did not name, both in tests/ folders I own.**
  `content/tests/stub-dom.ts` replaces about 290 lines of engine that were in `store-chooser-page.ts`, and
  `action-runtime/tests/option-chip-page.ts` holds the crossborder picker page.

## Follow-up: volatile-selector-replay.spec.ts:179 (supervisor's request)

**Finding: this failure predates t436, and none of A, B or C causes it.** No source was changed for it.

**Where it fails.** I ran the row headed with `--reporter=json` (`PLAYWRIGHT_JSON_OUTPUT_NAME=…`) and read the
measurement annotation each time. All three runs print the same annotation and the same failure:

> pre-built address, generated token: succeeded (strategy fingerprint, best 0.926, candidates 1); same recording with
> an authored-looking token: succeeded (strategy fingerprint, best 0.926)

| Where | Command | Result |
| --- | --- | --- |
| dev at `4bf14e98`, read-only, nothing edited | `pnpm test:content -- volatile-selector-replay --headed --workers=1 --reporter=json` | 3 passed, row 179 failed |
| this worktree, with t436 | the same | the same |
| this worktree's base `1d63b2c8`: every modified `apps/extension/src` file set to `git show HEAD:<file>`, restored afterwards | `… -g "already carries"` | failed |

**Cause: t419, commit db84b6ad (2026-10-10), "Target matching ignores id and selector tokens that no element on the
page carries".** Since t419, `identity/score.ts` drops a recorded id or selector anchor that no element on the current
page carries, whatever its shape (`page-tokens.ts`; `because: "absent"`). The row's control token, `consent-modal`,
is carried by no element on the replay page. So it is set aside exactly as the regenerated `:r13b8o:` is. Both
resolutions are the same exact fingerprint answer, and the veto scores both at 0.926.

The row asserts the pre-t419 contract: "one it contradicts is charged". That contract is now false by design. t419
re-pinned seven scores in `identity-resolution.spec.ts` and one other identity spec, but missed this row.

**Not fixed.** The spec is not mine, and the brief says not to weaken tests. Restoring the charge would revert t419's
fix for R4a (`run-mv2nlh9l`: the quantity box's own per-load id charged at -0.8 × 26, best 0.27, not found).

**Suggested repair, which keeps the property t419 left intact.** In the spec, give the "authored-looking" control an
id that some *other* element on the replay page does carry, such as a neighbour's real id. score.ts says such a token
"keeps exactly the meaning it had", so it is charged as a contradiction, and the row would again measure "set aside
versus charged". This is a spec change for the supervisor, or the owner of that spec, to assign.

**Reruns after the follow-up** (no source changed since the report above):
- Headed, in this worktree: `pnpm test:content -- check-chosen-option identity-veto identity-ambiguity
  identity-resolution resolve-target large-page-resolution volatile-selector-replay fingerprint-after-change --headed
  --workers=1 --reporter=json`. Printed `passed 55 failed 1`. The one failure is
  `selectors/tests/volatile-selector-replay.spec.ts:179`, `toBeGreaterThan`, as above.
- Unit batch: `EXTENSION_TEST_BUILD_LABEL=t436 node scripts/test-extension.mjs src/content/action-runtime/tests/
  src/content/identity/tests/ src/content/evidence/tests/ src/content/tests/`. Printed `# tests 342`, `# pass 341`,
  `# fail 1`. The one failure is `not ok 2 - the wait is real…` in `assertion-evaluation`, which also fails on dev.
