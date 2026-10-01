# Logout acknowledgement and recovery

Status: Active — source fixed; focused tests/scoped types passed; full gates pending
Owner: Codex supervisor
Date: 2026-10-01

## Findings and decision

Original AuthStatus awaits fetch but redirects on every fulfilled HTTP result. It has no pending guard or rejection feedback. Two targeted regressions failed on original source: duplicate activation issued two POSTs; HTTP503 redirected instead of retaining the workspace.

AuthStatus now locks synchronously through the request, disables the menu action, announces pending state and navigates only for response.ok. Refusal/rejection produces fixed local alert and Retry sign out without reading or exposing response/error contents. Component lifecycle owns the response; obsolete completion and captured activation after teardown cannot navigate or issue a second request. The issued server mutation is not described as cancellable. Cosmetic display-name/role changes do not define an authentication identity boundary.

Account link and role remain present. No login/setup, auth API, backend, styles, session or shared Menu behavior changed. Tests mock only Menu interaction; they do not certify browser focus or visual layout.

## Validation

- Original targeted reproduction: 2 failed, 4 excluded by test-name selection; native exit1, 1.96s. All six tests are ordinary unskipped regressions.
- Corrected focused AuthStatus6 plus unchanged AuthShell26: 2 files, 32 passed, native exit0, 2.41s through the shared heavy wrapper.
- Scoped types using the actual web tsconfig with incremental disabled passed, native exit0. No compiler settings relaxed.
- Final full suite, production build and structure checks remain pending while disjoint sixth-batch workers implement.
