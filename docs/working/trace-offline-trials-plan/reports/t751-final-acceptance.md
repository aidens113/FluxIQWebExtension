# t751 final acceptance

Worker report for brief `t751-final-acceptance`. Trees: Core `fxwork/t751/!FluxIQ` at `7bb3373e`
(merge of dev on `fb81dc05`), downstream `fxwork/t751/!FluxIQWebExtension` at `55e6cb64`, both on
`task/t751-reset-by-observed-state`, both clean at start. Logs are under
`C:/Users/osrs_/FluxStuff/lab-runs/2026-10-27/t751-final/`.

## Outcome

**Done. t751 is ready to finish.**

- The full headed provider-free site-reset suite passes on the final code: `Running 17 tests using 1 worker`,
  `17 passed (16.8m)`, native exit 0 (`ds-e2e-site-reset-round2.log`). At the start it was 10 passed, 7 failed.
- Every Core and downstream gate the supervisor named passes after the last change.
- Round 1 fixed a real t751 regression: a trial's own Like, pressed back under `undoes`, never settled, which broke
  three dev-era photo specs. It also fixed two stale Core test expectations, one Core test type error and two stale
  spec expectations.
- Round 2 implemented the supervisor's three decisions, each with a fail-first test:
  - reload a named list once after a landed undo before judging it;
  - witness a looped pass by the item it actually pressed;
  - add a per-spec judge reply to the shared scripted provider.

## What changed and why

Core tree (`fxwork/t751/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`):
- `reset-settlement/control-tracker.ts`:
  - `originalStanding()` judges a control-stamped act by its known toggle's two states (round 1);
  - `pressedAt(page, place)` and a `latest()` filter by location for a pass's own original (round 2, item 2).
- `reset-settlement/judge.ts`:
  - passes the toggle (round 1);
  - `lookFirst` reloads, once per landed undo, a list that still differs after the act's undo landed (round 2, item 1);
  - the header now documents that rule.
- `site-reset/ledger.ts`: `stamped()` witnesses a pass that pressed another item by that item's own pre-press
  counts, at its own page and location. Where the build had already pressed that item, the explored receipt stands
  (R1). `trialRan` passes the step diff (round 2, item 2).
- `site-reset/control-witnesses.ts`: the original type gains `at` (judged only on reads at that location).
- Tests:
  - `site-reset/tests/trial-witness.test.ts`: two new fail-first tests (rounds 1 and 2);
  - `site-reset/tests/settlement-reload.test.ts`: new file, two fail-first tests (round 2, item 1). They were first
    written in `settlement-shapes.test.ts`, failed there, and were moved so that file stays under the 400-line
    advisory; its bytes are identical to HEAD;
  - `tests/site-reset-build.test.ts`, `tests/site-reset-calls.test.ts`: stale expectation updated;
  - `tests/action-permissions.test.ts`: type error fixed.

Downstream tree (`apps/extension/e2e/site-reset/`):
- `scripted-provider.ts`: optional `verify(shown)` returning a `ScriptedVerification`. Absent, the bare yes is
  unchanged, so no other spec changes. `index.ts` exports the type.
- `tests/photo-page-order-limit.spec.ts`: a reply naming each condition Core names (and any row it shows by id) in a
  sentence quoting the request's "three most recent posts". The oracle is unchanged.
- `tests/photo-dialog-destination.spec.ts`, `tests/office-site-reverted-toggle.spec.ts`: current t751 R2
  already-back contract (round 1).
- This report.

## Final run

`pnpm test:e2e e2e/site-reset --workers=1 --headed` (apps/extension, final code) -> `17 passed (16.8m)`, native exit 0
(`ds-e2e-site-reset-round2.log`, artifacts in `e2e-test-results-round2/`). The round-1 final run (`14 passed`,
`3 failed`) is kept in `ds-e2e-site-reset-final.log`.

## Not verified

- No Firefox run: the site-reset harness is Chromium only.
- No full repository suites (per AGENTS.md).
- e2e specs are not typechecked (no tsconfig covers `apps/extension/e2e`).
- No live or paid run: the judge reply is a scripted stand-in, so this proves Core accepts a properly evidenced yes,
  not that a real model writes one.
