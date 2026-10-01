# Extraction preview feedback readiness

Status: Complete - read-only readiness; implementation held
Owner: recording_controls
Date: 2026-10-01

## Written bounded brief

- READ-ONLY follow-up to your completed extraction-preview-accessibility-audit.md. Keep all extension source/test paths FROZEN during root integrated full45050 and scoped57017; no new implementation release.
- Read only exact apps/extension/src/panel/extraction/panel.ts and read-recovery/createExtractionReadRecovery.ts, plus your prior own report. Use parent Current State for isolated t224/Claude rules. No rereading unrelated background/runtime/browser state.
- Establish actual loading/result/empty/read-error/retry/confirm/cancel status announcements from integration wiring: what changes visible text/live region, operation eligibility, retained draft/focus and session ownership on redraw. Trace exact setters in these two files rather than presume announcements from isolated preview components.
- Distinguish source-confirmed user feedback or inaccessible action defects from conditional native browser timing/unknown APIs. Existing session binding and uncertainty feedback must remain intact; do not reopen backend receiver/authority/idempotence claims.
- If a needed direct UI declaration was not in the prior four reads, report missing boundary rather than expand. Recommend at most one exact source/NEW test partition with acceptance criteria and compatibility, or record no additional defect.
- Write only this report progressively. No source/tests/assertions/config/baseline/shared docs/commits/checks/broad/live/provider/browser/Lab/panel operations or private data inspection. Freeze report for root review when complete.

## Current State

Read-only integration tracing is complete in exactly panel.ts and read-recovery/createExtractionReadRecovery.ts, using the preceding four-file audit for element declarations. All extension product/tests remain frozen. Only this report changed; no check, browser, provider, private-data, backend or panel-management operation was executed. Prior accessibility report remains frozen. One bounded preview-feedback implementation partition is proposed, not released.

## Actual user feedback trace

| Journey | Visible setter / operation behavior | Announcement evidence and limits |
| --- | --- | --- |
| Initial mount read | recovery.refresh(true) reads the current session. applySession sets the pick prompt or Check the columns, then confirm. A recovered picking/picked session opens the sheet. An initial failure leaves the sheet closed and creates an entry recovery ticket. | The prompt goes into existing role=status. Hidden initial failure is surfaced in visible entryRecoveryText, whose declaration has role=alert. No explicit initial-read loading sentence is set. |
| Begin picking / prepare | Open sets the pick prompt before beginPick. runBusy invokes run, which disables draft controls, Confirm, Cancel and Close while busy. A prepare/start failure creates a stage-specific ticket and notice. | Prompt is a status update, failures write the existing role=alert notice. No separate Preparing recording or Starting picker pending sentence is set. |
| Picked proposal | applySession retains the first proposal draft and filtered rows, stops polling, sets Check the columns, then confirm, and renders summary, table, pagination and preview note. | Status gives an actionable next step. Summary and result-count preview note are ordinary text, not live regions. |
| Column edit / automatic preview read | edit retains only permitted row keys synchronously, redraws, and invokes refreshPreview only when the shown-source-key selection changes. That read does not runBusy. Existing draft controls and Confirm remain usable; privacy erasure precedes the await. | Fresh automatic read calls onChange, but it only invokes drawRecovery. With no failure ticket, no retry button or loading sentence is shown. No aria-busy is set on the preview. Current preview text may therefore show retained counts or No preview was read for these columns while the replacement read is pending. |
| Successful preview read | acceptPreview filters returned rows against the current draft and renders the table. renderPreview says Showing N of M items or No preview was read for these columns, plus excluded/stale column explanation. | The visible count/empty sentence changes in plain previewNote; it is not written to status/alert. Actual assistive-technology announcements are unmeasured, but no live annotation exists for this local result feedback. |
| Session/preview read failure | Recovery creates a current ticket, stops polling for session-read failure and invokes showError; that writes notice text and unhides it. Preview failure retains the draft and already filtered rows. | Visible role=alert notice explains the failure. Initial hidden-sheet failure additionally populates the visible entry alert. Do not describe actual read errors as silent. |
| Retry | drawRecovery creates one native button with Retry reading item, Retry preview, Try starting again or Retry picking item. While pending it is disabled and reads Refreshing preview... or Trying again...; its visible recovery parent receives aria-busy=true. Ticket identity must remain current; an obsolete captured button/ticket cannot retry. | Failure alert remains while retry is pending; successful stage recovery clears only the owned error. Changing the button text and recovery parent busy state is source-confirmed. Native announcement timing is unmeasured. Busy is applied to the retry parent, not the actual preview region. |
| Confirm | Requires non-busy draft and bound identity. Settles raw field names at explicit commit, captures the identity, advances epoch, resets recovery and runs the issued confirm. Success erases draft/raw/rows, leaves the sheet open, and writes counts/pages/limits or a truthful no-records receipt to status. Legacy missing outcome says The extraction is recorded. Failure retains the settled draft and identity and shows the alert. | Successful receipt is persistent visible role=status and existing confirmed behavior is preserved. During the request, controls are disabled but status stays at its previous prompt; no explicit confirming sentence is set. Re-enabled Confirm supplies the existing failure retry path; no cancellation/idempotence guarantee is inferred. |
| Cancel / Close / Escape | Without a bound identity, close is local. With identity, cancel captures it before erasing raw draft/rows, resets recovery, sets Cancelling extraction..., and runs the bound cancel. Failure keeps that identity so Cancel/Close can retry. Busy prevents dismissal; success closes and restores focus through the existing focus helper. | Cancellation has explicit pending role=status; failure uses the alert. Closing itself is not a receipt. Captured identity and immediate erasure must remain intact. |

