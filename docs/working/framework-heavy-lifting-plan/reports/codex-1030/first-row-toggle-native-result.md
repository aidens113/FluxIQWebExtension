# Grounded toggle native acceptance — t817

Outcome: Partial — native source ready; package checks/builds/browser execution await the lead's explicit grant after parent synchronization and fresh paired artifacts.

## Source ready

- New `apps/extension/e2e/site-reset/tests/photo-first-row-toggle.spec.ts` uses the public installed-extension project build and existing scripted provider. It imports the unchanged `photo-social-newest-likes` instruction and exact three-link/final-account oracle.
- Colocated helpers under `tests/photo-first-row-toggle/` prepare first matching post liked and later matches unliked through the fixture UI before the build baseline, detect/read the real grid, and use only issued target/extraction handles.
- The ordinary exploration press on the initially liked control supplies actual before/after signatures. The omitted-choice submission must refuse before any trial and offer the actual pre-state. Both observed states are mechanically selectable; only the desired copied pre-state is trialled. No wrong trial is forced past the earlier guard.
- The final trial must reach the unchanged account oracle before the scripted verifier answers, produce the exact nonempty three-link dataset, and retain the selected state through public adaptation approval/application into the saved graph.
- Saved Flow replay uses the public runtime service. The provider wrapper counts actual `runTask` callbacks; replay must have zero additional callbacks, three `already_in_state` skips, no new toggle transitions, the same dataset and the unchanged final account oracle.
- Existing `photo-obstruction-toggle.spec.ts` now copies the actual observed after-state into its Like step's `ensureState`. Every existing assertion and oracle remains intact.

## Owned changes

```text
apps/extension/e2e/site-reset/tests/photo-first-row-toggle.spec.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/index.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/builder.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/scenario.ts
apps/extension/e2e/site-reset/tests/photo-first-row-toggle/provider-count.ts
apps/extension/e2e/site-reset/tests/photo-obstruction-toggle.spec.ts
docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-native-result.md
```

## Pending validation

No checks, builds or browser runs were launched. The lead reserved them until P1b parent synchronization, Core 0.14 final build and extension source freeze. These sources are now ready for that freeze; any compiler/browser failure will be fixed only under the lead's grant and within ownership.

Proposed exact native command after fresh artifacts:

`pnpm.cmd test:e2e -- site-reset/tests/photo-first-row-toggle.spec.ts site-reset/tests/photo-obstruction-toggle.spec.ts --workers=1 --reporter=line`

The intended target is native headed Chromium with the `e2e-chromium` extension build and isolated photo-social state. Actual browser/build versions, execution outcome and callback counts remain unverified. No paid API, model credential, panel operation, scenario/oracle edit, git mutation or shared-document edit occurred.

Diagnostics will be attached as ignored Playwright artifacts: `grounded-toggle-build.json`, `grounded-toggle-failed-build.json` when needed, `grounded-toggle-replay.json`, and the existing `obstruction-toggle.json`. Exact run paths will be added after execution so the lead can preserve them before task cleanup.

Outcome: Partial
Changed: owned paths listed above
Validation: not run — explicit lead hold on checks/builds/browser pending fresh paired artifacts
Not verified: TypeScript, structure audit, installed-extension behavior, oracle results, actual zero-call replay, Firefox
Report: docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-native-result.md
Notes: Source ready for freeze. Earliest real refusal is tested instead of forcing a wrong trial. Zero paid calls made; native results are not yet claimed.
