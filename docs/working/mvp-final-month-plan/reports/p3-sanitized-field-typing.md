# Native structured field typing - t315

Status: independently verified; task integration pending. Supervisor-owned task. Date: 2026-10-07.

## Scope and observations

Keyboard/type-text now selects focused sanitized-input for native number/date/time/datetime-local/month/week controls. Detached same-type native value acceptance preserves exact text; malformed prefixes are refused before editing. Synthetic key cancellation and beforeinput refusal are retained; native value setter/input/change commits once. Normal text/autocomplete character path and existing production type readback/redaction/submit permissions remain. No browser/debugger permission or Core source change.

## Validation ledger

- First fixture launch refused stale production extension before browser dispatch:98 build inputs had changed. This is not a behavior failure. Regenerated through owning build after current Core build.
- Real production Chromium fail-first then failed at requested1.5: actual type action returned failed because per-character native number assignment did not retain the value. Remaining fixture assertions had not yet run. ISO date/negative source mechanism was an inference at that point.
- Core dependency owning build0 (48.983s); not a full suite or Core source change. A working brief was briefly inserted into the paired Core document by an incorrect command cwd; moved it to downstream immediately, Core git status clean. No product file there changed.
- First post-fix real browser passed number/date/invalid/revert/cancel/readonly/text checks, then failed the fixture redaction assertion because the test itself embedded synthetic password text in commandId. Corrected to an ordinal-only ID; product validation was already redacted. Added real time/month/week/datetime-local and key cancellation checks.
- Product fix and final owning validation in progress. No panel/provider/full-suite actions.

## Limits

Immediate readback after synchronous application input/change handlers is not persistent application acceptance or later async revert proof. No React/trusted input/installed Edge/Firefox or paid site qualification claimed. Exact browser/build identity and final measured results will be recorded after verification.

## Final supervisor receipts

Actual production unpacked Chromium134.0.6998.35 passed1/1 in17.5s (18.8s total). Background/content build identities matched owning current artifact and are attached only in ignored test artifacts. Exact1.5/-3/date/time/month/week/datetime-local values held; malformed number/impossible date preserved prior value with no number input event; key cancellation, beforeinput cancellation, readonly and synchronous application revert refused. Normal text observed a/ab/abc input sequence; password result contained only existing redacted value descriptions; no form submit occurred. This is synthetic control/browser readiness, not live provider/task qualification. Final rebuilt Chrome/Firefox/e2e targets each verified22files, owning build14.561s exit0. Source/e2e typecheck0 (final repeat after test-only formatting follows), structure audit follows. No Core source edits or user-panel action.
