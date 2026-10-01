# Extraction read recovery plan

Status: Complete (released implementation); exact six product/test paths FROZEN for supervisor verification
Owner: recording_controls
Date: 2026-10-01

## Written brief

- Scope: plan E3/E4 from extraction-keyboard-recovery-audit.md after the frozen E1/E2/E5 implementation. Read parent Current State and those two extraction reports only, then exact extraction panel.ts, panel-elements.ts, and directly owning panel/preview-reread tests as needed.
- Own only this report. Product, existing tests, other reports and shared documents remain read-only; no commits, broad gates, browser, provider or actual storage/data access.
- Specify stage-owned explicit Retry: existing-session read retry must not prepare/start another pick; distinguish genuine prepare/start failures. Preserve 600ms polling, recorded receipts, immediate local cancel erasure and busy/focus contracts.
- Specify preview request identity checked on success, refusal and cleanup; newer selection and newer success must silence older failures. Clear only the preview channel's error; retain privacy-narrowed last-good rows and unrelated confirm/cancel errors.
- Assess panel.ts module budget (currently 435 lines): propose exact cohesive helper/export/barrel files if necessary, without changing source. Partition by exact files, serial with panel draft work.
- Return a concrete implementation brief, synthetic reproduction matrix and narrow command plan; clearly distinguish source findings from executed verification. Do not begin implementation until supervisor release.

## Findings and proposed implementation

### Supervisor implementation release

Status: Active implementation (six exact paths listed below released after extraction checkpoint9126ba06).
Root approved visible error/recovery near the entry for hidden initial-restore failure; do not open a sheet automatically on failure. Explicit Retry reads the existing session, opening only a recovered picking/picked session under normal policy. In-sheet failures retain their current sheet recovery placement. Use fixed local defensive feedback for injected unexpected errors while preserving existing fulfilled background refusal text contracts. No actual data inspection, new wire identity or host disposal.
Implement the listed six-path extraction read-recovery unit tests-first; all other source/tests remain protected, particularly field-row and existing focus/privacy assertions. Root separately owns client.ts and new tests/client.test.ts, so never edit those. Keep locks/generations at actual dispatch boundaries and preserve raw-name generation guards. New helper directory requires its barrel; no duplicate orchestration or exported second capability. Worker owns only this report additionally; record actual failures and checks as they happen, then freeze. No broad gates/commits/browser/provider/panel/shared-doc edits.

### Source findings confirmed; no new execution claim

Current frozen panel.ts is435 lines. refresh() at185 owns only readingEpoch; its catch stops polling and shows fail(), but panel-elements contains no current Retry. Open entry refuses while sheet is open. A failed picking-session read therefore cannot resume in place; successful reopening is a different path that requires recreating/cancelling the session. The existing prepare-refusal test checks only that Close remains operable, not Retry. Preserve its exact error sentence compatibility.

rereadPreview() checks epoch/selection key only on success. Its catch checks epoch alone, so an old narrower-selection read refusal can overwrite current successful feedback. Successful preview updates rows but never clears the error: applySession owns unconditional notice clearing, and picked proposals stop ordinary polling. Existing preview-reread tests exercise privacy/client-background fields, not the panel's adverse-order error channel.

The new draft unit's local rawNames + field generation correctly preserve typing and retire callbacks. Keep those source/test contracts frozen until this follow-up is explicitly released; do not rediscover or redesign them. E3/E4 requires request identity and notice provenance, not a different D12 filter.

### Recommended exact six-path partition (requires explicit source release)

1. apps/extension/src/panel/extraction/panel.ts ? integrate lifecycle/selection/notice callbacks, current retry UI and existing busy mutation gate. Move current refresh/reread/picker polling orchestration into the coherent helper below rather than adding a second channel implementation.
2. apps/extension/src/panel/extraction/panel-elements.ts ? add one bounded recovery action host/button location near current alert, with distinct visible action text. Preserve existing ids/labels/Confirm/Cancel and modal structure. No style file required.
3. NEW apps/extension/src/panel/extraction/read-recovery/createExtractionReadRecovery.ts ? one exported factory owning recoverable pick/read operations, polling, attempt identities, retry tickets and preparation milestone for this UI lifetime. Framework-independent generic promotion is inappropriate; this module consumes extraction session/preview contracts.
4. NEW apps/extension/src/panel/extraction/read-recovery/index.ts ? narrow directory barrel for the factory and its local types. Import from ./read-recovery in panel. Existing extraction/index.ts needs no public export: helper is implementation-only.
5. NEW apps/extension/src/panel/extraction/read-recovery/tests/createExtractionReadRecovery.test.ts ? direct synthetic operation/notice/timer tests.
6. NEW apps/extension/src/panel/extraction/tests/panel-read-recovery.test.ts ? actual mounted panel with current fake/runtime deferred replies and visible retry actions.

