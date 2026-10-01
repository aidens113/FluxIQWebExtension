# Database Manager authorization UI

Status: Active; focused correction verified, broader coordinated gates pending.
Owner: supervisor

## Current State

Core source ownership is limited to live-views/database-manager.tsx and its new
owning tests/database-manager-authorization.test.tsx. Backend security and grant
contracts remain unchanged. Synthetic fixtures only.

Original six cases failed after correcting the local StatusText test harness:
duplicate activation, stale dialog/store completion, credential carryover, absent
local refusal feedback and expired-grant acceptance. The earlier harness-only
window.dispatchEvent failures are excluded from reproduction evidence.

The UI now locks submission synchronously, disables credential edits while
pending, accepts only a nonempty unexpired grant, and shows a fixed safe local
failure with retry. Cancel closes the UI and clears credentials; a late server
grant is discarded, without claiming server-side revocation. Recheck epochs and
API identity guard old callbacks, scope changes, closed dialogs and unmount.
Fresh scope/open resets credential/error/pending state. Obsolete failures cannot
unlock a newer pending submission.

## Validation

Initial corrected run: two files,8/8 passed, native0,8.14s. Expanded run1815:
two files,11/11 passed, native0,8.07s, including request rejection, obsolete handler
and old failure while a newer authorization remains pending. Existing countdown
and bounded list/detail contract tests pass. Real modal DOM is mocked at its
composition seam; live focus/browser behavior was not exercised.

Final expanded focused run passed16/16, native0,7.29s:14 authorization cases
and2 existing contracts. Added API-scope accepted-grant clearing and obsolete
read guards in the same Database Manager source: previous scope grants/record
state are cleared, and rendering derives sensitive lock state from the current
API owner before passive effects reset state. The domain test fixture initially
returned a grant for list-records; that harness-only failure was corrected to the
actual endpoint page shape, without weakening expectations. Earlier scoped tsc
passed; final scope changes require another observed check.

Pending: final scoped typing, coordinated strict/web
suite/build/structure checks after onboarding and Runtime workers freeze, and
authored architecture update. Record loading, metadata and unrelated record
inspection rejection behavior remain separate follow-on work.
