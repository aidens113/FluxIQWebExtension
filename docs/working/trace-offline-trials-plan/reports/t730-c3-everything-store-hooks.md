# t730-c3: everything-store hooks for the last two synthetic content-harness rows

## Outcome

Partial. The hooks, the retargets and the unit tests are done. Two large-page rows still exceed their 30 s budget because of a product regression outside this brief.

- Both everything-store hooks are in place and unit-tested:
  - `keyboard-suggestions`: the header search as an arrow-key combobox;
  - `reworded-prompt`: "Not now" drawn as "Not right now", with the old words left in `aria-label`.
- Both rows are retargeted onto them. Neither `keyboard.spec.ts` nor `large-page-resolution.spec.ts` opens a synthetic scenario any more.
- `keyboard.spec.ts` passes in full (15/15).
- `large-page-resolution.spec.ts` rows 1 and 2 still exceed their 30 s timeout. The cause is a **product performance regression** in `apps/extension/src/content/identity/control-row.ts`, not the spec and not machine load (see the measurements below). Without a time limit both rows pass: row 2 in 16.7 min; row 1 in 3.4 min, recovered by `scored-candidate` at 0.648.
- I did not change product code (outside my brief) or the spec budget (the spec is not wrong).

## What changed and why

Scenario (`apps/scenario-lab/src/scenarios/everything-store/`). Both renderings arm through the store's existing `set-mode` operation. Like every armed mode, arming starts the account over. The store as it ships renders the same markup as before.

- `state/types.ts`: `storeModes` gains `keyboard-suggestions` and `reworded-prompt`, each documented as a real-store story. No manifest workflow variant arms them, so the manifest, its variant list, live tasks and repair tasks are unchanged.
- `pages/header.ts`: under `keyboard-suggestions` the search box gets `role="combobox" aria-autocomplete="list" aria-controls=<list id> aria-expanded="false"`.
- `client/suggestion-keys-script.ts` (new; appended to the shell script only under that mode):
  - ArrowDown/ArrowUp move a highlight (`aria-selected`, `aria-activedescendant`, wrapping), with preventDefault.
  - Enter on a highlighted suggestion fills the box and closes the list, with preventDefault, so the search form does not submit.
  - Enter with nothing highlighted searches natively.
  - Escape clears the highlight, and `aria-expanded` follows the list.
- `client/reworded-prompt-script.ts` (new; appended only under `reworded-prompt`): the notifications prompt as a redesigned bottom sheet.
  - It uses new classes and a new generated id, and puts the buttons in the other order: Allow first.
  - The heading, and so the dialog name, is still "Never miss a deal".
  - The decline reads "Not right now" with `aria-label="Not now"`. b5 proposed "Maybe later"; I measured it and it did not score (see Commands). Workflows that click `role:button:Not now` still work.
- `client/shell-script.ts`: `openNotifications` draws the shipped prompt or the redesigned one by mode. Each button reports its answer as `choice` (`later`/`allow`). The shipped prompt's markup is unchanged.
- `state/guard-ops.ts`: `dismiss-nudge` for notifications logs which answer it got: `declined notifications`, `allowed notifications`, or `dismissed notifications` when no choice is named. This gives the final-state oracle a way to tell the decline from the Allow button next to it.
  - A grep found no consumer of these activity strings outside the store's own state code: no store test, oracle, manifest fact, `packages/**`, `scripts/**` or e2e spec reads them.
- `style/classes.ts`, `style/element-ids.ts`, `style/stylesheet.ts`: six prompt-sheet classes, a `notifySheet` id, and the sheet and highlight styles.
  - Each hash is seeded per role, so no existing class or id changes.
- Tests (written first, then the implementation):
  - `tests/keyboard-suggestions.test.ts`: mode and reset; combobox markup present only when armed; in Chromium, the highlight moves, Enter fills without searching (`searchLoads` stays `[]`, URL unchanged), the next Enter searches `k=electric kettle`, and Escape forgets the highlight; the shipped store ignores the arrows.
  - `tests/reworded-prompt.test.ts`: mode and reset; the three activity lines; in Chromium, shipped vs armed button words, names and classes, and that the decline records `declined notifications` and Allow records `allowed notifications`.

Specs:

- `keyboard.spec.ts`: the keyboard-forms W03 row is replaced by "W03: arrow keys move everything-store's suggestion highlight, and an Enter the page cancels chooses without searching".
  - Setup: arm `keyboard-suggestions`, answer the overlays, type "elec".
  - ArrowDown and ArrowDown again: each reply must be `the page handled ArrowDown and cancelled its default action`, and `aria-activedescendant` must follow the options' ids.
  - Enter: the reply must be `the page handled Enter and cancelled its default action`. The value is "electric kettle", the list is hidden, the URL is unchanged and the final state has `guard.searchLoads: []`.
  - The file header is updated.
- `large-page-resolution.spec.ts`, row 1:
  - It records `[role="dialog"] button[data-choice="later"]` on the shipped store's prompt.
  - It then arms `reworded-prompt`, accepts consent, closes the app banner and reloads. Once the prompt is up, it prepends 3,000 filler anchors and clicks with the recorded descriptor.
  - Expected: `strategy: "scored-candidate"` with `bestScore > 0.35`, and a final state with `mode: "reworded-prompt"`, notifications dismissed and `declined notifications` in the activity.
  - Imports are now `TARGET_NOT_FOUND, describe, labMutate, openPath, recordedElement`, so `SAVE_BASELINE` and `armMode` are no longer used here. The header comment is updated.

## Commands run and observed results

All commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`.

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build -- "node scripts/build-scenario-lab.mjs"` (from `apps/scenario-lab`): built.
  - The cache said "not stamped, because inputs changed while it ran", which suggests another writer in the tree.
- `node --test dist/scenarios/everything-store/tests/keyboard-suggestions.test.js dist/scenarios/everything-store/tests/reworded-prompt.test.js`: `tests 9, pass 9, fail 0`.
- `node --test dist/scenarios/everything-store/tests/*.test.js dist/scenarios/everything-store/*/tests/*.test.js`: `tests 66, pass 66, fail 0`. This covers every existing store test, honest, naive and breadth paths included.
- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/keyboard.spec.ts --headed --workers=2` (20:33 to 20:37): `15 passed (2.6m)`.
  - The new W03 row passed in 2.3 s.
- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/large-page-resolution.spec.ts --headed --workers=2` (20:37 to 20:43, 3.2 GB free at start): `2 failed, 1 passed`.
  - Row 1 and row 2 each failed with `Test timeout of 30000ms exceeded` inside `harness.runAction`.
  - Row 3 passed (6.2 s).
- Root cause. I added a temporary CDP CPU-profile probe to row 2 and then removed it; `grep -c C3` now gives 0 and the audit passes. The run was `... large-page-resolution.spec.ts -g "cut short" --headed --workers=1 --timeout=900000`: `1 passed (16.7m)`.
  - A bare `captureSnapshot` on the 6,000-anchor company-website page took `elapsed=371716ms`. The miss took `elapsed=409591ms`, 97.4% of it in the failure-evidence snapshot (`actionFailure → captureSnapshotNow`).
  - Inclusive profile of the capture: `snapshotElements` 97.0%, then `describeElement` 96.8%, then `elementContext` 96.3%, then `soleAncestors` 93.4%, then `anotherAlike` 63.5%. `accessibleNameFor` is 43.3%, under `anotherAlike`'s `alike` test. `recordSubject` accounts for 64.9% and `controlRow` for 33.4%.
- Row 1, first wording ("Maybe later", as b5 proposed), with no time limit: the reply was `failed`, `target_not_found`, "best scored 0.32" (`bestScore 0.316`, runner-up -0.107).
  - The selector, the xpath and the class-set fingerprint all missed as intended. The class set matched only the newsletter's "Subscribe", which was refused as "in another dialog".
  - "Maybe later" shares no words with the recorded "Not now", so scoring could not clear the 0.35 floor.
  - I changed the copy to "Not right now", still with `aria-label="Not now"`. Exact text still misses and it is still a label-in-name mismatch, but the words partly overlap, as identity-drift's "Save" / "Save changes" does.