Existing client/view-model/confirm-payload/preview/table/field-row/dialog-focus/shared wire/old tests/shared fake remain unowned/unchanged. If mounted integration exposes a genuine fixture contract gap, report it for a precise release instead of editing the helper silently. Sequential with the completed draft unit because panel.ts overlaps. Do not create helper source before approval of this six-path ownership.

### Cohesive helper contract

Factory accepts injected readExtractionSession, startExtractionPick, optional prepare and narrow hooks: current epoch; current allowed-column selection; busy state / existing foreground run gate; acceptSession(session, restore); acceptPreview(session); showRecoveryError(ticket, error); clearRecoveryError(ticket); and onRecoveryChange(). No actual browser/page/data/storage access lives in helper. Confirm/cancel remain panel-owned mutations, not helper capabilities.

Local methods: beginPick(), refresh({restore?}), refreshPreview(selection), retry(ticket), reset(), startPolling(), stopPolling(), state(). state exposes only current pending stage and optional retry ticket/action text; it holds no preview rows, raw draft strings, durable project/session truth or tokens. Existing600ms poll callback uses refresh; duplicate reads for the same current epoch do nothing. Poll starts only for current picking session, stops on picked/recorded/close/cancel/failure. No faster polling or autonomous retry is added.

Each channel owns operation OBJECT identity with captured panel epoch and channel revision; preview also captures a collision-free selection key (JSON of source-key/handling tuples, not joined text). List/session, preview and pick-stage requests have independent locks. Current checks occur before dispatch, after await, before accept/error hooks, after reentrant notification and in finally. Old finally clears only its exact object, never a newer same-epoch operation. Reset invalidates local channels/markers and stops polling; it does not claim cancellation of issued messages.

Keep the helper small enough to inspect; move, do not duplicate, original refresh/reread and timer routines. Panel retains domain drafting, capture sentence, payload generation and authoritative local erasure; helper retains request/retry lifecycle. Expected panel line count decreases after moving roughly80 existing lines, leaving integration/notice/render budget. No baseline/config relaxation is authorized.

### Stage-owned retry rules

- Existing session read failure: visible Retry reading item. Retry calls getSession only, preserves settled/raw column intent and privacy-narrowed confirmed rows, does not prepare or start a pick, and resumes unchanged600ms polling only if a current picking session is returned. A confirmed missing session closes normally; recorded never reopens a modal. Initial restore failure while sheet hidden must not silently portal an orphan modal: provide the current action near visible entry/error placement, or reveal failure only when user explicitly opens existing-session recovery. This rendering policy needs root choice before implementation.
- Preview failure: visible Retry preview. Retry reads the CURRENT allowed columns, not the failed attempt's stale selection. It never prepares/starts/records and never restores stale/excluded cell values. Keep last narrowed good rows on rejection. Confirm remains an explicit independently gated action; do not freeze all editing for a read request.
- Prepare failure: visible Try starting again. No start was issued after failed prepare. Explicit Retry may re-run prepare once through the same existing busy/epoch gate, then start once only if current. Preserve normal prepare callback user-facing sentence and no duplicated prepare during unrelated read retry.
- Start failure: visible Retry picking item, with prepare-completed milestone retained for this pick epoch. A refused/rejected start may have issued work; first re-read the existing background session. If picking/picked exists, resume/apply it without another start; if recorded, follow normal recorded path; if none, retry start only, not prepare. If that verification read fails, offer verification retry without silently starting again. No claim that failed transport proves no background pick exists.
- Confirm/cancel failure remains the original panel-owned retry/erasure rules. Starting a read retry must not clear their notice or draft/receipt. Close/Escape busy rules unchanged. A recorded receipt has no stale read-retry action; clearing a local receipt is not redefined as background cancellation in this unit.

Use descriptive visible action text that explains what is retried; helper channel names are implementation details, not product copy.

### Notice and retained-action ownership

