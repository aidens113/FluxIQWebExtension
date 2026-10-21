# t748-u8-photo-dialog-step: the dialog-step fix, proven in the browser on photo-social

## Outcome

Done. A new provider-free, headed site-reset spec on the realistic `photo-social` scenario writes the Flow that no
browser test wrote before. The Flow opens a post's dialog from the grid and then presses a handle that the post's own
page, at the same address, showed last.

- With the fix, the spec passed twice.
- With the HEAD versions of the plan-resolution files swapped in, it fails on the dialog assertion. In that run the
  trial's third step fails with `web.target.ambiguous`, which is t743 e3b's failure.

No product source, shared helper, other spec, fixture or doc was changed.

## What changed and why

New file: `apps/extension/e2e/site-reset/tests/photo-dialog-step.spec.ts`. It is modelled on `photo-toggle.spec.ts` and
`photo-dialog-destination.spec.ts`, and uses the same helpers: `startInstalledBuild`, `bindScriptedProvider`,
`bindInstrumentedRuntime` and `keepDiagnostic`.

- **Observing the resolutions.** The spec needed to see Core's candidate resolutions without changing a shared helper.
  Before `bindInstrumentedRuntime` runs, the spec wraps this build's `service.bindLlmEvidenceRuntime`. The wrapper wraps
  the runtime's `resolvePlanNodeParameters` and records each answer the domain gave, without changing it. It records:
  - the node and `handleReach`;
  - the number of `precedingSteps`;
  - the `tN` handles in the input;
  - the status;
  - whether `parameters.element.context.dialog` is set (a boolean only);
  - a digest of the selector;
  - `handleViews` (handle, view number, location).

  No page words are recorded.
- **Exploration.** The scripted builder:
  1. navigates to the studio profile;
  2. presses the grid cell of the first unpinned post (the dialog opens and the post's address is pushed);
  3. captures the dialog and takes the Like handle with `handleBefore(view, "Like", "Comment")`;
  4. navigates to the post's own page, takes the Like handle there, and checks that no dialog is open and the post shows
     Like;
  5. submits `profile -> cell (consequences: none) -> <own page's Like handle> (modify_existing)`.

  The Flow names the handle the own page showed last, and the spec asserts that it equals the dialog's handle (`t593`
  in each run).
- **Reset.** This follows photo-toggle. The passing trial leaves its own Like on the site. The gate, asked again,
  lists it (`trial step 3 ...`). The builder navigates to the own page and presses Unlike under `undoes: <trial act>`.
  A final test is admitted and answers yes, and the build ends `proposed`.
- **Assertions**, in this order. Each uses codes, counts, booleans, fixture URLs or opaque tokens only.
  1. Exploration: the handle is shared, there is no dialog on the own page, and the post shows Like at the start.
  2. The like step was resolved for the submission. It got status `resolved`, `precedingSteps` of 2 and
     `inDialog: true`, and its `handleViews` are `[[handle, postAddress]]`.
  3. The trial ran its three steps, all `succeeded` with no failure code, and the third step's control is `Like`. No
     `web.target.ambiguous` appears anywhere in the test answers, and the trial answered `yes`.
  4. The browser after the trial: the dialog shows exactly one post action in the Unlike state and none in the Like
     state. Exactly one Unlike control is shown on the whole page, which is the dialog's.
  5. Reset:
     - the trial act is in `leftOnSite`;
     - the second test answers `candidate.trial_reset_required`, naming it with `trial step 3`;
     - the `unlike.trial` declaration is `modify_existing`, permitted, and has no dialog;
     - `trialUnlike.ok` is true and exactly one click was dispatched;
     - the post shows Like at the end;
     - there are three tests, the last answers `yes` and does not start with the trial act;
     - the ending is `proposed`.
- **Diagnostic.** The diagnostic is `reset-photo-dialog-step.json` in the test's output folder. It holds the
  resolutions, the trial answers, the declarations, the reads and the page views of the Lab fixture pages, as the
  sibling specs' diagnostics do.

## Commands run and observed results

In `apps/extension` unless noted. `S` is
`C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/t748`.

- `node scripts/structure-audit.mjs` at the D root.
  - First run: `FAIL [statement-packing] ... photo-dialog-step.spec.ts ... line 41`, caused by a block-bodied `map`
    callback. I rewrote it as `.map(record).map(view => ({...}))`.
  - Rerun: `structure-audit: passed (218 warning(s), 618 baselined).`
