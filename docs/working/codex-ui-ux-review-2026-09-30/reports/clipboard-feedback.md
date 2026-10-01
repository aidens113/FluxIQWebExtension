# Clipboard feedback and lifecycle

Status: Active; source and focused tests implemented, scoped/broad gates pending.
Owner: supervisor

## Current State

Original real SecretKeys consumer reproduction:3fail/1pass, native1,2.60s.
Pending, missing and rejected writes falsely reported Copied; expiry already
closed the reveal correctly. Fixtures and exception strings are synthetic.

New controls/ClipboardButton owns clipboard availability, synchronous duplicate
lock, pending/acknowledged/failure state, value-owner and unmount fencing. It
shows manual-copy guidance for denied/missing/rejected clipboard access and
never renders exception contents or the supplied value. Both revealed secret
and manual TOTP key use it; the obsolete shared void helper is removed. Reveal
expiry/key-change ownership remains in SecretKeys. Dismissal/expiry prevents
late clipboard status publication; an issued browser write is not cancellable
and no claim is made to revoke or clear the system clipboard.

Exact Core files: controls/ClipboardButton.tsx, controls/index.ts,
controls/tests/ClipboardButton.test.tsx, live-views/shared.tsx,
live-views/secret-keys.tsx, live-views/identity-access.tsx,
live-views/tests/secret-copy-feedback.test.tsx. New code imports the components
barrel and keeps clipboard responsibility out of live-view shared helpers.

## Validation

First corrected consumer+existing secret/identity cases59411:3files/13passed,
native0,9.22s. Expanded component9 cases include acknowledged duplicate lock,
missing APIs, sync/async failure/retry, obsolete activation/value replacement,
pending response ordering, unmount and empty value. Final4file run50613 passed
22tests, native0,10.66s. Scoped types69042 found one test-only React act callback
returning VitestUtils; callback now awaits inside a void block, with unchanged
assertions. Corrected scoped12321 completed native0, no diagnostics.

Remaining source audit: CodeViewer silently ignores missing clipboard; Inspector
copy acknowledgement can follow old selection; StateRawPanel has an unchecked
clipboard access and late acknowledgement after collapse/context change.
Problems export already catches availability failures. These remain later
scoped consumers, not claimed repaired by this increment.

Scoped strict typing passed12321. Authored current-system paragraph and local
Core checkpoint0738bc58 are saved. Corrected consumer4 rerun passed native0,
2.22s; combined supervisor110 includes all22 clipboard cases. Fourth full web
gate1942pass/1source-only Compute request contract failure requires that owning
test correction before whole batch completion. Web typing passed; production
final result pending. No browser/system clipboard or real private state exercised.
