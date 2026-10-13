# t527 Next-page-only transport retirement

Status: Source/test frozen; owning checks passed; supervisor verification pending
Owner: codex-t517
Pair: downstream task/t527-next-page-transport-retirement based on `6a46e66b`; detached read-only Core `73550acb`

The worker transport now continues only Next-page movements across documents. The former mixed `runtime/extract-list-continuation.ts` is deleted, and `runtime/next-page-continuation.ts` owns the existing mark/resend behavior. It exports one function through the runtime barrel. `action-runner.ts` selects this path exclusively for `web.dom.next_page`; ordinary list reads receive neither checkpoint token nor checkpoint listener. No production export/import of `sendExtractListAcrossDocuments` remains.

Next-page continuation retains matching tab/frame/token checks, validated row-free movement marks, refusal counts, bounded stalled documents, original command deadline, replacement-document readiness, closed-tab/child-frame/error propagation and listener cleanup. A marked press resumes as landing verification, without a second press. The transport interface has no new cancellation API; the owning regression proves a readiness AbortError propagates and releases the listener. It does not claim full Stop/resume cancellation coverage.

`shared/extraction-continuation.ts` keeps the read checkpoint types/readers still imported by the old content reader; its comment now states that worker read transport is retired. PageMoveMark and shared refusal counts remain intact. No content reader, domain, Core, storage, recording, policy, model guidance or legacy refusal behavior was changed. Old multipage stored Flow requests continue to be refused by existing domain dispatch; this unit does not normalize them into a successful one-page result. Removing raw content-reader paging is the later serial S7 unit.

Owning tests replaced the old accumulated-read transport suite with three delivery regressions and extended Next-page coverage for receiver scope, closed tab, child frame, readiness cancellation, stalled-document exhaustion and deadline carryover. Existing page-side move tests verify that a resumed landing presses nothing and preserves refusal-reload bounds.

## Observed checks

- Offline-only installs completed through the existing nextTaskId/createWorktree helpers. No startTask whole-workspace build wrapper. Parent restored public Core contracts/framework/websocket prerequisites through their normal filtered caches; Core was never edited.
- Initial owning run: 30/31 passed. The new lost-read test incorrectly expected a returned failed result; existing action-runner delivery instead throws. Corrected the test to assert the propagated error, one send, no extraction token and no listener. No product failure was patched to satisfy that test.
- Final owning selection: **31/31 passed, exit 0**, 23.93 seconds. Four actual owning files: runtime next-page-continuation and list-read-delivery; shared extraction-continuation; content extraction/page-advance move-page.
- `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0, source/test types and in-memory browser bundles. Final changed tests also checked by `pnpm.cmd exec tsc -p tsconfig.test.json --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check-test.tsbuildinfo`, exit 0.
- `node scripts/structure-audit.mjs`: exit 0, 193 advisory warnings/644 baselined items; no new violation. `git diff --check`: exit 0.
- `pnpm.cmd --filter @fluxiq-web-extension/extension build`: exit 0; Chrome, Firefox and e2e-Chromium each verified 22 files. Firefox's existing placeholder add-on ID warning remains; build is not Firefox live proof.
- First narrow content-browser attempt stopped before launch/tests because fresh worktree test-contracts dist was absent. Restored only `@fluxiq-web-extension/test-contracts build` through the normal filtered cache (exit 0), then reran the same everything-store Next-page selection headed.
- Headed Chromium owning browser selection: **2/2 passed, exit 0**, 1.2 minutes. One test read/moved through all five results pages and ended without another press; the other selected the pager's actual following page when the nominal Next led back to the same page. Fixture/content-harness coverage only, not real background transport or Firefox live proof.

Exact unit rerun, from `apps/extension` with a unique `EXTENSION_TEST_BUILD_LABEL`:

`node scripts/test-extension.mjs runtime/tests/next-page-continuation runtime/tests/list-read-delivery shared/tests/extraction-continuation content/extraction/page-advance/tests/move-page`

Exact narrow browser rerun, from `apps/extension`:

`node scripts/test-content.mjs extraction/tests/everything-store-next-page.spec.ts --workers=1 --headed`

The content harness runs Chromium against the allowed realistic everything-store fixture with the content bundle and a worker stand-in; it loads no unpacked extension. Its movement/landing checks supplement mocked-Chrome transport tests, but do not prove real background service-worker messaging/lifecycle. No provider calls, user panel, live lane/profile reset, override, full suite, commit, merge or push.

## Authored documentation follow-up owned by supervisor

Update extraction/runtime architecture to name `runtime/next-page-continuation.ts`, state that only Next page transports movement marks across documents, and record list reads' ordinary delivery. Retain explicit partial-S7 status: old content paging/checkpoint contracts remain until the next serial cleanup. Existing stale comments in unowned content reader/page-advance/e2e files refer to the deleted mixed module; update them with the corresponding later units. Do not claim those consumers or historical protocol types are already removed. Review baseline retirement if the deleted module removes a baseline violation.
