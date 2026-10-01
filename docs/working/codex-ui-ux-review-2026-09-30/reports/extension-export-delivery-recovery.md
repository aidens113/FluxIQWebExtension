# Extension export delivery recovery

Status: Complete
Owner: Codex supervisor
Date: 2026-10-01

## Current work

Exact released source/test paths and preservation rules are in parent ledger brief. Inspect/reproduce throwing delivery and URL/link resource lifetime with synthetic fixtures before fixing. No actual dataset data, browser/provider/panel activity or protocol/ownership expansion. Seventh validated utility source remains checkpointed in151fbd2e.

## Evidence

Source-confirmed: exportDataset drops lock before download hook, and a hook exception rejects without local notice/onChange. downloadFile creates URL before link setup/append, whose throws occur outside cleanup try. Existing delayed revocation on successful click is retained. Tests pending.

Original two-suite run:18tests12pass6fail/native1/168.8642ms. Failures reproduce thrown delivery, reentrant delivery export, leaked URLs during create/append failures, removal obscuring successful click and deferred cleanup throwing. Corrected exact four-path implementation passes18/18/native0/147.9789ms, retaining existing10 controller tests unchanged.

Controller now catches fixed local delivery failure and keeps its synchronous export lock until finally; explicit Retry/Open FluxIQ remains available. Download resource owner wraps link creation/append/click in cleanup, removes best-effort and retains delayed best-effort URL revocation. No actual export bodies/errors inspected or new protocol/cancellation policy. Actual-config strict scoped types38479 native0/no diagnostics, four roots. Broader gates await next source freeze.

Combined status/export six-root actual-config typing1135 passed/native0/no diagnostics. Both partitions frozen; extension full50040/types90037/build15517/structure66791 active, durable native-status logs retained. No full gate success claimed until actual completion.

Final full50040 native0,1833tests/114224.7451ms; types90037 native0/29248ms; build15517 native0,Chrome/Firefox/e2e22files each/24631ms; structure66791 native0,136warnings119baseline. Source and actual checks independently observed; coherent local checkpoint follows, no merge/push or live browser certification.