## Ownership, draft and focus preservation

Session and preview operations are separate. Recovery currentness checks epoch plus bound identity object; preview additionally checks its own operation and a captured selection key. A selection change supersedes older preview observations. A failed preview retry reads the current selected columns rather than resurrecting excluded row values. First session binding adopts a frozen real identity without resetting prepare progress. Missing bound preview session is routed through acceptSession(undefined, false), which closes the visible sheet and retires its draft instead of adopting a different session. These are presentation-lifecycle observations, not backend authority proof.

Raw field typing is stored independently, supplied on redraw and settled only on blur/explicit Confirm. Generation/epoch checks reject detached row callbacks. drawRecovery and render use dialog.render so redraws retain the existing focus-repair behavior; this follow-up does not reopen the previously identified cross-control selection issue. A retry button is replaced only when its ticket changes and moved between entry/sheet containers as visibility changes. Pending retries keep the same button with a disabled state. Do not add automatic sheet opening for an initial read failure.

## Confirmed additional gap and proposed single partition

The automatic preview refresh has no pending feedback near the preview, and completion/empty feedback is written only to a plain span. This can present an interim retained/empty sample as the current outcome while work is still pending. Existing failure alerts and Retry controls already cover read failures; preserve them. No accessible-action defect is asserted for native Confirm/Cancel labels or retry labels.

Proposed exact product ownership:
- apps/extension/src/panel/extraction/panel.ts
- apps/extension/src/panel/extraction/panel-elements.ts
- apps/extension/src/panel/extraction/read-recovery/createExtractionReadRecovery.ts

Proposed exact NEW owning test:
- apps/extension/src/panel/extraction/tests/preview-feedback.test.ts

Expose an additive local previewPending observation from recovery.state(), computed from the current owned preview operation and selection. Preserve the existing ticket and pending fields/semantics used by stage Retry. Give the existing preview note a polite, atomic status annotation and update its local sentence when automatic refresh begins or settles; all recovery onChange transitions must reach that local setter, not only table redraws. While pending, say Refreshing preview... alongside an accurately identified retained sample when one exists; do not claim completion or a fresh empty result. On successful settlement present the actual bounded sample/empty sentence. On failure explicitly identify any retained sample as not refreshed while retaining the existing owned alert and Retry preview action. Current preview failure ownership must remain distinguishable from a newer selection's read; do not copy an arbitrary last error into a new preview.

This is local observation/presentation only. Do not make preview requests globally busy, block editing/Confirm waiting for preview, change backend counts or wire types, clear raw typing, retain excluded values, broaden the five-row sample, alter receipt/cancel behavior, restart polling or open the hidden sheet on read failure. If state requires an additive preview-failure observation, scope it to current selection/epoch/identity and preserve existing tickets; do not expose generic operation internals.

Tests first against mounted actual panel and actual recovery: a deferred automatic read visibly marks the preview pending; an unchanged count success still transitions through pending to an announced complete sentence; a true empty success is distinguished from pending; failed refresh retains filtered draft/raw intent, adds failure/retained wording and keeps Retry preview; retry pending/success/failure updates the same local status and existing button rules; a newer selection fences older success/failure/finally updates; all-excluded erasure remains immediate; initial hidden read failure remains an entry alert without opening; receipt and bound-cancel behavior remain unchanged. Assert role/aria-live/aria-atomic/busy state and current text without claiming that fake DOM proves screen-reader speech.

The existing mounted-panel test/support bodies were not read in this audit. Before execution root must release only the needed existing fixture support reads and preserve original assertions; no old-test or harness edit is implied. This partition overlaps proposed static-table semantics in panel-elements.ts, so root must serialize shared-file ownership or consolidate a new explicit brief. It does not overlap dialog-focus.ts selection repair.

## Verification limits

No test execution or native announcement was observed. The exact two source reads establish visible setters, button eligibility and local operation fencing. Client messages, backend authority, receiver retirement, issued mutation cancellation and confirmation idempotence remain outside scope. Preparing/confirming lack explicit pending sentences, but no second fix is proposed in this bounded report. Root owns any release, source review and independent validation.
