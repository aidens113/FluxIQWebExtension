# panel-key-push-activity report

## Outcome
Partial. All three code changes and their tests are written. None of the acceptance commands has run: my queued vitest run (label t925-panel-key-vitest, task burj1m299) never got a slot. Slot hcc2-worker held it (expires about 1h after 04:46) and 6 entries were queued, mine second. Nothing was typechecked or tested.

## What changed (all under Core fxwork/t925/!FluxIQ/apps/web/src/features)
1. panel-changes: `model-access` is accepted on the one shared stream (types `PanelChangeEventType`, `PanelChangeListener.modelAccess?()`, `connection.ts` EVENT_TYPES, parsing like `gateway`, same version numbering and gap detection). No second stream, no timer.
2. model-keys: `createPanelModelKeysPort(secretKeys, changes = sharedPanelChanges)` gains `subscribe(listener)` (calls `listener(null)`), and `onChange` listeners also hear the event. A re-open of the stream (a later `opened`) also reads again; the first `opened` is skipped (the card reads at mount). `readCoreModelAccess` accepts `no_credit` (status, lastCall outcome, needs key, lastCall must match).
3. security/activity: `ActivityEntry` gains optional `requestId`, `errorKind`, `ran` (outcome row). New `model/join-outcomes.ts` (`joinOutcomes`), applied in `ActivitySection` over all loaded pages. Outcome rows are hidden and give their allowed decision row `result` and `errorKind`. Wording: succeeded keeps "added/replaced/removed"; failed reads "could not add|replace|remove a key [because <plain reason>]" (codes mapped: provider_refused, no_credit, provider_unreachable, no_key, key_unopenable, not_permitted, authorization.forbidden; unknown or `error` gets no reason); no outcome row keeps "tried to".
Tests added or updated: panel-changes/tests/connection.test.ts, model-keys access and port tests (no_credit; event reaches subscribers and onChange; re-open), security/activity/tests/activity-section.test.tsx (join by request id for succeeded, failed, no outcome, denied; shape; section). One old test changed: failed now reads "could not add a key", and `requestId` is no longer stripped by shaping.

## Commands run
Only the queued `pnpm --filter @fluxiq/web exec vitest run src/features/panel-changes src/features/model-keys src/features/security` (not started). Web check and structure-audit not run.

## Not verified
Everything: types (I cast lastCall outcome because the other worker's `CoreModelAccess.lastCall.outcome` type may still lack `no_credit`), the test expectations (the badge text "No credit" in my port test is a guess from ui-components words, check it), `modelAccessFromCore` handling no_credit, structure audit (new file join-outcomes.ts; one export per file).

## Open contradiction (needs lead)
t928's audit route does NOT send `requestId` or the outcome to the panel. `apps/web/src/app/api/security/server/shape-activity-entry.ts` builds entries from an allow-list without them, and says request ids never leave the server. So today an outcome row would appear as a second plain entry, and the join cannot work live until the server (W/app, not mine) sends `requestId` on each entry and `ran: {result:"succeeded"} | {result:"failed", errorKind}` (from `record.outcome`) on outcome rows. Alternative: the server joins and sends `result` and `errorKind` on the decision row (the client already reads `result`, and now `errorKind`), and drops outcome rows. Pick one; my client supports the first and the second needs only `errorKind`.