Retain existing extractionNotice and its important existing prepare/cancel/Confirm text assertions. Associate each written notice with a local owner reference. Session/refusal/preview/pick helper tickets own only their notices; foreground confirm/cancel failure writes a distinct owner. clearRecoveryError(ticket) clears the notice ONLY if that same owner still owns it. A preview success can clear its own previously displayed preview failure, while preserving newer mutation/refusal feedback. New selection invalidates obsolete preview error/ticket; old success/refusal/catch cannot put it back.

Retry tickets bind epoch + stage + channel revision + expected failure instance; retry requires exact current ticket and nonretired dialog. Duplicate activation sets the lock before notification/dispatch. Old detached Retry after cancel/capture/new pick or newer error must do nothing. Re-key action control when its ticket changes; retain current control while its retry is pending and disable that control. Do not replace entire dialog/fields just to set a loading indicator. If a retired button owned visible extension focus, existing dialog.render repair may select status/current control; hidden/page-focused documents never reclaim focus.

Successful session application clears only the matching session/refusal error, not all local notices unconditionally. Current preview success clears current preview's owned failure; failed reads preserve rows and exact raw input intent. Current local loading feedback describes reading/retrying; it is separate from captured receipt and never overwrites a completed receipt after epoch reset.

### Tests first / meaningful original failures

Mounted tests first against frozen source should reproduce (a) picked/picking getSession error with no direct Retry and stopped polling, (b) exclude A then B, newer preview succeeds before older refusal, obsolete failure becomes visible, and (c) current preview failure followed by current success leaves old notice. Observe those failures before product implementation, using synthetic rows only.

Pure helper matrix after helper is introduced:

- Duplicate current read/retry sends once; current rejection releases its lock and supplies one ticket; success permits future manual/poll reads.
- New preview selection/op accepts current success, rejects older success/refusal/rejection and old finally; repeated same-selection operations still require operation identity.
- Old preview failure after newer success never publishes; success clears only its own failure provenance; newer unrelated notice cannot be cleared.
- Same panel epoch new request remains locked after old finally; new pick epoch permits fresh current work without stale suppression.
- Retry ticket retained from old epoch/stage/error refuses before dispatch; duplicate and reentrant notification activation refuse before request; reset from hook prevents unissued work.
- Session retry sends no prepare/start; prepare retry invokes prepare/start once; uncertain failed start verifies existing session before resend; successful prepare is not repeated. Verification failure stays retryable without sending start.
-600ms timer cardinality at most1; stops on failure/reset/picked/recorded; retry current picking resumes one timer without immediate duplicate read. Issued mutations are never claimed cancelled.

Mounted matrix includes:

- Transient picking read failure then direct success resumes polling without prepare/start; restored picked draft retry preserves raw name/caret and narrowed rows.
- Two selection requests resolve/refuse adversarially; current Retry uses current source keys only and never reintroduces excluded/stale samples.
- A current preview error followed by retry success removes only preview error; failed Confirm/cancel feedback survives any obsolete read success.
- Stage-specific Retry/disabled loading acknowledgement, native keyboard button activation, busy duplicate callbacks, old detached action vs new epoch/error.
- Prepare/start failure recovery, no repeated recording preparation on start retry; current session verification before resending uncertain start.
- Confirm while preview pending, successful receipt, immediate cancellation erasure and failed cancellation retry remain original; old retry/completion cannot clear/refocus receipt.
- Browser-page focus and hidden extension document never reclaimed by retry/error redraw; existing IME Escape/inert isolation/Firefox recreate tests remain unchanged.

### Narrow command plan after explicit release

Create TEMP/codex-t224-extraction-read-focused.mjs (external esbuild harness, css empty, normal extension package dependency resolution) for new helper + mounted suites first, then unchanged existing extraction panel/dialog-focus/preview/preview-reread/confirm-payload/view-model + frozen draft/field-row suites. Use ignored scoped bundle directory. Each test execution goes through Git Bash build-slots/heavy.sh with descriptive codex t224 extraction read label.

Create TEMP/codex-t224-extraction-read-scoped-types.mjs using actual extension tsconfig and exact six roots; no diagnostic exclusions or strict-option relaxation. Report owned/global AND unowned dependency diagnostics. Check exact diff whitespace and protected source/old test comparisons. Root independently reviews source/results and runs combined/full/types/build/structure after Chat/other lanes freeze. No browser/provider/panel operations authorized by this plan.

