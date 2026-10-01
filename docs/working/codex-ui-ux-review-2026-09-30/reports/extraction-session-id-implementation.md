# Extraction real session binding implementation

Status: Active
Owner: recording_controls
Date: 2026-10-01

## Written brief

- Supervisor source release: extension full2028/native0/140843.4272ms, types7103/native0/31290ms, build45496/native0/172562ms and structure94504/native0 have all closed. Read parent Current State and completed extraction-session-id-adoption-plan.md; execute the exact released scope now. Backend source checkpoint86913bca is preserved.
- Exact downstream seven product paths: shared/extraction-messages.ts; panel/extraction/messages.ts, client.ts, panel.ts, read-recovery/createExtractionReadRecovery.ts; background/extraction/control.ts and session-store.ts, all beneath apps/extension/src. Preserve verified backend preview ownership.
- NEW owning tests: panel/extraction/tests/panel-session-ownership.test.ts and client-session-identity.test.ts; background/tests/extraction-session-identity.test.ts; panel/extraction/read-recovery/tests/session-identity.test.ts. Own only this report additionally.
- Explicit fixture-only release: panel/extraction/tests/panel.test.ts, panel-draft-recovery.test.ts, panel-read-recovery.test.ts, dialog-dom.ts; read-recovery/tests/createExtractionReadRecovery.test.ts. Adapt synthetic successful session/start identity and necessary injected signature setup only. Keep every original behavior assertion intact; report exact fixture changes and assertion comparison. All other original tests/support are frozen.
- Root accepts active-tab initial discovery from actual manager.status().activeTabId and new store lookup, explicit immutable real session ID/tab/form thereafter, no latest fallback from a bound missing/mismatched reply. Never use browser storage or infer authority from ID.
- New panel cannot preview/Confirm/cancel an unbound draft; pre-start Close is local-only. New lifecycle clears old raw/draft/rows/leases; first binding preserves successful prepare milestone/current operation. Same bound session refresh preserves edits. Current uncertain-start recovery verifies actual active-tab session before another start; acknowledge ambiguous other-surface ownership rather than claiming proof of issue origin.
- Start identity derives from real backend acknowledgement/current shared contract; synchronize any form addition explicitly, never fabricate anonymous IDs. Malformed/legacy identity cannot publish executable draft or rows. Existing count-only confirmation acknowledgements and numeric/provenance validation remain compatible.
- Keep low-level optional-binding calls and trusted backend omitted-ID Confirm/cancel compatibility deliberately; document older-client risk. This unit guarantees new production panel binding, not universal authorization or receiver fencing. Start/cancel/record receiver/idempotence remain held separate work.
- Tests first actual client/background/mounted adverse schedules from the approved plan, then owning extraction/client/recovery/draft/panel/control/confirm/boundary/privacy suites. Heavy wrapper and exact actual-config roots; preserve all original assertions, no compiler/baseline/harness weakening. Report all dependency diagnostics. Request exact extra path release before expanding.
- No shared docs/commits/broad gates/browser/Lab/provider/panel/private state. Record failures/results progressively, freeze all released paths and report precise limitations for root independent review.

## Worker sufficiency check (read-only; source release still HELD)

Brief is sufficient for tests-first execution of the accepted seven-source/four-NEW-test/five-fixture unit after root explicit release. Shared identity types can be imported through existing local/shared paths; no extraction/index or recovery barrel edit is currently required. Store tab lookup is explicitly included, and control/store preview ownership remains preserved/serial. Actual start form addition is explicitly synchronized in shared contract/control acknowledgement instead of invented in client. Existing optional low-level callers/client count/provenance tests and actual-background preview-reread may stay unchanged under accepted legacy policy.

Exact fixture scopes cover all known synthetic success gaps: shared dialog-world default start acknowledgement, old mounted picked/picking/ad hoc session identities, pure injected start return identity and optional expected-read identity setup. Original assertion bodies remain unchanged; new malformed/missing/mismatch/dispatch-identity behavior belongs in four NEW suites. No extra fixture path requested at this point.

Execution checks to retain: first identity binding cannot reset prepare milestone/op lock; successful same-ID recovery preserves raw/caret/rows; cancel captures its real selected identity before local draft/row erasure and retains that identity for failed-cancel Retry; no selected identity Close only cleans local UI. Bound missing/mismatch never becomes an implicit discovery fallback; ambiguous failed-start verification is explicitly limited to active-tab existing-session recovery, without issued-origin proof. Count-only confirmed acknowledgement remains valid when the request was bound.

Potential future scope requests will be made only if an actual new-test reproduction reveals one: no catch-all helper/barrel/old assertion/compiler/baseline additions authorized. No source/tests/checks/heavy/private/live/commits performed. Ready for explicit release; current gate closure is supervisor-owned.