- `node scripts/check-extension.mjs`: no output, exit 0. Its test project includes `e2e/**/*.ts`.
- **Run 1.**
  `pnpm test:e2e e2e/site-reset/tests/photo-dialog-step.spec.ts --reporter=list --output $S/t748-u8-e2e-1`. The log is
  `$S/t748-u8-e2e-1.log`.
  - The Core gate printed `core-build: FluxIQ Core's build at ...\fxwork\t748\!FluxIQ is current with its source.`
  - The extension build verified 22 files for chrome, firefox and e2e-chromium.
  - Result: `ok 1 ... (52.8s)`, `1 passed (2.8m)`, exit 0.
  - Diagnostic summary: `sharedHandle:true`, `likeStep:{preceding:2,inDialog:true,views:1}`,
    `tests:["yes","candidate.trial_reset_required","yes"]`, three steps succeeded, `ambiguous:false`,
    `afterTrial:{dialogLiked:1,dialogUnliked:0,likedAnywhere:1}`, `trialAct:"act-3"`, `trialUnlike:true`,
    `ending:"proposed"`.
  - The resolutions recorded in the JSON:
    - navigate: 0 preceding steps;
    - cell `t116`: 1 preceding, view 4, not in a dialog;
    - Like `t593`: 2 preceding, in a dialog, view 7, at the post's address.
  - This run started before the one-line statement-packing rewrite. That rewrite does not change what the spec does.
- **Run 2** (the final file text). Same command with `--output $S/t748-u8-e2e-2`:
  - the Core gate reported Core current;
  - the same diagnostic summary as run 1;
  - `1 passed (57.0s)`, exit 0.
- **Without the fix.**
  - I copied the four changed plan-resolution files (`next-page-slot.ts`, `resolve-plan-node.ts`, `target-packets.ts`,
    `view-history.ts`) to `$S/u8-backup/` and recorded their sha256 values in `$S/u8-backup/sha.txt`.
  - I wrote `git show HEAD:<path>` over each one. After the swap, `git diff --stat` on the folder listed only
    `tests/dialog-identity.test.ts`. The untracked `step-views/` stayed, but HEAD's files do not import it.
  - Same command with `--output $S/t748-u8-e2e-head`; the Core gate reported Core current. Result: `1 failed`, exit 1.
  - The failing assertion is `photo-dialog-step.spec.ts:187`, `expect(likeStep?.inDialog).toBe(true)`
    (`Expected: true`, `Received: false`). It is the first assertion after the exploration checks.
  - The diagnostic of that run:
    - `likeStep:{preceding:2,inDialog:false}`;
    - `tests:["execution_failed","execution_failed"]`;
    - steps `[succeeded, succeeded, failed web.target.ambiguous]`;
    - `ambiguous:true`;
    - `afterTrial:{dialogLiked:0,dialogUnliked:1,likedAnywhere:0}`, so nothing was pressed in the dialog;
    - ending `failed` (`flow_bootstrap.evidence_repeat_without_progress`).
  - **Restored.** I copied the backups back. `sha256sum -c $S/u8-backup/sha.txt` printed OK for all four files.
    `git diff --stat` on the folder again shows `next-page-slot.ts 9`, `resolve-plan-node.ts 12`,
    `target-packets.ts 70`, `dialog-identity.test.ts 157` and `view-history.ts 5`, which is the lane's working diff.

## Not verified

- No live or paid run, no other site-reset spec, and no full suites, per the brief.
- The spec does not check which capture number is the dialog's and which is the own page's. It proves the dialog
  context through `element.context.dialog`, the trial's outcome and the browser state after the trial.
- `git status` at the end no longer lists `office-address-confirm.spec.ts`, `office-read-after-change.spec.ts` or
  `docs/architecture/extension-client.md`, which were modified when I started. I did not touch them. They appear to
  have been committed by the supervisor while I worked; I did not check.

## Open questions or contradictions found

- None about the product. The fix behaves in the browser as the unit tests describe. Without it, the browser shows
  exactly the `web.target.ambiguous` failure that t743 e3b described.
- The spec observes resolutions by wrapping `service.bindLlmEvidenceRuntime` inside the spec. If other specs need this,
  it could move into `instrumented-runtime.ts` as a recorded `resolutions` list. That is a shared helper, so I left it
  alone.
