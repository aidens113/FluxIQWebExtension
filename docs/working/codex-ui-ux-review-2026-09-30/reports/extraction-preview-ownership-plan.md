# Extraction backend preview ownership plan

Status: Complete (executable source-based plan; implementation HELD)
Owner: recording_controls
Date: 2026-10-01

## Written brief

- Keep six-path recovery frozen. Read parent Current State and completed extraction-session-ownership-audit.md S3. Own only this report; downstream source/tests frozen for root shell/full checks.
- Inspect exact background/extraction/control.ts, session-store.ts, definition.ts and relevant owning background extraction-control/confirm tests. Propose exact control/store/new background/tests/extraction-preview-ownership.test.ts partition; if module budget/cohesion requires preview helper/barrel, name exact additional paths before release.
- Specify operation-owned preview success/refusal/finally and post-await session currentness. New narrower request must not retain/reveal disallowed old rows; all-excluded selection erases stored preview without page read, invalidates earlier broad operation and cannot be resurrected by late replies.
- Clarify actual stored row-key/allowed-field mapping and cache key collisions using real field grammar. Preserve20-row limit, current cache/retry compatibility, count/structure-only confirm behavior, no persisted page data and original D3/D12/sender/frame assertions. Do not silently treat all client session IDs as authorization or fix later S1/S2 in this unit.
- Return tests-first deferred actual-background schedule matrix and exact scoped/narrow commands. No tests/source/private stores/browser/provider/Lab/panel/heavy/broad/commits/shared docs. Root will release only after current extension source/gates freeze.

## Proposed implementation

Recommended exact three-path unit: background/extraction/control.ts, background/extraction/session-store.ts and NEW background/tests/extraction-preview-ownership.test.ts. No helper/barrel or definition change is required: session store already owns preview rows and session lifetime and can coherently own their operation leases. Control remains browser orchestration; store receives only an injected narrow row-read callback, never browser dependencies. Supervisor must explicitly release these paths before source/tests are written.

Progress checkpoint: actual content preview answers records keyed by proposal field keys, not renamed confirm keys. D16 accepts A?Z/a?z/0?9/_/- only (1?100, prototype names refused), and infer-fields derives unique keys through domain webAutomationExtractionFieldKey. Comma delimiter collision is therefore not a production valid-key defect; no definition/key grammar rewrite needed. Existing store setPreview clones first20 rows without allowed-key filtering; all-excluded definition returns undefined and current control returns without erasure. Designing bounded session-store-owned operation lifecycle to avoid a second global helper registry and preserve actual control/sender tests. No execution/source changes.

## Actual mapping and grammar

- Proposal field.key is the preview record key. definition.extractionPreviewRequest builds request.fields from proposal keys and current handling; content/picker/preview.ts:37 returns extractList outcome.records. Confirm field key comes from user-renamed labels and is a different namespace. Never whitelist preview rows by confirm payload or display label.
- Existing extractionPreviewRequest columnsKey is ordered names.join(','). Valid D16 keys match /^[A-Za-z0-9_-]{1,100}$/ and exclude prototype names (domain/actions/extraction/field-key.ts:14?20). Actual infer-fields.ts:228 uses domain/extraction/label-key.ts:37 to derive unique keys with that predicate. Commas cannot occur in valid production keys, so a comma-key collision is not a demonstrated defect. Keep definition.ts read-only and preserve its exported behavior/cache key.
- Existing store setPreview clones first20 rows, but copies every returned key. The normal content reader obeys request fields; injected malformed/overbroad replies are still not independently constrained at the store/reply boundary. For the released unit, project row own keys onto the operation's actual request.fields keys; retain valid string/null cells and missing-key absence, never invent empty values. No renamed-label matching, no copying disallowed cells and then hiding them.
- A narrowed request must clear previously stored rows synchronously before the new page read awaits. Erasure removes existing broad values, it does not claim to retroactively cancel a broad read already issued. Do not preserve old broad rows while narrow read is pending/refuses. A subsequent expansion reads again; excluded erased values must not reappear from an old cache.
- All-excluded extractionPreviewRequest is undefined because domain will not execute an empty field map. Treat that as a successful empty preview selection: immediately invalidate outstanding preview operation and erase rows/key; dispatch no preview message. Do not turn empty selection into an error or run an empty content request. Keeping key undefined means re-enabling fields will trigger a fresh read.

## Cohesive store-owned operation design

ExtractionSessions currently178lines, control374lines and definition197lines. Exact three paths suffice within existing budgets. Add private per-session preview operation storage to ExtractionSessions, keyed by session object/ID, and narrow methods for current object verification, projected preview snapshot and owned asynchronous refresh. Keep private operation type local; no new exported capability/helper/global registry or deps/index changes.

An operation captures the exact stored ExtractionSession object, original proposal object, current picked state, requested columnsKey, immutable allowed-key list and its own promise. Currentness requires sessions.get(id)===captured object, unchanged proposal identity, picked state and private current operation object===captured op. IDs alone are insufficient because store.start can replace an object; no user/client ID is being treated as authorization.

Proposed store method refreshPreview(session, columnsKey, allowedKeys, readRows) receives a narrow async callback returning preview rows. It synchronously installs its operation and erases prior stored preview before any notification/read/await, so an immediately following empty/narrow request can invalidate the earlier operation. Schedule callback only after operation installation; check currentness before actual invocation and after await. Successful current response projects/copies at most20 rows by allowed keys and commits matching previewKey. Current refusal/rejection erases its own preview/key and permits later same-key retry; obsolete refusal/rejection cannot clear newer successful rows/key. Finally releases only its exact operation, never a newer lease.