- Row 1, "Not right now", with a temporary env-driven filler count and a reply log (both removed afterwards):
  - 0 filler: `scored-candidate`, `bestScore 0.648`, runner-up -0.107, confidence 0.57, `1 passed (1.9m)`.
  - 3,000 filler, `--trace=off --timeout=2400000`: the same scores, `1 passed (3.4m)`.
  - In the first long run, a trace-artifact `ENOENT` held the worker until the 40 min timeout after the assertion had already failed at 2.9 min. That is why the later runs use `--trace=off`.
- Final run as briefed, `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/large-page-resolution.spec.ts --headed --workers=2` (22:11 to 22:13): `2 failed, 1 passed`. Rows 1 and 2 hit `Test timeout of 30000ms exceeded`; row 3 passed (5.4 s).
- `node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit` (from `apps/extension`, covering src and e2e):
  - Mid-task: exit 0.
  - Final: exit 2, with one error, TS2352 in `e2e/runtime/tests/typed-browser-readiness.spec.ts:172`. That is not my file; another worker is editing in this tree. No error is in my files.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (215 warning(s), 633 baselined)` (final run).
  - While the probe was in, it failed `[statement-packing]` on the probe's lines, as the lead noted. That is gone.
  - It also reports "1 baseline entries can be lowered". That is not mine to record.

### Diagnosis: product regression, not the test budget

`content/identity/control-row.ts` `soleAncestors` looks for "another alike control" around the element. For each node it walks (up to `MAX_ROW_SCAN = 2_000` per call) it computes `controlKind` and `accessibleNameFor`.

The snapshot runs it for **every** snapshot element:

- `recordIdentity → controlRowIdentity → controlRow`, added in 6db9ca04 on 2026-10-12, "A control repeated on every row is saved with, and resolved by, its row";
- then, for acted-on elements (anchors included), `recordSubject → controlRow` and a second `soleAncestors`, added in 62eb9b41 on 2026-10-17, "subject and page tokens...".

Each call is bounded, but the total is elements × 3 × 2,000 accessible-name computations. On a nav of 6,000 uniquely named links no twin is ever found, so every walk uses its whole budget: about 36 M name computations per snapshot.

The spec's own measurement from 2026-09-12 was 4,058 ms for a bare capture of a 5,000-element page. It is now 371,716 ms for 6,000, about 90× slower. Every action result carries a snapshot, so every row on a large page pays this.

The spec is not wrong: its 30 s budget had 7x headroom over the measured cost. I left it unchanged. The fix belongs in `control-row.ts` / `record.ts`. Possible fixes:

- memoise `soleAncestors` per element within one snapshot (`withSelectorMemo` already scopes a memo);
- compute the walk once for both `recordIdentity` and `recordSubject`;
- cache `accessibleNameFor`/`controlKind` per node during a capture;
- make the scan budget per snapshot rather than per element.

The 44 s capture b5 reported for `unique-selectors.spec.ts -g "large page"` is probably the same cause; I did not profile it.

## Not verified

- I did not bisect by building the extension at 6db9ca04^ and 62eb9b41^. The attribution rests on the CPU profile, where 93 to 95% of the time is inclusive in `soleAncestors`, and on those commits being the ones that put it on the snapshot path.
- Live Lab runs: none (out of brief).
- Other content specs that use the store's prompt or suggestions: not run. The shipped store's markup is unchanged, and the shipped prompt now only adds `choice` to its mutation.
- `apps/scenario-lab` `check` (the `tsconfig.e2e.json` half) was not run. The scenario `src` compiled in the build.

## Open questions or contradictions found

1. **Product regression (above).** Large-page rows 1 and 2 will keep timing out until `control-row.ts` / `record.ts` is fixed. It needs an owner.
2. `identity-fixtures.ts` line 49 says `SAVE_BASELINE` and `DISPLAY_NAME` "stay for `large-page-resolution.spec.ts` and ... identity-resolution's reworded-aria row". `large-page-resolution.spec.ts` no longer uses them, so that comment is stale. The file is not mine.
3. `identity-resolution.spec.ts` still opens identity-drift for its reworded-aria row. The new `reworded-prompt` rendering is the same shape of drift (words changed, accessible name kept, classes and id changed) and could host it.
4. The two new modes are not manifest workflow variants. If the Lab should ever arm them as run variants, they would need expected facts. I deliberately left the manifest alone so that no live task or manifest consumer changes.