### Open integration choice / limitation

The initial hidden mount-read failure has no visible modal to contain the error/Retry. Recommend a visible recovery status near entry for a failed restore, then opening the sheet only on explicit Retry if a real session is recovered. This needs a precise panel-elements placement decision in the implementation brief, but requires no wire change. Do not start a fresh pick automatically merely because the mount read failed.

This local recovery controller is not a durable extraction owner/session proof. Frontend session shape/context limitations and host disposal remain separate investigated work; no new wire fields or blanket body observers are proposed. No code/test/heavy verification was executed for this plan. Only this report changed; six-path implementation remains held until root explicitly releases it.

Implementation progress: meaningful corrected original reproduction native1,0/3 passing,627.6012ms. Corrected unsupported fake id-selector assumption before product edits; missing Retry, obsolete preview failure and uncleared current error all confirmed. Exact six paths now active. Root released local extractionRefusal provenance on its owned client, preserving authoritative refusal text while unexpected helper errors use fixed feedback. No client/old test/helper fixture changes by worker.

Progress checkpoint: initial mounted existing/new gate69 native0/654.4835ms. Added pure channel tests; observed86/87 native1/680.8191ms with retained timer callback reading after reset; fixed with captured timer owner/epoch. Expanded mounted/pure gate98 native0/762.4222ms. First scoped6roots found one NEW-test FakeElement.closest typing error, corrected by accessing concrete existing dialog-world element; no casts/shared-fake changes. Current panel419lines (down from435), helper136 before final clear-hook guards. Provenance tested against supervisor-owned actual tagged client. Final boundary/typing checks pending.

## Frozen worker return ? extraction read recovery

Completed only the six released paths: panel.ts; panel-elements.ts; read-recovery/createExtractionReadRecovery.ts; read-recovery/index.ts; read-recovery/tests/createExtractionReadRecovery.test.ts; tests/panel-read-recovery.test.ts. This report is the only additional authored path owned by this worker. No client, existing test, shared fixture, field-row, focus, preview, confirm, view-model, wire or Core edits.

Implemented visible hidden-entry recovery without automatic modal opening; in-sheet stage-specific Retry with stable disabled pending control; current read/preview operation identities and retained-action tickets; notice ownership; fixed unexpected-error feedback with supervisor-owned tagged fulfilled-refusal compatibility; prepare milestone and existing-session verification before uncertain start resend. Poll callbacks capture their timer owner/epoch, and stale operations/finally/clear hooks cannot accept, dispatch, clear newer feedback or release newer locks. Existing raw names/caret and immediate privacy narrowing remain panel-owned; recovery orchestration moved out of panel, now419lines, to cohesive helper141lines.

Final compatibility reproduction: restored picked state without proposal must follow original sheet/polling policy. Before the narrow restore-condition fix, the ten-suite gate was101/102 passing, native1,836.8642ms; added mounted test caught a hidden sheet while polling. Extended restore condition to picked as well as picking/current draft. No start or preparation is issued by restore.

Final executed validation (Git Bash build-slots/heavy.sh, external TEMP harnesses):

- codex-t224-extraction-read-focused.mjs: ten suites,102/102 passing, native0,850.7576ms; no skipped/cancelled. Original/frozen66 plus new20 pure operation tests and16 mounted recovery tests. Original assertions and shared fake fixture remain unchanged.
- codex-t224-extraction-read-scoped-types.mjs: actual extension tsconfig, exact six owned roots, native0;0 owned/global diagnostics,0 unowned dependency diagnostics. All dependency diagnostics inspected; none filtered. Earlier one new-test FakeElement.closest typing diagnostic corrected through concrete existing world lookup.
- git diff --check on exact released source/test paths: clean. Protected field-row, frozen draft tests, dialog-focus, preview, confirm-payload, view-model, old owning tests and shared dialog-dom fixture have no HEAD diff. Client is separately supervisor-owned and intentionally excluded from that protected comparison.

Prior reproduced failures and progressive69/87/98/101-test observations are recorded above. Current source/tests are frozen; no extra improvements are included. Root independently reviews and executes coordinated combined/full/types/build/structure checks. Actual client-provenance integration is exercised synthetically, but cross-lane completion remains provisional until supervisor gates. No broad, live browser, provider, panel server, private data, host disposal, durable session identity, commit or push operation was performed by this worker. Existing frontend ownership/session-proof limitations remain separate follow-up work.
