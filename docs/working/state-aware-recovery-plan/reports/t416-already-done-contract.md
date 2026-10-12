# t416 already-done contract: worker report

## Outcome

Partial. Items 1, 3, 4 and 5 are done. Item 2 is done for the already-done skip only. The `optional_absent` and `state_routed` skips are announced in `runtime/executor/state-routing/announcement.ts`, which this brief did not let me edit ("other executor files"), so those rows do not carry the field yet. The emitter they need exists, and the remaining change is one call (see Open questions).

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t416/!FluxIQ`, automation-studio paths under `packages/fluxiq/src/programs/automation-studio/`):
- `packages/contracts/src/client-gateway.ts`: added `CLIENT_GATEWAY_ACTIVITY_SKIP_REASONS` (`already_done`, `optional_absent`, `state_routed`), the types `ClientGatewayActivitySkipReason` and `ClientGatewayActivitySkip { reason; subject? }`, and an optional `detail.skipped`. The change is additive and has no protocol bump. The doc comment now says `detail.skipped.subject` is cut to 160 characters.
- `runtime/activity/bounded.ts`: keeps `skipped` only on a `step` row and only with a known reason. It trims the subject, cuts it to 160 characters, and drops a blank one. Without this change the field would have passed through `...rest` with no bound.
- New `runtime/activity/step/skipped.ts`: `emitAutomationStudioActivityStepSkipped({ nodeId, said, skipped, step? })` emits one `running` step row with status `succeeded`, titled with Core's sentence and carrying `skipped`. It is exported from `step/index.ts` and `activity/index.ts`.
- `runtime/executor/step-loop/already-done.ts` (emission only): now emits through the new emitter with `{ reason: "already_done", subject: row ?? node.label }`. The label and step fields are unchanged.
- `runtime/executor/lifecycle-run/dispatch-records.ts`: `streamDisposition` now keeps `reason` and `guard` on an `unhandled` disposition. The model type `AutomationStudioFlowRunHandlerDisposition` already declares both fields. I kept `guard` as well as `reason` because the model documents both. Say so if you want `reason` only.
- Tests:
  - New `activity/step/tests/skipped.test.ts`.
  - A skip case added to `activity/tests/bounded.test.ts`.
  - `step-loop/tests/already-done.test.ts` now asserts the `skipped` field: the row label in the list case and the step label in the case with no row.
  - The `lifecycle-run/tests/dispatch.test.ts` and `checkpoint-routes.test.ts` expectations moved from `{ kind: "unhandled" }` to keeping the reason (and the guard).

Extension (`C:/Users/osrs_/FluxStuff/fxwork/t416/!FluxIQWebExtension/apps/extension/src/`):
- New `shared/activity/step-skip.ts`: the reader `stepSkip(event)` and the type `ActivityStepSkip`, taken from the wire type. A `Record` over the reason union makes a change in Core fail the typecheck. It is exported from `shared/activity/index.ts`.
- `panel/chat/stream/step/already-done.ts`: decides from `stepSkip` first. A row whose `skipped` this panel cannot read is never guessed from its shape. The old shape rule remains only when the field is absent, with a comment saying it is a fallback for an older Core (t411 to t415).
- Tests:
  - New `shared/activity/tests/step-skip.test.ts`, which includes an old row without the field.
  - In `panel/chat/stream/step/tests/already-done.test.ts`, the fixture now carries `skipped` as Core emits it. A separate `olderAlreadyDone` fixture has no field, and the tests check that the field decides over the shape and that an older row still gives "Already done" cards.

## Commands run and observed results

- `npm run build` in Core `packages/contracts`: the build-cache line reported "build ... inputs changed"; no errors.
- `npm run check` in Core `packages/contracts`: no tsc errors.
- `npm run check` in Core `packages/fluxiq` (tsc --noEmit): no errors.
- `npx vitest run .../runtime/activity .../runtime/executor/step-loop .../runtime/executor/lifecycle-run` in `packages/fluxiq`: 49 files and 360 tests passed.
- `EXTENSION_TEST_BUILD_LABEL=t416 node scripts/test-extension.mjs panel/chat shared/activity`, run from `apps/extension`: 376 tests, 376 passed, 0 failed, including the new tests (ok 143, 144, 355, 356, 357).
- `npm run check` in `apps/extension`: CHECK_EXIT=0.
- `npm run build` in `apps/extension`: chrome, firefox and e2e-chromium each "verified 22 files"; BUILD_EXIT=0.
- `node scripts/structure-audit.mjs` in Core: "passed (322 warning(s), 1160 baselined)". The only warnings on touched files are advisory, on `client-gateway.ts`: 10 exported values against a threshold of 8, and 536 lines against 400.
- `node scripts/structure-audit.mjs` in downstream: "passed (184 warning(s), 651 baselined)", with no warnings on touched files.

## Not verified

- No live browser test.
- No full suites.
- I did not check Core tests outside the three touched folders, for example `runtime/service/**`, which reads stored `handler_execution` records. Nothing I searched for asserted the stripped stream disposition outside `lifecycle-run/tests`.
- I did not rebuild the fluxiq dist. The extension check reported "Core's build ... is current".

## Open questions or contradictions found

- Item 2 says "the executor's ... skip announcements", but the skip announcements for `optional_absent` and `state_routed` live in `runtime/executor/state-routing/announcement.ts`, which falls under "Must not touch: other executor files". To finish item 2 there, replace its `emitAutomationStudioActivity({...})` with `emitAutomationStudioActivityStepSkipped({ nodeId: node.id, said, skipped: { reason: decision.kind === "declared" ? "optional_absent" : "state_routed", subject: node.label } })`. The subject should be `node.label` trimmed; leave it out when there is none.
- The new subject on an already-done row is the list row's label (for example, a person's name), as the brief allows. That value was already sent as `step.row` and in the label.
