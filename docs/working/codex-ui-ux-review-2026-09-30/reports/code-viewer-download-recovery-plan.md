# CodeViewer download resource recovery

Status: Complete (implementation independently verified and locally checkpointed Core1d4d2000)
Owner: senior supervisor
Date: 2026-10-01

## Confirmed finding

Implementation completed: root reproduced three allocated-URL cleanup failures after correcting an unsupported fixture matcher, then verified new download5 plus unchanged CodeViewer4/Clipboard10 (19/native0) and strict two-root types0. Exact chronology and later combined55 tests are in twelfth-supervisor-verification.md. Native browser download completion remains unverified.

Root read actual Core apps/web/src/features/programs/components/data/CodeViewer.tsx and existing owning tests/CodeViewer.test.tsx. downloadText allocates an object URL, then creates/configures/clicks an anchor, then revokes it only on success. Any thrown anchor creation/configuration/click error skips revocation while the caller catches and displays existing download failure feedback. This is a directly confirmed resource lifecycle path, not a measured browser leak or failed native-download claim. Successful-path URL release already exists and should remain exactly once.

## Exact later implementation

Root owns CodeViewer.tsx and NEW same directory tests/CodeViewer-download.test.tsx only. Use a try/finally around work after successful URL creation so every allocated URL is revoked on synchronous anchor failure as well as success. Allocation failure has no URL to revoke. Preserve filename/source arguments, Blob/download content, existing success/failure alert vocabulary, native download contract and all existing copy/search/wrap tests. Do not add speculative MIME changes, action leases, timers, global handlers or public test hooks.

Meaningful tests first through actual mounted CodeViewer: URL creation succeeds then synthetic anchor.click throws, and document.createElement throws; require allocated URL revoked once and existing failure feedback. Normal download sends current synthetic source/filename, clicks once, revokes once and produces existing started feedback. Allocation rejection creates/clicks nothing and revokes nothing. Existing four Clipboard/CodeViewer assertions remain unchanged. Synthetic events prove synchronous cleanup/feedback, not actual browser download completion.

Do not run CodeViewer tests during active Tooltip source writes: CodeViewer imports the actual Tooltip dependency. After Tooltip freeze, root writes/tests this two-path unit, runs owning new+existing+unchanged clipboard suites and exact actual-config strict roots, then full Core integrated gates after floating source freezes. No original assertion/config/baseline/style changes; all heavy runs use heavy.sh. Root updates authored docs only if behavior is substantial. No browser/Lab/provider/panel/private state or merge/push.

## Return

Only this report changed. No reproduction executed or source/test edits. Plan is narrow and ready after dependency freeze; twelfth verification owns continuing supervisor evidence.