Identical currently pending key joins the same owned promise rather than issuing another page read; identical committed key stays cached. A new selection replaces pending ownership even if the first request is still issued. Empty selection/clearPreview, picked proposal replacement, markRecorded, clear(id), clearTab/start replacement invalidate operation ownership. clear(id) should drop held preview/key before deleting so captured obsolete session objects retain no page rows. Do not expose preview promises/rows through public wire or persist them. Existing setPreview/clearPreview callers are only control.ts; adapt/remove internal usage cohesively, preserving any existing public class method compatibility deliberately if retained.

This method is preview lifecycle responsibility already owned by the store. Control translates fulfilled content refusal into a callback rejection or failed-read result, preserving existing silent-empty preview behavior; no new user error/protocol vocabulary. All content dispatch stays in control through deps.sendToTab(tabId,message,0), limit20.

## Control reply ownership after await

readSession computes its own preview request/allowed-key snapshot once for the captured session/proposal before awaiting. After store-owned refresh (or joined pending attempt), check deps.sessions.get(captured.sessionId)===captured and proposal/state validity before serialization. If deleted/replaced, return existing {ok:true} missing-session shape rather than old view or discovering latest replacement. Do not alter sessionIdOf/global latest fallback policy in this S3 unit.

If the same actual session still exists but a newer selection superseded this read, construct a fresh reply preview snapshot restricted to THIS caller's captured allowed keys intersected with currently committed rows. An old narrow read must never receive broad cells merely because a newer broad read committed first. An old broad read may receive a newer narrower snapshot, which contains fewer permitted cells; never return captured old rows. During newer pending/empty/refused selection, reply contains empty preview. Other view fields and sessionId/tabId/form stay existing actual backend shape. If current session changed to recorded, return its current recorded state with zero rows; do not resurrect picked/proposal data from an obsolete read.

Snapshot rows are copied per reply, so a previously returned array cannot mutate current store rows. Projection helper should live on the store, reused for current commits and current reply snapshots, rather than duplicating row mapping in control. No invalid wire-owner field, receiver command change, start/Confirm/cancel rewrite or recording/pairing authorization claim.

## Tests-first actual-background schedule matrix

New tests use actual handleExtractionControl with existing synthetic harness, overriding only NEW-test local deps.sendToTab using deferred promises. Preserve shared harness and every original assertion. All fixtures use valid real grammar keys (product_name/price/card), no comma-containing invented proposal keys or fake frontend session fields.

Meaningful original failure reproductions before product edits:

1. Seed broad preview, request all fields excluded, assert store.preview and reply.preview immediately empty, no extra content read; currently they remain broad.
2. Issue broad A and narrower B; B succeeds first, A succeeds later; assert store keys/replies stay narrower and old A cannot restore price.
3. Newer B success followed by A refusal/rejection leaves B rows/key unchanged; current code clears them.
4. Seed broad rows then initiate deferred narrow B; inspect store while B pending, assert broad values already gone; current code retains broad rows until await.
5. Read with deferred preview, clear tab/delete or replace session, then finish old success/refusal: response missing old session and neither store/new session revived. Current code serializes captured deleted object.

Additional boundaries after implementation:

- Same-key concurrent read joins one content request; all callers resolve after owned promise; current success cached for later read.
- Old finally cannot release B's pending lock, verified by another same-key B read issuing no second message.
- Same-ID replacement via actual store.start creates a different object and rejects old success/refusal; different-session/tab replacement never mutates its rows.
- Late broad success after empty selection cannot repopulate any rows/key; re-enable later issues exactly one fresh read.
- New narrow pending/refusal cannot retain excluded cells; actual allowed-key mapping drops extra keys in successful injected reply, preserves string/null/missing distinctions and20-row cap.
- Old narrower caller completing after current broader commit receives only its original allowed subset. Each reply copy is independent of store rows/other returned arrays.
- Current failure clears key; later same-key request re-reads and succeeds. No error receipt/secret/page value persists or reaches confirm counts.
- ClearTab, clear, new picked proposal and markRecorded during pending refresh prevent old rows/old picked-state resurrection; recorded current view is empty.
- Identical proposal/control sender behavior, frame0 limit20/maxItems20/minItems0, original never-read pre-excluded field and no storage assertions remain passing.

If the original five reproductions expose a fixture limitation, request precise fixture release instead of weakening originals. If new method requires extra exported helper/path, stop for supervisor path release; no baseline/harness/strict-options relaxation.

## Narrow validation after explicit release

External TEMP/codex-t224-extraction-preview-focused.mjs bundles NEW extraction-preview-ownership.test.ts plus unchanged existing extraction-control.test.ts, extraction-confirm.test.ts and extraction-boundary.test.ts using existing dependency resolution/esbuild conventions, isolated ignored .test-build-scratch output. Run new regression subset first before product edits; then combined four-suite gate. Git Bash build-slots/heavy.sh required for every heavy run, descriptive codex t224 extraction preview label.

External TEMP/codex-t224-extraction-preview-scoped-types.mjs reads actual extension tsconfig and exact three owned roots; report all owned/global AND dependency diagnostics without exclusions. Verify exact diff whitespace and protected definition, original tests, harness, frozen frontend recovery and client remain unchanged. Root independently verifies source/narrow evidence and coordinates extension full/type/build/structure. No browser/provider/panel/actual state use.

## Final return

Only this report edited. This is an executable plan from source and relevant existing owning-test inspection; no regression executed and no source/tests/helper files created. Exact three-path proposal remains HELD pending supervisor release after current gates. Real extraction ID adoption, stale start/cancel/record receiver fencing, project/recording proof and host disposal remain separate S1/S2/S4/E7 work. Backend preview repair cannot claim complete extraction ownership or live browser certification.
