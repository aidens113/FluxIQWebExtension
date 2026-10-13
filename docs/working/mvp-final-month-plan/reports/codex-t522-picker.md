# t522 extraction picker ownership

Status: source/tests frozen for supervisor independent types/audit/native realistic DOM proof. The focused previously held receiver brief was explicitly released by the supervisor under the user's complete-MVP direction. No broader paused UI work was resumed.

## Implemented contract

Content now retains an accepted lease separately from the active overlay/physical-press drain operation. A real successful structural choice remains confirmable after click/auxclick, the current10s drain timer or draining Escape. Duplicate current starts preserve the choice; picking duplicates do not install extra listeners; a refused current choice can rearm under the same ID. Existing invalid_definition/not_recording gates remain retryable and unchanged.

Known retired start/cancel/record IDs never alter a newer picker. Unknown cancellation creates only a local ID tombstone and cannot stop another lease; a later matching start refuses. Never-seen opaque starts may replace current ownership: there is no chronological ordering claim about unseen messages. IDs alone persist for this content-document lifetime, cleared only by explicit administrative stopPick hard reset; production replacement/cancel/drain/record paths do not clear tombstones.

Per-operation listener closures check exact lease/operation before swallowing. Each restarted drain timer carries its own operation/token proof; retained old callbacks, replacement timers, same-lease old timers, refused-rearm callbacks and pre-reset callbacks remain inert. Waiting Escape retires once and emits the exact cancellation; draining Escape only releases listeners and preserves confirmation.

Record correlation is checked before any release or emit. Current successful confirmation releases only its own residual drain and invokes unchanged recordExtraction. A picking/refused/mismatching/retired record returns truthful stale_session with no emit. Idle never-retired no-pick DefineExtraction remains compatible with original definition/recording gates; this is bounded local correlation, not origin/authorization proof. Each accepted explicit confirmation invokes the existing recording seam; changed definitions/repeated confirmations are not cached or suppressed.

## Owned paths

Task downstream `fxwork/t522/!FluxIQWebExtension`, branch `task/t522-extraction-picker-ownership`:

- `apps/extension/src/content/picker/session.ts`.
- `apps/extension/src/content/picker/messages.ts`.
- `apps/extension/src/shared/extraction-messages.ts`: only truthful stale_session content refusal union/comment.
- NEW `apps/extension/src/content/picker/tests/confirmation-fixture.ts`.
- NEW owning `confirmation-lifetime.test.ts` and `receiver-ownership.test.ts` in the same tests directory.

No Core, background/auth, recorder, recorded-event, message router, domain, existing tests/shared fixtures, t518 or shared documentation was edited. The sibling detached Core remains read-only. Supervisor owns authored architecture integration.

## Meaningful reproduction and fixture

Before production source edits, the new synthetic three-item UL/LI/SPAN fixture exercised actual inferListFromElement through the real picker pointerdown listener and actual recordExtraction through parsed content messages/public recorder. The setup assertion requires a nonempty three-item proposal with the exact structurally matched item selector before success claims. Genuine inference?normal click drain?record passed on baseline. Stale A cancel after B failed: B's pointerdown listener count became0 instead of1. This established the receiver defect without mocking inference or manufacturing a successful lease.

The new local fixture reuses existing fakeShadowDom builders and supplies truthful connected/root/ownerDocument/overlay mutation and grouped-selector/listener/timer behavior. Unsupported selector grammar still throws through the original matcher. Recorder uses its public setRecordingState seam with snapshot/mutation capture disabled, not a production test hook. Test capture asserts no synthetic cell sentinels, element descriptor, preview or records in the recorded payload; field exclusion remains structural. It does not claim the page read or all preview/privacy behavior was executed.

## Observed narrow checks

From task downstream `apps/extension`:

```powershell
$env:EXTENSION_TEST_BUILD_LABEL='t522-first'
node scripts/test-extension.mjs content/picker/tests/confirmation-lifetime.test.ts content/picker/tests/receiver-ownership.test.ts
```

Before production change:1 passed genuine fixture prerequisite,1 failed stale cancel regression.

Final source-owning selection:

```powershell
$env:EXTENSION_TEST_BUILD_LABEL='t522-owning'
node scripts/test-extension.mjs content/picker/tests content/tests/recorder.test.ts content/extraction/tests/infer-list.test.ts
```

Observed PASS30 tests across5 files:16 new ownership/lifetime cases,4 unchanged picker cases,8 unchanged recorder cases,2 unchanged inference predicate cases. Existing press swallowing, mutation-before-action ordering and administrative same-ID fixture reuse remain intact. git diff --check passes (only line-ending notices).

Tests cover all drain modes, current duplicate starts, refused same-ID rearm, old start/cancel/record against picking/picked B, unknown cancel tombstone, unseen start replacement, replacement/same-lease timers, retained callbacks including rearm/reset, Escape/cancel retirement, zero stale emits, invalid/not-recording retry, idle compatibility and repeated explicit changed-definition emission.

## Limits and final verification

No browser/provider/Lab run, full suite, package build, process or user-panel management, commits/merges/pushes occurred. Worker narrow Node tests prove receiver logic and public recorder emission on a structural synthetic DOM; they do not prove native Chrome/Firefox event sequencing, sender/frame/project authorization, background unissued-start races, preview reads, collection/export or instruction-created extraction save/restart/replay. Those separate ownership boundaries were unchanged.

The supervisor must independently verify touched source/test types, structure budgets and native realistic DOM two-pick/cancel/confirm smoke. Full instruction-first one-page/paged scraping/export acceptance remains separate. An unseen already-issued opaque message cannot be ordered without a separately synchronized protocol; no UUID ordering was invented. No across-command confirmation idempotence or universal idle-origin guarantee is claimed.

Post-freeze self-review flagged compact NEW fixture callbacks. Supervisor explicitly released a fixture-only window before starting checks; sendMessage/setTimeout statements and observer method declarations were unpacked without behavior changes, then source/tests refrozen. Scoped diff check still passes. Supervisor types/audit/native verification remain independent and pending.

## Independent type corrections

Supervisor independently observed30 owning tests passing, then source/test types exposed mechanical errors in the new paths: exact-optional timerToken assignment, synthetic NodeList/document seams, ES2022 findLast incompatibility, missing required recorded-definition fieldLabels and a string/object field-input union assertion. Corrected only owned paths: delete the invalidated optional token; provide NodeList.item with an explicit synthetic boundary; type the fake document/node comparison; use reverse/find; derive fieldLabels from the actual inference; narrow field input before asserting exclusion. No target/lib change or weakened behavioral assertion. The same30-case owning selection passed again; source/tests refrozen for supervisor independent type/audit/native checks.