- The moved reload tests were proven to fail first in their original location; they were not re-proven failing after
  the move (same content).
- Core was built three times in all, each from frozen inputs after its fixes. Heap settings were not changed.

## Open questions or contradictions found

- **Heap.** Every Core typecheck and build here used `NODE_OPTIONS=--max-old-space-size=4096`. Node's default
  2,096 MB heap crashes `pnpm check` (exit 134). The supervisor is fixing this separately.
- **Advisory warning.** `site-reset/ledger.ts` grew from 752 to 763 lines; it was already past the 400-line advisory
  and baselined. Core still reports `443 warning(s), 1152 baselined`.
- **Remaining gap (not a failure).** photo-social's place and subject tokens are identical across posts. A
  non-looped step pressing one post, after exploration pressed another post at the same location, would still take
  the explored receipt. The per-pass rule keys on location or page, which differ between posts here.
- **Git stat cache.** `git status` shows `settlement-shapes.test.ts` as modified, but its bytes equal HEAD and
  `git diff` is empty (stat cache only). No index-changing git command was run.

## Progress

### 2026-10-27 — step 1, frozen installs

- Core root `pnpm install --frozen-lockfile` -> native exit 0, `Done in 2.7s` (`core-install.log`).
- Downstream root `pnpm install --frozen-lockfile` -> native exit 0, `Done in 1s`; `fluxiq 0.7.0 <- ..\!FluxIQ\packages\fluxiq`,
  so the downstream links the sibling t751 Core worktree (`downstream-install.log`). Both trees still clean afterwards.
- Spec inventory: `apps/extension/e2e/site-reset/tests` holds 15 spec files, 10 from dev and 5 added on the branch
  (`job-unexplored-step`, `office-navigating-press`, `office-site-reverted-toggle`, `photo-dialog-act`,
  `photo-page-order-limit`), not the "12 existing plus 5 new" in the brief. The whole directory is run below.

### 2026-10-27 — step 2, Core narrow gates

All from Core `packages/fluxiq` through the grouped runner (`pnpm test <paths>`) unless noted.

- Owner selection (`core-owner-args.txt`, 17 filters: every t751-changed test file plus `reset-admission/`,
  `site-reset/`, `flow-bootstrap/tests/`, `service/project-build/tests/`) -> native exit 1. Parallel:
  `Test Files 2 failed | 68 passed (70)`, `Tests 2 failed | 756 passed (758)`; real-SQL: `7 passed (7)`, `35 passed (35)`
  (`core-owners.log`).
  - Both failures are stale expectations in `flow-bootstrap/tests/site-reset-build.test.ts:299` and
    `flow-bootstrap/tests/site-reset-calls.test.ts:134`: they expected the refused-undo instruction to contain
    `this act stays as it is`. t751's reviewed commit `b5a9efcd` deliberately rewrote `site-reset/words.ts`
    `undoRefused()` to drop that promise, and t751's own `site-reset/tests/words.test.ts` pins its absence
    (`not.toContain("kept and not asked for again")`). Codex's earlier owner selection named only two files in
    `flow-bootstrap/tests/`, so these two had never run against the new text. Production behaviour is unchanged.
  - Fix: both tests now assert the current contract (`nothing was done`, `current listed reset and settlement
    conditions`, and `not.toContain("kept and not asked for again")`). No other assertion changed. That includes
    the follow-on check that the next trial runs with `act-1` under `startedWith.cannotUndo`.
  - Rerun of the two files -> native exit 0, `Test Files 2 passed (2)`, `Tests 26 passed (26)` (`core-stale-words-rerun.log`).
- Mandatory contract files (system-prompt, extraction-vocabulary, issue-feedback) -> native exit 0,
  `Test Files 3 passed (3)`, `Tests 68 passed (68)` (`core-contracts.log`).
