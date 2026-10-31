# Grounded toggle native acceptance — t817

Outcome: Done — both native proofs passed across affected reruns. The first-row proof includes saved zero-call replay and unchanged official oracles; the obstruction proof retains all three executions, exact layer/recovery/handler checks and actual target skipping.

## Source ready

- New `apps/extension/e2e/site-reset/tests/photo-first-row-toggle/tests/photo-first-row-toggle.spec.ts` uses the public installed-extension project build and existing scripted provider. It imports the unchanged `photo-social-newest-likes` instruction through the existing scenario barrel and retains the exact three-link/final-account oracle.
- Colocated helpers under `tests/photo-first-row-toggle/` prepare first matching post liked and later matches unliked through the fixture UI before the build baseline, detect/read the real grid, and use only issued target/extraction handles.
- The ordinary exploration press on the initially liked control supplies actual before/after signatures. The omitted-choice submission must refuse before any trial and offer the actual pre-state. Both observed states are mechanically selectable; only the desired copied pre-state is trialled. No wrong trial is forced past the earlier guard.
- The final trial must reach the unchanged account oracle before the scripted verifier answers, produce the exact nonempty three-link dataset, and retain the selected state through public adaptation approval/application into the saved graph.
- Saved Flow replay uses the public runtime service. The provider wrapper counts actual `runTask` callbacks; replay must have zero additional callbacks, three `already_in_state` skips, no new toggle transitions, the same dataset and the unchanged final account oracle.
- Existing `photo-obstruction-toggle.spec.ts` now copies the actual observed after-state into its Like step's `ensureState`. Every existing assertion and oracle remains intact.

## Owned changes

```text
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/tests/photo-first-row-toggle.spec.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/index.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/builder.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/dataset-oracle.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/scenario.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/provider-count.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/observe-actions.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/obstruction-verifier.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/project-receipt.ts
apps/extension/e2e/site-reset/tests/photo-obstruction-toggle.spec.ts
docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-native-result.md
```

## Source checks and builds

The lead granted the three native structural corrections: move the new spec into its feature's `tests/` directory, import the existing task through the photo-social barrel, and split packed statements in the builder. Existing specs and scenario files were not moved. Native source is frozen.

Validation: `node scripts/structure-audit.mjs --rule directory-files --rule imports --rule statement-packing --rule test-placement` -> `structure-audit: passed (61 warning(s), 382 baselined).`, exit 0. The original site-reset tests directory is back to 25 source files. No baseline or allow-list changed.

Final-phase grant allowed the exact native TypeScript fixes. The provider counter handles both public resolver return forms and forwards the full resolution, resolver arguments, measurement/cost methods and run execution/abort context. The gateway observer declares both public action overloads and forwards the original durable options unchanged. The actual trial receipt is explicitly guarded before dataset lookup, and the optional expected count is separately asserted as three.

- `pnpm.cmd --filter @fluxiq-web-extension/extension check` -> exit 0; `extension:check` completed in 36,912 ms.
- `pnpm.cmd --filter @fluxiq-web-extension/extension test:e2e:build` -> exit 0; Chrome, Firefox and `e2e-chromium` each verified 22 files; build step 21,798 ms.
- Four-rule source structure audit -> passed, exit 0, 61 warnings/382 baselined.
- `node scripts/check/model-text.mjs` -> `model-text: ok (207 scenario tokens, 416 model-facing Core files, 12509 string literals)`, exit 0.
- Released the heavy-check marker only after verifying the exact owner `first_row_toggle_design native acceptance`, before launching the browser. Root owns the next marker/refresh phase.

Proposed exact native command after fresh artifacts:

From `apps/extension`: `pnpm.cmd test:e2e site-reset/tests/photo-first-row-toggle/tests/photo-first-row-toggle.spec.ts site-reset/tests/photo-obstruction-toggle.spec.ts --workers=1 --reporter=line`

The literal extra `--` in the earlier command was forwarded to Playwright and caused its worker/reporter flags to be ignored. That initial launch paired two isolated gateways but was cancelled before any verdict; its evidence is under `test-runs/t817-grounded-toggle-native/attempt-1-runner-separator/`. The corrected command explicitly reported `Running 2 tests using 1 worker` and reused the fresh extension build.

## First complete native batch

The corrected two-spec command completed naturally with two failures, both test assumptions rather than a demonstrated polarity defect:

1. **New regression:** actual installed-extension exploration reported the originally liked control's before and after signatures. Omitted choice returned `candidate.toggle_state_required`, with the desired signature marked `before press`/`shown`. The site account remained unchanged across refusal and browser command count stayed 27 -> 27. The test then searched the JSON-serialized refusal for an unescaped JSON signature; its assertion threw inside the scripted provider and Core reported `flow_bootstrap.evidence_repeat_without_progress`. No trial ran. Corrected the assertion to read the actual diagnostic message. The final trial is also read from the public generation receipt, because a confirmed yes completes the brief before another builder callback.
2. **Existing obstruction regression:** the explicitly grounded Flow was proposed after its first whole trial, with two judge requests carrying `ensureState`. Current Core completes a brief on a confirmed yes (the public submission's `next` says so). The old script expects builder turns 7–11 to create two further revisions/trials, but only six turns occurred; its collected `tests` array was empty. Its unchanged three-trial/learned-handler assertions therefore failed. This lifecycle incompatibility was reported to the lead; no assertions were removed or weakened and no lifecycle bypass was added.

Full evidence is preserved at `test-runs/t817-grounded-toggle-native/attempt-2-two-spec/test-results/artifacts/`, including each spec's diagnostic JSON, screenshots and trace. Source corrections to the new regression are frozen while the lead refreshes test-only Core source/artifacts. Extension checks and browser relaunch are on hold until that refresh is confirmed.

## Authorized obstruction fixture correction

The lead authorized controlled scripted-verifier uncertainty for the first two completed executions, followed by a normal verified yes for the final learned-handler revision. This is provider-free acceptance setup, not a failed site effect or historical evidence about an actual model. `obstruction-verifier.ts` tracks the actual requested trial phase and independently asserts the visible post dialog, Unlike control and exact liked-post account before **every** verifier answer. It returns ordinary `answersRequest: "unknown"` (Core's `unsure`) in the first two phases and the unchanged normal verifier answer in the final phase. The new first-row test still uses the normal verifier throughout.

The obstruction assertions retain three executions with verdicts `unsure/unsure/yes`, the exact recovery and CC7 layer reports, no failed action/recovery card, earlier absence/final presence of the learned handler, and actual skip behavior. Request grouping follows recorded trial phase rather than total provider-call offsets. The final confirmed yes completes its brief normally; its fresh whole-trial receipt and persisted runtime session are read through public service methods, with no invented test feedback or private executor path. Final execution of these assertions passed.

## Latest native results and preserved evidence

After the refreshed Core/dependency artifacts, extension check (20,081 ms), standard e2e build (16,872 ms), full structure audit (236 warnings/616 baselined) and model-text checks passed. A two-spec run then reached a genuine whole-trial yes and correct final account in the new proof, stopping only because the ad hoc equality compared absolute stored links to relative fixture paths. The official comparator already supports this transport case: `packages/test-runner/src/run-expectations/extraction/value-match.ts:40-52` requires an exact scenario origin and full resolved URL equality; `flow-lane/expectations.ts:201` supplies that scenario-origin context. The test now calls the unchanged official `assertExtraction`/`measureExtraction` through its existing barrel, retains exact keys/count/order, and proves a foreign-origin link fails. No expected records or task wording changed. This batch is preserved under `attempt-3-two-spec/`.

The obstruction verifier's first UI guard had also required a dialog role, although a valid trial observation can be on the post's own page. That invented precondition caused `not_judged` before any verifier answer; all site runs/recoveries still executed. Removed only that role requirement; visible Unlike and exact liked-post account checks remain before every verifier response.

The next checked/fresh run (extension check 21,079 ms; e2e build 15,999 ms; full structure/model-text pass) completed with **1 passed / 1 failed (3.4m)**:

- **New first-row proof passed.** Actual explicit pre-state selected, omitted choice refused with no new browser command, opposite observed state mechanically selectable without running it, normal whole trial confirmed yes (two judge calls), exact final account and official three-record positional oracle passed. The selected state survived public approval/application into the saved graph. Saved replay succeeded with callbacks **15 -> 15**, **3** `already_in_state` skips, **0** toggle transitions and the same three records/account state.
- **Obstruction site behavior passed through three executions**, ending proposed with `unsure/unsure/yes`, six independent UI/account checks, the exact four successful recoveries/CC7 reports, and handler absent in the first four verifier requests/present in the final two. Its next assertion looked for an unapplied detached trial node in the original parent Flow; the actual final trace contains the correct click skipped `already_in_state`. It now asserts that real attempt and the raw result's exact requested post URL instead.
- The controlled uncertainty produces exactly six expected failed-status result-check/note/tool rows, all without a node id or recovery. The lead authorized asserting these exact labels/kinds/titles/status values separately while rejecting **every other** failed row and requiring zero failed node/recovery cards. This does not filter out arbitrary unscoped failures. Only the obstruction spec changed after the new proof passed; references confirm its verifier/build-receipt helpers have no other callers.

Immutable passing first-row evidence (relative to the t817 repository):

```text
test-runs/t817-grounded-toggle-native/attempt-4-first-row-pass/test-results/artifacts/site-reset-tests-photo-fir-167f5-ith-zero-provider-callbacks/grounded-toggle-build.json
test-runs/t817-grounded-toggle-native/attempt-4-first-row-pass/test-results/artifacts/site-reset-tests-photo-fir-167f5-ith-zero-provider-callbacks/grounded-toggle-replay.json
test-runs/t817-grounded-toggle-native/attempt-4-first-row-pass/source-runtime-metadata.json
```

The metadata records native headed Chromium/`e2e-chromium`, actual package versions and relevant source/runtime SHA-256 fingerprints, with the exact callback counts. Relevant new-proof/runtime source is unchanged since its pass. All prior complete-batch evidence, including obstruction diagnostics/traces, is preserved under `attempt-2-two-spec/`, `attempt-3-two-spec/` and `attempt-4-first-row-pass/`.

Final obstruction-only source corrections are frozen. The exact-owner heavy marker was acquired only when absent for the required extension check/build/audit, then released before the affected-only browser run. The already green first-row proof was not repeated.

## Final acceptance

- Final `pnpm.cmd --filter @fluxiq-web-extension/extension check` -> exit 0, 21,015 ms.
- Final `pnpm.cmd --filter @fluxiq-web-extension/extension test:e2e:build` -> exit 0, 16,774 ms; Chrome, Firefox and `e2e-chromium` each verified 22 files.
- Final `node scripts/structure-audit.mjs` -> `structure-audit: passed (236 warning(s), 616 baselined).`, exit 0.
- Final `node scripts/check/model-text.mjs` -> `model-text: ok (207 scenario tokens, 416 model-facing Core files, 12509 string literals)`, exit 0.
- First-row native proof passed in the preceding two-spec run; that run's summary was `1 passed / 1 failed (3.4m)` before the old-spec-only trace/activity assertion correction. Relevant new-proof/runtime source stayed unchanged afterward.
- From `apps/extension`, final affected-only command: `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts e2e/site-reset/tests/photo-obstruction-toggle.spec.ts --workers=1 --reporter=line` -> **`1 passed (1.9m)`**, exit 0. No further source/test/build changes followed.

Final obstruction evidence confirms `proposed`, actual verdicts **unsure/unsure/yes**, **6** independent UI/account checks, exactly **6** expected result-check/note/tool uncertainty rows and **0** other failed rows, **0** failed node/recovery cards, **4** successful recoveries and **4** CC7 cleared-layer reports. Handler presence by verifier request is `[false,false,false,false,true,true]`. Its final actual click attempt was skipped `already_in_state` on the exact requested post URL. Gateway errors: **0**. These are controlled provider-free uncertainty results, not claims about a historical/live model.

Final immutable obstruction JSON:

```text
test-runs/t817-grounded-toggle-native/attempt-5-obstruction-pass/test-results/artifacts/site-reset-tests-photo-obs-6800f-er-a-liked-post-stays-liked/obstruction-toggle.json
```

The same JSON also remains at `apps/extension/e2e/test-results/artifacts/site-reset-tests-photo-obs-6800f-er-a-liked-post-stays-liked/obstruction-toggle.json`. The two first-row JSONs plus this final obstruction JSON are the three primary acceptance artifacts for the lead to inspect/copy before worktree cleanup. The exact-owner heavy marker is released.

The executed target was native headed Chromium with fresh `e2e-chromium` bundles and isolated photo-social state. Both native proofs passed, including actual zero-call saved replay. Firefox bundled but was not launched. No paid API, model credential, panel operation, scenario/oracle edit, git mutation or shared-document edit occurred.

Diagnostics will be attached as ignored Playwright artifacts: `grounded-toggle-build.json`, `grounded-toggle-failed-build.json` when needed, `grounded-toggle-replay.json`, and the existing `obstruction-toggle.json`. Exact run paths will be added after execution so the lead can preserve them before task cleanup.

Outcome: Done
Changed: owned paths listed above
Validation: final extension check/build/full structure/model-text passed; first-row native passed; final obstruction-only native -> 1 passed (1.9m)
Not verified: Firefox launch, lead independent acceptance/integration and lead-owned final full sweep
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-native-result.md
Notes: Both native proofs green; exact paths/counts above. First-row saved replay callbacks15->15, three skips, zero toggle transitions. Source frozen, marker released, zero paid calls.
