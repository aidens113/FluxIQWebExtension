# t908 next-page humanness resumption

Outcome: Done

Reviewed all 17 files in stopped WIP commit 59b908e20 before editing.
Inherited implementation keeps level 0 direct-click path and records aimed/misclick
metadata on next-page continuation marks. Found and fixed later load-more presses
using stale preparation/marks; every press now prepares and marks its current
control. Misclick remains once per step. Resumed records fold into aggregate
aimed/misclick state. Exact prepared point is re-hit-tested after mark acknowledgement;
a stale point gets fresh preparation/mark within the existing command deadline.
No retry cap or new ending. Updated web-capabilities architecture documentation.

Validation:
- Unique label codex-t908-stale-aim, `node apps/extension/scripts/test-extension.mjs content/action-runtime/humanness/tests content/extraction/page-advance/tests/pager-press.test content/actions/tests/next-page.test` -> 51 passed, 0 failed on final frozen source.
- Initial unique label codex-t908-pager-20261111, `node scripts/test-extension.mjs content/action-runtime/humanness/tests content/extraction/page-advance/tests content/actions/tests/next-page.test runtime/tests/next-page-continuation.test` (cwd apps/extension) -> 140 passed, 0 failed, 488.2 s. Bundled before fixes; the edited pager subjects were rechecked in the final 51-test run above. Shared continuation parser/runtime sources did not change after this bundle.
- First extension check -> 1; source tsc passed, test tsc lacked generated domain/node declarations (domain/dist absent). Final guarded run restores domain build and repeats check.
- Initial structure audit -> 1, inherited WIP deep import and as-never stubs; fixed both. Repeated audit -> passed (249 warnings, 552 baselined).
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t908-final -- "pnpm --filter @fluxiq-web-extension/domain build && pnpm --filter @fluxiq-web-extension/extension check && pnpm --filter @fluxiq-web-extension/extension test:content -- everything-store-next-page.spec.ts --workers=1"` -> domain build restored successfully; final extension check passed (96.5 s); first Chromium run: 2 passed, 1 failed from the constructor assertion described below.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t908-acceptance -- "pnpm --filter @fluxiq-web-extension/extension test:content -- everything-store-next-page.spec.ts --workers=1 && pnpm --filter @fluxiq-web-extension/extension check"` -> corrected Chromium spec 3 passed in 1.6 minutes; post-correction package check passed in 42.5 s (overall command exit 0).
- Unique label codex-t908-final-page-advance, `node apps/extension/scripts/test-extension.mjs content/extraction/page-advance/tests` -> all 91 final-source directory tests passed, 0 failed, 88.2 s.
- Final structure audit -> passed (249 warnings, 552 baselined); `git diff HEAD^ --check` -> 0.
- Heavy commands use machine coordinator. No paid calls or panel services.

Browser failure and cause: first real run passed level 0 and following-page tests;
level 100 navigated and carried aimed=true but the inherited spec incorrectly
required exact fractional equality across MouseEvent and PointerEvent. Guarded
Chromium constructor probe confirmed PointerEvent(10.1/10.5/10.9) preserves each
fraction while MouseEvent produces 10; negative -10.1/-10.5/-10.9 becomes -11.
Spec now requires pointer events equal the shared fractional point and every
mouse event equal its exact Math.floor conversion, retaining every inside-box
assertion and exact event sequence. No epsilon or product behavior change.

Diff review: reviewed every WIP source/test change plus follow-up diff. Level 0
never constructs a human pager press, has the original result and mark shape,
and avoids a new await on an absent press. Aimed records carry no row/page data.
Core untouched; no public cross-repository contract change. Final browser harness
uses headless Chromium and real everything-store fixture, replacing extension
transport with the existing stub. It does not prove installed-extension delivery
or Firefox behavior; runtime continuation unit tests cover worker mark handling.

Outcome: Done
Changed: inherited 17-file WIP; follow-up edits to humanness/pager-press and tests,
page-advance list-change/load-more/pager-press and tests, everything-store spec;
docs/architecture/web-capabilities.md and this report.
Validation: focused units 51/51 plus page-advance directory 91/91 final-source,
initial broader 140/140,
corrected real Chromium spec 3/3, extension check 0, structure audit passed,
whole-unit diff whitespace check 0. Exact commands/results above.
Not verified: installed extension/background browser messaging, Firefox, paid
Flow exploration/replay; none were requested for this provider-free task.
Report: docs/working/mvp-launch-plan/reports/codex-t908.md
Notes: no git mutations; lead owns integration. Source frozen; no pending runs.