- Package typecheck:
  - `pnpm exec tsc --noEmit -p .` -> native exit 134, `FATAL ERROR: Ineffective mark-compacts near heap limit`
    (`core-tsc.log`). Node 22.23.3's default heap here is 2,096 MB and nothing in Core raises it.
  - `pnpm check` (the package's own gate) -> native exit 134, the same heap failure (`core-check.log`).
  - Earlier reports t281 and t284 ran the same checks under a larger heap, so this run used
    `NODE_OPTIONS=--max-old-space-size=4096 pnpm check` -> native exit 2 with two real errors at
    `flow-bootstrap/tests/action-permissions.test.ts(39)`: TS18047 `'missingOriginal' is possibly 'null'` and
    TS2339 `Property 'evidence' does not exist`. Line 39 was added in Codex's final pre-effect assertion change
    (`fb81dc05`), which was never typechecked (`core-check-4g.log`).
  - Fix: assert `JSON.stringify(missingOriginal)` (the whole result) does not contain `build acted`. That is at
    least as strict as the evidence-only check and needs no cast.
  - Rerun `NODE_OPTIONS=--max-old-space-size=4096 pnpm check` -> native exit 0 (`core-check-4g-rerun.log`).
    `action-permissions.test.ts` rerun -> `Test Files 1 passed (1)`, `Tests 35 passed (35)`.
- Core root `pnpm docs:check` -> native exit 0: `structure-audit: passed (0 warning(s), 0 baselined)`,
  `Deterministic framework reference is current.` No declarations changed (test-only edits), so no `docs:reference` was needed.
- Core root `pnpm structure:check` -> native exit 0, `structure-audit: passed (443 warning(s), 1152 baselined)`.

### 2026-10-27 — step 3, frozen inputs, one stamped Core build, downstream gates

Core inputs frozen after step 2: `git status` shows only the three test files fixed above. Downstream showed only this report.

- Core root `NODE_OPTIONS=--max-old-space-size=4096 node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`
  -> native exit 0. `fluxiq:build` was built and stored (10334 files, 93 s); `contracts:build` and
  `client-gateway-websocket:build` were restored from the shared store (`core-build.log`). This was the only Core build.
- Downstream `node scripts/check/core-build.mjs` -> native exit 0, `FluxIQ Core's build at ...fxwork\t751\!FluxIQ is current with its source.`
- `pnpm --filter @fluxiq-web-extension/domain build` -> native exit 0, `domain:build` built and stored (1527 files) (`ds-domain-build.log`).
- `pnpm --filter @fluxiq-web-extension/domain check` -> native exit 0 (`ds-domain-check.log`).
- `pnpm --filter @fluxiq-web-extension/extension check` -> native exit 0 (`ds-extension-check.log`).
- `pnpm --filter @fluxiq-web-extension/domain test runtime/llm-evidence/plan-resolution output-nodes/extract-list` -> native exit 0,
  `# tests 347`, `# pass 347`, `# fail 0` (`ds-domain-tests.log`). The filter was applied: the full domain suite is 768.
- Downstream `pnpm structure:check` -> native exit 0, `structure-audit: passed (224 warning(s), 616 baselined).`
- `node scripts/check/core-mirror.mjs` -> native exit 0, `1 mirror set(s) match FluxIQ Core ... structure-audit (72 files).`
- `pnpm --filter @fluxiq-web-extension/extension build` -> native exit 0. `extension:build` built (80 files);
  `firefox: verified 22 files` and `e2e-chromium: verified 22 files` (`ds-extension-build.log`).

### 2026-10-27 — step 4, headed provider-free site-reset suite (first run)

`apps/extension`: `pnpm test:e2e e2e/site-reset --workers=1 --headed` -> native exit 1, `Running 17 tests using 1 worker`,
`7 failed`, `10 passed (22.5m)` (`ds-e2e-site-reset.log`; artifacts copied to `e2e-test-results-run1/`).
The brief's "12 existing plus 5 new" counts tests, not files: `installed-project` holds 2 and `office-buy-now` 2.
Every spec uses only realistic scenarios (everything-store, job-board, photo-social).

Passed: installed-project x2, job-failed-save, office-address-confirm, office-buy-now x2, office-cross-brief,
office-navigating-press (new), office-read-after-change, repair-first.
Failed: job-unexplored-step (new), office-site-reverted-toggle (new), photo-dialog-act (new), photo-dialog-destination,
photo-dialog-step, photo-page-order-limit (new), photo-toggle. The archived recovery ledger (line 279) records the
12 pre-t751 tests as `12 passed (5.2m)` on dev, so the three dev-era photo failures were regressions.

### 2026-10-27 — step 5, failures traced

1. **Trial-act toggle press-back never settled (t751 Core defect, fixed).** This hit photo-toggle, photo-dialog-step and
   photo-dialog-destination.
   - After a passing trial's Like was pressed back on the post's own page under `undoes`, the undo landed and reads
     showed the post's Like in its original state. Even so, the gate kept the trial act open
     ("still shows the state this act set").
   - Cause: a trial act stamped `via: "control"` takes `controlOriginal`. `reset-settlement/judge.ts` then judged it
     only with `control-tracker.ts` `originalStanding()`, which required every state count at the place to equal the
     original's. On photo-social the like place also holds the comments' like controls: the dialog view reported 13
     state tokens there and the post page 8, so no post-page read could ever match. The tracker header (t751 R2)
     states the rule as the start counts "for both states the toggle moved between", and explored acts were already
     judged that way through `standing()`.
   - Fix: `originalStanding()` takes the act's known toggle and, when it is at the original's place, judges only
     `toggle.from`/`toggle.to`. With no toggle known, every state is still judged. `judge.ts` passes the toggle.
   - Fail-first test in `site-reset/tests/trial-witness.test.ts`: "settles a control-stamped trial act pressed back on
     another view of its place by its toggle's own two states". Before the fix: `Expected: "restored"`,
     `Received: "in_place"`, `1 failed | 18 passed (19)` (`core-toggle-failfirst.log`). After: `19 passed (19)`
     (`core-toggle-fixed.log`). The test also asserts the act stays `in_place` on the other view while its toggle is still on.
   - Gates after the fix:
     - owner selection plus `reset-settlement/` and `reset-answers/`: parallel 760 of 761 passed. The one failure was
       my own over-reaching last assertion: a restored act stays `restored` by existing ledger design. I removed it
       and kept the meaningful negative. Real-SQL `7 passed`, `35 passed` (`core-owners-after-toggle-fix.log`).
     - `NODE_OPTIONS=--max-old-space-size=4096 pnpm check` -> exit 0; `pnpm docs:check` -> exit 0, reference current;
       Core `structure:check` -> exit 0 (443 / 1152).
     - Core rebuilt once more (`core-build-2.log`: only `fluxiq:build` rebuilt); domain build -> exit 0.
   - Headed rerun of the four photo specs: photo-toggle ok, photo-dialog-step ok, photo-dialog-destination and
     photo-dialog-act failed, `2 failed`, `2 passed (7.9m)` (`ds-e2e-photo-rerun.log`).
2. **Already-back expectations stale against t751 R2 (spec expectations, updated).**
   - photo-dialog-destination:213 expected `canMeet: "no_call"`. t751 deliberately split the already-back refusal:
     - an act a fresh read already settled `restored` is answered in `site-reset/undo-claims.ts` before admission,
       `no_call`;
     - an act still open whose control already shows the build's start is refused at admission in
       `site-reset/undo-admission.ts`, `this_page`, because a look settles it.
   - Here the act is still open on its unread list, and the spec's own next step shows Core's look settling it
     `restored`. The spec now expects `this_page`; its other assertions (declared, not permitted, nothing clicked)
     are unchanged.
   - office-site-reverted-toggle:166 (H worker's documented guess) expected a declaration with `permitted: false`. Its
     act was already settled, so the claim is answered before any admission and no declaration exists. The spec now
     asserts `canMeet: "no_call"` and that no `undo.toggle` declaration exists, which is stricter than "declared and denied".
   - Headed rerun: `2 passed (5.1m)`, native exit 0 (`ds-e2e-stale-specs-rerun.log`).
3. **job-unexplored-step: false "unsettleable" from an in-place stale read (fixed in round 2, below).**
   - The R3 part passes: the unexplored step's trial is refused `candidate.trial_step_unwitnessed` / `no_witness` /
     `another_page`, and nothing is pressed.
   - After the explored save is undone on its own My jobs row, the undo lands ("Removed from saved jobs").
     job-board's My jobs keeps the row in the DOM until reload: `apps/scenario-lab/src/scenarios/job-board/board/client-script.ts`
     `toggleSave` only repaints hearts and shows a toast.
   - At `trial.clean`, Core's own reads (`site-reset.read.14`-`18`) captured the tab in place, since it was already on
     My jobs. No `.arrival` navigation happened. The reads all show the 3-row hash `8f9e60...` from before the undo,
     and `site-reset/group-witness.ts` counts them fresh because they are stamped after the latest lasting call.
   - `site-reset/undo-reach.ts` then marks the spent act `actsUnsettleable`, `gate_unsatisfiable`/`no_admissible_undo`,
     and tells the model "Do not ... look for it again. End this brief now as blocked". A reload would have shown the
     site restored, so the dead end is false. The build ends `failed` (`flow_bootstrap.evidence_repeat_without_progress`).
   - job-failed-save passes only because its builder navigates to My jobs again before testing.
   - `start-check.ts`, `group-witness.ts` and `undo-reach.ts` are not in t751's diff, so the brief's escalation rule
     applies: no change made.
   - Suggested direction: Core's settling look for a destination whose latest read is an in-place capture from the
     same page load as a landed undo should reload it (navigate) before judging it, and certainly before declaring
     the act unsettleable.
   - The spec was never run green on t751's Core: t751-h's report lists its post-lane path as unverified guesses.
4. **photo-dialog-act: a looped trial act attributed to the explored item's control (t751 Core defect, fixed in round 2, below).**
   - FIRST = `GRID[0]` = `/p/D96ahbWGjtY/` (pinned giveaway). Trial step 6, inside `repeat over`, liked it (act-4),
     and it is the post still liked at the end.
   - Act-4's settle names `/p/DgYZxS8LJOe/`, which is EXPLORED (`GRID[4]`), the post exploration liked and later
     restored. There every control shows "Like".
   - Cause: `site-reset/ledger.ts` `stamped()` gives a trial act whose step carries a `via: "control"` witness the
     explored control's original, page and place. A row-bound step acts on another row's post, and photo-social's
     place and subject tokens are identical across posts (`p:9aa1...`, `s:bd677...`), so nothing distinguishes them.
   - The builder pressed where the settle pointed, and Core rightly refused (`candidate.undo_unproved`,
     `no_destination_read_before`). Act-4 can never settle, and the build ends with FIRST liked and no honest
     `gate_unsatisfiable`.
   - The failing oracle (`undoPresses ... likedNotAtStart > 0`) counts a leftover trial like after refused, unrun
     attempts, so it also over-reports. I did not touch it.
   - Not fixed: the fix needs a design decision on how a control stamp is scoped to the item a row-bound step acts on
     (for example, refuse to adopt the explored original when the trial step's own page location differs from the
     original's). My toggle fix did not change this spec's call or code sequence (identical before and after).
5. **photo-page-order-limit: the trial is correct, but the scripted judge cannot confirm it (fixed in round 2, below).**
   - The trial liked exactly the 3 newest unpinned posts: `likedNewest 3`, `likedPinned 0`, 3 rows read, 3 pinned
     rejected by `badge not contains Pinned`.
   - It is `not_judged`: "The checks did not provide the required exclusion evidence".
   - The shared `e2e/site-reset/scripted-provider.ts` answers every verification with a bare
     `{answersRequest: "yes"}`. Core's left-out-rows rule (t515/t663, `result-verification/request-rows/unquoted-rows.ts`,
     dated 2026-10-15/16, before t751) requires a yes to name each row a condition left out, beside a quote of the
     request's own words. The task "Like the studio's three most recent posts." never says "pinned", so a stand-in
     judge would have to name the three pinned rows and quote "three most recent".
   - That needs a per-spec verification reply in the shared, unowned provider (an option such as `verify(request)`),
     so it is not done here. The oracle must not be weakened.

### 2026-10-27 — round 2, supervisor decisions implemented

Ownership widened by the supervisor: reload before judging (item 1), per-pass stamps (item 2), and the shared
`scripted-provider.ts` (item 3). Heap settings unchanged.

1. **Reload a named list after a landed undo (job-unexplored-step).** `reset-settlement/judge.ts` `lookFirst` now
   also looks at an `undo` reason's location when that act's undo has landed, once per landed-undo count
   (`WeakMap` per act). Core's look navigates, so the list is loaded again before `unsatisfiable()` runs. This
   needed no change to `start-check.ts`, `group-witness.ts` or `undo-reach.ts`.
   - Fail-first tests (written in `settlement-shapes.test.ts`, then moved to the new `settlement-reload.test.ts`):
     - before the fix: `Tests 2 failed | 21 passed (23)`. The first got `"kind": "refuse"` where it expected `admit`;
       the second looked at nothing where it expected `["loc:mine"]` (`core-reload-failfirst.log`);
     - after: `23 passed (23)` (`core-reload-fixed.log`), and after the move `2 passed`, `23 passed`
       (`core-reload-moved.log`).
   - The second test proves a reload that still shows the row keeps the act to undo, and is not repeated.
2. **A looped pass is witnessed by the item it pressed (photo-dialog-act).**
   - In `site-reset/ledger.ts` `trialRan`, `itemPressed` is computed from the new `tracker.pressedAt(page, place)`
     before this act's own `landed()` call.
   - `stamped()` compares the stamped original with the trial act's own step diff: by location where both have
     one, otherwise by page. When they differ, the act's original becomes that pass's own pre-press counts
     (`controls.before`) at its own page, with `location` and `at` set to its location. Otherwise, or when the build
     had already pressed that item, the explored receipt stands (R1).
   - `control-tracker.ts` `latest()` filters by `at`, so reads of other items that share the place token never judge it.
   - Fail-first test in `trial-witness.test.ts`, "witnesses a looped pass that pressed another item by that item's
     own control, never the explored item's":
     - before: `Expected: "loc:b"`, `Received: "Read the page at loc:a again so its control's state can be seen."`
       (`core-pass-stamp-failfirst.log`);
     - after: `20 passed (20)` (`core-pass-stamp-fixed.log`).
3. **Per-spec judge reply (photo-page-order-limit).**
   - `scripted-provider.ts` gains `verify?: (shown: string) => ScriptedVerification`. The default bare yes is
     unchanged.
   - A first reply naming only `[row ...]` ids was still `not_judged`. A temporary dump of what the judge was shown
     (since removed) gave Core's missing-proof line: "The check answered yes without quoting, in a sentence that
     names condition 1 (badge not contains ["Pinned"]) ... the request's words that state its bound. Core read each
     of the 3 rows it alone left out as failing that bound, so no quote is needed beside them".
   - The spec's reply now names each `condition N` Core shows (and any row id, excluding the example id in Core's
     instructions) in a sentence quoting "three most recent posts". The oracle `trialCode === "yes"` and every site
     assertion are unchanged.

Gates after all round-2 changes (Core `packages/fluxiq` unless noted):
- Owner selection plus `reset-settlement/` and `reset-answers/`: parallel `71 passed (71)`, `764 passed (764)`;
  real-SQL `7 passed`, `35 passed`; native exit 0 (`core-owners-round2.log`).
- `NODE_OPTIONS=--max-old-space-size=4096 pnpm check`:
  - first attempt -> exit 2, two TS2379 errors in my own new test (`on` possibly undefined);
  - after the fix (`NonNullable` cast) -> exit 0 (`core-check-round2b.log`).
- Core root `pnpm docs:check` -> exit 0, reference current. Core `pnpm structure:check` -> exit 0,
  `443 warning(s), 1152 baselined` (444 before the test move).
- Contract files -> `3 passed`, `68 passed`. No model-facing text changed; run for certainty.
- Stamped Core build -> exit 0, `fluxiq:build` rebuilt (`core-build-3.log`). Domain build -> exit 0. Downstream
  `pnpm structure:check` -> exit 0, `224 warning(s), 616 baselined`, after all spec and helper edits.
- Headed, the three specs:
  - first: job-unexplored-step ok, photo-dialog-act ok, photo-page-order-limit `not_judged`
    (`ds-e2e-three-round2.log`);
  - after the reply fix: photo-page-order-limit `1 passed (2.3m)` (`ds-e2e-pageorder-round2.log`).
- Full headed suite once: `Running 17 tests using 1 worker`, `17 passed (16.8m)`, native exit 0
  (`ds-e2e-site-reset-round2.log`).
